"""Helper service — consumes agent tasks from RabbitMQ and runs them."""

import asyncio
import json
import logging
import os
import signal
import uuid
from typing import Any

import aio_pika
from openai import AsyncOpenAI
from sqlalchemy import select
from telethon import TelegramClient
from telethon.sessions import StringSession

from sovereign_schema.crypto import init_crypto, decrypt_session
from sovereign_schema.models.conversation import Conversation
from sovereign_schema.models.user import User

from agent.permissions import PermissionLevel
from worker.config import settings
from worker.database import async_session, engine
from worker.services.agent import AgentService
from worker.services.rabbitmq import RabbitService

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
    rabbit: RabbitService,
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

            conv = (await db.execute(
                select(Conversation).where(Conversation.id == conversation_id)
            )).scalar_one_or_none()

            level = PermissionLevel.from_string(
                conv.permission_level if conv else "read_only"
            )

            # Decrypt user's OpenAI API key
            openai_api_key: str | None = None
            if user.openai_api_key_encrypted:
                openai_api_key = decrypt_session(user.openai_api_key_encrypted)

        # Restore a temporary Telegram client
        client = await _restore_client(user)
        if client is None:
            logger.error("Could not restore Telegram client for user %s", user_id)
            await rabbit.publish_ws_update(
                str(user_id),
                {
                    "type": "agent_response",
                    "request_id": request_id,
                    "content": "Your Telegram session has expired. Please re-authenticate.",
                    "done": True,
                },
            )
            return

        # Build a send callback bound to this RabbitService instance
        async def send(uid: uuid.UUID, payload: dict[str, Any]) -> None:
            await rabbit.publish_ws_update(str(uid), payload)

        try:
            if not openai_api_key:
                raise ValueError("No OpenAI API key configured.")

            svc = AgentService(
                user_id=user_id,
                conversation_id=conversation_id,
                request_id=request_id,
                send=send,
                openai_client=AsyncOpenAI(api_key=openai_api_key),
                client=client,
            )
            await svc.run(prompt, level)
        except Exception:
            logger.exception("Agent failed for task %s", request_id)
            await rabbit.publish_ws_update(
                str(user_id),
                {
                    "type": "agent_response",
                    "request_id": request_id,
                    "content": "Something went wrong while processing your request.",
                    "done": True,
                },
            )
        finally:
            await client.disconnect()


async def main() -> None:
    logger.info("Helper starting...")

    init_crypto(settings.session_encryption_key)

    prefetch_count = int(os.environ.get("PREFETCH_COUNT") or 8)
    shutdown_timeout = int(os.environ.get("SHUTDOWN_TIMEOUT") or 30)

    shutdown_event = asyncio.Event()
    in_flight: set[asyncio.Task] = set()

    loop = asyncio.get_running_loop()
    for sig in (signal.SIGTERM, signal.SIGINT):
        loop.add_signal_handler(sig, shutdown_event.set)

    rabbit = RabbitService()
    await rabbit.connect(prefetch_count=prefetch_count)

    logger.info("Helper ready — consuming (prefetch=%d)", prefetch_count)

    async def _consume() -> None:
        assert rabbit.queue is not None
        async with rabbit.queue.iterator() as queue_iter:
            async for message in queue_iter:
                task = asyncio.create_task(_process_task(message, rabbit))
                in_flight.add(task)
                task.add_done_callback(in_flight.discard)

    consume_task = asyncio.create_task(_consume())

    # Block until shutdown signal
    await shutdown_event.wait()
    logger.info("Shutdown signal received — stopping consumer...")

    # Stop consuming new messages
    consume_task.cancel()
    try:
        await consume_task
    except asyncio.CancelledError:
        pass

    # Wait for in-flight tasks to finish
    if in_flight:
        logger.info("Waiting for %d in-flight tasks (timeout=%ds)...", len(in_flight), shutdown_timeout)
        _done, pending = await asyncio.wait(in_flight, timeout=shutdown_timeout)
        if pending:
            logger.warning("Cancelling %d tasks that did not finish in time", len(pending))
            for t in pending:
                t.cancel()
            await asyncio.wait(pending, timeout=5)

    # Clean up connections
    await rabbit.close()
    await engine.dispose()
    logger.info("Helper shut down.")


if __name__ == "__main__":
    asyncio.run(main())
