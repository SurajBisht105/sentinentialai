-- supabase/migrations/20250101000016_create_rls_policies.sql
-- ============================================================
-- SentinelAI — Row Level Security Policies
-- Enforces tenant isolation and role-based access at DB layer
-- ============================================================

-- ============================================================
-- HELPER FUNCTIONS for RLS
-- ============================================================

-- Get current user's tenant_id from profiles
CREATE OR REPLACE FUNCTION public.get_user_tenant_id()
RETURNS UUID AS $$
    SELECT tenant_id FROM public.profiles
    WHERE id = auth.uid()
    LIMIT 1;
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- Get current user's role
CREATE OR REPLACE FUNCTION public.get_user_role()
RETURNS TEXT AS $$
    SELECT role::TEXT FROM public.profiles
    WHERE id = auth.uid()
    LIMIT 1;
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- Check if user is Superadmin
CREATE OR REPLACE FUNCTION public.is_superadmin()
RETURNS BOOLEAN AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid()
        AND role = 'Superadmin'
        AND deleted_at IS NULL
    );
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- Check if user is CISO or above
CREATE OR REPLACE FUNCTION public.is_ciso_or_above()
RETURNS BOOLEAN AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid()
        AND role IN ('CISO', 'Superadmin')
        AND deleted_at IS NULL
    );
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- Check if user is Engineer or above
CREATE OR REPLACE FUNCTION public.is_engineer_or_above()
RETURNS BOOLEAN AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid()
        AND role IN ('Engineer', 'CISO', 'Superadmin')
        AND deleted_at IS NULL
    );
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- ============================================================
-- TENANTS POLICIES
-- ============================================================

CREATE POLICY "Users can view their own tenant"
    ON public.tenants FOR SELECT
    USING (id = public.get_user_tenant_id());

CREATE POLICY "Superadmin can view all tenants"
    ON public.tenants FOR SELECT
    USING (public.is_superadmin());

CREATE POLICY "Superadmin can update tenants"
    ON public.tenants FOR UPDATE
    USING (public.is_superadmin());

-- Service role can do everything
CREATE POLICY "Service role full access to tenants"
    ON public.tenants FOR ALL
    USING (auth.role() = 'service_role');

-- ============================================================
-- PROFILES POLICIES
-- ============================================================

-- Users can view all profiles in their tenant
CREATE POLICY "Users view profiles in same tenant"
    ON public.profiles FOR SELECT
    USING (tenant_id = public.get_user_tenant_id() AND deleted_at IS NULL);

-- Users can only update their own profile
CREATE POLICY "Users can update own profile"
    ON public.profiles FOR UPDATE
    USING (id = auth.uid());

-- CISO and above can update profiles in their tenant
CREATE POLICY "CISO can update profiles in tenant"
    ON public.profiles FOR UPDATE
    USING (
        tenant_id = public.get_user_tenant_id()
        AND public.is_ciso_or_above()
    );

-- Service role can insert and update profiles
CREATE POLICY "Service role full access to profiles"
    ON public.profiles FOR ALL
    USING (auth.role() = 'service_role');

-- ============================================================
-- PROJECTS POLICIES
-- ============================================================

CREATE POLICY "Users can view projects in their tenant"
    ON public.projects FOR SELECT
    USING (
        tenant_id = public.get_user_tenant_id()
        AND deleted_at IS NULL
    );

CREATE POLICY "Engineers can create projects"
    ON public.projects FOR INSERT
    WITH CHECK (
        tenant_id = public.get_user_tenant_id()
        AND public.is_engineer_or_above()
    );

CREATE POLICY "Engineers can update projects in their tenant"
    ON public.projects FOR UPDATE
    USING (
        tenant_id = public.get_user_tenant_id()
        AND public.is_engineer_or_above()
    );

CREATE POLICY "CISO can delete projects"
    ON public.projects FOR DELETE
    USING (
        tenant_id = public.get_user_tenant_id()
        AND public.is_ciso_or_above()
    );

CREATE POLICY "Service role full access to projects"
    ON public.projects FOR ALL
    USING (auth.role() = 'service_role');

-- ============================================================
-- SCANS POLICIES
-- ============================================================

CREATE POLICY "Users can view scans in their tenant"
    ON public.scans FOR SELECT
    USING (tenant_id = public.get_user_tenant_id());

CREATE POLICY "Engineers can create scans"
    ON public.scans FOR INSERT
    WITH CHECK (
        tenant_id = public.get_user_tenant_id()
        AND public.is_engineer_or_above()
    );

CREATE POLICY "Engineers can cancel their own scans"
    ON public.scans FOR UPDATE
    USING (
        tenant_id = public.get_user_tenant_id()
        AND (initiated_by = auth.uid() OR public.is_ciso_or_above())
    );

-- Backend agents insert/update scan records
CREATE POLICY "Service role full access to scans"
    ON public.scans FOR ALL
    USING (auth.role() = 'service_role');

-- ============================================================
-- AGENT TASKS POLICIES
-- ============================================================

