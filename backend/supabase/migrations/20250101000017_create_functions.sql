-- supabase/migrations/20250101000017_create_functions.sql
-- ============================================================
-- SentinelAI — Stored Functions & Procedures
-- ============================================================

-- ============================================================
-- Dashboard Statistics Function
-- ============================================================

CREATE OR REPLACE FUNCTION public.get_dashboard_stats(p_tenant_id UUID)
RETURNS JSONB AS $$
DECLARE
    v_result JSONB;
BEGIN
    SELECT jsonb_build_object(
        'total_projects',           (SELECT COUNT(*) FROM public.projects WHERE tenant_id = p_tenant_id AND deleted_at IS NULL),
        'active_scans',             (SELECT COUNT(*) FROM public.scans WHERE tenant_id = p_tenant_id AND status IN ('QUEUED', 'RUNNING')),
        'total_findings',           (SELECT COUNT(*) FROM public.findings WHERE tenant_id = p_tenant_id AND false_positive = FALSE),
        'critical_findings',        (SELECT COUNT(*) FROM public.findings WHERE tenant_id = p_tenant_id AND severity = 'CRITICAL' AND false_positive = FALSE AND is_resolved = FALSE),
        'high_findings',            (SELECT COUNT(*) FROM public.findings WHERE tenant_id = p_tenant_id AND severity = 'HIGH' AND false_positive = FALSE AND is_resolved = FALSE),
        'resolved_findings',        (SELECT COUNT(*) FROM public.findings WHERE tenant_id = p_tenant_id AND is_resolved = TRUE),
        'avg_time_to_detect',       (
                                        SELECT ROUND(AVG(EXTRACT(EPOCH FROM (started_at - queued_at)) / 60))
                                        FROM public.scans
                                        WHERE tenant_id = p_tenant_id
                                        AND status = 'COMPLETED'
                                        AND started_at IS NOT NULL
                                    ),
        'avg_time_to_remediate',    (
                                        SELECT ROUND(AVG(EXTRACT(EPOCH FROM (applied_at - created_at)) / 60))
                                        FROM public.remediations r
                                        JOIN public.findings f ON f.id = r.finding_id
                                        WHERE f.tenant_id = p_tenant_id
                                        AND r.status = 'APPLIED'
                                    ),
        'false_positive_rate',      (
                                        SELECT ROUND(
                                            COUNT(*) FILTER (WHERE false_positive = TRUE)::NUMERIC /
                                            NULLIF(COUNT(*), 0) * 100,
                                            2
                                        )
                                        FROM public.findings
                                        WHERE tenant_id = p_tenant_id
                                    ),
        'guardrail_success_rate',   100.0,
        'compliance_avg_score',     (
                                        SELECT ROUND(AVG(overall_score), 1)
                                        FROM public.compliance_reports
                                        WHERE tenant_id = p_tenant_id
                                        AND status = 'PUBLISHED'
                                    ),
        'total_tokens_used',        (
                                        SELECT COALESCE(SUM(total_tokens_used), 0)
                                        FROM public.scans
                                        WHERE tenant_id = p_tenant_id
                                    ),
        'scans_last_30_days',       (
                                        SELECT COUNT(*)
                                        FROM public.scans
                                        WHERE tenant_id = p_tenant_id
                                        AND created_at > NOW() - INTERVAL '30 days'
                                    )
    ) INTO v_result;

    RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- Risk Score Calculation Function
-- ============================================================

CREATE OR REPLACE FUNCTION public.calculate_project_risk_score(p_project_id UUID)
RETURNS INTEGER AS $$
DECLARE
    v_critical INTEGER;
    v_high INTEGER;
    v_medium INTEGER;
    v_low INTEGER;
    v_score INTEGER;
BEGIN
    -- Get open finding counts by severity
    SELECT
        COUNT(*) FILTER (WHERE severity = 'CRITICAL' AND false_positive = FALSE AND is_resolved = FALSE),
        COUNT(*) FILTER (WHERE severity = 'HIGH'     AND false_positive = FALSE AND is_resolved = FALSE),
        COUNT(*) FILTER (WHERE severity = 'MEDIUM'   AND false_positive = FALSE AND is_resolved = FALSE),
        COUNT(*) FILTER (WHERE severity = 'LOW'      AND false_positive = FALSE AND is_resolved = FALSE)
    INTO v_critical, v_high, v_medium, v_low
    FROM public.findings
    WHERE project_id = p_project_id;

    -- Weighted score calculation
    v_score := LEAST(
        (v_critical * 25) + (v_high * 10) + (v_medium * 4) + (v_low * 1),
        100
    );

    -- Update project risk score
    UPDATE public.projects
    SET
        risk_score = v_score,
        last_risk_assessment = TIMEZONE('utc', NOW()),
        updated_at = TIMEZONE('utc', NOW())
    WHERE id = p_project_id;

    RETURN v_score;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- Get Scan With Tenant Authorization
