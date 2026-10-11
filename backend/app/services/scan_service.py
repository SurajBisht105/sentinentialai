# app/services/scan_service.py
import os
import re
import uuid
from datetime import datetime
from typing import List, Optional, Dict, Any
from urllib.parse import urlparse
import structlog
from supabase import Client

from app.config import settings
from app.kafka.producer import kafka_producer
from app.database.supabase import get_supabase_client

logger = structlog.get_logger(__name__)


class ScanService:
    def __init__(self):
        self.supabase: Client = get_supabase_client()
        self.kafka_producer = kafka_producer

    async def create_scan(
        self,
        repo_url: Optional[str] = None,
        target_url: Optional[str] = None,
        branch: str = "main",
        scan_types: Optional[List[str]] = None,
        user_id: Optional[str] = None,
        tenant_id: Optional[str] = None,
    ) -> Any:
        """
        Create a new scan record in database for either a git repo or a live website URL.
        Adapts dynamically to the Supabase PostgreSQL table schema.
        """
        scan_types = scan_types or ["SAST", "SCA", "SECRETS", "DAST"]
        primary_target = target_url or repo_url or "https://example.com"

        # Ensure scheme for primary_target
        if not primary_target.startswith("http://") and not primary_target.startswith("https://"):
            primary_target = f"https://{primary_target}"

        # Determine project name and classification
        parsed = urlparse(primary_target)
        is_live_web = bool(
            not primary_target.endswith(".git")
            and not os.path.exists(primary_target)
            and "github.com" not in primary_target
            and "gitlab.com" not in primary_target
        )

        if is_live_web:
            project_name = parsed.netloc or primary_target.split("/")[-1] or "Live Website"
        else:
            project_name = primary_target.rstrip("/").split("/")[-1].replace(".git", "") or "Project"

        # ─── 1. Find or create project ───────────────────────────────────────
        projects_response = (
            self.supabase.table("projects")
            .select("*")
            .eq("repo_url", primary_target)
            .eq("tenant_id", tenant_id)
            .execute()
        )

        if not projects_response.data:
            project_data = {
                "id": str(uuid.uuid4()),
                "tenant_id": tenant_id,
                "name": project_name,
                "repo_url": primary_target,
                "default_branch": branch or "main",
            }
            if user_id and user_id != "user-system":
                try:
                    uuid.UUID(str(user_id))
                    project_data["created_by"] = user_id
                except ValueError:
                    pass

            project_id = None
            for _ in range(3):
                try:
                    project_response = self.supabase.table("projects").insert(project_data).execute()
                    if project_response.data:
                        project_id = project_response.data[0]["id"]
                        break
                except Exception as proj_err:
                    err_str = str(proj_err)
                    missing_col = re.search(r"Could not find the '([^']+)' column", err_str)
                    if missing_col and missing_col.group(1) in project_data:
                        del project_data[missing_col.group(1)]
                    else:
                        project_data = {
                            "id": str(uuid.uuid4()),
                            "tenant_id": tenant_id,
                            "name": project_name,
                            "repo_url": primary_target,
                        }
            if not project_id:
                project_id = project_data["id"]
        else:
            project_id = projects_response.data[0]["id"]

        # ─── 2. Create scan record with schema-adaptive insertion ─────────────
        valid_user_uuid = None
        if user_id and user_id != "user-system":
            try:
                uuid.UUID(str(user_id))
                valid_user_uuid = str(user_id)
            except ValueError:
                pass

        if not valid_user_uuid:
            valid_user_uuid = str(tenant_id) if tenant_id else str(uuid.uuid4())

        meta_dict = {
            "repo_url": repo_url or primary_target,
            "target_url": target_url or (primary_target if is_live_web else None),
            "branch": branch or "main",
            "tenant_id": tenant_id,
            "is_live_web": is_live_web,
        }

        scan_payload = {
            "id": str(uuid.uuid4()),
            "project_id": project_id,
            "tenant_id": tenant_id,
            "user_id": valid_user_uuid,
            "initiated_by": valid_user_uuid,
            "status": "QUEUED",
            "scan_types": scan_types,
            "target_url": target_url or (primary_target if is_live_web else None),
            "branch": branch or "main",
            "trigger_type": "MANUAL",
            "trigger_metadata": meta_dict,
            "metadata": meta_dict,
        }

        last_error = None
        for _ in range(5):
            try:
                scan_response = self.supabase.table("scans").insert(scan_payload).execute()
                if scan_response.data:
                    return scan_response.data[0]
                return scan_payload
            except Exception as insert_err:
                last_error = insert_err
                err_str = str(insert_err)
                logger.warning("scan_insert_adapting_schema", error=err_str)

                missing_col = re.search(r"Could not find the '([^']+)' column", err_str)
                if missing_col:
                    bad_col = missing_col.group(1)
                    if bad_col in scan_payload:
                        del scan_payload[bad_col]
                        continue

                # Fallback for foreign key on initiated_by
                if "initiated_by" in scan_payload and ("foreign key" in err_str.lower() or "profiles" in err_str.lower()):
                    del scan_payload["initiated_by"]
                    continue

                raise insert_err

        if last_error:
            raise last_error

    async def trigger_scan_execution(self, scan: Any):
        """
        Trigger scan execution via Kafka or direct fallback
        """
        metadata = scan.get("metadata") or scan.get("trigger_metadata") or {}
        repo_url = metadata.get("repo_url") or scan.get("target_url")
        if not repo_url:
            project_response = self.supabase.table("projects").select("repo_url").eq("id", scan["project_id"]).execute()
            if project_response.data:
                repo_url = project_response.data[0]["repo_url"]

        event = {
            "event_type": "SCAN_INITIATED",
            "scan_id": scan["id"],
            "project_id": scan["project_id"],
            "repo_url": repo_url,
            "target_url": scan.get("target_url") or metadata.get("target_url"),
            "branch": metadata.get("branch") or scan.get("branch", "main"),
            "scan_types": scan.get("scan_types", ["SAST", "SCA", "SECRETS", "DAST"]),
            "created_at": datetime.utcnow().isoformat(),
        }

        try:
            await self.kafka_producer.send(
                topic=settings.KAFKA_TOPIC_DIRECTOR,
                key=f"scan:{scan['id']}".encode(),
                value=event,
            )
            logger.info("director_event_sent", scan_id=scan["id"])
        except Exception as e:
            logger.warning("kafka_unavailable_running_direct_scan", scan_id=scan["id"], error=str(e))
            await self.run_direct_scan(scan, repo_url)

    async def trigger_director_agent(self, scan: Any):
        await self.trigger_scan_execution(scan)

    async def run_direct_scan(self, scan: Any, repo_url: str):
        """
        Directly scan live website or git repository and populate real database findings.
        """
        scan_id = scan["id"]
        started_at = datetime.utcnow()
        try:
            # Update status to RUNNING
            started = self.supabase.table("scans").update({
                "status": "RUNNING",
                "started_at": datetime.utcnow().isoformat(),
            }).eq("id", scan_id).eq("status", "QUEUED").execute()

            if not started.data:
                logger.info("direct_scan_skipped_or_already_running", scan_id=scan_id)
                return

            self.supabase.table("scans").update({
                "progress_percent": 10,
            }).eq("id", scan_id).eq("status", "RUNNING").execute()

            metadata = scan.get("metadata") or scan.get("trigger_metadata") or {}
            branch = scan.get("branch") or metadata.get("branch", "main")
            scan_types = list(scan.get("scan_types") or ["SAST", "SCA", "SECRETS"])
            target_url = scan.get("target_url") or metadata.get("target_url") or repo_url
            if not repo_url and target_url:
                repo_url = target_url

            parsed = urlparse(target_url or "")
            is_git_target = bool(
                (target_url and (target_url.endswith(".git") or "github.com" in target_url or "gitlab.com" in target_url or "bitbucket.org" in target_url or os.path.exists(target_url)))
                or (repo_url and (repo_url.endswith(".git") or "github.com" in repo_url or "gitlab.com" in repo_url or "bitbucket.org" in repo_url or os.path.exists(repo_url)))
            )
            is_live_url = bool(
                not is_git_target
                and parsed.scheme in ["http", "https"]
                and not os.path.exists(target_url or "")
            )

            # Auto-enable SAST, SCA, SECRETS, IaC for Git repositories
            if is_git_target:
                for req_type in ["SAST", "SCA", "SECRETS", "IaC"]:
                    if req_type not in scan_types:
                        scan_types.append(req_type)

            executed_types = []

            # ─── 1. Live Website DAST & API Deep-Scan (Only for real live web applications) ───
            if is_live_url and ("DAST" in scan_types or "SECURITY_HEADERS" in scan_types or "SENSITIVE_FILES" in scan_types):
                try:
                    self.supabase.table("scans").update({
                        "progress_percent": 30,
                    }).eq("id", scan_id).eq("status", "RUNNING").execute()

                    dast_context = {
                        "scan_id": scan_id,
                        "target_url": target_url,
                        "repo_url": repo_url,
                    }

                    # A. Schema & Hidden API Discovery
                    try:
                        from app.agents.defensive.api_schema_crawler_agent import APISchemaCrawlerAgent
                        schema_res = await APISchemaCrawlerAgent().execute(dast_context)
                        dast_context["discovered_endpoints"] = schema_res.get("discovered_endpoints", [])
                    except Exception as s_err:
                        logger.debug("api_schema_crawler_skipped", error=str(s_err))

                    # B. Business Logic & Access Control (BOLA/BFLA)
                    try:
                        from app.agents.defensive.access_control_agent import AccessControlAgent
                        await AccessControlAgent().execute(dast_context)
                    except Exception as ac_err:
                        logger.debug("access_control_audit_skipped", error=str(ac_err))

                    # C. Core DAST Runtime Scanner
                    from app.agents.defensive.dast_agent import DASTAgent
                    await DASTAgent().execute(dast_context)
                    executed_types.append("DAST")

                    # D. Differential Proof Validator
                    try:
                        from app.agents.verification.proof_validator_agent import ProofValidatorAgent
                        current_findings = self.supabase.table("findings").select("*").eq("scan_id", scan_id).execute().data or []
                        if current_findings:
                            await ProofValidatorAgent().execute({
                                "scan_id": scan_id,
                                "findings": current_findings,
                                "target_url": target_url,
                            })
                    except Exception as pv_err:
                        logger.debug("proof_validator_skipped", error=str(pv_err))

                    logger.info("dast_and_deep_scans_completed", scan_id=scan_id, target=target_url)
                except Exception as dast_err:
                    logger.error("dast_agent_failed", scan_id=scan_id, error=str(dast_err), exc_info=True)

            # ─── 2. Source Code Static & Dependency Scans (SAST, SCA, SECRETS, IaC) ─
            code_scan_types = [t for t in scan_types if t in ["SAST", "SCA", "SECRETS", "IaC"]]
            should_run_code_scans = bool(code_scan_types and (not is_live_url or os.path.exists(repo_url) or repo_url.endswith(".git") or "github.com" in repo_url))

            if should_run_code_scans:
                from app.sandbox.executor import SandboxExecutor
                async with SandboxExecutor() as executor:
                    target_path = None
                    if os.path.exists(repo_url):
                        target_path = repo_url
                        logger.info("using_local_repo", path=repo_url)
                    else:
                        try:
                            target_path = await executor.clone_repo(repo_url, branch)
                            logger.info("repo_cloned", path=target_path, branch=branch)
                        except Exception as clone_err:
                            logger.warning("git_clone_failed_skipping_code_scans", repo=repo_url, error=str(clone_err))

                    if target_path:
                        scan_context = {
                            "scan_id": scan_id,
                            "repo_url": repo_url,
                            "repo_path": target_path,
                            "branch": branch,
                            "_executor": executor,
                        }

                        if "SECRETS" in scan_types:
                            try:
                                from app.agents.defensive.secrets_agent import SecretsAgent
                                await SecretsAgent().execute(scan_context)
                                executed_types.append("SECRETS")
                            except Exception as sec_err:
                                logger.warning("secrets_agent_failed", error=str(sec_err))

                        self.supabase.table("scans").update({
                            "progress_percent": 50,
                        }).eq("id", scan_id).eq("status", "RUNNING").execute()

                        if "SAST" in scan_types:
                            try:
                                from app.agents.sast_agent import SASTAgent
                                sast_res = await SASTAgent().execute(scan_context)
                                executed_types.append("SAST")

                                # Taint & Control-Flow Tracing on SAST findings
                                try:
                                    from app.agents.verification.taint_analysis_agent import TaintAnalysisAgent
                                    sast_findings = self.supabase.table("findings").select("*").eq("scan_id", scan_id).eq("detecting_agent", "SAST").execute().data or []
                                    if sast_findings:
                                        await TaintAnalysisAgent().execute({
                                            "scan_id": scan_id,
                                            "findings": sast_findings,
                                            "repo_path": target_path,
                                        })
                                except Exception as taint_err:
                                    logger.debug("taint_analysis_skipped", error=str(taint_err))

                            except Exception as sast_err:
                                logger.warning("sast_agent_failed", error=str(sast_err))

                        self.supabase.table("scans").update({
                            "progress_percent": 70,
                        }).eq("id", scan_id).eq("status", "RUNNING").execute()

                        if "SCA" in scan_types:
                            try:
                                from app.agents.defensive.sca_agent import SCAAgent
                                await SCAAgent().execute(scan_context)
                                executed_types.append("SCA")

                                # Reachability & Dependency Graph Analysis
                                try:
                                    from app.agents.defensive.reachability_agent import ReachabilityAgent
                                    sca_findings = self.supabase.table("findings").select("*").eq("scan_id", scan_id).eq("detecting_agent", "SCA").execute().data or []
                                    if sca_findings:
                                        await ReachabilityAgent().execute({
                                            "scan_id": scan_id,
                                            "findings": sca_findings,
                                            "repo_path": target_path,
                                        })
                                except Exception as r_err:
                                    logger.debug("reachability_analysis_skipped", error=str(r_err))

                            except Exception as sca_err:
                                logger.warning("sca_agent_failed", error=str(sca_err))

                        if "IaC" in scan_types:
                            try:
                                from app.agents.defensive.iac_agent import IaCAgent
                                await IaCAgent().execute(scan_context)
                                executed_types.append("IaC")
                            except Exception as iac_err:
                                logger.warning("iac_agent_failed", error=str(iac_err))

            self.supabase.table("scans").update({
                "progress_percent": 90,
            }).eq("id", scan_id).eq("status", "RUNNING").execute()

            # ─── 3. Consensus Verification & Consolidation ────────────────────
            if executed_types:
                try:
                    from app.agents.consensus_agent import ConsensusAgent
                    findings_res = self.supabase.table("findings").select("*").eq("scan_id", scan_id).execute()
                    if findings_res.data:
                        consensus_context = {
                            "scan_id": scan_id,
                            "findings": findings_res.data,
                        }
                        await ConsensusAgent().execute(consensus_context)
                except Exception as consensus_err:
                    logger.warning("consensus_agent_failed", error=str(consensus_err))
                    if findings_res.data:
                        consensus_context = {
                            "scan_id": scan_id,
                            "findings": findings_res.data,
                        }
                        await ConsensusAgent().execute(consensus_context)
                except Exception as consensus_err:
                    logger.warning("consensus_agent_failed", error=str(consensus_err))

            # Fetch total findings created for this scan
            res = self.supabase.table("findings").select("*", count="exact").eq("scan_id", scan_id).execute()
            findings_list = res.data or []
            total_findings = res.count or len(findings_list)
            critical_c = sum(1 for f in findings_list if f.get("severity") == "CRITICAL")
            high_c = sum(1 for f in findings_list if f.get("severity") == "HIGH")
            medium_c = sum(1 for f in findings_list if f.get("severity") == "MEDIUM")
            low_c = sum(1 for f in findings_list if f.get("severity") == "LOW")

            meta_update = dict(metadata or {})
            meta_update["finding_count"] = total_findings
            meta_update["critical_count"] = critical_c
            meta_update["high_count"] = high_c
            meta_update["medium_count"] = medium_c
            meta_update["low_count"] = low_c

            # Update scan record to COMPLETED using columns guaranteed in Supabase schema
            update_payload = {
                "status": "COMPLETED",
                "completed_at": datetime.utcnow().isoformat(),
                "duration_seconds": max(1, int((datetime.utcnow() - started_at).total_seconds())),
                "progress_percent": 100,
                "finding_count": total_findings,
                "critical_count": critical_c,
                "high_count": high_c,
                "medium_count": medium_c,
                "low_count": low_c,
                "trigger_metadata": meta_update,
                "metadata": meta_update,
            }
            try:
                self.supabase.table("scans").update(update_payload).eq("id", scan_id).eq("status", "RUNNING").execute()
            except Exception as up_err:
                err_s = str(up_err)
                if "trigger_metadata" in err_s:
                    update_payload.pop("trigger_metadata", None)
                if "metadata" in err_s:
                    update_payload.pop("metadata", None)
                self.supabase.table("scans").update(update_payload).eq("id", scan_id).eq("status", "RUNNING").execute()

            # Also update the project's aggregate stats if project_id exists
            project_id = scan.get("project_id")
            if project_id:
                try:
                    all_project_findings = self.supabase.table("findings").select("id", count="exact").eq("project_id", project_id).execute()
                    all_project_scans = self.supabase.table("scans").select("id", count="exact").eq("project_id", project_id).execute()
                    proj_update = {
                        "total_findings": all_project_findings.count or len(all_project_findings.data or []),
                        "total_scans": all_project_scans.count or len(all_project_scans.data or []),
                        "risk_score": min(100, critical_c * 25 + high_c * 15 + medium_c * 5),
                        "updated_at": datetime.utcnow().isoformat(),
                    }
                    self.supabase.table("projects").update(proj_update).eq("id", project_id).execute()
                except Exception as p_err:
                    logger.debug("project_stats_update_skipped", error=str(p_err))

            logger.info("live_scan_completed", scan_id=scan_id, findings=total_findings)

        except Exception as err:
            logger.error("direct_scan_unhandled_error", scan_id=scan_id, error=str(err), exc_info=True)
            self.supabase.table("scans").update({
                "status": "FAILED",
                "completed_at": datetime.utcnow().isoformat(),
                "error_message": str(err),
            }).eq("id", scan_id).eq("status", "RUNNING").execute()

    async def get_scan(self, scan_id: str, tenant_id: str) -> Optional[Any]:
        """
        Get scan by ID with tenant isolation
        """
        response = self.supabase.rpc(
            "get_scan_with_tenant_check",
            {"p_scan_id": scan_id, "p_tenant_id": tenant_id},
        ).execute()

        if response.data:
            return response.data[0]
        return None

    async def cancel_scan(self, scan_id: str, tenant_id: str) -> Optional[Any]:
        response = (
            self.supabase.table("scans")
            .update({
                "status": "CANCELLED",
                "completed_at": datetime.utcnow().isoformat(),
            })
            .eq("id", scan_id)
            .eq("tenant_id", tenant_id)
            .in_("status", ["QUEUED", "RUNNING"])
            .execute()
        )
        return response.data[0] if response.data else None

    async def get_scan_progress(self, scan_id: str) -> int:
        """
        Calculate scan progress based on progress_percent or completed tasks
        """
        scan_res = self.supabase.table("scans").select("progress_percent, status").eq("id", scan_id).execute()
        if scan_res.data:
            s = scan_res.data[0]
            if s.get("status") in ["COMPLETED", "FAILED", "CANCELLED"]:
                return 100
            if s.get("progress_percent") is not None:
                return s["progress_percent"]

        tasks_response = self.supabase.table("agent_tasks").select("status").eq("scan_id", scan_id).execute()
        if not tasks_response.data:
            return 0

        total = len(tasks_response.data)
        completed = sum(1 for t in tasks_response.data if t["status"] in ["COMPLETED", "FAILED"])
        return int((completed / total) * 100) if total > 0 else 0

    async def list_scans(
        self,
        tenant_id: str,
        project_id: Optional[str] = None,
        limit: int = 50,
        offset: int = 0,
    ) -> List[Any]:
        """
        List scans with pagination
        """
        try:
            query = (
                self.supabase.table("scans")
                .select("*")
                .eq("tenant_id", tenant_id)
                .order("created_at", desc=True)
                .range(offset, offset + limit - 1)
            )

            if project_id:
                query = query.eq("project_id", project_id)

            response = query.execute()
            return response.data
        except Exception as e:
            logger.error("list_scans_db_error", tenant_id=tenant_id, project_id=project_id, error=str(e), exc_info=True)
            raise
