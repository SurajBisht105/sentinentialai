-- supabase/migrations/20250101000019_create_indexes.sql
-- ============================================================
-- SentinelAI — Performance Indexes
-- Additional composite and specialized indexes
-- ============================================================

-- ============================================================
-- FINDINGS — High-frequency dashboard queries
-- ============================================================

-- CISO dashboard: Open critical/high findings by tenant
CREATE INDEX CONCURRENTLY IF NOT EXISTS
    idx_findings_ciso_dashboard
    ON public.findings (tenant_id, severity, created_at DESC)
    WHERE false_positive = FALSE
    AND is_resolved = FALSE
    AND severity IN ('CRITICAL', 'HIGH');

-- TTD (Time to Detect) analysis
CREATE INDEX CONCURRENTLY IF NOT EXISTS
    idx_findings_ttd_analysis
    ON public.findings (tenant_id, created_at, detecting_agent)
    WHERE false_positive = FALSE;

-- Finding deduplication check
CREATE INDEX CONCURRENTLY IF NOT EXISTS
    idx_findings_dedup_check
    ON public.findings (project_id, fingerprint);

-- ============================================================
-- SCANS — Scheduling and monitoring queries
-- ============================================================

-- Active scans monitoring
CREATE INDEX CONCURRENTLY IF NOT EXISTS
    idx_scans_active_monitoring
    ON public.scans (tenant_id, status, started_at)
    WHERE status IN ('QUEUED', 'RUNNING');

-- Scan performance analysis
CREATE INDEX CONCURRENTLY IF NOT EXISTS
    idx_scans_performance
    ON public.scans (tenant_id, duration_seconds, total_tokens_used)
    WHERE status = 'COMPLETED';

-- Scan type analysis
CREATE INDEX CONCURRENTLY IF NOT EXISTS
    idx_scans_types_gin
    ON public.scans USING GIN (scan_types);

-- ============================================================
-- AGENT TASKS — Performance monitoring
-- ============================================================

-- Agent performance by type
CREATE INDEX CONCURRENTLY IF NOT EXISTS
    idx_agent_tasks_performance
    ON public.agent_tasks (agent_type, latency_ms, tokens_total)
    WHERE status = 'COMPLETED';

-- Guardrail events
CREATE INDEX CONCURRENTLY IF NOT EXISTS
    idx_agent_tasks_guardrail_events
    ON public.agent_tasks (scan_id, created_at)
    WHERE guardrail_triggered = TRUE;

-- ============================================================
-- AUDIT LOGS — Compliance queries
-- ============================================================

-- High-risk event search
CREATE INDEX CONCURRENTLY IF NOT EXISTS
    idx_audit_logs_high_risk
    ON public.audit_logs (tenant_id, created_at DESC)
    WHERE risk_level IN ('HIGH', 'CRITICAL');

-- Action type search
CREATE INDEX CONCURRENTLY IF NOT EXISTS
    idx_audit_logs_action_search
    ON public.audit_logs USING GIN (to_tsvector('english', action || ' ' || actor_id));

-- ============================================================
-- COMPLIANCE — Framework analysis
-- ============================================================

-- Failing controls
CREATE INDEX CONCURRENTLY IF NOT EXISTS
    idx_compliance_controls_failing
    ON public.compliance_controls (report_id, category)
    WHERE status = 'FAIL';

-- ============================================================
-- THREAT INTEL — CVE searches
-- ============================================================

-- Recent critical CVEs
CREATE INDEX CONCURRENTLY IF NOT EXISTS
    idx_cve_recent_critical
    ON public.threat_intel_cve (published_date DESC, cvss_v3_score DESC)
    WHERE severity IN ('CRITICAL', 'HIGH');

-- KEV-listed CVEs
CREATE INDEX CONCURRENTLY IF NOT EXISTS
    idx_cve_kev_critical
    ON public.threat_intel_cve (published_date DESC)
    WHERE kev_listed = TRUE;

-- ============================================================
-- STATISTICS — pg_statistics extension
-- ============================================================

-- Force statistics collection on key columns
ANALYZE public.findings (severity, tenant_id, is_resolved, false_positive);
ANALYZE public.scans (status, tenant_id, created_at);
ANALYZE public.agent_tasks (agent_type, status, scan_id);
ANALYZE public.audit_logs (action, risk_level, created_at);