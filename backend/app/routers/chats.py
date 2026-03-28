from fastapi import APIRouter, Depends, HTTPException

from sovereign_schema.models.user import User
from app.schemas.chat import Chat, Message, SendMessageRequest
from app.services.auth import get_current_user
from app.services.telegram import telegram_manager
from app.telegram.converters import dialog_to_chat, message_to_schema

router = APIRouter(prefix="/api/chats", tags=["chats"])


def _get_client(user: User):
    client = telegram_manager.get_client(user.id)
    if client is None:
        raise HTTPException(status_code=401, detail="Telegram client not connected. Please re-authenticate.")
    return client


@router.get("", response_model=list[Chat])
async def list_chats(user: User = Depends(get_current_user)):
    client = _get_client(user)
    dialogs = await client.get_dialogs()
    return [dialog_to_chat(d) for d in dialogs]


@router.get("/{chat_id}/messages", response_model=list[Message])
async def get_messages(
    chat_id: int,
    limit: int = 50,
    before_id: int | None = None,
    user: User = Depends(get_current_user),
):
    client = _get_client(user)
    kwargs = {"limit": limit}
    if before_id:
        kwargs["max_id"] = before_id
    messages = await client.get_messages(chat_id, **kwargs)
    return [message_to_schema(m, chat_id) for m in messages]


@router.post("/{chat_id}/messages", response_model=Message)
async def send_message(
    chat_id: int,
    req: SendMessageRequest,
    user: User = Depends(get_current_user),
):
    client = _get_client(user)
    msg = await client.send_message(chat_id, req.text, reply_to=req.reply_to)
    return message_to_schema(msg, chat_id)
