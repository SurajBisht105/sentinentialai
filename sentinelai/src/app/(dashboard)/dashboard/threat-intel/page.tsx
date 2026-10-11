// src/app/(dashboard)/dashboard/threat-intel/page.tsx
"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Target, Search, Shield, RefreshCw, ExternalLink, Clock, TrendingUp, AlertTriangle, ChevronRight } from "lucide-react";
import { Severity } from "@/types";
import { getSeverityBadgeClass, getSeverityColor } from "@/lib/utils";

const MOCK_THREATS = [
  { id: "CVE-2024-4577", severity: "CRITICAL" as Severity, cvss: 9.8, title: "PHP CGI Remote Code Execution", description: "A critical RCE vulnerability in PHP CGI that allows attackers to execute arbitrary code via malformed request headers.", affected: ["php/8.2.0-8.2.18", "php/8.1.0-8.1.29"], published: new Date(Date.now() - 2 * 3600000).toISOString(), exploited_in_wild: true, patch_available: true, affected_count: 3 },
  { id: "CVE-2024-3400", severity: "CRITICAL" as Severity, cvss: 10.0, title: "PAN-OS GlobalProtect Command Injection", description: "A command injection vulnerability in Palo Alto Networks PAN-OS enabling unauthenticated RCE with root privileges.", affected: ["panos/11.1.0-11.1.2", "panos/11.0.0-11.0.4"], published: new Date(Date.now() - 5 * 3600000).toISOString(), exploited_in_wild: true, patch_available: true, affected_count: 0 },
  { id: "CVE-2024-6387", severity: "HIGH" as Severity, cvss: 8.1, title: "OpenSSH RegreSSHion Race Condition RCE", description: "A signal handler race condition in OpenSSH's server (sshd) allows RCE as root on Linux glibc-based systems.", affected: ["openssh/8.5p1-9.7p1"], published: new Date(Date.now() - 12 * 3600000).toISOString(), exploited_in_wild: false, patch_available: true, affected_count: 2 },
  { id: "CVE-2024-1234", severity: "CRITICAL" as Severity, cvss: 9.1, title: "Prototype Pollution in lodash merge()", description: "Lodash's merge() function is vulnerable to prototype pollution when merging untrusted user-controlled objects.", affected: ["lodash/<4.17.21"], published: new Date(Date.now() - 2 * 86400000).toISOString(), exploited_in_wild: false, patch_available: true, affected_count: 8 },
  { id: "CVE-2024-5678", severity: "HIGH" as Severity, cvss: 7.5, title: "Express.js Path Traversal", description: "Improper sanitization of path parameters in Express.js allows directory traversal attacks in specific configurations.", affected: ["express/4.0.0-4.18.2"], published: new Date(Date.now() - 3 * 86400000).toISOString(), exploited_in_wild: false, patch_available: true, affected_count: 1 },
  { id: "CVE-2024-9012", severity: "MEDIUM" as Severity, cvss: 5.9, title: "Next.js Server Component Cache Poisoning", description: "A cache poisoning vulnerability in Next.js server components can expose cached responses across different users.", affected: ["next/13.0.0-14.1.0"], published: new Date(Date.now() - 5 * 86400000).toISOString(), exploited_in_wild: false, patch_available: true, affected_count: 0 },
];

const APT_GROUPS = [
  { name: "APT-29 (Cozy Bear)", target: "OAuth Endpoints, Supply Chain", activity: "HIGH", color: "#ff3366", last_seen: "6h ago" },
  { name: "Lazarus Group", target: "Financial APIs, Crypto Services", activity: "MEDIUM", color: "#ff6b35", last_seen: "2d ago" },
  { name: "FIN7", target: "Payment Processing, POS Systems", activity: "LOW", color: "#ffd700", last_seen: "1w ago" },
];

