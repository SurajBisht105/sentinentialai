-- supabase/migrations/20250101000001_create_extensions.sql
-- ============================================================
-- SentinelAI — Extensions & Core Setup
-- ============================================================

-- Enable required PostgreSQL extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";          -- UUID generation
CREATE EXTENSION IF NOT EXISTS "pgcrypto";           -- Cryptographic functions
CREATE EXTENSION IF NOT EXISTS "pg_trgm";            -- Trigram text search
CREATE EXTENSION IF NOT EXISTS "btree_gin";          -- GIN index support
CREATE EXTENSION IF NOT EXISTS "unaccent";           -- Text normalization
CREATE EXTENSION IF NOT EXISTS "pg_stat_statements"; -- Query performance
CREATE EXTENSION IF NOT EXISTS "vector";             -- pgvector for embeddings (optional)

-- ============================================================
-- Custom Types (ENUMs)
-- ============================================================

-- Application roles
CREATE TYPE app_role AS ENUM (
    'Viewer',
    'Engineer',
    'CISO',
    'Superadmin'
);

-- Tenant plan types
CREATE TYPE tenant_plan AS ENUM (
    'Free',
    'Pro',
    'Enterprise'
);

-- Scan status
CREATE TYPE scan_status AS ENUM (
    'QUEUED',
    'RUNNING',
    'COMPLETED',
    'FAILED',
    'CANCELLED'
);

-- Severity levels
CREATE TYPE severity_level AS ENUM (
    'CRITICAL',
    'HIGH',
    'MEDIUM',
    'LOW',
    'INFO'
);

-- Agent status
CREATE TYPE agent_status AS ENUM (
    'ACTIVE',
    'IDLE',
    'COMPLETED',
    'FAILED',
    'TIMEOUT'
);

-- Remediation status
CREATE TYPE remediation_status AS ENUM (
    'PENDING',
    'APPROVED',
    'APPLIED',
    'REJECTED',
    'FAILED'
);

-- Risk level for audit logs
CREATE TYPE risk_level AS ENUM (
    'LOW',
    'MEDIUM',
    'HIGH',
    'CRITICAL'
);

-- Actor type for audit logs
CREATE TYPE actor_type AS ENUM (
    'USER',
    'AGENT',
    'SYSTEM',
    'CI_CD'
);

-- Exploit types
CREATE TYPE exploit_type AS ENUM (
    'PROMPT_INJECTION',
    'JAILBREAK',
    'SQL_INJECTION',
    'XSS',
    'SSRF',
    'RCE',
    'LFI',
    'CSRF'
);

-- Compliance framework types
CREATE TYPE compliance_framework AS ENUM (
    'SOC2',
    'ISO27001',
    'PCI_DSS',
    'HIPAA',
    'GDPR',
    'NIST',
    'OWASP'
);

-- Compliance control status
CREATE TYPE control_status AS ENUM (
    'PASS',
    'FAIL',
    'NOT_APPLICABLE',
    'IN_PROGRESS'
);

-- Integration types
CREATE TYPE integration_type AS ENUM (
    'GITHUB',
    'GITLAB',
    'BITBUCKET',
    'AWS',
    'GCP',
    'AZURE',
    'GITHUB_ACTIONS',
    'JENKINS',
    'CIRCLECI',
    'SLACK',
    'JIRA',
    'PAGERDUTY',
    'NVD',
    'EXPLOITDB',
    'OSV'
);

-- ============================================================
-- Helper Functions
-- ============================================================

-- Function to update updated_at timestamp automatically
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = TIMEZONE('utc', NOW());
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Function to set deleted_at on soft delete
CREATE OR REPLACE FUNCTION soft_delete()
RETURNS TRIGGER AS $$
BEGIN
    NEW.deleted_at = TIMEZONE('utc', NOW());
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION update_updated_at_column() IS 'Automatically updates updated_at timestamp';
COMMENT ON FUNCTION soft_delete() IS 'Soft delete implementation';