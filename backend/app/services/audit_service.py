# app/services/audit_service.py
from typing import Dict, Any, Optional
from datetime import datetime
import structlog
import hashlib
import hmac

from app.config import settings
from app.database.supabase import get_supabase_client

logger = structlog.get_logger(__name__)


class AuditService:
    """
    Immutable audit logging service with cryptographic signatures
    """

    def __init__(self):
        self.supabase = get_supabase_client()
        self.secret_key = settings.SECRET_KEY.encode()

    async def log_event(
        self,
        actor_type: str,
        actor_id: str,
        actor_email: Optional[str],
        action: str,
        resource_type: Optional[str],
        resource_id: Optional[str],
        details: Dict[str, Any],
        ip_address: Optional[str],
        risk_level: str,
    ):
        """
        Log event to immutable audit trail
        """
        if not settings.AUDIT_LOG_ENABLED:
            return

        timestamp = datetime.utcnow()

        # Create cryptographic signature for immutability
        signature = self.create_signature(
            actor_type=actor_type,
            actor_id=actor_id,
            action=action,
            timestamp=timestamp,
            details=details,
        )

        # Insert audit log
        try:
            self.supabase.table("audit_logs").insert({
                "created_at": timestamp.isoformat(),
                "actor_type": actor_type,
                "actor_id": actor_id,
                "actor_email": actor_email,
                "action": action,
                "resource_type": resource_type,
                "resource_id": resource_id,
                "details": details,
                "actor_ip": ip_address,
                "risk_level": risk_level,
                "signature": signature,
            }).execute()

            logger.info(
                "audit_log_created",
                action=action,
                actor_type=actor_type,
                actor_id=actor_id,
                risk_level=risk_level,
            )

        except Exception as e:
            logger.error("audit_log_failed", action=action, error=str(e))

    def create_signature(
        self,
        actor_type: str,
        actor_id: str,
        action: str,
        timestamp: datetime,
        details: Dict[str, Any],
    ) -> str:
        """
        Create HMAC signature for audit log immutability
        """
        import json

        message = f"{actor_type}:{actor_id}:{action}:{timestamp.isoformat()}:{json.dumps(details, sort_keys=True)}"
        signature = hmac.new(
            self.secret_key,
            message.encode(),
            hashlib.sha256,
        ).hexdigest()

        return f"sha256:{signature}"

    async def query_logs(
        self,
        actor_type: Optional[str] = None,
        action: Optional[str] = None,
        risk_level: Optional[str] = None,
        start_date: Optional[datetime] = None,
        end_date: Optional[datetime] = None,
        limit: int = 100,
    ) -> list:
        """
        Query audit logs with filters
        """
        query = self.supabase.table("audit_logs").select("*").order("created_at", desc=True).limit(limit)

        if actor_type:
            query = query.eq("actor_type", actor_type)
        if action:
            query = query.eq("action", action)
        if risk_level:
            query = query.eq("risk_level", risk_level)
        if start_date:
            query = query.gte("created_at", start_date.isoformat())
        if end_date:
            query = query.lte("created_at", end_date.isoformat())

        response = query.execute()
        return response.data