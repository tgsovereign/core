from sqlalchemy.ext.asyncio import AsyncSession

from sovereign_schema.database import Base, create_db_engine, create_session_factory

from app.config import settings

engine = create_db_engine(settings.database_url, echo=False)
async_session = create_session_factory(engine)


async def get_db() -> AsyncSession:
    async with async_session() as session:
        yield session
