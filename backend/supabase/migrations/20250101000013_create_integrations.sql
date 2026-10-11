-- supabase/migrations/20250101000013_create_integrations.sql
-- ============================================================
-- SentinelAI — Integrations & API Keys Tables
-- ============================================================

CREATE TABLE IF NOT EXISTS public.integrations (
    id                      UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id               UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    created_by              UUID REFERENCES public.profiles(id) ON DELETE SET NULL,

    -- Integration details
    integration_type        integration_type NOT NULL,
    name                    VARCHAR(100) NOT NULL,
    description             TEXT,

    -- Status
    is_active               BOOLEAN NOT NULL DEFAULT TRUE,
    is_verified             BOOLEAN NOT NULL DEFAULT FALSE,
    last_verified_at        TIMESTAMPTZ,
    last_sync_at            TIMESTAMPTZ,
    sync_status             VARCHAR(20),
    sync_error              TEXT,

    -- Configuration (sensitive fields encrypted at rest)
    config                  JSONB NOT NULL DEFAULT '{}',

    -- Webhook configuration
    webhook_url             VARCHAR(500),
    webhook_secret_hash     VARCHAR(64),  -- SHA-256 of webhook secret
    webhook_events          TEXT[],

    -- Usage stats
    total_events_sent       INTEGER NOT NULL DEFAULT 0,
    total_events_received   INTEGER NOT NULL DEFAULT 0,
    last_event_at           TIMESTAMPTZ,

    -- Timestamps
    created_at              TIMESTAMPTZ NOT NULL DEFAULT TIMEZONE('utc', NOW()),
    updated_at              TIMESTAMPTZ,

    -- One integration type per tenant
    CONSTRAINT integrations_unique_type_per_tenant UNIQUE (tenant_id, integration_type)
);

-- ============================================================
-- API Keys Table
-- ============================================================

CREATE TABLE IF NOT EXISTS public.api_keys (
    id                      UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id               UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    created_by              UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,

    -- Key details
    name                    VARCHAR(100) NOT NULL,
    description             TEXT,
    key_prefix              VARCHAR(20) NOT NULL,  -- First 8 chars visible
    key_hash                VARCHAR(64) NOT NULL UNIQUE,  -- SHA-256 of full key

    -- Scopes (least-privilege)
    scopes                  TEXT[] NOT NULL,
    -- Available: scan:read, scan:write, finding:read, finding:write,
    --            report:read, compliance:read, agent:read

    -- Restrictions
    allowed_ips             INET[],
    allowed_environments    TEXT[],

    -- Expiry
    expires_at              TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '90 days'),
    auto_rotate             BOOLEAN NOT NULL DEFAULT FALSE,
    rotate_days             INTEGER NOT NULL DEFAULT 90,

    -- Usage
    last_used_at            TIMESTAMPTZ,
    last_used_ip            VARCHAR(45),
    usage_count             INTEGER NOT NULL DEFAULT 0,

    -- Status
    is_active               BOOLEAN NOT NULL DEFAULT TRUE,
    revoked_at              TIMESTAMPTZ,
    revoked_by              UUID REFERENCES public.profiles(id),
    revoke_reason           TEXT,

    -- Timestamps
    created_at              TIMESTAMPTZ NOT NULL DEFAULT TIMEZONE('utc', NOW()),
    updated_at              TIMESTAMPTZ,

    -- Constraints
    CONSTRAINT api_keys_scopes_not_empty CHECK (array_length(scopes, 1) > 0),
    CONSTRAINT api_keys_rotate_days_range CHECK (rotate_days BETWEEN 7 AND 365)
);

-- Indexes
CREATE INDEX idx_integrations_tenant_id ON public.integrations(tenant_id);
CREATE INDEX idx_integrations_type ON public.integrations(integration_type);
CREATE INDEX idx_integrations_active ON public.integrations(tenant_id, is_active) WHERE is_active = TRUE;
CREATE INDEX idx_api_keys_tenant_id ON public.api_keys(tenant_id);
CREATE INDEX idx_api_keys_key_hash ON public.api_keys(key_hash);
CREATE INDEX idx_api_keys_active ON public.api_keys(tenant_id, is_active) WHERE is_active = TRUE;
CREATE INDEX idx_api_keys_expires ON public.api_keys(expires_at) WHERE is_active = TRUE;

-- Auto-update triggers
CREATE TRIGGER set_integrations_updated_at
    BEFORE UPDATE ON public.integrations
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER set_api_keys_updated_at
    BEFORE UPDATE ON public.api_keys
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- RLS Enable
ALTER TABLE public.integrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.api_keys ENABLE ROW LEVEL SECURITY;

-- Comments
COMMENT ON TABLE public.integrations IS 'Third-party integrations (GitHub, Slack, AWS, etc.)';
COMMENT ON COLUMN public.integrations.webhook_secret_hash IS 'SHA-256 hash of webhook secret — original not stored';
COMMENT ON TABLE public.api_keys IS 'API keys for CI/CD and external system access';
COMMENT ON COLUMN public.api_keys.key_hash IS 'SHA-256 hash of API key — original shown only once at creation';