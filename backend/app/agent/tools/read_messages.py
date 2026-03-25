from telethon import TelegramClient

from app.agent.permissions import PermissionLevel
from app.agent.registry import registry
from app.telegram.converters import message_to_schema


@registry.register(
    name="read_messages",
    description="Read recent messages from a Telegram chat. Returns message id, sender, text, and date.",
    permission=PermissionLevel.READ_ONLY,
    parameters={
        "type": "object",
        "properties": {
            "chat_id": {
                "type": "integer",
                "description": "The Telegram chat ID to read messages from",
            },
            "limit": {
                "type": "integer",
                "description": "Max number of messages to return (default 20)",
            },
        },
        "required": ["chat_id"],
    },
)
async def read_messages(client: TelegramClient, chat_id: int, limit: int = 20) -> dict:
    messages = await client.get_messages(chat_id, limit=limit)
    result = [message_to_schema(m, chat_id).model_dump() for m in messages]
    return {"messages": result}
