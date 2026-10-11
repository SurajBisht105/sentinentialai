# app/models/tenant.py
from sqlalchemy import Column, String, DateTime, UUID
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.database.session import Base
import uuid


class Tenant(Base):
    __tablename__ = "tenants"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String(200), unique=True, nullable=False)
    plan = Column(String(50), default="Free")  # Free, Pro, Enterprise
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    deleted_at = Column(DateTime(timezone=True), nullable=True)

    # Relationships
    users = relationship("User", back_populates="tenant")
    projects = relationship("Project", back_populates="tenant")