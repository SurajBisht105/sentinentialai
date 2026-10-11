import time
import structlog
from functools import wraps
from typing import Optional, List, Dict, Any
from fastapi import Depends, HTTPException, status, Request
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import jwt, JWTError
import httpx

from app.config import settings
from app.database.supabase import get_supabase_client
from app.schemas.user import AppRole

logger = structlog.get_logger(__name__)
security = HTTPBearer()

# In-memory caches to prevent slow repetitive network calls to Supabase
_jwks_cache: Dict[str, Any] = {"keys": [], "expires_at": 0.0}
_profile_cache: Dict[str, Dict[str, Any]] = {}
_tenant_cache: Dict[str, Dict[str, Any]] = {}

CACHE_TTL_SECONDS = 3600  # 1 hour for JWKS
PROFILE_TTL_SECONDS = 300  # 5 minutes for profile & tenant


async def _get_cached_jwks(force_refresh: bool = False) -> dict:
    """
    Fetch JWKS from Supabase with in-memory caching.
    """
    global _jwks_cache
    now = time.time()

    if not force_refresh and _jwks_cache["keys"] and now < _jwks_cache["expires_at"]:
        return _jwks_cache

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            jwks_response = await client.get(
                f"{settings.SUPABASE_URL}/auth/v1/.well-known/jwks.json"
            )
            jwks_response.raise_for_status()
            jwks = jwks_response.json()
            _jwks_cache = {
                "keys": jwks.get("keys", []),
                "expires_at": now + CACHE_TTL_SECONDS,
            }
            return _jwks_cache
    except Exception as e:
        logger.warning("jwks_fetch_failed", error=str(e))
        # If cache has existing keys, keep using them even if expired
        if _jwks_cache["keys"]:
            return _jwks_cache
        raise


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
) -> dict:
    """
    Validate Supabase JWT and return user claims
    """
    token = credentials.credentials

    try:
        jwks = await _get_cached_jwks(force_refresh=False)

        # Extract kid header from token to pick matching JWK
        unverified_header = jwt.get_unverified_header(token)
        kid = unverified_header.get("kid")

        target_key = None
        for key in jwks.get("keys", []):
            if key.get("kid") == kid:
                target_key = key
                break

        # If key not found, try refreshing JWKS once in case keys were rotated
        if not target_key:
            jwks = await _get_cached_jwks(force_refresh=True)
            for key in jwks.get("keys", []):
                if key.get("kid") == kid:
                    target_key = key
                    break

        if not target_key and jwks.get("keys"):
            target_key = jwks["keys"][0]

        if not target_key:
            raise JWTError("No valid JWK found in JWKS")

        # Decode and verify JWT
        payload = jwt.decode(
            token,
            target_key,
            algorithms=[settings.ALGORITHM, "ES256", "RS256", "HS256"],
            options={"verify_signature": True, "verify_aud": False},
        )

        return payload

    except JWTError as e:
        logger.warning("jwt_validation_failed", error=str(e))
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={"code": "INVALID_TOKEN", "message": f"Invalid or expired token: {str(e)}"},
            headers={"WWW-Authenticate": "Bearer"},
        )
    except Exception as e:
        logger.error("jwt_processing_error", error=str(e))
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={"code": "TOKEN_ERROR", "message": str(e)},
            headers={"WWW-Authenticate": "Bearer"},
        )


async def get_current_user_with_supabase(
    credentials: HTTPAuthorizationCredentials = Depends(security),
) -> dict:
    """
    Validate token and fetch full user profile from Supabase with in-memory caching and fallback
    """
    payload = await get_current_user(credentials)
    user_id = payload.get("sub")
    now = time.time()

    # Check cache first
    cached_profile = _profile_cache.get(user_id)
    if cached_profile and now < cached_profile["expires_at"]:
        profile = cached_profile["data"].copy()
        profile["jwt_payload"] = payload
        return profile

    # Attempt to fetch user profile from Supabase DB
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            response = await client.get(
                f"{settings.SUPABASE_URL}/rest/v1/profiles?id=eq.{user_id}",
                headers={
                    "Authorization": f"Bearer {settings.SUPABASE_SERVICE_ROLE_KEY}",
                    "apikey": settings.SUPABASE_SERVICE_ROLE_KEY,
                },
            )
            if response.status_code == 200:
                profiles = response.json()
                if profiles:
                    user_profile = profiles[0]
                    user_profile.setdefault("email", payload.get("email", "user@example.com"))
                    user_profile["jwt_payload"] = payload
                    _profile_cache[user_id] = {
                        "data": user_profile,
                        "expires_at": now + PROFILE_TTL_SECONDS,
                    }
                    return user_profile
    except Exception as e:
        logger.warning("profile_fetch_fallback", error=str(e))

    # Fallback profile constructed from verified JWT payload
    app_role = (
        payload.get("app_metadata", {}).get("app_role")
        or payload.get("role")
        or "authenticated"
    )
    tenant_id = payload.get("user_metadata", {}).get("tenant_id")

    fallback_profile = {
        "id": user_id,
        "email": payload.get("email", "user@example.com"),
        "role": app_role,
        "tenant_id": tenant_id,
        "jwt_payload": payload,
    }

    _profile_cache[user_id] = {
        "data": fallback_profile,
        "expires_at": now + PROFILE_TTL_SECONDS,
    }
    return fallback_profile


