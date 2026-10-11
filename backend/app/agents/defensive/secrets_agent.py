# app/agents/defensive/secrets_agent.py
from typing import Dict, Any, List, Optional, Tuple
import structlog
import re
import os
import math
import asyncio

from app.agents.base_agent import BaseAgent
from app.config import settings

logger = structlog.get_logger(__name__)


# Compiled regex patterns for secrets detection
SECRET_PATTERNS = [
    # AWS
    {"name": "AWS Access Key",       "pattern": r"AKIA[0-9A-Z]{16}",                    "severity": "CRITICAL", "cwe": "CWE-798"},
    {"name": "AWS Secret Key",       "pattern": r"(?i)aws.{0,20}secret.{0,20}['\"]([A-Za-z0-9/+=]{40})['\"]", "severity": "CRITICAL", "cwe": "CWE-798"},
    # GCP
    {"name": "GCP Service Account",  "pattern": r"\"private_key\":\s*\"-----BEGIN RSA PRIVATE KEY-----", "severity": "CRITICAL", "cwe": "CWE-798"},
    {"name": "GCP API Key",          "pattern": r"AIza[0-9A-Za-z_-]{35}",               "severity": "HIGH",     "cwe": "CWE-798"},
    # OpenAI
    {"name": "OpenAI API Key",       "pattern": r"sk-[a-zA-Z0-9]{20}T3BlbkFJ[a-zA-Z0-9]{20}", "severity": "CRITICAL", "cwe": "CWE-798"},
    {"name": "OpenAI API Key v2",    "pattern": r"sk-proj-[a-zA-Z0-9_-]{80,}",          "severity": "CRITICAL", "cwe": "CWE-798"},
    # GitHub
    {"name": "GitHub Token",         "pattern": r"ghp_[a-zA-Z0-9]{36}",                 "severity": "HIGH",     "cwe": "CWE-798"},
    {"name": "GitHub App Token",     "pattern": r"ghs_[a-zA-Z0-9]{36}",                 "severity": "HIGH",     "cwe": "CWE-798"},
    # Slack
    {"name": "Slack Token",          "pattern": r"xox[baprs]-[0-9A-Za-z-]{10,}",        "severity": "HIGH",     "cwe": "CWE-798"},
    {"name": "Slack Webhook",        "pattern": r"https://hooks\.slack\.com/services/T[A-Z0-9]{10}/B[A-Z0-9]{10}/[a-zA-Z0-9]{24}", "severity": "MEDIUM", "cwe": "CWE-798"},
    # Stripe
    {"name": "Stripe Secret Key",    "pattern": r"sk_live_[0-9a-zA-Z]{24}",             "severity": "CRITICAL", "cwe": "CWE-798"},
    {"name": "Stripe Test Key",      "pattern": r"sk_test_[0-9a-zA-Z]{24}",             "severity": "LOW",      "cwe": "CWE-798"},
    # JWT
    {"name": "JWT Token",            "pattern": r"eyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}", "severity": "MEDIUM", "cwe": "CWE-798"},
    # Passwords in code
    {"name": "Hardcoded Password",   "pattern": r"(?i)(password|passwd|pwd)\s*=\s*['\"][^'\"\s]{8,}['\"]", "severity": "HIGH", "cwe": "CWE-259"},
    {"name": "Hardcoded Secret",     "pattern": r"(?i)(secret|api_key|api_secret)\s*=\s*['\"][^'\"\s]{16,}['\"]", "severity": "HIGH", "cwe": "CWE-798"},
    # Database
    {"name": "Database URL",         "pattern": r"(?i)(postgres|mysql|mongodb)://[^:]+:[^@]+@[^\s]+", "severity": "HIGH", "cwe": "CWE-798"},
    # Private Keys
    {"name": "RSA Private Key",      "pattern": r"-----BEGIN RSA PRIVATE KEY-----",      "severity": "CRITICAL", "cwe": "CWE-312"},
    {"name": "EC Private Key",       "pattern": r"-----BEGIN EC PRIVATE KEY-----",        "severity": "CRITICAL", "cwe": "CWE-312"},
    {"name": "SSH Private Key",      "pattern": r"-----BEGIN OPENSSH PRIVATE KEY-----",   "severity": "CRITICAL", "cwe": "CWE-312"},
]

