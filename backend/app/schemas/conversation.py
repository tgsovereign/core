import uuid
from datetime import datetime

from pydantic import BaseModel


class ConversationCreate(BaseModel):
    permission_level: str = "read_only"


class ConversationOut(BaseModel):
    model_config = {"from_attributes": True}

    id: uuid.UUID
    title: str
    permission_level: str
    created_at: datetime
    updated_at: datetime


class ConversationListOut(BaseModel):
    items: list[ConversationOut]
    total: int


class ConversationMessageOut(BaseModel):
    id: uuid.UUID
    role: str
    content: str | None = None
    tool_calls: list | None = None
    tool_call_id: str | None = None
    created_at: datetime


class ConversationDetailOut(ConversationOut):
    messages: list[ConversationMessageOut]


class ConversationConfigUpdate(BaseModel):
    conversation_id: uuid.UUID
    permission_level: str


class ConversationConfigResponse(BaseModel):
    permission_level: str
