# app/api/v1/websockets.py
from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Query, status
from fastapi.security import HTTPAuthorizationCredentials
from typing import Dict, Set
import asyncio
import structlog

from app.database.supabase import get_supabase_client
from app.dependencies import get_current_user_with_supabase, get_tenant_id

logger = structlog.get_logger(__name__)
router = APIRouter()


class ConnectionManager:
    """Manages WebSocket connections for real-time agent log streaming"""

    def __init__(self):
        # scan_id -> set of connected websockets
        self.scan_connections: Dict[str, Set[WebSocket]] = {}
        # agent_id -> set of connected websockets
        self.agent_connections: Dict[str, Set[WebSocket]] = {}

    async def connect(self, websocket: WebSocket, room: str, room_type: str = "scan"):
        await websocket.accept()

        if room_type == "scan":
            if room not in self.scan_connections:
                self.scan_connections[room] = set()
            self.scan_connections[room].add(websocket)
        elif room_type == "agent":
            if room not in self.agent_connections:
                self.agent_connections[room] = set()
            self.agent_connections[room].add(websocket)

        logger.info("ws_connected", room=room, room_type=room_type)

    async def disconnect(self, websocket: WebSocket, room: str, room_type: str = "scan"):
        if room_type == "scan" and room in self.scan_connections:
            self.scan_connections[room].discard(websocket)
        elif room_type == "agent" and room in self.agent_connections:
            self.agent_connections[room].discard(websocket)

    async def broadcast_to_scan(self, scan_id: str, message: dict):
        """Broadcast message to all clients watching a scan"""
        connections = self.scan_connections.get(scan_id, set())
        dead = set()

        for ws in connections:
            try:
                await ws.send_json(message)
            except Exception:
                dead.add(ws)

        # Clean up dead connections
        for ws in dead:
            connections.discard(ws)

    async def broadcast_to_agent(self, agent_id: str, message: dict):
        """Broadcast to clients watching a specific agent"""
        connections = self.agent_connections.get(agent_id, set())
        for ws in connections:
            try:
                await ws.send_json(message)
            except Exception:
                pass


manager = ConnectionManager()


@router.websocket("/ws/scans/{scan_id}")
async def scan_websocket(
    websocket: WebSocket,
    scan_id: str,
    token: str = Query(default=""),
):
    """WebSocket endpoint for real-time scan progress and agent logs"""
    if not token:
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION, reason="Missing token")
        return

    try:
        credentials = HTTPAuthorizationCredentials(scheme="Bearer", credentials=token)
        current_user = await get_current_user_with_supabase(credentials)
        tenant_id = await get_tenant_id(current_user)
    except Exception:
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION, reason="Invalid token")
        return

    supabase = get_supabase_client()
    scan_check = supabase.rpc(
        "get_scan_with_tenant_check",
        {"p_scan_id": scan_id, "p_tenant_id": tenant_id},
    ).execute()
    if not scan_check.data:
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION, reason="Scan access denied")
        return

    await manager.connect(websocket, scan_id, "scan")
    last_scan_state = None
    last_task_hash = ""

    try:
        while True:
            try:
                data = await asyncio.wait_for(websocket.receive_text(), timeout=2.0)
                if data == "ping":
                    await websocket.send_text("pong")
            except asyncio.TimeoutError:
                scan = supabase.table("scans").select("*").eq("id", scan_id).single().execute()
                if scan.data and scan.data != last_scan_state:
                    event_type = "SCAN_STATE" if last_scan_state is None else "SCAN_UPDATE"
                    await websocket.send_json({"type": event_type, "data": scan.data})
                    last_scan_state = scan.data

                tasks = (
                    supabase.table("agent_tasks")
                    .select("id,agent_type,status,updated_at,completed_at,error_message")
                    .eq("scan_id", scan_id)
                    .order("updated_at", desc=True)
                    .limit(10)
                    .execute()
                )

                task_list = tasks.data or []
                task_hash = "|".join(
                    f"{task.get('id')}:{task.get('status')}:{task.get('updated_at')}"
                    for task in task_list
                )
                if task_hash and task_hash != last_task_hash:
                    await websocket.send_json({
                        "type": "AGENT_TASK_UPDATE",
                        "data": task_list,
                    })
                    last_task_hash = task_hash

                await websocket.send_json({"type": "HEARTBEAT"})

    except WebSocketDisconnect:
        await manager.disconnect(websocket, scan_id, "scan")
        logger.info("ws_disconnected", scan_id=scan_id)