function formatRelativeTime(date: string) {
  const diff = Date.now() - new Date(date).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export default function ThreatIntelPage() {
  const [search, setSearch] = useState("");
  const [severityFilter, setSeverityFilter] = useState<"ALL" | Severity>("ALL");
  const [onlyAffected, setOnlyAffected] = useState(false);

  const filtered = MOCK_THREATS.filter(t => {
    const matchSearch = t.id.toLowerCase().includes(search.toLowerCase()) || t.title.toLowerCase().includes(search.toLowerCase());
    const matchSev = severityFilter === "ALL" || t.severity === severityFilter;
    const matchAffected = !onlyAffected || t.affected_count > 0;
    return matchSearch && matchSev && matchAffected;
  });

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground tracking-tight">Threat Intelligence</h1>
          <p className="text-sm text-muted-foreground mt-1">Real-time CVE tracking and APT threat feed</p>
        </div>
        <button className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-muted-foreground text-sm hover:text-foreground transition-all">
          <RefreshCw className="w-4 h-4" /> Sync Feeds
        </button>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: "New CVEs (24h)", value: "47", color: "#ff3366", icon: AlertTriangle },
          { label: "Affecting Your Stack", value: String(MOCK_THREATS.filter(t => t.affected_count > 0).reduce((s, t) => s + t.affected_count, 0)), color: "#ff6b35", icon: Target },
          { label: "With Exploits", value: String(MOCK_THREATS.filter(t => t.exploited_in_wild).length), color: "#ffd700", icon: Shield },
          { label: "Patched (7d)", value: "23", color: "#00ff88", icon: TrendingUp },
        ].map(({ label, value, color, icon: Icon }) => (
          <motion.div key={label} whileHover={{ y: -2 }}
            className="glass-card rounded-xl p-4 border border-white/5 flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: `${color}15`, border: `1px solid ${color}30` }}>
              <Icon className="w-4 h-4" style={{ color }} />
            </div>
            <div>
              <p className="text-xl font-bold font-mono" style={{ color }}>{value}</p>
              <p className="text-xs text-muted-foreground">{label}</p>
            </div>
          </motion.div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* CVE Feed */}
        <div className="lg:col-span-2 space-y-4">
          {/* Filters */}
          <div className="flex items-center gap-3 flex-wrap">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search CVE ID or title..."
                className="w-full bg-white/5 border border-white/10 rounded-lg pl-9 pr-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-cyber-cyan/40 transition-all" />
            </div>
            <div className="flex rounded-lg overflow-hidden border border-white/10">
              {(["ALL", "CRITICAL", "HIGH", "MEDIUM"] as const).map(s => (
                <button key={s} onClick={() => setSeverityFilter(s)}
                  className={`px-3 py-2 text-xs font-medium transition-all ${severityFilter === s ? "bg-cyber-cyan/10 text-cyber-cyan" : "text-muted-foreground hover:text-foreground hover:bg-white/5"}`}>
                  {s}
                </button>
              ))}
            </div>
            <label className="flex items-center gap-2 cursor-pointer">
              <div onClick={() => setOnlyAffected(!onlyAffected)}
                className={`relative w-9 h-5 rounded-full transition-all ${onlyAffected ? "bg-cyber-cyan" : "bg-white/10"}`}>
                <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all ${onlyAffected ? "left-[18px]" : "left-0.5"}`} />
              </div>
              <span className="text-xs text-muted-foreground whitespace-nowrap">Affecting my stack</span>
            </label>
          </div>

          {/* CVE List */}
          <div className="space-y-3">
            {filtered.map((threat, i) => {
              const sevColor = getSeverityColor(threat.severity);
              return (
                <motion.div key={threat.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}
                  className="glass-card rounded-xl border border-white/5 p-4 hover:border-white/10 transition-all group">
                  <div className="flex items-start gap-3">
                    <div className="w-1 h-full min-h-[60px] rounded-full flex-shrink-0" style={{ background: sevColor, boxShadow: `0 0 6px ${sevColor}40` }} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs font-bold font-mono" style={{ color: sevColor }}>{threat.id}</span>
                          <span className={getSeverityBadgeClass(threat.severity)}>{threat.severity}</span>
                          <span className="text-xs font-bold font-mono px-1.5 py-0.5 rounded" style={{ color: sevColor, background: `${sevColor}15`, border: `1px solid ${sevColor}30` }}>
                            CVSS {threat.cvss}
                          </span>
                          {threat.exploited_in_wild && (
                            <span className="text-xs font-bold px-1.5 py-0.5 rounded bg-red-500/10 text-red-400 border border-red-500/20 flex items-center gap-1">
                              <div className="w-1.5 h-1.5 rounded-full bg-red-400 animate-pulse" /> EXPLOITED
                            </span>
                          )}
                        </div>
                        <span className="text-xs text-muted-foreground font-mono flex-shrink-0 flex items-center gap-1">
                          <Clock className="w-3 h-3" />{formatRelativeTime(threat.published)}
                        </span>
                      </div>
                      <p className="text-sm font-semibold text-foreground mb-1">{threat.title}</p>
                      <p className="text-xs text-muted-foreground leading-relaxed line-clamp-2">{threat.description}</p>
                      <div className="flex items-center justify-between mt-3">
                        <div className="flex items-center gap-3">
                          <span className="text-xs text-muted-foreground">Affected packages:</span>
                          {threat.affected.slice(0, 2).map(pkg => (
                            <span key={pkg} className="text-xs font-mono bg-white/5 px-1.5 py-0.5 rounded text-muted-foreground">{pkg}</span>
                          ))}
                        </div>
                        {threat.affected_count > 0 && (
                          <span className="text-xs font-bold text-red-400 flex items-center gap-1">
                            <AlertTriangle className="w-3.5 h-3.5" /> {threat.affected_count} in your stack
                          </span>
                        )}
                      </div>
                    </div>
                    <button className="opacity-0 group-hover:opacity-100 transition-opacity p-1.5 rounded-lg hover:bg-white/5 text-muted-foreground hover:text-foreground flex-shrink-0">
                      <ExternalLink className="w-4 h-4" />
                    </button>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>

        {/* APT Tracker */}
        <div className="space-y-4">
          <div className="glass-card rounded-xl border border-white/5 p-5">
            <h3 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
              <Target className="w-4 h-4 text-red-400" /> APT Group Monitor
            </h3>
            <div className="space-y-3">
              {APT_GROUPS.map(apt => (
                <div key={apt.name} className="p-3 rounded-lg bg-white/3 border border-white/5 hover:border-white/10 transition-all cursor-pointer group">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-xs font-bold text-foreground">{apt.name}</p>
                    <span className="text-xs font-bold px-1.5 py-0.5 rounded" style={{ color: apt.color, background: `${apt.color}15`, border: `1px solid ${apt.color}30` }}>
                      {apt.activity}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground mb-2">Targets: {apt.target}</p>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground flex items-center gap-1">
                      <Clock className="w-3 h-3" /> {apt.last_seen}
                    </span>
                    <ChevronRight className="w-3.5 h-3.5 text-muted-foreground group-hover:text-foreground transition-colors" />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Feed Sources */}
          <div className="glass-card rounded-xl border border-white/5 p-5">
            <h3 className="text-sm font-semibold text-foreground mb-4">Intelligence Sources</h3>
            <div className="space-y-2">
              {[
                { name: "NVD / NIST", status: "live", last_sync: "2m ago" },
                { name: "GitHub Advisory DB", status: "live", last_sync: "5m ago" },
                { name: "ExploitDB", status: "live", last_sync: "12m ago" },
                { name: "MITRE ATT&CK", status: "live", last_sync: "1h ago" },
                { name: "AlienVault OTX", status: "delayed", last_sync: "3h ago" },
              ].map(source => (
                <div key={source.name} className="flex items-center justify-between py-2 border-b border-white/5 last:border-0">
                  <div className="flex items-center gap-2">
                    <div className={`w-1.5 h-1.5 rounded-full ${source.status === "live" ? "bg-cyber-emerald animate-pulse" : "bg-yellow-400"}`} />
                    <span className="text-xs text-foreground">{source.name}</span>
                  </div>
                  <span className="text-xs text-muted-foreground font-mono">{source.last_sync}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}


// src/app/(dashboard)/dashboard/threat-intel/page.tsx
// "use client";

// import { useState } from "react";
// import { motion } from "framer-motion";
// import {
//   Target,
//   AlertTriangle,
//   TrendingUp,
//   ExternalLink,
//   Search,
//   Filter,
//   Radio,
//   Shield,
//   Zap,
//   Globe,
//   RefreshCw,
// } from "lucide-react";
// import {
//   BarChart,
//   Bar,
//   XAxis,
//   YAxis,
//   CartesianGrid,
//   Tooltip,
//   ResponsiveContainer,
//   LineChart,
//   Line,
// } from "recharts";
// import { getSeverityBadgeClass, formatRelativeTime } from "@/lib/utils";
// import type { Severity } from "@/types";

// const CVE_DATA = [
//   {
//     id: "CVE-2024-6387",
//     severity: "CRITICAL" as Severity,
//     cvss: 8.1,
//     title: "OpenSSH RegreSSHion — Remote Code Execution",
//     affected: ["openssh < 9.8"],
//     published: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
//     exploited_in_wild: true,
//     packages_affected: 3,
//     description: "A signal handler race condition in OpenSSH allows remote unauthenticated attackers to execute arbitrary code as root.",
//   },
//   {
//     id: "CVE-2024-4577",
//     severity: "CRITICAL" as Severity,
//     cvss: 9.8,
//     title: "PHP CGI Argument Injection — RCE",
//     affected: ["php < 8.3.8", "php < 8.2.20", "php < 8.1.29"],
//     published: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
//     exploited_in_wild: true,
//     packages_affected: 1,
//     description: "PHP CGI argument injection vulnerability allows remote code execution without authentication on Windows servers.",
//   },
//   {
//     id: "CVE-2024-3400",
//     severity: "CRITICAL" as Severity,
//     cvss: 10.0,
//     title: "PAN-OS GlobalProtect — OS Command Injection",
//     affected: ["panos < 11.1.2-h3"],
//     published: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString(),
//     exploited_in_wild: true,
//     packages_affected: 0,
//     description: "A command injection vulnerability in the GlobalProtect feature allows a remote attacker to execute arbitrary code with root privileges.",
//   },
//   {
//     id: "CVE-2024-21626",
//     severity: "HIGH" as Severity,
//     cvss: 8.6,
//     title: "runc Container Escape — Filesystem Breakout",
//     affected: ["runc < 1.1.12"],
//     published: new Date(Date.now() - 12 * 24 * 60 * 60 * 1000).toISOString(),
//     exploited_in_wild: false,
//     packages_affected: 2,
//     description: "A file descriptor leak in runc allows a malicious container to escape the container and gain access to the host filesystem.",
//   },
//   {
//     id: "CVE-2024-1234",
//     severity: "HIGH" as Severity,
//     cvss: 7.5,
//     title: "lodash Prototype Pollution via merge()",
//     affected: ["lodash < 4.17.21"],
//     published: new Date(Date.now() - 20 * 24 * 60 * 60 * 1000).toISOString(),
//     exploited_in_wild: false,
//     packages_affected: 8,
//     description: "Prototype pollution in lodash merge() function allows attackers to modify the Object prototype, potentially leading to RCE.",
//   },
//   {
//     id: "CVE-2024-9999",
//     severity: "MEDIUM" as Severity,
//     cvss: 6.1,
//     title: "Express.js Open Redirect via Host Header",
//     affected: ["express < 4.19.0"],
//     published: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
//     exploited_in_wild: false,
//     packages_affected: 5,
//     description: "Open redirect vulnerability in Express.js via crafted Host header allows attackers to redirect users to malicious sites.",
//   },
// ];

// const TREND_DATA = [
//   { week: "W27", critical: 8, high: 23, medium: 45 },
//   { week: "W28", critical: 12, high: 19, medium: 38 },
//   { week: "W29", critical: 6, high: 28, medium: 52 },
//   { week: "W30", critical: 15, high: 31, medium: 41 },
//   { week: "W31", critical: 9, high: 24, medium: 49 },
//   { week: "W32", critical: 11, high: 27, medium: 44 },
// ];

// const APT_GROUPS = [
//   { name: "APT-29 (Cozy Bear)", activity: "HIGH", targets: ["OAuth Endpoints", "Cloud APIs"], color: "#ff3366" },
//   { name: "Lazarus Group", activity: "MEDIUM", targets: ["Supply Chain", "NPM Registry"], color: "#ff6b35" },
//   { name: "APT-41", activity: "LOW", targets: ["Healthcare APIs", "Database Services"], color: "#ffd700" },
//   { name: "Scattered Spider", activity: "HIGH", targets: ["Identity Providers", "MFA Bypass"], color: "#ff3366" },
// ];

// const ATTACK_VECTORS = [
//   { name: "Supply Chain", count: 34, fill: "#b347ea" },
//   { name: "Prompt Injection", count: 28, fill: "#00f5ff" },
//   { name: "API Vulnerabilities", count: 52, fill: "#ff6b35" },
//   { name: "Container Escape", count: 19, fill: "#ffd700" },
//   { name: "OAuth Attacks", count: 23, fill: "#ff3366" },
//   { name: "LLM Jailbreaks", count: 15, fill: "#00ff88" },
// ];

// const CustomTooltip = ({ active, payload, label }: any) => {
//   if (active && payload && payload.length) {
//     return (
//       <div className="glass-card rounded-lg p-3 border border-white/10">
//         <p className="text-xs font-semibold text-foreground mb-2">{label}</p>
//         {payload.map((entry: any) => (
//           <div key={entry.name} className="flex items-center gap-2 text-xs">
//             <div className="w-2 h-2 rounded-full" style={{ background: entry.color ?? entry.fill }} />
//             <span className="text-muted-foreground capitalize">{entry.name}:</span>
//             <span className="font-mono font-bold text-foreground">{entry.value}</span>
//           </div>
//         ))}
//       </div>
//     );
//   }
//   return null;
// };

// export default function ThreatIntelPage() {
//   const [search, setSearch] = useState("");
//   const [severityFilter, setSeverityFilter] = useState<"ALL" | Severity>("ALL");
//   const [refreshing, setRefreshing] = useState(false);

//   const filtered = CVE_DATA.filter((cve) => {
//     const matchesSearch =
//       search === "" ||
//       cve.id.toLowerCase().includes(search.toLowerCase()) ||
//       cve.title.toLowerCase().includes(search.toLowerCase());
//     const matchesSeverity = severityFilter === "ALL" || cve.severity === severityFilter;
//     return matchesSearch && matchesSeverity;
//   });

//   const handleRefresh = async () => {
//     setRefreshing(true);
//     await new Promise((r) => setTimeout(r, 1500));
//     setRefreshing(false);
//   };

//   return (
//     <div className="space-y-6 animate-fade-in">
//       {/* Header */}
//       <div className="flex items-center justify-between">
//         <div>
//           <h1 className="text-2xl font-bold text-foreground tracking-tight">
//             Threat Intelligence
//           </h1>
//           <p className="text-sm text-muted-foreground mt-1">
//             Real-time CVE feeds, APT tracking, and attack vector analysis
//           </p>
//         </div>
//         <button
//           onClick={handleRefresh}
//           disabled={refreshing}
//           className="flex items-center gap-2 px-4 py-2 rounded-lg bg-cyber-cyan/10 border border-cyber-cyan/20 text-cyber-cyan text-sm hover:bg-cyber-cyan/20 transition-all disabled:opacity-50"
//         >
//           <RefreshCw className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`} />
//           {refreshing ? "Syncing feeds..." : "Sync Feeds"}
//         </button>
//       </div>

