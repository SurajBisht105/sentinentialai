-- supabase/migrations/20250101000008_create_remediations.sql
-- ============================================================
-- SentinelAI — Remediations Table
-- Agent-generated fixes and PR tracking
-- ============================================================

CREATE TABLE IF NOT EXISTS public.remediations (
    -- Primary key
    id                      UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    -- Relations
    finding_id              UUID NOT NULL REFERENCES public.findings(id) ON DELETE CASCADE,
    tenant_id               UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    generated_by_task_id    UUID REFERENCES public.agent_tasks(id) ON DELETE SET NULL,

    -- Remediation content
    proposed_code_fix       TEXT,
    fix_description         TEXT,
    fix_explanation         TEXT,

    -- Diff / patch
    unified_diff            TEXT,
    affected_files          TEXT[],

    -- PR information
    pr_url                  VARCHAR(500),
    pr_number               INTEGER,
    pr_title                VARCHAR(255),
    pr_branch               VARCHAR(100),
    pr_status               VARCHAR(20),  -- OPEN, MERGED, CLOSED

    -- Status tracking
    status                  remediation_status NOT NULL DEFAULT 'PENDING',
    approved_by             UUID REFERENCES public.profiles(id),
    approved_at             TIMESTAMPTZ,
    applied_by              UUID REFERENCES public.profiles(id),
    applied_at              TIMESTAMPTZ,
    rejected_by             UUID REFERENCES public.profiles(id),
    rejected_at             TIMESTAMPTZ,
    rejection_reason        TEXT,

    -- Verification
    verified_after_apply    BOOLEAN,
    verification_scan_id    UUID REFERENCES public.scans(id),

    -- Quality metrics
    fix_confidence          NUMERIC(5, 4),  -- 0-1
    fix_completeness        VARCHAR(20),    -- FULL, PARTIAL, WORKAROUND
    breaking_change         BOOLEAN NOT NULL DEFAULT FALSE,
    test_coverage_impact    VARCHAR(20),    -- IMPROVES, NEUTRAL, REDUCES

    -- Metadata
    metadata                JSONB NOT NULL DEFAULT '{}',

    -- Timestamps
    created_at              TIMESTAMPTZ NOT NULL DEFAULT TIMEZONE('utc', NOW()),
    updated_at              TIMESTAMPTZ,

    -- Constraints
    CONSTRAINT remediations_fix_confidence_range CHECK (
        fix_confidence IS NULL OR fix_confidence BETWEEN 0 AND 1
    )
);

-- Indexes
CREATE INDEX idx_remediations_finding_id ON public.remediations(finding_id);
CREATE INDEX idx_remediations_tenant_id ON public.remediations(tenant_id);
CREATE INDEX idx_remediations_status ON public.remediations(status);
CREATE INDEX idx_remediations_pr_url ON public.remediations(pr_url);
CREATE INDEX idx_remediations_created_at ON public.remediations(created_at DESC);

-- Auto-update trigger
CREATE TRIGGER set_remediations_updated_at
    BEFORE UPDATE ON public.remediations
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Mark finding as resolved when remediation is applied
CREATE OR REPLACE FUNCTION resolve_finding_on_remediation_applied()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.status = 'APPLIED' AND OLD.status != 'APPLIED' THEN
        UPDATE public.findings
        SET
            is_resolved = TRUE,
            resolved_at = TIMEZONE('utc', NOW()),
            resolved_by = NEW.applied_by,
            updated_at = TIMEZONE('utc', NOW())
        WHERE id = NEW.finding_id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER resolve_finding_on_remediation_status
    AFTER UPDATE OF status ON public.remediations
    FOR EACH ROW
    EXECUTE FUNCTION resolve_finding_on_remediation_applied();

-- RLS Enable
ALTER TABLE public.remediations ENABLE ROW LEVEL SECURITY;

-- Comments
COMMENT ON TABLE public.remediations IS 'Agent-generated remediation plans and PR tracking';
COMMENT ON COLUMN public.remediations.unified_diff IS 'Git unified diff format of proposed fix';
COMMENT ON COLUMN public.remediations.fix_confidence IS 'Agent confidence in fix quality 0-1';