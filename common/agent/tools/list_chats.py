from telethon import TelegramClient

from ..permissions import PermissionLevel
from ..registry import registry
from ..converters import dialog_to_chat


@registry.register(
    name="list_chats",
    description="List the user's Telegram chats/dialogs. Returns chat id, title, type, and unread count.",
    permission=PermissionLevel.READ_ONLY,
    parameters={
        "type": "object",
        "properties": {
            "limit": {
                "type": "integer",
                "description": "Max number of chats to return (default 20)",
            },
        },
        "required": [],
    },
)
async def list_chats(client: TelegramClient, limit: int = 20) -> dict:
    dialogs = await client.get_dialogs(limit=limit)
    chats = [dialog_to_chat(d) for d in dialogs]
    return {"chats": chats}
