-- supabase/migrations/20250101000002_create_tenants.sql
-- ============================================================
-- SentinelAI — Tenants Table
-- Multi-tenancy root entity
-- ============================================================

CREATE TABLE IF NOT EXISTS public.tenants (
    -- Primary key
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    -- Core fields
    name                VARCHAR(200) NOT NULL,
    slug                VARCHAR(200) NOT NULL,
    plan                tenant_plan NOT NULL DEFAULT 'Free',

    -- Configuration
    max_projects        INTEGER NOT NULL DEFAULT 3,
    max_scans_per_day   INTEGER NOT NULL DEFAULT 10,
    max_agents          INTEGER NOT NULL DEFAULT 10,
    retention_days      INTEGER NOT NULL DEFAULT 30,

    -- Contact
    billing_email       VARCHAR(255),
    company_name        VARCHAR(200),
    website_url         VARCHAR(500),

    -- Feature flags
    features            JSONB NOT NULL DEFAULT '{}',

    -- AI/LLM Configuration
    llm_token_quota     INTEGER NOT NULL DEFAULT 1000000,
    llm_tokens_used     INTEGER NOT NULL DEFAULT 0,
    llm_quota_reset_at  TIMESTAMPTZ,

    -- Metadata
    created_at          TIMESTAMPTZ NOT NULL DEFAULT TIMEZONE('utc', NOW()),
    updated_at          TIMESTAMPTZ,
    deleted_at          TIMESTAMPTZ,

    -- Constraints
    CONSTRAINT tenants_name_unique UNIQUE (name),
    CONSTRAINT tenants_slug_unique UNIQUE (slug),
    CONSTRAINT tenants_slug_format CHECK (slug ~ '^[a-z0-9-]+$'),
    CONSTRAINT tenants_max_projects_positive CHECK (max_projects > 0),
    CONSTRAINT tenants_retention_days_range CHECK (retention_days BETWEEN 7 AND 2555)
);

-- Indexes
CREATE INDEX idx_tenants_slug ON public.tenants(slug);
CREATE INDEX idx_tenants_plan ON public.tenants(plan);
CREATE INDEX idx_tenants_active ON public.tenants(id) WHERE deleted_at IS NULL;

-- Auto-update trigger
CREATE TRIGGER set_tenants_updated_at
    BEFORE UPDATE ON public.tenants
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- RLS Enable
ALTER TABLE public.tenants ENABLE ROW LEVEL SECURITY;

-- Comments
COMMENT ON TABLE public.tenants IS 'Multi-tenant organizations using SentinelAI';
COMMENT ON COLUMN public.tenants.slug IS 'URL-safe identifier for tenant';
COMMENT ON COLUMN public.tenants.features IS 'Feature flags JSON: {"ai_security": true, "exploit_lab": false}';
COMMENT ON COLUMN public.tenants.llm_token_quota IS 'Monthly LLM token quota for tenant';