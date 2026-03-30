import json
import logging
from typing import Any

import aio_pika
from aio_pika import DeliveryMode, ExchangeType, Message

from helper.config import settings

logger = logging.getLogger(__name__)

TASK_QUEUE = "agent_tasks"
WS_EXCHANGE = "ws_updates"


class RabbitService:
    """Manages the RabbitMQ connection, task queue, and WS update exchange."""

    def __init__(self) -> None:
        self.connection: aio_pika.abc.AbstractRobustConnection | None = None
        self.channel: aio_pika.abc.AbstractChannel | None = None
        self.queue: aio_pika.abc.AbstractQueue | None = None
        self.ws_exchange: aio_pika.abc.AbstractExchange | None = None

    async def connect(self, *, prefetch_count: int = 8) -> None:
        self.connection = await aio_pika.connect_robust(settings.rabbitmq_url)
        self.channel = await self.connection.channel()
        await self.channel.set_qos(prefetch_count=prefetch_count)

        self.queue = await self.channel.declare_queue(TASK_QUEUE, durable=True)
        self.ws_exchange = await self.channel.declare_exchange(
            WS_EXCHANGE,
            ExchangeType.FANOUT,
            durable=True,
        )

    async def close(self) -> None:
        if self.channel:
            await self.channel.close()
        if self.connection:
            await self.connection.close()

    async def publish_task(self, task: dict[str, Any]) -> None:
        assert self.channel is not None
        await self.channel.default_exchange.publish(
            Message(
                body=json.dumps(task).encode(),
                delivery_mode=DeliveryMode.PERSISTENT,
            ),
            routing_key=TASK_QUEUE,
        )

    async def publish_ws_update(self, user_id: str, payload: dict[str, Any]) -> None:
        assert self.ws_exchange is not None
        message = json.dumps({"user_id": user_id, "payload": payload})
        await self.ws_exchange.publish(
            Message(body=message.encode()),
            routing_key="",
        )
