# app/database/session.py
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.orm import DeclarativeBase
from app.config import settings
import structlog

logger = structlog.get_logger(__name__)


class Base(DeclarativeBase):
    pass


# Build async database URL from Supabase connection string
DATABASE_URL = (
    f"postgresql+asyncpg://"
    f"{settings.SUPABASE_DB_USER}:{settings.SUPABASE_DB_PASSWORD}"
    f"@{settings.SUPABASE_DB_HOST}:{settings.SUPABASE_DB_PORT}"
    f"/postgres"
    f"?prepared_statement_cache_size=0"  # Required for PgBouncer
)

engine = create_async_engine(
    DATABASE_URL,
    pool_size=10,
    max_overflow=20,
    pool_pre_ping=True,
    pool_recycle=3600,
    echo=settings.DEBUG,
)

AsyncSessionLocal = async_sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autoflush=False,
    autocommit=False,
)


async def get_db_session() -> AsyncSession:
    async with AsyncSessionLocal() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()


async def init_db():
    logger.info("database_initializing")
    try:
        async with engine.begin() as conn:
            # Verify connection
            await conn.run_sync(lambda sync_conn: sync_conn.execute(
                __import__('sqlalchemy').text("SELECT 1")
            ))
        logger.info("database_connected")
    except Exception as e:
        logger.warning(
            "database_connection_failed",
            error=str(e),
            message="Starting without DB connection — some features will be unavailable",
        )