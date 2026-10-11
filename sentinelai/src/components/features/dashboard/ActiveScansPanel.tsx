// src/components/features/dashboard/ActiveScansPanel.tsx
"use client";

import { motion, AnimatePresence } from "framer-motion";
import {
  Activity,
  Play,
  Loader2,
  CheckCircle,
  XCircle,
  Clock,
} from "lucide-react";
import { ScanStatus } from "@/types";
import { getScanStatusColor } from "@/lib/utils";
import { useScans } from "@/hooks/useScans";

export function ActiveScansPanel() {
  const { scans, loading, error, refetch } = useScans({
    // Only show active scans (queued or running) as in the original mock
    status: undefined, // We'll filter client-side for simplicity
  });

  // Filter to only show queued and running scans (active scans)
  const activeScans = scans.filter(
    (scan) => scan.status === "QUEUED" || scan.status === "RUNNING"
  );

  const STATUS_ICONS = {
    QUEUED: Clock,
    RUNNING: Loader2,
    COMPLETED: CheckCircle,
    FAILED: XCircle,
    CANCELLED: XCircle, // Using X for cancelled as well
  };

  if (loading && !error && scans.length === 0) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4, duration: 0.5 }}
        className="glass-card rounded-xl border border-white/5 overflow-hidden"
      >
        <div className="p-8 text-center">
          <div className="flex items-center justify-center mb-4">
            <div className="h-4 w-4 border-2 border-cyber-cyan border-t-transparent rounded-full animate-spin" />
          </div>
          <p className="text-sm text-muted-foreground">Loading active scans...</p>
        </div>
      </motion.div>
    );
  }

  if (error && !loading) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4, duration: 0.5 }}
        className="glass-card rounded-xl border border-white/5 overflow-hidden"
      >
        <div className="p-8 text-center text-cyber-red">
          <p className="mb-2">Failed to load scans</p>
          <button
            onClick={refetch}
            className="text-xs text-cyber-cyan hover:underline"
          >
            Retry
          </button>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.4, duration: 0.5 }}
      className="glass-card rounded-xl border border-white/5 overflow-hidden"
    >
      <div className="flex items-center justify-between p-4 border-b border-white/5">
        <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
          <Activity className="w-4 h-4 text-cyber-cyan" />
          Active Scans
        </h3>
        <span className="text-xs font-mono bg-cyber-cyan/10 border border-cyber-cyan/20 text-cyber-cyan px-2 py-0.5 rounded-full">
          {activeScans.filter((s) => s.status === "RUNNING").length} running
        </span>
      </div>

      <div className="p-4 space-y-3">
        {activeScans.length === 0 ? (
          <p className="text-center text-xs text-muted-foreground">
            No active scans
          </p>
        ) : (
          <AnimatePresence>
            {activeScans.map((scan, i) => {
              const StatusIcon = STATUS_ICONS[scan.status as keyof typeof STATUS_ICONS];
              const statusColor = getScanStatusColor(scan.status as ScanStatus);

              return (
                <motion.div
                  key={scan.id}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.05 }}
                  className="p-3 rounded-lg bg-white/3 border border-white/5 hover:border-white/10 transition-all group"
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <StatusIcon
                        className={`w-3.5 h-3.5 ${scan.status === "RUNNING" ? "animate-spin" : ""}`}
                        style={{ color: statusColor }}
                      />
                      {/* Truncate project ID for display since we don't have project name in the scan data */}
                      <span className="text-xs font-semibold text-foreground">
                        Project {scan.project_id ? `${scan.project_id.slice(0, 8)}...` : 'N/A'}
                      </span>
                    </div>
                    <div className="flex gap-1">
                      {scan.scan_types?.map((type) => (
                        <span
                          key={type}
                          className="text-xs px-1.5 py-0.5 rounded bg-white/5 text-muted-foreground font-mono"
                        >
                          {type}
                        </span>
                      ))}
                    </div>
                  </div>

                  {scan.status === "RUNNING" && (
                    <div className="space-y-1">
                      <div className="h-1 bg-white/5 rounded-full overflow-hidden">
                        {/* We don't have progress in the scan data, so we'll simulate it or show indeterminate */}
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: "100%" }}
                          transition={{ duration: 2, ease: "easeInOut", repeatType: "mirror", repeat: Infinity }}
                          className="h-full rounded-full"
                          style={{
                            background: `linear-gradient(90deg, ${statusColor}60, ${statusColor})`,
                            boxShadow: `0 0 8px ${statusColor}40`,
                          }}
                        />
                      </div>
                      <div className="flex justify-between text-xs text-muted-foreground">
                        <span>
                          Started {new Date(scan.started_at || scan.created_at).toLocaleTimeString()}
                        </span>
                        <span className="font-mono" style={{ color: statusColor }}>
                          Scanning...
                        </span>
                      </div>
                    </div>
                  )}

                  {scan.status === "QUEUED" && (
                    <p className="text-xs text-muted-foreground">
                      Queued • waiting for agents...
                    </p>
                  )}
                </motion.div>
              );
            })}
          </AnimatePresence>
        )}
      </div>
    </motion.div>
  );
}