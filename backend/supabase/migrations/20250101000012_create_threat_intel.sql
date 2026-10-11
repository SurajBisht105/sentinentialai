-- supabase/migrations/20250101000012_create_threat_intel.sql
-- ============================================================
-- SentinelAI — Threat Intelligence Tables
-- CVE feed, APT tracking, and attack vector data
-- ============================================================

-- CVE / Vulnerability database cache
CREATE TABLE IF NOT EXISTS public.threat_intel_cve (
    id                      UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    -- CVE identification
    cve_id                  VARCHAR(20) NOT NULL UNIQUE,
    cwe_id                  VARCHAR(20),

    -- Severity
    severity                severity_level NOT NULL,
    cvss_v3_score           NUMERIC(4, 1),
    cvss_v3_vector          VARCHAR(100),
    cvss_v2_score           NUMERIC(4, 1),

    -- Details
    title                   VARCHAR(500) NOT NULL,
    description             TEXT NOT NULL,
    affected_products       JSONB NOT NULL DEFAULT '[]',
    affected_versions       JSONB NOT NULL DEFAULT '[]',
    patch_available         BOOLEAN NOT NULL DEFAULT FALSE,
    patch_version           VARCHAR(100),

    -- Exploitation
    exploited_in_wild       BOOLEAN NOT NULL DEFAULT FALSE,
    kev_listed              BOOLEAN NOT NULL DEFAULT FALSE,  -- CISA KEV
    exploit_available       BOOLEAN NOT NULL DEFAULT FALSE,
    exploit_url             VARCHAR(500),

    -- References
    nvd_url                 VARCHAR(500),
    github_advisory_url     VARCHAR(500),
    "references"            JSONB NOT NULL DEFAULT '[]',

    -- Feed metadata
    source                  VARCHAR(50) NOT NULL,  -- NVD, GITHUB, OSV
    published_date          TIMESTAMPTZ NOT NULL,
    last_modified_date      TIMESTAMPTZ,

    -- SentinelAI metadata
    ingested_at             TIMESTAMPTZ NOT NULL DEFAULT TIMEZONE('utc', NOW()),
    last_checked_at         TIMESTAMPTZ NOT NULL DEFAULT TIMEZONE('utc', NOW())
);

-- APT Group tracking
CREATE TABLE IF NOT EXISTS public.threat_intel_apt (
    id                      UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    -- Group identification
    group_name              VARCHAR(100) NOT NULL,
    aliases                 TEXT[],
    nation_state            VARCHAR(100),

    -- Activity
    activity_level          VARCHAR(20) NOT NULL,  -- HIGH, MEDIUM, LOW, INACTIVE
    last_active             TIMESTAMPTZ,

    -- Targets
    target_sectors          TEXT[],
    target_technologies     TEXT[],
    ttp_ids                 TEXT[],  -- MITRE ATT&CK

    -- Intelligence
    description             TEXT,
    ioc_indicators          JSONB NOT NULL DEFAULT '{}',

    -- Timestamps
    created_at              TIMESTAMPTZ NOT NULL DEFAULT TIMEZONE('utc', NOW()),
    updated_at              TIMESTAMPTZ
);

-- Packages affected by CVEs (per tenant)
CREATE TABLE IF NOT EXISTS public.threat_intel_affected_packages (
    id                      UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id               UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    project_id              UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
    cve_id                  VARCHAR(20) NOT NULL REFERENCES public.threat_intel_cve(cve_id),

    -- Package details
    package_name            VARCHAR(200) NOT NULL,
    package_version         VARCHAR(100) NOT NULL,
    package_manager         VARCHAR(20) NOT NULL,  -- npm, pip, maven, etc.
    file_path               VARCHAR(500),

    -- Status
    is_patched              BOOLEAN NOT NULL DEFAULT FALSE,
    patched_version         VARCHAR(100),
    patched_at              TIMESTAMPTZ,

    created_at              TIMESTAMPTZ NOT NULL DEFAULT TIMEZONE('utc', NOW())
);

-- Indexes
CREATE INDEX idx_cve_cve_id ON public.threat_intel_cve(cve_id);
CREATE INDEX idx_cve_severity ON public.threat_intel_cve(severity);
CREATE INDEX idx_cve_cvss ON public.threat_intel_cve(cvss_v3_score DESC);
CREATE INDEX idx_cve_kev ON public.threat_intel_cve(kev_listed) WHERE kev_listed = TRUE;
CREATE INDEX idx_cve_published ON public.threat_intel_cve(published_date DESC);
CREATE INDEX idx_cve_products_gin ON public.threat_intel_cve USING GIN (affected_products);
CREATE INDEX idx_apt_activity ON public.threat_intel_apt(activity_level);
CREATE INDEX idx_affected_packages_tenant ON public.threat_intel_affected_packages(tenant_id);
CREATE INDEX idx_affected_packages_project ON public.threat_intel_affected_packages(project_id);

-- Full-text search on CVEs
CREATE INDEX idx_cve_fts ON public.threat_intel_cve
    USING GIN (to_tsvector('english', cve_id || ' ' || title || ' ' || description));

-- Auto-update trigger for APT
CREATE TRIGGER set_apt_updated_at
    BEFORE UPDATE ON public.threat_intel_apt
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Comments
COMMENT ON TABLE public.threat_intel_cve IS 'Cached CVE data from NVD, GitHub Advisory, and OSV feeds';
COMMENT ON TABLE public.threat_intel_apt IS 'APT group tracking and threat actor intelligence';
COMMENT ON TABLE public.threat_intel_affected_packages IS 'CVE-to-package mapping per tenant project';