-- Users can view tasks for scans in their tenant
CREATE POLICY "Users view agent tasks in their tenant"
    ON public.agent_tasks FOR SELECT
    USING (
        scan_id IN (
            SELECT id FROM public.scans
            WHERE tenant_id = public.get_user_tenant_id()
        )
    );

-- Only backend (service role) can create/update agent tasks
CREATE POLICY "Service role full access to agent tasks"
    ON public.agent_tasks FOR ALL
    USING (auth.role() = 'service_role');

-- ============================================================
-- FINDINGS POLICIES
-- ============================================================

CREATE POLICY "Users can read findings in their tenant"
    ON public.findings FOR SELECT
    USING (tenant_id = public.get_user_tenant_id());

-- Engineers can mark false positives
CREATE POLICY "Engineers can update findings"
    ON public.findings FOR UPDATE
    USING (
        tenant_id = public.get_user_tenant_id()
        AND public.is_engineer_or_above()
    );

-- Only backend inserts findings
CREATE POLICY "Service role inserts findings"
    ON public.findings FOR INSERT
    WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "Service role full access to findings"
    ON public.findings FOR ALL
    USING (auth.role() = 'service_role');

-- ============================================================
-- REMEDIATIONS POLICIES
-- ============================================================

CREATE POLICY "Users can view remediations in their tenant"
    ON public.remediations FOR SELECT
    USING (tenant_id = public.get_user_tenant_id());

-- Engineers can approve/reject remediations
CREATE POLICY "Engineers can update remediations"
    ON public.remediations FOR UPDATE
    USING (
        tenant_id = public.get_user_tenant_id()
        AND public.is_engineer_or_above()
    );

CREATE POLICY "Service role full access to remediations"
    ON public.remediations FOR ALL
    USING (auth.role() = 'service_role');

-- ============================================================
-- AUDIT LOGS POLICIES
-- ============================================================

-- CISO and above can read audit logs for their tenant
CREATE POLICY "CISO can read audit logs"
    ON public.audit_logs FOR SELECT
    USING (
        tenant_id = public.get_user_tenant_id()
        AND public.is_ciso_or_above()
    );

-- Superadmin can read all audit logs
CREATE POLICY "Superadmin reads all audit logs"
    ON public.audit_logs FOR SELECT
    USING (public.is_superadmin());

-- NO UPDATE/DELETE policies (immutable)
-- Service role can only INSERT
CREATE POLICY "Service role can insert audit logs"
    ON public.audit_logs FOR INSERT
    WITH CHECK (auth.role() = 'service_role');

-- ============================================================
-- EXPLOIT LOGS POLICIES (Superadmin ONLY)
-- ============================================================

CREATE POLICY "Only Superadmin can view exploit logs"
    ON public.exploit_logs FOR SELECT
    USING (
        public.is_superadmin()
        AND tenant_id = public.get_user_tenant_id()
    );

CREATE POLICY "Service role manages exploit logs"
    ON public.exploit_logs FOR ALL
    USING (auth.role() = 'service_role');

-- ============================================================
-- COMPLIANCE POLICIES
-- ============================================================

CREATE POLICY "Users can view compliance reports in their tenant"
    ON public.compliance_reports FOR SELECT
    USING (tenant_id = public.get_user_tenant_id());

CREATE POLICY "CISO can manage compliance reports"
    ON public.compliance_reports FOR ALL
    USING (
        tenant_id = public.get_user_tenant_id()
        AND public.is_ciso_or_above()
    );

CREATE POLICY "Service role full access to compliance"
    ON public.compliance_reports FOR ALL
    USING (auth.role() = 'service_role');

CREATE POLICY "Users can view compliance controls in their tenant"
    ON public.compliance_controls FOR SELECT
    USING (tenant_id = public.get_user_tenant_id());

CREATE POLICY "Service role full access to compliance controls"
    ON public.compliance_controls FOR ALL
    USING (auth.role() = 'service_role');

-- ============================================================
-- INTEGRATIONS POLICIES
-- ============================================================

CREATE POLICY "Users can view integrations in their tenant"
    ON public.integrations FOR SELECT
    USING (tenant_id = public.get_user_tenant_id());

CREATE POLICY "Engineers can manage integrations"
    ON public.integrations FOR ALL
    USING (
        tenant_id = public.get_user_tenant_id()
        AND public.is_engineer_or_above()
    );

-- ============================================================
-- API KEYS POLICIES
-- ============================================================

CREATE POLICY "Users can view their own API keys"
    ON public.api_keys FOR SELECT
    USING (
        tenant_id = public.get_user_tenant_id()
        AND (created_by = auth.uid() OR public.is_ciso_or_above())
    );

CREATE POLICY "Engineers can create API keys"
    ON public.api_keys FOR INSERT
    WITH CHECK (
        tenant_id = public.get_user_tenant_id()
        AND public.is_engineer_or_above()
    );

CREATE POLICY "Users can revoke their own API keys"
    ON public.api_keys FOR UPDATE
    USING (
        tenant_id = public.get_user_tenant_id()
        AND (created_by = auth.uid() OR public.is_ciso_or_above())
    );