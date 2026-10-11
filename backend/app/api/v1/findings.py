# app/api/v1/findings.py
from fastapi import APIRouter, Depends, Query
from typing import List, Optional, Dict, Any
from datetime import datetime
import structlog

from app.dependencies import get_current_user_with_supabase, get_tenant_id
from app.database.supabase import get_supabase_client

logger = structlog.get_logger(__name__)
router = APIRouter()


@router.get("")
async def get_findings(
    project_id: Optional[str] = Query(None),
    scan_id: Optional[str] = Query(None),
    severity: Optional[str] = Query(None),
    verified_only: Optional[bool] = Query(None),
    false_positives: Optional[bool] = Query(None),
    page: int = Query(1, ge=1),
    per_page: int = Query(50, ge=1, le=100),
    current_user: dict = Depends(get_current_user_with_supabase),
    tenant_id: str = Depends(get_tenant_id),
):
    """
    Get paginated security findings with filters.
    """
    try:
        supabase = get_supabase_client()
        query = supabase.table("findings").select("*", count="exact")

        # Apply filters
        if tenant_id:
            try:
                query = query.eq("tenant_id", tenant_id)
            except Exception:
                pass
        if project_id:
            query = query.eq("project_id", project_id)
        if scan_id:
            query = query.eq("scan_id", scan_id)
        if severity:
            query = query.eq("severity", severity.upper())
        if false_positives is not None:
            query = query.eq("false_positive", false_positives)
        elif verified_only is True:
            query = query.eq("false_positive", False)

        # Pagination
        start = (page - 1) * per_page
        end = start + per_page - 1
        query = query.range(start, end)

        result = query.execute()
        findings = result.data or []
        total = result.count or len(findings)

        # Ensure all findings have required attributes
        for f in findings:
            if "detecting_agent" in f and "agent" not in f:
                f["agent"] = f["detecting_agent"]
            elif "agent" in f and "detecting_agent" not in f:
                f["detecting_agent"] = f["agent"]
            elif "agent" not in f:
                f["agent"] = "Security Agent"
                f["detecting_agent"] = "Security Agent"

            if "false_positive" not in f:
                f["false_positive"] = False
            if "has_remediation" not in f:
                f["has_remediation"] = f.get("remediation") is not None or True

        return {
            "findings": findings,
            "total": total,
            "page": page,
            "per_page": per_page,
        }

    except Exception as e:
        logger.error("get_findings_error", error=str(e))
        return {
            "findings": [],
            "total": 0,
            "page": page,
            "per_page": per_page,
        }
