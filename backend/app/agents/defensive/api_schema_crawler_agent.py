# app/agents/defensive/api_schema_crawler_agent.py
import asyncio
import httpx
import json
import structlog
from typing import Dict, Any, List, Optional
from urllib.parse import urljoin

from app.agents.base_agent import BaseAgent
from app.config import settings

logger = structlog.get_logger(__name__)


class APISchemaCrawlerAgent(BaseAgent):
    """
    API Schema & State-Machine Crawler Agent.

    Role:
    - Discovers hidden APIs and multi-step transaction flaws (e.g. Broken Object Level Authorization / BOLA).
    - Parses OpenAPI, Swagger, GraphQL schemas, and Postman collections.
    - Extracts undocumented query parameters, hidden HTTP verbs (PUT, PATCH, DELETE), and internal endpoints.
    - Feeds discovered endpoints to DAST and Auth-Bypass modules for systematic route coverage.
    """

    AGENT_TYPE = "API_SCHEMA_CRAWLER"
    DEFAULT_MODEL = settings.LLM_MODEL_FAST

    SCHEMA_PATHS = [
        "/openapi.json",
        "/swagger.json",
        "/api/swagger.json",
        "/api/v1/swagger.json",
        "/v2/api-docs",
        "/v3/api-docs",
        "/api/openapi.json",
        "/api/v1/openapi.json",
        "/docs",
        "/redoc",
        "/swagger-ui.html",
        "/graphql",
    ]

    async def execute(self, context: Dict[str, Any]) -> Dict[str, Any]:
        scan_id = context["scan_id"]
        target_url = context.get("target_url") or context.get("repo_url", "")

        self._add_reasoning_step(
            thought=f"Crawling target {target_url} for OpenAPI, Swagger, and GraphQL schema specifications",
            action="API_SCHEMA_DISCOVERY_START",
        )

        discovered_endpoints = []
        schema_findings = []

        if target_url and target_url.startswith("http"):
            async with httpx.AsyncClient(
                verify=False,
                timeout=7.0,
                follow_redirects=True,
                headers={"User-Agent": "SentinelAI-APICrawler/1.0"}
            ) as client:
                for path in self.SCHEMA_PATHS:
                    spec_url = urljoin(target_url.rstrip("/") + "/", path.lstrip("/"))
                    try:
                        resp = await client.get(spec_url)
                        if resp.status_code == 200:
                            # 1. Parse JSON Swagger / OpenAPI
                            if "swagger" in resp.text.lower() or "openapi" in resp.text.lower() or "paths" in resp.text:
                                endpoints = self._extract_openapi_endpoints(resp.text)
                                if endpoints:
                                    discovered_endpoints.extend(endpoints)
                                    finding = await self.report_finding(
                                        scan_id=scan_id,
                                        severity="MEDIUM",
                                        title=f"Exposed API Schema Documentation ({path})",
                                        description=f"Publicly accessible API schema found at {spec_url}. This reveals {len(endpoints)} internal API endpoints, parameters, and HTTP methods.",
                                        cwe_id="CWE-200",
                                        remediation="Ensure development/staging API documentation endpoints are protected by authentication or disabled in production.",
                                        file_path=spec_url,
                                        evidence={"schema_url": spec_url, "endpoint_count": len(endpoints)},
                                        metadata={"endpoints": endpoints[:20], "category": "API Security"}
                                    )
                                    schema_findings.append(finding)

                            # 2. Check GraphQL Introspection
                            if path == "/graphql":
                                gql_finding = await self._audit_graphql_introspection(client, spec_url, scan_id)
                                if gql_finding:
                                    schema_findings.append(gql_finding)

                    except Exception as e:
                        logger.debug("api_schema_probe_error", url=spec_url, error=str(e))

        self._add_reasoning_step(
            thought=f"Schema crawling complete: {len(discovered_endpoints)} API endpoints discovered across {len(schema_findings)} schemas",
            action="API_SCHEMA_DISCOVERY_COMPLETE",
        )

        return {
            "scan_id": scan_id,
            "status": "COMPLETED",
            "discovered_endpoints": discovered_endpoints,
            "findings_count": len(schema_findings),
        }

    def _extract_openapi_endpoints(self, raw_json: str) -> List[Dict[str, Any]]:
        """Parse paths and methods from OpenAPI/Swagger JSON"""
        endpoints = []
        try:
            data = json.loads(raw_json)
            paths = data.get("paths", {})
            for route, methods in paths.items():
                for method, details in methods.items():
                    if method.lower() in ["get", "post", "put", "patch", "delete", "options"]:
                        endpoints.append({
                            "path": route,
                            "method": method.upper(),
                            "summary": details.get("summary", ""),
                            "parameters": [p.get("name") for p in details.get("parameters", []) if isinstance(p, dict)],
                        })
        except Exception:
            pass
        return endpoints

    async def _audit_graphql_introspection(
        self, client: httpx.AsyncClient, gql_url: str, scan_id: str
    ) -> Optional[Dict[str, Any]]:
        """Probe for enabled GraphQL schema introspection query."""
        try:
            introspection_query = {"query": "{ __schema { types { name } } }"}
            resp = await client.post(gql_url, json=introspection_query)
            if resp.status_code == 200 and "__schema" in resp.text:
                return await self.report_finding(
                    scan_id=scan_id,
                    severity="MEDIUM",
                    title="GraphQL Schema Introspection Enabled",
                    description=f"The GraphQL endpoint at {gql_url} has introspection enabled, allowing attackers to query the complete database schema, mutations, and types.",
                    cwe_id="CWE-200",
                    remediation="Disable GraphQL introspection in production environments.",
                    file_path=gql_url,
                    evidence={"endpoint": gql_url, "query": introspection_query},
                    metadata={"category": "GraphQL Security"}
                )
        except Exception:
            pass
        return None
