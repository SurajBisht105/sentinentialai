-- supabase/migrations/20250101000020_seed_data.sql
-- ============================================================
-- SentinelAI — Seed Data
-- Demo tenant, users, projects, and sample findings
-- ============================================================

-- ============================================================
-- Tenants
-- ============================================================

INSERT INTO public.tenants (id, name, slug, plan, max_projects, max_scans_per_day, features)
VALUES
    (
        '00000000-0000-0000-0000-000000000001',
        'Acme Corporation',
        'acme-corp',
        'Enterprise',
        100,
        1000,
        '{"sast": true, "dast": true, "sca": true, "ai_security": true, "exploit_lab": true, "compliance": true}'
    ),
    (
        '00000000-0000-0000-0000-000000000002',
        'Demo Organization',
        'demo-org',
        'Pro',
        10,
        100,
        '{"sast": true, "dast": true, "sca": true, "ai_security": false, "exploit_lab": false}'
    )
ON CONFLICT (slug) DO NOTHING;

-- ============================================================
-- Demo Projects
-- ============================================================

INSERT INTO public.projects (id, tenant_id, name, repo_url, default_branch, primary_language, risk_score, total_scans, open_findings, critical_findings)
VALUES
    (
        '10000000-0000-0000-0000-000000000001',
        '00000000-0000-0000-0000-000000000001',
        'payment-service',
        'https://github.com/acme/payment-service',
        'main',
        'TypeScript',
        68,
        24,
        8,
        2
    ),
    (
        '10000000-0000-0000-0000-000000000002',
        '00000000-0000-0000-0000-000000000001',
        'api-gateway',
        'https://github.com/acme/api-gateway',
        'main',
        'Go',
        41,
        18,
        3,
        0
    ),
    (
        '10000000-0000-0000-0000-000000000003',
        '00000000-0000-0000-0000-000000000001',
        'auth-service',
        'https://github.com/acme/auth-service',
        'main',
        'Python',
        22,
        31,
        1,
        0
    ),
    (
        '10000000-0000-0000-0000-000000000004',
        '00000000-0000-0000-0000-000000000001',
        'data-pipeline',
        'https://github.com/acme/data-pipeline',
        'main',
        'Python',
        55,
        12,
        5,
        1
    ),
    (
        '10000000-0000-0000-0000-000000000005',
        '00000000-0000-0000-0000-000000000001',
        'ml-platform',
        'https://github.com/acme/ml-platform',
        'main',
        'Python',
        38,
        7,
        2,
        0
    )
ON CONFLICT (tenant_id, repo_url) DO NOTHING;

-- ============================================================
-- Demo Compliance Reports
-- ============================================================

INSERT INTO public.compliance_reports (id, tenant_id, framework, framework_version, overall_score, controls_total, controls_passing, controls_failing, controls_na, assessment_date, next_assessment_date, status)
VALUES
    ('20000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', 'SOC2',     'TSC 2017',   94.0, 93,  87,  4,  2,  NOW() - INTERVAL '5 days',  NOW() + INTERVAL '85 days', 'PUBLISHED'),
    ('20000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000001', 'ISO27001', '2022',       89.0, 110, 98,  8,  4,  NOW() - INTERVAL '8 days',  NOW() + INTERVAL '177 days','PUBLISHED'),
    ('20000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000001', 'PCI_DSS',  'v4.0',       91.0, 264, 240, 18, 6,  NOW() - INTERVAL '1 day',   NOW() + INTERVAL '359 days','PUBLISHED'),
    ('20000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000001', 'HIPAA',    '2013',       86.0, 71,  61,  8,  2,  NOW() - INTERVAL '21 days', NOW() + INTERVAL '159 days','PUBLISHED'),
    ('20000000-0000-0000-0000-000000000005', '00000000-0000-0000-0000-000000000001', 'GDPR',     '2018',       97.0, 58,  56,  1,  1,  NOW(),                      NOW() + INTERVAL '180 days','PUBLISHED')
ON CONFLICT DO NOTHING;

-- ============================================================
-- Demo CVE Threat Intelligence
-- ============================================================

