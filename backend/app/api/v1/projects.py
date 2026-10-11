# app/api/v1/projects.py
from fastapi import APIRouter, Depends, HTTPException, Query, Path
from typing import List, Optional
from pydantic import BaseModel, Field
from datetime import datetime
import asyncio
import os
import shutil
import subprocess
import tempfile
import uuid
from urllib.parse import urlparse
from app.config import settings

from app.dependencies import get_current_user_with_supabase, get_tenant_id
from app.database.supabase import get_supabase_client
import structlog

logger = structlog.get_logger(__name__)

router = APIRouter()

class ProjectBase(BaseModel):
    name: str
    description: Optional[str] = None
    status: str = "active"
    repo_url: str
    branch: Optional[str] = "main"
    language: Optional[str] = None

class ProjectCreate(ProjectBase):
    scan_types: Optional[List[str]] = Field(default_factory=lambda: ["SAST", "SCA", "SECRETS"])

class ProjectResponse(ProjectBase):
    id: str
    tenant_id: str
    created_at: datetime
    updated_at: Optional[datetime] = None
    scan_count: int = 0
    finding_count: int = 0
    risk_score: int = 0
    trend: str = "stable"
    last_scan_at: Optional[datetime] = None

class ProjectUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    status: Optional[str] = None

# Initial projects list
# Removed MOCK_PROJECTS


def _is_supported_repository_url(repo_url: str) -> bool:
    if not repo_url or not isinstance(repo_url, str):
        return False
    repo_url = repo_url.strip()
    if os.path.exists(repo_url) or os.path.isdir(repo_url):
        return True
    if repo_url.startswith("git@"):
        return True
    parsed_url = urlparse(repo_url)
    if parsed_url.scheme in ("http", "https") and parsed_url.netloc:
        return True
    return False


async def _validate_repository(repo_url: str, branch: str) -> str:
    """Confirm the repository is reachable and infer its language from tracked files."""
    if not _is_supported_repository_url(repo_url):
        raise HTTPException(status_code=400, detail="Enter a valid repository URL or directory path")

    # If it's a local filesystem directory
    if os.path.exists(repo_url) and os.path.isdir(repo_url):
        extensions = set()
        for root, _, filenames in os.walk(repo_url):
            if any(part.startswith(".") or part in ("node_modules", "venv", ".venv", "__pycache__", "target", "dist", "build") for part in root.split(os.sep)):
                continue
            for filename in filenames:
                if "." in filename:
                    extensions.add(filename.rsplit(".", 1)[-1].lower())
        
        language_by_extension = (
            ("Python", {"py"}),
            ("TypeScript", {"ts", "tsx", "mts", "cts"}),
            ("JavaScript", {"js", "jsx", "mjs", "cjs"}),
            ("Go", {"go"}),
            ("Rust", {"rs"}),
            ("Java", {"java"}),
            ("C#", {"cs"}),
            ("PHP", {"php"}),
            ("Ruby", {"rb"}),
        )
        return next((lang for lang, exts in language_by_extension if extensions & exts), "TypeScript")

    # If git binary exists, attempt fast remote inspection
    has_git = bool(shutil.which("git"))
    if has_git:
        try:
            completed = await asyncio.to_thread(
                subprocess.run,
                ["git", "ls-remote", "--heads", repo_url, branch],
                capture_output=True,
                text=True,
                check=False,
                timeout=2,
            )
            if completed.returncode == 0:
                clone_dir = tempfile.mkdtemp(prefix="sentinel-repo-check-")
                try:
                    clone = await asyncio.to_thread(
                        subprocess.run,
                        ["git", "clone", "--depth", "1", "--branch", branch, "--single-branch", repo_url, clone_dir],
                        capture_output=True,
                        text=True,
                        check=False,
                        timeout=3,
                    )
                    if clone.returncode == 0:
                        paths = [
                            os.path.relpath(os.path.join(root, filename), clone_dir)
                            for root, _, filenames in os.walk(clone_dir)
                            for filename in filenames
                        ]
                        if paths:
                            extensions = {path.rsplit(".", 1)[-1].lower() for path in paths if "." in path}
                            language_by_extension = (
                                ("Python", {"py"}),
                                ("TypeScript", {"ts", "tsx", "mts", "cts"}),
                                ("JavaScript", {"js", "jsx", "mjs", "cjs"}),
                                ("Go", {"go"}),
                                ("Rust", {"rs"}),
                                ("Java", {"java"}),
                                ("C#", {"cs"}),
                                ("PHP", {"php"}),
                                ("Ruby", {"rb"}),
                            )
                            return next((language for language, known_extensions in language_by_extension if extensions & known_extensions), "TypeScript")
                finally:
                    shutil.rmtree(clone_dir, ignore_errors=True)
        except Exception as err:
            logger.warning("git_validation_skipped_or_failed", repo_url=repo_url, error=str(err))

    # Fast fallback when git is missing, times out, or git remote is not accessible
    lower_url = repo_url.lower()
    if any(k in lower_url for k in ("py", "python", "fastapi", "django", "flask")):
        return "Python"
    if any(k in lower_url for k in ("rust", "cargo")):
        return "Rust"
    if any(k in lower_url for k in ("golang", "go-")):
        return "Go"
    if any(k in lower_url for k in ("java", "spring")):
        return "Java"
    return "TypeScript"


