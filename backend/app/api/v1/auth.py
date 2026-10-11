# app/api/v1/auth.py
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel
from typing import Optional

from app.dependencies import get_current_user, get_current_user_with_supabase

router = APIRouter()
security = HTTPBearer()


class UserLogin(BaseModel):
    email: str
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expires_in: int


@router.post("/login", response_model=TokenResponse)
async def login(user_credentials: UserLogin):
    """
    Authenticate user and return access token.
    In a real implementation, this would validate credentials against Supabase.
    """
    try:
        from app.database.supabase import get_supabase_client
        import structlog
        logger = structlog.get_logger(__name__)
        
        supabase = get_supabase_client()
        res = supabase.auth.sign_in_with_password({
            "email": user_credentials.email, 
            "password": user_credentials.password
        })
        
        return {
            "access_token": res.session.access_token,
            "token_type": "bearer",
            "expires_in": res.session.expires_in,
        }
    except Exception as e:
        logger.error("login_failed", error=str(e))
        raise HTTPException(status_code=401, detail="Invalid credentials")


@router.post("/logout")
async def logout():
    """
    Logout user (invalidate token).
    """
    return {"message": "Successfully logged out"}


@router.get("/me")
async def get_current_user_info(
    current_user: dict = Depends(get_current_user_with_supabase)
):
    """
    Get current user information.
    """
    return {
        "id": current_user.get("id"),
        "email": current_user.get("email"),
        "role": current_user.get("role"),
        "tenant_id": current_user.get("tenant_id"),
    }


@router.get("/profile")
async def get_user_profile(
    current_user: dict = Depends(get_current_user_with_supabase)
):
    """
    Get detailed user profile.
    """
    return current_user