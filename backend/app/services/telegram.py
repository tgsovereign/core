import hashlib
import logging
import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from telethon import TelegramClient
from telethon.errors import SessionPasswordNeededError
from telethon.sessions import StringSession

from app.config import settings
from app.models.user import User
from app.models.agent_config import AgentConfig
from app.telegram.session_store import encrypt_session, decrypt_session
from app.telegram.event_handler import register_event_handlers

logger = logging.getLogger(__name__)


def phone_to_hash(phone: str) -> str:
    return hashlib.sha256(phone.encode()).hexdigest()


class TelegramClientManager:
    def __init__(self):
        self._clients: dict[uuid.UUID, TelegramClient] = {}
        # Temporary clients used during auth flow (keyed by phone hash)
        self._auth_clients: dict[str, TelegramClient] = {}

    def get_client(self, user_id: uuid.UUID) -> TelegramClient | None:
        return self._clients.get(user_id)

    async def send_code(self, phone: str) -> str:
        ph = phone_to_hash(phone)
        client = TelegramClient(
            StringSession(), settings.telegram_api_id, settings.telegram_api_hash
        )
        await client.connect()
        result = await client.send_code_request(phone)
        self._auth_clients[ph] = client
        return result.phone_code_hash

    async def verify_code(
        self, phone: str, code: str, phone_code_hash: str, db: AsyncSession
    ) -> tuple[str | None, bool]:
        """Returns (jwt_token_or_none, needs_2fa).

        If 2FA is needed, returns (None, True).
        Otherwise returns (token, False).
        """
        ph = phone_to_hash(phone)
        client = self._auth_clients.get(ph)
        if not client:
            raise ValueError("No pending auth session. Call send_code first.")

        try:
            await client.sign_in(phone, code, phone_code_hash=phone_code_hash)
        except SessionPasswordNeededError:
            return None, True

        return await self._finalize_auth(client, phone, db), False

    async def verify_2fa(
        self, phone: str, password: str, db: AsyncSession
    ) -> str:
        ph = phone_to_hash(phone)
        client = self._auth_clients.get(ph)
        if not client:
            raise ValueError("No pending auth session.")

        await client.sign_in(password=password)
        return await self._finalize_auth(client, phone, db)

    async def _finalize_auth(
        self, client: TelegramClient, phone: str, db: AsyncSession
    ) -> str:
        ph = phone_to_hash(phone)
        session_str = client.session.save()
        encrypted = encrypt_session(session_str)

        # Upsert user
        stmt = select(User).where(User.phone_hash == ph)
        result = await db.execute(stmt)
        user = result.scalar_one_or_none()

        if user is None:
            user = User(phone_hash=ph, telegram_session_encrypted=encrypted)
            db.add(user)
            await db.flush()
            # Create default agent config
            db.add(AgentConfig(user_id=user.id, permission_level="read_only"))
        else:
            user.telegram_session_encrypted = encrypted

        await db.commit()
        await db.refresh(user)

        # Move client from auth pool to active pool
        self._auth_clients.pop(ph, None)
        self._clients[user.id] = client

        # Generate JWT
        from app.services.auth import create_token

        return create_token(str(user.id))

    async def restore_client(self, user: User, ws_manager=None) -> TelegramClient | None:
        if user.id in self._clients:
            return self._clients[user.id]

        if not user.telegram_session_encrypted:
            return None

        session_str = decrypt_session(user.telegram_session_encrypted)
        client = TelegramClient(
            StringSession(session_str),
            settings.telegram_api_id,
            settings.telegram_api_hash,
        )
        await client.connect()

        if not await client.is_user_authorized():
            return None

        self._clients[user.id] = client

        if ws_manager:
            register_event_handlers(client, user.id, ws_manager)

        return client

    async def disconnect_all(self):
        for client in self._clients.values():
            try:
                await client.disconnect()
            except Exception:
                pass
        self._clients.clear()

        for client in self._auth_clients.values():
            try:
                await client.disconnect()
            except Exception:
                pass
        self._auth_clients.clear()


# Singleton
telegram_manager = TelegramClientManager()
