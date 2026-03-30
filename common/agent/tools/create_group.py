from telethon import TelegramClient
from telethon.tl.functions.messages import CreateChatRequest

from ..permissions import PermissionLevel
from ..registry import registry


@registry.register(
    name="create_group",
    description="Create a new Telegram group chat with specified users. This is a high-impact action.",
    permission=PermissionLevel.FULL_AUTONOMY,
    parameters={
        "type": "object",
        "properties": {
            "title": {
                "type": "string",
                "description": "The title of the new group",
            },
            "user_ids": {
                "type": "array",
                "items": {"type": "integer"},
                "description": "List of user IDs to add to the group",
            },
        },
        "required": ["title", "user_ids"],
    },
)
async def create_group(
    client: TelegramClient, title: str, user_ids: list[int]
) -> dict:
    users = [await client.get_entity(uid) for uid in user_ids]
    result = await client(CreateChatRequest(users=users, title=title))
    chat_id = result.chats[0].id
    return {"success": True, "chat_id": chat_id}
