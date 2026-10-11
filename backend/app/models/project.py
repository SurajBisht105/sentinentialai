# app/models/project.py
from sqlalchemy import Column, String, DateTime, UUID, ForeignKey, Integer
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.database.session import Base
import uuid


class Project(Base):
    __tablename__ = "projects"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id = Column(UUID(as_uuid=True), ForeignKey("tenants.id"), nullable=False)
    name = Column(String(200), nullable=False)
    repo_url = Column(String(500), nullable=False)
    risk_score = Column(Integer, default=0)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    deleted_at = Column(DateTime(timezone=True), nullable=True)

    # Relationships
    tenant = relationship("Tenant", back_populates="projects")
    scans = relationship("Scan", back_populates="project")