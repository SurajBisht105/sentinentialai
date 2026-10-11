# app/agents/sast_agent.py
from typing import Dict, Any, List
import structlog
import hashlib
import os
import re
import asyncio

from app.agents.base_agent import BaseAgent
from app.config import settings
from app.services.finding_service import FindingService

logger = structlog.get_logger(__name__)


class SASTAgent(BaseAgent):
    """
    SAST Agent - Static Application Security Testing
    Analyzes source code for security vulnerabilities
    """

    AGENT_TYPE = "SAST"

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

        logger.info("sast_agent_started", scan_id=scan_id, repo_url=repo_url, repo_path=repo_path)

        # If repo_path not provided, check if repo_url is a cloneable git repository
        if not repo_path:
            if not repo_url or not self._is_git_target(repo_url):
                logger.info("sast_skipped_for_live_website", scan_id=scan_id, target=repo_url)
                return {
                    "scan_id": scan_id,
                    "agent_type": "SAST",
                    "status": "SKIPPED",
                    "reason": "Target is a live web application URL. Source code analysis (SAST) requires a Git repository or local source folder; dynamic security audit is conducted by DAST Agent.",
                    "findings": [],
                    "tokens_used": 0,
                }
            if shared_executor:
                repo_path = await shared_executor.clone_repo(repo_url, branch)
            else:
                repo_path = await self.clone_repository(repo_url, branch)
        elif not repo_path:
            raise ValueError("Either repo_url or repo_path must be provided")

        # Analyze source files
        findings = await self.analyze_code(repo_path, shared_executor)

        # Create finding records
        created_findings = []
        for finding in findings:
            created = await self.report_finding(
                scan_id=scan_id,
                severity=finding.get("severity", "MEDIUM"),
                title=finding.get("title", "Security Finding"),
                description=finding.get("description", "Vulnerability detected in source code"),
                cwe_id=finding.get("cwe_id"),
                file_path=finding.get("file_path"),
                line_number=finding.get("line_number"),
                metadata=finding.get("metadata", {}),
            )
            created_findings.append(created)

        logger.info(
            "sast_analysis_completed",
            scan_id=scan_id,
            findings_count=len(created_findings),
            tokens_used=self.tokens_used,
        )

        return {
            "scan_id": scan_id,
            "agent_type": "SAST",
            "status": "COMPLETED",
            "findings": created_findings,
            "tokens_used": self.tokens_used,
        }

    async def clone_repository(self, repo_url: str, branch: str) -> str:
        """
        Clone repository to secure sandbox
        """
        from app.sandbox.executor import SandboxExecutor

        executor = SandboxExecutor()
        return await executor.clone_repo(repo_url, branch)

    # High-confidence static security rules for multi-language SAST
    STATIC_PATTERNS = [
        # Command Injection (CWE-78)
        {"pattern": r"(?:os\.system|subprocess\.Popen|subprocess\.call|subprocess\.run)\s*\(\s*(?:f['\"]|.*\+|.*%|f?['\"].*format)", "severity": "CRITICAL", "title": "Command Injection via Unsanitized Input", "cwe": "CWE-78", "desc": "Passing dynamically formatted strings to system shell execution functions allows arbitrary remote command execution."},
        {"pattern": r"(?:exec|eval|child_process\.exec|child_process\.execSync)\s*\(\s*(?:`|.*\+|.*concat)", "severity": "CRITICAL", "title": "Arbitrary Code Execution via eval/exec", "cwe": "CWE-94", "desc": "Dynamic code evaluation via eval() or exec() with user-controlled input allows remote code execution."},
        
        # SQL Injection (CWE-89)
        {"pattern": r"(?:execute|cursor\.execute|rawQuery|query)\s*\(\s*(?:f['\"](?:SELECT|INSERT|UPDATE|DELETE)|['\"](?:SELECT|INSERT|UPDATE|DELETE).*\+)", "severity": "CRITICAL", "title": "SQL Injection via String Concatenation", "cwe": "CWE-89", "desc": "Constructing SQL queries using string concatenation or f-strings instead of parameterized queries enables SQL Injection."},
        
        # Path Traversal (CWE-22)
        {"pattern": r"(?:open|readFile|readFileSync|createReadStream)\s*\(\s*(?:request\.|req\.query|req\.params|req\.body|os\.path\.join\([^)]*request)", "severity": "HIGH", "title": "Path Traversal via Unvalidated File Path", "cwe": "CWE-22", "desc": "Accessing files using unvalidated user input directly in file path operations permits unauthorized file reading/writing."},
        
        # Insecure Cryptography (CWE-327 / CWE-328)
        {"pattern": r"(?:hashlib\.md5|hashlib\.sha1|crypto\.createHash\(['\"]md5['\"]|crypto\.createHash\(['\"]sha1['\"])", "severity": "MEDIUM", "title": "Use of Broken Cryptographic Hash (MD5/SHA1)", "cwe": "CWE-328", "desc": "MD5 and SHA-1 have known collision vulnerabilities and should not be used for secure hashing or password verification."},
        
        # Insecure Deserialization (CWE-502)
        {"pattern": r"(?:pickle\.loads|yaml\.load\([^,)]+\)|serialize\.unserialize)", "severity": "CRITICAL", "title": "Insecure Deserialization", "cwe": "CWE-502", "desc": "Deserializing untrusted data with pickle or unsafe yaml.load allows arbitrary object instantiation and code execution."},
        
        # Cross-Site Scripting (CWE-79)
        {"pattern": r"(?:dangerouslySetInnerHTML|innerHTML\s*=|document\.write\s*\(|res\.send\s*\(.*<[a-z])", "severity": "HIGH", "title": "Cross-Site Scripting (XSS) via Unescaped Rendering", "cwe": "CWE-79", "desc": "Directly assigning user-controlled input to innerHTML or dangerouslySetInnerHTML leads to client-side script injection."},
        
        # Hardcoded Secrets (CWE-798)
        {"pattern": r"(?i)(?:jwt_secret|secret_key|api_key|private_key)\s*=\s*['\"][A-Za-z0-9_\-+=]{16,}['\"]", "severity": "HIGH", "title": "Hardcoded Secret / API Key in Source Code", "cwe": "CWE-798", "desc": "Hardcoded credentials in source code can be extracted from repositories or compiled artifacts."},
    ]

    async def analyze_code(self, repo_path: str, shared_executor=None) -> List[Dict[str, Any]]:
        """
        Analyze source code for vulnerabilities using static pattern matching and LLM verification.
        """
        source_files = await self.get_source_files(repo_path, shared_executor)
        findings = []
        seen_keys = set()

        # 1. Fast, high-confidence static rule scanning across all source files
        for file_path in source_files:
            try:
                content = await self.read_file(file_path, shared_executor)
                if not content:
                    continue
                
                lines = content.splitlines()
                for line_idx, line in enumerate(lines, 1):
                    for rule in self.STATIC_PATTERNS:
                        import re
                        if re.search(rule["pattern"], line):
                            dedup_key = f"{rule['cwe']}:{file_path}:{line_idx}"
                            if dedup_key not in seen_keys:
                                seen_keys.add(dedup_key)
                                rel_path = os.path.relpath(file_path, repo_path) if repo_path in file_path else file_path
                                findings.append({
                                    "severity": rule["severity"],
                                    "title": rule["title"],
                                    "description": f"{rule['desc']} Detected in {os.path.basename(file_path)} at line {line_idx}.",
                                    "cwe_id": rule["cwe"],
                                    "file_path": rel_path,
                                    "line_number": line_idx,
                                    "metadata": {
                                        "code_snippet": line.strip()[:200],
                                        "rule_type": "STATIC_PATTERN",
                                    }
                                })
            except Exception as read_err:
                logger.debug("sast_static_scan_file_err", file=file_path, error=str(read_err))

        # 2. Targeted LLM Deep-Analysis over file batches
        target_batches = self.batch_files(source_files, batch_size=4)
        for file_batch in target_batches:
            file_contents = []
            for file_path in file_batch:
                try:
                    content = await self.read_file(file_path, shared_executor)
                    if content:
                        truncated = "\n".join(content.splitlines()[:500])[:8000]
                        rel_path = os.path.relpath(file_path, repo_path) if repo_path in file_path else file_path
                        file_contents.append({"path": rel_path, "content": truncated})
                except Exception:
                    pass

            if not file_contents:
                continue

            prompt = self.create_sast_prompt(file_contents)
            try:
                response = await asyncio.wait_for(
                    self.call_llm(
                        prompt,
                        system_prompt=self.get_sast_system_prompt(),
                        model=settings.LLM_MODEL_FAST,
                    ),
                    timeout=30.0,
                )
                batch_findings = self.parse_findings(response, repo_path)
                for f in batch_findings:
                    dedup_key = f"{f.get('cwe_id')}:{f.get('file_path')}:{f.get('line_number')}"
                    if dedup_key not in seen_keys:
                        seen_keys.add(dedup_key)
                        findings.append(f)
            except (asyncio.TimeoutError, Exception) as llm_err:
                logger.debug("sast_llm_batch_skipped", error=str(llm_err))

        return findings

    def get_sast_system_prompt(self) -> str:
        return """
You are an expert Static Application Security Testing (SAST) agent.
Analyze the provided source code for security vulnerabilities.

For each finding, provide:
1. Severity (CRITICAL, HIGH, MEDIUM, LOW, INFO)
2. Vulnerability type (SQLi, XSS, RCE, etc.)
3. CWE ID if applicable
4. File path and line number
5. Clear description
6. Evidence from code

Be precise and avoid false positives. Only report confirmed vulnerabilities.
"""

    def create_sast_prompt(self, file_contents: List[Dict]) -> str:
        prompt = "Analyze the following source files for security vulnerabilities:\n\n"
        for file in file_contents:
            prompt += f"### File: {file['path']}\n```{self.get_language(file['path'])}\n{file['content']}\n```\n\n"
        prompt += "\nReport all security findings in JSON format."
        return prompt

    def get_language(self, file_path: str) -> str:
        ext_map = {
            ".py": "python",
            ".js": "javascript",
            ".ts": "typescript",
            ".java": "java",
            ".go": "go",
            ".rb": "ruby",
        }
        import os
        _, ext = os.path.splitext(file_path)
        return ext_map.get(ext, "text")

    def batch_files(self, files: List[str], batch_size: int) -> List[List[str]]:
        return [files[i:i + batch_size] for i in range(0, len(files), batch_size)]

    async def read_file(self, file_path: str, shared_executor=None) -> str:
        """Read file content from sandbox or local filesystem"""
        if os.path.exists(file_path) and os.path.isfile(file_path):
            try:
                with open(file_path, "r", encoding="utf-8", errors="ignore") as f:
                    return f.read()
            except Exception:
                return ""
        if shared_executor:
            return await shared_executor.read_file(file_path)
        from app.sandbox.executor import SandboxExecutor
        executor = SandboxExecutor()
        return await executor.read_file(file_path)

    async def get_source_files(self, repo_path: str, shared_executor=None) -> List[str]:
        """Get list of source files to analyze"""
        if shared_executor:
            return await shared_executor.list_source_files(repo_path)
        from app.sandbox.executor import SandboxExecutor
        executor = SandboxExecutor()
        return await executor.list_source_files(repo_path)

    def parse_findings(self, response: str, repo_path: str) -> List[Dict[str, Any]]:
        """Parse LLM response into structured findings"""
        import json
        import re

        candidates = [response.strip()]
        fenced_match = re.search(r"```(?:json)?\s*([\s\S]*?)\s*```", response)
        if fenced_match:
            candidates.insert(0, fenced_match.group(1).strip())

        data = None
        for candidate in candidates:
            try:
                data = json.loads(candidate)
                break
            except json.JSONDecodeError:
                decoder = json.JSONDecoder()
                for index, character in enumerate(candidate):
                    if character not in "[{":
                        continue
                    try:
                        data, _ = decoder.raw_decode(candidate[index:])
                        break
                    except json.JSONDecodeError:
                        continue
                if data is not None:
                    break

        if isinstance(data, dict):
            findings = data.get("findings", [])
        elif isinstance(data, list):
            findings = data
        else:
            logger.warning("sast_json_parse_failed", response_length=len(response))
            return []

        if not isinstance(findings, list):
            logger.warning("sast_json_findings_invalid", response_length=len(response))
            return []

        for finding in findings:
            if isinstance(finding, dict):
                finding["file_path"] = f"{repo_path}/{finding.get('file_path', '')}"

        return [finding for finding in findings if isinstance(finding, dict)]