//       {/* Live ticker */}
//       <div className="flex items-center gap-3 p-3 rounded-lg border border-red-500/20 bg-red-500/5">
//         <Radio className="w-4 h-4 text-red-400 animate-pulse flex-shrink-0" />
//         <span className="text-xs font-bold text-red-400 flex-shrink-0">LIVE</span>
//         <span className="text-xs text-muted-foreground">
//           3 critical CVEs added in the last 24h · APT-29 activity detected targeting OAuth endpoints · 
//           NVD feed last synced 2 minutes ago
//         </span>
//       </div>

//       {/* Stats Row */}
//       <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
//         {[
//           { label: "New CVEs (7d)", value: "47", color: "#ff3366", icon: AlertTriangle },
//           { label: "Affecting Your Stack", value: "19", color: "#ff6b35", icon: Zap },
//           { label: "Patched This Week", value: "34", color: "#00ff88", icon: Shield },
//           { label: "Active APT Groups", value: "4", color: "#b347ea", icon: Target },
//         ].map((stat, i) => {
//           const Icon = stat.icon;
//           return (
//             <motion.div
//               key={stat.label}
//               initial={{ opacity: 0, y: 10 }}
//               animate={{ opacity: 1, y: 0 }}
//               transition={{ delay: i * 0.05 }}
//               className="glass-card rounded-xl p-4 border border-white/5 flex items-center gap-3"
//             >
//               <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
//                 style={{ background: `${stat.color}15`, border: `1px solid ${stat.color}30` }}>
//                 <Icon className="w-4 h-4" style={{ color: stat.color }} />
//               </div>
//               <div>
//                 <p className="text-xl font-bold font-mono text-foreground">{stat.value}</p>
//                 <p className="text-xs text-muted-foreground">{stat.label}</p>
//               </div>
//             </motion.div>
//           );
//         })}
//       </div>

