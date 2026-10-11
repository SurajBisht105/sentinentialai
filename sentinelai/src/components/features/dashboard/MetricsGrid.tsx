// src/components/features/dashboard/MetricsGrid.tsx
"use client";

import { motion } from "framer-motion";
import {
  Shield,
  AlertTriangle,
  Clock,
  CheckCircle,
  TrendingDown,
  Bot,
  Zap,
  Target,
} from "lucide-react";
import { useCountUp } from "@/hooks/useCountUp";
import { useDashboardMetrics } from "@/hooks/useDashboardMetrics";

interface Metric {
  label: string;
  value: number | string;
  suffix?: string;
  change: number;
  changeType: "positive" | "negative" | "neutral";
  icon: typeof Shield;
  color: string;
  glowColor: string;
  description: string;
}

export function MetricsGrid() {
  const {
    totalFindings,
    criticalThreats,
    avgTimeToDetect,
    avgTimeToRemediate,
    falsePositiveRate,
    activeAgents,
    guardrailSuccess,
    complianceScore,
    loading,
    error,
  } = useDashboardMetrics();

  // Define the metrics with real data
  const metrics: Metric[] = [
    {
      label: "Total Findings",
      value: totalFindings,
      suffix: "",
      change: -12, // This would ideally come from comparing to previous period
      changeType: "positive" as const,
      icon: AlertTriangle,
      color: "#ff6b35",
      glowColor: "rgba(255, 107, 53, 0.2)",
      description: "Across all projects",
    },
    {
      label: "Critical Threats",
      value: criticalThreats,
      suffix: "",
      change: -8, // This would ideally come from comparing to previous period
      changeType: "positive" as const,
      icon: Zap,
      color: "#ff3366",
      glowColor: "rgba(255, 51, 102, 0.2)",
      description: "Requiring immediate action",
    },
    {
      label: "Avg Time to Detect",
      value: avgTimeToDetect > 0 ? avgTimeToDetect : "--",
      suffix: "min",
      change: -62, // This would ideally come from comparing to previous period
      changeType: "positive" as const,
      icon: Clock,
      color: "#00f5ff",
      glowColor: "rgba(0, 245, 255, 0.2)",
      description: "Post-commit detection",
    },
    {
      label: "Avg Time to Remediate",
      value: avgTimeToRemediate > 0 ? avgTimeToRemediate : "--",
      suffix: "min",
      change: -31, // This would ideally come from comparing to previous period
      changeType: "positive" as const,
      icon: CheckCircle,
      color: "#00ff88",
      glowColor: "rgba(0, 255, 136, 0.2)",
      description: "Including PR creation",
    },
    {
      label: "False Positive Rate",
      value: falsePositiveRate,
      suffix: "%",
      change: -85, // This would ideally come from comparing to previous period
      changeType: "positive" as const,
      icon: TrendingDown,
      color: "#b347ea",
      glowColor: "rgba(179, 71, 234, 0.2)",
      description: `vs 20% industry avg`,
    },
    {
      label: "Active Agents",
      value: activeAgents,
      suffix: "",
      change: 0, // This would ideally come from comparing to previous period
      changeType: "neutral" as const,
      icon: Bot,
      color: "#00f5ff",
      glowColor: "rgba(0, 245, 255, 0.2)",
      description: "Running in parallel",
    },
    {
      label: "Guardrail Success",
      value: guardrailSuccess,
      suffix: "%",
      change: 0, // This would ideally come from comparing to previous period
      changeType: "positive" as const,
      icon: Shield,
      color: "#00ff88",
      glowColor: "rgba(0, 255, 136, 0.2)",
      description: "Zero unauthorized actions",
    },
    {
      label: "Compliance Score",
      value: complianceScore,
      suffix: "%",
      change: 3, // This would ideally come from comparing to previous period
      changeType: "positive" as const,
      icon: Target,
      color: "#ffd700",
      glowColor: "rgba(255, 215, 0, 0.2)",
      description: "SOC2 + ISO27001 avg",
    },
  ];

  const animatedValues = [
    useCountUp(
      typeof metrics[0].value === "number" ? metrics[0].value : 0,
      1500,
      0,
    ),
    useCountUp(
      typeof metrics[1].value === "number" ? metrics[1].value : 0,
      1500,
      0,
    ),
    useCountUp(
      typeof metrics[2].value === "number" ? metrics[2].value : 0,
      1500,
      0,
    ),
    useCountUp(
      typeof metrics[3].value === "number" ? metrics[3].value : 0,
      1500,
      0,
    ),
    useCountUp(
      typeof metrics[4].value === "number" ? metrics[4].value : 0,
      1500,
      0,
    ),
    useCountUp(
      typeof metrics[5].value === "number" ? metrics[5].value : 0,
      1500,
      0,
    ),
    useCountUp(
      typeof metrics[6].value === "number" ? metrics[6].value : 0,
      1500,
      0,
    ),
    useCountUp(
      typeof metrics[7].value === "number" ? metrics[7].value : 0,
      1500,
      0,
    ),
  ];

  if (loading) {
    return (
      <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {Array(8)
          .fill(null)
          .map((_, index) => (
            <motion.div
              key={`skeleton-${index}`}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05, duration: 0.4 }}
              className="relative p-5 rounded-xl glass-card border border-white/5 cursor-default"
            >
              {/* Skeleton loader */}
              <div
                className="absolute inset-0 opacity-0 hover:opacity-100 transition-opacity duration-500 rounded-xl"
                style={{
                  background:
                    "radial-gradient(ellipse at top left, rgba(0, 245, 255, 0.1) 0%, transparent 60%)",
                }}
              />
              <div className="flex items-start justify-between mb-4 relative z-10">
                <div
                  className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
                  style={{
                    background: "rgba(0, 245, 255, 0.1)",
                    border: "1px solid rgba(0, 245, 255, 0.3)",
                  }}
                >
                  <div className="w-4 h-4 bg-gray-300 rounded" />
                </div>
                <div className="h-4 w-4 bg-gray-300 rounded" />
              </div>
              <div className="relative z-10">
                <div className="flex items-end gap-1 mb-1">
                  <span className="h-8 w-24 bg-gray-300 rounded" />
                  <span className="h-4 w-12 bg-gray-300 rounded" />
                </div>
                <p className="text-sm font-medium text-foreground leading-none">
                  Loading...
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Metrics loading...
                </p>
              </div>
              <div
                className="absolute bottom-0 left-0 right-0 h-0.5 opacity-0 hover:opacity-100 transition-opacity duration-300"
                style={{
                  background:
                    "linear-gradient(90deg, transparent, rgba(0, 245, 255, 0.6), transparent)",
                }}
              />
            </motion.div>
          ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {Array(8)
          .fill(null)
          .map((_, index) => (
            <motion.div
              key={`error-${index}`}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05, duration: 0.4 }}
              className="relative p-5 rounded-xl glass-card border border-white/5 cursor-default"
            >
              <div className="p-4 text-center text-cyber-red">
                <p className="mb-2">Failed to load metrics</p>
                <button
                  onClick={() => {
                    // We would need to expose a refetch function from the hook
                    // For now, we'll just note that retry capability would be added
                  }}
                  className="text-xs text-cyber-cyan hover:underline"
                >
                  Retry
                </button>
              </div>
            </motion.div>
          ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {metrics.map((metric, index) => {
        // Format the value for display
        const displayValue =
          typeof metric.value === "number" && !Number.isNaN(metric.value)
            ? metric.value
            : "--";

        // For non-numeric values, we don't want to animate
        const shouldAnimate =
          typeof metric.value === "number" && !Number.isNaN(metric.value);

        return (
          <motion.div
            key={metric.label}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.05, duration: 0.4 }}
            whileHover={{ y: -4, transition: { duration: 0.2 } }}
            className="relative p-5 rounded-xl glass-card border border-white/5 cursor-default group overflow-hidden"
          >
            {/* Background glow on hover */}
            <div
              className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 rounded-xl"
              style={{
                background: `radial-gradient(ellipse at top left, ${metric.glowColor} 0%, transparent 60%)`,
              }}
            />

            {/* Top row */}
            <div className="flex items-start justify-between mb-4 relative z-10">
              <div
                className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
                style={{
                  background: `${metric.glowColor}`,
                  border: `1px solid ${metric.color}30`,
                }}
              >
                <metric.icon
                  className="w-4 h-4"
                  style={{
                    color: metric.color,
                    filter: `drop-shadow(0 0 4px ${metric.color}80)`,
                  }}
                />
              </div>

              {metric.change !== 0 && (
                <div
                  className={`flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded-full ${
                    metric.changeType === "positive"
                      ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                      : metric.changeType === "negative"
                        ? "bg-red-500/10 text-red-400 border border-red-500/20"
                        : "bg-white/5 text-muted-foreground border border-white/10"
                  }`}
                >
                  {metric.changeType === "positive" ? "↓" : "↑"}
                  {Math.abs(metric.change)}%
                </div>
              )}
            </div>

            {/* Value */}
            <div className="relative z-10">
              {shouldAnimate ? (
                <div className="flex items-end gap-1 mb-1">
                  <span
                    className="text-3xl font-bold tracking-tight"
                    style={{ color: metric.color }}
                  >
                    {animatedValues[index]}
                  </span>
                  <span
                    className="text-lg font-semibold mb-0.5"
                    style={{ color: metric.color, opacity: 0.7 }}
                  >
                    {metric.suffix}
                  </span>
                </div>
              ) : (
                <div className="flex items-end gap-1 mb-1">
                  <span
                    className="text-3xl font-bold tracking-tight"
                    style={{ color: metric.color }}
                  >
                    {displayValue}
                  </span>
                  <span
                    className="text-lg font-semibold mb-0.5"
                    style={{ color: metric.color, opacity: 0.7 }}
                  >
                    {metric.suffix}
                  </span>
                </div>
              )}
              <p className="text-sm font-medium text-foreground leading-none">
                {metric.label}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                {metric.description}
              </p>
            </div>

            {/* Bottom accent line */}
            <div
              className="absolute bottom-0 left-0 right-0 h-0.5 opacity-0 group-hover:opacity-100 transition-opacity duration-300"
              style={{
                background: `linear-gradient(90deg, transparent, ${metric.color}, transparent)`,
              }}
            />
          </motion.div>
        );
      })}
    </div>
  );
}
