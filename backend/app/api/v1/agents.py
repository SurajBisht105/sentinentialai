# app/api/v1/agents.py
from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from typing import List, Optional
from pydantic import BaseModel

from app.dependencies import get_current_user_with_supabase, get_tenant_id
from app.agents.director_agent import DirectorAgent
from app.agents.registry import AgentFactory as AgentRegistry

router = APIRouter()


class AgentResponse(BaseModel):
    id: str
    name: str
    type: str
    status: str
    capabilities: List[str]
    last_active: Optional[str] = None


class TaskRequest(BaseModel):
    task_type: str
    target: str
    parameters: dict = {}


class TaskResponse(BaseModel):
    task_id: str
    status: str
    created_at: str


@router.get("/", response_model=List[AgentResponse])
async def get_agents(
    agent_type: Optional[str] = None,
    status: Optional[str] = None,
    current_user: dict = Depends(get_current_user_with_supabase),
    tenant_id: str = Depends(get_tenant_id)
):
    """
    Get list of agents for the tenant.
    """
    # Placeholder implementation
    registry = AgentRegistry()
    agents = registry.get_agents(tenant_id)
    if agent_type:
        agents = [a for a in agents if a.get("type") == agent_type]
    if status:
        agents = [a for a in agents if a.get("status") == status]
    return agents


@router.get("/{agent_id}", response_model=AgentResponse)
async def get_agent(
    agent_id: str = ...,
    current_user: dict = Depends(get_current_user_with_supabase),
    tenant_id: str = Depends(get_tenant_id)
):
    """
    Get a specific agent by ID.
    """
    # Placeholder implementation
    raise HTTPException(status_code=404, detail="Agent not found")


@router.post("/{agent_id}/tasks", response_model=TaskResponse)
async def create_agent_task(
    agent_id: str,
    task_request: TaskRequest,
    background_tasks: BackgroundTasks,
    current_user: dict = Depends(get_current_user_with_supabase),
    tenant_id: str = Depends(get_tenant_id)
):
    """
    Create a task for a specific agent.
    """
    # Placeholder implementation
    return {
        "task_id": "task-123",
        "status": "pending",
        "created_at": "2024-01-01T00:00:00Z"
    }


@router.post("/execute")
async def execute_security_scan(
    target: str,
    scan_types: List[str],
    current_user: dict = Depends(get_current_user_with_supabase),
    tenant_id: str = Depends(get_tenant_id)
):
    """
    Execute a security scan using the director agent.
    """
    # Placeholder implementation
    director = DirectorAgent()
    # In reality, this would dispatch to appropriate agents
    return {
        "message": f"Security scan initiated for {target}",
        "scan_id": "scan-123",
        "status": "started"
    }