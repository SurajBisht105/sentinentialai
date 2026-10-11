# app/services/finding_service.py
from typing import Dict, Any, List, Optional
import structlog

from app.database.supabase import get_supabase_client

logger = structlog.get_logger(__name__)


class FindingService:
    """Service for managing security findings"""

    def __init__(self):
        self.supabase = get_supabase_client()

    async def create_finding(self, finding_data: Dict[str, Any]) -> Dict:
        """Create a new finding record"""
        result = self.supabase.table("findings").insert(finding_data).execute()
        return result.data[0] if result.data else finding_data

    async def get_finding(self, finding_id: str) -> Optional[Dict]:
        """Get a finding by ID"""
        result = self.supabase.table("findings").select("*").eq("id", finding_id).single().execute()
        return result.data

    async def get_findings_by_scan(self, scan_id: str) -> List[Dict]:
        """Get all findings for a scan"""
        result = self.supabase.table("findings").select("*").eq("scan_id", scan_id).execute()
        return result.data or []

    async def update_finding(self, finding_id: str, update_data: Dict) -> Dict:
        """Update a finding"""
        result = self.supabase.table("findings").update(update_data).eq("id", finding_id).execute()
        return result.data[0] if result.data else {}