//       {/* Charts Row */}
//       <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
//         {/* Vulnerability Trend */}
//         <div className="glass-card rounded-xl border border-white/5 p-6">
//           <h3 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
//             <TrendingUp className="w-4 h-4 text-cyber-cyan" />
//             CVE Trend (6 Weeks)
//           </h3>
//           <div style={{ height: 200 }}>
//             <ResponsiveContainer width="100%" height="100%">
//               <LineChart data={TREND_DATA} margin={{ top: 5, right: 5, left: -20, bottom: 5 }}>
//                 <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />
//                 <XAxis dataKey="week" tick={{ fontSize: 11, fill: "#64748b" }} axisLine={false} tickLine={false} />
//                 <YAxis tick={{ fontSize: 11, fill: "#64748b" }} axisLine={false} tickLine={false} />
//                 <Tooltip content={<CustomTooltip />} />
//                 <Line type="monotone" dataKey="critical" stroke="#ff3366" strokeWidth={2} dot={false} />
//                 <Line type="monotone" dataKey="high" stroke="#ff6b35" strokeWidth={2} dot={false} />
//                 <Line type="monotone" dataKey="medium" stroke="#ffd700" strokeWidth={2} dot={false} />
//               </LineChart>
//             </ResponsiveContainer>
//           </div>
//         </div>

