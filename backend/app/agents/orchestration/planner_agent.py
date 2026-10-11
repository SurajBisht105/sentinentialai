# app/agents/orchestration/planner_agent.py
from typing import Dict, Any, List, Optional
import structlog
import json

from app.agents.base_agent import BaseAgent
from app.kafka.producer import kafka_producer
from app.config import settings

logger = structlog.get_logger(__name__)


SCAN_TYPE_TO_AGENT = {
    "SAST": {
        "topic": settings.KAFKA_TOPIC_SAST,
        "agent": "SAST",
        "depends_on": [],
        "priority": 1,
    },
    "TAINT_ANALYZER": {
        "topic": settings.KAFKA_TOPIC_SAST,
        "agent": "TAINT_ANALYZER",
        "depends_on": ["SAST"],
        "priority": 2,
    },
    "SCA": {
        "topic": settings.KAFKA_TOPIC_SCA,
        "agent": "SCA",
        "depends_on": [],
        "priority": 1,
    },
    "REACHABILITY_ANALYZER": {
        "topic": settings.KAFKA_TOPIC_SCA,
        "agent": "REACHABILITY_ANALYZER",
        "depends_on": ["SCA"],
        "priority": 2,
    },
    "SECRETS": {
        "topic": settings.KAFKA_TOPIC_SECRETS,
        "agent": "SECRETS",
        "depends_on": [],
        "priority": 1,
    },
    "API_SCHEMA_CRAWLER": {
        "topic": settings.KAFKA_TOPIC_DAST,
        "agent": "API_SCHEMA_CRAWLER",
        "depends_on": [],
        "priority": 1,
    },
    "ACCESS_CONTROL": {
        "topic": settings.KAFKA_TOPIC_DAST,
        "agent": "ACCESS_CONTROL",
        "depends_on": ["API_SCHEMA_CRAWLER"],
        "priority": 2,
    },
    "DAST": {
        "topic": settings.KAFKA_TOPIC_DAST,
        "agent": "DAST",
        "depends_on": [],
        "priority": 2,
    },
    "PROOF_VALIDATOR": {
        "topic": settings.KAFKA_TOPIC_DAST,
        "agent": "PROOF_VALIDATOR",
        "depends_on": ["DAST"],
        "priority": 3,
    },
    "IaC": {
        "topic": settings.KAFKA_TOPIC_IAC,
        "agent": "IAC",
        "depends_on": [],
        "priority": 1,
    },
    "COMPLIANCE": {
        "topic": settings.KAFKA_TOPIC_COMPLIANCE,
        "agent": "COMPLIANCE",
        "depends_on": ["SAST", "SCA", "SECRETS"],
        "priority": 3,
    },
    "DEBATER": {
        "topic": settings.KAFKA_TOPIC_CONSENSUS,
        "agent": "DEBATER",
        "depends_on": ["SAST", "DAST", "SCA", "SECRETS", "IAC"],
        "priority": 4,
    },
    "CONSENSUS": {
        "topic": settings.KAFKA_TOPIC_CONSENSUS,
        "agent": "CONSENSUS",
        "depends_on": ["DEBATER"],
        "priority": 5,
    },
}


