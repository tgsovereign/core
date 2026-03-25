from telethon import TelegramClient

from app.agent.permissions import PermissionLevel
from app.agent.registry import registry
from app.telegram.converters import message_to_schema


@registry.register(
    name="search_messages",
    description="Search for messages containing a query string, either globally or within a specific chat.",
    permission=PermissionLevel.READ_ONLY,
    parameters={
        "type": "object",
        "properties": {
            "query": {
                "type": "string",
                "description": "The search query",
            },
            "chat_id": {
                "type": "integer",
                "description": "Optional chat ID to search within. Omit for global search.",
            },
            "limit": {
                "type": "integer",
                "description": "Max number of results (default 20)",
            },
        },
        "required": ["query"],
    },
)
async def search_messages(
    client: TelegramClient, query: str, chat_id: int | None = None, limit: int = 20
) -> dict:
    entity = chat_id if chat_id else None
    messages = await client.get_messages(entity, search=query, limit=limit)
    result = [
        message_to_schema(m, m.chat_id or 0).model_dump()
        for m in messages
    ]
    return {"messages": result}