//         {/* Attack Vectors */}
//         <div className="glass-card rounded-xl border border-white/5 p-6">
//           <h3 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
//             <Globe className="w-4 h-4 text-cyber-purple" />
//             Top Attack Vectors
//           </h3>
//           <div style={{ height: 200 }}>
//             <ResponsiveContainer width="100%" height="100%">
//               <BarChart data={ATTACK_VECTORS} layout="vertical" margin={{ top: 5, right: 5, left: 80, bottom: 5 }}>
//                 <XAxis type="number" tick={{ fontSize: 11, fill: "#64748b" }} axisLine={false} tickLine={false} />
//                 <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: "#64748b" }} axisLine={false} tickLine={false} />
//                 <Tooltip content={<CustomTooltip />} />
//                 <Bar dataKey="count" radius={[0, 4, 4, 0]}>
//                   {ATTACK_VECTORS.map((entry, index) => (
//                     <rect key={`cell-${index}`} fill={entry.fill} />
//                   ))}
//                 </Bar>
//               </BarChart>
//             </ResponsiveContainer>
//           </div>
//         </div>
//       </div>

//       {/* APT Groups */}
//       <div className="glass-card rounded-xl border border-white/5 p-6">
//         <h3 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
//           <Target className="w-4 h-4 text-cyber-red" />
//           Active APT Group Tracking
//         </h3>
//         <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
//           {APT_GROUPS.map((apt, i) => (
//             <motion.div
//               key={apt.name}
//               initial={{ opacity: 0, scale: 0.95 }}
//               animate={{ opacity: 1, scale: 1 }}
//               transition={{ delay: i * 0.07 }}
//               className="p-4 rounded-xl border border-white/5 bg-white/3"
//             >
//               <div className="flex items-center justify-between mb-2">
//                 <span className="text-xs font-bold text-foreground">{apt.name}</span>
//                 <span className="text-xs font-bold px-2 py-0.5 rounded-full font-mono"
//                   style={{ color: apt.color, background: `${apt.color}15`, border: `1px solid ${apt.color}30` }}>
//                   {apt.activity}
//                 </span>
//               </div>
//               <p className="text-xs text-muted-foreground">Targeting:</p>
//               <div className="flex flex-wrap gap-1 mt-1">
//                 {apt.targets.map((t) => (
//                   <span key={t} className="text-xs px-1.5 py-0.5 rounded bg-white/5 text-muted-foreground">
//                     {t}
//                   </span>
//                 ))}
//               </div>
//             </motion.div>
//           ))}
//         </div>
//       </div>

