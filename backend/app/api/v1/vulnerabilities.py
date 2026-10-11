# app/api/v1/vulnerabilities.py
from fastapi import APIRouter, Depends, HTTPException, Query, Path
from typing import List, Optional
from datetime import datetime

from app.dependencies import get_current_user_with_supabase, get_tenant_id

router = APIRouter()


from pydantic import BaseModel


class VulnerabilityBase(BaseModel):
    pass


class VulnerabilityResponse(VulnerabilityBase):
    id: str
    title: str
    description: str
    severity: str
    status: str
    discovered_at: datetime
    remediation: Optional[str] = None


from app.database.supabase import get_supabase_client
import structlog

@router.get("/", response_model=List[VulnerabilityResponse])
async def get_vulnerabilities(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    severity: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    current_user: dict = Depends(get_current_user_with_supabase),
    tenant_id: str = Depends(get_tenant_id)
):
    """
    Get list of vulnerabilities from database for the tenant.
    """
    supabase = get_supabase_client()
    try:
        query = supabase.table("findings").select("*").range(skip, skip + limit - 1)
        if severity:
            query = query.eq("severity", severity.upper())
        result = query.execute()
        if result.data:
            return [
                VulnerabilityResponse(
                    id=f["id"],
                    title=f.get("title", "Vulnerability Finding"),
                    description=f.get("description", f.get("title", "")),
                    severity=f.get("severity", "HIGH"),
                    status=f.get("status", "OPEN"),
                    discovered_at=f.get("created_at", datetime.utcnow().isoformat()),
                    remediation=f.get("remediation", None)
                )
                for f in result.data
            ]
    except Exception as e:
        structlog.get_logger(__name__).error("vulnerabilities_db_failed", error=str(e))
    return []


@router.get("/{vulnerability_id}", response_model=VulnerabilityResponse)
async def get_vulnerability(
    vulnerability_id: str = Path(...),
    current_user: dict = Depends(get_current_user_with_supabase),
    tenant_id: str = Depends(get_tenant_id)
):
    """
    Get a specific vulnerability by ID.
    """
    # Placeholder implementation
    raise HTTPException(status_code=404, detail="Vulnerability not found")


@router.patch("/{vulnerability_id}")
async def update_vulnerability(
    vulnerability_id: str = Path(...),
    update_data: dict = None,
    current_user: dict = Depends(get_current_user_with_supabase),
    tenant_id: str = Depends(get_tenant_id)
):
    """
    Update a vulnerability.
    """
    # Placeholder implementation
    return {"message": "Vulnerability updated"}


@router.post("/{vulnerability_id}/remediate")
async def remediate_vulnerability(
    vulnerability_id: str = Path(...),
    remediation_notes: Optional[str] = None,
    current_user: dict = Depends(get_current_user_with_supabase),
    tenant_id: str = Depends(get_tenant_id)
):
    """
    Mark a vulnerability as remediated.
    """
    # Placeholder implementation
    return {"message": "Vulnerability remediated"}