import uuid
from datetime import datetime
from typing import Literal

from pydantic import BaseModel


# --- CRUD schemas ---

class AgentTaskCreate(BaseModel):
    task_type: Literal["one_off", "cron", "event_driven"]
    name: str
    system_prompt: str
    permission_level: str = "read_only"
    cron_expression: str | None = None
    scheduled_at: datetime | None = None
    event_config: dict | None = None


class AgentTaskUpdate(BaseModel):
    name: str | None = None
    system_prompt: str | None = None
    permission_level: str | None = None
    cron_expression: str | None = None
    scheduled_at: datetime | None = None
    event_config: dict | None = None


class AgentTaskOut(BaseModel):
    model_config = {"from_attributes": True}

    id: uuid.UUID
    task_type: str
    name: str
    system_prompt: str
    permission_level: str
    cron_expression: str | None = None
    scheduled_at: datetime | None = None
    event_config: dict | None = None
    enabled: bool
    has_telegram_session: bool
    created_at: datetime
    updated_at: datetime


class AgentTaskListOut(BaseModel):
    items: list[AgentTaskOut]
    total: int


class AgentTaskUpdateOut(BaseModel):
    model_config = {"from_attributes": True}

    id: uuid.UUID
    role: str
    content: str | None = None
    tool_calls: dict | None = None
    tool_call_id: str | None = None
    created_at: datetime


class AgentTaskDetailOut(AgentTaskOut):
    updates: list[AgentTaskUpdateOut] = []


# --- Agent Telegram auth schemas ---

class AgentAuthSendCodeRequest(BaseModel):
    agent_task_id: uuid.UUID
    phone: str


class AgentAuthSendCodeResponse(BaseModel):
    phone_code_hash: str


class AgentAuthVerifyCodeRequest(BaseModel):
    agent_task_id: uuid.UUID
    phone: str
    code: str
    phone_code_hash: str


class AgentAuthVerifyCodeResponse(BaseModel):
    success: bool = False
    needs_2fa: bool = False


class AgentAuthVerify2FARequest(BaseModel):
    agent_task_id: uuid.UUID
    phone: str
    password: str


class AgentAuthVerify2FAResponse(BaseModel):
    success: bool = True
