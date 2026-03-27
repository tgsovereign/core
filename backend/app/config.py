from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    telegram_api_id: int
    telegram_api_hash: str
    openai_api_key: str = ""
    jwt_secret: str
    jwt_algorithm: str = "HS256"
    jwt_expire_minutes: int = 60 * 24  # 24 hours
    session_encryption_key: str  # Fernet key for encrypting Telethon sessions
    database_url: str = "postgresql+asyncpg://sovereign:sovereign@localhost:5432/sovereign"
    rabbitmq_url: str = "amqp://guest:guest@localhost:5672/"

    model_config = {"env_file": ".env", "env_file_encoding": "utf-8"}


settings = Settings()
