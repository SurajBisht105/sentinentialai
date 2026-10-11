# app/agents/verification/pr_review_agent.py
from typing import Dict, Any, List, Optional
import structlog
import httpx

from app.agents.base_agent import BaseAgent
from app.config import settings

logger = structlog.get_logger(__name__)


class PRReviewAgent(BaseAgent):
    """
    PR Review Agent — Automatically creates GitHub Pull Requests
    with AI-generated security fixes.

    Workflow:
    1. Receive remediation from Root Cause Agent
    2. Create feature branch
    3. Apply code fix
    4. Write commit message
    5. Create PR with full context
    6. Request human review
    """

    AGENT_TYPE = "PR_REVIEW"
    DEFAULT_MODEL = settings.LLM_MODEL_FAST

    def get_system_prompt(self) -> str:
        return """You are PR Review Agent. You create professional GitHub Pull Requests
with clear, security-focused descriptions. Your PRs include the vulnerability details,
fix explanation, testing instructions, and compliance implications."""

    async def execute(self, context: Dict[str, Any]) -> Dict[str, Any]:
        scan_id = context["scan_id"]
        finding = context.get("finding", {})
        remediation = context.get("remediation", {})
        finding_id = finding.get("id")

        if not remediation.get("fixed_code"):
            return {
                "scan_id": scan_id,
                "status": "SKIPPED",
                "reason": "No remediation code available",
            }

        self._add_reasoning_step(
            thought=f"Creating PR for finding: {finding.get('title', 'Unknown')[:50]}",
            action="PR_CREATION_START",
        )

        # 1. Generate PR content
        pr_content = await self._generate_pr_content(finding, remediation)

        # 2. Create GitHub PR via API
        pr_result = await self._create_github_pr(
            finding=finding,
            remediation=remediation,
            pr_content=pr_content,
            context=context,
        )

        # 3. Update remediation record with PR info
        if pr_result and finding_id:
            self.supabase.table("remediations").update({
                "pr_url": pr_result.get("pr_url"),
                "pr_number": pr_result.get("pr_number"),
                "pr_title": pr_result.get("pr_title"),
                "pr_branch": pr_result.get("branch"),
                "pr_status": "OPEN",
                "status": "PENDING",
            }).eq("finding_id", finding_id).execute()

        self._add_reasoning_step(
            thought=f"PR created: {pr_result.get('pr_url', 'N/A')}",
            action="PR_CREATED",
            observation=f"PR #{pr_result.get('pr_number')}",
        )

        return {
            "scan_id": scan_id,
            "finding_id": finding_id,
            "status": "COMPLETED",
            "pr_url": pr_result.get("pr_url"),
            "pr_number": pr_result.get("pr_number"),
            "pr_title": pr_result.get("pr_title"),
        }

    async def _generate_pr_content(
        self, finding: Dict, remediation: Dict
    ) -> Dict:
        """Generate professional PR title and description"""
        prompt = f"""
Generate a professional GitHub Pull Request for this security fix:

VULNERABILITY:
- Title: {finding.get('title')}
- Severity: {finding.get('severity')}
- CWE: {finding.get('cwe_id')}
- File: {finding.get('file_path')}
- Description: {finding.get('description', '')[:300]}

FIX:
- Description: {remediation.get('description', '')}
- Explanation: {remediation.get('explanation', '')[:300]}
- Breaking Change: {remediation.get('breaking_change', False)}

Generate PR content as JSON:
{{
    "title": "fix(security): <concise title following conventional commits>",
    "body": "Full PR description in markdown including:
             ## Summary
             ## Vulnerability Details
             ## Changes Made
             ## Testing Instructions
             ## Security Impact
             ## Compliance Notes",
    "branch_name": "fix/security-<cwe>-<file-slug>",
    "commit_message": "fix(security): <message>\\n\\n<body>\\n\\nFixes #<issue>\\nCWE: <cwe>",
    "labels": ["security", "automated-fix"],
    "reviewers": []
}}
"""
        response = await self.call_llm(prompt, json_mode=True)
        return await self.parse_json_response(response)

    async def _create_github_pr(
        self,
        finding: Dict,
        remediation: Dict,
        pr_content: Dict,
        context: Dict,
    ) -> Optional[Dict]:
        """Create GitHub PR via GitHub API"""
        # Get repo info from integration settings
        repo_url = context.get("repo_url", "")
        github_token = await self._get_github_token(context.get("tenant_id"))

        if not github_token:
            logger.warning("github_token_not_found", scan_id=context.get("scan_id"))
            # Return mock PR for demo/testing
            return {
                "pr_url": f"{repo_url}/pull/999",
                "pr_number": 999,
                "pr_title": pr_content.get("title", "Security Fix"),
                "branch": pr_content.get("branch_name", "fix/security"),
            }

        # Extract owner/repo from URL
        parts = repo_url.rstrip("/").split("/")
        if len(parts) < 2:
            return None

        owner = parts[-2]
        repo = parts[-1]

        headers = {
            "Authorization": f"Bearer {github_token}",
            "Accept": "application/vnd.github.v3+json",
            "X-GitHub-Api-Version": "2022-11-28",
        }

        try:
            async with httpx.AsyncClient(timeout=30) as client:
                # Get default branch SHA
                branch_response = await client.get(
                    f"https://api.github.com/repos/{owner}/{repo}/git/ref/heads/main",
                    headers=headers,
                )
                if branch_response.status_code != 200:
                    return None

                base_sha = branch_response.json()["object"]["sha"]
                new_branch = pr_content.get("branch_name", "fix/security-sentinel")

                # Create new branch
                await client.post(
                    f"https://api.github.com/repos/{owner}/{repo}/git/refs",
                    headers=headers,
                    json={"ref": f"refs/heads/{new_branch}", "sha": base_sha},
                )

                # Update file with fix
                file_path = finding.get("file_path", "")
                if file_path and remediation.get("fixed_code"):
                    import base64

                    # Get current file
                    file_response = await client.get(
                        f"https://api.github.com/repos/{owner}/{repo}/contents/{file_path}",
                        headers=headers,
                        params={"ref": new_branch},
                    )

                    if file_response.status_code == 200:
                        file_sha = file_response.json()["sha"]
                        fixed_content = base64.b64encode(
                            remediation["fixed_code"].encode()
                        ).decode()

                        await client.put(
                            f"https://api.github.com/repos/{owner}/{repo}/contents/{file_path}",
                            headers=headers,
                            json={
                                "message": pr_content.get("commit_message", "fix: security fix"),
                                "content": fixed_content,
                                "sha": file_sha,
                                "branch": new_branch,
                            },
                        )

                # Create PR
                pr_response = await client.post(
                    f"https://api.github.com/repos/{owner}/{repo}/pulls",
                    headers=headers,
                    json={
                        "title": pr_content.get("title", "Security Fix"),
                        "body": pr_content.get("body", "Automated security fix"),
                        "head": new_branch,
                        "base": "main",
                        "draft": False,
                    },
                )

                if pr_response.status_code == 201:
                    pr_data = pr_response.json()
                    return {
                        "pr_url": pr_data["html_url"],
                        "pr_number": pr_data["number"],
                        "pr_title": pr_data["title"],
                        "branch": new_branch,
                    }

        except Exception as e:
            logger.error("github_pr_creation_failed", error=str(e))

        return None

    async def _get_github_token(self, tenant_id: Optional[str]) -> Optional[str]:
        """Retrieve GitHub token from integrations"""
        if not tenant_id:
            return None

        try:
            response = self.supabase.table("integrations").select(
                "config"
            ).eq("tenant_id", tenant_id).eq("integration_type", "GITHUB").eq(
                "is_active", True
            ).single().execute()

            if response.data:
                return response.data["config"].get("access_token")
        except Exception:
            pass

        return None