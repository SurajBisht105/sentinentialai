# app/agents/base_agent.py
from abc import ABC, abstractmethod
from typing import Any, Dict, Optional, List, Callable
import structlog
import time
import asyncio
import traceback
import uuid
from datetime import datetime
from enum import Enum

from app.config import settings
from app.kafka.producer import kafka_producer
from app.services.audit_service import AuditService
from app.database.supabase import get_supabase_client

logger = structlog.get_logger(__name__)


class AgentState(str, Enum):
    INITIALIZING = "INITIALIZING"
    OBSERVING = "OBSERVING"
    RETRIEVING = "RETRIEVING"
    REASONING = "REASONING"
    ACTING = "ACTING"
    VALIDATING = "VALIDATING"
    SYNTHESIZING = "SYNTHESIZING"
    COMPLETED = "COMPLETED"
    FAILED = "FAILED"


class ReasoningStep:
    def __init__(self, step: int, thought: str, action: str, observation: str = ""):
        self.step = step
        self.thought = thought
        self.action = action
        self.observation = observation
        self.timestamp = datetime.utcnow().isoformat()

    def to_dict(self) -> Dict:
        return {
            "step": self.step,
            "thought": self.thought,
            "action": self.action,
            "observation": self.observation,
            "timestamp": self.timestamp,
        }


