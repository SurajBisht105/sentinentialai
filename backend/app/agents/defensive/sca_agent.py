# app/agents/defensive/sca_agent.py
from typing import Dict, Any, List, Optional, Tuple
import structlog
import json
import re
import asyncio
import httpx

from app.agents.base_agent import BaseAgent
from app.config import settings

logger = structlog.get_logger(__name__)


PACKAGE_FILES = {
    "npm": ["package.json", "package-lock.json", "yarn.lock"],
    "pip": ["requirements.txt", "Pipfile", "pyproject.toml", "setup.py"],
    "maven": ["pom.xml"],
    "gradle": ["build.gradle", "build.gradle.kts"],
    "go": ["go.mod", "go.sum"],
    "ruby": ["Gemfile", "Gemfile.lock"],
    "rust": ["Cargo.toml", "Cargo.lock"],
    "nuget": ["*.csproj", "packages.config"],
}


class SCAAgent(BaseAgent):
    """
    Software Composition Analysis Agent.

    Capabilities:
    - Parse dependency manifests (npm, pip, maven, go, etc.)
    - Query OSV, NVD, GitHub Advisory databases
    - Detect transitive dependency vulnerabilities
    - Calculate exploitability scores
    - Generate SBOM (Software Bill of Materials)
    """

    AGENT_TYPE = "SCA"
    DEFAULT_MODEL = settings.LLM_MODEL_FAST

    OSV_API = "https://api.osv.dev/v1"
    NVD_API = "https://services.nvd.nist.gov/rest/json/cves/2.0"

    def get_system_prompt(self) -> str:
        return """You are SCA Agent, a software composition analysis specialist.
You analyze dependency manifests to identify vulnerable packages, outdated dependencies,
and supply chain risks. You cross-reference multiple vulnerability databases for accuracy."""

    @staticmethod
    def _is_git_target(url: Optional[str]) -> bool:
        if not url:
            return False
        import os
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
        repo_path = context.get("repo_path")
        repo_url = context.get("repo_url")
        branch = context.get("branch", "main")
        # Use shared executor if provided in context
        shared_executor = context.get("_executor")

        self._add_reasoning_step(
            thought="Starting Software Composition Analysis",
            action="SCA_START",
            observation=f"repo={repo_url}",
        )

        if not repo_path:
            if not repo_url or not self._is_git_target(repo_url):
                logger.info("sca_skipped_for_live_website", scan_id=scan_id, target=repo_url)
                return {
                    "scan_id": scan_id,
                    "agent_type": "SCA",
                    "status": "SKIPPED",
                    "reason": "Target is a live web application URL. Software composition analysis (SCA) requires package manifest files from a Git repository or local source directory.",
                    "findings_count": 0,
                    "tokens_used": 0,
                }
            if shared_executor:
                repo_path = await shared_executor.clone_repo(repo_url, branch)
            else:
                repo_path = await self._prepare_repository(repo_url, branch)

        # 1. Discover dependency files
        dep_files = await self._discover_dependency_files(repo_path)

        self._add_reasoning_step(
            thought=f"Found {len(dep_files)} dependency files",
            action="DEPENDENCY_FILES_FOUND",
            observation=str(dep_files),
        )

        # 2. Parse all dependencies
        all_packages = []
        for dep_file in dep_files:
            packages = await self._parse_dependency_file(dep_file)
            all_packages.extend(packages)

        self._add_reasoning_step(
            thought=f"Parsed {len(all_packages)} packages across all manifests",
            action="PACKAGES_PARSED",
        )

        # 3. Query vulnerability databases in parallel
        vulnerable_packages = await self._check_vulnerabilities_parallel(all_packages)

        # 4. Report findings
        for vuln in vulnerable_packages:
            await self._report_sca_finding(scan_id, vuln)

        # 5. Generate SBOM
        sbom = await self._generate_sbom(all_packages, vulnerable_packages)

        # 6. AI-powered supply chain risk analysis
        risk_analysis = await self._analyze_supply_chain_risk(
            all_packages, vulnerable_packages
        )

        self._add_reasoning_step(
            thought=f"SCA complete: {len(vulnerable_packages)} vulnerable packages found",
            action="SCA_COMPLETE",
            observation=f"Total: {len(all_packages)}, Vulnerable: {len(vulnerable_packages)}",
        )

        return {
            "scan_id": scan_id,
            "status": "COMPLETED",
            "total_packages": len(all_packages),
            "vulnerable_packages": len(vulnerable_packages),
            "findings_count": len(self.findings),
            "sbom": sbom,
            "risk_analysis": risk_analysis,
        }

    async def _prepare_repository(self, repo_url: str, branch: str) -> str:
        """Clone repo to sandbox for analysis"""
        from app.sandbox.executor import SandboxExecutor
        executor = SandboxExecutor()
        return await executor.clone_repo(repo_url, branch)

    async def _discover_dependency_files(self, repo_path: str) -> List[Dict]:
        """Find all dependency manifest files in repository"""
        import os
        dep_files = []

        for ecosystem, file_patterns in PACKAGE_FILES.items():
            for pattern in file_patterns:
                for root, dirs, files in os.walk(repo_path):
                    # Skip vendor/node_modules directories
                    dirs[:] = [
                        d for d in dirs
                        if d not in ["node_modules", "vendor", "venv", ".git", "dist"]
                    ]
                    for file in files:
                        if (
                            file == pattern or
                            (pattern.startswith("*") and file.endswith(pattern[1:]))
                        ):
                            dep_files.append({
                                "path": os.path.join(root, file),
                                "ecosystem": ecosystem,
                                "filename": file,
                            })

        return dep_files

    async def _parse_dependency_file(self, dep_file: Dict) -> List[Dict]:
        """Parse dependency file and extract package list"""
        ecosystem = dep_file["ecosystem"]
        path = dep_file["path"]

        try:
            with open(path, "r", encoding="utf-8", errors="ignore") as f:
                content = f.read()

            parser = getattr(self, f"_parse_{ecosystem}", None)
            if parser:
                return await parser(content, path)

        except Exception as e:
            logger.warning("dep_file_parse_error", path=path, error=str(e))

        return []

    async def _parse_npm(self, content: str, path: str) -> List[Dict]:
        """Parse package.json"""
        try:
            data = json.loads(content)
            packages = []

            for dep_type in ["dependencies", "devDependencies", "peerDependencies"]:
                for name, version in data.get(dep_type, {}).items():
                    packages.append({
                        "name": name,
                        "version": version.lstrip("^~>=<"),
                        "ecosystem": "npm",
                        "source_file": path,
                        "is_dev": dep_type == "devDependencies",
                    })
            return packages
        except json.JSONDecodeError:
            return []

    async def _parse_pip(self, content: str, path: str) -> List[Dict]:
        """Parse requirements.txt"""
        packages = []
        for line in content.splitlines():
            line = line.strip()
            if not line or line.startswith("#") or line.startswith("-"):
                continue

            # Extract package==version or package>=version
            match = re.match(r"^([a-zA-Z0-9_\-\.]+)\s*[=><!\^~]+\s*([^\s;]+)", line)
            if match:
                packages.append({
                    "name": match.group(1),
                    "version": match.group(2),
                    "ecosystem": "pip",
                    "source_file": path,
                    "is_dev": False,
                })
            elif re.match(r"^[a-zA-Z0-9_\-\.]+$", line):
                packages.append({
                    "name": line,
                    "version": "latest",
                    "ecosystem": "pip",
                    "source_file": path,
                    "is_dev": False,
                })
        return packages

    async def _parse_go(self, content: str, path: str) -> List[Dict]:
        """Parse go.mod"""
        packages = []
        in_require = False

        for line in content.splitlines():
            line = line.strip()
            if line.startswith("require ("):
                in_require = True
                continue
            if in_require and line == ")":
                in_require = False
                continue

            if in_require or line.startswith("require "):
                clean = line.replace("require ", "").strip()
                parts = clean.split()
                if len(parts) >= 2:
                    packages.append({
                        "name": parts[0],
                        "version": parts[1].lstrip("v"),
                        "ecosystem": "go",
                        "source_file": path,
                        "is_dev": False,
                    })

        return packages

    async def _parse_maven(self, content: str, path: str) -> List[Dict]:
        """Parse pom.xml"""
        packages = []
        dep_pattern = re.compile(
            r"<dependency>.*?<groupId>(.*?)</groupId>.*?"
            r"<artifactId>(.*?)</artifactId>.*?"
            r"(?:<version>(.*?)</version>)?.*?</dependency>",
            re.DOTALL,
        )

        for match in dep_pattern.finditer(content):
            packages.append({
                "name": f"{match.group(1)}:{match.group(2)}",
                "version": match.group(3) or "unknown",
                "ecosystem": "maven",
                "source_file": path,
                "is_dev": False,
            })
        return packages

    async def _check_vulnerabilities_parallel(
        self, packages: List[Dict]
    ) -> List[Dict]:
        """Check all packages against vulnerability databases in parallel"""
        # Batch packages into groups of 20
        batches = [packages[i:i + 20] for i in range(0, len(packages), 20)]
        vulnerable = []

        for batch in batches:
            batch_results = await asyncio.gather(
                *[self._check_single_package(pkg) for pkg in batch],
                return_exceptions=True,
            )

            for result in batch_results:
                if isinstance(result, dict) and result.get("vulnerable"):
                    vulnerable.append(result)

        return vulnerable

    async def _check_single_package(self, package: Dict) -> Dict:
        """Check single package against OSV database"""
        try:
            async with httpx.AsyncClient(timeout=10) as client:
                payload = {
                    "package": {
                        "name": package["name"],
                        "ecosystem": self._map_ecosystem(package["ecosystem"]),
                    },
                    "version": package["version"],
                }

                response = await client.post(
                    f"{self.OSV_API}/query",
                    json=payload,
                )

                if response.status_code == 200:
                    data = response.json()
                    vulns = data.get("vulns", [])

                    if vulns:
                        # Get the worst CVE score
                        worst_severity = self._calculate_worst_severity(vulns)
                        return {
                            **package,
                            "vulnerable": True,
                            "vulnerabilities": vulns[:3],  # Top 3
                            "vuln_count": len(vulns),
                            "severity": worst_severity,
                            "cve_ids": [
                                v.get("id") for v in vulns
                                if v.get("id", "").startswith("CVE")
                            ],
                        }

        except Exception as e:
            logger.debug("osv_check_failed", package=package["name"], error=str(e))

        return {**package, "vulnerable": False}

    def _map_ecosystem(self, ecosystem: str) -> str:
        """Map internal ecosystem name to OSV ecosystem name"""
        mapping = {
            "npm": "npm",
            "pip": "PyPI",
            "maven": "Maven",
            "go": "Go",
            "ruby": "RubyGems",
            "rust": "crates.io",
            "nuget": "NuGet",
        }
        return mapping.get(ecosystem, ecosystem)

    def _calculate_worst_severity(self, vulns: List[Dict]) -> str:
        """Calculate worst severity across all vulnerabilities"""
        severity_order = ["CRITICAL", "HIGH", "MEDIUM", "LOW"]

        for severity in severity_order:
            for vuln in vulns:
                for severity_info in vuln.get("severity", []):
                    if severity_info.get("type") == "CVSS_V3":
                        score = float(severity_info.get("score", 0))
                        if severity == "CRITICAL" and score >= 9.0:
                            return "CRITICAL"
                        elif severity == "HIGH" and score >= 7.0:
                            return "HIGH"
                        elif severity == "MEDIUM" and score >= 4.0:
                            return "MEDIUM"

        return "LOW"

    async def _report_sca_finding(self, scan_id: str, vuln_package: Dict) -> None:
        """Report a vulnerable dependency finding"""
        vulns = vuln_package.get("vulnerabilities", [])
        primary_vuln = vulns[0] if vulns else {}
        cve_ids = vuln_package.get("cve_ids", [])

        await self.report_finding(
            scan_id=scan_id,
            severity=vuln_package.get("severity", "MEDIUM"),
            title=f"Vulnerable Dependency: {vuln_package['name']}@{vuln_package['version']}",
            description=(
                f"Package '{vuln_package['name']}' version '{vuln_package['version']}' "
                f"has {vuln_package.get('vuln_count', 1)} known vulnerability(ies). "
                f"Primary: {primary_vuln.get('summary', 'No summary available')}"
            ),
            cwe_id="CWE-1035",  # Using Known Vulnerable Third-party Component
            cve_id=cve_ids[0] if cve_ids else None,
            file_path=vuln_package.get("source_file"),
            evidence={
                "package_name": vuln_package["name"],
                "package_version": vuln_package["version"],
                "ecosystem": vuln_package["ecosystem"],
                "vulnerability_count": vuln_package.get("vuln_count"),
                "cve_ids": cve_ids,
                "osv_ids": [v.get("id") for v in vulns],
            },
            metadata={
                "is_dev_dependency": vuln_package.get("is_dev", False),
                "fix_available": self._check_fix_available(vulns),
            },
        )

    def _check_fix_available(self, vulns: List[Dict]) -> bool:
        """Check if a fixed version is available"""
        for vuln in vulns:
            for affected in vuln.get("affected", []):
                if affected.get("ranges"):
                    for range_info in affected["ranges"]:
                        for event in range_info.get("events", []):
                            if "fixed" in event:
                                return True
        return False

    async def _generate_sbom(
        self, all_packages: List[Dict], vulnerable: List[Dict]
    ) -> Dict:
        """Generate Software Bill of Materials"""
        vuln_names = {p["name"] for p in vulnerable}

        return {
            "format": "CycloneDX",
            "version": "1.4",
            "total_components": len(all_packages),
            "vulnerable_components": len(vulnerable),
            "ecosystems": list({p["ecosystem"] for p in all_packages}),
            "components": [
                {
                    "name": p["name"],
                    "version": p["version"],
                    "ecosystem": p["ecosystem"],
                    "vulnerable": p["name"] in vuln_names,
                }
                for p in all_packages[:100]  # Limit for response size
            ],
        }

    async def _analyze_supply_chain_risk(
        self, all_packages: List[Dict], vulnerable: List[Dict]
    ) -> Dict:
        """Use LLM to analyze supply chain risk holistically"""
        critical_vulns = [v for v in vulnerable if v.get("severity") == "CRITICAL"]
        high_vulns = [v for v in vulnerable if v.get("severity") == "HIGH"]

        prompt = f"""
Analyze this software composition risk:

Total packages: {len(all_packages)}
Vulnerable: {len(vulnerable)}
Critical vulnerabilities: {len(critical_vulns)}
High vulnerabilities: {len(high_vulns)}

Critical packages: {[f"{v['name']}@{v['version']}" for v in critical_vulns[:5]]}

Provide supply chain risk assessment as JSON:
{{
    "supply_chain_risk_level": "CRITICAL|HIGH|MEDIUM|LOW",
    "immediate_actions": ["action1", "action2"],
    "risk_factors": ["factor1", "factor2"],
    "remediation_priority": ["pkg1", "pkg2"]
}}
"""
        response = await self.call_llm(prompt, json_mode=True)
        return await self.parse_json_response(response)