// src/app/(dashboard)/dashboard/audit/page.tsx
"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import {
  Database,
  Search,
  Download,
  Shield,
  User,
  Bot,
  Lock,
  AlertTriangle,
  CheckCircle,
  Calendar,
  Filter,
  Hash,
} from "lucide-react";
import { formatDate } from "@/lib/utils";

const AUDIT_LOGS = [
  { id: "log-001", timestamp: new Date(Date.now() - 2 * 60 * 1000).toISOString(), actor_type: "USER", actor: "alex@corp.io", role: "Superadmin", action: "GENERATE_EXPLOIT", resource: "EXPLOIT_MODULE", details: "Prompt injection payload generated for auth-service testing", ip: "10.0.1.5", risk: "HIGH" },
  { id: "log-002", timestamp: new Date(Date.now() - 5 * 60 * 1000).toISOString(), actor_type: "AGENT", actor: "GUARDRAIL_AGENT", role: "SYSTEM", action: "PROMPT_INJECTION_BLOCKED", resource: "LLM_GATEWAY", details: "Indirect prompt injection detected and blocked in analyzed source code", ip: "internal", risk: "CRITICAL" },
  { id: "log-003", timestamp: new Date(Date.now() - 8 * 60 * 1000).toISOString(), actor_type: "USER", actor: "sam@corp.io", role: "Engineer", action: "SCAN_INITIATED", resource: "SCAN/scn-001", details: "Manual DAST scan triggered on api-gateway:main", ip: "10.0.2.3", risk: "LOW" },
  { id: "log-004", timestamp: new Date(Date.now() - 12 * 60 * 1000).toISOString(), actor_type: "AGENT", actor: "CONSENSUS_ENGINE", role: "SYSTEM", action: "CONSENSUS_REACHED", resource: "FINDING/f-001", details: "3-agent consensus verified CWE-89 SQLi finding in payment-service", ip: "internal", risk: "MEDIUM" },
  { id: "log-005", timestamp: new Date(Date.now() - 20 * 60 * 1000).toISOString(), actor_type: "USER", actor: "jordan@corp.io", role: "CISO", action: "COMPLIANCE_REPORT_EXPORTED", resource: "COMPLIANCE/SOC2", details: "SOC2 Type II PDF report exported", ip: "10.0.3.7", risk: "LOW" },
  { id: "log-006", timestamp: new Date(Date.now() - 35 * 60 * 1000).toISOString(), actor_type: "SYSTEM", actor: "POLICY_ENGINE", role: "SYSTEM", action: "POLICY_VIOLATION_BLOCKED", resource: "AGENT/DAST_AGENT", details: "DAST agent attempted unauthorized tool invocation — blocked and terminated", ip: "internal", risk: "CRITICAL" },
  { id: "log-007", timestamp: new Date(Date.now() - 48 * 60 * 1000).toISOString(), actor_type: "USER", actor: "alex@corp.io", role: "Superadmin", action: "USER_ROLE_UPDATED", resource: "USER/sam@corp.io", details: "Role changed from Viewer to Engineer", ip: "10.0.1.5", risk: "MEDIUM" },
  { id: "log-008", timestamp: new Date(Date.now() - 60 * 60 * 1000).toISOString(), actor_type: "AGENT", actor: "PR_REVIEW_AGENT", role: "SYSTEM", action: "PR_CREATED", resource: "GITHUB/PR#847", details: "Remediation PR created for CWE-89 in auth/login.ts", ip: "internal", risk: "LOW" },
  { id: "log-009", timestamp: new Date(Date.now() - 90 * 60 * 1000).toISOString(), actor_type: "USER", actor: "unknown", role: "NONE", action: "LOGIN_FAILED", resource: "AUTH", details: "5 consecutive failed login attempts — account temporarily locked", ip: "185.220.101.45", risk: "HIGH" },
  { id: "log-010", timestamp: new Date(Date.now() - 120 * 60 * 1000).toISOString(), actor_type: "AGENT", actor: "SANDBOX", role: "SYSTEM", action: "SANDBOX_ESCAPE_ATTEMPT", resource: "SANDBOX/vm-a7f3", details: "Out-of-bounds network request detected — VM destroyed immediately", ip: "internal", risk: "CRITICAL" },
];

