-- supabase/migrations/20250101000011_create_compliance_reports.sql
-- ============================================================
-- SentinelAI — Compliance Reports Tables
-- ============================================================

-- Compliance Report (per framework per tenant)
CREATE TABLE IF NOT EXISTS public.compliance_reports (
    id                      UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id               UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    project_id              UUID REFERENCES public.projects(id) ON DELETE SET NULL,

    -- Framework
    framework               compliance_framework NOT NULL,
    framework_version       VARCHAR(20),

    -- Scores
    overall_score           NUMERIC(5, 2) NOT NULL,   -- 0-100
    controls_total          INTEGER NOT NULL DEFAULT 0,
    controls_passing        INTEGER NOT NULL DEFAULT 0,
    controls_failing        INTEGER NOT NULL DEFAULT 0,
    controls_na             INTEGER NOT NULL DEFAULT 0,

    -- Assessment details
    assessment_date         TIMESTAMPTZ NOT NULL DEFAULT TIMEZONE('utc', NOW()),
    next_assessment_date    TIMESTAMPTZ,
    assessor_agent          VARCHAR(50),
    scan_id                 UUID REFERENCES public.scans(id),

    -- Report content
    executive_summary       TEXT,
    report_url              VARCHAR(500),

    -- Status
    status                  VARCHAR(20) NOT NULL DEFAULT 'DRAFT',  -- DRAFT, PUBLISHED, ARCHIVED
    is_certified            BOOLEAN NOT NULL DEFAULT FALSE,
    certified_by            UUID REFERENCES public.profiles(id),
    certified_at            TIMESTAMPTZ,

    -- Timestamps
    created_at              TIMESTAMPTZ NOT NULL DEFAULT TIMEZONE('utc', NOW()),
    updated_at              TIMESTAMPTZ,

    -- Constraints
    CONSTRAINT compliance_reports_score_range CHECK (overall_score BETWEEN 0 AND 100)
);

-- Individual Control Results
CREATE TABLE IF NOT EXISTS public.compliance_controls (
    id                      UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    report_id               UUID NOT NULL REFERENCES public.compliance_reports(id) ON DELETE CASCADE,
    tenant_id               UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,

    -- Control identification
    control_id              VARCHAR(50) NOT NULL,   -- e.g., "CC6.1", "8.8"
    control_name            VARCHAR(255) NOT NULL,
    control_description     TEXT,
    category                VARCHAR(100),

    -- Assessment
    status                  control_status NOT NULL DEFAULT 'IN_PROGRESS',
    evidence                TEXT,
    evidence_files          JSONB NOT NULL DEFAULT '[]',
    notes                   TEXT,
    finding_ids             UUID[],  -- Related findings

    -- Remediation
    remediation_required    BOOLEAN NOT NULL DEFAULT FALSE,
    remediation_plan        TEXT,
    remediation_due_date    TIMESTAMPTZ,

    -- Assessment metadata
    assessed_by_agent       VARCHAR(50),
    assessed_at             TIMESTAMPTZ,

    -- Timestamps
    created_at              TIMESTAMPTZ NOT NULL DEFAULT TIMEZONE('utc', NOW()),
    updated_at              TIMESTAMPTZ
);

-- Indexes
CREATE INDEX idx_compliance_reports_tenant_id ON public.compliance_reports(tenant_id);
CREATE INDEX idx_compliance_reports_framework ON public.compliance_reports(framework);
CREATE INDEX idx_compliance_reports_assessment_date ON public.compliance_reports(assessment_date DESC);
CREATE INDEX idx_compliance_reports_tenant_framework ON public.compliance_reports(tenant_id, framework);
CREATE INDEX idx_compliance_controls_report_id ON public.compliance_controls(report_id);
CREATE INDEX idx_compliance_controls_status ON public.compliance_controls(status);
CREATE INDEX idx_compliance_controls_control_id ON public.compliance_controls(control_id);

-- Auto-update triggers
CREATE TRIGGER set_compliance_reports_updated_at
    BEFORE UPDATE ON public.compliance_reports
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER set_compliance_controls_updated_at
    BEFORE UPDATE ON public.compliance_controls
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Auto-update report score when control status changes
CREATE OR REPLACE FUNCTION recalculate_compliance_score()
RETURNS TRIGGER AS $$
DECLARE
    v_total INTEGER;
    v_passing INTEGER;
    v_failing INTEGER;
    v_na INTEGER;
    v_score NUMERIC;
BEGIN
    SELECT
        COUNT(*),
        COUNT(*) FILTER (WHERE status = 'PASS'),
        COUNT(*) FILTER (WHERE status = 'FAIL'),
        COUNT(*) FILTER (WHERE status = 'NOT_APPLICABLE')
    INTO v_total, v_passing, v_failing, v_na
    FROM public.compliance_controls
    WHERE report_id = NEW.report_id;

    -- Score = passing / (total - na) * 100
    v_score := CASE WHEN (v_total - v_na) > 0
        THEN ROUND((v_passing::NUMERIC / (v_total - v_na)) * 100, 2)
        ELSE 0
    END;

    UPDATE public.compliance_reports
    SET
        overall_score = v_score,
        controls_total = v_total,
        controls_passing = v_passing,
        controls_failing = v_failing,
        controls_na = v_na,
        updated_at = TIMEZONE('utc', NOW())
    WHERE id = NEW.report_id;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER recalculate_score_on_control_update
    AFTER INSERT OR UPDATE OF status ON public.compliance_controls
    FOR EACH ROW
    EXECUTE FUNCTION recalculate_compliance_score();

-- RLS Enable
ALTER TABLE public.compliance_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.compliance_controls ENABLE ROW LEVEL SECURITY;

-- Comments
COMMENT ON TABLE public.compliance_reports IS 'Compliance assessment reports per framework per tenant';
COMMENT ON TABLE public.compliance_controls IS 'Individual compliance control assessment results';