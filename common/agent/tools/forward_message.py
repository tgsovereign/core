from telethon import TelegramClient

from ..permissions import PermissionLevel
from ..registry import registry


@registry.register(
    name="forward_message",
    description="Forward a message from one chat to another.",
    permission=PermissionLevel.READ_WRITE,
    parameters={
        "type": "object",
        "properties": {
            "from_chat_id": {
                "type": "integer",
                "description": "The chat ID to forward the message from",
            },
            "message_id": {
                "type": "integer",
                "description": "The message ID to forward",
            },
            "to_chat_id": {
                "type": "integer",
                "description": "The chat ID to forward the message to",
            },
        },
        "required": ["from_chat_id", "message_id", "to_chat_id"],
    },
)
async def forward_message(
    client: TelegramClient, from_chat_id: int, message_id: int, to_chat_id: int
) -> dict:
    result = await client.forward_messages(to_chat_id, message_id, from_chat_id)
    fwd_id = result[0].id if isinstance(result, list) else result.id
    return {"success": True, "message_id": fwd_id}