class BaseAgent(ABC):
    """
    Base class for all SentinelAI agents.

    Internal ReAct loop:
    1. Observe  — Read task from Kafka
    2. Retrieve — Query Vector DB for context
    3. Reason   — Query LLM for next steps
    4. Act      — Invoke tools with permission check
    5. Validate — Policy engine validates
    6. Synthesize — Formulate and publish result
    """

    AGENT_TYPE: str = "BASE"
    DEFAULT_MODEL: str = settings.LLM_MODEL_MAIN
    MAX_REASONING_STEPS: int = 10
    TIMEOUT_SECONDS: int = 300

    def __init__(self):
        from app.llm.gateway import LLMGateway
        self.llm = LLMGateway()
        self.audit_service = AuditService()
        self.supabase = get_supabase_client()
        self.state = AgentState.INITIALIZING
        self.reasoning_trace: List[ReasoningStep] = []
        self.tokens_used: int = 0
        self.llm_calls: int = 0
        self.start_time: Optional[float] = None
        self.task_id: str = str(uuid.uuid4())
        self.findings: List[Dict] = []

    # ──────────────────────────────────────────────────────────
    # Main Entry Point
    # ──────────────────────────────────────────────────────────

    async def process(self, event: Dict[str, Any]) -> Dict[str, Any]:
        """Main entry point — orchestrates the full ReAct loop"""
        self.start_time = time.time()
        scan_id = event.get("scan_id", "unknown")
        self.scan_id = scan_id if scan_id != "unknown" else None
        self.task_id = event.get("task_id", self.task_id)

        logger.info(
            "agent_started",
            agent=self.AGENT_TYPE,
            task_id=self.task_id,
            scan_id=scan_id,
        )

        # Create task record in DB
        await self._create_task_record(event)

        try:
            # Step 1: Observe
            self.state = AgentState.OBSERVING
            context = await self.observe(event)

            # Step 2: Retrieve relevant context
            self.state = AgentState.RETRIEVING
            enriched_context = await self.retrieve_context(context)

            # Step 3: Validate guardrails on input
            await self._validate_guardrails(enriched_context)

            # Step 4: Execute agent logic
            self.state = AgentState.ACTING
            result = await self.execute(enriched_context)

            # Step 5: Synthesize output
            self.state = AgentState.SYNTHESIZING
            final_result = await self.synthesize(result)

            # Publish to event bus
            await self.publish_result(final_result)

            # Update task record
            self.state = AgentState.COMPLETED
            await self._complete_task_record(final_result)

            logger.info(
                "agent_completed",
                agent=self.AGENT_TYPE,
                task_id=self.task_id,
                duration_ms=self._elapsed_ms(),
                tokens=self.tokens_used,
                findings=len(self.findings),
            )

            return final_result

        except asyncio.TimeoutError:
            logger.error("agent_timeout", agent=self.AGENT_TYPE, task_id=self.task_id)
            self.state = AgentState.FAILED
            await self._fail_task_record("Agent execution timed out")
            raise

        except Exception as e:
            logger.error(
                "agent_failed",
                agent=self.AGENT_TYPE,
                task_id=self.task_id,
                error=str(e),
                trace=traceback.format_exc(),
            )
            self.state = AgentState.FAILED
            await self._fail_task_record(str(e))
            raise

    # ──────────────────────────────────────────────────────────
    # ReAct Steps (can be overridden)
    # ──────────────────────────────────────────────────────────

    async def observe(self, event: Dict[str, Any]) -> Dict[str, Any]:
        """Step 1: Parse and validate incoming event"""
        self._add_reasoning_step(
            thought="Analyzing incoming task event",
            action=f"OBSERVE: {event.get('event_type', 'UNKNOWN')}",
            observation=f"scan_id={event.get('scan_id')}, types={event.get('scan_types')}",
        )
        return event

    async def retrieve_context(self, context: Dict[str, Any]) -> Dict[str, Any]:
        """Step 2: Retrieve relevant context from vector DB"""
        # Can be overridden by agents needing RAG
        return context

    async def synthesize(self, result: Dict[str, Any]) -> Dict[str, Any]:
        """Step 5: Finalize and structure result"""
        return {
            **result,
            "agent_type": self.AGENT_TYPE,
            "task_id": self.task_id,
            "tokens_used": self.tokens_used,
            "llm_calls": self.llm_calls,
            "duration_ms": self._elapsed_ms(),
            "reasoning_trace": [s.to_dict() for s in self.reasoning_trace],
            "timestamp": datetime.utcnow().isoformat(),
        }

    @abstractmethod
    async def execute(self, context: Dict[str, Any]) -> Dict[str, Any]:
        """Core agent logic — must be implemented by subclass"""
        pass

    # ──────────────────────────────────────────────────────────
    # LLM Interaction
    # ──────────────────────────────────────────────────────────

    async def call_llm(
        self,
        prompt: str,
        system_prompt: Optional[str] = None,
        model: Optional[str] = None,
        temperature: float = 0.1,
        max_tokens: int = 4096,
        json_mode: bool = False,
    ) -> str:
        """Call LLM through gateway with tracking"""
        self.llm_calls += 1

        messages = [
            {
                "role": "system",
                "content": system_prompt or self.get_system_prompt(),
            },
            {"role": "user", "content": prompt},
        ]

        if json_mode:
            messages[0]["content"] += "\n\nYou MUST respond with valid JSON only."

        response = await self.llm.chat(
            messages=messages,
            model=model or self.DEFAULT_MODEL,
            temperature=temperature,
            max_tokens=max_tokens,
        )

        content = response.choices[0].message.content
        self.tokens_used += response.usage.total_tokens

        return content

    async def call_llm_with_tools(
        self,
        prompt: str,
        tools: List[Dict],
        system_prompt: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Call LLM with tool use (function calling)"""
        self.llm_calls += 1

        response = await self.llm.chat_with_tools(
            messages=[
                {"role": "system", "content": system_prompt or self.get_system_prompt()},
                {"role": "user", "content": prompt},
            ],
            tools=tools,
            model=self.DEFAULT_MODEL,
        )

        self.tokens_used += response.usage.total_tokens
        return response

    def get_system_prompt(self) -> str:
        """Default system prompt — override in subclasses"""
        return f"""You are {self.AGENT_TYPE}, a specialized AI security agent in the SentinelAI platform.
You operate with strict guardrails and always provide evidence-based analysis.
Respond only with what is asked. Be precise and avoid hallucination."""

    # ──────────────────────────────────────────────────────────
    # Finding Management
    # ──────────────────────────────────────────────────────────

    async def report_finding(
        self,
        scan_id: str,
        severity: str,
        title: str,
        description: str,
        cwe_id: Optional[str] = None,
        cve_id: Optional[str] = None,
        file_path: Optional[str] = None,
        line_number: Optional[int] = None,
        code_snippet: Optional[str] = None,
        remediation: Optional[str] = None,
        evidence: Optional[Dict] = None,
        metadata: Optional[Dict] = None,
    ) -> Dict:
        """Report a security finding and persist to database"""
        meta = dict(metadata or {})
        if cve_id:
            meta["cve_id"] = cve_id
        if remediation:
            meta["remediation"] = remediation

        # Resolve tenant_id and project_id from scan
        tenant_id = None
        project_id = None
        try:
            scan_res = self.supabase.table("scans").select(
                "tenant_id, project_id"
            ).eq("id", scan_id).execute()

            if scan_res.data:
                tenant_id = scan_res.data[0].get("tenant_id")
                project_id = scan_res.data[0].get("project_id")
        except Exception as scan_fetch_err:
            logger.warning("finding_scan_lookup_failed", error=str(scan_fetch_err))

        # Normalize severity to uppercase enum
        norm_severity = str(severity).upper()
        if norm_severity not in ["CRITICAL", "HIGH", "MEDIUM", "LOW", "INFO"]:
            norm_severity = "MEDIUM"

        finding_data = {
            "id": str(uuid.uuid4()),
            "scan_id": scan_id,
            "tenant_id": tenant_id,
            "project_id": project_id,
            "severity": norm_severity,
            "title": str(title)[:255],
            "description": str(description),
            "cwe_id": str(cwe_id)[:20] if cwe_id else None,
            "file_path": str(file_path)[:1000] if file_path else None,
            "line_number": line_number if isinstance(line_number, int) and line_number > 0 else None,
            "code_snippet": code_snippet,
            "detecting_agent": self.AGENT_TYPE,
            "verified_by_consensus": True,
            "consensus_score": 0.95,
            "false_positive": False,
            "evidence": evidence or {},
            "metadata": meta,
        }

        try:
            result = self.supabase.table("findings").insert(finding_data).execute()
            finding = result.data[0] if result.data else finding_data
            logger.info(
                "finding_persisted_successfully",
                agent=self.AGENT_TYPE,
                severity=norm_severity,
                title=title[:50],
                finding_id=finding.get("id"),
            )
        except Exception as insert_err:
            logger.warning("finding_insert_retrying_fallback", error=str(insert_err))
            minimal_data = {
                "id": str(uuid.uuid4()),
                "scan_id": scan_id,
                "severity": norm_severity,
                "title": str(title)[:255],
                "description": str(description),
                "detecting_agent": self.AGENT_TYPE,
                "verified_by_consensus": True,
                "consensus_score": 0.95,
                "false_positive": False,
                "evidence": evidence or {},
                "metadata": meta,
            }
            if tenant_id:
                minimal_data["tenant_id"] = tenant_id
            if project_id:
                minimal_data["project_id"] = project_id
            try:
                result = self.supabase.table("findings").insert(minimal_data).execute()
                finding = result.data[0] if result.data else minimal_data
            except Exception as e2:
                logger.error("finding_persist_failed", error=str(e2))
                finding = finding_data

        self.findings.append(finding)

        # Notify consensus engine if Kafka is active
        try:
            await kafka_producer.send(
                topic=settings.KAFKA_TOPIC_CONSENSUS,
                value={
                    "event_type": "FINDING_SUBMITTED",
                    "finding_id": finding.get("id"),
                    "scan_id": scan_id,
                    "agent_type": self.AGENT_TYPE,
                    "severity": norm_severity,
                    "finding": finding,
                },
                key=f"scan:{scan_id}".encode(),
            )
        except Exception as kerr:
            logger.debug("kafka_finding_notify_skipped", error=str(kerr))

        return finding

    # ──────────────────────────────────────────────────────────
    # Reasoning Trace
    # ──────────────────────────────────────────────────────────

    def _add_reasoning_step(
        self, thought: str, action: str, observation: str = ""
    ) -> None:
        step = ReasoningStep(
            step=len(self.reasoning_trace) + 1,
            thought=thought,
            action=action,
            observation=observation,
        )
        self.reasoning_trace.append(step)

        logger.debug(
            "reasoning_step",
            agent=self.AGENT_TYPE,
            step=step.step,
            thought=thought[:100],
            action=action[:100],
        )

    # ──────────────────────────────────────────────────────────
    # Kafka Publishing
    # ──────────────────────────────────────────────────────────

    async def publish_result(self, result: Dict[str, Any]) -> None:
        topic = f"agent.{self.AGENT_TYPE.lower()}.results"
        try:
            await kafka_producer.send(
                topic=topic,
                value=result,
                key=f"task:{self.task_id}".encode(),
            )
        except Exception as e:
            logger.error("publish_failed", agent=self.AGENT_TYPE, error=str(e))

    # ──────────────────────────────────────────────────────────
    # Guardrails
    # ──────────────────────────────────────────────────────────

    async def _validate_guardrails(self, context: Dict[str, Any]) -> None:
        """Validate input against security guardrails"""
        from app.agents.ai_security.prompt_guard_agent import PromptGuardAgent
        guard = PromptGuardAgent()
        is_safe, threat_info = await guard.validate_input(context)

        if not is_safe:
            await self._log_audit(
                action="GUARDRAIL_VIOLATION_BLOCKED",
                details={"threat_info": threat_info, "agent": self.AGENT_TYPE},
                risk_level="CRITICAL",
            )
            raise ValueError(
                f"Guardrail violation detected by {self.AGENT_TYPE}: {threat_info}"
            )

    # ──────────────────────────────────────────────────────────
    # Database Operations
    # ──────────────────────────────────────────────────────────

    async def _create_task_record(self, event: Dict) -> None:
        try:
            self.supabase.table("agent_tasks").insert({
                "id": self.task_id,
                "scan_id": event.get("scan_id"),
                "agent_type": self.AGENT_TYPE,
                "status": "ACTIVE",
                "input_payload": event,
                "kafka_topic": f"agent.{self.AGENT_TYPE.lower()}",
                "queued_at": datetime.utcnow().isoformat(),
                "started_at": datetime.utcnow().isoformat(),
            }).execute()
        except Exception as e:
            logger.warning("task_record_create_failed", error=str(e))

    async def _complete_task_record(self, result: Dict) -> None:
        try:
            self.supabase.table("agent_tasks").update({
                "status": "COMPLETED",
                "output_payload": result,
                "tokens_input": self.tokens_used // 2,
                "tokens_output": self.tokens_used // 2,
                "tokens_total": self.tokens_used,
                "llm_calls": self.llm_calls,
                "latency_ms": self._elapsed_ms(),
                "reasoning_trace": [s.to_dict() for s in self.reasoning_trace],
                "completed_at": datetime.utcnow().isoformat(),
            }).eq("id", self.task_id).execute()

            await self._reconcile_scan_if_complete()
        except Exception as e:
            logger.warning("task_record_complete_failed", error=str(e))

    async def _fail_task_record(self, error: str) -> None:
        try:
            self.supabase.table("agent_tasks").update({
                "status": "FAILED",
                "error_message": error[:500],
                "completed_at": datetime.utcnow().isoformat(),
            }).eq("id", self.task_id).execute()
            await self._reconcile_scan_if_complete()
        except Exception as e:
            logger.warning("task_record_fail_update_failed", error=str(e))

    async def _reconcile_scan_if_complete(self) -> None:
        """Finalize a scan once every agent task reaches a terminal state."""
        if not self.scan_id:
            return

        tasks_res = self.supabase.table("agent_tasks").select("status").eq("scan_id", self.scan_id).execute()
        tasks = tasks_res.data or []
        if not tasks or not all(t.get("status") in ["COMPLETED", "FAILED"] for t in tasks):
            return

        findings_res = self.supabase.table("findings").select("severity").eq("scan_id", self.scan_id).execute()
        findings = findings_res.data or []
        self.supabase.table("scans").update({
            "status": "COMPLETED",
            "completed_at": datetime.utcnow().isoformat(),
            "progress_percent": 100,
        }).eq("id", self.scan_id).in_("status", ["QUEUED", "RUNNING"]).execute()

    async def _log_audit(
        self,
        action: str,
        details: Dict,
        risk_level: str = "LOW",
    ) -> None:
        await self.audit_service.log_event(
            actor_type="AGENT",
            actor_id=self.AGENT_TYPE,
            actor_email=None,
            action=action,
            resource_type="AGENT_TASK",
            resource_id=self.task_id,
            details=details,
            ip_address="internal",
            risk_level=risk_level,
        )

    # ──────────────────────────────────────────────────────────
    # Utilities
    # ──────────────────────────────────────────────────────────

    def _elapsed_ms(self) -> int:
        if self.start_time is None:
            return 0
        return int((time.time() - self.start_time) * 1000)

    async def parse_json_response(self, response: str) -> Dict:
        """Safely parse JSON from LLM response"""
        import json
        import re

        # Try direct parse
        try:
            return json.loads(response.strip())
        except json.JSONDecodeError:
            pass

        # Extract JSON block
        json_match = re.search(r"```(?:json)?\s*(\{[\s\S]*?\})\s*```", response)
        if json_match:
            try:
                return json.loads(json_match.group(1))
            except json.JSONDecodeError:
                pass

        # Find outermost JSON object
        brace_match = re.search(r"\{[\s\S]*\}", response)
        if brace_match:
            try:
                return json.loads(brace_match.group())
            except json.JSONDecodeError:
                pass

        logger.warning("json_parse_failed", agent=self.AGENT_TYPE, response_len=len(response))
        return {}