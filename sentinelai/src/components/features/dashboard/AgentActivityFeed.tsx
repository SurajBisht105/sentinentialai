// src/components/features/dashboard/AgentActivityFeed.tsx
"use client";

import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Bot, Shield, AlertTriangle, CheckCircle, Zap, Activity } from "lucide-react";

import { useAgentActivityFeed } from "@/hooks/useDashboardData";

interface ActivityItem {
  id: string;
  timestamp: Date;
  agent: string;
  action: string;
  status: "success" | "warning" | "error" | "info";
  details?: string;
}

const STATUS_CONFIG = {
  success: { color: "#00ff88", icon: CheckCircle, bg: "bg-emerald-500/10" },
  warning: { color: "#ffd700", icon: AlertTriangle, bg: "bg-yellow-500/10" },
  error: { color: "#ff3366", icon: Zap, bg: "bg-red-500/10" },
  info: { color: "#00f5ff", icon: Bot, bg: "bg-cyan-500/10" },
};

function ActivityItemComponent({ item }: { item: ActivityItem }) {
  const config = STATUS_CONFIG[item.status];
  const Icon = config.icon;

  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 20, height: 0 }}
      className="flex items-start gap-2.5 py-2.5 border-b border-white/5 last:border-0"
    >
      <div className={`p-1.5 rounded-md ${config.bg} flex-shrink-0 mt-0.5`}>
        <Icon className="w-3 h-3" style={{ color: config.color }} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-semibold text-foreground truncate">
            {item.agent}
          </span>
          <span className="text-xs text-muted-foreground font-mono flex-shrink-0">
            {item.timestamp.toLocaleTimeString("en-US", {
              hour: "2-digit",
              minute: "2-digit",
              second: "2-digit",
            })}
          </span>
        </div>
        <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
          {item.action}
          {item.details && (
            <span
              className="ml-1.5 font-mono font-semibold"
              style={{ color: config.color }}
            >
              [{item.details}]
            </span>
          )}
        </p>
      </div>
    </motion.div>
  );
}

export function AgentActivityFeed() {
  const { activities, loading, error } = useAgentActivityFeed();

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.5, duration: 0.5 }}
      className="glass-card rounded-xl border border-white/5 overflow-hidden"
    >
      <div className="flex items-center justify-between p-4 border-b border-white/5">
        <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
          <Activity className="w-4 h-4 text-cyber-cyan" />
          Agent Activity
        </h3>
        <div className="flex items-center gap-1.5 text-xs text-cyber-emerald font-mono">
          <div className="w-1.5 h-1.5 rounded-full bg-cyber-emerald animate-pulse" />
          LIVE
        </div>
      </div>

      <div className="p-4 max-h-60 overflow-y-auto">
        {loading && activities.length === 0 ? (
          <div className="flex justify-center p-4">
            <div className="h-4 w-4 border-2 border-cyber-cyan border-t-transparent rounded-full animate-spin" />
          </div>
        ) : error ? (
          <div className="text-center text-xs text-cyber-red p-4">
            Failed to load activity feed
          </div>
        ) : activities.length === 0 ? (
          <div className="text-center text-xs text-muted-foreground p-4">
            No recent activity
          </div>
        ) : (
          <AnimatePresence mode="popLayout">
            {activities.map((item) => (
              <ActivityItemComponent key={item.id} item={item} />
            ))}
          </AnimatePresence>
        )}
      </div>
    </motion.div>
  );
}