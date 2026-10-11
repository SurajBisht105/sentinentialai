-- supabase/migrations/20250831000001_add_missing_columns.sql
-- ============================================================
-- SentinelAI — Add Missing Columns to Match Code Expectations
-- ============================================================

-- Add missing columns to findings table
ALTER TABLE public.findings 
ADD COLUMN IF NOT EXISTS cve_id VARCHAR(20),
ADD COLUMN IF NOT EXISTS owasp_category VARCHAR(50),
ADD COLUMN IF NOT EXISTS cvss_score NUMERIC(4, 1),
ADD COLUMN IF NOT EXISTS column_number INTEGER,
ADD COLUMN IF NOT EXISTS detection_method VARCHAR(50),
ADD COLUMN IF NOT EXISTS consensus_agents_agreed INTEGER NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS consensus_agents_total INTEGER NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS false_positive_reason TEXT,
ADD COLUMN IF NOT EXISTS false_positive_marked_by UUID REFERENCES public.profiles(id),
ADD COLUMN IF NOT EXISTS false_positive_marked_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS attack_vector VARCHAR(50),
ADD COLUMN IF NOT EXISTS exploitability VARCHAR(20),
ADD COLUMN IF NOT EXISTS proof_of_concept TEXT,
ADD COLUMN IF NOT EXISTS "references" JSONB NOT NULL DEFAULT '[]',
ADD COLUMN IF NOT EXISTS tags TEXT[],
ADD COLUMN IF NOT EXISTS evidence JSONB NOT NULL DEFAULT '{}';

-- Add missing columns to scans table
ALTER TABLE public.scans 
ADD COLUMN IF NOT EXISTS branch VARCHAR(100) NOT NULL DEFAULT 'main',
ADD COLUMN IF NOT EXISTS commit_sha VARCHAR(40),
ADD COLUMN IF NOT EXISTS target_url VARCHAR(500),
ADD COLUMN IF NOT EXISTS trigger_type VARCHAR(20) NOT NULL DEFAULT 'MANUAL',
ADD COLUMN IF NOT EXISTS trigger_metadata JSONB NOT NULL DEFAULT '{}',
ADD COLUMN IF NOT EXISTS critical_count INTEGER NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS high_count INTEGER NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS medium_count INTEGER NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS low_count INTEGER NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS false_positive_count INTEGER NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS llm_calls_count INTEGER NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS hallucination_score NUMERIC(5, 4),
ADD COLUMN IF NOT EXISTS consensus_confidence NUMERIC(5, 4),
ADD COLUMN IF NOT EXISTS queued_at TIMESTAMPTZ NOT NULL DEFAULT TIMEZONE('utc', NOW()),
ADD COLUMN IF NOT EXISTS retry_count INTEGER NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS max_retries INTEGER NOT NULL DEFAULT 3;

-- Add missing columns to projects table
ALTER TABLE public.projects 
ADD COLUMN IF NOT EXISTS total_findings INTEGER NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS total_scans INTEGER NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS open_findings INTEGER NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS critical_findings INTEGER NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES public.profiles(id);

-- Add constraints for new columns
ALTER TABLE public.findings 
ADD CONSTRAINT IF NOT EXISTS findings_cvss_range CHECK (cvss_score IS NULL OR cvss_score BETWEEN 0 AND 10),
ADD CONSTRAINT IF NOT EXISTS findings_consensus_range CHECK (consensus_score IS NULL OR consensus_score BETWEEN 0 AND 1),
ADD CONSTRAINT IF NOT EXISTS findings_line_positive CHECK (line_number IS NULL OR line_number > 0),
ADD CONSTRAINT IF NOT EXISTS findings_column_positive CHECK (column_number IS NULL OR column_number > 0);

ALTER TABLE public.scans 
ADD CONSTRAINT IF NOT EXISTS scans_progress_range CHECK (progress_percent BETWEEN 0 AND 100),
ADD CONSTRAINT IF NOT EXISTS scans_hallucination_range CHECK (hallucination_score IS NULL OR hallucination_score BETWEEN 0 AND 1),
ADD CONSTRAINT IF NOT EXISTS scans_consensus_range CHECK (consensus_confidence IS NULL OR consensus_confidence BETWEEN 0 AND 1);

-- Create indexes for new columns
CREATE INDEX IF NOT EXISTS idx_findings_cve_id ON public.findings(cve_id);
CREATE INDEX IF NOT EXISTS idx_findings_detection_method ON public.findings(detection_method);
CREATE INDEX IF NOT EXISTS idx_findings_false_positive ON public.findings(false_positive);
CREATE INDEX IF NOT EXISTS idx_findings_is_resolved ON public.findings(is_resolved);
CREATE INDEX IF NOT EXISTS idx_findings_fingerprint ON public.findings(fingerprint);

CREATE INDEX IF NOT EXISTS idx_scans_branch ON public.scans(branch);
CREATE INDEX IF NOT EXISTS idx_scans_trigger_type ON public.scans(trigger_type);
CREATE INDEX IF NOT EXISTS idx_scans_queued_at ON public.scans(queued_at DESC);

-- Composite indexes for dashboard queries
CREATE INDEX IF NOT EXISTS idx_findings_tenant_severity ON public.findings(tenant_id, severity)
    WHERE false_positive = FALSE;

CREATE INDEX IF NOT EXISTS idx_findings_project_open ON public.findings(project_id, severity)
    WHERE false_positive = FALSE AND is_resolved = FALSE;