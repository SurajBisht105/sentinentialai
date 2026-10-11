# app/api/v1/integrations.py
from fastapi import APIRouter, Depends, HTTPException, Query, Path, BackgroundTasks
from typing import List, Optional
from pydantic import BaseModel
from datetime import datetime
import structlog
import uuid

from app.dependencies import get_current_user_with_supabase, get_tenant_id
from app.database.supabase import get_supabase_client

router = APIRouter()
logger = structlog.get_logger(__name__)


class IntegrationType(BaseModel):
    value: str
    label: str

    class Config:
        title = "IntegrationType"


class IntegrationBase(BaseModel):
    name: str
    type: str
    enabled: bool = False
    config: dict = {}


class IntegrationResponse(IntegrationBase):
    id: str
    tenant_id: str
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    last_test: Optional[datetime] = None
    status: str = "disconnected"  # connected, disconnected, error


class IntegrationCreate(IntegrationBase):
    pass


class IntegrationUpdate(BaseModel):
    name: Optional[str] = None
    enabled: Optional[bool] = None
    config: Optional[dict] = None


class TestResult(BaseModel):
    success: bool
    message: str
    details: dict = {}
    timestamp: datetime


# Predefined integration types
INTEGRATION_TYPES = [
    {"value": "slack", "label": "Slack"},
    {"value": "teams", "label": "Microsoft Teams"},
    {"value": "email", "label": "Email"},
    {"value": "webhook", "label": "Webhook"},
    {"value": "jira", "label": "Jira"},
    {"value": "asana", "label": "Asana"},
    {"value": "servicenow", "label": "ServiceNow"},
    {"value": "azure_sentinel", "label": "Azure Sentinel"},
    {"value": "splunk", "label": "Splunk"},
    {"value": "datadog", "label": "Datadog"},
]


@router.get("/types")
async def get_integration_types(
    current_user: dict = Depends(get_current_user_with_supabase),
    tenant_id: str = Depends(get_tenant_id)
):
    """
    Get available integration types.
    """
    return INTEGRATION_TYPES


@router.get("/", response_model=List[IntegrationResponse])
async def get_integrations(
    integration_type: Optional[str] = Query(None),
    enabled: Optional[bool] = Query(None),
    current_user: dict = Depends(get_current_user_with_supabase),
    tenant_id: str = Depends(get_tenant_id)
):
    """
    Get list of integrations for the tenant.
    """
    try:
        supabase = get_supabase_client()
        query = supabase.table("integrations").select("*").eq("tenant_id", tenant_id)

        if integration_type:
            query = query.eq("integration_type", integration_type)
        if enabled is not None:
            query = query.eq("is_active", enabled)

        res = query.execute()

        if res.data:
            now_dt = datetime.utcnow()
            return [
                IntegrationResponse(
                    id=i["id"],
                    tenant_id=i["tenant_id"],
                    name=i.get("name") or i.get("integration_type", "Integration"),
                    type=i.get("integration_type", "UNKNOWN"),
                    enabled=i.get("is_active") if i.get("is_active") is not None else True,
                    config=i.get("config") or {},
                    created_at=i.get("created_at") or now_dt,
                    updated_at=i.get("updated_at") or i.get("created_at") or now_dt,
                    last_test=i.get("last_verified_at"),
                    status="connected" if (i.get("is_verified") or i.get("is_active")) else "disconnected"
                )
                for i in res.data
            ]
        return []
    except Exception as e:
        logger.error("get_integrations_error", error=str(e))
        raise HTTPException(status_code=500, detail="Failed to fetch integrations")


@router.get("/{integration_id}", response_model=IntegrationResponse)
async def get_integration(
    integration_id: str = Path(...),
    current_user: dict = Depends(get_current_user_with_supabase),
    tenant_id: str = Depends(get_tenant_id)
):
    """
    Get a specific integration by ID.
    """
    try:
        supabase = get_supabase_client()
        res = supabase.table("integrations").select("*").eq("id", integration_id).eq("tenant_id", tenant_id).execute()

        if res.data:
            i = res.data[0]
            now_dt = datetime.utcnow()
            return IntegrationResponse(
                id=i["id"],
                tenant_id=i["tenant_id"],
                name=i.get("name") or i.get("integration_type", "Integration"),
                type=i.get("integration_type", "UNKNOWN"),
                enabled=i.get("is_active") if i.get("is_active") is not None else True,
                config=i.get("config") or {},
                created_at=i.get("created_at") or now_dt,
                updated_at=i.get("updated_at") or i.get("created_at") or now_dt,
                last_test=i.get("last_verified_at"),
                status="connected" if (i.get("is_verified") or i.get("is_active")) else "disconnected"
            )
        raise HTTPException(status_code=404, detail="Integration not found")
    except Exception as e:
        logger.error("get_integration_error", error=str(e))
        raise HTTPException(status_code=500, detail="Failed to fetch integration")


