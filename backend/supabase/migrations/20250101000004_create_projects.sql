-- supabase/migrations/20250101000004_create_projects.sql
-- ============================================================
-- SentinelAI — Projects Table
-- ============================================================

CREATE TABLE IF NOT EXISTS public.projects (
    -- Primary key
    id                      UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    -- Tenant association (multi-tenancy)
    tenant_id               UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,

    -- Created by
    created_by              UUID REFERENCES public.profiles(id) ON DELETE SET NULL,

    -- Project information
    name                    VARCHAR(200) NOT NULL,
    description             TEXT,
    repo_url                VARCHAR(500) NOT NULL,
    repo_type               VARCHAR(20) NOT NULL DEFAULT 'GITHUB',  -- GITHUB, GITLAB, BITBUCKET
    default_branch          VARCHAR(100) NOT NULL DEFAULT 'main',

    -- Technology stack (detected automatically)
    primary_language        VARCHAR(50),
    frameworks              TEXT[],
    tech_stack              JSONB NOT NULL DEFAULT '[]',

    -- Risk metrics (updated by agents)
    risk_score              INTEGER NOT NULL DEFAULT 0,  -- 0-100
    last_risk_assessment    TIMESTAMPTZ,

    -- Scan configuration
    auto_scan_enabled       BOOLEAN NOT NULL DEFAULT TRUE,
    scan_on_push            BOOLEAN NOT NULL DEFAULT TRUE,
    scan_on_pr              BOOLEAN NOT NULL DEFAULT TRUE,
    scan_types_default      TEXT[] NOT NULL DEFAULT ARRAY['SAST', 'SCA', 'SECRETS'],

    -- Counters (denormalized for performance)
    total_scans             INTEGER NOT NULL DEFAULT 0,
    total_findings          INTEGER NOT NULL DEFAULT 0,
    open_findings           INTEGER NOT NULL DEFAULT 0,
    critical_findings       INTEGER NOT NULL DEFAULT 0,

    -- Timestamps
    last_scan_at            TIMESTAMPTZ,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT TIMEZONE('utc', NOW()),
    updated_at              TIMESTAMPTZ,
    deleted_at              TIMESTAMPTZ,

    -- Constraints
    CONSTRAINT projects_repo_url_per_tenant UNIQUE (tenant_id, repo_url),
    CONSTRAINT projects_risk_score_range CHECK (risk_score BETWEEN 0 AND 100),
    CONSTRAINT projects_repo_url_format CHECK (repo_url ~ '^https?://')
);

-- Indexes
CREATE INDEX idx_projects_tenant_id ON public.projects(tenant_id);
CREATE INDEX idx_projects_repo_url ON public.projects(repo_url);
CREATE INDEX idx_projects_risk_score ON public.projects(risk_score DESC);
CREATE INDEX idx_projects_active ON public.projects(tenant_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_projects_last_scan ON public.projects(last_scan_at DESC);

-- Full-text search index
CREATE INDEX idx_projects_fts ON public.projects
    USING GIN (to_tsvector('english', name || ' ' || COALESCE(description, '')));

-- Auto-update trigger
CREATE TRIGGER set_projects_updated_at
    BEFORE UPDATE ON public.projects
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- RLS Enable
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;

-- Comments
COMMENT ON TABLE public.projects IS 'Security scanning target projects';
COMMENT ON COLUMN public.projects.risk_score IS 'Composite risk score 0-100, updated by agents';
COMMENT ON COLUMN public.projects.tech_stack IS 'Detected tech stack: [{"name": "React", "version": "18.0"}]';