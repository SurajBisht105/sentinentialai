// src/components/features/dashboard/ThreatTicker.tsx
"use client";

import { useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { AlertTriangle, Radio } from "lucide-react";

import { useThreatIntel } from "@/hooks/useDashboardData";

export function ThreatTicker() {
  const { threats, loading, error } = useThreatIntel();

  const SEVERITY_COLORS: Record<string, string> = {
    CRITICAL: "#ff3366",
    HIGH: "#ff6b35",
    MEDIUM: "#ffd700",
  };

  const doubled = [...threats, ...threats];

  return (
    <div className="flex items-center gap-3 bg-white/3 border border-white/10 rounded-lg h-10 overflow-hidden">
      {/* Label */}
      <div className="flex items-center gap-2 px-3 py-2 bg-red-500/10 border-r border-red-500/20 flex-shrink-0">
        <Radio className="w-3.5 h-3.5 text-red-400 animate-pulse" />
        <span className="text-xs font-bold text-red-400 uppercase tracking-wider whitespace-nowrap">
          Threat Intel
        </span>
      </div>

      {/* Scrolling ticker */}
      <div className="flex-1 overflow-hidden relative flex items-center">
        {loading ? (
           <span className="text-xs text-muted-foreground ml-4">Loading threat intel...</span>
        ) : error ? (
           <span className="text-xs text-cyber-red ml-4">Failed to load threats</span>
        ) : threats.length === 0 ? (
           <span className="text-xs text-muted-foreground ml-4">No active threats detected.</span>
        ) : (
          <motion.div
            animate={{ x: [0, -50 + "%"] }}
            transition={{
              duration: 30,
              repeat: Infinity,
              ease: "linear",
            }}
            className="flex gap-8 whitespace-nowrap"
          >
            {doubled.map((threat, i) => (
              <span key={`${threat.id}-${i}`} className="flex items-center gap-2 text-xs">
                <span
                  className="font-bold text-xs px-1.5 py-0.5 rounded font-mono"
                  style={{
                    color: SEVERITY_COLORS[threat.severity],
                    background: `${SEVERITY_COLORS[threat.severity]}15`,
                    border: `1px solid ${SEVERITY_COLORS[threat.severity]}30`,
                  }}
                >
                  {threat.severity}
                </span>
                <span className="text-muted-foreground">{threat.text}</span>
                <span className="text-white/20 ml-4">◆</span>
              </span>
            ))}
          </motion.div>
        )}
      </div>
    </div>
  );
}