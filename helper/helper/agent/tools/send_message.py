from telethon import TelegramClient

from helper.agent.permissions import PermissionLevel
from helper.agent.registry import registry


@registry.register(
    name="send_message",
    description="Send a text message to a Telegram chat on behalf of the user.",
    permission=PermissionLevel.READ_WRITE,
    parameters={
        "type": "object",
        "properties": {
            "chat_id": {
                "type": "integer",
                "description": "The Telegram chat ID to send the message to",
            },
            "text": {
                "type": "string",
                "description": "The message text to send",
            },
            "reply_to": {
                "type": "integer",
                "description": "Optional message ID to reply to",
            },
        },
        "required": ["chat_id", "text"],
    },
)
async def send_message(
    client: TelegramClient, chat_id: int, text: str, reply_to: int | None = None
) -> dict:
    msg = await client.send_message(chat_id, text, reply_to=reply_to)
    return {"success": True, "message_id": msg.id}
