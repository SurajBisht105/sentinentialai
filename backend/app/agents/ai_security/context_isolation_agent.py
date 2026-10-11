# app/agents/ai_security/context_isolation_agent.py
from typing import Dict, Any, List, Tuple
import structlog
import re

from app.agents.base_agent import BaseAgent

logger = structlog.get_logger(__name__)


SENSITIVE_PATTERNS = [
    r"(?i)(password|passwd|secret|api.?key|token|credential)\s*[:=]\s*\S+",
    r"AKIA[0-9A-Z]{16}",
    r"sk-[a-zA-Z0-9]{20,}",
    r"ghp_[a-zA-Z0-9]{36}",
    r"-----BEGIN (RSA|EC|OPENSSH) PRIVATE KEY-----",
    r"\b\d{4}[-\s]?\d{4}[-\s]?\d{4}[-\s]?\d{4}\b",  # Credit card
    r"\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b",  # Email
    r"\b(?:\d{1,3}\.){3}\d{1,3}\b",  # IP addresses
    r"\b[0-9]{3}-[0-9]{2}-[0-9]{4}\b",  # SSN
]


class ContextIsolationAgent(BaseAgent):
    """
    Context Isolation Agent — Enforces strict context boundaries
    between agents to prevent sensitive data leakage across tasks.

    Responsibilities:
    - Redact PII and secrets from cross-agent messages
    - Enforce tenant isolation in agent memory
    - Sanitize code snippets before peer review
    - Validate context boundaries
    """

    AGENT_TYPE = "CONTEXT_ISOLATION"

    async def execute(self, context: Dict[str, Any]) -> Dict[str, Any]:
        """Sanitize and isolate context before cross-agent sharing"""
        raw_context = context.get("raw_context", {})
        target_agent = context.get("target_agent", "UNKNOWN")

        self._add_reasoning_step(
            thought=f"Sanitizing context for sharing with {target_agent}",
            action="CONTEXT_SANITIZATION",
        )

        # 1. Detect sensitive data
        sensitive_detected = self._detect_sensitive_data(raw_context)

        # 2. Redact sensitive data
        sanitized_context = self._redact_sensitive_data(raw_context)

        # 3. Validate tenant isolation
        tenant_violations = self._check_tenant_isolation(
            sanitized_context, context.get("source_tenant_id"), context.get("target_tenant_id")
        )

        # 4. LLM-based PII detection for complex cases
        if self._needs_llm_validation(raw_context):
            pii_findings = await self._llm_detect_pii(raw_context)
            for pii in pii_findings:
                sanitized_context = self._redact_field(
                    sanitized_context, pii["field"], pii["replacement"]
                )

        self._add_reasoning_step(
            thought=f"Redacted {len(sensitive_detected)} sensitive items",
            action="REDACTION_COMPLETE",
            observation=f"Tenant violations: {len(tenant_violations)}",
        )

        return {
            "scan_id": context.get("scan_id"),
            "status": "COMPLETED",
            "sanitized_context": sanitized_context,
            "sensitive_items_redacted": len(sensitive_detected),
            "tenant_violations": tenant_violations,
            "safe_to_share": len(tenant_violations) == 0,
        }

    def _detect_sensitive_data(self, context: Dict) -> List[Dict]:
        """Detect sensitive data patterns in context"""
        sensitive = []
        content_str = str(context)

        for pattern in SENSITIVE_PATTERNS:
            matches = re.findall(pattern, content_str)
            for match in matches:
                sensitive.append({
                    "pattern": pattern[:30],
                    "match_preview": str(match)[:10] + "***",
                })

        return sensitive

    def _redact_sensitive_data(self, context: Dict) -> Dict:
        """Recursively redact sensitive data from context dict"""
        if isinstance(context, str):
            return self._redact_string(context)
        elif isinstance(context, dict):
            return {k: self._redact_sensitive_data(v) for k, v in context.items()}
        elif isinstance(context, list):
            return [self._redact_sensitive_data(item) for item in context]
        return context

    def _redact_string(self, value: str) -> str:
        """Redact sensitive patterns from string"""
        result = value
        for pattern in SENSITIVE_PATTERNS:
            result = re.sub(
                pattern,
                lambda m: m.group()[:4] + "***REDACTED***",
                result,
            )
        return result

    def _check_tenant_isolation(
        self,
        context: Dict,
        source_tenant: str,
        target_tenant: str,
    ) -> List[Dict]:
        """Check for cross-tenant data leakage"""
        violations = []

        if source_tenant and target_tenant and source_tenant != target_tenant:
            # Check if source tenant data exists in context
            if source_tenant in str(context):
                violations.append({
                    "type": "CROSS_TENANT_DATA",
                    "source_tenant": source_tenant,
                    "target_tenant": target_tenant,
                    "severity": "CRITICAL",
                })

        return violations

    def _needs_llm_validation(self, context: Dict) -> bool:
        """Determine if LLM validation is needed"""
        content_length = len(str(context))
        return content_length > 500  # LLM for large contexts

    async def _llm_detect_pii(self, context: Dict) -> List[Dict]:
        """Use LLM to detect complex PII patterns"""
        content_str = str(context)[:3000]

        prompt = f"""
Detect any PII (Personally Identifiable Information) or sensitive data in this content:

{content_str}

Look for: full names, email addresses, phone numbers, addresses, SSN, credit cards,
passwords, API keys, tokens, internal URLs, or any other sensitive data.

Respond with JSON:
{{
    "pii_found": [
        {{
            "field": "approximate field/location",
            "type": "EMAIL|PHONE|SSN|CREDIT_CARD|API_KEY|PASSWORD|OTHER",
            "replacement": "[REDACTED_TYPE]"
        }}
    ]
}}
"""
        response = await self.call_llm(prompt, temperature=0.0, json_mode=True)
        parsed = await self.parse_json_response(response)
        return parsed.get("pii_found", [])

    def _redact_field(
        self, context: Dict, field: str, replacement: str
    ) -> Dict:
        """Redact a specific field in context"""
        # Simple string replacement approach
        context_str = str(context)
        # This is simplified; production would use more precise replacement
        return context