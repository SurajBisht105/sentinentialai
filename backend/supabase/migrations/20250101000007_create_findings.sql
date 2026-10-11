-- supabase/migrations/20250101000007_create_findings.sql
-- ============================================================
-- SentinelAI — Findings Table
-- Security vulnerability findings from agent analysis
-- ============================================================

CREATE TABLE IF NOT EXISTS public.findings (
    -- Primary key
    id                          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    -- Relations
    scan_id                     UUID NOT NULL REFERENCES public.scans(id) ON DELETE CASCADE,
    task_id                     UUID REFERENCES public.agent_tasks(id) ON DELETE SET NULL,
    tenant_id                   UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    project_id                  UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,

    -- Classification
    severity                    severity_level NOT NULL,
    title                       VARCHAR(255) NOT NULL,
    description                 TEXT NOT NULL,

    -- Vulnerability identifiers
    cwe_id                      VARCHAR(20),   -- e.g., "CWE-89"
    cve_id                      VARCHAR(20),   -- e.g., "CVE-2024-1234"
    owasp_category              VARCHAR(50),   -- e.g., "A1:2021-Injection"
    cvss_score                  NUMERIC(4, 1), -- 0.0 - 10.0

    -- Location
    file_path                   VARCHAR(1000),
    line_number                 INTEGER,
    column_number               INTEGER,
    code_snippet                TEXT,          -- Vulnerable code snippet

    -- Detection
    detecting_agent             VARCHAR(50),
    detection_method            VARCHAR(50),   -- STATIC, DYNAMIC, PATTERN, ML

    -- Consensus verification
    verified_by_consensus       BOOLEAN NOT NULL DEFAULT FALSE,
    consensus_score             NUMERIC(5, 4), -- 0-1 confidence
    consensus_agents_agreed     INTEGER NOT NULL DEFAULT 0,
    consensus_agents_total      INTEGER NOT NULL DEFAULT 0,

    -- False positive management
    false_positive              BOOLEAN NOT NULL DEFAULT FALSE,
    false_positive_reason       TEXT,
    false_positive_marked_by    UUID REFERENCES public.profiles(id),
    false_positive_marked_at    TIMESTAMPTZ,

    -- Status tracking
    is_resolved                 BOOLEAN NOT NULL DEFAULT FALSE,
    resolved_at                 TIMESTAMPTZ,
    resolved_by                 UUID REFERENCES public.profiles(id),

    -- Evidence & context
    evidence                    JSONB NOT NULL DEFAULT '{}',
    attack_vector               VARCHAR(50),
    exploitability              VARCHAR(20),   -- EASY, MEDIUM, HARD
    proof_of_concept            TEXT,
    "references"                JSONB NOT NULL DEFAULT '[]',

    -- Rich metadata
    metadata                    JSONB NOT NULL DEFAULT '{}',
    tags                        TEXT[],

    -- Deduplication
    fingerprint                 VARCHAR(64) UNIQUE,  -- SHA-256 hash for dedup

    -- Timestamps
    created_at                  TIMESTAMPTZ NOT NULL DEFAULT TIMEZONE('utc', NOW()),
    updated_at                  TIMESTAMPTZ,

    -- Constraints
    CONSTRAINT findings_cvss_range CHECK (cvss_score IS NULL OR cvss_score BETWEEN 0 AND 10),
    CONSTRAINT findings_consensus_range CHECK (
        consensus_score IS NULL OR consensus_score BETWEEN 0 AND 1
    ),
    CONSTRAINT findings_line_positive CHECK (line_number IS NULL OR line_number > 0)
);

-- Indexes
CREATE INDEX idx_findings_scan_id ON public.findings(scan_id);
CREATE INDEX idx_findings_tenant_id ON public.findings(tenant_id);
CREATE INDEX idx_findings_project_id ON public.findings(project_id);
CREATE INDEX idx_findings_severity ON public.findings(severity);
CREATE INDEX idx_findings_cwe_id ON public.findings(cwe_id);
CREATE INDEX idx_findings_cve_id ON public.findings(cve_id);
CREATE INDEX idx_findings_verified ON public.findings(verified_by_consensus);
CREATE INDEX idx_findings_false_positive ON public.findings(false_positive);
CREATE INDEX idx_findings_is_resolved ON public.findings(is_resolved);
CREATE INDEX idx_findings_created_at ON public.findings(created_at DESC);
CREATE INDEX idx_findings_fingerprint ON public.findings(fingerprint);

-- Composite indexes for dashboard queries
CREATE INDEX idx_findings_tenant_severity ON public.findings(tenant_id, severity)
    WHERE false_positive = FALSE;

CREATE INDEX idx_findings_project_open ON public.findings(project_id, severity)
    WHERE false_positive = FALSE AND is_resolved = FALSE;

-- GIN indexes for JSONB
CREATE INDEX idx_findings_metadata_gin ON public.findings USING GIN (metadata);
CREATE INDEX idx_findings_evidence_gin ON public.findings USING GIN (evidence);
CREATE INDEX idx_findings_tags_gin ON public.findings USING GIN (tags);

-- Full-text search
CREATE INDEX idx_findings_fts ON public.findings
    USING GIN (to_tsvector('english', title || ' ' || description));

-- Auto-update trigger
CREATE TRIGGER set_findings_updated_at
    BEFORE UPDATE ON public.findings
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Generate fingerprint on insert
CREATE OR REPLACE FUNCTION generate_finding_fingerprint()
RETURNS TRIGGER AS $$
BEGIN
    -- Create unique fingerprint based on key attributes
    NEW.fingerprint = encode(
        digest(
            COALESCE(NEW.cwe_id, '') ||
            COALESCE(NEW.file_path, '') ||
            COALESCE(NEW.line_number::TEXT, '') ||
            COALESCE(NEW.title, '') ||
            NEW.project_id::TEXT,
            'sha256'
        ),
        'hex'
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_finding_fingerprint
    BEFORE INSERT ON public.findings
    FOR EACH ROW
    EXECUTE FUNCTION generate_finding_fingerprint();

-- Update scan counters when finding is inserted
CREATE OR REPLACE FUNCTION update_scan_finding_counters()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        UPDATE public.scans
        SET
            finding_count = finding_count + 1,
            critical_count = critical_count + CASE WHEN NEW.severity = 'CRITICAL' THEN 1 ELSE 0 END,
            high_count = high_count + CASE WHEN NEW.severity = 'HIGH' THEN 1 ELSE 0 END,
            medium_count = medium_count + CASE WHEN NEW.severity = 'MEDIUM' THEN 1 ELSE 0 END,
            low_count = low_count + CASE WHEN NEW.severity = 'LOW' THEN 1 ELSE 0 END,
            updated_at = TIMEZONE('utc', NOW())
        WHERE id = NEW.scan_id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_scan_counters_on_finding
    AFTER INSERT ON public.findings
    FOR EACH ROW
    EXECUTE FUNCTION update_scan_finding_counters();

-- Realtime publication
ALTER PUBLICATION supabase_realtime ADD TABLE public.findings;

-- RLS Enable
ALTER TABLE public.findings ENABLE ROW LEVEL SECURITY;

-- Comments
COMMENT ON TABLE public.findings IS 'Security vulnerability findings detected by AI agents';
COMMENT ON COLUMN public.findings.fingerprint IS 'SHA-256 fingerprint for finding deduplication';
COMMENT ON COLUMN public.findings.consensus_score IS 'Multi-agent consensus confidence 0-1';
COMMENT ON COLUMN public.findings.evidence IS 'Agent evidence: {"code_match": "...", "pattern": "..."}';