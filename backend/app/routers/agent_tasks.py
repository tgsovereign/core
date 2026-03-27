import uuid

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.agent_task import AgentTask
from app.models.user import User
from app.schemas.agent_task import (
    AgentAuthSendCodeRequest,
    AgentAuthSendCodeResponse,
    AgentAuthVerifyCodeRequest,
    AgentAuthVerifyCodeResponse,
    AgentAuthVerify2FARequest,
    AgentAuthVerify2FAResponse,
    AgentTaskCreate,
    AgentTaskListOut,
    AgentTaskOut,
    AgentTaskUpdate,
)
from app.services.auth import get_current_user
from app.services.telegram import telegram_manager

router = APIRouter(prefix="/api/agent-tasks", tags=["agent-tasks"])

VALID_PERMISSION_LEVELS = {"read_only", "read_write", "full_autonomy"}


def _task_to_out(task: AgentTask) -> AgentTaskOut:
    return AgentTaskOut(
        id=task.id,
        task_type=task.task_type,
        name=task.name,
        system_prompt=task.system_prompt,
        permission_level=task.permission_level,
        cron_expression=task.cron_expression,
        scheduled_at=task.scheduled_at,
        event_type=task.event_type,
        enabled=task.enabled,
        has_telegram_session=task.telegram_session_encrypted is not None,
        created_at=task.created_at,
        updated_at=task.updated_at,
    )


async def _get_user_task(
    task_id: uuid.UUID, user: User, db: AsyncSession
) -> AgentTask:
    stmt = select(AgentTask).where(
        AgentTask.id == task_id, AgentTask.user_id == user.id
    )
    result = await db.execute(stmt)
    task = result.scalar_one_or_none()
    if task is None:
        raise HTTPException(status_code=404, detail="Agent task not found")
    return task


# --- CRUD endpoints ---


@router.get("", response_model=AgentTaskListOut)
async def list_agent_tasks(
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    base = select(AgentTask).where(AgentTask.user_id == user.id)
    total_result = await db.execute(select(func.count()).select_from(base.subquery()))
    total = total_result.scalar() or 0

    stmt = base.order_by(AgentTask.updated_at.desc()).limit(limit).offset(offset)
    result = await db.execute(stmt)
    items = [_task_to_out(t) for t in result.scalars().all()]
    return AgentTaskListOut(items=items, total=total)


@router.post("", response_model=AgentTaskOut, status_code=201)
async def create_agent_task(
    body: AgentTaskCreate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if body.permission_level not in VALID_PERMISSION_LEVELS:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid permission level. Must be one of: {VALID_PERMISSION_LEVELS}",
        )
    task = AgentTask(user_id=user.id, **body.model_dump())
    db.add(task)
    await db.commit()
    await db.refresh(task)
    return _task_to_out(task)


@router.get("/{task_id}", response_model=AgentTaskOut)
async def get_agent_task(
    task_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    task = await _get_user_task(task_id, user, db)
    return _task_to_out(task)


@router.put("/{task_id}", response_model=AgentTaskOut)
async def update_agent_task(
    task_id: uuid.UUID,
    body: AgentTaskUpdate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    task = await _get_user_task(task_id, user, db)
    update_data = body.model_dump(exclude_unset=True)

    if "permission_level" in update_data:
        if update_data["permission_level"] not in VALID_PERMISSION_LEVELS:
            raise HTTPException(
                status_code=400,
                detail=f"Invalid permission level. Must be one of: {VALID_PERMISSION_LEVELS}",
            )

    for field, value in update_data.items():
        setattr(task, field, value)

    await db.commit()
    await db.refresh(task)
    return _task_to_out(task)


@router.delete("/{task_id}", status_code=204)
async def delete_agent_task(
    task_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    task = await _get_user_task(task_id, user, db)
    await db.delete(task)
    await db.commit()


@router.post("/{task_id}/enable", response_model=AgentTaskOut)
async def enable_agent_task(
    task_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    task = await _get_user_task(task_id, user, db)
    task.enabled = True
    await db.commit()
    await db.refresh(task)
    return _task_to_out(task)


@router.post("/{task_id}/disable", response_model=AgentTaskOut)
async def disable_agent_task(
    task_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    task = await _get_user_task(task_id, user, db)
    task.enabled = False
    await db.commit()
    await db.refresh(task)
    return _task_to_out(task)


# --- Agent Telegram auth endpoints ---


@router.post("/auth/send-code", response_model=AgentAuthSendCodeResponse)
async def agent_auth_send_code(
    req: AgentAuthSendCodeRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await _get_user_task(req.agent_task_id, user, db)
    try:
        phone_code_hash = await telegram_manager.agent_send_code(req.phone)
        return AgentAuthSendCodeResponse(phone_code_hash=phone_code_hash)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/auth/verify-code", response_model=AgentAuthVerifyCodeResponse)
async def agent_auth_verify_code(
    req: AgentAuthVerifyCodeRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    task = await _get_user_task(req.agent_task_id, user, db)
    try:
        needs_2fa = await telegram_manager.agent_verify_code(
            req.phone, req.code, req.phone_code_hash, task, db
        )
        return AgentAuthVerifyCodeResponse(
            success=not needs_2fa, needs_2fa=needs_2fa
        )
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/auth/verify-2fa", response_model=AgentAuthVerify2FAResponse)
async def agent_auth_verify_2fa(
    req: AgentAuthVerify2FARequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    task = await _get_user_task(req.agent_task_id, user, db)
    try:
        await telegram_manager.agent_verify_2fa(req.phone, req.password, task, db)
        return AgentAuthVerify2FAResponse(success=True)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
