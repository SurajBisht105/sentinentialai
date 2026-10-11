// src/components/features/dashboard/ComplianceSnapshot.tsx
"use client";

import { motion } from "framer-motion";
import { RadialBarChart, RadialBar, ResponsiveContainer } from "recharts";
import { FileCheck, ExternalLink } from "lucide-react";

import { useComplianceSnapshot } from "@/hooks/useDashboardData";

function ComplianceBar({
  framework,
  index,
}: {
  framework: any;
  index: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: 0.1 * index }}
      className="group"
    >
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-xs font-medium text-foreground">{framework.name}</span>
        <div className="flex items-center gap-2">
          <span
            className="text-xs font-bold font-mono"
            style={{ color: framework.color }}
          >
            {framework.score}%
          </span>
          <span className="text-xs text-muted-foreground">
            {framework.controls.pass}/{framework.controls.total}
          </span>
        </div>
      </div>
      <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${framework.score}%` }}
          transition={{ delay: 0.3 + 0.1 * index, duration: 0.8, ease: "easeOut" }}
          className="h-full rounded-full relative"
          style={{
            background: `linear-gradient(90deg, ${framework.color}80, ${framework.color})`,
            boxShadow: `0 0 8px ${framework.color}40`,
          }}
        />
      </div>
    </motion.div>
  );
}

export function ComplianceSnapshot() {
  const { frameworks, loading, error } = useComplianceSnapshot();

  const avgScore = frameworks.length > 0 
    ? Math.round(frameworks.reduce((sum: number, f: any) => sum + f.score, 0) / frameworks.length)
    : 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.4, duration: 0.5 }}
      className="glass-card rounded-xl border border-white/5 p-6 h-full flex flex-col"
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h3 className="text-base font-semibold text-foreground flex items-center gap-2">
            <FileCheck className="w-4 h-4 text-cyber-cyan" />
            Compliance
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Framework coverage snapshot
          </p>
        </div>
        <button className="text-xs text-cyber-cyan hover:underline flex items-center gap-1">
          Full Report
          <ExternalLink className="w-3 h-3" />
        </button>
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="h-4 w-4 border-2 border-cyber-cyan border-t-transparent rounded-full animate-spin" />
        </div>
      ) : error ? (
        <div className="flex-1 flex items-center justify-center text-cyber-red text-xs">
          Failed to load compliance data
        </div>
      ) : (
        <>
          {/* Overall Score Circle */}
          <div className="flex items-center gap-4 mb-5 p-4 rounded-lg bg-white/5 border border-white/10">
            <div className="relative w-16 h-16">
              <ResponsiveContainer width="100%" height="100%">
                <RadialBarChart
                  cx="50%"
                  cy="50%"
                  innerRadius="70%"
                  outerRadius="100%"
                  data={[{ value: avgScore, fill: "#00f5ff" }]}
                  startAngle={90}
                  endAngle={90 - (avgScore / 100) * 360}
                >
                  <RadialBar dataKey="value" fill="#00f5ff" background={{ fill: "rgba(255,255,255,0.05)" }} />
                </RadialBarChart>
              </ResponsiveContainer>
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-sm font-bold text-cyber-cyan font-mono">
                  {avgScore}%
                </span>
              </div>
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground">
                Overall Compliance
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Across {frameworks.length} frameworks
              </p>
              <div className="flex items-center gap-1.5 mt-2">
                <div className="w-1.5 h-1.5 rounded-full bg-cyber-emerald" />
                <span className="text-xs text-cyber-emerald font-semibold">
                  Audit Ready
                </span>
              </div>
            </div>
          </div>

          {/* Framework Bars */}
          <div className="space-y-3 flex-1">
            {frameworks.map((framework: any, i: number) => (
              <ComplianceBar key={framework.name} framework={framework} index={i} />
            ))}
          </div>
        </>
      )}
    </motion.div>
  );
}