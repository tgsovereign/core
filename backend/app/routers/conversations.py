import uuid

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.models.conversation import Conversation
from app.models.user import User
from app.schemas.conversation import (
    ConversationConfigResponse,
    ConversationConfigUpdate,
    ConversationCreate,
    ConversationDetailOut,
    ConversationOut,
)
from app.services.auth import get_current_user

router = APIRouter(prefix="/api/conversations", tags=["conversations"])

VALID_LEVELS = {"read_only", "read_write", "full_autonomy"}


@router.get("", response_model=list[ConversationOut])
async def list_conversations(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    stmt = (
        select(Conversation)
        .where(Conversation.user_id == user.id)
        .order_by(Conversation.updated_at.desc())
    )
    result = await db.execute(stmt)
    return result.scalars().all()


@router.post("", response_model=ConversationOut, status_code=201)
async def create_conversation(
    body: ConversationCreate | None = None,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    permission_level = (body.permission_level if body else "read_only")
    if permission_level not in VALID_LEVELS:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid permission level. Must be one of: {VALID_LEVELS}",
        )
    conv = Conversation(user_id=user.id, permission_level=permission_level)
    db.add(conv)
    await db.commit()
    await db.refresh(conv)
    return conv


@router.get("/config", response_model=ConversationConfigResponse)
async def get_conversation_config(
    conversation_id: uuid.UUID = Query(...),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    stmt = select(Conversation).where(
        Conversation.id == conversation_id, Conversation.user_id == user.id
    )
    result = await db.execute(stmt)
    conv = result.scalar_one_or_none()
    if conv is None:
        raise HTTPException(status_code=404, detail="Conversation not found")
    return ConversationConfigResponse(permission_level=conv.permission_level)


@router.put("/config", response_model=ConversationConfigResponse)
async def update_conversation_config(
    req: ConversationConfigUpdate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if req.permission_level not in VALID_LEVELS:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid permission level. Must be one of: {VALID_LEVELS}",
        )

    stmt = select(Conversation).where(
        Conversation.id == req.conversation_id, Conversation.user_id == user.id
    )
    result = await db.execute(stmt)
    conv = result.scalar_one_or_none()
    if conv is None:
        raise HTTPException(status_code=404, detail="Conversation not found")

    conv.permission_level = req.permission_level
    await db.commit()
    return ConversationConfigResponse(permission_level=conv.permission_level)


@router.get("/{conversation_id}", response_model=ConversationDetailOut)
async def get_conversation(
    conversation_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    stmt = (
        select(Conversation)
        .where(Conversation.id == conversation_id, Conversation.user_id == user.id)
        .options(selectinload(Conversation.messages))
    )
    result = await db.execute(stmt)
    conv = result.scalar_one_or_none()
    if conv is None:
        raise HTTPException(status_code=404, detail="Conversation not found")
    return conv


@router.delete("/{conversation_id}", status_code=204)
async def delete_conversation(
    conversation_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    stmt = select(Conversation).where(
        Conversation.id == conversation_id, Conversation.user_id == user.id
    )
    result = await db.execute(stmt)
    conv = result.scalar_one_or_none()
    if conv is None:
        raise HTTPException(status_code=404, detail="Conversation not found")
    await db.delete(conv)
    await db.commit()
