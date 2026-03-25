"""Helper service — consumes agent tasks from RabbitMQ and runs them."""

import asyncio
import json
import logging
import uuid

import aio_pika
from sqlalchemy import select
from telethon import TelegramClient
from telethon.sessions import StringSession

from app.agent.permissions import PermissionLevel
from app.config import settings
from app.database import async_session
from app.models.agent_config import AgentConfig
from app.models.user import User
from app.services.agent import run_agent
from app.services.rabbitmq import (
    TASK_QUEUE,
    WS_EXCHANGE,
    declare_infrastructure,
    get_connection,
    publish_ws_update,
)
from app.telegram.session_store import decrypt_session

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


async def _restore_client(user: User) -> TelegramClient | None:
    """Create a temporary TelegramClient from the user's encrypted session."""
    if not user.telegram_session_encrypted:
        return None

    session_str = decrypt_session(user.telegram_session_encrypted)
    client = TelegramClient(
        StringSession(session_str),
        settings.telegram_api_id,
        settings.telegram_api_hash,
    )
    await client.connect()

    if not await client.is_user_authorized():
        await client.disconnect()
        return None

    return client


async def _process_task(
    message: aio_pika.abc.AbstractIncomingMessage,
    ws_exchange: aio_pika.abc.AbstractExchange,
) -> None:
    async with message.process():
        task = json.loads(message.body)
        user_id = uuid.UUID(task["user_id"])
        request_id = task["request_id"]
        prompt = task["prompt"]
        conversation_id = uuid.UUID(task["conversation_id"])

        logger.info(
            "Processing task: user=%s conversation=%s request=%s",
            user_id, conversation_id, request_id,
        )

        # Load user and permission level from DB
        async with async_session() as db:
            user = (await db.execute(
                select(User).where(User.id == user_id)
            )).scalar_one_or_none()

            if user is None:
                logger.error("User %s not found, dropping task", user_id)
                return

            config = (await db.execute(
                select(AgentConfig).where(AgentConfig.user_id == user_id)
            )).scalar_one_or_none()

            level = PermissionLevel.from_string(
                config.permission_level if config else "read_only"
            )

        # Restore a temporary Telegram client
        client = await _restore_client(user)
        if client is None:
            logger.error("Could not restore Telegram client for user %s", user_id)
            # Notify frontend about the failure
            await publish_ws_update(
                ws_exchange,
                str(user_id),
                json.dumps({
                    "type": "agent_response",
                    "request_id": request_id,
                    "content": "Your Telegram session has expired. Please re-authenticate.",
                    "done": True,
                }),
            )
            return

        # Build a send callback that publishes to the ws_updates exchange
        async def send(uid: uuid.UUID, payload: str) -> None:
            await publish_ws_update(ws_exchange, str(uid), payload)

        try:
            await run_agent(
                user_id=user_id,
                request_id=request_id,
                prompt=prompt,
                permission_level=level,
                client=client,
                conversation_id=conversation_id,
                send=send,
            )
        except Exception:
            logger.exception("Agent failed for task %s", request_id)
            await publish_ws_update(
                ws_exchange,
                str(user_id),
                json.dumps({
                    "type": "agent_response",
                    "request_id": request_id,
                    "content": "Something went wrong while processing your request.",
                    "done": True,
                }),
            )
        finally:
            await client.disconnect()


async def main() -> None:
    logger.info("Helper starting...")

    connection = await get_connection()
    channel = await connection.channel()
    await channel.set_qos(prefetch_count=1)

    queue, ws_exchange = await declare_infrastructure(channel)

    logger.info("Helper ready — consuming from %s", TASK_QUEUE)

    async with queue.iterator() as queue_iter:
        async for message in queue_iter:
            await _process_task(message, ws_exchange)


if __name__ == "__main__":
    asyncio.run(main())
