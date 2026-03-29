import logging
from typing import Any

from .registry import ToolRegistry

logger = logging.getLogger(__name__)


async def execute_tool(
    registry: ToolRegistry,
    tool_name: str,
    arguments: dict[str, Any],
    **context: Any,
) -> dict[str, Any]:
    """Look up *tool_name* in *registry* and call it.

    Any extra ``**context`` keyword arguments (e.g. ``client=…``) are
    forwarded to the tool function alongside the parsed ``arguments``.
    """
    tool = registry.get_tool(tool_name)
    if tool is None:
        return {"error": f"Unknown tool: {tool_name}"}

    try:
        result = await tool.fn(**context, **arguments)
        logger.info("Tool %s executed successfully", tool_name)
        return result
    except Exception as e:
        logger.exception("Tool %s failed", tool_name)
        return {"error": str(e)}
