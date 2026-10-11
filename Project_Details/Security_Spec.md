# SentinelAI: Complete Security Specification

## Overview
This document outlines the comprehensive security architecture and specifications for SentinelAI, an Enterprise Agentic AI Security Operating System. As a platform designed to autonomously perform security analysis and validation, it demands the highest level of defense-in-depth, strictly adhering to OWASP ASVS (Application Security Verification Standard) v4.0.3 and industry best practices.

## 1. Threat Model & Trust Boundaries
- **Core Threat Model:** We assume a "Zero Trust" model. Threats include malicious users, compromised external dependencies, and notably, compromised or hallucinating AI agents. A malicious payload within analyzed source code (e.g., indirect prompt injection) must not compromise the agent or the broader system.
- **Trust Boundaries:**
  - **External:** Internet (User Traffic, Webhooks) -> WAF -> API Gateway.
  - **Internal (Control Plane):** API Gateway -> Go Orchestrator -> Database. Highly trusted, requires mTLS.
  - **Agent Sandbox (Data Plane):** Kafka -> Python Agent Runners -> LLM API. Untrusted execution. Isolated via Firecracker microVMs.
  - **LLM Boundary:** Agent Runner -> Prompt Guardrail -> External LLM API.

## 2. Authentication & Session Management
- **Provider:** **Supabase Auth** — the single source of truth for user identity. Handles registration, login, session refresh, MFA, and OAuth.
- **Supported Sign-in Methods:**
  - Email/Password (with Argon2id-equivalent hashing managed by Supabase)
  - Magic Link (passwordless)
  - OAuth 2.0: GitHub, Google, Microsoft (Entra ID)
  - SAML 2.0: Okta, PingIdentity, Azure AD (Enterprise plan)
- **MFA:** TOTP (Authenticator App) via Supabase MFA API. Mandatory for `CISO` and `Superadmin` roles, enforced via a post-sign-in MFA challenge check.
- **Session Management:**
  - Sessions are managed by the Supabase client SDK using HTTP-Only, Secure, SameSite=Strict cookies.
  - Access Tokens are short-lived (1 hour). Refresh Tokens are rotated automatically by the Supabase SDK on each use.
  - Absolute session timeout: 24 hours; idle timeout: 30 minutes (configured in Supabase Auth settings).
- **JWT Strategy:**
  - JWTs are signed using RS256 (asymmetric). The signing key is managed by Supabase and rotated automatically.
  - Standard claims: `sub`, `exp`, `iat`, `email`, `role`.
  - Custom claims injected via **Supabase Auth Hook** (`custom_access_token_hook`): `app_metadata.tenant_id`, `app_metadata.app_role`.
  - JWTs are validated at the FastAPI gateway using Supabase's JWKS endpoint.
- **OAuth / OIDC:** Configured via Supabase Auth Providers (no custom Identity Provider infrastructure needed for standard OAuth flows).

## 3. Authorization & RBAC
- **RBAC (Role-Based Access Control):** Roles are stored in Supabase JWT `app_metadata.app_role`: `Viewer`, `Engineer`, `CISO`, `Superadmin`.
- **Row-Level Security (RLS):** Supabase RLS policies enforce tenant isolation at the PostgreSQL database layer. A user can only access rows where `tenant_id` matches their JWT claim — requiring zero application-level tenant filtering for most queries.
- **ABAC (Attribute-Based Access Control):** Additional attribute-based policies are layered via custom RLS conditions and FastAPI service-layer checks.
- **Superadmin Gating:** Highly sensitive operations (specifically the **Exploit Generation Module**) enforce strict programmatic checks ensuring the `Superadmin` claim is present in the validated JWT. Additionally, a dedicated Supabase RLS policy restricts direct table access to the `service_role` key only.

## 4. API Security & Rate Limiting
- All API endpoints require mutual authentication (mTLS) internally.
- External APIs enforce rate limiting via Redis (Sliding Window Log algorithm). Example: 100 requests per IP per minute; 1000 requests per Tenant per minute.
- API Keys used for CI/CD integration are heavily scoped (write-only for triggering scans), encrypted at rest, and automatically rotated every 90 days.