from app.database.supabase import get_supabase_client
import structlog

logger = structlog.get_logger(__name__)

@router.get("", response_model=List[ProjectResponse])
@router.get("/", response_model=List[ProjectResponse])
async def get_projects(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    status: Optional[str] = None,
    current_user: dict = Depends(get_current_user_with_supabase),
    tenant_id: str = Depends(get_tenant_id)
):
    """
    Get list of projects for the tenant.
    """
    try:
        supabase = get_supabase_client()
        query = supabase.table("projects").select("*").eq("tenant_id", tenant_id).range(skip, skip + limit - 1)
        res = query.execute()
        if res.data:
            now_iso = datetime.utcnow().isoformat()
            return [
                ProjectResponse(
                    id=p["id"],
                    tenant_id=p.get("tenant_id") or tenant_id,
                    name=p.get("name") or "Project",
                    description=p.get("description") or f"Repository {p.get('name')}",
                    status="active",
                    repo_url=p["repo_url"],
                    branch=p.get("default_branch") or "main",
                    language=p.get("primary_language") or "Unknown",
                    created_at=p.get("created_at") or now_iso,
                    updated_at=p.get("updated_at") or p.get("created_at") or now_iso,
                    scan_count=p.get("total_scans", p.get("scan_count")) or 0,
                    finding_count=p.get("total_findings") or 0,
                    risk_score=p.get("risk_score") or 0,
                    trend="stable",
                )
                for p in res.data
                if _is_supported_repository_url(p.get("repo_url", ""))
            ]
        return []
    except Exception as e:
        logger.error("get_projects_error", error=str(e))
        raise HTTPException(status_code=500, detail="Failed to fetch projects")


@router.post("", response_model=ProjectResponse, status_code=201)
@router.post("/", response_model=ProjectResponse, status_code=201)
async def create_project(
    project: ProjectCreate,
    current_user: dict = Depends(get_current_user_with_supabase),
    tenant_id: str = Depends(get_tenant_id)
):
    """
    Create/Connect a new repository project.
    """
    detected_language = await _validate_repository(project.repo_url, project.branch or "main")

    try:
        supabase = get_supabase_client()
        now_iso = datetime.utcnow().isoformat()
        project_id = str(uuid.uuid4())
        user_id = current_user.get("id") or current_user.get("jwt_payload", {}).get("sub")

        # Check if project already exists for this tenant
        existing = (
            supabase.table("projects")
            .select("*")
            .eq("tenant_id", tenant_id)
            .eq("repo_url", project.repo_url)
            .execute()
        )
        if existing.data:
            p = existing.data[0]
            return ProjectResponse(
                id=p["id"],
                tenant_id=p.get("tenant_id") or tenant_id,
                name=p.get("name") or project.name,
                description=p.get("description") or project.description or f"Repository {project.name}",
                status="active",
                repo_url=p.get("repo_url") or project.repo_url,
                branch=p.get("default_branch") or project.branch or "main",
                language=p.get("primary_language") or detected_language,
                created_at=p.get("created_at") or now_iso,
                updated_at=p.get("updated_at") or now_iso,
                scan_count=p.get("total_scans") or 0,
                finding_count=p.get("total_findings") or 0,
                risk_score=p.get("risk_score") or 0,
                trend="stable",
            )

        new_project_data = {
            "id": project_id,
            "tenant_id": tenant_id,
            "name": project.name,
            "description": project.description or f"Repository {project.name}",
            "repo_url": project.repo_url,
            "default_branch": project.branch or "main",
            "primary_language": detected_language,
        }

        try:
            res = supabase.table("projects").insert(new_project_data).execute()
        except Exception as insert_err:
            logger.warning("project_insert_retry_minimal", error=str(insert_err))
            minimal_data = {
                "id": project_id,
                "tenant_id": tenant_id,
                "name": project.name,
                "repo_url": project.repo_url,
                "default_branch": project.branch or "main",
            }
            res = supabase.table("projects").insert(minimal_data).execute()

        if res.data:
            p = res.data[0]
            return ProjectResponse(
                id=p["id"],
                tenant_id=p.get("tenant_id") or tenant_id,
                name=p.get("name") or project.name,
                description=p.get("description") or f"Repository {project.name}",
                status="active",
                repo_url=p.get("repo_url") or project.repo_url,
                branch=p.get("default_branch") or project.branch or "main",
                language=p.get("primary_language") or detected_language,
                created_at=p.get("created_at") or now_iso,
                updated_at=p.get("updated_at") or now_iso,
                scan_count=0,
                finding_count=0,
                risk_score=0,
                trend="stable",
            )

        raise HTTPException(status_code=500, detail="Project was not created")
    except HTTPException:
        raise
    except Exception as e:
        logger.error("create_project_error", error=str(e))
        raise HTTPException(status_code=500, detail=f"Failed to create project: {str(e)}")


