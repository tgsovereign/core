import asyncio
import json
import logging
import uuid
from collections.abc import Awaitable, Callable
from datetime import datetime, timezone
from typing import Any

from openai import AsyncOpenAI
from sqlalchemy import select
from telethon import TelegramClient

from agent import Agent, AssistantMessage, Done, ToolCall, ToolResult, registry
from agent.permissions import PermissionLevel
import agent.tools  # noqa: F401 — triggers tool registration on the shared registry

from worker.database import async_session
from sovereign_schema.models.conversation import Conversation, ConversationMessage

# Type alias for the send callback: (user_id, payload_dict) -> None
SendFn = Callable[[uuid.UUID, dict[str, Any]], Awaitable[None]]

logger = logging.getLogger(__name__)

SYSTEM_PROMPT = """You are Sovereign, an AI assistant with access to the user's Telegram account.

You have the following capabilities (depending on the user's permission level):
- READ: list chats, read messages, search messages, get chat/user info, list contacts
- WRITE: send messages, forward messages, edit messages, mark chats as read, pin/unpin messages
- FULL: delete messages, create group chats

Always explain what you're about to do before using a tool. Be concise and helpful.
When summarizing messages, include key points and who said what.
Never fabricate message content — only report what the tools return."""


class AgentService:
    """Orchestrates an Agent run with persistence and transport."""

    def __init__(
        self,
        user_id: uuid.UUID,
        conversation_id: uuid.UUID,
        request_id: str,
        send: SendFn,
        openai_client: AsyncOpenAI,
        client: TelegramClient,
    ) -> None:
        self.user_id = user_id
        self.conversation_id = conversation_id
        self.request_id = request_id
        self.send = send
        self.openai_client = openai_client
        self.client = client

    async def _persist_message(
        self,
        role: str,
        content: str | None,
        tool_calls: list | None = None,
        tool_call_id: str | None = None,
    ) -> None:
        async with async_session() as db:
            msg = ConversationMessage(
                conversation_id=self.conversation_id,
                role=role,
                content=content,
                tool_calls=tool_calls,
                tool_call_id=tool_call_id,
            )
            db.add(msg)
            await db.commit()

    async def _generate_title(self, first_message: str) -> None:
        try:
            response = await self.openai_client.chat.completions.create(
                model="gpt-5-nano",
                messages=[
                    {
                        "role": "system",
                        "content": "Generate a very short title (max 6 words) for a conversation that starts with the following user message. Return only the title, no quotes.",
                    },
                    {"role": "user", "content": first_message},
                ],
            )
            title = (response.choices[0].message.content or "New conversation").strip()[:255]

            async with async_session() as db:
                stmt = select(Conversation).where(Conversation.id == self.conversation_id)
                result = await db.execute(stmt)
                conv = result.scalar_one_or_none()
                if conv:
                    conv.title = title
                    await db.commit()

            await self.send(
                self.user_id,
                {
                    "type": "conversation_title_updated",
                    "request_id": self.request_id,
                    "conversation_id": str(self.conversation_id),
                    "title": title,
                },
            )
        except Exception:
            logger.exception("Failed to generate title for conversation %s", self.conversation_id)

    async def _load_history(self) -> list[dict]:
        """Load stored messages and rebuild the OpenAI messages list."""
        me = await self.client.get_me()
        user_context = (
            f"\n\nThe current user's Telegram account: "
            f"ID={me.id}, name={me.first_name or ''} {me.last_name or ''}, "
            f"username=@{me.username or 'N/A'}, phone={me.phone or 'N/A'}."
        )
        messages: list[dict] = [{"role": "system", "content": SYSTEM_PROMPT + user_context}]

        async with async_session() as db:
            stmt = (
                select(ConversationMessage)
                .where(ConversationMessage.conversation_id == self.conversation_id)
                .order_by(ConversationMessage.created_at)
            )
            result = await db.execute(stmt)
            rows = result.scalars().all()

        for row in rows:
            if row.role == "assistant" and row.tool_calls:
                messages.append({
                    "role": "assistant",
                    "content": row.content,
                    "tool_calls": row.tool_calls,
                })
            elif row.role == "tool":
                messages.append({
                    "role": "tool",
                    "tool_call_id": row.tool_call_id,
                    "content": row.content or "",
                })
            else:
                messages.append({"role": row.role, "content": row.content or ""})

        return messages

    async def _update_conversation_timestamp(self) -> None:
        async with async_session() as db:
            stmt = select(Conversation).where(Conversation.id == self.conversation_id)
            result = await db.execute(stmt)
            conv = result.scalar_one_or_none()
            if conv:
                conv.updated_at = datetime.now(timezone.utc)
                await db.commit()

    async def run(self, prompt: str, permission_level: PermissionLevel) -> None:
        messages = await self._load_history()
        is_first_message = len(messages) == 1  # only system prompt

        await self._persist_message("user", prompt)
        messages.append({"role": "user", "content": prompt})

        if is_first_message:
            asyncio.create_task(self._generate_title(prompt))

        ai = Agent(self.openai_client, registry)

        async for event in ai.run(
            messages,
            permission_level,
            tool_context={"client": self.client},
        ):
            match event:
                case AssistantMessage(content=content, tool_calls=tool_calls):
                    await self._persist_message(
                        "assistant", content, tool_calls=tool_calls
                    )

                case ToolCall(tool_name=fn_name, arguments=fn_args):
                    await self.send(
                        self.user_id,
                        {
                            "type": "agent_tool_execution",
                            "request_id": self.request_id,
                            "tool": fn_name,
                            "arguments": fn_args,
                            "status": "running",
                        },
                    )

                case ToolResult(call_id=call_id, tool_name=fn_name, arguments=fn_args, result=result):
                    await self._persist_message(
                        "tool", json.dumps(result), tool_call_id=call_id
                    )
                    await self.send(
                        self.user_id,
                        {
                            "type": "agent_tool_execution",
                            "request_id": self.request_id,
                            "tool": fn_name,
                            "arguments": fn_args,
                            "status": "done",
                            "result": result,
                        },
                    )

                case Done(content=content):
                    await self._persist_message("assistant", content)
                    await self._update_conversation_timestamp()
                    await self.send(
                        self.user_id,
                        {
                            "type": "agent_response",
                            "request_id": self.request_id,
                            "content": content,
                            "done": True,
                        },
                    )
