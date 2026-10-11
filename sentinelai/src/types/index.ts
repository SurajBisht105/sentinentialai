// src/types/index.ts

export type AppRole = "Viewer" | "Engineer" | "CISO" | "Superadmin";
export type ScanStatus =
  | "QUEUED"
  | "RUNNING"
  | "COMPLETED"
  | "FAILED"
  | "CANCELLED";
export type Severity = "CRITICAL" | "HIGH" | "MEDIUM" | "LOW" | "INFO";
export type AgentStatus = "ACTIVE" | "IDLE" | "ERROR" | "COMPLETED";
export type RemediationStatus = "PENDING" | "APPLIED" | "REJECTED";
export type AgentType =
  | "DIRECTOR"
  | "PLANNER"
  | "SAST"
  | "DAST"
  | "SCA"
  | "SECRETS"
  | "CONSENSUS"
  | "VERIFICATION"
  | "PR_REVIEW"
  | "COMPLIANCE"
  | "THREAT_INTEL"
  | "JAILBREAK"
  | "PROMPT_INJECTION"
  | "EXPLOIT_VALIDATION"
  | "ROOT_CAUSE"
  | "CONTEXT_ISOLATION"
  | "HALLUCINATION_DETECTION";

export interface User {
  id: string;
  email: string;
  display_name: string;
  role: AppRole;
  tenant_id: string;
  created_at: string;
  avatar_url?: string;
}

export interface Tenant {
  id: string;
  name: string;
  plan: "Free" | "Pro" | "Enterprise";
  created_at: string;
}

export interface Project {
  id: string;
  tenant_id: string;
  name: string;
  repo_url: string;
  created_at: string;
  last_scan_at?: string;
  risk_score?: number;
  scan_count?: number;
  finding_count?: number;
  language?: string;
  branch?: string;
  trend?: "up" | "down" | "stable";
}

export interface Scan {
  id: string;
  project_id: string;
  tenant_id?: string;
  user_id: string;
  status: ScanStatus;
  scan_types: string[];
  branch: string;
  commit_sha?: string;
  target_url?: string;
  trigger_type?: string;
  progress: number;
  finding_count: number;
  critical_count: number;
  high_count: number;
  medium_count: number;
  low_count: number;
  false_positive_count: number;
  total_agents: number;
  completed_agents: number;
  failed_agents: number;
  total_tokens_used: number;
  llm_calls_count: number;
  hallucination_score?: number;
  consensus_confidence?: number;
  started_at: string | null;
  completed_at: string | null;
  duration_seconds?: number;
  error_message?: string;
  created_at: string;
  updated_at?: string;
}

export interface Task {
  id: string;
  scan_id: string;
  agent_type: AgentType;
  status: AgentStatus;
  context: Record<string, unknown>;
  started_at?: string;
  completed_at?: string;
  reasoning?: string;
  tokens_used?: number;
}

export interface Finding {
  id: string;
  scan_id: string;
  task_id?: string;
  tenant_id: string;
  project_id: string;
  severity: Severity;
  title: string;
  description: string;
  cwe_id?: string;
  cve_id?: string;
  owasp_category?: string;
  cvss_score?: number;
  file_path?: string;
  line_number?: number;
  column_number?: number;
  code_snippet?: string;
  agent?: string;
  detecting_agent?: string;
  detection_method?: string;
  verified_by_consensus: boolean;
  consensus_score?: number;
  consensus_agents_agreed: number;
  consensus_agents_total: number;
  false_positive: boolean;
  false_positive_reason?: string;
  false_positive_marked_by?: string;
  false_positive_marked_at?: string;
  is_resolved: boolean;
  resolved_at?: string;
  resolved_by?: string;
  evidence: Record<string, unknown>;
  attack_vector?: string;
  exploitability?: string;
  proof_of_concept?: string;
  references: unknown[];
  metadata: Record<string, unknown>;
  tags: string[];
  fingerprint?: string;
  created_at: string;
  updated_at?: string;
  remediation?: string | Remediation;
}

export interface Remediation {
  id: string;
  finding_id: string;
  proposed_code_fix: string;
  pr_url?: string;
  status: RemediationStatus;
  created_at: string;
}

export interface AgentNode {
  id: string;
  type: AgentType;
  status: AgentStatus;
  name: string;
  description: string;
  tokens_used?: number;
  latency_ms?: number;
  findings_count?: number;
}

export interface MetricCard {
  label: string;
  value: string | number;
  change?: number;
  changeType?: "positive" | "negative" | "neutral";
  icon?: React.ComponentType;
  color?: string;
}

export interface ComplianceReport {
  framework: string;
  score: number;
  total_controls: number;
  passing_controls: number;
  failing_controls: number;
  last_assessed: string;
}

export interface ExploitRequest {
  exploit_type:
    | "PROMPT_INJECTION"
    | "JAILBREAK"
    | "SQL_INJECTION"
    | "XSS"
    | "SSRF"
    | "RCE";
  target_description: string;
  complexity: "LOW" | "MEDIUM" | "HIGH";
  project_id?: string;
}

export interface ThreatIntelItem {
  cve_id: string;
  severity: Severity;
  description: string;
  affected_packages: string[];
  cvss_score: number;
  published_date: string;
}

export interface AuditLogEntry {
  id: string;
  timestamp: string;
  actor_id: string;
  actor_email: string;
  action: string;
  resource_type: string;
  details: Record<string, unknown>;
  ip_address: string;
}

export interface LLMMetrics {
  accuracy: number;
  precision: number;
  recall: number;
  hallucination_score: number;
  latency_p50: number;
  latency_p99: number;
  tokens_per_scan: number;
  false_positive_rate: number;
}

export interface DashboardStats {
  total_projects: number;
  active_scans: number;
  total_findings: number;
  critical_findings: number;
  avg_time_to_detect: number;
  avg_time_to_remediate: number;
  false_positive_rate: number;
  agent_guardrail_success_rate: number;
  compliance_pass_rate: number;
}
