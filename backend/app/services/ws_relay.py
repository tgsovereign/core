"""Subscribe to the ws_updates RabbitMQ exchange and forward messages to WebSocket clients."""

import json
import logging
import uuid

import aio_pika

from app.services.rabbitmq import WS_EXCHANGE, get_connection
from app.services.ws_manager import ws_manager

logger = logging.getLogger(__name__)


async def start_ws_relay() -> aio_pika.abc.AbstractRobustConnection:
    """Start consuming ws_updates and relaying to WebSocket clients.

    Returns the connection so the caller can close it on shutdown.
    """
    connection = await get_connection()
    channel = await connection.channel()

    exchange = await channel.declare_exchange(
        WS_EXCHANGE, aio_pika.ExchangeType.FANOUT, durable=True
    )

    # Anonymous exclusive queue — each backend instance gets its own
    queue = await channel.declare_queue(exclusive=True)
    await queue.bind(exchange)

    async def _on_message(message: aio_pika.abc.AbstractIncomingMessage) -> None:
        async with message.process():
            try:
                data = json.loads(message.body)
                user_id = uuid.UUID(data["user_id"])
                payload = data["payload"]
                await ws_manager.send(user_id, payload)
            except Exception:
                logger.exception("Failed to relay WS update")

    await queue.consume(_on_message)
    logger.info("WebSocket relay started — listening on %s exchange", WS_EXCHANGE)
    return connection
