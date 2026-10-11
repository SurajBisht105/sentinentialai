-- Add scan agent progress columns for deployments created before the full scans schema.
ALTER TABLE public.scans
    ADD COLUMN IF NOT EXISTS progress_percent INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS total_agents INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS completed_agents INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS failed_agents INTEGER NOT NULL DEFAULT 0;