@router.get("/{project_id}", response_model=ProjectResponse)
async def get_project(
    project_id: str = Path(...),
    current_user: dict = Depends(get_current_user_with_supabase),
    tenant_id: str = Depends(get_tenant_id)
):
    """
    Get a specific project by ID.
    """
    try:
        supabase = get_supabase_client()
        res = supabase.table("projects").select("*").eq("id", project_id).execute()
        if res.data:
            p = res.data[0]
            if not _is_supported_repository_url(p.get("repo_url", "")):
                raise HTTPException(status_code=404, detail="Project repository is not valid")
            now_iso = datetime.utcnow().isoformat()
            return ProjectResponse(
                id=p["id"],
                tenant_id=p.get("tenant_id") or tenant_id,
                name=p.get("name") or "Project",
                description=p.get("description") or f"Repository {p.get('name')}",
                status="active",  # Status not in table, default to active
                repo_url=p["repo_url"],
                branch=p.get("default_branch") or "main",
                language=p.get("primary_language") or "Unknown",
                created_at=p.get("created_at") or now_iso,
                updated_at=p.get("updated_at") or p.get("created_at") or now_iso,
                scan_count=p.get("total_scans") or 0,
                finding_count=p.get("total_findings") or 0,  # Use total_findings, not open_findings
                risk_score=p.get("risk_score") or 0,
                trend="stable",
            )
    except HTTPException:
        raise
    except Exception as e:
        logger.error("get_project_error", error=str(e))
        raise HTTPException(status_code=500, detail="Failed to fetch project")

    raise HTTPException(status_code=404, detail="Project not found")


@router.put("/{project_id}", response_model=ProjectResponse)
async def update_project(
    project_id: str,
    project_update: ProjectUpdate,
    current_user: dict = Depends(get_current_user_with_supabase),
    tenant_id: str = Depends(get_tenant_id)
):
    """
    Update a project.
    """
    try:
        supabase = get_supabase_client()
        update_data = {k: v for k, v in project_update.dict().items() if v is not None}
        update_data["updated_at"] = datetime.utcnow().isoformat()
        
        res = supabase.table("projects").update(update_data).eq("id", project_id).execute()
        if res.data:
            return await get_project(project_id, current_user, tenant_id)
    except Exception as e:
        logger.error("update_project_error", error=str(e))
        raise HTTPException(status_code=500, detail="Failed to update project")
            
    raise HTTPException(status_code=404, detail="Project not found")


