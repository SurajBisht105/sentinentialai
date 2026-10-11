# app/models/scan.py
from sqlalchemy import Column, String, DateTime, UUID, ForeignKey, Integer, ARRAY, Boolean, Text, JSON, Numeric
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.database.session import Base
import uuid


class Scan(Base):
    __tablename__ = "scans"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    project_id = Column(UUID(as_uuid=True), ForeignKey("projects.id"), nullable=False)
    tenant_id = Column(UUID(as_uuid=True), ForeignKey("tenants.id"), nullable=False)
    user_id = Column(UUID(as_uuid=True), ForeignKey("profiles.id"), nullable=False)
    initiated_by = Column(UUID(as_uuid=True), ForeignKey("profiles.id"), nullable=True)
    status = Column(String(20), nullable=False, default="QUEUED")  # QUEUED, RUNNING, COMPLETED, FAILED
    scan_types = Column(ARRAY(String), nullable=False)  # ["SAST", "SCA", "DAST"]
    branch = Column(String(100), default="main")
    commit_sha = Column(String(40), nullable=True)
    target_url = Column(String(500), nullable=True)
    trigger_type = Column(String(20), default="MANUAL")  # MANUAL, CI_CD, SCHEDULED, WEBHOOK
    trigger_metadata = Column(JSON, default=dict)
    
    # Progress tracking
    progress_percent = Column(Integer, default=0)
    total_agents = Column(Integer, default=0)
    completed_agents = Column(Integer, default=0)
    failed_agents = Column(Integer, default=0)
    
    # Results (denormalized for dashboard performance)
    finding_count = Column(Integer, default=0)
    critical_count = Column(Integer, default=0)
    high_count = Column(Integer, default=0)
    medium_count = Column(Integer, default=0)
    low_count = Column(Integer, default=0)
    false_positive_count = Column(Integer, default=0)
    
    # AI metrics
    total_tokens_used = Column(Integer, default=0)
    llm_calls_count = Column(Integer, default=0)
    hallucination_score = Column(Numeric(5, 4), nullable=True)
    consensus_confidence = Column(Numeric(5, 4), nullable=True)
    
    # Timing
    duration_seconds = Column(Integer, nullable=True)
    queued_at = Column(DateTime(timezone=True), server_default=func.now())
    started_at = Column(DateTime(timezone=True), nullable=True)
    completed_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), nullable=True)
    
    # Error handling
    error_message = Column(Text, nullable=True)
    retry_count = Column(Integer, default=0)
    max_retries = Column(Integer, default=3)

    # Relationships
    project = relationship("Project", back_populates="scans")
    user = relationship("User", back_populates="scans")
    tasks = relationship("AgentTask", back_populates="scan")
    findings = relationship("Finding", back_populates="scan")