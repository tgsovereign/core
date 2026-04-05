import uuid
from datetime import datetime, timedelta, timezone

from fastapi import Depends, HTTPException, Request, Response, status
from jose import JWTError, jwt
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.database import get_db
from sovereign_schema.models.user import User

COOKIE_MAX_AGE = 60 * 60 * 24 * 30  # 30 days


def create_token(user_id: str) -> str:
    expire = datetime.now(timezone.utc) + timedelta(minutes=settings.jwt_expire_minutes)
    payload = {"sub": user_id, "exp": expire}
    return jwt.encode(payload, settings.jwt_secret, algorithm=settings.jwt_algorithm)


def decode_token(token: str) -> str:
    try:
        payload = jwt.decode(token, settings.jwt_secret, algorithms=[settings.jwt_algorithm])
        user_id: str = payload.get("sub")
        if user_id is None:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")
        return user_id
    except JWTError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")


def set_auth_cookies(response: Response, token: str) -> None:
    domain = settings.cookie_domain or None
    response.set_cookie(
        "token", token, httponly=True, secure=True, samesite="lax",
        max_age=COOKIE_MAX_AGE, path="/", domain=domain,
    )
    response.set_cookie(
        "logged_in", "1", httponly=False, secure=True, samesite="lax",
        max_age=COOKIE_MAX_AGE, path="/", domain=domain,
    )


def clear_auth_cookies(response: Response) -> None:
    domain = settings.cookie_domain or None
    response.delete_cookie("token", path="/", domain=domain)
    response.delete_cookie("logged_in", path="/", domain=domain)


async def get_current_user(
    request: Request,
    db: AsyncSession = Depends(get_db),
) -> User:
    token = request.cookies.get("token")
    if not token:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated")
    user_id = decode_token(token)
    stmt = select(User).where(User.id == uuid.UUID(user_id))
    result = await db.execute(stmt)
    user = result.scalar_one_or_none()
    if user is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found")
    return user
