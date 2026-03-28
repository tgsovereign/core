import uuid

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import Response
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from sovereign_schema.models.user import User
from app.schemas.auth import (
    MeResponse,
    SaveApiKeyRequest,
    SaveApiKeyResponse,
    SendCodeRequest,
    SendCodeResponse,
    Verify2FARequest,
    Verify2FAResponse,
    VerifyCodeRequest,
    VerifyCodeResponse,
)
from app.services.auth import get_current_user
from app.services.telegram import telegram_manager
from sovereign_schema.crypto import encrypt_session

router = APIRouter(prefix="/api/auth", tags=["auth"])


@router.get("/me", response_model=MeResponse)
async def me(user: User = Depends(get_current_user)):
    client = telegram_manager.get_client(user.id)
    if client is None:
        client = await telegram_manager.restore_client(user)
    if client is None:
        raise HTTPException(status_code=401, detail="Telegram client not connected")
    tg_user = await client.get_me()
    return MeResponse(
        id=tg_user.id,
        username=tg_user.username,
        first_name=tg_user.first_name,
        last_name=tg_user.last_name,
    )


@router.get("/me/photo")
async def me_photo(token: str, db: AsyncSession = Depends(get_db)):
    """Profile photo endpoint. Accepts token as query param since <img> tags can't send headers."""
    from app.services.auth import decode_token

    user_id = decode_token(token)
    stmt = select(User).where(User.id == uuid.UUID(user_id))
    result = await db.execute(stmt)
    user = result.scalar_one_or_none()
    if user is None:
        raise HTTPException(status_code=401, detail="User not found")
    client = telegram_manager.get_client(user.id)
    if client is None:
        client = await telegram_manager.restore_client(user)
    if client is None:
        raise HTTPException(status_code=401, detail="Telegram client not connected")
    photo = await client.download_profile_photo("me", file=bytes)
    if photo is None:
        raise HTTPException(status_code=404, detail="No profile photo")
    return Response(content=photo, media_type="image/jpeg")


@router.post("/send-code", response_model=SendCodeResponse)
async def send_code(req: SendCodeRequest):
    try:
        phone_code_hash = await telegram_manager.send_code(req.phone)
        return SendCodeResponse(phone_code_hash=phone_code_hash)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/verify-code", response_model=VerifyCodeResponse)
async def verify_code(req: VerifyCodeRequest, db: AsyncSession = Depends(get_db)):
    try:
        token, needs_2fa, has_openai_key = await telegram_manager.verify_code(
            req.phone, req.code, req.phone_code_hash, db
        )
        if needs_2fa:
            return VerifyCodeResponse(next="2fa")
        return VerifyCodeResponse(token=token, has_openai_key=has_openai_key)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/verify-2fa", response_model=Verify2FAResponse)
async def verify_2fa(req: Verify2FARequest, db: AsyncSession = Depends(get_db)):
    try:
        token, has_openai_key = await telegram_manager.verify_2fa(req.phone, req.password, db)
        return Verify2FAResponse(token=token, has_openai_key=has_openai_key)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/api-key", response_model=SaveApiKeyResponse)
async def save_api_key(
    req: SaveApiKeyRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    user.openai_api_key_encrypted = encrypt_session(req.api_key)
    await db.commit()
    return SaveApiKeyResponse()
