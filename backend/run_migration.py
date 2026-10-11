import psycopg2
from app.config import settings

# Connect directly to PostgreSQL
conn = psycopg2.connect(
    host=settings.SUPABASE_DB_HOST,
    port=settings.SUPABASE_DB_PORT,
    user=settings.SUPABASE_DB_USER,
    password=settings.SUPABASE_DB_PASSWORD,
    database='postgres'
)
conn.autocommit = True
cur = conn.cursor()

# Add missing columns to findings table
cur.execute("""
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
""")
print('Findings columns added')

# Add missing columns to scans table
cur.execute("""
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
ADD COLUMN IF NOT EXISTS finding_count INTEGER NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS hallucination_score NUMERIC(5, 4),
ADD COLUMN IF NOT EXISTS consensus_confidence NUMERIC(5, 4),
ADD COLUMN IF NOT EXISTS queued_at TIMESTAMPTZ NOT NULL DEFAULT TIMEZONE('utc', NOW()),
ADD COLUMN IF NOT EXISTS retry_count INTEGER NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS max_retries INTEGER NOT NULL DEFAULT 3;
""")
print('Scans columns added')

# Add missing columns to projects table
cur.execute("""
ALTER TABLE public.projects 
ADD COLUMN IF NOT EXISTS total_findings INTEGER NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS total_scans INTEGER NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS open_findings INTEGER NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS critical_findings INTEGER NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES public.profiles(id);
""")
print('Projects columns added')

# Fix existing data that violates constraints
cur.execute("UPDATE public.findings SET consensus_score = NULL WHERE consensus_score IS NOT NULL AND (consensus_score < 0 OR consensus_score > 1);")
cur.execute("UPDATE public.findings SET cvss_score = NULL WHERE cvss_score IS NOT NULL AND (cvss_score < 0 OR cvss_score > 10);")
cur.execute("UPDATE public.scans SET progress_percent = 0 WHERE progress_percent IS NOT NULL AND (progress_percent < 0 OR progress_percent > 100);")
cur.execute("UPDATE public.scans SET hallucination_score = NULL WHERE hallucination_score IS NOT NULL AND (hallucination_score < 0 OR hallucination_score > 1);")
cur.execute("UPDATE public.scans SET consensus_confidence = NULL WHERE consensus_confidence IS NOT NULL AND (consensus_confidence < 0 OR consensus_confidence > 1);")

# Fix column types - consensus_score should be numeric not integer
cur.execute("ALTER TABLE public.findings ALTER COLUMN consensus_score TYPE NUMERIC(5, 4) USING consensus_score::numeric;")
cur.execute("ALTER TABLE public.findings ALTER COLUMN cvss_score TYPE NUMERIC(4, 1) USING cvss_score::numeric;")
cur.execute("ALTER TABLE public.scans ALTER COLUMN hallucination_score TYPE NUMERIC(5, 4) USING hallucination_score::numeric;")
cur.execute("ALTER TABLE public.scans ALTER COLUMN consensus_confidence TYPE NUMERIC(5, 4) USING consensus_confidence::numeric;")
print('Fixed existing data and column types')

# Add constraints (PostgreSQL doesn't support IF NOT EXISTS for constraints)
# Check if constraint exists before adding
cur.execute("""
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'findings_cvss_range') THEN
        ALTER TABLE public.findings ADD CONSTRAINT findings_cvss_range CHECK (cvss_score IS NULL OR cvss_score BETWEEN 0 AND 10);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'findings_consensus_range') THEN
        ALTER TABLE public.findings ADD CONSTRAINT findings_consensus_range CHECK (consensus_score IS NULL OR consensus_score BETWEEN 0 AND 1);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'findings_line_positive') THEN
        ALTER TABLE public.findings ADD CONSTRAINT findings_line_positive CHECK (line_number IS NULL OR line_number > 0);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'findings_column_positive') THEN
        ALTER TABLE public.findings ADD CONSTRAINT findings_column_positive CHECK (column_number IS NULL OR column_number > 0);
    END IF;
END $$;
""")
print('Findings constraints added')

cur.execute("""
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'scans_progress_range') THEN
        ALTER TABLE public.scans ADD CONSTRAINT scans_progress_range CHECK (progress_percent BETWEEN 0 AND 100);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'scans_hallucination_range') THEN
        ALTER TABLE public.scans ADD CONSTRAINT scans_hallucination_range CHECK (hallucination_score IS NULL OR hallucination_score BETWEEN 0 AND 1);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'scans_consensus_range') THEN
        ALTER TABLE public.scans ADD CONSTRAINT scans_consensus_range CHECK (consensus_confidence IS NULL OR consensus_confidence BETWEEN 0 AND 1);
    END IF;
END $$;
""")
print('Scans constraints added')

# Create indexes
cur.execute('CREATE INDEX IF NOT EXISTS idx_findings_cve_id ON public.findings(cve_id);')
cur.execute('CREATE INDEX IF NOT EXISTS idx_findings_detection_method ON public.findings(detection_method);')
cur.execute('CREATE INDEX IF NOT EXISTS idx_scans_branch ON public.scans(branch);')
cur.execute('CREATE INDEX IF NOT EXISTS idx_scans_trigger_type ON public.scans(trigger_type);')
cur.execute('CREATE INDEX IF NOT EXISTS idx_scans_queued_at ON public.scans(queued_at DESC);')
print('Indexes created')

cur.close()
conn.close()
print('Migration completed successfully')