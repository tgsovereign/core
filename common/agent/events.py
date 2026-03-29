from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any


@dataclass(frozen=True)
class ToolCall:
    """The model wants to invoke a tool."""

    call_id: str
    tool_name: str
    arguments: dict[str, Any]


@dataclass(frozen=True)
class ToolResult:
    """A tool has finished executing."""

    call_id: str
    tool_name: str
    arguments: dict[str, Any]
    result: dict[str, Any]


@dataclass(frozen=True)
class AssistantMessage:
    """An assistant text message (may accompany tool calls)."""

    content: str
    tool_calls: list[dict[str, Any]] = field(default_factory=list)


@dataclass(frozen=True)
class Done:
    """Final assistant reply — the agentic loop has finished."""

    content: str


# Union of all events the agent can yield.
Event = ToolCall | ToolResult | AssistantMessage | Done
