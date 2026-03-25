from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.agent_config import AgentConfig
from app.models.user import User
from app.schemas.agent import AgentConfigResponse, AgentConfigUpdate
from app.services.auth import get_current_user

router = APIRouter(prefix="/api/agent", tags=["agent"])

VALID_LEVELS = {"read_only", "read_write", "full_autonomy"}


@router.get("/config", response_model=AgentConfigResponse)
async def get_config(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    stmt = select(AgentConfig).where(AgentConfig.user_id == user.id)
    result = await db.execute(stmt)
    config = result.scalar_one_or_none()
    if config is None:
        return AgentConfigResponse(permission_level="read_only")
    return AgentConfigResponse(permission_level=config.permission_level)


@router.put("/config", response_model=AgentConfigResponse)
async def update_config(
    req: AgentConfigUpdate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if req.permission_level not in VALID_LEVELS:
        raise HTTPException(status_code=400, detail=f"Invalid permission level. Must be one of: {VALID_LEVELS}")

    stmt = select(AgentConfig).where(AgentConfig.user_id == user.id)
    result = await db.execute(stmt)
    config = result.scalar_one_or_none()

    if config is None:
        config = AgentConfig(user_id=user.id, permission_level=req.permission_level)
        db.add(config)
    else:
        config.permission_level = req.permission_level

    await db.commit()
    return AgentConfigResponse(permission_level=config.permission_level)
