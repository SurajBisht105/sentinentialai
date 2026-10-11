# app/schemas/scan.py
from pydantic import BaseModel, Field
from typing import List, Optional
from datetime import datetime


class ScanCreate(BaseModel):
    repo_url: Optional[str] = Field(default=None, description="GitHub repository URL or local directory")
    target_url: Optional[str] = Field(default=None, description="Live website or web application URL")
    branch: str = Field(default="main", description="Branch to scan")
    scan_types: List[str] = Field(default_factory=lambda: ["SAST", "SCA", "SECRETS", "DAST"], description="Types of scans: SAST, SCA, DAST, SECRETS, IaC")


class ScanResponse(BaseModel):
    scan_id: str
    status: str
    message: str


class ScanStatusResponse(BaseModel):
    scan_id: str
    project_id: Optional[str] = None
    tenant_id: Optional[str] = None
    status: str
    progress: int
    scan_types: List[str] = Field(default_factory=list)
    branch: str = "main"
    commit_sha: Optional[str] = None
    target_url: Optional[str] = None
    trigger_type: Optional[str] = None
    finding_count: int
    critical_count: int
    high_count: int
    medium_count: int
    low_count: int
    false_positive_count: int = 0
    total_agents: int = 0
    completed_agents: int = 0
    failed_agents: int = 0
    total_tokens_used: int = 0
    llm_calls_count: int = 0
    hallucination_score: Optional[float] = None
    consensus_confidence: Optional[float] = None
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    duration_seconds: Optional[int] = None
    error_message: Optional[str] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
