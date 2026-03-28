from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import DeclarativeBase


class Base(DeclarativeBase):
    pass


def create_db_engine(database_url: str, **kwargs):
    """Create an async SQLAlchemy engine. Consumers pass their own URL."""
    return create_async_engine(database_url, **kwargs)


def create_session_factory(engine):
    """Create an async session factory bound to the given engine."""
    return async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