const RISK_CONFIG = {
  CRITICAL: { color: "#ff3366", bg: "rgba(255,51,102,0.1)", border: "rgba(255,51,102,0.3)" },
  HIGH: { color: "#ff6b35", bg: "rgba(255,107,53,0.1)", border: "rgba(255,107,53,0.3)" },
  MEDIUM: { color: "#ffd700", bg: "rgba(255,215,0,0.1)", border: "rgba(255,215,0,0.3)" },
  LOW: { color: "#00ff88", bg: "rgba(0,255,136,0.1)", border: "rgba(0,255,136,0.3)" },
};

const ACTOR_ICONS = {
  USER: User,
  AGENT: Bot,
  SYSTEM: Shield,
};

export default function AuditLogsPage() {
  const [search, setSearch] = useState("");
  const [riskFilter, setRiskFilter] = useState<"ALL" | "CRITICAL" | "HIGH" | "MEDIUM" | "LOW">("ALL");
  const [actorFilter, setActorFilter] = useState<"ALL" | "USER" | "AGENT" | "SYSTEM">("ALL");

  const filtered = AUDIT_LOGS.filter((log) => {
    const matchSearch =
      search === "" ||
      log.action.toLowerCase().includes(search.toLowerCase()) ||
      log.actor.toLowerCase().includes(search.toLowerCase()) ||
      log.details.toLowerCase().includes(search.toLowerCase());
    const matchRisk = riskFilter === "ALL" || log.risk === riskFilter;
    const matchActor = actorFilter === "ALL" || log.actor_type === actorFilter;
    return matchSearch && matchRisk && matchActor;
  });

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground tracking-tight">Audit Logs</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Immutable, cryptographically signed log of all system actions
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-semibold">
            <Lock className="w-3.5 h-3.5" />
            Append-Only · Signed
          </div>
          <button className="flex items-center gap-2 px-4 py-2 rounded-lg bg-white/5 border border-white/10 text-sm text-muted-foreground hover:text-foreground transition-all">
            <Download className="w-4 h-4" />
            Export
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Total Events (24h)", value: AUDIT_LOGS.length, color: "#00f5ff", icon: Database },
          { label: "Critical Events", value: AUDIT_LOGS.filter((l) => l.risk === "CRITICAL").length, color: "#ff3366", icon: AlertTriangle },
          { label: "Policy Violations", value: 2, color: "#ff6b35", icon: Shield },
          { label: "User Actions", value: AUDIT_LOGS.filter((l) => l.actor_type === "USER").length, color: "#b347ea", icon: User },
        ].map((stat, i) => {
          const Icon = stat.icon;
          return (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              className="glass-card rounded-xl p-4 border border-white/5 flex items-center gap-3"
            >
              <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
                style={{ background: `${stat.color}15`, border: `1px solid ${stat.color}30` }}>
                <Icon className="w-4 h-4" style={{ color: stat.color }} />
              </div>
              <div>
                <p className="text-xl font-bold font-mono text-foreground">{stat.value}</p>
                <p className="text-xs text-muted-foreground">{stat.label}</p>
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* Log Table */}
      <div className="glass-card rounded-xl border border-white/5 overflow-hidden">
        {/* Filters */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 p-4 border-b border-white/5 flex-wrap">
          <div className="relative w-full sm:max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search logs..."
              className="w-full bg-white/5 border border-white/10 rounded-lg pl-9 pr-3 py-2 text-xs focus:outline-none focus:border-cyber-cyan/40 transition-all text-foreground placeholder:text-muted-foreground"
            />
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Filter className="w-3.5 h-3.5 text-muted-foreground" />
            <div className="flex rounded-lg overflow-hidden border border-white/10">
              {(["ALL", "CRITICAL", "HIGH", "MEDIUM", "LOW"] as const).map((r) => (
                <button key={r} onClick={() => setRiskFilter(r)}
                  className={`px-2.5 py-1.5 text-xs font-medium transition-all ${riskFilter === r ? "bg-cyber-cyan/10 text-cyber-cyan" : "text-muted-foreground hover:text-foreground"}`}>
                  {r}
                </button>
              ))}
            </div>
            <div className="flex rounded-lg overflow-hidden border border-white/10">
              {(["ALL", "USER", "AGENT", "SYSTEM"] as const).map((a) => (
                <button key={a} onClick={() => setActorFilter(a)}
                  className={`px-2.5 py-1.5 text-xs font-medium transition-all ${actorFilter === a ? "bg-cyber-cyan/10 text-cyber-cyan" : "text-muted-foreground hover:text-foreground"}`}>
                  {a}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Log Entries */}
        <div className="divide-y divide-white/5">
          {filtered.map((log, i) => {
            const riskCfg = RISK_CONFIG[log.risk as keyof typeof RISK_CONFIG];
            const ActorIcon = ACTOR_ICONS[log.actor_type as keyof typeof ACTOR_ICONS] ?? User;
            return (
              <motion.div
                key={log.id}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.03 }}
                className="p-4 hover:bg-white/3 transition-colors group"
              >
                <div className="flex items-start gap-4">
                  {/* Actor Icon */}
                  <div className="w-8 h-8 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <ActorIcon className="w-4 h-4 text-muted-foreground" />
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                      <span className="text-xs font-bold text-foreground">{log.action.replace(/_/g, " ")}</span>
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold"
                        style={{ color: riskCfg.color, background: riskCfg.bg, border: `1px solid ${riskCfg.border}` }}>
                        {log.risk}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground leading-relaxed">{log.details}</p>
                    <div className="flex flex-wrap items-center gap-3 mt-2 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <User className="w-3 h-3" />
                        {log.actor}
                        <span className="text-cyber-cyan font-semibold ml-1">[{log.role}]</span>
                      </span>
                      <span className="flex items-center gap-1">
                        <Database className="w-3 h-3" />
                        {log.resource}
                      </span>
                      <span className="flex items-center gap-1 font-mono">
                        <Hash className="w-3 h-3" />
                        {log.id}
                      </span>
                    </div>
                  </div>

                  {/* Timestamp & IP */}
                  <div className="flex flex-col items-end gap-1 flex-shrink-0">
                    <span className="text-xs text-muted-foreground font-mono whitespace-nowrap">
                      {formatDate(log.timestamp, { hour: "2-digit", minute: "2-digit", second: "2-digit", month: "short", day: "numeric" })}
                    </span>
                    <span className="text-xs text-muted-foreground font-mono">{log.ip}</span>
                    <button className="opacity-0 group-hover:opacity-100 transition-opacity">
                      <CheckCircle className="w-3.5 h-3.5 text-emerald-400" aria-label="Signature verified" />
                    </button>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>

        <div className="px-4 py-3 border-t border-white/5 flex items-center justify-between">
          <span className="text-xs text-muted-foreground">{filtered.length} events shown</span>
          <div className="flex items-center gap-1.5 text-xs text-emerald-400">
            <Lock className="w-3 h-3" />
            All entries cryptographically signed
          </div>
        </div>
      </div>
    </div>
  );
}

// src/app/(dashboard)/dashboard/audit/page.tsx
// "use client";

// import { useState } from "react";
// import { motion } from "framer-motion";
// import { Database, Search, Filter, Download, Shield, User, Bot, AlertTriangle, CheckCircle, Clock, Lock } from "lucide-react";

// const MOCK_AUDIT_LOGS = [
//   { id: "al-001", timestamp: new Date(Date.now() - 1 * 60000).toISOString(), actor_type: "USER", actor: "alex@corp.io", action: "GENERATE_EXPLOIT", resource: "EXPLOIT_MODULE", severity: "HIGH", ip: "192.168.1.5", details: { exploit_type: "PROMPT_INJECTION", authorized_by_role: "Superadmin" }, success: true },
//   { id: "al-002", timestamp: new Date(Date.now() - 5 * 60000).toISOString(), actor_type: "AGENT", actor: "SAST Agent", action: "TOOL_INVOCATION", resource: "CODE_SCANNER", severity: "INFO", ip: "10.0.0.12", details: { tool: "semgrep", target: "src/auth/login.ts" }, success: true },
//   { id: "al-003", timestamp: new Date(Date.now() - 8 * 60000).toISOString(), actor_type: "AGENT", actor: "Guardrail Agent", action: "POLICY_VIOLATION_BLOCKED", resource: "LLM_GATEWAY", severity: "CRITICAL", ip: "10.0.0.15", details: { reason: "Prompt injection detected in analyzed payload" }, success: false },
//   { id: "al-004", timestamp: new Date(Date.now() - 12 * 60000).toISOString(), actor_type: "USER", actor: "sam@corp.io", action: "TRIGGER_SCAN", resource: "SCAN_ENGINE", severity: "INFO", ip: "192.168.1.8", details: { project: "api-gateway", scan_types: ["DAST"] }, success: true },
//   { id: "al-005", timestamp: new Date(Date.now() - 25 * 60000).toISOString(), actor_type: "USER", actor: "jordan@corp.io", action: "ACCESS_DENIED", resource: "EXPLOIT_MODULE", severity: "HIGH", ip: "192.168.1.10", details: { reason: "Insufficient role: Engineer < Superadmin" }, success: false },
//   { id: "al-006", timestamp: new Date(Date.now() - 42 * 60000).toISOString(), actor_type: "USER", actor: "riley@corp.io", action: "EXPORT_REPORT", resource: "COMPLIANCE_REPORT", severity: "MEDIUM", ip: "192.168.1.20", details: { framework: "SOC2", format: "PDF" }, success: true },
//   { id: "al-007", timestamp: new Date(Date.now() - 1 * 3600000).toISOString(), actor_type: "SYSTEM", actor: "SYSTEM", action: "AGENT_SANDBOX_ESCAPE_ATTEMPT", resource: "FIRECRACKER_VM", severity: "CRITICAL", ip: "10.0.0.99", details: { vm_id: "vm-abc123", action_attempted: "network_access", blocked: true }, success: false },
//   { id: "al-008", timestamp: new Date(Date.now() - 2 * 3600000).toISOString(), actor_type: "USER", actor: "alex@corp.io", action: "TEAM_MEMBER_INVITED", resource: "USER_MANAGEMENT", severity: "INFO", ip: "192.168.1.5", details: { invited_email: "newuser@corp.io", assigned_role: "Engineer" }, success: true },
// ];

// const ACTION_COLORS: Record<string, string> = {
//   HIGH: "#ff6b35", CRITICAL: "#ff3366", MEDIUM: "#ffd700", INFO: "#00f5ff", LOW: "#00ff88",
// };
// const ACTOR_ICONS: Record<string, any> = { USER: User, AGENT: Bot, SYSTEM: Shield };

// function formatRelativeTime(date: string) {
//   const diff = Date.now() - new Date(date).getTime();
//   const mins = Math.floor(diff / 60000);
//   if (mins < 60) return `${mins}m ago`;
//   const hrs = Math.floor(mins / 60);
//   if (hrs < 24) return `${hrs}h ago`;
//   return `${Math.floor(hrs / 24)}d ago`;
// }

// export default function AuditPage() {
//   const [search, setSearch] = useState("");
//   const [actorFilter, setActorFilter] = useState("ALL");
//   const [sevFilter, setSevFilter] = useState("ALL");

//   const filtered = MOCK_AUDIT_LOGS.filter(log => {
//     const matchSearch = log.action.toLowerCase().includes(search.toLowerCase()) || log.actor.toLowerCase().includes(search.toLowerCase()) || log.resource.toLowerCase().includes(search.toLowerCase());
//     const matchActor = actorFilter === "ALL" || log.actor_type === actorFilter;
//     const matchSev = sevFilter === "ALL" || log.severity === sevFilter;
//     return matchSearch && matchActor && matchSev;
//   });

//   return (
//     <div className="space-y-6 animate-fade-in">
//       <div className="flex items-center justify-between">
//         <div>
//           <h1 className="text-2xl font-bold text-foreground tracking-tight">Audit Logs</h1>
//           <p className="text-sm text-muted-foreground mt-1">Immutable, cryptographically-signed audit trail of all system actions</p>
//         </div>
//         <button className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-muted-foreground text-sm hover:text-foreground transition-all">
//           <Download className="w-4 h-4" /> Export Logs
//         </button>
//       </div>

//       {/* Info Banner */}
//       <div className="flex items-center gap-3 p-4 rounded-xl bg-cyber-cyan/5 border border-cyber-cyan/20">
//         <Lock className="w-4 h-4 text-cyber-cyan flex-shrink-0" />
//         <p className="text-xs text-muted-foreground">
//           All entries are <span className="text-cyber-cyan font-semibold">append-only</span> and <span className="text-cyber-cyan font-semibold">cryptographically signed</span> for non-repudiation compliance with SOC 2, ISO 27001, and PCI DSS.
//         </p>
//       </div>

//       {/* Filters */}
//       <div className="flex items-center gap-3 flex-wrap">
//         <div className="relative flex-1 min-w-[200px]">
//           <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
//           <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search actions, actors, resources..."
//             className="w-full bg-white/5 border border-white/10 rounded-lg pl-9 pr-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-cyber-cyan/40 transition-all" />
//         </div>
//         <div className="flex rounded-lg overflow-hidden border border-white/10">
//           {["ALL", "USER", "AGENT", "SYSTEM"].map(f => (
//             <button key={f} onClick={() => setActorFilter(f)}
//               className={`px-3 py-2 text-xs font-medium transition-all ${actorFilter === f ? "bg-cyber-cyan/10 text-cyber-cyan" : "text-muted-foreground hover:text-foreground hover:bg-white/5"}`}>
//               {f}
//             </button>
//           ))}
//         </div>
//         <div className="flex rounded-lg overflow-hidden border border-white/10">
//           {["ALL", "CRITICAL", "HIGH", "MEDIUM", "INFO"].map(f => (
//             <button key={f} onClick={() => setSevFilter(f)}
//               className={`px-3 py-2 text-xs font-medium transition-all ${sevFilter === f ? "bg-cyber-cyan/10 text-cyber-cyan" : "text-muted-foreground hover:text-foreground hover:bg-white/5"}`}>
//               {f}
//             </button>
//           ))}
//         </div>
//       </div>

//       {/* Log Table */}
//       <div className="glass-card rounded-xl border border-white/5 overflow-hidden">
//         <div className="grid grid-cols-12 px-5 py-3 border-b border-white/5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
//           <span className="col-span-2">Time</span>
//           <span className="col-span-2">Actor</span>
//           <span className="col-span-3">Action</span>
//           <span className="col-span-2">Resource</span>
//           <span className="col-span-1">Severity</span>
//           <span className="col-span-1">Result</span>
//           <span className="col-span-1">IP</span>
//         </div>
//         <div>
//           {filtered.map((log, i) => {
//             const sevColor = ACTION_COLORS[log.severity] ?? "#64748b";
//             const ActorIcon = ACTOR_ICONS[log.actor_type] ?? User;
//             return (
//               <motion.div key={log.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.03 }}
//                 className="grid grid-cols-12 items-center px-5 py-3 border-b border-white/5 last:border-0 hover:bg-white/3 transition-all group cursor-pointer">
//                 <div className="col-span-2">
//                   <p className="text-xs font-mono text-muted-foreground">{formatRelativeTime(log.timestamp)}</p>
//                   <p className="text-xs text-muted-foreground/60 font-mono">{new Date(log.timestamp).toLocaleTimeString()}</p>
//                 </div>
//                 <div className="col-span-2 flex items-center gap-1.5 min-w-0">
//                   <ActorIcon className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
//                   <span className="text-xs text-foreground truncate">{log.actor}</span>
//                 </div>
//                 <div className="col-span-3">
//                   <p className="text-xs font-mono font-semibold text-foreground truncate">{log.action}</p>
//                 </div>
//                 <div className="col-span-2">
//                   <span className="text-xs font-mono bg-white/5 px-1.5 py-0.5 rounded text-muted-foreground">{log.resource}</span>
//                 </div>
//                 <div className="col-span-1">
//                   <span className="text-xs font-bold" style={{ color: sevColor }}>{log.severity}</span>
//                 </div>
//                 <div className="col-span-1">
//                   {log.success
//                     ? <CheckCircle className="w-4 h-4 text-emerald-400" />
//                     : <AlertTriangle className="w-4 h-4 text-red-400" />}
//                 </div>
//                 <div className="col-span-1">
//                   <span className="text-xs font-mono text-muted-foreground">{log.ip}</span>
//                 </div>
//               </motion.div>
//             );
//           })}
//         </div>
//       </div>

//       {filtered.length === 0 && (
//         <div className="text-center py-16">
//           <Database className="w-10 h-10 text-muted-foreground mx-auto mb-3 opacity-20" />
//           <p className="text-sm text-muted-foreground">No log entries match your filters</p>
//         </div>
//       )}
//     </div>
//   );
// }