//       {/* CVE List */}
//       <div className="glass-card rounded-xl border border-white/5 overflow-hidden">
//         {/* Filters */}
//         <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 p-5 border-b border-white/5">
//           <h3 className="text-sm font-semibold text-foreground flex items-center gap-2 flex-shrink-0">
//             <AlertTriangle className="w-4 h-4 text-cyber-red" />
//             CVE Feed
//           </h3>
//           <div className="flex items-center gap-2 flex-1 w-full sm:w-auto">
//             <div className="relative flex-1 max-w-xs">
//               <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
//               <input
//                 type="text"
//                 value={search}
//                 onChange={(e) => setSearch(e.target.value)}
//                 placeholder="Search CVEs..."
//                 className="w-full bg-white/5 border border-white/10 rounded-lg pl-9 pr-3 py-2 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-cyber-cyan/40 transition-all"
//               />
//             </div>
//             <div className="flex rounded-lg overflow-hidden border border-white/10">
//               {(["ALL", "CRITICAL", "HIGH", "MEDIUM"] as const).map((sev) => (
//                 <button
//                   key={sev}
//                   onClick={() => setSeverityFilter(sev as any)}
//                   className={`px-2.5 py-2 text-xs font-medium transition-all ${
//                     severityFilter === sev
//                       ? "bg-cyber-cyan/10 text-cyber-cyan"
//                       : "text-muted-foreground hover:text-foreground"
//                   }`}
//                 >
//                   {sev}
//                 </button>
//               ))}
//             </div>
//           </div>
//         </div>

