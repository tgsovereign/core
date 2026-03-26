import json
import logging
from typing import Any

import aio_pika
from aio_pika import DeliveryMode, ExchangeType, Message

from app.config import settings

logger = logging.getLogger(__name__)

TASK_QUEUE = "agent_tasks"
WS_EXCHANGE = "ws_updates"


async def get_connection() -> aio_pika.abc.AbstractRobustConnection:
    return await aio_pika.connect_robust(settings.rabbitmq_url)


async def declare_infrastructure(
    channel: aio_pika.abc.AbstractChannel,
) -> tuple[aio_pika.abc.AbstractQueue, aio_pika.abc.AbstractExchange]:
    """Declare the task queue and ws_updates exchange. Returns (queue, exchange)."""
    queue = await channel.declare_queue(TASK_QUEUE, durable=True)
    exchange = await channel.declare_exchange(WS_EXCHANGE, ExchangeType.FANOUT, durable=True)
    return queue, exchange


async def publish_task(channel: aio_pika.abc.AbstractChannel, task: dict[str, Any]) -> None:
    """Publish an agent task to the task queue."""
    await channel.default_exchange.publish(
        Message(
            body=json.dumps(task).encode(),
            delivery_mode=DeliveryMode.PERSISTENT,
        ),
        routing_key=TASK_QUEUE,
    )


async def publish_ws_update(
    exchange: aio_pika.abc.AbstractExchange,
    user_id: str,
    payload: str,
) -> None:
    """Publish a WebSocket update for the backend to relay."""
    message = json.dumps({"user_id": user_id, "payload": payload})
    await exchange.publish(
        Message(body=message.encode()),
        routing_key="",
    )
