import inspect
from dataclasses import dataclass, field
from typing import Any, Callable

from app.agent.permissions import PermissionLevel


@dataclass
class ToolDefinition:
    name: str
    description: str
    permission: PermissionLevel
    parameters: dict[str, Any]
    fn: Callable


class ToolRegistry:
    def __init__(self):
        self._tools: dict[str, ToolDefinition] = {}

    def register(
        self,
        name: str,
        description: str,
        permission: PermissionLevel,
        parameters: dict[str, Any],
    ):
        def decorator(fn: Callable):
            self._tools[name] = ToolDefinition(
                name=name,
                description=description,
                permission=permission,
                parameters=parameters,
                fn=fn,
            )
            return fn
        return decorator

    def get_tools_for_permission(self, level: PermissionLevel) -> list[ToolDefinition]:
        return [t for t in self._tools.values() if t.permission <= level]

    def get_openai_tools(self, level: PermissionLevel) -> list[dict]:
        tools = self.get_tools_for_permission(level)
        return [
            {
                "type": "function",
                "function": {
                    "name": t.name,
                    "description": t.description,
                    "parameters": t.parameters,
                },
            }
            for t in tools
        ]

    def get_tool(self, name: str) -> ToolDefinition | None:
        return self._tools.get(name)


# Global registry
registry = ToolRegistry()
