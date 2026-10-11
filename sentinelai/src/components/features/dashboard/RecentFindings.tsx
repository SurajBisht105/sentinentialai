// src/components/features/dashboard/RecentFindings.tsx
"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import {
  AlertTriangle,
  ExternalLink,
  CheckCircle,
  Clock,
  ChevronRight,
  Filter,
} from "lucide-react";
import { getSeverityBadgeClass, formatRelativeTime, truncate } from "@/lib/utils";
import { Severity } from "@/types";
import { useFindings } from "@/hooks/useFindings";

const SEVERITY_FILTERS: Array<"ALL" | Severity> = [
  "ALL",
  "CRITICAL",
  "HIGH",
  "MEDIUM",
  "LOW",
];

export function RecentFindings() {
  const [filterSeverity, setFilterSeverity] = useState<"ALL" | Severity>("ALL");
  const { findings, total, loading, error, refetch } = useFindings({
    verifiedOnly: true, // Only show consensus-verified findings as in the original
    excludeFalsePositives: true,
  });

  const filtered =
    filterSeverity === "ALL"
      ? findings
      : findings.filter((f) => f.severity === filterSeverity);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.5, duration: 0.5 }}
      className="glass-card rounded-xl border border-white/5 overflow-hidden"
    >
      {/* Header */}
      <div className="flex items-center justify-between p-5 border-b border-white/5">
        <div>
          <h3 className="text-base font-semibold text-foreground flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-cyber-red" />
            Recent Findings
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Consensus-verified vulnerabilities
          </p>
        </div>

        {/* Filters */}
        <div className="flex items-center gap-2">
          <Filter className="w-3.5 h-3.5 text-muted-foreground" />
          <div className="flex rounded-lg overflow-hidden border border-white/10">
            {SEVERITY_FILTERS.map((sev) => (
              <button
                key={sev}
                onClick={() => setFilterSeverity(sev)}
                className={`px-2.5 py-1 text-xs font-medium transition-all duration-200 ${
                  filterSeverity === sev
                    ? "bg-cyber-cyan/10 text-cyber-cyan"
                    : "text-muted-foreground hover:text-foreground hover:bg-white/5"
                }`}
              >
                {sev}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Loading State */}
      {loading && !error && (
        <div className="p-8 text-center">
          <div className="flex items-center justify-center mb-4">
            <div className="h-4 w-4 border-2 border-cyber-cyan border-t-transparent rounded-full animate-spin" />
          </div>
          <p className="text-sm text-muted-foreground">Loading findings...</p>
        </div>
      )}

      {/* Error State */}
      {error && !loading && (
        <div className="p-8 text-center text-cyber-red">
          <p className="mb-2">Failed to load findings</p>
          <button
            onClick={refetch}
            className="text-xs text-cyber-cyan hover:underline"
          >
            Retry
          </button>
        </div>
      )}

      {/* Empty State */}
      {!loading && !error && findings.length === 0 && (
        <div className="p-8 text-center">
          <p className="text-sm text-muted-foreground">
            No findings match the current filters
          </p>
        </div>
      )}

      {/* Findings Table */}
      {!loading && !error && (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-white/5">
                {["Severity", "Finding", "Location", "Agent", "Status", "Time", ""].map(
                  (col) => (
                    <th
                      key={col}
                      className="px-5 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider"
                    >
                      {col}
                    </th>
                  )
                )}
              </tr>
            </thead>
            <tbody>
              {filtered.map((finding, i) => (
                <motion.tr
                  key={finding.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05 }}
                  className="border-b border-white/5 hover:bg-white/3 transition-colors group cursor-pointer"
                >
                  {/* Severity */}
                  <td className="px-5 py-3.5">
                    <span className={getSeverityBadgeClass(finding.severity)}>
                      {finding.severity}
                    </span>
                  </td>

                  {/* Title */}
                  <td className="px-5 py-3.5">
                    <div className="max-w-xs">
                      <p className="text-sm text-foreground font-medium leading-snug">
                        {truncate(finding.title, 45)}
                      </p>
                      <span className="text-xs text-muted-foreground font-mono">
                        {finding.cwe_id}
                      </span>
                    </div>
                  </td>

                  {/* Location */}
                  <td className="px-5 py-3.5">
                    <div className="max-w-xs">
                      <p className="text-xs text-muted-foreground font-mono truncate">
                        {finding.file_path}
                        {finding.line_number ? (
                          <span className="text-cyber-cyan">:{finding.line_number}</span>
                        ) : null}
                      </p>
                    </div>
                  </td>

                  {/* Agent */}
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-1.5">
                      <div className="w-1.5 h-1.5 rounded-full bg-cyber-cyan" />
                      <span className="text-xs text-muted-foreground whitespace-nowrap">
                        {finding.agent || finding.detecting_agent || "DAST"}
                      </span>
                    </div>
                  </td>

                  {/* Status */}
                  <td className="px-5 py-3.5">
                    {finding.verified_by_consensus ? (
                      <div className="flex items-center gap-1.5 text-emerald-400">
                        <CheckCircle className="w-3.5 h-3.5" />
                        <span className="text-xs font-semibold">Verified</span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1.5 text-yellow-400">
                        <Clock className="w-3.5 h-3.5" />
                        <span className="text-xs font-semibold">Pending</span>
                      </div>
                    )}
                  </td>

                  {/* Time */}
                  <td className="px-5 py-3.5">
                    <span className="text-xs text-muted-foreground font-mono">
                      {formatRelativeTime(finding.created_at)}
                    </span>
                  </td>

                  {/* Actions */}
                  <td className="px-5 py-3.5">
                    <button className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1 text-xs text-cyber-cyan hover:underline">
                      Details
                      <ChevronRight className="w-3 h-3" />
                    </button>
                  </td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Footer */}
      {!loading && !error && (
        <div className="p-4 border-t border-white/5 flex items-center justify-between">
          <span className="text-xs text-muted-foreground">
            Showing {filtered.length} of {total} findings
          </span>
          <button className="text-xs text-cyber-cyan hover:underline flex items-center gap-1">
            View all findings
            <ExternalLink className="w-3 h-3" />
          </button>
        </div>
      )}
    </motion.div>
  );
}