# app/api/v1/settings.py
from fastapi import APIRouter, Depends, HTTPException, Query, Path, BackgroundTasks
from typing import List, Optional
from pydantic import BaseModel
from datetime import datetime
import structlog
import uuid

from app.dependencies import get_current_user_with_supabase, get_tenant_id, require_superadmin
from app.database.supabase import get_supabase_client

router = APIRouter()
logger = structlog.get_logger(__name__)


class SettingsBase(BaseModel):
    key: str
    value: str
    description: Optional[str] = None
    is_public: bool = False  # Whether non-admin users can view this setting


class SettingsResponse(SettingsBase):
    id: str
    tenant_id: str
    created_at: datetime
    updated_at: datetime
    updated_by: str  # user_id


class SettingsUpdate(BaseModel):
    value: str
    description: Optional[str] = None
    is_public: Optional[bool] = None


class SettingsCreate(SettingsBase):
    pass


# Settings categories
SETTINGS_CATEGORIES = [
    "general",
    "security",
    "notification",
    "integration",
    "retention",
    "limits"
]


@router.get("/", response_model=List[SettingsResponse])
async def get_settings(
    category: Optional[str] = Query(None),
    include_private: bool = Query(False),
    current_user: dict = Depends(get_current_user_with_supabase),
    tenant_id: str = Depends(get_tenant_id)
):
    """
    Get settings for the tenant.
    Regular users can only see public settings unless they're superadmins.
    """
    try:
        supabase = get_supabase_client()
        query = supabase.table("settings").select("*").eq("tenant_id", tenant_id)

        if category:
            query = query.eq("category", category)
        if not include_private:
            # Get user role to determine if they can see private settings
            user_res = supabase.table("profiles").select("role").eq("id", current_user.get("id")).execute()
            user_role = user_res.data[0].get("role", "user") if user_res.data else "user"
            if user_role != "Superadmin":
                query = query.eq("is_public", True)

        res = query.execute()

        if res.data:
            return [
                SettingsResponse(
                    id=s["id"],
                    tenant_id=s["tenant_id"],
                    key=s["key"],
                    value=s["value"],
                    description=s.get("description"),
                    is_public=s.get("is_public", False),
                    created_at=s["created_at"],
                    updated_at=s["updated_at"],
                    updated_by=s.get("updated_by", "unknown")
                )
                for s in res.data
            ]
        return []
    except Exception as e:
        logger.error("get_settings_error", error=str(e))
        raise HTTPException(status_code=500, detail="Failed to fetch settings")


@router.get("/{setting_id}", response_model=SettingsResponse)
async def get_setting(
    setting_id: str = Path(...),
    current_user: dict = Depends(get_current_user_with_supabase),
    tenant_id: str = Depends(get_tenant_id)
):
    """
    Get a specific setting by ID.
    """
    try:
        supabase = get_supabase_client()
        res = supabase.table("settings").select("*").eq("id", setting_id).eq("tenant_id", tenant_id).execute()

        if res.data:
            s = res.data[0]
            # Check if user can view this setting (if it's private)
            if not s.get("is_public", False):
                user_res = supabase.table("profiles").select("role").eq("id", current_user.get("id")).execute()
                user_role = user_res.data[0].get("role", "user") if user_res.data else "user"
                if user_role != "Superadmin":
                    raise HTTPException(status_code=403, detail="Insufficient permissions")

            return SettingsResponse(
                id=s["id"],
                tenant_id=s["tenant_id"],
                key=s["key"],
                value=s["value"],
                description=s.get("description"),
                is_public=s.get("is_public", False),
                created_at=s["created_at"],
                updated_at=s["updated_at"],
                updated_by=s.get("updated_by", "unknown")
            )
        raise HTTPException(status_code=404, detail="Setting not found")
    except HTTPException:
        raise
    except Exception as e:
        logger.error("get_setting_error", error=str(e))
        raise HTTPException(status_code=500, detail="Failed to fetch setting")


