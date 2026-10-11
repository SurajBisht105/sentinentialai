"""Input guardrail used by agents before processing scan context."""

import re
from typing import Any, Dict, Tuple


class PromptGuardAgent:
    """Reject common instruction-override attempts in agent input."""

    _BLOCKED_PATTERNS = (
        r"ignore\s+(all\s+)?previous instructions",
        r"disregard\s+(all\s+)?previous instructions",
        r"you are now\s+(dan|an unrestricted|a different)",
        r"reveal\s+(the )?(system|developer) prompt",
    )

    async def validate_input(self, context: Dict[str, Any]) -> Tuple[bool, Dict[str, str]]:
        text = str(context).lower()
        for pattern in self._BLOCKED_PATTERNS:
            if re.search(pattern, text):
                return False, {
                    "code": "PROMPT_INJECTION",
                    "message": "Instruction override pattern detected",
                }
        return True, {}