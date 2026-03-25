from telethon import TelegramClient
from telethon.tl.functions.users import GetFullUserRequest
from telethon.tl.types import UserStatusOnline, UserStatusOffline, UserStatusRecently

from app.agent.permissions import PermissionLevel
from app.agent.registry import registry


@registry.register(
    name="get_user_info",
    description="Get detailed information about a Telegram user, including bio, last seen status, and whether they are a bot.",
    permission=PermissionLevel.READ_ONLY,
    parameters={
        "type": "object",
        "properties": {
            "user_id": {
                "type": "integer",
                "description": "The Telegram user ID",
            },
        },
        "required": ["user_id"],
    },
)
async def get_user_info(client: TelegramClient, user_id: int) -> dict:
    if not user_id:
        return {"error": "user_id must be a valid non-zero Telegram user ID"}

    entity = await client.get_entity(user_id)
    full = await client(GetFullUserRequest(entity))
    user = full.users[0]

    last_seen = None
    if isinstance(user.status, UserStatusOnline):
        last_seen = "online"
    elif isinstance(user.status, UserStatusOffline):
        last_seen = user.status.was_online.isoformat() if user.status.was_online else "offline"
    elif isinstance(user.status, UserStatusRecently):
        last_seen = "recently"

    return {
        "id": user.id,
        "first_name": user.first_name or "",
        "last_name": user.last_name or "",
        "username": user.username,
        "phone": user.phone,
        "bio": full.full_user.about or "",
        "last_seen": last_seen,
        "is_bot": user.bot or False,
    }
