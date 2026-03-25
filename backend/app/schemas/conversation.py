import uuid
from datetime import datetime

from pydantic import BaseModel


class ConversationOut(BaseModel):
    id: uuid.UUID
    title: str
    created_at: datetime
    updated_at: datetime


class ConversationMessageOut(BaseModel):
    id: uuid.UUID
    role: str
    content: str | None = None
    tool_calls: list | None = None
    tool_call_id: str | None = None
    created_at: datetime


class ConversationDetailOut(ConversationOut):
    messages: list[ConversationMessageOut]
