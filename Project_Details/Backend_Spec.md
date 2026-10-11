# SentinelAI: Backend Specification Document

## Overview
This document outlines the backend architecture and technical specifications for SentinelAI. The backend is designed as an event-driven, microservices-oriented system. The core orchestration and API layer, as well as the Agent logic layer, are written entirely in **Python (FastAPI/LangChain)**. They communicate asynchronously via **Apache Kafka**.

## 1. Folder Structure (Python FastAPI)
A standard Python domain-driven project layout:

```text
/backend
 /app
   /api               # FastAPI routers and endpoints
   /core              # Configuration, auth middleware, rate limiting
   /models            # SQLAlchemy ORM models & Pydantic schemas
   /services          # Business logic implementation
   /repositories      # Database access layer (PostgreSQL / Qdrant)
   /kafka             # Kafka producers and consumers (aiokafka)
   /agents            # Langchain / LlamaIndex agent definitions
   /utils             # Helpers and common logic
 /tests               # Pytest suite
 /alembic             # SQL migration files
 /main.py             # FastAPI entrypoint
```

## 2. Service Architecture
- **API Gateway/Orchestrator (Python FastAPI):** The primary entry point. Handles HTTP requests, Supabase JWT validation, rate limiting, DB reads/writes, and publishes task events to Kafka. Built on `uvicorn` and `gunicorn` for high concurrency.
- **Agent Runners (Python):** Consume events from Kafka, process prompts via the LLM Gateway, invoke sandboxed tools, and publish results back.
- **Event Bus (Kafka):** Decouples the fast HTTP layer from the slow, asynchronous LLM reasoning layer.
- **Databases:** Supabase (PostgreSQL + Auth + RLS), Qdrant (Vector Embeddings/RAG), Redis (Rate Limiting/Caching).

## 3. REST/GraphQL APIs
The core system exposes a **RESTful API** for standard CRUD operations and a **WebSocket API** for real-time agent execution streaming.

**Key Endpoints:**
- `POST /api/v1/scans` - Trigger a new multi-agent scan
- `GET /api/v1/scans/{scan_id}` - Get scan status
- `GET /api/v1/projects/{project_id}/vulnerabilities` - List findings
- `POST /api/v1/exploits/generate` - **(Superadmin Only)** Generate synthetic exploits

## 4. Request/Response Examples
**Trigger a Scan:**
*Request:*
```http
POST /api/v1/scans
Content-Type: application/json
Authorization: Bearer <JWT>

{
  "target_repo": "https://github.com/enterprise/core-service",
  "branch": "main",
  "scan_types": ["SAST", "SCA", "SECRETS"]
}
```
*Response (202 Accepted):*
```json
{
  "scan_id": "scn_01hxyz...",
  "status": "QUEUED",
  "message": "Scan initiated. Director agent is planning tasks."
}
```

## 5. Validation
- **Python validation:** Uses `Pydantic` models extensively to strictly validate incoming JSON payloads, LLM outputs, and database schemas.

## 6. Authentication
- **Supabase Auth:** The primary authentication provider. Supports Email/Password, Magic Link, OAuth (GitHub, Google, Microsoft), and SAML 2.0 for enterprise SSO.
- The FastAPI backend validates incoming Supabase JWTs by verifying the signature against the Supabase project's JWKS endpoint (`https://<project>.supabase.co/auth/v1/keys`).
- A FastAPI dependency (`get_current_user`) decodes the JWT, extracts `sub` (user UUID) and `app_metadata.app_role`, and injects them into the request context.
- **M2M (Machine-to-Machine):** Internal Python services (Agent Runners) authenticate with the orchestrator using the Supabase `service_role` key plus mutual TLS (mTLS).

