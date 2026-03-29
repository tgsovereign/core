from telethon import TelegramClient
from telethon.tl.functions.channels import GetFullChannelRequest
from telethon.tl.functions.messages import GetFullChatRequest
from telethon.tl.types import Channel, Chat as TlChat, User as TlUser

from ..permissions import PermissionLevel
from ..registry import registry


@registry.register(
    name="get_chat_info",
    description="Get detailed information about a Telegram chat/channel/group/user, including description, members count, and username.",
    permission=PermissionLevel.READ_ONLY,
    parameters={
        "type": "object",
        "properties": {
            "chat_id": {
                "type": "integer",
                "description": "The Telegram chat ID",
            },
        },
        "required": ["chat_id"],
    },
)
async def get_chat_info(client: TelegramClient, chat_id: int) -> dict:
    entity = await client.get_entity(chat_id)

    info: dict = {"id": chat_id}

    if isinstance(entity, Channel):
        info["type"] = "channel" if entity.broadcast else "supergroup" if entity.megagroup else "group"
        info["title"] = entity.title or ""
        info["username"] = entity.username
        full = await client(GetFullChannelRequest(entity))
        info["description"] = full.full_chat.about or ""
        info["members_count"] = full.full_chat.participants_count
    elif isinstance(entity, TlChat):
        info["type"] = "group"
        info["title"] = entity.title or ""
        info["username"] = None
        full = await client(GetFullChatRequest(entity.id))
        info["description"] = full.full_chat.about or ""
        info["members_count"] = full.full_chat.participants_count
    elif isinstance(entity, TlUser):
        info["type"] = "user"
        info["title"] = " ".join(p for p in [entity.first_name, entity.last_name] if p)
        info["username"] = entity.username
        info["description"] = ""
        info["members_count"] = None
    else:
        info["type"] = "unknown"
        info["title"] = str(entity)

    return info
