# app/database/supabase.py
from supabase import create_client, Client
from app.config import settings
import structlog

logger = structlog.get_logger(__name__)

_supabase_client: Client = None


def get_supabase_client() -> Client:
    """
    Returns service-role Supabase client (bypasses RLS)
    ONLY used for trusted backend operations
    """
    global _supabase_client
    if _supabase_client is None:
        _supabase_client = create_client(
            settings.SUPABASE_URL,
            settings.SUPABASE_SERVICE_ROLE_KEY,
        )
        logger.info("supabase_client_initialized")
    return _supabase_client


def get_supabase_user_client(user_jwt: str) -> Client:
    """
    Returns user-scoped Supabase client (respects RLS)
    Used for user-initiated queries
    """
    return create_client(
        settings.SUPABASE_URL,
        settings.SUPABASE_ANON_KEY,
        options={"headers": {"Authorization": f"Bearer {user_jwt}"}},
    )