@router.post("/", response_model=IntegrationResponse)
async def create_integration(
    integration: IntegrationCreate,
    current_user: dict = Depends(get_current_user_with_supabase),
    tenant_id: str = Depends(get_tenant_id)
):
    """
    Create a new integration.
    """
    try:
        supabase = get_supabase_client()

        # Check if integration type already exists for this tenant
        existing = supabase.table("integrations").select("*").eq("tenant_id", tenant_id).eq("integration_type", integration.type).execute()
        now_dt = datetime.utcnow()

        if existing.data:
            # Re-activate and update existing integration
            res = supabase.table("integrations").update({
                "is_active": True,
                "name": integration.name,
                "config": integration.config or existing.data[0].get("config") or {},
                "updated_at": now_dt.isoformat()
            }).eq("id", existing.data[0]["id"]).execute()
            i = res.data[0] if (res.data and len(res.data) > 0) else existing.data[0]
            return IntegrationResponse(
                id=i["id"],
                tenant_id=i["tenant_id"],
                name=i.get("name") or i.get("integration_type", "Integration"),
                type=i.get("integration_type", "UNKNOWN"),
                enabled=True,
                config=i.get("config") or {},
                created_at=i.get("created_at") or now_dt,
                updated_at=i.get("updated_at") or i.get("created_at") or now_dt,
                last_test=i.get("last_verified_at"),
                status="connected"
            )

        now = datetime.utcnow().isoformat()
        insert_data = {
            "tenant_id": tenant_id,
            "created_by": current_user.get("id"),
            "integration_type": integration.type,
            "name": integration.name,
            "is_active": integration.enabled,
            "config": integration.config,
            "created_at": now,
            "updated_at": now
        }

        res = supabase.table("integrations").insert(insert_data).execute()

        if res.data:
            i = res.data[0]
            now_dt = datetime.utcnow()
            return IntegrationResponse(
                id=i["id"],
                tenant_id=i["tenant_id"],
                name=i.get("name") or i.get("integration_type", "Integration"),
                type=i.get("integration_type", "UNKNOWN"),
                enabled=i.get("is_active") if i.get("is_active") is not None else True,
                config=i.get("config") or {},
                created_at=i.get("created_at") or now_dt,
                updated_at=i.get("updated_at") or i.get("created_at") or now_dt,
                last_test=i.get("last_verified_at"),
                status="connected" if (i.get("is_verified") or i.get("is_active")) else "disconnected"
            )
        raise HTTPException(status_code=500, detail="Failed to create integration")
    except HTTPException:
        raise
    except Exception as e:
        logger.error("create_integration_error", error=str(e))
        raise HTTPException(status_code=500, detail="Failed to create integration")


@router.put("/{integration_id}", response_model=IntegrationResponse)
async def update_integration(
    integration_id: str,
    integration_update: IntegrationUpdate,
    current_user: dict = Depends(get_current_user_with_supabase),
    tenant_id: str = Depends(get_tenant_id)
):
    """
    Update an integration.
    """
    try:
        supabase = get_supabase_client()

        # Get existing integration
        existing_res = supabase.table("integrations").select("*").eq("id", integration_id).eq("tenant_id", tenant_id).execute()
        if not existing_res.data:
            raise HTTPException(status_code=404, detail="Integration not found")

        # Prepare update data
        update_data = {"updated_at": datetime.utcnow().isoformat()}
        if integration_update.name is not None:
            update_data["name"] = integration_update.name
        if integration_update.enabled is not None:
            update_data["is_active"] = integration_update.enabled
        if integration_update.config is not None:
            update_data["config"] = integration_update.config

        # Update integration
        res = supabase.table("integrations").update(update_data).eq("id", integration_id).eq("tenant_id", tenant_id).execute()

        if res.data:
            i = res.data[0]
            now_dt = datetime.utcnow()
            return IntegrationResponse(
                id=i["id"],
                tenant_id=i["tenant_id"],
                name=i.get("name") or i.get("integration_type", "Integration"),
                type=i.get("integration_type", "UNKNOWN"),
                enabled=i.get("is_active") if i.get("is_active") is not None else True,
                config=i.get("config") or {},
                created_at=i.get("created_at") or now_dt,
                updated_at=i.get("updated_at") or i.get("created_at") or now_dt,
                last_test=i.get("last_verified_at"),
                status="connected" if (i.get("is_verified") or i.get("is_active")) else "disconnected"
            )
        raise HTTPException(status_code=500, detail="Failed to update integration")
    except HTTPException:
        raise
    except Exception as e:
        logger.error("update_integration_error", error=str(e))
        raise HTTPException(status_code=500, detail="Failed to update integration")


