# app/agents/registry.py
from typing import Dict, Type, Optional
import structlog

from app.agents.base_agent import BaseAgent
from app.agents.director_agent import DirectorAgent
from app.agents.orchestration.planner_agent import PlannerAgent
from app.agents.sast_agent import SASTAgent
from app.agents.defensive.dast_agent import DASTAgent
from app.agents.defensive.sca_agent import SCAAgent
from app.agents.defensive.secrets_agent import SecretsAgent
from app.agents.defensive.iac_agent import IaCAgent
from app.agents.ai_security.jailbreak_agent import JailbreakAgent
from app.agents.ai_security.context_isolation_agent import ContextIsolationAgent
from app.agents.verification.hallucination_agent import HallucinationDetectionAgent
from app.agents.consensus_agent import ConsensusAgent
from app.agents.verification.root_cause_agent import RootCauseAgent
from app.agents.verification.pr_review_agent import PRReviewAgent
from app.agents.compliance.soc2_agent import SOC2Agent
from app.agents.threat_intel.threat_feed_agent import ThreatFeedAgent
from app.agents.verification.taint_analysis_agent import TaintAnalysisAgent
from app.agents.verification.proof_validator_agent import ProofValidatorAgent
from app.agents.verification.debater_agent import DebaterAgent
from app.agents.defensive.api_schema_crawler_agent import APISchemaCrawlerAgent
from app.agents.defensive.reachability_agent import ReachabilityAgent
from app.agents.defensive.access_control_agent import AccessControlAgent

logger = structlog.get_logger(__name__)


AGENT_REGISTRY: Dict[str, Type[BaseAgent]] = {
    # Orchestration
    "DIRECTOR":             DirectorAgent,
    "PLANNER":              PlannerAgent,
    # Defensive
    "SAST":                 SASTAgent,
    "DAST":                 DASTAgent,
    "SCA":                  SCAAgent,
    "SECRETS":              SecretsAgent,
    "IAC":                  IaCAgent,
    "API_SCHEMA_CRAWLER":   APISchemaCrawlerAgent,
    "REACHABILITY_ANALYZER": ReachabilityAgent,
    "ACCESS_CONTROL":       AccessControlAgent,
    # AI Security
    "JAILBREAK":            JailbreakAgent,
    "CONTEXT_ISOLATION":    ContextIsolationAgent,
    "HALLUCINATION_DETECTOR": HallucinationDetectionAgent,
    # Verification & Anti-Hallucination
    "TAINT_ANALYZER":       TaintAnalysisAgent,
    "PROOF_VALIDATOR":      ProofValidatorAgent,
    "DEBATER":              DebaterAgent,
    "CONSENSUS":            ConsensusAgent,
    "ROOT_CAUSE":           RootCauseAgent,
    "PR_REVIEW":            PRReviewAgent,
    # Compliance
    "SOC2_COMPLIANCE":      SOC2Agent,
    # Threat Intel
    "THREAT_INTEL":         ThreatFeedAgent,
}


class AgentFactory:
    """Factory for creating agent instances"""

    @staticmethod
    def create(agent_type: str) -> Optional[BaseAgent]:
        """Create an agent instance by type"""
        agent_class = AGENT_REGISTRY.get(agent_type.upper())

        if not agent_class:
            logger.error("unknown_agent_type", agent_type=agent_type)
            return None

        agent = agent_class()
        logger.info("agent_created", agent_type=agent_type)
        return agent

    @staticmethod
    def list_agents() -> Dict[str, str]:
        """List all registered agents"""
        return {
            agent_type: agent_class.__doc__.strip().split("\n")[0]
            if agent_class.__doc__ else "No description"
            for agent_type, agent_class in AGENT_REGISTRY.items()
        }

    @staticmethod
    def get_agents_by_category() -> Dict[str, list]:
        """Group agents by category"""
        return {
            "Orchestration": ["DIRECTOR", "PLANNER"],
            "Defensive": ["SAST", "DAST", "SCA", "SECRETS", "IAC", "API_SCHEMA_CRAWLER", "REACHABILITY_ANALYZER", "ACCESS_CONTROL"],
            "AI Security": ["JAILBREAK", "CONTEXT_ISOLATION", "HALLUCINATION_DETECTOR"],
            "Verification & Anti-Hallucination": ["TAINT_ANALYZER", "PROOF_VALIDATOR", "DEBATER", "CONSENSUS", "ROOT_CAUSE", "PR_REVIEW"],
            "Compliance": ["SOC2_COMPLIANCE"],
            "Threat Intelligence": ["THREAT_INTEL"],
        }

    @staticmethod
    def get_agents(tenant_id: Optional[str] = None) -> List[Dict[str, Any]]:
        """Return list of all registered agents with metadata"""
        categories = AgentFactory.get_agents_by_category()
        agents = []
        for agent_type, agent_class in AGENT_REGISTRY.items():
            doc = agent_class.__doc__.strip() if agent_class.__doc__ else "Security Agent"
            doc_lines = [line.strip() for line in doc.split("\n") if line.strip()]
            summary = doc_lines[0] if doc_lines else "Security Agent"

            cat = "General"
            for c_name, c_types in categories.items():
                if agent_type in c_types:
                    cat = c_name
                    break

            agents.append({
                "id": agent_type.lower(),
                "name": agent_type.replace("_", " ").title(),
                "type": agent_type,
                "category": cat,
                "status": "ACTIVE",
                "description": summary,
                "capabilities": doc_lines[1:5] if len(doc_lines) > 1 else [summary],
                "last_active": None,
            })
        return agents