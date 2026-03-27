import asyncio
import json
import logging
import uuid
from collections.abc import Callable, Awaitable
from datetime import datetime, timezone

from openai import AsyncOpenAI
from sqlalchemy import select
from telethon import TelegramClient

from app.agent.executor import execute_tool
from app.agent.permissions import PermissionLevel
from app.agent.registry import registry
from app.database import async_session
from app.models.conversation import Conversation, ConversationMessage

# Type alias for the send callback: (user_id, message_json) -> None
SendFn = Callable[[uuid.UUID, str], Awaitable[None]]

logger = logging.getLogger(__name__)

SYSTEM_PROMPT = """You are Sovereign, an AI assistant with access to the user's Telegram account.

You have the following capabilities (depending on the user's permission level):
- READ: list chats, read messages, search messages, get chat/user info, list contacts
- WRITE: send messages, forward messages, edit messages, mark chats as read, pin/unpin messages
- FULL: delete messages, create group chats

Always explain what you're about to do before using a tool. Be concise and helpful.
When summarizing messages, include key points and who said what.
Never fabricate message content — only report what the tools return."""


async def _persist_message(
    conversation_id: uuid.UUID,
    role: str,
    content: str | None,
    tool_calls: list | None = None,
    tool_call_id: str | None = None,
) -> None:
    async with async_session() as db:
        msg = ConversationMessage(
            conversation_id=conversation_id,
            role=role,
            content=content,
            tool_calls=tool_calls,
            tool_call_id=tool_call_id,
        )
        db.add(msg)
        await db.commit()


async def _generate_title(
    user_id: uuid.UUID,
    conversation_id: uuid.UUID,
    first_message: str,
    send: SendFn,
    openai_client: AsyncOpenAI,
) -> None:
    try:
        response = await openai_client.chat.completions.create(
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
            stmt = select(Conversation).where(Conversation.id == conversation_id)
            result = await db.execute(stmt)
            conv = result.scalar_one_or_none()
            if conv:
                conv.title = title
                await db.commit()

        await send(
            user_id,
            json.dumps({
                "type": "conversation_title_updated",
                "conversation_id": str(conversation_id),
                "title": title,
            }),
        )
    except Exception:
        logger.exception("Failed to generate title for conversation %s", conversation_id)


async def _load_history(conversation_id: uuid.UUID, client: TelegramClient) -> list[dict]:
    """Load stored messages and rebuild the OpenAI messages list."""
    me = await client.get_me()
    user_context = (
        f"\n\nThe current user's Telegram account: "
        f"ID={me.id}, name={me.first_name or ''} {me.last_name or ''}, "
        f"username=@{me.username or 'N/A'}, phone={me.phone or 'N/A'}."
    )
    messages: list[dict] = [{"role": "system", "content": SYSTEM_PROMPT + user_context}]

    async with async_session() as db:
        stmt = (
            select(ConversationMessage)
            .where(ConversationMessage.conversation_id == conversation_id)
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


async def _update_conversation_timestamp(conversation_id: uuid.UUID) -> None:
    async with async_session() as db:
        stmt = select(Conversation).where(Conversation.id == conversation_id)
        result = await db.execute(stmt)
        conv = result.scalar_one_or_none()
        if conv:
            conv.updated_at = datetime.now(timezone.utc)
            await db.commit()


async def run_agent(
    user_id: uuid.UUID,
    request_id: str,
    prompt: str,
    permission_level: PermissionLevel,
    client: TelegramClient,
    conversation_id: uuid.UUID,
    send: SendFn,
    openai_api_key: str | None = None,
):
    # Ensure tools are imported
    import app.agent.tools  # noqa: F401

    if not openai_api_key:
        raise ValueError("No OpenAI API key configured. Please provide your API key.")

    openai_client = AsyncOpenAI(api_key=openai_api_key)

    tools = registry.get_openai_tools(permission_level)

    # Load conversation history
    messages = await _load_history(conversation_id, client)
    is_first_message = len(messages) == 1  # only system prompt

    # Persist and append user message
    await _persist_message(conversation_id, "user", prompt)
    messages.append({"role": "user", "content": prompt})

    # Auto-title on first message
    if is_first_message:
        asyncio.create_task(_generate_title(user_id, conversation_id, prompt, send, openai_client))

    for _ in range(10):  # Max iterations for the agentic loop
        response = await openai_client.chat.completions.create(
            model="gpt-5-mini",
            messages=messages,
            tools=tools if tools else None,
        )

        choice = response.choices[0]

        if choice.finish_reason == "stop" or not choice.message.tool_calls:
            content = choice.message.content or ""
            await _persist_message(conversation_id, "assistant", content)
            await _update_conversation_timestamp(conversation_id)

            await send(
                user_id,
                json.dumps({
                    "type": "agent_response",
                    "request_id": request_id,
                    "content": content,
                    "done": True,
                }),
            )
            return

        # Process tool calls — persist assistant message with tool_calls
        assistant_dump = choice.message.model_dump()
        tool_calls_data = assistant_dump.get("tool_calls")
        await _persist_message(
            conversation_id, "assistant", choice.message.content, tool_calls=tool_calls_data
        )
        messages.append(assistant_dump)

        for tool_call in choice.message.tool_calls:
            fn_name = tool_call.function.name
            fn_args = json.loads(tool_call.function.arguments)

            await send(
                user_id,
                json.dumps({
                    "type": "agent_tool_execution",
                    "request_id": request_id,
                    "tool": fn_name,
                    "arguments": fn_args,
                    "status": "running",
                }),
            )

            result = await execute_tool(fn_name, fn_args, client)

            # Persist tool result
            await _persist_message(
                conversation_id, "tool", json.dumps(result), tool_call_id=tool_call.id
            )

            await send(
                user_id,
                json.dumps({
                    "type": "agent_tool_execution",
                    "request_id": request_id,
                    "tool": fn_name,
                    "arguments": fn_args,
                    "status": "done",
                    "result": result,
                }),
            )

            messages.append({
                "role": "tool",
                "tool_call_id": tool_call.id,
                "content": json.dumps(result),
            })

    # If we exhausted iterations
    exhaust_msg = "I've reached the maximum number of steps. Please try a simpler request."
    await _persist_message(conversation_id, "assistant", exhaust_msg)
    await _update_conversation_timestamp(conversation_id)

    await send(
        user_id,
        json.dumps({
            "type": "agent_response",
            "request_id": request_id,
            "content": exhaust_msg,
            "done": True,
        }),
    )
