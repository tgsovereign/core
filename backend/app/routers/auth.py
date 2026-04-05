import uuid

from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import JSONResponse, Response
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
from app.services.auth import (
    clear_auth_cookies,
    decode_token,
    get_current_user,
    set_auth_cookies,
)
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
async def me_photo(request: Request, db: AsyncSession = Depends(get_db)):
    """Profile photo endpoint. Auth via cookie."""
    token = request.cookies.get("token")
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")

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


@router.post("/verify-code")
async def verify_code(req: VerifyCodeRequest, db: AsyncSession = Depends(get_db)):
    try:
        token, needs_2fa, has_openai_key = await telegram_manager.verify_code(
            req.phone, req.code, req.phone_code_hash, db
        )
        if needs_2fa:
            return JSONResponse(content=VerifyCodeResponse(next="2fa").model_dump())
        response = JSONResponse(
            content=VerifyCodeResponse(has_openai_key=has_openai_key).model_dump()
        )
        set_auth_cookies(response, token)
        return response
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/verify-2fa")
async def verify_2fa(req: Verify2FARequest, db: AsyncSession = Depends(get_db)):
    try:
        token, has_openai_key = await telegram_manager.verify_2fa(req.phone, req.password, db)
        response = JSONResponse(
            content=Verify2FAResponse(has_openai_key=has_openai_key).model_dump()
        )
        set_auth_cookies(response, token)
        return response
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/logout")
async def logout():
    response = JSONResponse(content={"ok": True})
    clear_auth_cookies(response)
    return response


@router.post("/api-key", response_model=SaveApiKeyResponse)
async def save_api_key(
    req: SaveApiKeyRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    user.openai_api_key_encrypted = encrypt_session(req.api_key)
    await db.commit()
    return SaveApiKeyResponse()