class PlannerAgent(BaseAgent):
    """
    Planner Agent — Decomposes Director tasks into executable
    sub-task graphs with dependency resolution.

    Responsibilities:
    - Parse scan request into ordered task DAG
    - Assign priorities and resource estimates
    - Dispatch sub-tasks to appropriate agent topics
    - Handle task dependency chains
    """

    AGENT_TYPE = "PLANNER"
    DEFAULT_MODEL = settings.LLM_MODEL_FAST  # Fast model for planning

    async def execute(self, context: Dict[str, Any]) -> Dict[str, Any]:
        scan_id = context["scan_id"]
        scan_types = context["scan_types"]
        repo_url = context["repo_url"]
        branch = context.get("branch", "main")
        complexity = context.get("complexity", "MEDIUM")

        self._add_reasoning_step(
            thought=f"Planning scan for {repo_url} with types: {scan_types}",
            action="CREATE_TASK_GRAPH",
            observation=f"Complexity: {complexity}",
        )

        # Use LLM to create intelligent task graph
        task_graph = await self._create_task_graph(
            scan_id, scan_types, repo_url, branch, complexity
        )

        # Dispatch tasks to agents
        dispatched = await self._dispatch_tasks(task_graph)

        # Update scan status to RUNNING
        self.supabase.table("scans").update({
            "status": "RUNNING",
            "started_at": __import__("datetime").datetime.utcnow().isoformat(),
            "total_agents": len(dispatched),
        }).eq("id", scan_id).execute()

        self._add_reasoning_step(
            thought=f"Task graph created with {len(dispatched)} agents",
            action="DISPATCH_COMPLETE",
            observation=f"Agents: {[t['agent_type'] for t in dispatched]}",
        )

        return {
            "scan_id": scan_id,
            "status": "PLANNED",
            "task_graph": task_graph,
            "dispatched_tasks": len(dispatched),
            "agent_types": [t["agent_type"] for t in dispatched],
        }

    async def _create_task_graph(
        self,
        scan_id: str,
        scan_types: List[str],
        repo_url: str,
        branch: str,
        complexity: str,
    ) -> List[Dict]:
        """
        Create ordered task graph using LLM for intelligent planning
        """
        prompt = f"""
Create an optimal security scan task graph for:
- Repository: {repo_url}
- Branch: {branch}
- Scan Types: {', '.join(scan_types)}
- Complexity: {complexity}

Rules:
1. SAST, SCA, SECRETS can run in PARALLEL (no dependencies)
2. DAST depends on SAST completing first
3. COMPLIANCE depends on all defensive scans completing
4. CONSENSUS runs after all agents report findings
5. PR_REVIEW runs after CONSENSUS

Respond with JSON:
{{
    "tasks": [
        {{
            "agent_type": "SAST",
            "priority": 1,
            "parallel_group": 1,
            "depends_on": [],
            "estimated_tokens": 5000,
            "timeout_seconds": 300
        }}
    ],
    "total_estimated_time_minutes": 5,
    "parallelism_factor": 3
}}
"""
        response = await self.call_llm(prompt, json_mode=True)
        parsed = await self.parse_json_response(response)

        tasks = parsed.get("tasks", [])

        # Fallback to default if LLM fails
        if not tasks:
            tasks = self._get_default_task_graph(scan_types)

        # Add common metadata to all tasks
        for task in tasks:
            task["scan_id"] = scan_id
            task["repo_url"] = repo_url
            task["branch"] = branch

        return tasks

    def _get_default_task_graph(self, scan_types: List[str]) -> List[Dict]:
        """Fallback task graph without LLM"""
        tasks = []
        group = 1

        # Parallel group 1: Independent scans
        parallel_agents = []
        for scan_type in scan_types:
            config = SCAN_TYPE_TO_AGENT.get(scan_type)
            if config and not config["depends_on"]:
                parallel_agents.append({
                    "agent_type": scan_type,
                    "priority": 1,
                    "parallel_group": group,
                    "depends_on": [],
                    "estimated_tokens": 5000,
                    "timeout_seconds": 300,
                })
        tasks.extend(parallel_agents)

        # Group 2: Dependent scans (DAST needs SAST)
        group = 2
        for scan_type in scan_types:
            config = SCAN_TYPE_TO_AGENT.get(scan_type)
            if config and config["depends_on"]:
                tasks.append({
                    "agent_type": scan_type,
                    "priority": 2,
                    "parallel_group": group,
                    "depends_on": config["depends_on"],
                    "estimated_tokens": 8000,
                    "timeout_seconds": 600,
                })

        # Group 3: Consensus (always last)
        tasks.append({
            "agent_type": "CONSENSUS",
            "priority": 3,
            "parallel_group": 3,
            "depends_on": [t["agent_type"] for t in tasks],
            "estimated_tokens": 3000,
            "timeout_seconds": 120,
        })

        return tasks

    async def _dispatch_tasks(self, task_graph: List[Dict]) -> List[Dict]:
        """Dispatch tasks to Kafka topics in dependency order"""
        dispatched = []

        # Sort by parallel_group (execute groups in order)
        sorted_tasks = sorted(task_graph, key=lambda t: t.get("parallel_group", 1))

        # Dispatch parallel groups
        current_group = None
        group_tasks = []

        for task in sorted_tasks:
            task_group = task.get("parallel_group", 1)

            if current_group is None:
                current_group = task_group

            if task_group != current_group:
                # Dispatch previous group
                await self._dispatch_group(group_tasks)
                dispatched.extend(group_tasks)
                group_tasks = []
                current_group = task_group

            group_tasks.append(task)

        # Dispatch last group
        if group_tasks:
            await self._dispatch_group(group_tasks)
            dispatched.extend(group_tasks)

        return dispatched

    async def _dispatch_group(self, tasks: List[Dict]) -> None:
        """Dispatch a group of tasks in parallel to Kafka"""
        import asyncio

        dispatch_coros = []
        for task in tasks:
            agent_type = task["agent_type"]
            config = SCAN_TYPE_TO_AGENT.get(agent_type, {})
            topic = config.get("topic", f"agent.{agent_type.lower()}")

            event = {
                "event_type": f"{agent_type}_TASK",
                "task_id": __import__("uuid").uuid4().hex,
                **task,
            }

            dispatch_coros.append(
                kafka_producer.send(
                    topic=topic,
                    value=event,
                    key=f"scan:{task['scan_id']}".encode(),
                )
            )

        await asyncio.gather(*dispatch_coros, return_exceptions=True)

        logger.info(
            "task_group_dispatched",
            count=len(tasks),
            agents=[t["agent_type"] for t in tasks],
        )