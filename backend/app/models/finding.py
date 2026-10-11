# app/models/finding.py
from sqlalchemy import Column, String, DateTime, UUID, ForeignKey, Integer, Boolean, Text, JSON, Numeric, ARRAY
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.database.session import Base
import uuid


class Finding(Base):
    __tablename__ = "findings"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    scan_id = Column(UUID(as_uuid=True), ForeignKey("scans.id"), nullable=False)
    task_id = Column(UUID(as_uuid=True), ForeignKey("agent_tasks.id"), nullable=True)
    tenant_id = Column(UUID(as_uuid=True), ForeignKey("tenants.id"), nullable=False)
    project_id = Column(UUID(as_uuid=True), ForeignKey("projects.id"), nullable=False)
    severity = Column(String(20), nullable=False)  # CRITICAL, HIGH, MEDIUM, LOW, INFO
    title = Column(String(255), nullable=False)
    description = Column(Text)
    cwe_id = Column(String(50))
    cve_id = Column(String(50))
    owasp_category = Column(String(50))
    cvss_score = Column(Numeric(4, 1), nullable=True)
    file_path = Column(String(1000))
    line_number = Column(Integer, nullable=True)
    column_number = Column(Integer, nullable=True)
    code_snippet = Column(Text, nullable=True)
    detecting_agent = Column(String(50))
    detection_method = Column(String(50))  # STATIC, DYNAMIC, PATTERN, ML
    verified_by_consensus = Column(Boolean, default=False)
    consensus_score = Column(Numeric(5, 4), nullable=True)
    consensus_agents_agreed = Column(Integer, default=0)
    consensus_agents_total = Column(Integer, default=0)
    false_positive = Column(Boolean, default=False)
    false_positive_reason = Column(Text, nullable=True)
    false_positive_marked_by = Column(UUID(as_uuid=True), ForeignKey("profiles.id"), nullable=True)
    false_positive_marked_at = Column(DateTime(timezone=True), nullable=True)
    is_resolved = Column(Boolean, default=False)
    resolved_at = Column(DateTime(timezone=True), nullable=True)
    resolved_by = Column(UUID(as_uuid=True), ForeignKey("profiles.id"), nullable=True)
    evidence = Column(JSON, default=dict)
    attack_vector = Column(String(50), nullable=True)
    exploitability = Column(String(20), nullable=True)  # EASY, MEDIUM, HARD
    proof_of_concept = Column(Text, nullable=True)
    references = Column(JSON, default=list)
    metadata = Column(JSON, default=dict)
    tags = Column(ARRAY(String), default=list)
    fingerprint = Column(String(64), unique=True, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), nullable=True)

    # Relationships
    scan = relationship("Scan", back_populates="findings")
    task = relationship("AgentTask", back_populates="findings")
    remediation = relationship("Remediation", back_populates="finding", uselist=False)