## 7. Authorization & 8. RBAC
- Role claims are embedded in the Supabase JWT inside `app_metadata.app_role` (`Viewer`, `Engineer`, `CISO`, `Superadmin`).
- **RBAC Dependency:** FastAPI routes are annotated with required roles (e.g., `Depends(RoleChecker(["Superadmin"]))`). Non-compliant requests receive `HTTPException(403)`.
- **RLS (Row-Level Security):** Supabase enforces tenant isolation directly in PostgreSQL via RLS policies. The backend uses the user's JWT (not the service key) for standard queries so RLS applies automatically. The `service_role` key is reserved for trusted internal write operations (e.g., Agent Runners inserting findings).
- **ABAC:** Service-layer checks enforce additional attribute-based rules (e.g., verifying `user.tenant_id == project.tenant_id` before querying).

## 9. Database Access
- **Supabase (PostgreSQL):** Accessed via the official `supabase-py` Python client for RLS-aware queries (using the user JWT) and via `SQLAlchemy 2.0` (async) with the Supabase connection string for complex ORM operations. PgBouncer pooling is used via the Supabase Transaction Pooler URL.
- **Qdrant (Vector):** Accessed via the official Python gRPC/REST clients.
- **Migrations:** Managed via the **Supabase CLI** (`supabase migration new`, `supabase db push`). Migrations live in `supabase/migrations/` and are applied automatically in CI/CD.

## 10. Business Logic
Business logic is decoupled from FastAPI routers.
*Example Flow (Triggering a Scan):*
1. Router parses JSON using Pydantic and calls `ScanService.initiate_scan()`.
2. `ScanService` verifies the user has access to the target repository.
3. `ScanService` inserts a `Scan` record into PostgreSQL with status `QUEUED`.
4. `ScanService` produces a `TaskCreated` message to the `agent.tasks.director` Kafka topic via `aiokafka`.
5. Returns `202 Accepted`.

## 11. Error Handling
- Consistent JSON error structures via custom Exception Handlers in FastAPI:
```json
{
  "detail": {
    "code": "VALIDATION_FAILED",
    "message": "Invalid repository URL format.",
    "fields": ["target_repo must be a valid HTTPS URI"]
  }
}
```

## 12. Logging
- **Application Logs:** Structured JSON logging using `structlog` in Python. Includes trace IDs for cross-service correlation.
- **Audit Logs:** Security-relevant actions (e.g., generating an exploit) are immutably logged to Elasticsearch for compliance.

## 13. Rate Limiting
- Implemented via `slowapi` (Redis-backed).
- Limits are applied per API Key / Tenant ID.

## 14. Webhooks
- Emits webhooks to external systems (Slack, Jira) when critical events occur.
- Payloads are signed using HMAC (SHA-256) with a tenant-specific secret.

## 15. Background Jobs & 16. Queue Processing
- **Queue System:** **Apache Kafka** is the backbone.
- **Topics:** Designed per agent category (e.g., `agent.sast`, `agent.dast`).
- **Processing:** Python consumers (FastStream/aiokafka) read topics, execute LLM calls, and publish findings.
- **Dead Letter Queue (DLQ):** Failed tasks are routed to a DLQ topic for manual review.

## 17. Caching
- **Redis** is used for caching heavy computation results and LLM prompt responses (semantic caching).
- Session management is fully handled by **Supabase Auth** — Redis is no longer used for sessions.
- **Semantic Caching:** If an agent queries the LLM with an identical prompt, the cached response is returned to save costs.

## 18. AI Endpoints
- **LLM Gateway:** All Python agents route their foundation model calls through an internal LLM Gateway (e.g., LiteLLM).
- Enforces token quotas, handles model fallback, and logs usage.

## 19. Versioning
- URI Versioning is strictly used: `/api/v1/...`.

## 20. OpenAPI Specification
- FastAPI automatically generates the OpenAPI 3.0 specification.
- Swagger UI is hosted at `/docs` and ReDoc at `/redoc`.

## 21. Testing
- **Unit Tests:** `pytest` with `pytest-asyncio` for business logic, mocking DB/Kafka.
- **Integration Tests:** Utilizes `testcontainers-python` to spin up ephemeral PostgreSQL/Kafka/Redis.
