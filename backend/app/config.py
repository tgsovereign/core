from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    telegram_api_id: int
    telegram_api_hash: str
    jwt_secret: str
    jwt_algorithm: str = "HS256"
    jwt_expire_minutes: int = 60 * 24 * 30  # 30 days
    session_encryption_key: str  # Fernet key for encrypting Telethon sessions
    frontend_url: str = "http://localhost:3000"
    cookie_domain: str = ""  # e.g. ".tgsovereign.com" in production
    database_url: str = "postgresql+asyncpg://sovereign:sovereign@localhost:5432/sovereign"
    rabbitmq_url: str = "amqp://guest:guest@localhost:5672/"

    model_config = {"env_file": ".env", "env_file_encoding": "utf-8"}


settings = Settings()