-- ============================================================

CREATE OR REPLACE FUNCTION public.get_scan_with_tenant_check(
    p_scan_id UUID,
    p_tenant_id UUID
)
RETURNS SETOF public.scans AS $$
BEGIN
    RETURN QUERY
    SELECT s.*
    FROM public.scans s
    WHERE s.id = p_scan_id
    AND s.tenant_id = p_tenant_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- Purge Expired Exploit Logs
-- ============================================================

CREATE OR REPLACE FUNCTION public.purge_expired_exploit_logs()
RETURNS INTEGER AS $$
DECLARE
    v_count INTEGER;
BEGIN
    -- Log before deletion
    INSERT INTO public.audit_logs (
        actor_type, actor_id, action, resource_type,
        details, risk_level, signature
    )
    VALUES (
        'SYSTEM', 'PURGE_JOB', 'EXPLOIT_LOGS_PURGED', 'EXPLOIT_MODULE',
        jsonb_build_object('count', (SELECT COUNT(*) FROM public.exploit_logs WHERE expires_at < NOW())),
        'LOW', 'system-purge-no-signature'
    );

    DELETE FROM public.exploit_logs
    WHERE expires_at < TIMEZONE('utc', NOW());

    GET DIAGNOSTICS v_count = ROW_COUNT;

    RETURN v_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- Finding Trend Analysis Function
-- ============================================================

CREATE OR REPLACE FUNCTION public.get_finding_trend(
    p_tenant_id UUID,
    p_days INTEGER DEFAULT 30
)
RETURNS TABLE (
    metric_date DATE,
    critical_count BIGINT,
    high_count BIGINT,
    medium_count BIGINT,
    low_count BIGINT,
    resolved_count BIGINT
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        DATE(f.created_at) AS metric_date,
        COUNT(*) FILTER (WHERE f.severity = 'CRITICAL') AS critical_count,
        COUNT(*) FILTER (WHERE f.severity = 'HIGH') AS high_count,
        COUNT(*) FILTER (WHERE f.severity = 'MEDIUM') AS medium_count,
        COUNT(*) FILTER (WHERE f.severity = 'LOW') AS low_count,
        COUNT(*) FILTER (WHERE f.is_resolved = TRUE) AS resolved_count
    FROM public.findings f
    WHERE f.tenant_id = p_tenant_id
    AND f.created_at > NOW() - (p_days || ' days')::INTERVAL
    GROUP BY DATE(f.created_at)
    ORDER BY metric_date;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- Supabase Auth Hook — Custom JWT Claims
-- ============================================================

CREATE OR REPLACE FUNCTION public.custom_access_token_hook(event JSONB)
RETURNS JSONB AS $$
DECLARE
    claims JSONB;
    user_data RECORD;
BEGIN
    -- Get user profile data
    SELECT
        p.tenant_id,
        p.role,
        p.mfa_enrolled,
        t.plan AS tenant_plan,
        t.name AS tenant_name
    INTO user_data
    FROM public.profiles p
    JOIN public.tenants t ON t.id = p.tenant_id
    WHERE p.id = (event->>'user_id')::UUID
    AND p.deleted_at IS NULL;

    claims := event->'claims';

    IF user_data IS NOT NULL THEN
        -- Inject custom claims into JWT
        claims := jsonb_set(claims, '{app_metadata}', jsonb_build_object(
            'tenant_id', user_data.tenant_id,
            'app_role', user_data.role,
            'tenant_plan', user_data.tenant_plan,
            'tenant_name', user_data.tenant_name,
            'mfa_enrolled', user_data.mfa_enrolled
        ));
    END IF;

    -- Return modified event
    RETURN jsonb_set(event, '{claims}', claims);
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- Register the hook in Supabase Auth
COMMENT ON FUNCTION public.custom_access_token_hook IS
    'Supabase Auth Hook: Injects tenant_id, app_role, and plan into JWT claims';

GRANT EXECUTE ON FUNCTION public.custom_access_token_hook TO supabase_auth_admin;
REVOKE EXECUTE ON FUNCTION public.custom_access_token_hook FROM authenticated, anon, public;