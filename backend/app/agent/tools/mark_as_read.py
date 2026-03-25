from telethon import TelegramClient

from app.agent.permissions import PermissionLevel
from app.agent.registry import registry


@registry.register(
    name="mark_as_read",
    description="Mark all messages in a chat as read.",
    permission=PermissionLevel.READ_WRITE,
    parameters={
        "type": "object",
        "properties": {
            "chat_id": {
                "type": "integer",
                "description": "The chat ID to mark as read",
            },
        },
        "required": ["chat_id"],
    },
)
async def mark_as_read(client: TelegramClient, chat_id: int) -> dict:
    await client.send_read_acknowledge(chat_id)
    return {"success": True}