INSERT INTO public.threat_intel_cve (cve_id, severity, cvss_v3_score, title, description, exploited_in_wild, kev_listed, patch_available, published_date, source)
VALUES
    (
        'CVE-2024-6387',
        'CRITICAL',
        8.1,
        'OpenSSH RegreSSHion — Remote Code Execution',
        'A signal handler race condition in OpenSSH''s server (sshd) allows remote unauthenticated attackers to execute arbitrary code as root.',
        TRUE, TRUE, TRUE,
        NOW() - INTERVAL '7 days',
        'NVD'
    ),
    (
        'CVE-2024-4577',
        'CRITICAL',
        9.8,
        'PHP CGI Argument Injection RCE',
        'PHP CGI argument injection vulnerability allows remote code execution without authentication on Windows servers.',
        TRUE, TRUE, TRUE,
        NOW() - INTERVAL '14 days',
        'NVD'
    ),
    (
        'CVE-2024-21626',
        'HIGH',
        8.6,
        'runc Container Escape via File Descriptor Leak',
        'A file descriptor leak in runc allows a malicious container to escape and access the host filesystem.',
        FALSE, FALSE, TRUE,
        NOW() - INTERVAL '21 days',
        'GITHUB'
    ),
    (
        'CVE-2024-3400',
        'CRITICAL',
        10.0,
        'PAN-OS GlobalProtect OS Command Injection',
        'A command injection vulnerability in GlobalProtect allows remote unauthenticated code execution as root.',
        TRUE, TRUE, TRUE,
        NOW() - INTERVAL '30 days',
        'NVD'
    )
ON CONFLICT (cve_id) DO NOTHING;

-- ============================================================
-- Demo APT Groups
-- ============================================================

INSERT INTO public.threat_intel_apt (group_name, aliases, nation_state, activity_level, target_sectors, target_technologies)
VALUES
    (
        'APT-29',
        ARRAY['Cozy Bear', 'NOBELIUM', 'The Dukes'],
        'Russia',
        'HIGH',
        ARRAY['Government', 'Defense', 'Technology', 'Finance'],
        ARRAY['OAuth Endpoints', 'Cloud APIs', 'Identity Providers', 'MFA Bypass']
    ),
    (
        'Lazarus Group',
        ARRAY['HIDDEN COBRA', 'Guardians of Peace'],
        'North Korea',
        'MEDIUM',
        ARRAY['Finance', 'Cryptocurrency', 'Technology'],
        ARRAY['Supply Chain', 'NPM Registry', 'CI/CD Pipelines']
    ),
    (
        'APT-41',
        ARRAY['Double Dragon', 'Winnti Group'],
        'China',
        'LOW',
        ARRAY['Healthcare', 'Technology', 'Telecommunications'],
        ARRAY['Database Services', 'Healthcare APIs', 'VPN Infrastructure']
    ),
    (
        'Scattered Spider',
        ARRAY['UNC3944', 'Starfraud'],
        'Unknown',
        'HIGH',
        ARRAY['Technology', 'Gaming', 'Hospitality'],
        ARRAY['Identity Providers', 'MFA Bypass', 'Social Engineering', 'SIM Swapping']
    )
ON CONFLICT DO NOTHING;

-- ============================================================
-- Update Tenant LLM Quota Reset Date
-- ============================================================

UPDATE public.tenants
SET
    llm_quota_reset_at = DATE_TRUNC('month', NOW()) + INTERVAL '1 month',
    updated_at = TIMEZONE('utc', NOW())
WHERE id = '00000000-0000-0000-0000-000000000001';

-- ============================================================
-- Verify seed data
-- ============================================================

DO $$
BEGIN
    ASSERT (SELECT COUNT(*) FROM public.tenants) >= 2,         'Expected at least 2 tenants';
    ASSERT (SELECT COUNT(*) FROM public.projects) >= 5,        'Expected at least 5 projects';
    ASSERT (SELECT COUNT(*) FROM public.compliance_reports) >= 5, 'Expected 5 compliance reports';
    ASSERT (SELECT COUNT(*) FROM public.threat_intel_cve) >= 4,   'Expected at least 4 CVEs';
    ASSERT (SELECT COUNT(*) FROM public.threat_intel_apt) >= 4,   'Expected at least 4 APT groups';

    RAISE NOTICE 'Seed data verification: PASSED';
END;
$$;