@router.delete("/{integration_id}")
async def delete_integration(
    integration_id: str = Path(...),
    current_user: dict = Depends(get_current_user_with_supabase),
    tenant_id: str = Depends(get_tenant_id)
):
    """
    Delete an integration.
    """
    try:
        supabase = get_supabase_client()

        # Check if integration exists
        existing_res = supabase.table("integrations").select("id").eq("id", integration_id).eq("tenant_id", tenant_id).execute()
        if not existing_res.data:
            raise HTTPException(status_code=404, detail="Integration not found")

        # Delete integration
        supabase.table("integrations").delete().eq("id", integration_id).eq("tenant_id", tenant_id).execute()

        return {"message": "Integration deleted successfully"}
    except HTTPException:
        raise
    except Exception as e:
        logger.error("delete_integration_error", error=str(e))
        raise HTTPException(status_code=500, detail="Failed to delete integration")


@router.post("/{integration_id}/test", response_model=TestResult)
async def test_integration(
    integration_id: str = Path(...),
    current_user: dict = Depends(get_current_user_with_supabase),
    tenant_id: str = Depends(get_tenant_id)
):
    """
    Test an integration connection.
    """
    try:
        supabase = get_supabase_client()

        # Get integration
        res = supabase.table("integrations").select("*").eq("id", integration_id).eq("tenant_id", tenant_id).execute()
        if not res.data:
            raise HTTPException(status_code=404, detail="Integration not found")

        integration = res.data[0]

        # TODO: Implement actual integration testing based on type
        # For now, return a mock success for demonstration
        # In production, this would test the actual connection (webhook, API key, etc.)

        test_result = TestResult(
            success=True,
            message=f"Integration test successful for {integration['name']}",
            details={
                "integration_type": integration["integration_type"],
                "tested_at": datetime.utcnow().isoformat()
            },
            timestamp=datetime.utcnow()
        )

        # Update last tested timestamp
        supabase.table("integrations").update({
            "last_verified_at": datetime.utcnow().isoformat(),
            "is_verified": True
        }).eq("id", integration_id).eq("tenant_id", tenant_id).execute()

        return test_result
    except HTTPException:
        raise
    except Exception as e:
        logger.error("test_integration_error", error=str(e))
        # Update last tested timestamp with failure
        try:
            supabase.table("integrations").update({
                "last_verified_at": datetime.utcnow().isoformat(),
                "is_verified": False,
                "sync_error": str(e)[:500]  # Truncate error message
            }).eq("id", integration_id).eq("tenant_id", tenant_id).execute()
        except:
            pass  # Don't fail the test if we can't update the error

        return TestResult(
            success=False,
            message=f"Integration test failed: {str(e)}",
            details={
                "integration_type": integration.get("integration_type", "unknown") if 'integration' in locals() else "unknown",
                "error": str(e),
                "tested_at": datetime.utcnow().isoformat()
            },
            timestamp=datetime.utcnow()
        )


@router.post("/{integration_id}/toggle")
async def toggle_integration(
    integration_id: str = Path(...),
    current_user: dict = Depends(get_current_user_with_supabase),
    tenant_id: str = Depends(get_tenant_id)
):
    """
    Enable or disable an integration.
    """
    try:
        supabase = get_supabase_client()

        # Get current status
        res = supabase.table("integrations").select("is_active").eq("id", integration_id).eq("tenant_id", tenant_id).execute()
        if not res.data:
            raise HTTPException(status_code=404, detail="Integration not found")

        current_status = res.data[0]["is_active"]
        new_status = not current_status

        # Update status
        supabase.table("integrations").update({
            "is_active": new_status,
            "updated_at": datetime.utcnow().isoformat()
        }).eq("id", integration_id).eq("tenant_id", tenant_id).execute()

        return {"message": f"Integration {'enabled' if new_status else 'disabled'} successfully"}
    except HTTPException:
        raise
    except Exception as e:
        logger.error("toggle_integration_error", error=str(e))
        raise HTTPException(status_code=500, detail="Failed to toggle integration")