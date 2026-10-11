-- supabase/migrations/20250101000005_create_scans.sql
-- ============================================================
-- SentinelAI — Scans Table
-- ============================================================

CREATE TABLE IF NOT EXISTS public.scans (
    -- Primary key
    id                      UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    -- Relations
    project_id              UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
    tenant_id               UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    initiated_by            UUID REFERENCES public.profiles(id) ON DELETE SET NULL,

    -- Scan configuration
    status                  scan_status NOT NULL DEFAULT 'QUEUED',
    scan_types              TEXT[] NOT NULL,
    branch                  VARCHAR(100) NOT NULL DEFAULT 'main',
    commit_sha              VARCHAR(40),
    target_url              VARCHAR(500),

    -- Trigger info
    trigger_type            VARCHAR(20) NOT NULL DEFAULT 'MANUAL',  -- MANUAL, CI_CD, SCHEDULED, WEBHOOK
    trigger_metadata        JSONB NOT NULL DEFAULT '{}',

    -- Progress tracking
    progress_percent        INTEGER NOT NULL DEFAULT 0,
    total_agents            INTEGER NOT NULL DEFAULT 0,
    completed_agents        INTEGER NOT NULL DEFAULT 0,
    failed_agents           INTEGER NOT NULL DEFAULT 0,

    -- Results (denormalized for dashboard performance)
    finding_count           INTEGER NOT NULL DEFAULT 0,
    critical_count          INTEGER NOT NULL DEFAULT 0,
    high_count              INTEGER NOT NULL DEFAULT 0,
    medium_count            INTEGER NOT NULL DEFAULT 0,
    low_count               INTEGER NOT NULL DEFAULT 0,
    false_positive_count    INTEGER NOT NULL DEFAULT 0,

    -- AI metrics
    total_tokens_used       INTEGER NOT NULL DEFAULT 0,
    llm_calls_count         INTEGER NOT NULL DEFAULT 0,
    hallucination_score     NUMERIC(5, 4),  -- 0.0000 - 1.0000
    consensus_confidence    NUMERIC(5, 4),

    -- Timing
    duration_seconds        INTEGER,
    queued_at               TIMESTAMPTZ NOT NULL DEFAULT TIMEZONE('utc', NOW()),
    started_at              TIMESTAMPTZ,
    completed_at            TIMESTAMPTZ,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT TIMEZONE('utc', NOW()),
    updated_at              TIMESTAMPTZ,

    -- Error handling
    error_message           TEXT,
    retry_count             INTEGER NOT NULL DEFAULT 0,
    max_retries             INTEGER NOT NULL DEFAULT 3,

    -- Constraints
    CONSTRAINT scans_progress_range CHECK (progress_percent BETWEEN 0 AND 100),
    CONSTRAINT scans_hallucination_range CHECK (hallucination_score IS NULL OR hallucination_score BETWEEN 0 AND 1),
    CONSTRAINT scans_consensus_range CHECK (consensus_confidence IS NULL OR consensus_confidence BETWEEN 0 AND 1)
);

-- Indexes
CREATE INDEX idx_scans_project_id ON public.scans(project_id);
CREATE INDEX idx_scans_tenant_id ON public.scans(tenant_id);
CREATE INDEX idx_scans_status ON public.scans(status);
CREATE INDEX idx_scans_initiated_by ON public.scans(initiated_by);
CREATE INDEX idx_scans_created_at ON public.scans(created_at DESC);
CREATE INDEX idx_scans_tenant_status ON public.scans(tenant_id, status);
CREATE INDEX idx_scans_project_created ON public.scans(project_id, created_at DESC);

-- Partial index for active scans
CREATE INDEX idx_scans_active ON public.scans(tenant_id, started_at)
    WHERE status IN ('QUEUED', 'RUNNING');

-- Auto-update trigger
CREATE TRIGGER set_scans_updated_at
    BEFORE UPDATE ON public.scans
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Auto-update project stats when scan completes
CREATE OR REPLACE FUNCTION update_project_on_scan_complete()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.status = 'COMPLETED' AND OLD.status != 'COMPLETED' THEN
        UPDATE public.projects
        SET
            total_scans = total_scans + 1,
            last_scan_at = NEW.completed_at,
            open_findings = (
                SELECT COUNT(*) FROM public.findings
                WHERE scan_id = NEW.id AND false_positive = FALSE
            ),
            critical_findings = (
                SELECT COUNT(*) FROM public.findings
                WHERE scan_id = NEW.id AND severity = 'CRITICAL' AND false_positive = FALSE
            ),
            updated_at = TIMEZONE('utc', NOW())
        WHERE id = NEW.project_id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_project_on_scan_status_change
    AFTER UPDATE OF status ON public.scans
    FOR EACH ROW
    EXECUTE FUNCTION update_project_on_scan_complete();

-- Realtime publication
ALTER PUBLICATION supabase_realtime ADD TABLE public.scans;

-- RLS Enable
ALTER TABLE public.scans ENABLE ROW LEVEL SECURITY;

-- Comments
COMMENT ON TABLE public.scans IS 'Multi-agent security scan runs';
COMMENT ON COLUMN public.scans.scan_types IS 'Array of scan types: SAST, DAST, SCA, SECRETS, IaC';
COMMENT ON COLUMN public.scans.hallucination_score IS 'LLM hallucination score 0-1, lower is better';
COMMENT ON COLUMN public.scans.consensus_confidence IS 'Consensus engine confidence 0-1, higher is better';