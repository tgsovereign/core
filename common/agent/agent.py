from __future__ import annotations

import json
import logging
from collections.abc import AsyncIterator
from typing import Any

from openai import AsyncOpenAI

from .events import AssistantMessage, Done, Event, ToolCall, ToolResult
from .executor import execute_tool
from .permissions import PermissionLevel
from .registry import ToolRegistry

logger = logging.getLogger(__name__)

DEFAULT_MAX_ITERATIONS = 10


class Agent:
    """Infrastructure-agnostic LLM agentic loop.

    Handles the OpenAI chat-completions ↔ tool-execution cycle.
    Yields ``Event`` objects so the caller can persist, stream, or
    transform them however it likes.
    """

    def __init__(
        self,
        openai_client: AsyncOpenAI,
        registry: ToolRegistry,
        *,
        model: str = "gpt-5-mini",
        max_iterations: int = DEFAULT_MAX_ITERATIONS,
    ) -> None:
        self.openai_client = openai_client
        self.registry = registry
        self.model = model
        self.max_iterations = max_iterations

    async def run(
        self,
        messages: list[dict[str, Any]],
        permission_level: PermissionLevel,
        *,
        tool_context: dict[str, Any] | None = None,
    ) -> AsyncIterator[Event]:
        """Run the agentic loop, yielding events as they happen.

        Parameters
        ----------
        messages:
            Full message history in OpenAI format (including the system
            prompt).  The list is **mutated in-place** — tool-call and
            tool-result messages are appended so the caller can inspect
            the final state.
        permission_level:
            Determines which tools the model can see / invoke.
        tool_context:
            Extra keyword arguments forwarded to every tool function
            (e.g. ``{"client": telegram_client}``).
        """
        tools_schema = self.registry.get_openai_tools(permission_level)
        ctx = tool_context or {}

        for _ in range(self.max_iterations):
            response = await self.openai_client.chat.completions.create(
                model=self.model,
                messages=messages,
                tools=tools_schema or None,
            )

            choice = response.choices[0]

            # --- No tool calls → final reply ---
            if choice.finish_reason == "stop" or not choice.message.tool_calls:
                content = choice.message.content or ""
                yield Done(content=content)
                return

            # --- Assistant message with tool calls ---
            assistant_dump = choice.message.model_dump()
            tool_calls_data = assistant_dump.get("tool_calls")
            messages.append(assistant_dump)

            yield AssistantMessage(
                content=choice.message.content or "",
                tool_calls=tool_calls_data or [],
            )

            # --- Execute each tool ---
            for tool_call in choice.message.tool_calls:
                fn_name = tool_call.function.name
                fn_args = json.loads(tool_call.function.arguments)

                yield ToolCall(
                    call_id=tool_call.id,
                    tool_name=fn_name,
                    arguments=fn_args,
                )

                result = await execute_tool(
                    self.registry,
                    fn_name,
                    fn_args,
                    **ctx,
                )

                messages.append(
                    {
                        "role": "tool",
                        "tool_call_id": tool_call.id,
                        "content": json.dumps(result),
                    }
                )

                yield ToolResult(
                    call_id=tool_call.id,
                    tool_name=fn_name,
                    arguments=fn_args,
                    result=result,
                )

        # Exhausted iterations
        yield Done(
            content="I've reached the maximum number of steps. Please try a simpler request.",
        )