//         {/* CVE Table */}
//         <div className="divide-y divide-white/5">
//           {filtered.map((cve, i) => (
//             <motion.div
//               key={cve.id}
//               initial={{ opacity: 0, y: 10 }}
//               animate={{ opacity: 1, y: 0 }}
//               transition={{ delay: i * 0.04 }}
//               className="p-5 hover:bg-white/3 transition-colors group"
//             >
//               <div className="flex items-start gap-4">
//                 <div className="flex-1 min-w-0">
//                   <div className="flex flex-wrap items-center gap-2 mb-1.5">
//                     <span className="text-xs font-bold font-mono text-cyber-cyan">{cve.id}</span>
//                     <span className={getSeverityBadgeClass(cve.severity)}>{cve.severity}</span>
//                     {cve.exploited_in_wild && (
//                       <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold bg-red-500/10 text-red-400 border border-red-500/30">
//                         <Radio className="w-2.5 h-2.5 animate-pulse" />
//                         KEV
//                       </span>
//                     )}
//                     <span className="text-xs text-muted-foreground font-mono">CVSS {cve.cvss}</span>
//                   </div>
//                   <p className="text-sm font-semibold text-foreground">{cve.title}</p>
//                   <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{cve.description}</p>
//                   <div className="flex flex-wrap gap-1 mt-2">
//                     {cve.affected.map((pkg) => (
//                       <span key={pkg} className="text-xs px-2 py-0.5 rounded-full bg-white/5 text-muted-foreground font-mono border border-white/5">
//                         {pkg}
//                       </span>
//                     ))}
//                   </div>
//                 </div>
//                 <div className="flex flex-col items-end gap-2 flex-shrink-0">
//                   <span className="text-xs text-muted-foreground">{formatRelativeTime(cve.published)}</span>
//                   {cve.packages_affected > 0 && (
//                     <span className="text-xs font-semibold text-orange-400">
//                       {cve.packages_affected} pkgs affected
//                     </span>
//                   )}
//                   <button className="opacity-0 group-hover:opacity-100 transition-opacity text-xs text-cyber-cyan flex items-center gap-1">
//                     NVD <ExternalLink className="w-3 h-3" />
//                   </button>
//                 </div>
//               </div>
//             </motion.div>
//           ))}
//         </div>
//       </div>
//     </div>
//   );
// }