// src/app/(dashboard)/dashboard/agents/trace/[id]/page.tsx
"use client";

import { use, useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Terminal,
  ArrowLeft,
  Bot,
  CheckCircle,
  AlertTriangle,
  Clock,
  ChevronRight,
  Download,
  Maximize2,
  Activity,
} from "lucide-react";
import Link from "next/link";
import { formatDuration } from "@/lib/utils";
import { useAgentLogs } from "@/hooks/useAgentLogs";

interface ScanStatusResponse {
  scan_id: string;
  status: string;
  progress: number;
  scan_types: string[];
  finding_count: number;
  critical_count: number;
  high_count: number;
  started_at?: string;
  completed_at?: string;
  duration_seconds?: number;
}

const LEVEL_COLORS = {
  INFO: "#00f5ff",
  WARNING: "#ffd700",
  ERROR: "#ff3366",
  SUCCESS: "#00ff88",
  DEBUG: "#64748b",
};

export default function TraceDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const [scan, setScan] = useState<ScanStatusResponse | null>(null);
  const logsEndRef = useRef<HTMLDivElement>(null);
  const [fullscreen, setFullscreen] = useState(false);
  const { logs, isConnected } = useAgentLogs(id);

  useEffect(() => {
    let mounted = true;
    const loadScan = async () => {
      try {
        const response = await fetch(`/api/scans/${id}`);
        if (!response.ok) return;
        const data = (await response.json()) as ScanStatusResponse;
        if (mounted) {
          setScan(data);
        }
      } catch {
        if (mounted) {
          setScan(null);
        }
      }
    };

    loadScan();
    const timer = window.setInterval(loadScan, 5000);
    return () => {
      mounted = false;
      window.clearInterval(timer);
    };
  }, [id]);

  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [logs]);

  const totalFindings = scan?.finding_count ?? 0;
  const scanComplete =
    scan?.status === "COMPLETED" ||
    scan?.status === "FAILED" ||
    scan?.status === "CANCELLED";

  return (
    <div
      className={`space-y-6 animate-fade-in ${fullscreen ? "fixed inset-0 z-50 p-6 bg-sentinel-900 overflow-y-auto" : ""}`}
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link
            href="/dashboard/agents"
            className="p-2 rounded-lg bg-white/5 border border-white/10 text-muted-foreground hover:text-foreground transition-all"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div>
            <h1 className="text-xl font-bold text-foreground tracking-tight flex items-center gap-2">
              <Terminal className="w-5 h-5 text-cyber-emerald" />
              Agent Trace — {id}
            </h1>
            <p className="text-xs text-muted-foreground mt-0.5">
              {scan?.scan_types?.join(" + ") || "Waiting for scan metadata"}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {scanComplete ? (
            <span className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
              <CheckCircle className="w-3.5 h-3.5" />
              Scan Complete
            </span>
          ) : (
            <span className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full bg-cyber-cyan/10 border border-cyber-cyan/20 text-cyber-cyan">
              <Activity className="w-3.5 h-3.5 animate-pulse" />
              {isConnected ? "Running" : "Connecting"}
            </span>
          )}
          <button
            onClick={() => setFullscreen(!fullscreen)}
            className="p-2 rounded-lg bg-white/5 border border-white/10 text-muted-foreground hover:text-foreground transition-all"
          >
            <Maximize2 className="w-4 h-4" />
          </button>
          <button className="p-2 rounded-lg bg-white/5 border border-white/10 text-muted-foreground hover:text-foreground transition-all">
            <Download className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          {
            label: "Agents Invoked",
            value: logs.length,
            color: "#00f5ff",
            icon: Bot,
          },
          {
            label: "Findings",
            value: totalFindings,
            color: "#ff3366",
            icon: AlertTriangle,
          },
          {
            label: "Events",
            value: logs.length,
            color: "#b347ea",
            icon: Activity,
          },
          {
            label: "Scan Duration",
            value: scan?.duration_seconds
              ? formatDuration(scan.duration_seconds)
              : "--",
            color: "#00ff88",
            icon: Clock,
          },
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
              <div
                className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                style={{
                  background: `${stat.color}15`,
                  border: `1px solid ${stat.color}30`,
                }}
              >
                <Icon className="w-4 h-4" style={{ color: stat.color }} />
              </div>
              <div>
                <p className="text-lg font-bold font-mono text-foreground">
                  {stat.value}
                </p>
                <p className="text-xs text-muted-foreground">{stat.label}</p>
              </div>
            </motion.div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Terminal */}
        <div className="lg:col-span-2">
          <div
            className="glass-card rounded-xl border border-white/5 overflow-hidden"
            style={{
              height: "500px",
              display: "flex",
              flexDirection: "column",
            }}
          >
            {/* Terminal Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-white/5 flex-shrink-0">
              <div className="flex items-center gap-3">
                <div className="flex gap-1.5">
                  <div className="w-3 h-3 rounded-full bg-red-500/70" />
                  <div className="w-3 h-3 rounded-full bg-yellow-500/70" />
                  <div className="w-3 h-3 rounded-full bg-green-500/70" />
                </div>
                <span className="text-xs text-muted-foreground font-mono">
                  sentinel-ai — trace:{id} — {logs.length} events
                </span>
              </div>
              {!scanComplete && (
                <div className="w-2 h-2 rounded-full bg-cyber-emerald animate-pulse" />
              )}
            </div>

            {/* Log Output */}
            <div
              className="flex-1 overflow-y-auto p-4 space-y-1 font-mono text-xs"
              style={{ background: "rgba(2,4,8,0.95)" }}
            >
              <AnimatePresence>
                {logs.map((log, i) => (
                  <motion.div
                    key={`${log.id}-${i}`}
                    initial={{ opacity: 0, y: 5 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex items-start gap-2 leading-relaxed"
                  >
                    <span className="text-muted-foreground/60 flex-shrink-0 w-24 text-right">
                      {new Date(log.timestamp).toLocaleTimeString()}
                    </span>
                    <span
                      className="font-bold flex-shrink-0 w-6 text-center"
                      style={{
                        color:
                          LEVEL_COLORS[
                            log.level as keyof typeof LEVEL_COLORS
                          ] ?? "#00f5ff",
                      }}
                    >
                      {log.level === "ERROR"
                        ? "✗"
                        : log.level === "SUCCESS"
                          ? "✓"
                          : log.level === "WARNING"
                            ? "⚠"
                            : "›"}
                    </span>
                    <span
                      className="font-bold flex-shrink-0 w-28"
                      style={{
                        color:
                          LEVEL_COLORS[
                            log.level as keyof typeof LEVEL_COLORS
                          ] ?? "#00f5ff",
                      }}
                    >
                      [{log.agent_type}]
                    </span>
                    <span
                      className={`flex-1 ${
                        log.level === "ERROR"
                          ? "text-red-300"
                          : log.level === "SUCCESS"
                            ? "text-emerald-300"
                            : log.level === "WARNING"
                              ? "text-yellow-300"
                              : "text-gray-300"
                      }`}
                    >
                      {log.message}
                    </span>
                  </motion.div>
                ))}
              </AnimatePresence>
              {!scanComplete && isConnected && (
                <div className="flex items-center gap-2 text-cyber-emerald">
                  <span className="text-muted-foreground/60 w-24 text-right">
                    ...
                  </span>
                  <span className="animate-pulse">▋</span>
                </div>
              )}
              <div ref={logsEndRef} />
            </div>
          </div>
        </div>

        {/* Agent Timeline */}
        <div className="space-y-4">
          <div className="glass-card rounded-xl border border-white/5 p-5">
            <h3 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
              <Activity className="w-4 h-4 text-cyber-cyan" />
              Scan Progress
            </h3>
            <div className="space-y-2 text-xs text-muted-foreground">
              <div className="flex justify-between">
                <span>Status</span>
                <span className="font-mono text-foreground">
                  {scan?.status ?? "UNKNOWN"}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Progress</span>
                <span className="font-mono text-foreground">
                  {scan?.progress ?? 0}%
                </span>
              </div>
              <div className="h-1.5 rounded-full bg-white/10 overflow-hidden">
                <div
                  className="h-full bg-cyber-cyan transition-all"
                  style={{
                    width: `${Math.min(100, Math.max(0, scan?.progress ?? 0))}%`,
                  }}
                />
              </div>
            </div>
          </div>

          {/* Findings Summary */}
          {scanComplete && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="glass-card rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4"
            >
              <div className="flex items-center gap-2 mb-3">
                <CheckCircle className="w-4 h-4 text-emerald-400" />
                <span className="text-sm font-bold text-emerald-400">
                  Scan Complete
                </span>
              </div>
              <div className="space-y-2">
                {[
                  {
                    label: "Critical",
                    value: scan?.critical_count ?? 0,
                    color: "#ff3366",
                  },
                  {
                    label: "High",
                    value: scan?.high_count ?? 0,
                    color: "#ff6b35",
                  },
                  {
                    label: "Total Findings",
                    value: scan?.finding_count ?? 0,
                    color: "#00ff88",
                  },
                  {
                    label: "Progress",
                    value: `${scan?.progress ?? 0}%`,
                    color: "#00f5ff",
                  },
                ].map(({ label, value, color }) => (
                  <div key={label} className="flex justify-between">
                    <span className="text-xs text-muted-foreground">
                      {label}
                    </span>
                    <span
                      className="text-xs font-bold font-mono"
                      style={{ color }}
                    >
                      {value}
                    </span>
                  </div>
                ))}
              </div>
              <Link
                href="/dashboard/vulnerabilities"
                className="mt-3 flex items-center gap-1.5 text-xs text-cyber-cyan hover:underline"
              >
                View Findings <ChevronRight className="w-3 h-3" />
              </Link>
            </motion.div>
          )}
        </div>
      </div>
    </div>
  );
}
