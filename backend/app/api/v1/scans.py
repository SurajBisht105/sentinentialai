import asyncio
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, BackgroundTasks
from pydantic import BaseModel, Field
import structlog

from app.database.supabase import get_supabase_client
from app.dependencies import require_engineer, get_tenant_id, get_current_user_with_supabase
from app.services.scan_service import ScanService
from app.services.audit_service import AuditService
from app.schemas.scan import ScanCreate, ScanResponse, ScanStatusResponse

logger = structlog.get_logger(__name__)
router = APIRouter()


class ScanTriggerRequest(BaseModel):
    project_id: Optional[str] = Field(default=None, description="Optional associated project ID")
    target_repo: Optional[str] = Field(default=None, description="GitHub repository URL or local path")
    target_url: Optional[str] = Field(default=None, description="Live website or web application URL")
    branch: str = Field(default="main", description="Branch to scan")
    scan_types: List[str] = Field(default_factory=lambda: ["SAST", "SCA", "SECRETS", "DAST"], description="Types of scans: SAST, SCA, DAST, SECRETS, IaC")


@router.post("", response_model=ScanResponse, status_code=status.HTTP_202_ACCEPTED)
async def trigger_scan(
    request: ScanTriggerRequest,
    current_user: dict = Depends(require_engineer),
    tenant_id: str = Depends(get_tenant_id),
):
    """
    Trigger a new multi-agent security scan on a live website or repository
    """
    if not request.target_repo and not request.target_url and request.project_id:
        try:
            supabase = get_supabase_client()
            proj_res = supabase.table("projects").select("*").eq("id", request.project_id).maybe_single().execute()
            if proj_res and proj_res.data:
                request.target_repo = proj_res.data.get("repo_url")
                if not request.branch or request.branch == "main":
                    request.branch = proj_res.data.get("default_branch") or proj_res.data.get("branch") or "main"
        except Exception as err:
            logger.warning("failed_to_resolve_project_for_scan", project_id=request.project_id, error=str(err))

    if not request.target_repo and not request.target_url:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Either target_repo, target_url, or a valid project_id must be provided for scanning."
        )

    scan_service = ScanService()
    audit_service = AuditService()

    user_id = (
        current_user.get("id")
        or current_user.get("sub")
        or current_user.get("user_id")
        or (current_user.get("jwt_payload", {}).get("sub") if isinstance(current_user.get("jwt_payload"), dict) else None)
    )

    try:
        # Create scan record in database
        scan = await scan_service.create_scan(
            repo_url=request.target_repo,
            target_url=request.target_url,
            branch=request.branch,
            scan_types=request.scan_types,
            user_id=user_id,
            tenant_id=tenant_id,
        )

        target_display = request.target_url or request.target_repo

        # Log audit event asynchronously
        asyncio.create_task(
            audit_service.log_event(
                actor_type="USER",
                actor_id=user_id or "user-system",
                actor_email=current_user.get("email"),
                action="SCAN_INITIATED",
                resource_type="SCAN",
                resource_id=scan["id"],
                details={
                    "target": target_display,
                    "branch": request.branch,
                    "scan_types": request.scan_types,
                },
                ip_address=None,
                risk_level="LOW",
            )
        )

        # Launch scan execution asynchronously in the background so API responds immediately
        asyncio.create_task(scan_service.trigger_scan_execution(scan))

        logger.info(
            "scan_triggered_async",
            scan_id=scan["id"],
            user_id=current_user.get("id"),
            target=target_display,
        )

        return ScanResponse(
            scan_id=scan["id"],
            status=scan.get("status", "QUEUED"),
            message="Scan initiated. Security agents are analyzing the target.",
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error("trigger_scan_failed", error=str(e), exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to initiate scan: {str(e)}"
        )


@router.get("/{scan_id}", response_model=ScanStatusResponse)
async def get_scan_status(
    scan_id: str,
    current_user: dict = Depends(require_engineer),
    tenant_id: str = Depends(get_tenant_id),
):
    """
    Get scan status and progress
    """
    scan_service = ScanService()
    scan = await scan_service.get_scan(scan_id, tenant_id)

    if not scan:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"code": "SCAN_NOT_FOUND", "message": "Scan not found"},
        )

    meta = scan.get("metadata") or scan.get("trigger_metadata") or {}
    branch = scan.get("branch") or meta.get("branch") or "main"
    target_url = scan.get("target_url") or meta.get("target_url")

    # Fetch live counts if not present in scan
    f_total = scan.get("finding_count") or meta.get("finding_count")
    f_crit = scan.get("critical_count") or meta.get("critical_count")
    f_high = scan.get("high_count") or meta.get("high_count")
    f_med = scan.get("medium_count") or meta.get("medium_count")
    f_low = scan.get("low_count") or meta.get("low_count")

    if f_total is None:
        try:
            supabase = get_supabase_client()
            live_f = supabase.table("findings").select("severity").eq("scan_id", scan["id"]).execute().data or []
            f_total = len(live_f)
            f_crit = sum(1 for f in live_f if (f.get("severity") or "").upper() == "CRITICAL")
            f_high = sum(1 for f in live_f if (f.get("severity") or "").upper() == "HIGH")
            f_med = sum(1 for f in live_f if (f.get("severity") or "").upper() == "MEDIUM")
            f_low = sum(1 for f in live_f if (f.get("severity") or "").upper() == "LOW")
        except Exception:
            f_total, f_crit, f_high, f_med, f_low = 0, 0, 0, 0, 0

    return ScanStatusResponse(
        scan_id=scan["id"],
        project_id=scan.get("project_id"),
        status=scan.get("status", "UNKNOWN"),
        progress=await scan_service.get_scan_progress(scan_id),
        scan_types=scan.get("scan_types", []),
        branch=branch,
        target_url=target_url,
        finding_count=f_total or 0,
        critical_count=f_crit or 0,
        high_count=f_high or 0,
        medium_count=f_med or 0,
        low_count=f_low or 0,
        started_at=scan.get("started_at"),
        completed_at=scan.get("completed_at"),
        duration_seconds=scan.get("duration_seconds"),
    )


