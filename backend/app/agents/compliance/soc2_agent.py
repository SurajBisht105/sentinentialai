# app/agents/compliance/soc2_agent.py
from typing import Dict, Any, List, Optional
import structlog

from app.agents.base_agent import BaseAgent
from app.config import settings

logger = structlog.get_logger(__name__)


SOC2_CONTROLS = [
    {"id": "CC1.1", "category": "Control Environment", "name": "COSO Principle 1 — Integrity and Ethical Values", "test": "review_policies"},
    {"id": "CC6.1", "category": "Logical and Physical Access", "name": "Logical Access Security", "test": "review_access_controls"},
    {"id": "CC6.3", "category": "Logical and Physical Access", "name": "Access Removal", "test": "review_offboarding"},
    {"id": "CC7.1", "category": "System Operations", "name": "Vulnerability Detection", "test": "review_vuln_management"},
    {"id": "CC7.2", "category": "System Operations", "name": "Security Events Monitored", "test": "review_monitoring"},
    {"id": "CC8.1", "category": "Change Management", "name": "Change Management Controls", "test": "review_change_management"},
    {"id": "A1.1", "category": "Availability", "name": "Availability Commitments Defined", "test": "review_sla"},
    {"id": "A1.2", "category": "Availability", "name": "Performance Monitoring", "test": "review_monitoring"},
    {"id": "C1.1", "category": "Confidentiality", "name": "Confidential Information Identified", "test": "review_data_classification"},
    {"id": "PI1.1", "category": "Processing Integrity", "name": "System Processing", "test": "review_integrity"},
]


