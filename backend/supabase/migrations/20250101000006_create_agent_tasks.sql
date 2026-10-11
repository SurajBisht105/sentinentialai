-- supabase/migrations/20250101000006_create_agent_tasks.sql
-- ============================================================
-- SentinelAI — Agent Tasks Table
-- Individual agent execution records
-- ============================================================

CREATE TABLE IF NOT EXISTS public.agent_tasks (
    -- Primary key
    id                      UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    -- Relations
    scan_id                 UUID NOT NULL REFERENCES public.scans(id) ON DELETE CASCADE,
    parent_task_id          UUID REFERENCES public.agent_tasks(id) ON DELETE SET NULL,

    -- Agent information
    agent_type              VARCHAR(50) NOT NULL,
    agent_instance_id       VARCHAR(100),  -- Unique instance identifier

    -- Task details
    status                  agent_status NOT NULL DEFAULT 'IDLE',
    priority                INTEGER NOT NULL DEFAULT 5,  -- 1-10, lower = higher priority

    -- Input/Output
    input_payload           JSONB NOT NULL DEFAULT '{}',
    output_payload          JSONB,
    context                 JSONB NOT NULL DEFAULT '{}',

    -- Kafka tracking
    kafka_topic             VARCHAR(100),
    kafka_partition         INTEGER,
    kafka_offset            BIGINT,
    kafka_consumer_group    VARCHAR(100),

    -- LLM metrics
    tokens_input            INTEGER NOT NULL DEFAULT 0,
    tokens_output           INTEGER NOT NULL DEFAULT 0,
    tokens_total            INTEGER NOT NULL DEFAULT 0,
    llm_model_used          VARCHAR(100),
    llm_calls               INTEGER NOT NULL DEFAULT 0,

    -- Performance
    latency_ms              INTEGER,
    queue_wait_ms           INTEGER,

    -- Agent reasoning chain
    reasoning_trace         JSONB NOT NULL DEFAULT '[]',  -- Array of reasoning steps

    -- Error handling
    error_message           TEXT,
    error_code              VARCHAR(50),
    retry_count             INTEGER NOT NULL DEFAULT 0,

    -- Guardrail info
    guardrail_triggered     BOOLEAN NOT NULL DEFAULT FALSE,
    guardrail_action        VARCHAR(50),

    -- Timing
    queued_at               TIMESTAMPTZ NOT NULL DEFAULT TIMEZONE('utc', NOW()),
    started_at              TIMESTAMPTZ,
    completed_at            TIMESTAMPTZ,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT TIMEZONE('utc', NOW()),
    updated_at              TIMESTAMPTZ,

    -- Constraints
    CONSTRAINT agent_tasks_priority_range CHECK (priority BETWEEN 1 AND 10),
    CONSTRAINT agent_tasks_tokens_non_negative CHECK (
        tokens_input >= 0 AND tokens_output >= 0
    )
);

-- Indexes
CREATE INDEX idx_agent_tasks_scan_id ON public.agent_tasks(scan_id);
CREATE INDEX idx_agent_tasks_agent_type ON public.agent_tasks(agent_type);
CREATE INDEX idx_agent_tasks_status ON public.agent_tasks(status);
CREATE INDEX idx_agent_tasks_parent ON public.agent_tasks(parent_task_id);
CREATE INDEX idx_agent_tasks_created_at ON public.agent_tasks(created_at DESC);
CREATE INDEX idx_agent_tasks_scan_type ON public.agent_tasks(scan_id, agent_type);

-- GIN index for JSONB reasoning trace search
CREATE INDEX idx_agent_tasks_reasoning_gin ON public.agent_tasks
    USING GIN (reasoning_trace);

-- Auto-update trigger
CREATE TRIGGER set_agent_tasks_updated_at
    BEFORE UPDATE ON public.agent_tasks
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Update scan progress when agent task completes
CREATE OR REPLACE FUNCTION update_scan_progress_on_task_update()
RETURNS TRIGGER AS $$
DECLARE
    v_total INTEGER;
    v_completed INTEGER;
    v_failed INTEGER;
    v_progress INTEGER;
BEGIN
    -- Count tasks for this scan
    SELECT
        COUNT(*),
        COUNT(*) FILTER (WHERE status = 'COMPLETED'),
        COUNT(*) FILTER (WHERE status = 'FAILED')
    INTO v_total, v_completed, v_failed
    FROM public.agent_tasks
    WHERE scan_id = NEW.scan_id;

    -- Calculate progress
    v_progress := CASE WHEN v_total > 0
        THEN ROUND(((v_completed + v_failed)::NUMERIC / v_total) * 100)
        ELSE 0
    END;

    -- Update scan
    UPDATE public.scans
    SET
        total_agents = v_total,
        completed_agents = v_completed,
        failed_agents = v_failed,
        progress_percent = v_progress,
        total_tokens_used = (
            SELECT COALESCE(SUM(tokens_total), 0)
            FROM public.agent_tasks
            WHERE scan_id = NEW.scan_id
        ),
        updated_at = TIMEZONE('utc', NOW())
    WHERE id = NEW.scan_id;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_scan_on_task_change
    AFTER INSERT OR UPDATE OF status ON public.agent_tasks
    FOR EACH ROW
    EXECUTE FUNCTION update_scan_progress_on_task_update();

-- RLS Enable
ALTER TABLE public.agent_tasks ENABLE ROW LEVEL SECURITY;

-- Comments
COMMENT ON TABLE public.agent_tasks IS 'Individual agent task execution records with full reasoning trace';
COMMENT ON COLUMN public.agent_tasks.reasoning_trace IS 'Array of agent reasoning steps: [{"step": 1, "thought": "...", "action": "..."}]';
COMMENT ON COLUMN public.agent_tasks.guardrail_triggered IS 'Whether a prompt guardrail was triggered during execution';