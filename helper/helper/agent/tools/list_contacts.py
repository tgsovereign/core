from telethon import TelegramClient
from telethon.tl.functions.contacts import GetContactsRequest
from telethon.tl.types import User as TlUser

from helper.agent.permissions import PermissionLevel
from helper.agent.registry import registry


@registry.register(
    name="list_contacts",
    description="List the user's Telegram contacts. Returns name, username, phone, and user ID.",
    permission=PermissionLevel.READ_ONLY,
    parameters={
        "type": "object",
        "properties": {
            "limit": {
                "type": "integer",
                "description": "Max number of contacts to return (default 50)",
            },
        },
        "required": [],
    },
)
async def list_contacts(client: TelegramClient, limit: int = 50) -> dict:
    result = await client(GetContactsRequest(hash=0))
    contacts = []
    for user in result.users[:limit]:
        if isinstance(user, TlUser):
            contacts.append({
                "id": user.id,
                "first_name": user.first_name or "",
                "last_name": user.last_name or "",
                "username": user.username,
                "phone": user.phone,
            })
    return {"contacts": contacts}
