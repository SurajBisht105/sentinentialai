-- supabase/migrations/20250101000009_create_audit_logs.sql
-- ============================================================
-- SentinelAI — Audit Logs Table
-- Immutable, cryptographically signed audit trail
-- ============================================================

CREATE TABLE IF NOT EXISTS public.audit_logs (
    -- Primary key
    id                      UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    -- Tenant context
    tenant_id               UUID REFERENCES public.tenants(id) ON DELETE SET NULL,

    -- Actor information
    actor_type              actor_type NOT NULL,
    actor_id                VARCHAR(255) NOT NULL,
    actor_email             VARCHAR(255),
    actor_role              VARCHAR(50),
    actor_ip                VARCHAR(45),
    actor_user_agent        TEXT,

    -- Action details
    action                  VARCHAR(100) NOT NULL,
    resource_type           VARCHAR(50),
    resource_id             VARCHAR(255),

    -- Risk assessment
    risk_level              risk_level NOT NULL DEFAULT 'LOW',

    -- Payload
    details                 JSONB NOT NULL DEFAULT '{}',
    request_payload         JSONB,
    response_payload        JSONB,

    -- Integrity
    signature               VARCHAR(128) NOT NULL,  -- HMAC-SHA256
    previous_log_hash       VARCHAR(64),  -- Chain integrity
    sequence_number         BIGSERIAL,    -- Monotonically increasing

    -- Session tracking
    session_id              VARCHAR(128),
    correlation_id          VARCHAR(128),  -- Trace ID across services

    -- Timestamps (immutable - no updated_at)
    created_at              TIMESTAMPTZ NOT NULL DEFAULT TIMEZONE('utc', NOW()),

    -- Constraints
    CONSTRAINT audit_logs_sequence_unique UNIQUE (sequence_number),
    CONSTRAINT audit_logs_action_not_empty CHECK (LENGTH(TRIM(action)) > 0)
);

-- Partition by month for performance
-- Note: In production, use native PostgreSQL partitioning
CREATE INDEX idx_audit_logs_tenant_id ON public.audit_logs(tenant_id);
CREATE INDEX idx_audit_logs_actor_id ON public.audit_logs(actor_id);
CREATE INDEX idx_audit_logs_action ON public.audit_logs(action);
CREATE INDEX idx_audit_logs_risk_level ON public.audit_logs(risk_level);
CREATE INDEX idx_audit_logs_created_at ON public.audit_logs(created_at DESC);
CREATE INDEX idx_audit_logs_actor_email ON public.audit_logs(actor_email);
CREATE INDEX idx_audit_logs_resource ON public.audit_logs(resource_type, resource_id);
CREATE INDEX idx_audit_logs_correlation ON public.audit_logs(correlation_id);

-- Composite index for compliance queries
CREATE INDEX idx_audit_logs_tenant_risk_date ON public.audit_logs(tenant_id, risk_level, created_at DESC);

-- GIN index for searching details
CREATE INDEX idx_audit_logs_details_gin ON public.audit_logs USING GIN (details);

-- Prevent any modifications to audit logs (append-only)
CREATE OR REPLACE FUNCTION prevent_audit_log_modification()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'UPDATE' THEN
        RAISE EXCEPTION 'Audit logs are immutable — UPDATE not allowed';
    END IF;
    IF TG_OP = 'DELETE' THEN
        RAISE EXCEPTION 'Audit logs are immutable — DELETE not allowed';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER enforce_audit_log_immutability
    BEFORE UPDATE OR DELETE ON public.audit_logs
    FOR EACH ROW
    EXECUTE FUNCTION prevent_audit_log_modification();

-- RLS Enable (read-only for appropriate roles)
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- Comments
COMMENT ON TABLE public.audit_logs IS 'Immutable, cryptographically signed audit trail for all system actions';
COMMENT ON COLUMN public.audit_logs.signature IS 'HMAC-SHA256 signature for tamper detection';
COMMENT ON COLUMN public.audit_logs.previous_log_hash IS 'Hash of previous audit log entry for chain integrity';
COMMENT ON COLUMN public.audit_logs.sequence_number IS 'Monotonically increasing sequence for ordering guarantee';