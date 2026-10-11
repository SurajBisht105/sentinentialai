# app/models/audit_log.py
from sqlalchemy import Column, String, DateTime, UUID, Text, JSON, Integer
from sqlalchemy.sql import func
from app.database.session import Base
import uuid


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    timestamp = Column(DateTime(timezone=True), server_default=func.now(), nullable=False, index=True)
    actor_type = Column(String(20), nullable=False)  # USER, AGENT, SYSTEM
    actor_id = Column(String(255), nullable=False)
    actor_email = Column(String(255))
    action = Column(String(100), nullable=False, index=True)
    resource_type = Column(String(50))
    resource_id = Column(String(255))
    details = Column(JSON, default=dict)
    ip_address = Column(String(45))
    risk_level = Column(String(20))  # LOW, MEDIUM, HIGH, CRITICAL
    signature = Column(Text)  # Cryptographic signature for immutability

    __table_args__ = (
        {"postgresql_partition_by": "RANGE (timestamp)"},
    )