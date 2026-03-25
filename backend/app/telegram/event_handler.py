import json
import logging
import uuid

from telethon import events, TelegramClient

from app.telegram.converters import message_to_schema

logger = logging.getLogger(__name__)


def register_event_handlers(
    client: TelegramClient,
    user_id: uuid.UUID,
    ws_manager,
):
    @client.on(events.NewMessage)
    async def on_new_message(event):
        chat_id = event.chat_id
        msg = message_to_schema(event.message, chat_id)
        await ws_manager.broadcast(
            user_id,
            json.dumps({"type": "new_message", "chat_id": chat_id, "message": msg.model_dump()}),
        )

    @client.on(events.MessageEdited)
    async def on_message_edited(event):
        chat_id = event.chat_id
        msg = message_to_schema(event.message, chat_id)
        await ws_manager.broadcast(
            user_id,
            json.dumps({"type": "message_edit", "chat_id": chat_id, "message": msg.model_dump()}),
        )

    @client.on(events.MessageDeleted)
    async def on_message_deleted(event):
        await ws_manager.broadcast(
            user_id,
            json.dumps({
                "type": "message_delete",
                "chat_id": getattr(event, "chat_id", None),
                "message_ids": event.deleted_ids,
            }),
        )