## 5. Secrets Management & Encryption
- **Data at Rest:** All databases (PostgreSQL, Qdrant, Elasticsearch) and S3 buckets use AES-256-GCM encryption at rest. Customer Managed Keys (CMK) via AWS KMS / HashiCorp Vault are supported.
- **Data in Transit:** TLS 1.3 is strictly enforced for all external and internal network communication. Downgrades are rejected.
- **Secrets:** Hardcoded secrets are explicitly banned. HashiCorp Vault or AWS Secrets Manager injects database credentials and LLM API keys at runtime as ephemeral environment variables.

## 6. Input Validation & File Upload Security
- **Input Validation:** Strict allow-list validation using strong typing (Go structs, Pydantic) and regex patterns. All input is treated as hostile.
- **File Upload Security:** 
  - Uploads (e.g., custom configuration files) are streamed directly to an isolated, sandboxed S3 bucket.
  - Files are scanned by ClamAV and a dedicated Malware Analysis Agent before processing.
  - File extensions and MIME types are cryptographically validated against magic numbers.

## 7. OWASP Top 10 Protection
- **Injection (SQL/NoSQL):** Prevented via strict use of parameterized queries and ORMs (sqlc/gorm).
- **Broken Authentication:** Mitigated via OIDC, mandatory MFA, and secure cookie attributes.
- **XSS (Cross-Site Scripting):** Mitigated by Next.js/React's default contextual output encoding. Strict Content Security Policy (CSP) headers block inline scripts and `eval()`.
- **CSRF (Cross-Site Request Forgery):** Mitigated by stateless JWT architecture, `SameSite=Strict` cookies, and custom `X-CSRF-Token` headers for state-changing operations.
- **SSRF (Server-Side Request Forgery):** Webhooks and DAST agent network requests are routed through a dedicated egress proxy that drops traffic to internal IP ranges (10.0.0.0/8, 169.254.169.254, etc.).

## 8. Agent Security (AI-Specific Protections)
Given SentinelAI's autonomous nature, safeguarding the agents is paramount.
- **Prompt Injection (Direct & Indirect):** 
  - All data ingested from target repositories is sanitized.
  - A dedicated **Prompt Guardrail Agent** analyzes all outgoing LLM requests and incoming responses to detect injection patterns, hidden text, and Base64 encoded attacks.
- **RAG Security:** Vector DB (Qdrant) data is strictly partitioned by tenant. Embeddings are filtered through a PII/Secrets detection pipeline before storage to prevent sensitive data leakage into semantic memory.
- **Execution Sandbox:** When an agent decides to execute code (e.g., Exploit Validation), the code runs in an ephemeral Firecracker microVM. The VM has zero network access by default, dropped capabilities, and is destroyed immediately after execution.
- **Context & Memory Isolation:** Agents are prohibited from sharing raw memory buffers. The **Context Isolation Agent** redacts sensitive project details before cross-agent peer review.

## 9. Audit Logs & Monitoring
- **Immutable Audit Trails:** Every tool invocation, memory read/write, LLM request/response, and authentication event is logged to Elasticsearch. These logs are append-only and cryptographically signed to ensure non-repudiation.
- **Monitoring:** Datadog/Prometheus tracks system telemetry. Alerts are configured for:
  - Agent sandbox escape attempts.
  - Repeated Prompt Injection triggers.
  - Anomalous token consumption spikes.

## 10. Incident Response & Compliance
- **Kill Switches:** The Orchestrator exposes an emergency `/api/v1/system/halt` endpoint (Superadmin only) that instantly severs all LLM connections and destroys all active sandboxes.
- **Compliance Mapping:** Designed to meet or exceed requirements for SOC 2 Type II, ISO 27001, HIPAA, and GDPR. The platform guarantees data residency and provides automated DSR (Data Subject Request) tooling.
