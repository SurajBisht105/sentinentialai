# app/agents/verification/hallucination_agent.py
from typing import Dict, Any, List, Optional
import structlog
import asyncio

from app.agents.base_agent import BaseAgent
from app.config import settings

logger = structlog.get_logger(__name__)


class HallucinationDetectionAgent(BaseAgent):
    """
    Hallucination Detection Agent — Validates agent reasoning
    and findings for factual accuracy, evidence coverage,
    and logical consistency.

    Evaluation Dimensions:
    - Evidence coverage (does the finding have supporting code/data?)
    - Factual accuracy (is the CWE/CVE correct?)
    - Logical consistency (does the reasoning make sense?)
    - Confidence calibration (is confidence appropriate?)
    - Cross-reference validation (do multiple sources agree?)
    """

    AGENT_TYPE = "HALLUCINATION_DETECTOR"
    DEFAULT_MODEL = settings.LLM_MODEL_REASONING

    HALLUCINATION_THRESHOLD = 0.25  # Max acceptable hallucination score

    def get_system_prompt(self) -> str:
        return """You are a Hallucination Detection specialist for AI security agents.
Your role is to evaluate whether security findings are grounded in evidence,
factually accurate, and logically sound. You detect unsupported claims,
incorrect CWE/CVE attributions, and fabricated vulnerabilities.
Be rigorous and skeptical. Only approve findings with solid evidence."""

    async def execute(self, context: Dict[str, Any]) -> Dict[str, Any]:
        scan_id = context["scan_id"]
        findings = context.get("findings", [])

        if not findings:
            return {
                "scan_id": scan_id,
                "status": "COMPLETED",
                "message": "No findings to validate",
            }

        self._add_reasoning_step(
            thought=f"Validating {len(findings)} findings for hallucination",
            action="HALLUCINATION_VALIDATION_START",
        )

        validated = []
        hallucinated = []

        # Process findings in parallel batches
        batches = [findings[i:i + 5] for i in range(0, len(findings), 5)]

        for batch in batches:
            batch_results = await asyncio.gather(
                *[self._validate_finding(finding) for finding in batch],
                return_exceptions=True,
            )

            for result, finding in zip(batch_results, batch):
                if isinstance(result, Exception):
                    # If validation fails, err on the side of caution
                    validated.append({**finding, "hallucination_score": 0.5})
                    continue

                score = result.get("hallucination_score", 0)
                finding["hallucination_score"] = score
                finding["validation_reasoning"] = result.get("reasoning")

                if score <= self.HALLUCINATION_THRESHOLD:
                    validated.append(finding)
                else:
                    hallucinated.append(finding)
                    logger.warning(
                        "finding_hallucinated",
                        finding_title=finding.get("title", "")[:50],
                        score=score,
                    )

        # Calculate overall scan hallucination score
        all_scores = [f.get("hallucination_score", 0) for f in findings]
        avg_hallucination = sum(all_scores) / len(all_scores) if all_scores else 0

        # Update scan with hallucination metrics
        self.supabase.table("scans").update({
            "hallucination_score": round(avg_hallucination, 4),
        }).eq("id", scan_id).execute()

        self._add_reasoning_step(
            thought=f"Validation complete: {len(validated)} valid, {len(hallucinated)} hallucinated",
            action="HALLUCINATION_VALIDATION_COMPLETE",
            observation=f"Avg hallucination score: {avg_hallucination:.3f}",
        )

        # Report if hallucination rate is high
        if avg_hallucination > 0.3:
            await self.report_finding(
                scan_id=scan_id,
                severity="MEDIUM",
                title="High Agent Hallucination Rate Detected",
                description=(
                    f"Average hallucination score of {avg_hallucination:.1%} exceeds threshold. "
                    f"{len(hallucinated)} findings may be inaccurate."
                ),
                cwe_id="CWE-1059",
                evidence={
                    "avg_hallucination_score": avg_hallucination,
                    "hallucinated_count": len(hallucinated),
                    "threshold": self.HALLUCINATION_THRESHOLD,
                },
            )

        return {
            "scan_id": scan_id,
            "status": "COMPLETED",
            "validated_findings": validated,
            "hallucinated_findings": hallucinated,
            "avg_hallucination_score": round(avg_hallucination, 4),
            "validation_rate": len(validated) / len(findings) if findings else 1.0,
        }

    async def _validate_finding(self, finding: Dict) -> Dict:
        """Validate a single finding for hallucination"""
        evidence = finding.get("evidence", {})
        code_snippet = finding.get("code_snippet", "")
        cwe_id = finding.get("cwe_id", "")
        description = finding.get("description", "")
        severity = finding.get("severity", "")

        prompt = f"""
Evaluate this security finding for factual accuracy and evidence quality:

FINDING:
- Title: {finding.get('title')}
- Severity: {severity}
- CWE: {cwe_id}
- Description: {description[:500]}
- Evidence: {str(evidence)[:300]}
- Code Snippet: {code_snippet[:500] if code_snippet else "None provided"}

VALIDATION CRITERIA:
1. Is the CWE ID correct for this type of vulnerability?
2. Is the severity level appropriate for the described issue?
3. Is there sufficient evidence to support this finding?
4. Is the description factually accurate (no fabricated details)?
5. Would a security expert agree with this finding?
6. Is the code snippet actually vulnerable as described?

Calculate a hallucination score (0.0 = fully grounded, 1.0 = completely hallucinated):

Respond with JSON:
{{
    "hallucination_score": 0.0-1.0,
    "evidence_coverage": 0.0-1.0,
    "cwe_accuracy": true/false,
    "severity_appropriate": true/false,
    "reasoning": "explanation",
    "issues_found": ["issue1", "issue2"]
}}
"""
        response = await self.call_llm(prompt, temperature=0.0, json_mode=True)
        return await self.parse_json_response(response)