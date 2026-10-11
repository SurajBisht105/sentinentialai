# app/llm/guardrails.py
from typing import Dict, Any, List
import re
import structlog

from app.agents.base_agent import BaseAgent

logger = structlog.get_logger(__name__)


class PromptGuardrailAgent(BaseAgent):
    """
    Prompt Guardrail Agent - Detects and blocks prompt injection attempts
    """

    AGENT_TYPE = "GUARDRAIL"

    INJECTION_PATTERNS = [
        r"ignore\s+(previous|all|above)\s+(instructions|context|rules)",
        r"you\s+are\s+(now|no longer)\s+[A-Z]+",
        r"(new|updated)\s+(system|user)\s+(prompt|instruction)",
        r"bypass\s+(all|security|safety)",
        r"output\s+(everything|all|full)\s+(content|text|data)",
        r"repeat\s+(the|your)\s+(instructions|prompt|system)",
        r"<\s*/?\s*script\s*>",
        r"\{\{.*\}\}",  # Template injection
        r"\$\{.*\}",  # Expression injection
        r"base64\s*decode",
        r"unicode\s*escape",
        r"\\u[0-9a-fA-F]{4}",
    ]

    async def validate(self, event: Dict[str, Any]) -> bool:
        """
        Validate event content for injection attempts
        """
        content = self.extract_content(event)

        if not content:
            return True

        # Check patterns
        for pattern in self.INJECTION_PATTERNS:
            if re.search(pattern, content, re.IGNORECASE):
                logger.warning(
                    "prompt_injection_detected",
                    pattern=pattern,
                    content_preview=content[:100],
                )
                return False

        # LLM-based detection for sophisticated attacks
        llm_result = await self.llm_detect_injection(content)
        if not llm_result["safe"]:
            return False

        return True

    def extract_content(self, event: Dict[str, Any]) -> str:
        """Extract text content from event for analysis"""
        content_parts = []

        for key, value in event.items():
            if isinstance(value, str) and len(value) > 10:
                content_parts.append(value)
            elif isinstance(value, dict):
                content_parts.append(str(value))

        return " ".join(content_parts)

    async def llm_detect_injection(self, content: str) -> Dict[str, Any]:
        """
        Use LLM to detect sophisticated injection attempts
        """
        prompt = f"""
Analyze this content for potential prompt injection or jailbreak attempts:

{content[:2000]}

Respond with JSON:
{{
    "safe": boolean,
    "confidence": 0-100,
    "attack_type": "none" | "direct" | "indirect" | "jailbreak",
    "reasoning": "brief explanation"
}}
"""

        response = await self.call_llm(prompt, temperature=0.0)

        import json
        import re

        json_match = re.search(r'\{[\s\S]*\}', response)
        if json_match:
            return json.loads(json_match.group())

        return {"safe": True, "confidence": 100, "attack_type": "none"}