@router.post("/{scan_id}/cancel", response_model=ScanStatusResponse)
async def cancel_scan(
    scan_id: str,
    current_user: dict = Depends(require_engineer),
    tenant_id: str = Depends(get_tenant_id),
):
    """Cancel a queued or running scan."""
    scan_service = ScanService()
    scan = await scan_service.cancel_scan(scan_id, tenant_id)
    if not scan:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Scan not found")

    meta = scan.get("metadata") or scan.get("trigger_metadata") or {}
    branch = scan.get("branch") or meta.get("branch") or "main"
    target_url = scan.get("target_url") or meta.get("target_url")

    return ScanStatusResponse(
        scan_id=scan["id"],
        project_id=scan.get("project_id"),
        status=scan.get("status", "CANCELLED"),
        progress=scan.get("progress_percent", 0),
        scan_types=scan.get("scan_types", []),
        branch=branch,
        target_url=target_url,
        finding_count=scan.get("finding_count") or meta.get("finding_count") or 0,
        critical_count=scan.get("critical_count") or meta.get("critical_count") or 0,
        high_count=scan.get("high_count") or meta.get("high_count") or 0,
        medium_count=scan.get("medium_count") or meta.get("medium_count") or 0,
        low_count=scan.get("low_count") or meta.get("low_count") or 0,
        started_at=scan.get("started_at"),
        completed_at=scan.get("completed_at"),
        duration_seconds=scan.get("duration_seconds"),
    )


@router.get("", response_model=List[ScanStatusResponse])
async def list_scans(
    project_id: Optional[str] = None,
    limit: int = 50,
    offset: int = 0,
    current_user: dict = Depends(require_engineer),
    tenant_id: str = Depends(get_tenant_id),
):
    """
    List scans for a project or tenant
    """
    scan_service = ScanService()
    try:
        scans = await scan_service.list_scans(
            tenant_id=tenant_id,
            project_id=project_id,
            limit=limit,
            offset=offset,
        )
    except Exception as e:
        logger.error("list_scans_failed", tenant_id=tenant_id, project_id=project_id, error=str(e), exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={"code": "SCAN_LIST_FAILED", "message": f"Failed to list scans: {str(e)}"},
        )

    # Batch query findings count for all scans
    scan_ids = [s["id"] for s in scans]
    findings_by_scan = {}
    if scan_ids:
        try:
            supabase = get_supabase_client()
            f_res = supabase.table("findings").select("scan_id, severity").in_("scan_id", scan_ids).execute()
            for f in f_res.data or []:
                s_id = f.get("scan_id")
                if s_id not in findings_by_scan:
                    findings_by_scan[s_id] = {"total": 0, "CRITICAL": 0, "HIGH": 0, "MEDIUM": 0, "LOW": 0}
                findings_by_scan[s_id]["total"] += 1
                sev = (f.get("severity") or "LOW").upper()
                if sev in findings_by_scan[s_id]:
                    findings_by_scan[s_id][sev] += 1
        except Exception:
            pass

    responses = []
    for scan in scans:
        scan_status = scan.get("status", "UNKNOWN")
        progress = 100 if scan_status in ["COMPLETED", "CANCELLED", "FAILED"] else await scan_service.get_scan_progress(scan["id"])
        meta = scan.get("metadata") or scan.get("trigger_metadata") or {}
        branch = scan.get("branch") or meta.get("branch") or "main"
        target_url = scan.get("target_url") or meta.get("target_url")

        f_counts = findings_by_scan.get(scan["id"], {})
        real_total = f_counts.get("total") if "total" in f_counts else (scan.get("finding_count") or meta.get("finding_count") or 0)
        real_crit = f_counts.get("CRITICAL") if "CRITICAL" in f_counts else (scan.get("critical_count") or meta.get("critical_count") or 0)
        real_high = f_counts.get("HIGH") if "HIGH" in f_counts else (scan.get("high_count") or meta.get("high_count") or 0)
        real_med = f_counts.get("MEDIUM") if "MEDIUM" in f_counts else (scan.get("medium_count") or meta.get("medium_count") or 0)
        real_low = f_counts.get("LOW") if "LOW" in f_counts else (scan.get("low_count") or meta.get("low_count") or 0)

        responses.append(
            ScanStatusResponse(
                scan_id=scan["id"],
                project_id=scan.get("project_id"),
                status=scan_status,
                progress=progress,
                scan_types=scan.get("scan_types", []),
                branch=branch,
                target_url=target_url,
                finding_count=real_total or 0,
                critical_count=real_crit or 0,
                high_count=real_high or 0,
                medium_count=real_med or 0,
                low_count=real_low or 0,
                started_at=scan.get("started_at"),
                completed_at=scan.get("completed_at"),
                duration_seconds=scan.get("duration_seconds"),
            )
        )
    return responses