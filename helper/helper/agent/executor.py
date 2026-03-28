import json
import logging

from telethon import TelegramClient

from helper.agent.registry import registry

logger = logging.getLogger(__name__)


async def execute_tool(
    tool_name: str,
    arguments: dict,
    client: TelegramClient,
) -> dict:
    tool = registry.get_tool(tool_name)
    if tool is None:
        return {"error": f"Unknown tool: {tool_name}"}

    try:
        result = await tool.fn(client=client, **arguments)
        logger.info("Tool %s executed successfully", tool_name)
        return result
    except Exception as e:
        logger.exception("Tool %s failed", tool_name)
        return {"error": str(e)}