class SOC2Agent(BaseAgent):
    """
    SOC2 Compliance Agent — Automated SOC2 Type II assessment.
    Maps security findings and configurations to TSC controls.
    """

    AGENT_TYPE = "SOC2_COMPLIANCE"
    DEFAULT_MODEL = settings.LLM_MODEL_REASONING

    def get_system_prompt(self) -> str:
        return """You are SOC2 Compliance Agent, an expert in SOC2 Type II Trust Service Criteria.
You evaluate security posture against TSC controls and provide evidence-based assessments.
You map vulnerabilities to failing controls and identify compensating controls."""

    async def execute(self, context: Dict[str, Any]) -> Dict[str, Any]:
        scan_id = context["scan_id"]
        tenant_id = context.get("tenant_id")
        findings = context.get("findings", [])

        self._add_reasoning_step(
            thought=f"Starting SOC2 assessment with {len(findings)} security findings",
            action="SOC2_ASSESSMENT_START",
        )

        control_results = []

        for control in SOC2_CONTROLS:
            self._add_reasoning_step(
                thought=f"Evaluating control {control['id']}: {control['name']}",
                action=f"EVALUATE_{control['id']}",
            )

            result = await self._evaluate_control(control, findings, context)
            control_results.append(result)

        # Calculate overall score
        passing = sum(1 for r in control_results if r["status"] == "PASS")
        total = len(control_results)
        score = round((passing / total) * 100, 1) if total > 0 else 0

        # Save report to database
        report_id = await self._save_report(
            tenant_id=tenant_id,
            scan_id=scan_id,
            score=score,
            control_results=control_results,
        )

        self._add_reasoning_step(
            thought=f"SOC2 assessment complete: {score}% ({passing}/{total} controls passing)",
            action="SOC2_ASSESSMENT_COMPLETE",
        )

        return {
            "scan_id": scan_id,
            "framework": "SOC2",
            "status": "COMPLETED",
            "overall_score": score,
            "controls_passing": passing,
            "controls_total": total,
            "report_id": report_id,
            "control_results": control_results,
        }

    async def _evaluate_control(
        self, control: Dict, findings: List[Dict], context: Dict
    ) -> Dict:
        """Evaluate a single SOC2 control"""
        # Find relevant findings for this control
        relevant_findings = self._map_findings_to_control(control, findings)

        prompt = f"""
Evaluate this SOC2 Trust Service Criteria control:

CONTROL: {control['id']} — {control['name']}
CATEGORY: {control['category']}

RELEVANT SECURITY FINDINGS ({len(relevant_findings)} total):
{self._format_findings_for_control(relevant_findings)}

ADDITIONAL CONTEXT:
- Scan completed: {context.get('scan_completed', True)}
- Secrets detected: {context.get('secrets_count', 0)}
- Critical findings: {sum(1 for f in findings if f.get('severity') == 'CRITICAL')}

Based on the findings and context, assess this control:

Respond with JSON:
{{
    "control_id": "{control['id']}",
    "status": "PASS|FAIL|NOT_APPLICABLE",
    "score": 0-100,
    "evidence": "what evidence was found",
    "notes": "assessment notes",
    "remediation_required": true/false,
    "remediation_plan": "if failing, what needs to be done"
}}
"""
        response = await self.call_llm(prompt, temperature=0.0, json_mode=True)
        parsed = await self.parse_json_response(response)

        return {
            "control_id": control["id"],
            "control_name": control["name"],
            "category": control["category"],
            "status": parsed.get("status", "FAIL"),
            "score": parsed.get("score", 0),
            "evidence": parsed.get("evidence", ""),
            "notes": parsed.get("notes", ""),
            "remediation_required": parsed.get("remediation_required", False),
            "remediation_plan": parsed.get("remediation_plan", ""),
            "relevant_findings": len(relevant_findings),
        }

    def _map_findings_to_control(
        self, control: Dict, findings: List[Dict]
    ) -> List[Dict]:
        """Map security findings to SOC2 controls"""
        control_to_cwe = {
            "CC6.1": ["CWE-287", "CWE-306", "CWE-522", "CWE-798"],
            "CC7.1": ["CWE-89", "CWE-79", "CWE-77", "CWE-78"],
            "CC7.2": ["CWE-778", "CWE-223"],
            "CC8.1": ["CWE-494", "CWE-1104"],
            "C1.1":  ["CWE-312", "CWE-313", "CWE-315"],
        }

        relevant_cwes = control_to_cwe.get(control["id"], [])
        if not relevant_cwes:
            return []

        return [
            f for f in findings
            if f.get("cwe_id") in relevant_cwes
        ]

    def _format_findings_for_control(self, findings: List[Dict]) -> str:
        if not findings:
            return "No directly relevant findings"
        lines = []
        for f in findings[:5]:
            lines.append(f"- [{f.get('severity')}] {f.get('title')} (CWE: {f.get('cwe_id')})")
        return "\n".join(lines)

    async def _save_report(
        self,
        tenant_id: str,
        scan_id: str,
        score: float,
        control_results: List[Dict],
    ) -> Optional[str]:
        """Save compliance report to database"""
        try:
            # Create report
            report = self.supabase.table("compliance_reports").insert({
                "tenant_id": tenant_id,
                "framework": "SOC2",
                "framework_version": "TSC 2017",
                "overall_score": score,
                "controls_total": len(control_results),
                "controls_passing": sum(1 for r in control_results if r["status"] == "PASS"),
                "controls_failing": sum(1 for r in control_results if r["status"] == "FAIL"),
                "controls_na": sum(1 for r in control_results if r["status"] == "NOT_APPLICABLE"),
                "scan_id": scan_id,
                "assessor_agent": self.AGENT_TYPE,
                "status": "PUBLISHED",
            }).execute()

            if not report.data:
                return None

            report_id = report.data[0]["id"]

            # Save individual control results
            control_records = [
                {
                    "report_id": report_id,
                    "tenant_id": tenant_id,
                    "control_id": r["control_id"],
                    "control_name": r["control_name"],
                    "category": r["category"],
                    "status": r["status"],
                    "evidence": r.get("evidence", ""),
                    "notes": r.get("notes", ""),
                    "remediation_required": r.get("remediation_required", False),
                    "remediation_plan": r.get("remediation_plan"),
                    "assessed_by_agent": self.AGENT_TYPE,
                }
                for r in control_results
            ]

            self.supabase.table("compliance_controls").insert(control_records).execute()

            return report_id

        except Exception as e:
            logger.error("compliance_report_save_failed", error=str(e))
            return None

    from typing import Optional