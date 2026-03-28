from telethon import TelegramClient

from helper.agent.permissions import PermissionLevel
from helper.agent.registry import registry


@registry.register(
    name="delete_message",
    description="Delete one or more messages from a chat. This is a destructive action.",
    permission=PermissionLevel.FULL_AUTONOMY,
    parameters={
        "type": "object",
        "properties": {
            "chat_id": {
                "type": "integer",
                "description": "The chat ID containing the messages",
            },
            "message_ids": {
                "type": "array",
                "items": {"type": "integer"},
                "description": "List of message IDs to delete",
            },
        },
        "required": ["chat_id", "message_ids"],
    },
)
async def delete_message(
    client: TelegramClient, chat_id: int, message_ids: list[int]
) -> dict:
    result = await client.delete_messages(chat_id, message_ids)
    deleted_count = getattr(result, "pts_count", len(message_ids))
    return {"success": True, "deleted_count": deleted_count}
