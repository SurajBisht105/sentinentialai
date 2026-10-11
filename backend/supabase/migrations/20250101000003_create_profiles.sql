-- supabase/migrations/20250101000003_create_profiles.sql
-- ============================================================
-- SentinelAI — User Profiles Table
-- Extends Supabase auth.users
-- ============================================================

CREATE TABLE IF NOT EXISTS public.profiles (
    -- Primary key mirrors auth.users.id
    id                  UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,

    -- Tenant association
    tenant_id           UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,

    -- User information
    display_name        VARCHAR(100),
    avatar_url          VARCHAR(500),
    phone               VARCHAR(20),

    -- Role & permissions
    role                app_role NOT NULL DEFAULT 'Viewer',

    -- MFA enforcement
    mfa_required        BOOLEAN NOT NULL DEFAULT FALSE,
    mfa_enrolled        BOOLEAN NOT NULL DEFAULT FALSE,

    -- Preferences
    preferences         JSONB NOT NULL DEFAULT '{
        "theme": "dark",
        "notifications_email": true,
        "notifications_slack": false,
        "dashboard_layout": "default"
    }',

    -- Security
    last_login_at       TIMESTAMPTZ,
    last_login_ip       VARCHAR(45),
    failed_login_count  INTEGER NOT NULL DEFAULT 0,
    locked_until        TIMESTAMPTZ,

    -- Metadata
    created_at          TIMESTAMPTZ NOT NULL DEFAULT TIMEZONE('utc', NOW()),
    updated_at          TIMESTAMPTZ,
    deleted_at          TIMESTAMPTZ,

    -- Constraints
    CONSTRAINT profiles_role_mfa_check CHECK (
        -- CISO and Superadmin must have MFA
        (role IN ('CISO', 'Superadmin') AND mfa_required = TRUE) OR
        (role IN ('Viewer', 'Engineer'))
    )
);

-- Indexes
CREATE INDEX idx_profiles_tenant_id ON public.profiles(tenant_id);
CREATE INDEX idx_profiles_role ON public.profiles(role);
CREATE INDEX idx_profiles_active ON public.profiles(id) WHERE deleted_at IS NULL;
CREATE INDEX idx_profiles_tenant_role ON public.profiles(tenant_id, role);

-- Auto-update trigger
CREATE TRIGGER set_profiles_updated_at
    BEFORE UPDATE ON public.profiles
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Auto-set MFA requirement for privileged roles
CREATE OR REPLACE FUNCTION enforce_mfa_for_privileged_roles()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.role IN ('CISO', 'Superadmin') THEN
        NEW.mfa_required = TRUE;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER enforce_mfa_on_role_change
    BEFORE INSERT OR UPDATE OF role ON public.profiles
    FOR EACH ROW
    EXECUTE FUNCTION enforce_mfa_for_privileged_roles();

-- Auto-create profile when new auth.user is created
CREATE OR REPLACE FUNCTION handle_new_auth_user()
RETURNS TRIGGER AS $$
DECLARE
    default_tenant_id UUID;
BEGIN
    -- Get or create default tenant
    SELECT id INTO default_tenant_id
    FROM public.tenants
    WHERE slug = 'default'
    LIMIT 1;

    IF default_tenant_id IS NULL THEN
        INSERT INTO public.tenants (name, slug, plan)
        VALUES ('Default Organization', 'default', 'Free')
        RETURNING id INTO default_tenant_id;
    END IF;

    -- Create profile
    INSERT INTO public.profiles (id, tenant_id, display_name, role)
    VALUES (
        NEW.id,
        default_tenant_id,
        COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
        'Viewer'
    );

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION handle_new_auth_user();

-- RLS Enable
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Comments
COMMENT ON TABLE public.profiles IS 'User profiles extending Supabase auth.users';
COMMENT ON COLUMN public.profiles.role IS 'RBAC role: Viewer, Engineer, CISO, Superadmin';
COMMENT ON COLUMN public.profiles.mfa_required IS 'MFA required flag - auto-set for CISO and Superadmin';
COMMENT ON COLUMN public.profiles.preferences IS 'User preference settings JSON';