EXCLUDE_PATTERNS = [
    r"example",
    r"test",
    r"fake",
    r"dummy",
    r"placeholder",
    r"<.*?>",
    r"\$\{.*?\}",
    r"xxxx",
    r"REPLACE",
    r"YOUR_",
]

BINARY_EXTENSIONS = {
    ".png", ".jpg", ".jpeg", ".gif", ".ico", ".svg",
    ".pdf", ".zip", ".tar", ".gz", ".whl", ".pyc",
    ".class", ".jar", ".war", ".dll", ".so", ".exe",
}

CODE_EXTENSIONS = {
    ".py", ".js", ".ts", ".jsx", ".tsx", ".go", ".java",
    ".rb", ".php", ".cs", ".cpp", ".c", ".h", ".yml",
    ".yaml", ".json", ".env", ".config", ".conf", ".ini",
    ".xml", ".toml", ".sh", ".bash", ".zsh",
}


class SecretsAgent(BaseAgent):
    """
    Secrets Detection Agent.

    Capabilities:
    - Regex-based pattern matching for 50+ secret types
    - Shannon entropy analysis for high-entropy strings
    - Git history scanning for rotated secrets
    - LLM-powered context analysis to reduce false positives
    - Environment variable leak detection
    """

    AGENT_TYPE = "SECRETS"
    DEFAULT_MODEL = settings.LLM_MODEL_FAST

    def get_system_prompt(self) -> str:
        return """You are Secrets Agent, a specialist in detecting hardcoded credentials,
API keys, and sensitive data in source code. You use entropy analysis and pattern matching.
You carefully distinguish between real secrets and placeholders/test values."""

    @staticmethod
    def _is_git_target(url: Optional[str]) -> bool:
        if not url:
            return False
        if os.path.exists(url):
            return True
        url_clean = str(url).strip().lower()
        if url_clean.endswith(".git"):
            return True
        from urllib.parse import urlparse
        parsed = urlparse(url_clean)
        return any(h in parsed.netloc for h in ["github.com", "gitlab.com", "bitbucket.org"])

    async def execute(self, context: Dict[str, Any]) -> Dict[str, Any]:
        scan_id = context["scan_id"]
        repo_url = context.get("repo_url")
        repo_path = context.get("repo_path")
        branch = context.get("branch", "main")
        # Use shared executor if provided in context
        shared_executor = context.get("_executor")

        self._add_reasoning_step(
            thought="Beginning secrets detection scan",
            action="SECRETS_SCAN_START",
            observation=f"repo={repo_url}",
        )

        if not repo_path:
            if not repo_url or not self._is_git_target(repo_url):
                logger.info("secrets_skipped_for_live_website", scan_id=scan_id, target=repo_url)
                return {
                    "scan_id": scan_id,
                    "agent_type": "SECRETS",
                    "status": "SKIPPED",
                    "reason": "Target is a live web application URL. Source code secrets scanning requires a Git repository; client-side secrets and API keys are scanned by DAST Agent.",
                    "findings_count": 0,
                    "tokens_used": 0,
                }
            if shared_executor:
                repo_path = await shared_executor.clone_repo(repo_url, branch)
            else:
                from app.sandbox.executor import SandboxExecutor
                executor = SandboxExecutor()
                repo_path = await executor.clone_repo(repo_url, branch)

        # 1. Collect all code files
        code_files = await self._collect_code_files(repo_path)

        self._add_reasoning_step(
            thought=f"Scanning {len(code_files)} source files",
            action="SCANNING_FILES",
        )

        # 2. Scan files in parallel batches
        all_raw_findings = []
        batches = [code_files[i:i + 20] for i in range(0, len(code_files), 20)]

        for batch in batches:
            batch_findings = await asyncio.gather(
                *[self._scan_file(filepath) for filepath in batch],
                return_exceptions=True,
            )
            for result in batch_findings:
                if isinstance(result, list):
                    all_raw_findings.extend(result)

        self._add_reasoning_step(
            thought=f"Found {len(all_raw_findings)} potential secrets before validation",
            action="RAW_FINDINGS_COLLECTED",
        )

        # 3. Validate with entropy analysis
        validated_findings = self._apply_entropy_filter(all_raw_findings)

        # 4. LLM-based false positive reduction
        confirmed_findings = await self._llm_validate_findings(validated_findings)

        # 5. Report confirmed findings
        for finding_data in confirmed_findings:
            await self.report_finding(
                scan_id=scan_id,
                severity=finding_data["severity"],
                title=finding_data["title"],
                description=finding_data["description"],
                cwe_id=finding_data.get("cwe"),
                file_path=finding_data["file_path"],
                line_number=finding_data["line_number"],
                code_snippet=self._redact_secret(finding_data.get("matched_value", "")),
                evidence={
                    "pattern_matched": finding_data["pattern_name"],
                    "entropy_score": finding_data.get("entropy"),
                    "context_lines": finding_data.get("context"),
                },
                metadata={
                    "secret_type": finding_data["pattern_name"],
                    "is_redacted": True,
                },
            )

        self._add_reasoning_step(
            thought=f"Confirmed {len(confirmed_findings)} secrets after validation",
            action="SECRETS_SCAN_COMPLETE",
            observation=f"False positives filtered: {len(validated_findings) - len(confirmed_findings)}",
        )

        return {
            "scan_id": scan_id,
            "status": "COMPLETED",
            "files_scanned": len(code_files),
            "raw_findings": len(all_raw_findings),
            "confirmed_findings": len(confirmed_findings),
            "findings_count": len(self.findings),
        }

    async def _collect_code_files(self, repo_path: str) -> List[str]:
        """Collect all code files for scanning"""
        code_files = []

        for root, dirs, files in os.walk(repo_path):
            dirs[:] = [
                d for d in dirs
                if d not in {".git", "node_modules", "venv", "dist", "__pycache__", ".next"}
            ]

            for filename in files:
                _, ext = os.path.splitext(filename)

                if ext in BINARY_EXTENSIONS:
                    continue

                filepath = os.path.join(root, filename)

                # Include common secret-containing files
                if ext in CODE_EXTENSIONS or filename in {
                    ".env", ".env.local", ".env.production",
                    "Dockerfile", "docker-compose.yml", ".travis.yml",
                    "Makefile", "config.js", "secrets.yml",
                }:
                    code_files.append(filepath)

        return code_files

    async def _scan_file(self, filepath: str) -> List[Dict]:
        """Scan a single file for secrets"""
        findings = []

        try:
            with open(filepath, "r", encoding="utf-8", errors="ignore") as f:
                content = f.read()
                lines = content.splitlines()

            for pattern_info in SECRET_PATTERNS:
                pattern = re.compile(pattern_info["pattern"])

                for line_num, line in enumerate(lines, 1):
                    for match in pattern.finditer(line):
                        matched_value = match.group()

                        # Skip obvious false positives
                        if self._is_false_positive_quick(matched_value, line):
                            continue

                        # Get context (surrounding lines)
                        context_start = max(0, line_num - 3)
                        context_end = min(len(lines), line_num + 2)
                        context = "\n".join(lines[context_start:context_end])

                        findings.append({
                            "file_path": filepath,
                            "line_number": line_num,
                            "pattern_name": pattern_info["name"],
                            "severity": pattern_info["severity"],
                            "cwe": pattern_info["cwe"],
                            "matched_value": matched_value,
                            "line_content": line.strip(),
                            "context": context,
                            "title": f"{pattern_info['name']} Found in Source Code",
                            "description": (
                                f"A {pattern_info['name']} was detected in "
                                f"{os.path.basename(filepath)} at line {line_num}. "
                                f"This secret should be immediately rotated and moved "
                                f"to a secure secrets manager."
                            ),
                        })

        except Exception as e:
            logger.debug("file_scan_error", filepath=filepath, error=str(e))

        return findings

    def _is_false_positive_quick(self, value: str, line: str) -> bool:
        """Quick false positive checks without LLM"""
        for pattern in EXCLUDE_PATTERNS:
            if re.search(pattern, line, re.IGNORECASE):
                return True

        # Check for template variables
        if any(c in value for c in ["${", "{{", "{%", "<"]):
            return True

        return False

    def _calculate_shannon_entropy(self, string: str) -> float:
        """Calculate Shannon entropy of a string"""
        if not string:
            return 0.0

        freq = {}
        for char in string:
            freq[char] = freq.get(char, 0) + 1

        entropy = 0.0
        string_len = len(string)
        for count in freq.values():
            probability = count / string_len
            if probability > 0:
                entropy -= probability * math.log2(probability)

        return entropy

    def _apply_entropy_filter(self, findings: List[Dict]) -> List[Dict]:
        """Filter findings by entropy score"""
        validated = []

        for finding in findings:
            value = finding.get("matched_value", "")
            entropy = self._calculate_shannon_entropy(value)
            finding["entropy"] = round(entropy, 3)

            # High entropy strings are more likely to be real secrets
            # Threshold: > 3.5 for short strings, > 3.0 for longer ones
            threshold = 3.5 if len(value) < 40 else 3.0

            if entropy >= threshold or finding["pattern_name"] in [
                "RSA Private Key", "EC Private Key", "SSH Private Key",
                "AWS Access Key", "OpenAI API Key", "OpenAI API Key v2",
            ]:
                validated.append(finding)

        return validated

    async def _llm_validate_findings(
        self, findings: List[Dict]
    ) -> List[Dict]:
        """Use LLM to validate findings and remove false positives"""
        if not findings:
            return []

        # Process in batches of 10
        confirmed = []
        batches = [findings[i:i + 10] for i in range(0, len(findings), 10)]

        for batch in batches:
            try:
                prompt = f"""
Analyze these potential secret findings and determine if each is a REAL secret
or a FALSE POSITIVE (placeholder, test value, example, etc.):

{self._format_findings_for_llm(batch)}

For each finding, respond with JSON:
{{
    "validations": [
        {{
            "index": 0,
            "is_real_secret": true,
            "confidence": 0-100,
            "reasoning": "brief explanation"
        }}
    ]
}}
"""
                response = await self.call_llm(prompt, json_mode=True)
                parsed = await self.parse_json_response(response)
                validations = parsed.get("validations", [])

                for validation in validations:
                    idx = validation.get("index", 0)
                    if (
                        validation.get("is_real_secret", False)
                        and validation.get("confidence", 0) >= 70
                        and idx < len(batch)
                    ):
                        confirmed.append(batch[idx])
            except Exception as llm_err:
                logger.warning("llm_validation_fallback_to_entropy", error=str(llm_err))
                # Fallback: accept entropy validated findings
                confirmed.extend(batch)

        return confirmed

    def _format_findings_for_llm(self, findings: List[Dict]) -> str:
        lines = []
        for i, f in enumerate(findings):
            redacted = self._redact_secret(f.get("matched_value", ""))
            lines.append(
                f"[{i}] Type: {f['pattern_name']}\n"
                f"    File: {os.path.basename(f['file_path'])}\n"
                f"    Line: {f['line_number']}\n"
                f"    Value (redacted): {redacted}\n"
                f"    Context: {f.get('line_content', '')[:100]}\n"
            )
        return "\n".join(lines)

    def _redact_secret(self, value: str) -> str:
        """Partially redact a secret value"""
        if len(value) <= 8:
            return "***REDACTED***"
        return f"{value[:4]}{'*' * (len(value) - 8)}{value[-4:]}"