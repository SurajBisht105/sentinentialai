# app/agents/defensive/iac_agent.py
from typing import Dict, Any, List
import structlog
import os
import re

from app.agents.base_agent import BaseAgent
from app.config import settings

logger = structlog.get_logger(__name__)


class IaCAgent(BaseAgent):
    """
    Infrastructure as Code Security Review Agent.

    Supports: Terraform, CloudFormation, Kubernetes, Dockerfile,
              Docker Compose, Helm Charts, Ansible, GitHub Actions
    """

    AGENT_TYPE = "IAC"
    DEFAULT_MODEL = settings.LLM_MODEL_REASONING

    IAC_FILES = {
        "terraform": [".tf", ".tfvars"],
        "cloudformation": [".template", ".cfn.yaml", ".cfn.json"],
        "kubernetes": ["k8s", "kubernetes", ".yaml", ".yml"],
        "docker": ["Dockerfile", "docker-compose.yml", "docker-compose.yaml"],
        "helm": ["Chart.yaml", "values.yaml"],
        "ansible": ["playbook.yml", "tasks.yml"],
        "github_actions": [".github/workflows"],
    }

    def get_system_prompt(self) -> str:
        return """You are IaC Security Agent, specializing in Infrastructure as Code security review.
You analyze Terraform, Kubernetes, Dockerfile, and CloudFormation configurations for
misconfigurations, overly permissive access controls, exposed ports, unencrypted storage,
and violations of least-privilege principles. Provide specific, actionable findings."""

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

        if not repo_path:
            if not repo_url or not self._is_git_target(repo_url):
                logger.info("iac_skipped_for_live_website", scan_id=scan_id, target=repo_url)
                return {
                    "scan_id": scan_id,
                    "status": "SKIPPED",
                    "reason": "Target is a live web application URL. Infrastructure as Code (IaC) review requires configuration files from a Git repository or local source folder.",
                    "findings_count": 0,
                }
            if shared_executor:
                repo_path = await shared_executor.clone_repo(repo_url, branch)
            else:
                from app.sandbox.executor import SandboxExecutor
                executor = SandboxExecutor()
                repo_path = await executor.clone_repo(repo_url, branch)

        self._add_reasoning_step(
            thought="Discovering IaC files in repository",
            action="DISCOVER_IAC_FILES",
        )

        iac_files = await self._discover_iac_files(repo_path)

        self._add_reasoning_step(
            thought=f"Found {len(iac_files)} IaC files",
            action="IAC_FILES_FOUND",
            observation=str({k: len(v) for k, v in iac_files.items()}),
        )

        all_findings = []

        # Analyze each type
        analyzers = {
            "terraform": self._analyze_terraform,
            "kubernetes": self._analyze_kubernetes,
            "docker": self._analyze_docker,
            "github_actions": self._analyze_github_actions,
        }

        for iac_type, files in iac_files.items():
            if files and iac_type in analyzers:
                self._add_reasoning_step(
                    thought=f"Analyzing {len(files)} {iac_type} files",
                    action=f"ANALYZE_{iac_type.upper()}",
                )
                type_findings = await analyzers[iac_type](scan_id, files)
                all_findings.extend(type_findings)

        self._add_reasoning_step(
            thought=f"IaC review complete: {len(all_findings)} issues found",
            action="IAC_SCAN_COMPLETE",
        )

        return {
            "scan_id": scan_id,
            "status": "COMPLETED",
            "iac_types_found": list(iac_files.keys()),
            "total_files": sum(len(v) for v in iac_files.values()),
            "findings_count": len(self.findings),
        }

    async def _discover_iac_files(self, repo_path: str) -> Dict[str, List[str]]:
        """Discover all IaC files by type"""
        found = {k: [] for k in self.IAC_FILES}

        for root, dirs, files in os.walk(repo_path):
            dirs[:] = [d for d in dirs if d not in {".git", "node_modules", "venv"}]

            for filename in files:
                filepath = os.path.join(root, filename)

                # Terraform
                if filename.endswith(".tf"):
                    found["terraform"].append(filepath)

                # Kubernetes YAML
                elif filename.endswith((".yaml", ".yml")):
                    with open(filepath, "r", errors="ignore") as f:
                        content = f.read(500)
                    if any(k in content for k in ["apiVersion", "kind: Pod", "kind: Deployment"]):
                        found["kubernetes"].append(filepath)
                    elif "docker-compose" in filename:
                        found["docker"].append(filepath)
                    elif ".github/workflows" in filepath:
                        found["github_actions"].append(filepath)

                # Dockerfile
                elif filename == "Dockerfile" or filename.startswith("Dockerfile."):
                    found["docker"].append(filepath)

        return {k: v for k, v in found.items() if v}

    async def _analyze_terraform(self, scan_id: str, files: List[str]) -> List[Dict]:
        """Analyze Terraform configurations for security issues"""
        findings = []
        if not files:
            return findings

        # Process in batches of 15 files
        for i in range(0, len(files), 15):
            batch = files[i:i + 15]
            combined_tf = ""
            for filepath in batch:
                try:
                    with open(filepath, "r", errors="ignore") as f:
                        combined_tf += f"\n# File: {os.path.basename(filepath)}\n"
                        combined_tf += f.read()
                except Exception:
                    pass

            if not combined_tf:
                continue

            prompt = f"""
Analyze this Terraform configuration for security misconfigurations:

```hcl
{combined_tf[:15000]}
```

Check for:

1. S3 buckets with public access
2. Security groups with 0.0.0.0/0 ingress on all ports
3. RDS instances without encryption
4. IAM policies with wildcard (*) permissions
5. EKS clusters with public endpoint
6. Unencrypted EBS volumes
7. Lambda functions with overly permissive roles
8. KMS keys without rotation enabled
9. CloudTrail disabled
10. VPCs without flow logs

Respond with JSON:
{{
"findings": [
{{
"severity": "CRITICAL|HIGH|MEDIUM|LOW",
"title": "...",
"description": "...",
"resource": "resource type and name",
"line_reference": "file and approximate line",
"remediation": "specific fix",
"cwe_id": "CWE-XXX"
}}
]
}}
"""
            try:
                response = await self.call_llm(prompt, json_mode=True)
                parsed = await self.parse_json_response(response)

                for finding in parsed.get("findings", []):
                    reported = await self.report_finding(
                        scan_id=scan_id,
                        severity=finding["severity"],
                        title=finding["title"],
                        description=finding["description"],
                        cwe_id=finding.get("cwe_id"),
                        file_path=finding.get("line_reference"),
                        evidence={"resource": finding.get("resource")},
                        metadata={
                            "iac_type": "terraform",
                            "remediation": finding.get("remediation"),
                        },
                    )
                    findings.append(reported)
            except Exception as e:
                logger.debug("terraform_analysis_batch_err", error=str(e))

        return findings

    async def _analyze_kubernetes(
        self, scan_id: str, files: List[str]
    ) -> List[Dict]:
        """Analyze Kubernetes manifests for security issues"""
        findings = []
        if not files:
            return findings

        # Process in batches of 10 files
        for i in range(0, len(files), 10):
            batch = files[i:i + 10]
            combined_k8s = ""
            for filepath in batch:
                try:
                    with open(filepath, "r", errors="ignore") as f:
                        combined_k8s += f"\n---\n# {os.path.basename(filepath)}\n"
                        combined_k8s += f.read()
                except Exception:
                    pass

            if not combined_k8s:
                continue

            prompt = f"""
Analyze these Kubernetes manifests for security misconfigurations:
{combined_k8s[:15000]}

Check for:

1. Containers running as root (runAsUser: 0)
2. Privileged containers
3. Host network/PID/IPC sharing
4. Missing resource limits
5. Missing security contexts
6. Containers with allowPrivilegeEscalation: true
7. Secrets in environment variables
8. Missing NetworkPolicies
9. RBAC with wildcard permissions
10. Writable root filesystem

Respond with JSON:
{{
"findings": [
{{
"severity": "CRITICAL|HIGH|MEDIUM|LOW",
"title": "...",
"description": "...",
"resource_name": "deployment/pod name",
"cwe_id": "CWE-XXX",
"remediation": "specific fix"
}}
]
}}
"""
        response = await self.call_llm(prompt, json_mode=True)
        parsed = await self.parse_json_response(response)

        for finding in parsed.get("findings", []):
            reported = await self.report_finding(
                scan_id=scan_id,
                severity=finding["severity"],
                title=finding["title"],
                description=finding["description"],
                cwe_id=finding.get("cwe_id"),
                evidence={"k8s_resource": finding.get("resource_name")},
                metadata={
                    "iac_type": "kubernetes",
                    "remediation": finding.get("remediation"),
                },
            )
            findings.append(reported)

        return findings

    async def _analyze_docker(self, scan_id: str, files: List[str]) -> List[Dict]:
        """Analyze Dockerfile and docker-compose for security issues"""
        findings = []

        for filepath in files:
            try:
                with open(filepath, "r", errors="ignore") as f:
                    content = f.read()
            except Exception:
                continue

            is_dockerfile = "Dockerfile" in os.path.basename(filepath)

            if is_dockerfile:
                findings.extend(
                    await self._check_dockerfile(scan_id, content, filepath)
                )
            else:
                findings.extend(
                    await self._check_docker_compose(scan_id, content, filepath)
                )

        return findings

    async def _check_dockerfile(
        self, scan_id: str, content: str, filepath: str
    ) -> List[Dict]:
        """Check Dockerfile for security issues"""
        findings = []
        lines = content.splitlines()

        checks = [
            {
                "pattern": r"^FROM\s+\S+:latest",
                "severity": "MEDIUM",
                "title": "Dockerfile Uses 'latest' Tag",
                "description": "Using 'latest' tag makes builds non-reproducible and can introduce vulnerable versions.",
                "cwe": "CWE-1104",
            },
            {
                "pattern": r"^USER root",
                "severity": "HIGH",
                "title": "Container Runs as Root",
                "description": "Running containers as root increases risk if container is compromised.",
                "cwe": "CWE-250",
            },
            {
                "pattern": r"(?i)(password|secret|api_key)\s*=\s*\S+",
                "severity": "CRITICAL",
                "title": "Secret in Dockerfile",
                "description": "Hardcoded secret in Dockerfile will be embedded in image layers.",
                "cwe": "CWE-798",
            },
            {
                "pattern": r"RUN\s+.*curl\s+.*\|\s*(sh|bash)",
                "severity": "HIGH",
                "title": "Remote Script Execution in Dockerfile",
                "description": "Piping remote scripts to shell is dangerous and can introduce supply chain attacks.",
                "cwe": "CWE-494",
            },
            {
                "pattern": r"--no-check-certificate|--insecure|-k\s",
                "severity": "MEDIUM",
                "title": "SSL Verification Disabled",
                "description": "Disabling SSL certificate verification enables MITM attacks.",
                "cwe": "CWE-295",
            },
        ]

        for line_num, line in enumerate(lines, 1):
            for check in checks:
                if re.search(check["pattern"], line, re.IGNORECASE):
                    reported = await self.report_finding(
                        scan_id=scan_id,
                        severity=check["severity"],
                        title=check["title"],
                        description=check["description"],
                        cwe_id=check["cwe"],
                        file_path=filepath,
                        line_number=line_num,
                        code_snippet=line.strip(),
                        metadata={"iac_type": "docker"},
                    )
                    findings.append(reported)

        return findings

    async def _check_docker_compose(
        self, scan_id: str, content: str, filepath: str
    ) -> List[Dict]:
        """Check docker-compose for security issues"""
        findings = []

        dangerous_patterns = [
            (r"privileged:\s*true",    "CRITICAL", "Privileged Container in Docker Compose",    "CWE-250"),
            (r"network_mode:\s*host",  "HIGH",     "Host Network Mode Enabled",                  "CWE-668"),
            (r"pid:\s*host",           "HIGH",     "Host PID Namespace Shared",                   "CWE-668"),
            (r"/var/run/docker.sock",  "CRITICAL", "Docker Socket Mounted in Container",         "CWE-250"),
        ]

        for pattern, severity, title, cwe in dangerous_patterns:
            if re.search(pattern, content, re.IGNORECASE):
                reported = await self.report_finding(
                    scan_id=scan_id,
                    severity=severity,
                    title=title,
                    description=f"Security misconfiguration detected in docker-compose: {title}",
                    cwe_id=cwe,
                    file_path=filepath,
                    metadata={"iac_type": "docker_compose"},
                )
                findings.append(reported)

        return findings

    async def _analyze_github_actions(
        self, scan_id: str, files: List[str]
    ) -> List[Dict]:
        """Analyze GitHub Actions workflows for security issues"""
        findings = []

        for filepath in files:
            try:
                with open(filepath, "r", errors="ignore") as f:
                    content = f.read()
            except Exception:
                continue

            # Check for script injection via context expressions
            if re.search(r"\$\{\{\s*github\.(event|actor|head_commit)", content):
                reported = await self.report_finding(
                    scan_id=scan_id,
                    severity="HIGH",
                    title="GitHub Actions Script Injection Risk",
                    description=(
                        "Using github context values directly in run steps can lead to "
                        "script injection if triggered by an attacker-controlled event."
                    ),
                    cwe_id="CWE-77",
                    file_path=filepath,
                    metadata={"iac_type": "github_actions"},
                )
                findings.append(reported)

            # Check for overly permissive write permissions
            if re.search(r"permissions:\s*write-all", content):
                reported = await self.report_finding(
                    scan_id=scan_id,
                    severity="HIGH",
                    title="GitHub Actions Overly Permissive Permissions",
                    description="Workflow has write-all permissions which violates least-privilege.",
                    cwe_id="CWE-732",
                    file_path=filepath,
                    metadata={"iac_type": "github_actions"},
                )
                findings.append(reported)

            # Check for pinned actions
            if re.search(r"uses:\s+\S+@(?!sha)", content):
                reported = await self.report_finding(
                    scan_id=scan_id,
                    severity="MEDIUM",
                    title="GitHub Action Not Pinned to SHA",
                    description=(
                        "Actions should be pinned to a full commit SHA to prevent "
                        "supply chain attacks via tag mutation."
                    ),
                    cwe_id="CWE-494",
                    file_path=filepath,
                    metadata={"iac_type": "github_actions"},
                )
                findings.append(reported)

        return findings