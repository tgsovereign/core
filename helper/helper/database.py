from sqlalchemy.ext.asyncio import AsyncSession

from sovereign_schema.database import create_db_engine, create_session_factory

from helper.config import settings

engine = create_db_engine(settings.database_url, echo=False)
async_session = create_session_factory(engine)
