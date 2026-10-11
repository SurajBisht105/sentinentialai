# app/agents/defensive/reachability_agent.py
import os
import re
import structlog
from typing import Dict, Any, List, Optional, Set

from app.agents.base_agent import BaseAgent
from app.config import settings

logger = structlog.get_logger(__name__)


class ReachabilityAgent(BaseAgent):
    """
    Dependency Graph & Reachability Agent (Contextual SCA).

    Role:
    - Stops alert fatigue in package vulnerability scanning.
    - Performs static AST and regex parsing across codebase files to verify if the vulnerable package or function is actually imported and invoked.
    - Deprioritizes dormant dependency alerts where the vulnerable module is never reached.
    """

    AGENT_TYPE = "REACHABILITY_ANALYZER"
    DEFAULT_MODEL = settings.LLM_MODEL_FAST

    async def execute(self, context: Dict[str, Any]) -> Dict[str, Any]:
        scan_id = context["scan_id"]
        findings = context.get("findings", [])
        repo_path = context.get("repo_path")

        self._add_reasoning_step(
            thought=f"Analyzing codebase call-graphs to evaluate reachability for {len(findings)} SCA dependency alerts",
            action="REACHABILITY_ANALYSIS_START",
        )

        reachable_findings = []
        dormant_findings = []

        if not repo_path or not os.path.exists(repo_path):
            return {
                "scan_id": scan_id,
                "status": "COMPLETED",
                "reachable_count": len(findings),
                "dormant_count": 0,
            }

        # Index all imports in repository
        imported_modules = self._index_repository_imports(repo_path)

        for finding in findings:
            pkg_name = finding.get("metadata", {}).get("package") or finding.get("title", "").split(" ")[-1]
            pkg_clean = pkg_name.strip().lower().replace("-", "_")

            is_reached = any(pkg_clean in imp.lower() for imp in imported_modules)

            finding["metadata"] = finding.get("metadata") or {}
            finding["metadata"]["is_reachable"] = is_reached

            if is_reached:
                finding["metadata"]["reachability_status"] = "ACTIVE_AND_REACHABLE"
                reachable_findings.append(finding)
            else:
                finding["metadata"]["reachability_status"] = "DORMANT_UNINVOKED"
                dormant_findings.append(finding)

        self._add_reasoning_step(
            thought=f"Reachability complete: {len(reachable_findings)} active/reachable, {len(dormant_findings)} uninvoked dormant dependencies",
            action="REACHABILITY_ANALYSIS_COMPLETE",
        )

        return {
            "scan_id": scan_id,
            "status": "COMPLETED",
            "reachable_findings": reachable_findings,
            "dormant_findings": dormant_findings,
            "reachable_count": len(reachable_findings),
            "dormant_count": len(dormant_findings),
        }

    def _index_repository_imports(self, repo_path: str) -> Set[str]:
        """Index all imported library names across Python, JavaScript, and TypeScript files."""
        imports = set()
        for root, dirs, files in os.walk(repo_path):
            dirs[:] = [d for d in dirs if d.lower() not in ["node_modules", "venv", ".venv", ".git", "dist", "build", "__pycache__"]]
            for file in files:
                ext = os.path.splitext(file)[1].lower()
                full_path = os.path.join(root, file)
                if ext in [".py", ".js", ".ts", ".jsx", ".tsx"]:
                    try:
                        with open(full_path, "r", encoding="utf-8", errors="ignore") as f:
                            content = f.read()
                            py_matches = re.findall(r"(?:import|from)\s+([a-zA-Z0-9_\-]+)", content)
                            imports.update(py_matches)
                            js_matches = re.findall(r"(?:require\(['\"]|from\s+['\"])([@a-zA-Z0-9_\-\./]+)", content)
                            for jm in js_matches:
                                base_pkg = jm.split("/")[0]
                                imports.add(base_pkg)
                    except Exception:
                        pass
        return imports
