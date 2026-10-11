# app/api/v1/router.py
from fastapi import APIRouter
from app.api.v1 import auth, scans, vulnerabilities, agents, projects, findings
from app.api.v1 import compliance, threat_intel, audit, exploits, integrations, settings, system

api_router = APIRouter()

# Auth
api_router.include_router(auth.router, prefix="/auth", tags=["Authentication"])

# Findings
api_router.include_router(findings.router, prefix="/findings", tags=["Findings"])

# Core Security
api_router.include_router(scans.router, prefix="/scans", tags=["Scans"])
api_router.include_router(vulnerabilities.router, prefix="/vulnerabilities", tags=["Vulnerabilities"])
api_router.include_router(agents.router, prefix="/agents", tags=["Agents"])
api_router.include_router(projects.router, prefix="/projects", tags=["Projects"])

# Governance
api_router.include_router(compliance.router, prefix="/compliance", tags=["Compliance"])
api_router.include_router(audit.router, prefix="/audit", tags=["Audit Logs"])

# Intelligence
api_router.include_router(threat_intel.router, prefix="/threat-intel", tags=["Threat Intelligence"])

# Advanced (Superadmin)
api_router.include_router(exploits.router, prefix="/exploits", tags=["Exploit Lab"])

# Configuration
api_router.include_router(integrations.router, prefix="/integrations", tags=["Integrations"])
api_router.include_router(settings.router, prefix="/settings", tags=["Settings"])

# System Dashboard
api_router.include_router(system.router, prefix="/system", tags=["System Dashboard"])