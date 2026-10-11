// src/app/(dashboard)/dashboard/scans/page.tsx
"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { TriggerScanDialog } from "@/components/features/scans/TriggerScanDialog";
import {
  Activity,
  Play,
  CheckCircle,
  XCircle,
  Search,
  Filter,
  ChevronRight,
  Download,
  Repeat,
  StopCircle,
} from "lucide-react";
import { getScanStatusColor, formatDate, formatDuration } from "@/lib/utils";
import type { ScanStatus } from "@/types";
import { useScans } from "@/hooks/useScans";

const STATUS_ICONS = {
  QUEUED: Activity,
  RUNNING: Activity,
  COMPLETED: CheckCircle,
  FAILED: XCircle,
  CANCELLED: XCircle,
};

export default function ScansPage() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"ALL" | ScanStatus>("ALL");
  const [scanDialogOpen, setScanDialogOpen] = useState(false);
  const [cancellingScan, setCancellingScan] = useState<string | null>(null);
  const { scans, loading, error, refetch } = useScans();

  const handleCancelScan = async (scanId: string) => {
    if (
      !window.confirm(
        "Stop this scan? Work that has already completed will be kept.",
      )
    )
      return;
    setCancellingScan(scanId);
    try {
      const response = await fetch(`/api/scans/${scanId}`, { method: "POST" });
      if (!response.ok) throw new Error("Unable to stop scan");
      toast.success("Scan cancelled");
      await refetch();
    } catch (cancelError) {
      console.error("Failed to cancel scan:", cancelError);
      toast.error(
        cancelError instanceof Error
          ? cancelError.message
          : "Unable to stop scan",
      );
    } finally {
      setCancellingScan(null);
    }
  };

  // Transform scan data to match the expected format in the UI
  const transformedScans = scans.map((scan) => ({
    id: scan.id,
    project: scan.project_id, // Using project_id as project name for display
    branch: scan.branch,
    status: scan.status as ScanStatus,
    types: scan.scan_types,
    started_at: scan.started_at || new Date().toISOString(),
    duration_seconds:
      scan.completed_at && scan.started_at
        ? Math.floor(
            (new Date(scan.completed_at).getTime() -
              new Date(scan.started_at).getTime()) /
              1000,
          )
        : null,
    finding_count: scan.finding_count,
    critical_count: scan.critical_count,
    high_count: scan.high_count,
    initiated_by: scan.user_id, // Using user_id as initiator for display
    progress: scan.progress,
  }));

  const filtered = transformedScans.filter((scan) => {
    const matchesSearch =
      search === "" ||
      scan.project.toLowerCase().includes(search.toLowerCase()) ||
      scan.id.toLowerCase().includes(search.toLowerCase());
    const matchesStatus =
      statusFilter === "ALL" || scan.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const stats = {
    total: transformedScans.length,
    completed: transformedScans.filter((s) => s.status === "COMPLETED").length,
    running: transformedScans.filter((s) => s.status === "RUNNING").length,
    failed: transformedScans.filter((s) => s.status === "FAILED").length,
    totalFindings: transformedScans.reduce(
      (sum, s) => sum + s.finding_count,
      0,
    ),
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground tracking-tight">
            Scan History
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Complete log of all multi-agent security scans
          </p>
        </div>
        <button
          onClick={() => setScanDialogOpen(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-cyber-cyan/10 border border-cyber-cyan/20 text-cyber-cyan text-sm hover:bg-cyber-cyan/20 transition-all"
        >
          <Play className="w-4 h-4" />
          New Scan
        </button>
      </div>

      <TriggerScanDialog
        open={scanDialogOpen}
        onClose={() => {
          setScanDialogOpen(false);
          refetch();
        }}
      />

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
          {/* Stats */}
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
            {[
              { label: "Total Scans", value: stats.total, color: "#00f5ff" },
              { label: "Completed", value: stats.completed, color: "#00ff88" },
              { label: "Running", value: stats.running, color: "#00f5ff" },
              { label: "Failed", value: stats.failed, color: "#ff3366" },
              {
                label: "Total Findings",
                value: stats.totalFindings,
                color: "#ff6b35",
              },
            ].map((stat, i) => (
              <motion.div
                key={stat.label}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                className="glass-card rounded-xl p-4 border border-white/5 text-center"
              >
                <p
                  className="text-2xl font-bold font-mono"
                  style={{ color: stat.color }}
                >
                  {stat.value}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  {stat.label}
                </p>
              </motion.div>
            ))}
          </div>

          {/* Filters */}
          <div className="glass-card rounded-xl border border-white/5 overflow-hidden">
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 p-4 border-b border-white/5">
              <div className="relative flex-1 max-w-xs w-full">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search scans..."
                  className="w-full bg-white/5 border border-white/10 rounded-lg pl-9 pr-3 py-2 text-xs focus:outline-none focus:border-cyber-cyan/40 transition-all text-foreground placeholder:text-muted-foreground"
                />
              </div>
              <div className="flex items-center gap-1.5">
                <Filter className="w-3.5 h-3.5 text-muted-foreground" />
                <div className="flex rounded-lg overflow-hidden border border-white/10">
                  {(
                    [
                      "ALL",
                      "COMPLETED",
                      "RUNNING",
                      "QUEUED",
                      "FAILED",
                      "CANCELLED",
                    ] as const
                  ).map((s) => (
                    <button
                      key={s}
                      onClick={() => setStatusFilter(s === "ALL" ? "ALL" : s)}
                      className={`px-2.5 py-1.5 text-xs font-medium transition-all ${
                        statusFilter === s
                          ? "bg-cyber-cyan/10 text-cyber-cyan"
                          : "text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Table */}
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-white/5">
                    {[
                      "Scan ID",
                      "Project",
                      "Branch",
                      "Types",
                      "Progress",
                      "Status",
                      "Findings",
                      "Duration",
                      "Started",
                      "By",
                      "",
                    ].map((col) => (
                      <th
                        key={col}
                        className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider whitespace-nowrap"
                      >
                        {col}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((scan, i) => {
                    const StatusIcon = STATUS_ICONS[scan.status];
                    const statusColor = getScanStatusColor(scan.status);
                    return (
                      <motion.tr
                        key={scan.id}
                        initial={{ opacity: 0, y: 5 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.04 }}
                        className="border-b border-white/5 hover:bg-white/3 transition-colors group cursor-pointer"
                      >
                        <td className="px-4 py-3.5">
                          <span className="text-xs font-mono text-cyber-cyan">
                            {scan.id}
                          </span>
                        </td>
                        <td className="px-4 py-3.5">
                          <span className="text-sm font-medium text-foreground">
                            {scan.project}
                          </span>
                        </td>
                        <td className="px-4 py-3.5">
                          <span className="text-xs font-mono text-muted-foreground">
                            {scan.branch}
                          </span>
                        </td>
                        <td className="px-4 py-3.5">
                          <div className="flex flex-wrap gap-1">
                            {scan.types.map((t) => (
                              <span
                                key={t}
                                className="text-xs px-1.5 py-0.5 rounded bg-white/5 text-muted-foreground font-mono"
                              >
                                {t}
                              </span>
                            ))}
                          </div>
                        </td>
                        <td className="px-4 py-3.5">
                          <div className="w-24">
                            <div className="flex items-center justify-between text-[10px] text-muted-foreground mb-1">
                              <span>{scan.progress || 0}%</span>
                              {scan.status === "RUNNING" && scan.started_at && (
                                <span>
                                  {formatDuration(
                                    Math.max(
                                      0,
                                      Math.floor(
                                        (Date.now() -
                                          new Date(scan.started_at).getTime()) /
                                          1000,
                                      ),
                                    ),
                                  )}
                                </span>
                              )}
                            </div>
                            <div className="h-1.5 rounded-full bg-white/10 overflow-hidden">
                              <div
                                className="h-full bg-cyber-cyan transition-all"
                                style={{
                                  width: `${Math.min(100, Math.max(0, scan.progress || 0))}%`,
                                }}
                              />
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3.5">
                          <div className="flex items-center gap-1.5">
                            <StatusIcon
                              className={`w-3.5 h-3.5 ${scan.status === "RUNNING" ? "animate-spin" : ""}`}
                              style={{ color: statusColor }}
                            />
                            <span
                              className="text-xs font-semibold"
                              style={{ color: statusColor }}
                            >
                              {scan.status}
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-3.5">
                          {scan.finding_count > 0 ? (
                            <div className="flex items-center gap-1">
                              <span className="text-sm font-bold text-foreground">
                                {scan.finding_count}
                              </span>
                              {scan.critical_count > 0 && (
                                <span className="text-xs text-red-400 font-mono">
                                  ({scan.critical_count}C)
                                </span>
                              )}
                            </div>
                          ) : (
                            <span className="text-xs text-muted-foreground">
                              —
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3.5">
                          <span className="text-xs font-mono text-muted-foreground">
                            {scan.duration_seconds
                              ? formatDuration(scan.duration_seconds)
                              : "—"}
                          </span>
                        </td>
                        <td className="px-4 py-3.5">
                          <span className="text-xs text-muted-foreground whitespace-nowrap">
                            {formatDate(scan.started_at, {
                              month: "short",
                              day: "numeric",
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </span>
                        </td>
                        <td className="px-4 py-3.5">
                          <span className="text-xs text-muted-foreground">
                            {scan.initiated_by}
                          </span>
                        </td>
                        <td className="px-4 py-3.5">
                          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            {(scan.status === "QUEUED" ||
                              scan.status === "RUNNING") && (
                              <button
                                onClick={(event) => {
                                  event.stopPropagation();
                                  handleCancelScan(scan.id);
                                }}
                                disabled={cancellingScan === scan.id}
                                className="text-xs text-red-400 hover:text-red-300 disabled:opacity-50"
                                title="Stop scan"
                              >
                                <StopCircle className="w-3.5 h-3.5" />
                              </button>
                            )}
                            <button className="text-xs text-cyber-cyan hover:underline flex items-center gap-0.5">
                              View <ChevronRight className="w-3 h-3" />
                            </button>
                            <button className="text-xs text-muted-foreground hover:text-foreground ml-1">
                              <Repeat className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </motion.tr>
                    );
                  })}
                  {filtered.length === 0 && (
                    <tr>
                      <td
                        colSpan={10}
                        className="px-4 py-6 text-center text-muted-foreground"
                      >
                        No scans found
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <div className="px-4 py-3 border-t border-white/5 flex items-center justify-between">
              <span className="text-xs text-muted-foreground">
                {filtered.length} scans shown
              </span>
              <button className="text-xs text-cyber-cyan flex items-center gap-1 hover:underline">
                <Download className="w-3 h-3" />
                Export CSV
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