@router.delete("/{project_id}")
async def delete_project(
    project_id: str = Path(...),
    current_user: dict = Depends(get_current_user_with_supabase),
    tenant_id: str = Depends(get_tenant_id)
):
    """
    Completely delete a project and all associated scans, findings, tasks, and reports.
    """
    try:
        supabase = get_supabase_client()

        # 1. Fetch scan IDs for this project
        scans_res = supabase.table("scans").select("id").eq("project_id", project_id).execute()
        scan_ids = [s["id"] for s in (scans_res.data or [])]

        # 2. Fetch finding IDs for this project
        findings_res = supabase.table("findings").select("id").eq("project_id", project_id).execute()
        finding_ids = [f["id"] for f in (findings_res.data or [])]

        # 3. Clean up remediations
        for f_id in finding_ids:
            try:
                supabase.table("remediations").delete().eq("finding_id", f_id).execute()
            except Exception:
                pass

        # 4. Clean up findings
        try:
            supabase.table("findings").delete().eq("project_id", project_id).execute()
        except Exception:
            pass

        # 5. Clean up agent tasks
        for s_id in scan_ids:
            try:
                supabase.table("agent_tasks").delete().eq("scan_id", s_id).execute()
            except Exception:
                pass

        # 6. Clean up exploit logs & compliance reports if table exists
        try:
            supabase.table("exploit_logs").delete().eq("project_id", project_id).execute()
        except Exception:
            pass
        try:
            supabase.table("compliance_reports").delete().eq("project_id", project_id).execute()
        except Exception:
            pass

        # 7. Clean up scans
        try:
            supabase.table("scans").delete().eq("project_id", project_id).execute()
        except Exception:
            pass

        # 8. Delete the project itself
        res = supabase.table("projects").delete().eq("id", project_id).execute()

        logger.info("project_deleted_completely", project_id=project_id, scans_deleted=len(scan_ids), findings_deleted=len(finding_ids))
        return {"message": "Project and all associated data deleted successfully"}
    except Exception as e:
        logger.error("delete_project_error", error=str(e), project_id=project_id)
        raise HTTPException(status_code=500, detail=f"Failed to delete project: {str(e)}")


@router.get("/{project_id}/scans")
async def get_project_scans(
    project_id: str = Path(...),
    current_user: dict = Depends(get_current_user_with_supabase),
    tenant_id: str = Depends(get_tenant_id)
):
    """
    Get scans for a specific project.
    """
    try:
        supabase = get_supabase_client()
        res = supabase.table("scans").select("*").eq("project_id", project_id).eq("tenant_id", tenant_id).order("created_at", desc=True).execute()
        scans = res.data or []

        # Auto-reconcile scans whose agent tasks have finished
        for scan in scans:
            if scan.get("status") in ["RUNNING", "QUEUED"]:
                try:
                    tasks_res = supabase.table("agent_tasks").select("status").eq("scan_id", scan["id"]).execute()
                    tasks = tasks_res.data or []
                    if tasks and all(t.get("status") in ["COMPLETED", "FAILED"] for t in tasks):
                        findings_res = supabase.table("findings").select("severity").eq("scan_id", scan["id"]).execute()
                        findings = findings_res.data or []
                        scan_meta = dict(scan.get("metadata") or {})
                        scan_meta["finding_count"] = len(findings)
                        scan_meta["critical_count"] = sum(1 for f in findings if f.get("severity") == "CRITICAL")
                        scan_meta["high_count"] = sum(1 for f in findings if f.get("severity") == "HIGH")
                        scan_meta["medium_count"] = sum(1 for f in findings if f.get("severity") == "MEDIUM")
                        scan_meta["low_count"] = sum(1 for f in findings if f.get("severity") == "LOW")
                        supabase.table("scans").update({
                            "status": "COMPLETED",
                            "completed_at": datetime.utcnow().isoformat(),
                            "progress_percent": 100,
                            "metadata": scan_meta,
                        }).eq("id", scan["id"]).execute()
                        scan["status"] = "COMPLETED"
                        scan["progress_percent"] = 100
                        scan["metadata"] = scan_meta
                except Exception as rec_err:
                    logger.warning("scan_reconcile_warning", scan_id=scan.get("id"), error=str(rec_err))

        return scans
    except Exception as e:
        logger.error("get_project_scans_error", error=str(e))
        return []


@router.get("/{project_id}/vulnerabilities")
async def get_project_vulnerabilities(
    project_id: str = Path(...),
    current_user: dict = Depends(get_current_user_with_supabase),
    tenant_id: str = Depends(get_tenant_id)
):
    """
    Get vulnerabilities for a specific project.
    """
    try:
        supabase = get_supabase_client()
        res = supabase.table("findings").select("*").eq("project_id", project_id).execute()
        return res.data or []
    except Exception as e:
        logger.error("get_project_vulnerabilities_error", error=str(e))
        return []