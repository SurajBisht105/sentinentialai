# app/agents/director_agent.py
from typing import Dict, Any, List
import structlog

from app.agents.base_agent import BaseAgent
from app.kafka.producer import kafka_producer
from app.config import settings

logger = structlog.get_logger(__name__)


class DirectorAgent(BaseAgent):
    """
    Director Agent - Orchestrates the entire scan workflow
    Receives scan requests and delegates to Planner Agent
    """

    AGENT_TYPE = "DIRECTOR"

    async def execute(self, event: Dict[str, Any]) -> Dict[str, Any]:
        scan_id = event["scan_id"]
        scan_types = event["scan_types"]
        repo_url = event["repo_url"]
        branch = event["branch"]

        logger.info(
            "director_analyzing_scan",
            scan_id=scan_id,
            scan_types=scan_types,
            repo_url=repo_url,
        )

        # Analyze scan complexity
        complexity = await self.analyze_complexity(scan_types, repo_url)

        # Determine required agents
        required_agents = self.determine_required_agents(scan_types)

        # Create planning task for Planner Agent
        planning_event = {
            "event_type": "PLAN_SCAN",
            "scan_id": scan_id,
            "repo_url": repo_url,
            "branch": branch,
            "scan_types": scan_types,
            "complexity": complexity,
            "required_agents": required_agents,
        }

        await kafka_producer.send(
            topic=settings.KAFKA_TOPIC_PLANNER,
            value=planning_event,
            key=f"scan:{scan_id}".encode(),
        )

        logger.info("director_delegated_to_planner", scan_id=scan_id)

        return {
            "scan_id": scan_id,
            "status": "PLANNING",
            "complexity": complexity,
            "required_agents": required_agents,
        }

    async def analyze_complexity(self, scan_types: List[str], repo_url: str) -> str:
        """
        Analyze scan complexity based on scan types and repo size
        """
        # Use LLM to estimate complexity
        prompt = f"""
Analyze the complexity of this security scan:
- Scan Types: {', '.join(scan_types)}
- Repository: {repo_url}

Classify as: LOW, MEDIUM, HIGH, or DEEP_SCAN

Consider:
- Number of scan types
- Known repo size patterns
- Technology stack implications
"""

        response = await self.call_llm(prompt)
        complexity = response.strip().split()[-1]

        if complexity not in ["LOW", "MEDIUM", "HIGH", "DEEP_SCAN"]:
            complexity = "MEDIUM"

        return complexity

    def determine_required_agents(self, scan_types: List[str]) -> List[str]:
        """
        Map scan types to required agent types
        """
        agent_mapping = {
            "SAST": ["SAST", "TAINT_ANALYZER", "CONTEXT_ISOLATION"],
            "DAST": ["DAST", "API_SCHEMA_CRAWLER", "ACCESS_CONTROL", "PROOF_VALIDATOR"],
            "SCA": ["SCA", "REACHABILITY_ANALYZER", "THREAT_INTEL"],
            "SECRETS": ["SECRETS"],
            "IaC": ["IAC", "SOC2_COMPLIANCE"],
        }

        required = set()
        for scan_type in scan_types:
            required.update(agent_mapping.get(scan_type, []))

        # Always include adversarial consensus, anti-hallucination verification, and root cause analysis
        required.update(["CONSENSUS", "DEBATER", "HALLUCINATION_DETECTOR", "ROOT_CAUSE", "PR_REVIEW"])

        return list(required)