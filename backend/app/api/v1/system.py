# app/api/v1/system.py
from fastapi import APIRouter, Depends
from typing import List, Dict, Any
from datetime import datetime, timedelta
import structlog
from app.dependencies import get_current_user_with_supabase, get_tenant_id

router = APIRouter()

logger = structlog.get_logger(__name__)

from app.database.supabase import get_supabase_client


@router.get("/dashboard/analytics")
async def get_dashboard_analytics(
    current_user: dict = Depends(get_current_user_with_supabase),
    tenant_id: str = Depends(get_tenant_id),
):
    """
    Get real-time system-wide dashboard metrics and risk trend from database.
    """
    supabase = get_supabase_client()
    
    # Defaults
    area_data = []
    bar_data = []

    metrics = {
        "totalFindings": 0,
        "criticalThreats": 0,
        "avgTimeToDetect": 0,
        "avgTimeToRemediate": 0,
        "falsePositiveRate": 0,
        "activeAgents": 0,
        "guardrailSuccess": 0,
        "complianceScore": 0,
    }

    try:
        findings_resp = supabase.table("findings").select("*").execute()
        if findings_resp.data:
            findings = findings_resp.data
            total = len(findings)
            crit = sum(1 for f in findings if f.get("severity") == "CRITICAL")
            high = sum(1 for f in findings if f.get("severity") == "HIGH")
            
            scans_resp = supabase.table("scans").select("*").execute()
            active_scans = len(scans_resp.data) if scans_resp.data else 0

            metrics["totalFindings"] = total
            metrics["criticalThreats"] = crit
            metrics["activeAgents"] = max(active_scans, 1)

            # Update breakdown
            sast_f = sum(1 for f in findings if "sast" in str(f.get("agent", "")).lower())
            sca_f = sum(1 for f in findings if "sca" in str(f.get("agent", "")).lower())
            sec_f = sum(1 for f in findings if "secret" in str(f.get("agent", "")).lower())
            dast_f = sum(1 for f in findings if "dast" in str(f.get("agent", "")).lower())
            ai_f = sum(1 for f in findings if "ai" in str(f.get("agent", "")).lower())

            bar_data = [
                {"type": "SAST", "findings": sast_f, "resolved": 0},
                {"type": "SCA", "findings": sca_f, "resolved": 0},
                {"type": "Secrets", "findings": sec_f, "resolved": 0},
                {"type": "DAST", "findings": dast_f, "resolved": 0},
                {"type": "AI Safety", "findings": ai_f, "resolved": 0},
            ]
    except Exception as e:
        logger.error("analytics_db_query_failed", error=str(e))

    return {
        "metrics": metrics,
        "risk_trend": {"area_data": area_data, "bar_data": bar_data},
    }


@router.get("/agent-activity")
async def get_agent_activity(
    current_user: dict = Depends(get_current_user_with_supabase),
    tenant_id: str = Depends(get_tenant_id),
):
    """
    Get live agent activity feed from audit logs.
    """
    supabase = get_supabase_client()
    try:
        logs_resp = supabase.table("audit_logs").select("*").order("created_at", desc=True).limit(10).execute()
        if logs_resp.data:
            return [
                {
                    "id": log["id"],
                    "timestamp": log.get("created_at"),
                    "agent": f"{log.get('resource_type', 'Agent')} Executor",
                    "action": log.get("action", "Agent task completed"),
                    "status": "error" if log.get("risk_level") == "HIGH" else "success",
                    "details": log.get("actor_email") or log.get("risk_level", "PASSED"),
                }
                for log in logs_resp.data
            ]
    except Exception as e:
        logger.error("agent_activity_db_failed", error=str(e))

    return []


@router.get("/threat-intel")
async def get_threat_intel(
    current_user: dict = Depends(get_current_user_with_supabase),
    tenant_id: str = Depends(get_tenant_id),
):
    """
    Get threat intelligence ticker feed from CVE database.
    """
    supabase = get_supabase_client()
    try:
        cve_resp = supabase.table("threat_intel_cve").select("*").order("published_date", desc=True).limit(10).execute()
        if cve_resp.data:
            return [
                {
                    "id": cve.get("cve_id", f"threat-{idx}"),
                    "severity": cve.get("severity", "HIGH"),
                    "text": f"{cve.get('cve_id')}: {cve.get('title')} — {cve.get('description')[:90]}...",
                }
                for idx, cve in enumerate(cve_resp.data)
            ]
    except Exception as e:
        logger.error("threat_intel_db_failed", error=str(e))

    return []