@router.post("/", response_model=SettingsResponse)
async def create_setting(
    setting: SettingsCreate,
    current_user: dict = Depends(require_superadmin),
    tenant_id: str = Depends(get_tenant_id)
):
    """
    Create a new setting.
    Requires superadmin privileges.
    """
    try:
        supabase = get_supabase_client()

        # Check if setting key already exists for this tenant
        existing = supabase.table("settings").select("id").eq("tenant_id", tenant_id).eq("key", setting.key).execute()
        if existing.data:
            raise HTTPException(status_code=400, detail=f"Setting with key '{setting.key}' already exists")

        now = datetime.utcnow().isoformat()
        insert_data = {
            "tenant_id": tenant_id,
            "created_by": current_user.get("id"),
            "updated_by": current_user.get("id"),
            "key": setting.key,
            "value": setting.value,
            "description": setting.description,
            "is_public": setting.is_public,
            "category": getattr(setting, 'category', 'general'),  # Default to general if not provided
            "created_at": now,
            "updated_at": now
        }

        res = supabase.table("settings").insert(insert_data).execute()

        if res.data:
            s = res.data[0]
            return SettingsResponse(
                id=s["id"],
                tenant_id=s["tenant_id"],
                key=s["key"],
                value=s["value"],
                description=s.get("description"),
                is_public=s.get("is_public", False),
                created_at=s["created_at"],
                updated_at=s["updated_at"],
                updated_by=s.get("updated_by", "unknown")
            )
        raise HTTPException(status_code=500, detail="Failed to create setting")
    except HTTPException:
        raise
    except Exception as e:
        logger.error("create_setting_error", error=str(e))
        raise HTTPException(status_code=500, detail="Failed to create setting")


@router.put("/{setting_id}", response_model=SettingsResponse)
async def update_setting(
    setting_id: str,
    setting_update: SettingsUpdate,
    current_user: dict = Depends(require_superadmin),
    tenant_id: str = Depends(get_tenant_id)
):
    """
    Update a setting.
    Requires superadmin privileges.
    """
    try:
        supabase = get_supabase_client()

        # Get existing setting
        existing_res = supabase.table("settings").select("*").eq("id", setting_id).eq("tenant_id", tenant_id).execute()
        if not existing_res.data:
            raise HTTPException(status_code=404, detail="Setting not found")

        # Prepare update data
        update_data = {
            "value": setting_update.value,
            "updated_at": datetime.utcnow().isoformat(),
            "updated_by": current_user.get("id", "unknown")
        }
        if setting_update.description is not None:
            update_data["description"] = setting_update.description
        if setting_update.is_public is not None:
            update_data["is_public"] = setting_update.is_public

        # Update setting
        res = supabase.table("settings").update(update_data).eq("id", setting_id).eq("tenant_id", tenant_id).execute()

        if res.data:
            s = res.data[0]
            return SettingsResponse(
                id=s["id"],
                tenant_id=s["tenant_id"],
                key=s["key"],
                value=s["value"],
                description=s.get("description"),
                is_public=s.get("is_public", False),
                created_at=s["created_at"],
                updated_at=s["updated_at"],
                updated_by=s.get("updated_by", "unknown")
            )
        raise HTTPException(status_code=500, detail="Failed to update setting")
    except HTTPException:
        raise
    except Exception as e:
        logger.error("update_setting_error", error=str(e))
        raise HTTPException(status_code=500, detail="Failed to update setting")


@router.delete("/{setting_id}")
async def delete_setting(
    setting_id: str = Path(...),
    current_user: dict = Depends(require_superadmin),
    tenant_id: str = Depends(get_tenant_id)
):
    """
    Delete a setting.
    Requires superadmin privileges.
    """
    try:
        supabase = get_supabase_client()

        # Check if setting exists
        existing_res = supabase.table("settings").select("id").eq("id", setting_id).eq("tenant_id", tenant_id).execute()
        if not existing_res.data:
            raise HTTPException(status_code=404, detail="Setting not found")

        # Delete setting
        supabase.table("settings").delete().eq("id", setting_id).eq("tenant_id", tenant_id).execute()

        return {"message": "Setting deleted successfully"}
    except HTTPException:
        raise
    except Exception as e:
        logger.error("delete_setting_error", error=str(e))
        raise HTTPException(status_code=500, detail="Failed to delete setting")


