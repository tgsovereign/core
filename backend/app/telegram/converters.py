from telethon.tl.types import (
    Channel,
    Chat as TlChat,
    User as TlUser,
)

from app.schemas.chat import Chat, Message


def dialog_to_chat(dialog) -> Chat:
    entity = dialog.entity
    if isinstance(entity, Channel):
        if entity.megagroup:
            chat_type = "supergroup"
        elif entity.broadcast:
            chat_type = "channel"
        else:
            chat_type = "group"
    elif isinstance(entity, TlChat):
        chat_type = "group"
    else:
        chat_type = "user"

    last_msg = None
    if dialog.message:
        last_msg = message_to_schema(dialog.message, dialog.entity.id)

    return Chat(
        id=dialog.entity.id,
        title=dialog.title or dialog.name or "",
        type=chat_type,
        unread_count=dialog.unread_count,
        is_pinned=dialog.pinned,
        last_message=last_msg,
    )


def message_to_schema(msg, chat_id: int) -> Message:
    sender_name = ""
    sender_id = None
    if msg.sender:
        sender_id = msg.sender_id
        if isinstance(msg.sender, TlUser):
            parts = [msg.sender.first_name or "", msg.sender.last_name or ""]
            sender_name = " ".join(p for p in parts if p)
        else:
            sender_name = getattr(msg.sender, "title", "") or ""

    return Message(
        id=msg.id,
        chat_id=chat_id,
        sender_id=sender_id,
        sender_name=sender_name,
        text=msg.text or None,
        date=msg.date.isoformat() if msg.date else "",
        reply_to_id=msg.reply_to.reply_to_msg_id if msg.reply_to else None,
        is_outgoing=msg.out,
        edit_date=msg.edit_date.isoformat() if msg.edit_date else None,
    )
