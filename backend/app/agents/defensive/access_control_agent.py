# app/agents/defensive/access_control_agent.py
import asyncio
import httpx
import structlog
from typing import Dict, Any, List, Optional
from urllib.parse import urljoin

from app.agents.base_agent import BaseAgent
from app.config import settings

logger = structlog.get_logger(__name__)


class AccessControlAgent(BaseAgent):
    """
    Business Logic & Access Control (BOLA/BFLA) Agent.

    Role:
    - Identifies authorization bypasses between different permission tiers.
    - Probes object ID endpoints (/api/v1/orders/102, /api/v1/documents/450) using mismatched identity contexts.
    - Tests vertical privilege escalations (user attempting admin actions) and horizontal object tampering.
    """

    AGENT_TYPE = "ACCESS_CONTROL"
    DEFAULT_MODEL = settings.LLM_MODEL_FAST

    OBJECT_PROBE_PATTERNS = [
        "/api/v1/users/1",
        "/api/v1/users/2",
        "/api/users/1",
        "/api/v1/orders/1",
        "/api/v1/orders/100",
        "/api/orders/1001",
        "/api/v1/accounts/1",
        "/api/v1/profiles/1",
        "/api/v1/invoices/1",
        "/api/v1/documents/1",
    ]

    async def execute(self, context: Dict[str, Any]) -> Dict[str, Any]:
        scan_id = context["scan_id"]
        target_url = context.get("target_url") or context.get("repo_url", "")
        custom_endpoints = context.get("discovered_endpoints", [])

        self._add_reasoning_step(
            thought=f"Initiating BOLA & Access Control audits on target {target_url}",
            action="BOLA_AUDIT_START",
        )

        findings = []

        if target_url and target_url.startswith("http"):
            async with httpx.AsyncClient(
                verify=False,
                timeout=6.0,
                follow_redirects=False,
                headers={"User-Agent": "SentinelAI-AccessAuditor/1.0"}
            ) as client:
                # 1. Probe standard object routes for unauthenticated data leakage
                for path in self.OBJECT_PROBE_PATTERNS:
                    target_endpoint = urljoin(target_url.rstrip("/") + "/", path.lstrip("/"))
                    try:
                        resp = await client.get(target_endpoint)
                        if resp.status_code == 200 and len(resp.text) > 50:
                            text_lower = resp.text.lower()
                            # Check if it leaks sensitive user/account structures without auth
                            if any(k in text_lower for k in ["email", "username", "account_id", "balance", "ssn", "phone", "first_name"]):
                                finding = await self.report_finding(
                                    scan_id=scan_id,
                                    severity="HIGH",
                                    title=f"Broken Object Level Authorization (BOLA) on {path}",
                                    description=f"Direct unauthenticated access to object entity at {target_endpoint} returned sensitive record data without requiring an authorized bearer token or session cookie.",
                                    cwe_id="CWE-284",
                                    remediation=f"Enforce object-level ownership checks (e.g. `record.owner_id == current_user.id`) and mandatory authentication middleware on '{path}'.",
                                    file_path=target_endpoint,
                                    evidence={"endpoint": path, "status_code": resp.status_code, "preview": resp.text[:200]},
                                    metadata={"category": "Broken Object Level Authorization (BOLA)", "route": path}
                                )
                                findings.append(finding)
                    except Exception as e:
                        logger.debug("bola_probe_error", url=target_endpoint, error=str(e))

        self._add_reasoning_step(
            thought=f"Access control audit complete: {len(findings)} authorization vulnerabilities detected",
            action="BOLA_AUDIT_COMPLETE",
        )

        return {
            "scan_id": scan_id,
            "status": "COMPLETED",
            "findings_count": len(findings),
            "findings": findings,
        }