@router.get("/categories")
async def get_settings_categories(
    current_user: dict = Depends(get_current_user_with_supabase),
    tenant_id: str = Depends(get_tenant_id)
):
    """
    Get available settings categories.
    """
    try:
        supabase = get_supabase_client()
        res = supabase.table("settings").select("category").eq("tenant_id", tenant_id).execute()

        categories = list(set([row["category"] for row in res.data])) if res.data else []
        # Return default categories if none found in DB
        return categories if categories else SETTINGS_CATEGORIES
    except Exception as e:
        logger.error("get_settings_categories_error", error=str(e))
        return SETTINGS_CATEGORIES


@router.get("/category/{category}")
async def get_settings_by_category(
    category: str = Path(...),
    include_private: bool = Query(False),
    current_user: dict = Depends(get_current_user_with_supabase),
    tenant_id: str = Depends(get_tenant_id)
):
    """
    Get settings filtered by category.
    """
    try:
        supabase = get_supabase_client()
        query = supabase.table("settings").select("*").eq("tenant_id", tenant_id).eq("category", category)

        if not include_private:
            # Get user role to determine if they can see private settings
            user_res = supabase.table("profiles").select("role").eq("id", current_user.get("id")).execute()
            user_role = user_res.data[0].get("role", "user") if user_res.data else "user"
            if user_role != "Superadmin":
                query = query.eq("is_public", True)

        res = query.execute()

        if res.data:
            return [
                SettingsResponse(
                    id=s["id"],
                    tenant_id=s["tenant_id"],
                    key=s["key"],
                    value=s["value"],
                    description=s.get("description"),
                    is_public=s.get("is_public", False),
                    created_at=s["created_at"],
                    updated_at=s["updated_at"],
                    updated_by=s.get("updated_by", "unknown")
                )
                for s in res.data
            ]
        return []
    except Exception as e:
        logger.error("get_settings_by_category_error", error=str(e))
        raise HTTPException(status_code=500, detail="Failed to fetch settings by category")


@router.post("/reset/{setting_id}")
async def reset_setting_to_default(
    setting_id: str = Path(...),
    current_user: dict = Depends(require_superadmin),
    tenant_id: str = Depends(get_tenant_id)
):
    """
    Reset a setting to its default value.
    Requires superadmin privileges.
    """
    try:
        supabase = get_supabase_client()

        # Get existing setting
        existing_res = supabase.table("settings").select("*").eq("id", setting_id).eq("tenant_id", tenant_id).execute()
        if not existing_res.data:
            raise HTTPException(status_code=404, detail="Setting not found")

        # Define default values for common settings
        defaults = {
            "scan_timeout": "300",
            "max_findings_per_scan": "1000",
            "enable_auto_remediation": "false",
            "notification_email_enabled": "true",
            "webhook_retry_attempts": "3",
            "data_retention_days": "365",
            "api_rate_limit_per_minute": "60",
            "log_level": "INFO"
        }

        setting = existing_res.data[0]
        default_value = defaults.get(setting["key"], setting["value"])  # Use existing value if no default defined

        # Update setting
        supabase.table("settings").update({
            "value": default_value,
            "updated_at": datetime.utcnow().isoformat(),
            "updated_by": current_user.get("id", "unknown")
        }).eq("id", setting_id).eq("tenant_id", tenant_id).execute()

        return {"message": f"Setting '{setting['key']}' reset to default value: {default_value}"}
    except HTTPException:
        raise
    except Exception as e:
        logger.error("reset_setting_error", error=str(e))
        raise HTTPException(status_code=500, detail="Failed to reset setting")


@router.get("/public")
async def get_public_settings(
    current_user: dict = Depends(get_current_user_with_supabase),
    tenant_id: str = Depends(get_tenant_id)
):
    """
    Get public settings visible to all users.
    """
    try:
        supabase = get_supabase_client()
        res = supabase.table("settings").select("*").eq("tenant_id", tenant_id).eq("is_public", True).execute()

        if res.data:
            return [
                SettingsResponse(
                    id=s["id"],
                    tenant_id=s["tenant_id"],
                    key=s["key"],
                    value=s["value"],
                    description=s.get("description"),
                    is_public=s.get("is_public", False),
                    created_at=s["created_at"],
                    updated_at=s["updated_at"],
                    updated_by=s.get("updated_by", "unknown")
                )
                for s in res.data
            ]
        return []
    except Exception as e:
        logger.error("get_public_settings_error", error=str(e))
        raise HTTPException(status_code=500, detail="Failed to fetch public settings")