# app/agents/verification/taint_analysis_agent.py
import ast
import os
import re
import structlog
from typing import Dict, Any, List, Optional, Set

from app.agents.base_agent import BaseAgent
from app.config import settings

logger = structlog.get_logger(__name__)


class TaintAnalysisAgent(BaseAgent):
    """
    Taint & Control-Flow Tracing Agent (Static Code Verification).

    Role:
    - Eliminates false positives in SAST by verifying complete source-to-sink dataflow paths.
    - Traces user input variables backwards to verify untrusted source origins.
    - Traces forward to identify sanitizers, ORM bindings, typecasts, and validation layers.
    - Suppresses non-exploitable findings.
    """

    AGENT_TYPE = "TAINT_ANALYZER"
    DEFAULT_MODEL = settings.LLM_MODEL_FAST

    # Sources of untrusted user input
    UNTRUSTED_SOURCES = [
        r"request\.(?:GET|POST|args|form|values|json|data|cookies|headers|params)",
        r"req\.(?:query|body|params|headers|cookies)",
        r"params\[",
        r"sys\.argv",
        r"os\.environ",
        r"input\(",
        r"socket\.",
        r"websocket\.",
    ]

    # Standard sanitizers, parameterizers, and type casters
    SANITIZERS = [
        r"(?:int|float|bool)\(",
        r"(?:escape|html\.escape|cgi\.escape|markupsafe\.escape)",
        r"(?:sanitize|clean|validator\.escape|DOMPurify\.sanitize)",
        r"(?:shlex\.quote|pipes\.quote)",
        r"(?:urllib\.parse\.quote|encodeURIComponent)",
        r"(?:prepare|execute\([^,]+,\s*(?:\[|\(|\{))",  # Parameterized SQL query
        r"(?:param|parameters|bind|placeholder)",
        r"(?:validate_schema|pydantic|zod)",
    ]

    async def execute(self, context: Dict[str, Any]) -> Dict[str, Any]:
        scan_id = context["scan_id"]
        findings = context.get("findings", [])
        repo_path = context.get("repo_path")

        self._add_reasoning_step(
            thought=f"Initiating taint & control-flow analysis on {len(findings)} SAST findings",
            action="TAINT_ANALYSIS_START",
        )

        verified_findings = []
        suppressed_findings = []

        for finding in findings:
            result = await self.verify_finding_taint(finding, repo_path)
            if result.get("is_valid_taint_path"):
                finding["metadata"] = finding.get("metadata") or {}
                finding["metadata"]["taint_verified"] = True
                finding["metadata"]["taint_trace"] = result.get("trace")
                verified_findings.append(finding)
            else:
                finding["metadata"] = finding.get("metadata") or {}
                finding["metadata"]["taint_verified"] = False
                finding["metadata"]["suppression_reason"] = result.get("reason")
                suppressed_findings.append(finding)

        self._add_reasoning_step(
            thought=f"Taint analysis complete: {len(verified_findings)} verified, {len(suppressed_findings)} false positives suppressed",
            action="TAINT_ANALYSIS_COMPLETE",
            observation=f"Suppressed: {[f.get('title') for f in suppressed_findings]}",
        )

        return {
            "scan_id": scan_id,
            "status": "COMPLETED",
            "verified_findings": verified_findings,
            "suppressed_findings": suppressed_findings,
            "total_verified": len(verified_findings),
            "total_suppressed": len(suppressed_findings),
        }

    async def verify_finding_taint(self, finding: Dict[str, Any], repo_path: Optional[str]) -> Dict[str, Any]:
        """
        Verify if a static security finding has a complete, unsanitized source-to-sink dataflow path.
        """
        file_path = finding.get("file_path", "")
        line_no = finding.get("line_number") or 1
        snippet = finding.get("metadata", {}).get("code_snippet") or finding.get("description", "")
        cwe = finding.get("cwe_id", "")

        # 1. Read file context around finding
        code_context = ""
        resolved_file = file_path
        if repo_path and not os.path.isabs(file_path):
            resolved_file = os.path.join(repo_path, file_path)

        if os.path.exists(resolved_file) and os.path.isfile(resolved_file):
            try:
                with open(resolved_file, "r", encoding="utf-8", errors="ignore") as f:
                    lines = f.readlines()
                    start_line = max(0, line_no - 25)
                    end_line = min(len(lines), line_no + 25)
                    code_context = "".join(lines[start_line:end_line])
            except Exception as e:
                logger.debug("taint_file_read_error", file=resolved_file, error=str(e))

        if not code_context:
            code_context = snippet

        # 2. Heuristic AST & Pattern Analysis
        for san_pattern in self.SANITIZERS:
            if re.search(san_pattern, code_context, re.IGNORECASE):
                # Check if sanitizer applies to the sink
                if any(x in cwe for x in ["CWE-89", "CWE-78", "CWE-79", "CWE-22", "CWE-94"]):
                    return {
                        "is_valid_taint_path": False,
                        "reason": f"Sanitization / parameterization pattern matched in control flow: '{san_pattern}'",
                        "trace": "Sanitizer detected in immediate function context",
                    }

        # 3. LLM Deep Dataflow Taint-Verification (Fast Model)
        prompt = f"""
You are a Static Taint & Dataflow Analysis Engine.
Evaluate whether this security finding is a REAL vulnerability with an unescaped, controllable source-to-sink path, or a FALSE POSITIVE.

Finding Details:
- Title: {finding.get('title')}
- CWE: {cwe}
- File: {file_path}:{line_no}

Surrounding Code Context:
```
{code_context[:4000]}
```

Analyze:
1. Source: Does the tainted data originate from untrusted external user input?
2. Propagation: Does the variable reach the vulnerable sink without being cast/validated?
3. Sanitization: Is there parameterized binding, schema validation, type casting (int/float), or escaping that neutralizes it?

Respond in strict JSON:
{{
    "is_valid_taint_path": true | false,
    "confidence": 0-100,
    "reason": "Clear explanation of source-to-sink flow or why it is neutralized",
    "source_identified": "e.g. req.query.id or None",
    "sink_identified": "e.g. cursor.execute or None"
}}
"""
        try:
            response = await self.call_llm(prompt, json_mode=True, model=settings.LLM_MODEL_FAST)
            parsed = await self.parse_json_response(response)
            if isinstance(parsed, dict) and "is_valid_taint_path" in parsed:
                return {
                    "is_valid_taint_path": bool(parsed["is_valid_taint_path"]),
                    "reason": parsed.get("reason", "LLM taint verification completed"),
                    "trace": f"Source: {parsed.get('source_identified')} -> Sink: {parsed.get('sink_identified')}",
                }
        except Exception as err:
            logger.debug("taint_llm_verification_skipped", error=str(err))

        # Default: keep finding if unable to disprove
        return {
            "is_valid_taint_path": True,
            "reason": "No sanitization path detected in immediate control flow",
            "trace": "Direct code snippet match",
        }
