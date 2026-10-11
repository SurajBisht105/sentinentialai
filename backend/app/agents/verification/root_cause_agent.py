# app/agents/verification/root_cause_agent.py
from typing import Dict, Any, List, Optional
import structlog

from app.agents.base_agent import BaseAgent
from app.config import settings

logger = structlog.get_logger(__name__)


class RootCauseAgent(BaseAgent):
    """
    Root Cause Analysis Agent — Identifies the underlying cause
    of vulnerabilities and plans remediation strategies.

    Analysis Framework:
    - 5-Why analysis for each vulnerability
    - Code pattern identification
    - Remediation code generation
    - Security testing recommendations
    - Impact blast radius assessment
    """

    AGENT_TYPE = "ROOT_CAUSE"
    DEFAULT_MODEL = settings.LLM_MODEL_REASONING

    def get_system_prompt(self) -> str:
        return """You are Root Cause Analysis Agent, specializing in security vulnerability
root cause analysis and remediation planning. You perform 5-Why analysis, identify
vulnerable code patterns, generate secure code fixes, and assess impact.
Provide specific, production-ready remediation code."""

    async def execute(self, context: Dict[str, Any]) -> Dict[str, Any]:
        scan_id = context["scan_id"]
        finding = context.get("finding", {})
        finding_id = finding.get("id")

        self._add_reasoning_step(
            thought=f"Performing root cause analysis for: {finding.get('title', 'Unknown')}",
            action="ROOT_CAUSE_ANALYSIS",
            observation=f"Severity: {finding.get('severity')}, CWE: {finding.get('cwe_id')}",
        )

        # 1. Perform 5-Why analysis
        five_why = await self._five_why_analysis(finding)

        # 2. Identify vulnerable code pattern
        pattern = await self._identify_vulnerable_pattern(finding)

        # 3. Generate remediation code
        remediation = await self._generate_remediation(finding, pattern)

        # 4. Assess blast radius
        blast_radius = await self._assess_blast_radius(finding)

        # 5. Generate test cases for the fix
        test_cases = await self._generate_test_cases(finding, remediation)

        self._add_reasoning_step(
            thought="Root cause analysis complete, remediation plan generated",
            action="REMEDIATION_PLAN_READY",
        )

        # Save remediation to database
        if finding_id and remediation:
            remediation_record = {
                "finding_id": finding_id,
                "tenant_id": context.get("tenant_id"),
                "proposed_code_fix": remediation.get("fixed_code"),
                "fix_description": remediation.get("description"),
                "fix_explanation": remediation.get("explanation"),
                "unified_diff": remediation.get("diff"),
                "fix_confidence": remediation.get("confidence", 0.8),
                "fix_completeness": remediation.get("completeness", "FULL"),
                "status": "PENDING",
            }

            self.supabase.table("remediations").insert(remediation_record).execute()

            # Notify PR Review Agent
            from app.kafka.producer import kafka_producer
            await kafka_producer.send(
                topic=settings.KAFKA_TOPIC_PR_REVIEW,
                value={
                    "event_type": "REMEDIATION_READY",
                    "scan_id": scan_id,
                    "finding_id": finding_id,
                    "finding": finding,
                    "remediation": remediation,
                    "test_cases": test_cases,
                },
            )

        return {
            "scan_id": scan_id,
            "finding_id": finding_id,
            "status": "COMPLETED",
            "root_cause": five_why,
            "vulnerable_pattern": pattern,
            "remediation": remediation,
            "blast_radius": blast_radius,
            "test_cases": test_cases,
        }

    async def _five_why_analysis(self, finding: Dict) -> Dict:
        """Perform 5-Why root cause analysis"""
        prompt = f"""
Perform a 5-Why root cause analysis for this vulnerability:

Vulnerability: {finding.get('title')}
CWE: {finding.get('cwe_id')}
Description: {finding.get('description')}
Code: {finding.get('code_snippet', 'Not available')[:500]}

Use the 5-Why methodology to trace back to the root cause.

Respond with JSON:
{{
    "why_1": "Why did this vulnerability occur?",
    "why_2": "Why did that happen?",
    "why_3": "Why was that the case?",
    "why_4": "Why did that situation arise?",
    "why_5": "Why was that the root cause?",
    "root_cause": "The fundamental root cause",
    "contributing_factors": ["factor1", "factor2"],
    "systemic_issues": ["issue1", "issue2"]
}}
"""
        response = await self.call_llm(prompt, json_mode=True)
        return await self.parse_json_response(response)

    async def _identify_vulnerable_pattern(self, finding: Dict) -> Dict:
        """Identify the vulnerable code pattern"""
        prompt = f"""
Identify the vulnerable code pattern for this security finding:

Title: {finding.get('title')}
CWE: {finding.get('cwe_id')}
Code Snippet: {finding.get('code_snippet', 'Not available')[:1000]}
File: {finding.get('file_path', 'Unknown')}

Respond with JSON:
{{
    "pattern_name": "e.g., String Interpolation in SQL Query",
    "pattern_description": "How the vulnerability manifests",
    "vulnerable_code": "The specific vulnerable construct",
    "secure_alternative": "The secure pattern to use instead",
    "similar_locations": ["other places this might exist"]
}}
"""
        response = await self.call_llm(prompt, json_mode=True)
        return await self.parse_json_response(response)

    async def _generate_remediation(
        self, finding: Dict, pattern: Dict
    ) -> Dict:
        """Generate specific remediation code"""
        language = self._infer_language(finding.get("file_path", ""))

        prompt = f"""
Generate a complete, production-ready code fix for this vulnerability:

Vulnerability: {finding.get('title')}
CWE: {finding.get('cwe_id')}
Language: {language}
File: {finding.get('file_path', 'Unknown')}

Vulnerable Code:
```{language}
{finding.get('code_snippet', 'Code not available')}
```

Vulnerable Pattern: {pattern.get('pattern_name', 'Unknown')}
Secure Alternative: {pattern.get('secure_alternative', 'Unknown')}

Requirements:

- Provide complete, working replacement code
- Follow {language} best practices
- Include defensive security measures
- Add comments explaining the security fix
- Don't break existing functionality

Respond with JSON:
{{
"fixed_code": "complete fixed code block",
"diff": "unified diff format",
"description": "one-line description of the fix",
"explanation": "detailed explanation of what was changed and why",
"breaking_change": false,
"dependencies_added": [],
"confidence": 0.0-1.0,
"completeness": "FULL|PARTIAL|WORKAROUND"
}}
"""
        response = await self.call_llm(
            prompt,
            model=settings.LLM_MODEL_REASONING,
            max_tokens=4096,
            json_mode=True,
        )
        return await self.parse_json_response(response)

    async def _assess_blast_radius(self, finding: Dict) -> Dict:
        """Assess the potential impact of the vulnerability"""
        prompt = f"""
Assess the blast radius (potential impact) of this vulnerability:

Title: {finding.get('title')}
Severity: {finding.get('severity')}
CWE: {finding.get('cwe_id')}
File: {finding.get('file_path', 'Unknown')}
Description: {finding.get('description', '')[:500]}

Respond with JSON:
{{
"data_at_risk": ["user data", "financial records", "..."],
"systems_affected": ["authentication", "payments", "..."],
"attack_complexity": "LOW|MEDIUM|HIGH",
"authentication_required": true,
"user_interaction_required": false,
"confidentiality_impact": "NONE|LOW|HIGH",
"integrity_impact": "NONE|LOW|HIGH",
"availability_impact": "NONE|LOW|HIGH",
"estimated_affected_users": "all|subset|admin_only",
"regulatory_impact": ["GDPR", "PCI-DSS", "SOC2"]
}}
"""
        response = await self.call_llm(prompt, json_mode=True)
        return await self.parse_json_response(response)

    async def _generate_test_cases(
        self, finding: Dict, remediation: Dict
    ) -> List[Dict]:
        """Generate security test cases for the fix"""
        language = self._infer_language(finding.get("file_path", ""))

        prompt = f"""
Generate security test cases to verify the fix for:

Vulnerability: {finding.get('title')}
CWE: {finding.get('cwe_id')}
Language: {language}
Fixed Code: {str(remediation.get('fixed_code', ''))[:500]}

Generate 3 test cases:

1. A test that the vulnerability is no longer exploitable
2. A test that the fix handles edge cases correctly
3. A regression test for normal functionality

Respond with JSON:
{{
"test_cases": [
{{
"name": "test name",
"description": "what this test verifies",
"test_code": "complete test code",
"expected_result": "what should happen"
}}
]
}}
"""
        response = await self.call_llm(prompt, model=settings.LLM_MODEL_REASONING, json_mode=True)
        parsed = await self.parse_json_response(response)
        return parsed.get("test_cases", [])

    def _infer_language(self, file_path: str) -> str:
        """Infer programming language from file extension"""
        import os
        ext_map = {
            ".py": "python", ".js": "javascript", ".ts": "typescript",
            ".go": "go", ".java": "java", ".rb": "ruby", ".php": "php",
            ".cs": "csharp", ".cpp": "cpp", ".rs": "rust",
        }
        _, ext = os.path.splitext(file_path or "")
        return ext_map.get(ext, "code")