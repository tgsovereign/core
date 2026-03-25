from pydantic import BaseModel


class AgentConfigResponse(BaseModel):
    permission_level: str


class AgentConfigUpdate(BaseModel):
    permission_level: str
