from telethon import TelegramClient

from app.agent.permissions import PermissionLevel
from app.agent.registry import registry


@registry.register(
    name="pin_message",
    description="Pin or unpin a message in a chat.",
    permission=PermissionLevel.READ_WRITE,
    parameters={
        "type": "object",
        "properties": {
            "chat_id": {
                "type": "integer",
                "description": "The chat ID",
            },
            "message_id": {
                "type": "integer",
                "description": "The message ID to pin or unpin",
            },
            "unpin": {
                "type": "boolean",
                "description": "If true, unpin the message instead of pinning it (default false)",
            },
        },
        "required": ["chat_id", "message_id"],
    },
)
async def pin_message(
    client: TelegramClient, chat_id: int, message_id: int, unpin: bool = False
) -> dict:
    if unpin:
        await client.unpin_message(chat_id, message_id)
    else:
        await client.pin_message(chat_id, message_id)
    return {"success": True}
