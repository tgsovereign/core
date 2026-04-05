import json
import logging
import uuid

from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from sqlalchemy import select

from app.database import async_session
from sovereign_schema.models.user import User
from app.routers import _state as router_state
from app.services.auth import decode_token
from app.services.rabbitmq import publish_task
from app.services.telegram import telegram_manager
from app.services.ws_manager import ws_manager
from app.telegram.event_handler import register_event_handlers

logger = logging.getLogger(__name__)

router = APIRouter()


@router.websocket("/api/ws")
async def websocket_endpoint(websocket: WebSocket, token: str | None = None):
    # Prefer cookie, fall back to query param for backwards compat
    cookie_token = websocket.cookies.get("token")
    effective_token = cookie_token or token
    if not effective_token:
        await websocket.close(code=4001, reason="Missing token")
        return

    try:
        user_id_str = decode_token(effective_token)
        user_id = uuid.UUID(user_id_str)
    except Exception:
        await websocket.close(code=4001, reason="Invalid token")
        return

    # Restore Telegram client if needed
    async with async_session() as db:
        stmt = select(User).where(User.id == user_id)
        result = await db.execute(stmt)
        user = result.scalar_one_or_none()
        if user is None:
            await websocket.close(code=4001, reason="User not found")
            return

        client = telegram_manager.get_client(user_id)
        if client is None:
            client = await telegram_manager.restore_client(user, ws_manager)
            if client is None:
                await websocket.close(code=4001, reason="Telegram session expired")
                return

        # Register event handlers if not already done
        register_event_handlers(client, user_id, ws_manager)

    await ws_manager.connect(user_id, websocket)

    try:
        while True:
            data = await websocket.receive_text()
            msg = json.loads(data)
            msg_type = msg.get("type")

            if msg_type == "agent_invoke":
                request_id = msg.get("request_id", str(uuid.uuid4()))
                prompt = msg.get("prompt", "")
                conversation_id_str = msg.get("conversation_id")

                if not conversation_id_str:
                    await websocket.send_text(json.dumps({
                        "type": "error",
                        "detail": "conversation_id is required",
                    }))
                    continue

                if router_state.rmq_channel is None:
                    await websocket.send_text(json.dumps({
                        "type": "error",
                        "detail": "Task queue unavailable",
                    }))
                    continue

                await publish_task(router_state.rmq_channel, {
                    "user_id": str(user_id),
                    "request_id": request_id,
                    "prompt": prompt,
                    "conversation_id": conversation_id_str,
                })

            elif msg_type == "mark_read":
                chat_id = msg.get("chat_id")
                max_id = msg.get("max_id")
                client = telegram_manager.get_client(user_id)
                if client and chat_id:
                    await client.send_read_acknowledge(chat_id, max_id=max_id)

            elif msg_type == "typing":
                chat_id = msg.get("chat_id")
                client = telegram_manager.get_client(user_id)
                if client and chat_id:
                    from telethon.tl.functions.messages import SetTypingRequest
                    from telethon.tl.types import SendMessageTypingAction
                    await client(SetTypingRequest(chat_id, SendMessageTypingAction()))

    except WebSocketDisconnect:
        ws_manager.disconnect(user_id, websocket)
    except Exception:
        logger.exception("WebSocket error")
        ws_manager.disconnect(user_id, websocket)
