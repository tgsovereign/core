from telethon import TelegramClient
from telethon.tl.functions.messages import GetDialogFiltersRequest
from telethon.tl.types import DialogFilter, DialogFilterDefault

from helper.agent.permissions import PermissionLevel
from helper.agent.registry import registry


@registry.register(
    name="list_folders",
    description="List the user's Telegram chat folders (filters). Returns folder id, title, and included/excluded chat IDs.",
    permission=PermissionLevel.READ_ONLY,
    parameters={
        "type": "object",
        "properties": {},
        "required": [],
    },
)
async def list_folders(client: TelegramClient) -> dict:
    result = await client(GetDialogFiltersRequest())
    folders = []
    for f in result.filters:
        if isinstance(f, DialogFilterDefault):
            folders.append({"id": 0, "title": "All Chats", "include_peers": [], "exclude_peers": []})
        elif isinstance(f, DialogFilter):
            folders.append({
                "id": f.id,
                "title": f.title.text if hasattr(f.title, "text") else str(f.title),
                "include_peers": [p.channel_id if hasattr(p, "channel_id") else p.chat_id if hasattr(p, "chat_id") else p.user_id for p in f.include_peers],
                "exclude_peers": [p.channel_id if hasattr(p, "channel_id") else p.chat_id if hasattr(p, "chat_id") else p.user_id for p in f.exclude_peers],
            })
    return {"folders": folders}
