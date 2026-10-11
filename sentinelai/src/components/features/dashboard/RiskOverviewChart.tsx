// src/components/features/dashboard/RiskOverviewChart.tsx
"use client";

import { useState } from "react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  Legend,
} from "recharts";
import { motion } from "framer-motion";
import { TrendingDown, BarChart2, Activity } from "lucide-react";

import { useRiskTrend } from "@/hooks/useDashboardData";

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="glass-card rounded-lg p-3 border border-white/10 shadow-xl">
        <p className="text-xs font-semibold text-foreground mb-2">{label}</p>
        {payload.map((entry: any) => (
          <div key={entry.name} className="flex items-center gap-2 text-xs">
            <div
              className="w-2 h-2 rounded-full"
              style={{ background: entry.color }}
            />
            <span className="text-muted-foreground capitalize">{entry.name}:</span>
            <span className="text-foreground font-mono font-semibold">
              {entry.value}
            </span>
          </div>
        ))}
      </div>
    );
  }
  return null;
};

export function RiskOverviewChart() {
  const [chartType, setChartType] = useState<"area" | "bar">("area");
  const { data, loading, error } = useRiskTrend();

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.3, duration: 0.5 }}
      className="glass-card rounded-xl p-6 border border-white/5 h-full"
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-base font-semibold text-foreground flex items-center gap-2">
            <Activity className="w-4 h-4 text-cyber-cyan" />
            Vulnerability Trend
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            7-month finding history by severity
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* Trend badge */}
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-semibold">
            <TrendingDown className="w-3 h-3" />
            <span>↓ 49% Critical</span>
          </div>
          {/* Chart type toggle */}
          <div className="flex rounded-lg overflow-hidden border border-white/10">
            <button
              onClick={() => setChartType("area")}
              className={`p-2 transition-all ${
                chartType === "area"
                  ? "bg-cyber-cyan/10 text-cyber-cyan"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Activity className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setChartType("bar")}
              className={`p-2 transition-all ${
                chartType === "bar"
                  ? "bg-cyber-cyan/10 text-cyber-cyan"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <BarChart2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Chart */}
      <div className="h-56">
        {loading ? (
          <div className="flex h-full items-center justify-center">
            <div className="h-4 w-4 border-2 border-cyber-cyan border-t-transparent rounded-full animate-spin" />
          </div>
        ) : error ? (
          <div className="flex h-full items-center justify-center text-cyber-red text-xs">
            Failed to load data
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            {chartType === "area" ? (
              <AreaChart data={data?.area_data || []} margin={{ top: 5, right: 5, left: -20, bottom: 5 }}>
              <defs>
                {[
                  { id: "critical", color: "#ff3366" },
                  { id: "high", color: "#ff6b35" },
                  { id: "medium", color: "#ffd700" },
                  { id: "low", color: "#00ff88" },
                ].map(({ id, color }) => (
                  <linearGradient
                    key={id}
                    id={`gradient-${id}`}
                    x1="0"
                    y1="0"
                    x2="0"
                    y2="1"
                  >
                    <stop offset="5%" stopColor={color} stopOpacity={0.3} />
                    <stop offset="95%" stopColor={color} stopOpacity={0} />
                  </linearGradient>
                ))}
              </defs>
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="rgba(255,255,255,0.04)"
                vertical={false}
              />
              <XAxis
                dataKey="date"
                tick={{ fontSize: 11, fill: "#64748b" }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tick={{ fontSize: 11, fill: "#64748b" }}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip content={<CustomTooltip />} />
              {[
                { key: "critical", color: "#ff3366" },
                { key: "high", color: "#ff6b35" },
                { key: "medium", color: "#ffd700" },
                { key: "low", color: "#00ff88" },
              ].map(({ key, color }) => (
                <Area
                  key={key}
                  type="monotone"
                  dataKey={key}
                  stroke={color}
                  strokeWidth={1.5}
                  fill={`url(#gradient-${key})`}
                />
              ))}
            </AreaChart>
          ) : (
            <BarChart data={data?.bar_data || []} margin={{ top: 5, right: 5, left: -20, bottom: 5 }}>
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="rgba(255,255,255,0.04)"
                vertical={false}
              />
              <XAxis
                dataKey="type"
                tick={{ fontSize: 11, fill: "#64748b" }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tick={{ fontSize: 11, fill: "#64748b" }}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip content={<CustomTooltip />} />
              <Legend
                wrapperStyle={{ fontSize: "11px", color: "#64748b", paddingTop: "12px" }}
              />
              <Bar dataKey="findings" fill="rgba(0, 245, 255, 0.6)" radius={[4, 4, 0, 0]} />
              <Bar dataKey="resolved" fill="rgba(0, 255, 136, 0.6)" radius={[4, 4, 0, 0]} />
            </BarChart>
          )}
        </ResponsiveContainer>
        )}
      </div>
    </motion.div>
  );
}