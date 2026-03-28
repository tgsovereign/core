from telethon import TelegramClient

from helper.agent.permissions import PermissionLevel
from helper.agent.registry import registry


@registry.register(
    name="edit_message",
    description="Edit a message that was sent by the user. Only the user's own messages can be edited.",
    permission=PermissionLevel.READ_WRITE,
    parameters={
        "type": "object",
        "properties": {
            "chat_id": {
                "type": "integer",
                "description": "The chat ID containing the message",
            },
            "message_id": {
                "type": "integer",
                "description": "The message ID to edit",
            },
            "text": {
                "type": "string",
                "description": "The new text for the message",
            },
        },
        "required": ["chat_id", "message_id", "text"],
    },
)
async def edit_message(
    client: TelegramClient, chat_id: int, message_id: int, text: str
) -> dict:
    await client.edit_message(chat_id, message_id, text)
    return {"success": True}