class RoleChecker:
    """
    Dependency to check if user has required role
    """

    def __init__(self, allowed_roles: List[AppRole]):
        self.allowed_roles = allowed_roles

    async def __call__(
        self, current_user: dict = Depends(get_current_user_with_supabase)
    ) -> dict:
        user_role = (
            current_user.get("role")
            or current_user.get("jwt_payload", {})
            .get("app_metadata", {})
            .get("app_role")
            or "Superadmin"
        )

        # Supabase default JWT role is "authenticated" — treat as Superadmin in dev
        if user_role == "authenticated":
            user_role = "Superadmin"

        if user_role not in self.allowed_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail={
                    "code": "INSUFFICIENT_PERMISSIONS",
                    "message": f"Required role: {', '.join(self.allowed_roles)}. Your role: {user_role}",
                },
            )

        return current_user


# Pre-defined role checkers
require_viewer = RoleChecker(["Viewer", "Engineer", "CISO", "Superadmin"])
require_engineer = RoleChecker(["Engineer", "CISO", "Superadmin"])
require_ciso = RoleChecker(["CISO", "Superadmin"])
require_superadmin = RoleChecker(["Superadmin"])


async def get_tenant_id(
    current_user: dict = Depends(get_current_user_with_supabase),
) -> str:
    """
    Resolve the authenticated user's tenant from their profile or create a default tenant.
    Cached in-memory to prevent repeated DB roundtrips.
    """
    tenant_id = current_user.get("tenant_id")
    if tenant_id:
        return str(tenant_id)

    user_id = current_user.get("id") or current_user.get("jwt_payload", {}).get("sub")
    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={"code": "MISSING_USER", "message": "Authenticated user not found"},
        )

    now = time.time()
    cached_tenant = _tenant_cache.get(user_id)
    if cached_tenant and now < cached_tenant["expires_at"]:
        return cached_tenant["tenant_id"]

    try:
        supabase = get_supabase_client()
        try:
            profile_response = (
                supabase.table("profiles")
                .select("tenant_id")
                .eq("id", user_id)
                .limit(1)
                .execute()
            )
            if profile_response.data:
                tenant_id = profile_response.data[0].get("tenant_id")
                if tenant_id:
                    _tenant_cache[user_id] = {
                        "tenant_id": str(tenant_id),
                        "expires_at": now + PROFILE_TTL_SECONDS,
                    }
                    return str(tenant_id)
        except Exception as profile_error:
            logger.warning("profile_lookup_unavailable", error=str(profile_error))

        # Older environments may have projects but not the tenant/profile migrations.
        try:
            project_response = (
                supabase.table("projects")
                .select("tenant_id")
                .limit(1)
                .execute()
            )
            if project_response.data:
                tenant_id = project_response.data[0].get("tenant_id")
                if tenant_id:
                    _tenant_cache[user_id] = {
                        "tenant_id": str(tenant_id),
                        "expires_at": now + PROFILE_TTL_SECONDS,
                    }
                    return str(tenant_id)
        except Exception as project_error:
            logger.warning("project_tenant_lookup_unavailable", error=str(project_error))

        tenant_response = (
            supabase.table("tenants")
            .select("id")
            .eq("slug", "default")
            .limit(1)
            .execute()
        )

        if tenant_response.data:
            tenant_id = tenant_response.data[0]["id"]
        else:
            tenant_result = (
                supabase.table("tenants")
                .insert({
                    "name": "Default Organization",
                    "slug": "default",
                    "plan": "Free",
                })
                .execute()
            )
            if not tenant_result.data:
                raise ValueError("Failed to create default tenant")
            tenant_id = tenant_result.data[0]["id"]

        try:
            supabase.table("profiles").insert({
                "id": user_id,
                "tenant_id": tenant_id,
                "display_name": current_user.get("email", "User"),
                "role": current_user.get("role") or "Viewer",
            }).execute()
        except Exception as profile_error:
            logger.warning("profile_sync_unavailable", error=str(profile_error))

        resolved_tenant_id = str(tenant_id)
        _tenant_cache[user_id] = {
            "tenant_id": resolved_tenant_id,
            "expires_at": now + PROFILE_TTL_SECONDS,
        }
        return resolved_tenant_id
    except Exception as e:
        logger.warning(
            "tenant_resolution_fallback",
            error=str(e),
            user_id=user_id,
        )
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail={
                "code": "TENANT_UNAVAILABLE",
                "message": "Unable to resolve an organization for the authenticated user",
            },
        )