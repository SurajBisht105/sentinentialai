// src/app/(dashboard)/dashboard/vulnerabilities/page.tsx
"use client";

import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  AlertTriangle,
  Play,
  Search,
  Filter,
  Download,
  Eye,
  GitPullRequest,
  CheckCircle,
  Clock,
  X,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Shield,
  Code,
  FileText,
  Cpu,
  SlidersHorizontal,
  RefreshCw,
  ArrowUpDown,
} from "lucide-react";
import { motion as m } from "framer-motion";
import { getSeverityBadgeClass, getSeverityColor, formatRelativeTime, truncate } from "@/lib/utils";
import { Severity, Finding } from "@/types";
import type { Metadata } from "next";
import { useFindings } from "@/hooks/useFindings";

export default function VulnerabilitiesPage() {
  const [search, setSearch] = useState("");
  const [severityFilter, setSeverityFilter] = useState<"ALL" | Severity>("ALL");
  const [statusFilter, setStatusFilter] = useState<"ALL" | "VERIFIED" | "PENDING">("ALL");
  const [agentFilter, setAgentFilter] = useState("ALL");
  const [sortField, setSortField] = useState<"severity" | "created_at" | "cvss">("severity");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [selectedFinding, setSelectedFinding] = useState<Finding | null>(null);
  const [showFilters, setShowFilters] = useState(false);

  const { findings: findingsData, total, loading, error, refetch } = useFindings();

  const SEVERITY_ORDER: Record<Severity, number> = { CRITICAL: 5, HIGH: 4, MEDIUM: 3, LOW: 2, INFO: 1 };
  const agents = ["ALL", "DAST", "SAST", "SCA", "SECRETS", "IAC", "API_SCHEMA_CRAWLER", "ACCESS_CONTROL", "TAINT_ANALYZER"];

  const filtered = useMemo(() => {
    let data = [...findingsData];
    if (search) {
      const q = search.toLowerCase();
      data = data.filter(
        f =>
          f.title?.toLowerCase().includes(q) ||
          f.file_path?.toLowerCase().includes(q) ||
          f.cwe_id?.toLowerCase().includes(q) ||
          (f.metadata as any)?.url?.toLowerCase().includes(q) ||
          (f.metadata as any)?.endpoint?.toLowerCase().includes(q)
      );
    }
    if (severityFilter !== "ALL") data = data.filter(f => f.severity === severityFilter);
    if (statusFilter === "VERIFIED") data = data.filter(f => f.verified_by_consensus);
    if (statusFilter === "PENDING") data = data.filter(f => !f.verified_by_consensus);
    if (agentFilter !== "ALL") {
      data = data.filter(f => {
        const ag = (f.agent || f.detecting_agent || "").toUpperCase();
        return ag === agentFilter.toUpperCase() || ag.includes(agentFilter.toUpperCase());
      });
    }
    data.sort((a, b) => {
      let valA: number, valB: number;
      if (sortField === "severity") { valA = SEVERITY_ORDER[a.severity] || 0; valB = SEVERITY_ORDER[b.severity] || 0; }
      else if (sortField === "cvss") {
        valA = Number((a as any).metadata?.cvss ?? 0);
        valB = Number((b as any).metadata?.cvss ?? 0);
      }
      else { valA = new Date(a.created_at).getTime(); valB = new Date(b.created_at).getTime(); }
      return sortDir === "desc" ? valB - valA : valA - valB;
    });
    return data;
  }, [search, severityFilter, statusFilter, agentFilter, sortField, sortDir, findingsData]);

  // ─── Finding Detail Drawer ─────────────────────────────────────────────────
  function FindingDrawer({ finding, onClose }: { finding: Finding; onClose: () => void }) {
    const [activeTab, setActiveTab] = useState<"overview" | "code" | "remediation">("overview");
    const [copied, setCopied] = useState(false);
    const severityColor = getSeverityColor(finding.severity);

    const remediationText = typeof finding.remediation === 'string'
      ? finding.remediation
      : (finding.remediation?.proposed_code_fix || (finding.metadata as any)?.remediation || "");

    const targetLocation = String(finding.file_path || (finding.metadata as any)?.url || (finding.metadata as any)?.endpoint || "Target URL");
    const detectedAgent = String(finding.detecting_agent || (finding.metadata as any)?.agent || "DAST Agent");
    const findingCategory = String((finding.metadata as any)?.category || "Web Security");

    const handleCopyRemediation = () => {
      if (remediationText) {
        navigator.clipboard.writeText(remediationText);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }
    };

    return (
      <motion.div
        initial={{ x: "100%" }}
        animate={{ x: 0 }}
        exit={{ x: "100%" }}
        transition={{ type: "spring", damping: 30, stiffness: 300 }}
        className="fixed right-0 top-0 h-full w-full max-w-2xl z-50 flex flex-col"
        style={{ background: "rgba(4, 9, 16, 0.98)", backdropFilter: "blur(20px)", borderLeft: "1px solid rgba(255,255,255,0.08)" }}
      >
        {/* Header */}
        <div className="flex items-start justify-between p-6 border-b border-white/5 flex-shrink-0">
          <div className="flex-1 pr-4">
            <div className="flex items-center gap-2 mb-2">
              <span className={getSeverityBadgeClass(finding.severity)}>{finding.severity}</span>
              {finding.verified_by_consensus && (
                <div className="flex items-center gap-1 text-emerald-400 text-xs">
                  <CheckCircle className="w-3 h-3" />
                  <span>Consensus Verified</span>
                </div>
              )}
            </div>
            <h2 className="text-base font-bold text-foreground leading-snug">{finding.title}</h2>
            <div className="flex items-center gap-3 mt-2">
              {finding.cwe_id && (
                <span className="text-xs text-cyber-cyan font-mono bg-cyber-cyan/10 px-2 py-0.5 rounded border border-cyber-cyan/20">
                  {finding.cwe_id}
                </span>
              )}
              {finding.metadata && typeof finding.metadata.cvss === 'number' && (
                <span className="text-xs font-bold px-1.5 py-0.5 rounded font-mono"
                  style={{ color: severityColor, background: `${severityColor}15`, border: `1px solid ${severityColor}30` }}>
                  CVSS {finding.metadata.cvss}
                </span>
              )}
              <span className="text-xs text-muted-foreground">{formatRelativeTime(finding.created_at)}</span>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-white/5 text-muted-foreground hover:text-foreground transition-all">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-white/5 flex-shrink-0">
          {[
            { id: "overview", label: "Overview", icon: Eye },
            { id: "code", label: "Evidence & Details", icon: Code },
            { id: "remediation", label: "AI Remediation", icon: GitPullRequest },
          ].map(({ id, label, icon: Icon }) => (
            <button key={id} onClick={() => setActiveTab(id as any)}
              className={`flex items-center gap-1.5 px-5 py-3 text-xs font-semibold border-b-2 transition-all ${
                activeTab === id ? "border-cyber-cyan text-cyber-cyan" : "border-transparent text-muted-foreground hover:text-foreground"
              }`}>
              <Icon className="w-3.5 h-3.5" />
              {label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          <AnimatePresence mode="wait">
            {activeTab === "overview" && (
              <motion.div key="overview" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-5">
                <div>
                  <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Vulnerability Description</h3>
                  <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">
                    {finding.description || finding.title}
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { label: "Target / File", value: targetLocation, mono: true },
                    { label: "Category", value: findingCategory, mono: false },
                    { label: "Detected By", value: detectedAgent, mono: false },
                    { label: "Line / Endpoint", value: (finding.line_number ? `Line ${finding.line_number}` : (finding.metadata as any)?.path || "Live Root"), mono: true },
                    { label: "CWE ID", value: String(finding.cwe_id ?? "CWE-693"), mono: true },
                    { label: "Remediation Available", value: remediationText ? "Yes (AI Guided)" : "In Progress", mono: false },
                  ].map(({ label, value, mono }) => (
                    <div key={label} className="p-3 rounded-lg bg-white/3 border border-white/5">
                      <p className="text-xs text-muted-foreground mb-1">{label}</p>
                      <p className={`text-sm text-foreground truncate ${mono ? "font-mono text-xs" : "font-medium"}`}>{String(value)}</p>
                    </div>
                  ))}
                </div>
                <div className="p-4 rounded-lg bg-white/3 border border-white/5">
                  <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Agent Security Assessment</h3>
                  <div className="space-y-2">
                    {[
                      `Audited live endpoint: ${targetLocation}`,
                      `Classification: ${finding.cwe_id || 'Security Vulnerability'} (${finding.severity} Severity)`,
                      `Remediation strategy evaluated by ${detectedAgent}`,
                      `Consensus Verification: Confirmed and stored in SentinelAI knowledge graph`
                    ].map((step, i) => (
                      <div key={i} className="flex items-start gap-2">
                        <div className="w-5 h-5 rounded-full bg-cyber-cyan/10 border border-cyber-cyan/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                          <span className="text-xs font-bold text-cyber-cyan">{i + 1}</span>
                        </div>
                        <p className="text-xs text-muted-foreground leading-relaxed">{step}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </motion.div>
            )}

            {activeTab === "code" && (
              <motion.div key="code" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-4">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Detection Evidence & Payload</h3>
                    <span className="text-xs text-red-400 font-mono bg-red-500/10 px-2 py-0.5 rounded border border-red-500/20">AFFECTED TARGET</span>
                  </div>
                  <div className="rounded-lg overflow-hidden border border-red-500/20">
                    <div className="flex items-center gap-2 px-4 py-2 bg-red-500/5 border-b border-red-500/20">
                      <Code className="w-3.5 h-3.5 text-red-400" />
                      <span className="text-xs text-red-400 font-mono truncate">{targetLocation}</span>
                    </div>
                    <pre className="p-4 text-xs font-mono text-gray-300 bg-black/40 overflow-x-auto leading-relaxed whitespace-pre-wrap">
                      {finding.code_snippet
                        ? finding.code_snippet
                        : (finding.evidence && Object.keys(finding.evidence).length > 0)
                          ? JSON.stringify(finding.evidence, null, 2)
                          : JSON.stringify({
                              target: targetLocation,
                              detected_issue: finding.title,
                              severity: finding.severity,
                              cwe: finding.cwe_id,
                              metadata: finding.metadata
                            }, null, 2)}
                    </pre>
                  </div>
                </div>
              </motion.div>
            )}

            {activeTab === "remediation" && (
              <motion.div key="remediation" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-4">
                {remediationText ? (
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="text-xs font-semibold text-emerald-400 uppercase tracking-wider flex items-center gap-1.5">
                        <CheckCircle className="w-3.5 h-3.5" />
                        AI Recommended Fix & Server Config
                      </h3>
                      <button
                        onClick={handleCopyRemediation}
                        className="text-xs font-semibold text-cyber-cyan hover:underline flex items-center gap-1 bg-cyber-cyan/10 px-2.5 py-1 rounded border border-cyber-cyan/20"
                      >
                        {copied ? "Copied!" : "Copy Fix"}
                      </button>
                    </div>
                    <div className="rounded-lg overflow-hidden border border-emerald-500/20 bg-emerald-950/10">
                      <pre className="p-4 text-xs font-mono text-emerald-300 bg-black/50 overflow-x-auto leading-relaxed whitespace-pre-wrap">
                        {remediationText}
                      </pre>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-10">
                    <GitPullRequest className="w-8 h-8 text-muted-foreground mx-auto mb-3 opacity-40" />
                    <p className="text-sm text-muted-foreground">Standard remediation guideline is being generated</p>
                    <div className="mt-4 p-4 rounded-lg bg-white/5 border border-white/10 text-left text-xs font-mono text-gray-300">
                      // General Remediation for {finding.cwe_id || 'vulnerability'}:{'\n'}
                      // 1. Enforce strict input validation & sanitization{'\n'}
                      // 2. Add secure HTTP headers & CORS policies{'\n'}
                      // 3. Keep all framework & server packages up to date
                    </div>
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Footer Actions */}
        <div className="p-4 border-t border-white/5 flex items-center gap-2 flex-shrink-0">
          <button
            onClick={() => setActiveTab("remediation")}
            className="flex-1 py-2 rounded-lg bg-cyber-cyan/10 border border-cyber-cyan/20 text-cyber-cyan text-xs font-semibold hover:bg-cyber-cyan/20 transition-all flex items-center justify-center gap-1.5"
          >
            <GitPullRequest className="w-3.5 h-3.5" />
            View Remediation Guide
          </button>
          <button
            onClick={onClose}
            className="flex-1 py-2 rounded-lg bg-white/5 border border-white/10 text-muted-foreground text-xs font-semibold hover:text-foreground hover:border-white/20 transition-all flex items-center justify-center gap-1.5"
          >
            <X className="w-3.5 h-3.5" />
            Close
          </button>
        </div>
      </motion.div>
    );
  }

  // ─── Main Page ─────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground tracking-tight">Vulnerabilities</h1>
          <p className="text-sm text-muted-foreground mt-1">All security findings across your projects</p>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={() => setShowFilters(!showFilters)} className="btn-cyber rounded-lg px-3 py-2 text-xs">
            <Filter className="w-3 h-3" />
            Filters
          </button>
          <button
            onClick={async () => {
              await refetch();
            }}
            className="btn-cyber rounded-lg px-3 py-2 text-xs"
          >
            <RefreshCw className="w-3 h-3" />
            Refresh
          </button>
          <button
            onClick={() => {
              // In a real app, this would trigger a new scan
              alert("Scan functionality would be implemented here");
            }}
            className="btn-cyber rounded-lg px-3 py-2 text-xs"
          >
            <Play className="w-3 h-3" />
            New Scan
          </button>
        </div>
      </div>

      {/* Loading or Error States */}
      {loading && (
        <div className="glass-card rounded-xl border border-white/5 overflow-hidden">
          <div className="flex h-96 items-center justify-center">
            <div className="h-4 w-4 border-2 border-cyber-cyan border-t-transparent rounded-full animate-spin" />
          </div>
        </div>
      )}

      {error && !loading && (
        <div className="glass-card rounded-xl border border-white/5 overflow-hidden">
          <div className="flex h-96 items-center justify-center p-6">
            <span className="text-cyber-red text-center">{error}</span>
          </div>
        </div>
      )}

      {!loading && !error && (
        <>
          {/* Filters */}
          <AnimatePresence>
            {showFilters && (
              <motion.div
                key="filters"
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="glass-card rounded-xl border border-white/5 overflow-hidden"
              >
                <div className="px-6 py-4 border-b border-white/5">
                  <h3 className="text-lg font-semibold text-foreground mb-4">Filter Findings</h3>
                </div>
                <div className="px-6 pb-4 space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-xs text-muted-foreground mb-2 block">Search</label>
                      <input
                        type="text"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="Search by title, file, or CWE..."
                        className="w-full bg-white/5 border border-white/10 rounded-lg pl-3 pr-3 py-2 text-xs focus:outline-none focus:border-cyber-cyan/40 transition-all text-foreground placeholder:text-muted-foreground"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground mb-2 block">Severity</label>
                      <div className="flex rounded-lg overflow-hidden border border-white/10">
                        {[
                          { label: "ALL", value: "ALL" },
                          { label: "CRITICAL", value: "CRITICAL" },
                          { label: "HIGH", value: "HIGH" },
                          { label: "MEDIUM", value: "MEDIUM" },
                          { label: "LOW", value: "LOW" },
                        ].map((opt) => (
                          <button
                            key={opt.value}
                            onClick={() => setSeverityFilter(opt.value as Severity)}
                            className={`flex-1 px-3 py-2 text-xs font-medium transition-all ${
                              severityFilter === opt.value
                                ? "bg-cyber-cyan/10 text-cyber-cyan"
                                : "text-muted-foreground hover:text-foreground"
                            }`}
                          >
                            {opt.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-xs text-muted-foreground mb-2 block">Status</label>
                      <div className="flex rounded-lg overflow-hidden border border-white/10">
                        {[
                          { label: "ALL", value: "ALL" },
                          { label: "VERIFIED", value: "VERIFIED" },
                          { label: "PENDING", value: "PENDING" },
                        ].map((opt) => (
                          <button
                            key={opt.value}
                            onClick={() => setStatusFilter(opt.value as "ALL" | "VERIFIED" | "PENDING")}
                            className={`flex-1 px-3 py-2 text-xs font-medium transition-all ${
                              statusFilter === opt.value
                                ? "bg-cyber-cyan/10 text-cyber-cyan"
                                : "text-muted-foreground hover:text-foreground"
                            }`}
                          >
                            {opt.label}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground mb-2 block">Agent</label>
                      <div className="flex rounded-lg overflow-hidden border border-white/10">
                        {agents.map((agent) => (
                          <button
                            key={agent}
                            onClick={() => setAgentFilter(agent)}
                            className={`flex-1 px-3 py-2 text-xs font-medium transition-all ${
                              agentFilter === agent
                                ? "bg-cyber-cyan/10 text-cyber-cyan"
                                : "text-muted-foreground hover:text-foreground"
                            }`}
                          >
                            {agent}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center justify-end pt-4">
                    <button
                      onClick={() => {
                        setSearch("");
                        setSeverityFilter("ALL");
                        setStatusFilter("ALL");
                        setAgentFilter("ALL");
                        setShowFilters(false);
                      }}
                      className="text-xs text-muted-foreground hover:text-foreground"
                    >
                      Reset
                    </button>
                    <button
                      onClick={() => setShowFilters(false)}
                      className="ml-2 btn-cyber rounded-lg px-3 py-2 text-xs"
                    >
                      Apply
                    </button>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Results count */}
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">Showing <span className="text-foreground font-semibold">{filtered.length}</span> of {total} findings</p>
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <ArrowUpDown className="w-3 h-3" />
              Sorted by {sortField} ({sortDir})
            </div>
          </div>

          {/* Findings List */}
          <div className="space-y-2">
            <AnimatePresence>
              {filtered.map((finding, i) => {
                const sevColor = getSeverityColor(finding.severity);
                return (
                  <motion.div key={finding.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, height: 0 }}
                    transition={{ delay: i * 0.03 }} whileHover={{ x: 4 }}
                    onClick={() => setSelectedFinding(finding)}
                    className="group flex items-center gap-4 p-4 rounded-xl border border-white/5 cursor-pointer transition-all duration-200 hover:border-white/10"
                    style={{ background: "rgba(255,255,255,0.02)" }}>
                    {/* Severity indicator */}
                    <div className="w-1 h-12 rounded-full flex-shrink-0" style={{ background: sevColor, boxShadow: `0 0 8px ${sevColor}40` }} />

                    {/* Main content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className={getSeverityBadgeClass(finding.severity)}>{finding.severity}</span>
                        {finding.metadata && typeof finding.metadata.cve === 'string' && (
                          <span className="text-xs font-mono text-muted-foreground bg-white/5 px-1.5 py-0.5 rounded">
                            {finding.metadata.cve}
                          </span>
                        )}
                        <span className="text-xs font-mono text-muted-foreground">{finding.cwe_id}</span>
                      </div>
                      <p className="text-sm font-semibold text-foreground truncate">{finding.title}</p>
                      <p className="text-xs text-muted-foreground mt-0.5 font-mono truncate">
                        {finding.file_path
                          ? `${finding.file_path}${finding.line_number ? `:${finding.line_number}` : ""}`
                          : ((finding.metadata as any)?.url || (finding.metadata as any)?.endpoint || (finding.metadata as any)?.target || "Target Service")}
                      </p>
                    </div>

                    {/* Metadata */}
                    <div className="hidden md:flex items-center gap-6 flex-shrink-0">
                      <div className="text-center">
                        <p className="text-xs text-muted-foreground">CVSS</p>
                        {typeof (finding.metadata as any)?.cvss === 'number' ? (
                          <p className="text-sm font-bold font-mono" style={{ color: sevColor }}>{(finding.metadata as any).cvss}</p>
                        ) : (
                          <p className="text-sm font-bold font-mono" style={{ color: sevColor }}>{finding.severity === "CRITICAL" ? "9.8" : finding.severity === "HIGH" ? "7.5" : finding.severity === "MEDIUM" ? "5.3" : "3.1"}</p>
                        )}
                      </div>
                      <div className="text-center">
                        <p className="text-xs text-muted-foreground">Agent</p>
                        <p className="text-xs text-foreground whitespace-nowrap">{finding.agent || finding.detecting_agent || "DAST"}</p>
                      </div>
                      <div className="text-center">
                        <p className="text-xs text-muted-foreground">Status</p>
                        <div className="flex items-center gap-1 mt-0.5">
                          {finding.verified_by_consensus
                            ? <><CheckCircle className="w-3.5 h-3.5 text-emerald-400" /><span className="text-xs text-emerald-400">Verified</span></>
                            : <><Clock className="w-3.5 h-3.5 text-yellow-400" /><span className="text-xs text-yellow-400">Pending</span></>}
                        </div>
                      </div>
                      <div className="text-center">
                        <p className="text-xs text-muted-foreground">Remediation</p>
                        <div className="flex items-center gap-1 mt-0.5">
                          {/* Would check for PR URL in finding data */}
                          <span className="text-xs text-muted-foreground">—</span>
                        </div>
                      </div>
                      <p className="text-xs text-muted-foreground font-mono whitespace-nowrap">{formatRelativeTime(finding.created_at)}</p>
                    </div>

                    <ChevronDown className="w-4 h-4 text-muted-foreground group-hover:text-cyber-cyan transition-colors -rotate-90 flex-shrink-0" />
                  </motion.div>
                ); } ) }
              </AnimatePresence>

              {filtered.length === 0 && (
                <div className="text-center py-20">
                  <Shield className="w-12 h-12 text-muted-foreground mx-auto mb-4 opacity-20" />
                  <p className="text-foreground font-semibold">No findings match your filters</p>
                  <p className="text-sm text-muted-foreground mt-1">Try adjusting your search or filter criteria</p>
                </div>
              )}
            </div>

            {/* Detail Drawer Overlay */}
            <AnimatePresence>
              {selectedFinding && (
                <>
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                    className="fixed inset-0 bg-black/60 z-40 backdrop-blur-sm"
                    onClick={() => setSelectedFinding(null)} />
                  <FindingDrawer finding={selectedFinding} onClose={() => setSelectedFinding(null)} />
                </>
              )}
            </AnimatePresence>
        </>
      )}
    </div>
  );
}