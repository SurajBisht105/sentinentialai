-- supabase/migrations/20250101000015_create_agent_metrics.sql
-- ============================================================
-- SentinelAI — Agent Performance Metrics
-- LLM evaluation, benchmarking, and performance tracking
-- ============================================================

CREATE TABLE IF NOT EXISTS public.agent_metrics (
    id                      UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id               UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    scan_id                 UUID REFERENCES public.scans(id) ON DELETE SET NULL,
    task_id                 UUID REFERENCES public.agent_tasks(id) ON DELETE SET NULL,

    -- Agent identity
    agent_type              VARCHAR(50) NOT NULL,
    agent_version           VARCHAR(20),
    llm_model               VARCHAR(100) NOT NULL,

    -- LLM quality metrics
    accuracy_score          NUMERIC(5, 4),     -- 0-1
    precision_score         NUMERIC(5, 4),     -- 0-1
    recall_score            NUMERIC(5, 4),     -- 0-1
    f1_score                NUMERIC(5, 4),     -- 0-1
    hallucination_score     NUMERIC(5, 4),     -- 0-1 (lower is better)
    confidence_score        NUMERIC(5, 4),     -- 0-1
    evidence_coverage       NUMERIC(5, 4),     -- 0-1

    -- Performance metrics
    latency_ms              INTEGER NOT NULL,
    queue_wait_ms           INTEGER,
    tokens_input            INTEGER NOT NULL DEFAULT 0,
    tokens_output           INTEGER NOT NULL DEFAULT 0,
    tokens_total            INTEGER NOT NULL DEFAULT 0,
    llm_calls               INTEGER NOT NULL DEFAULT 1,

    -- Risk metrics
    false_positive_count    INTEGER NOT NULL DEFAULT 0,
    false_negative_count    INTEGER NOT NULL DEFAULT 0,
    true_positive_count     INTEGER NOT NULL DEFAULT 0,

    -- Cost estimation
    estimated_cost_usd      NUMERIC(10, 6),

    -- Benchmark context
    benchmark_set           VARCHAR(50),
    ground_truth_available  BOOLEAN NOT NULL DEFAULT FALSE,

    -- Timestamps
    created_at              TIMESTAMPTZ NOT NULL DEFAULT TIMEZONE('utc', NOW())
);

-- Daily aggregated metrics (materialized)
CREATE TABLE IF NOT EXISTS public.agent_metrics_daily (
    id                      UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id               UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    agent_type              VARCHAR(50) NOT NULL,
    metric_date             DATE NOT NULL,

    -- Aggregated values
    total_tasks             INTEGER NOT NULL DEFAULT 0,
    avg_latency_ms          NUMERIC(10, 2),
    avg_accuracy_score      NUMERIC(5, 4),
    avg_hallucination_score NUMERIC(5, 4),
    total_tokens_used       BIGINT NOT NULL DEFAULT 0,
    total_cost_usd          NUMERIC(10, 4),
    error_rate              NUMERIC(5, 4),

    -- Timestamps
    created_at              TIMESTAMPTZ NOT NULL DEFAULT TIMEZONE('utc', NOW()),
    updated_at              TIMESTAMPTZ,

    CONSTRAINT agent_metrics_daily_unique UNIQUE (tenant_id, agent_type, metric_date)
);

-- Indexes
CREATE INDEX idx_agent_metrics_tenant ON public.agent_metrics(tenant_id);
CREATE INDEX idx_agent_metrics_scan_id ON public.agent_metrics(scan_id);
CREATE INDEX idx_agent_metrics_agent_type ON public.agent_metrics(agent_type);
CREATE INDEX idx_agent_metrics_created_at ON public.agent_metrics(created_at DESC);
CREATE INDEX idx_agent_metrics_daily_tenant ON public.agent_metrics_daily(tenant_id, metric_date DESC);

-- Comments
COMMENT ON TABLE public.agent_metrics IS 'Per-invocation LLM and agent performance metrics';
COMMENT ON TABLE public.agent_metrics_daily IS 'Daily aggregated agent performance metrics';
COMMENT ON COLUMN public.agent_metrics.hallucination_score IS '0-1 where 0 = no hallucination, 1 = full hallucination';