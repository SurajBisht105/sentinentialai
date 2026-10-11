// src/app/(dashboard)/dashboard/page.tsx
import { Suspense } from "react";
import { MetricsGrid } from "@/components/features/dashboard/MetricsGrid";
import { ActiveScansPanel } from "@/components/features/dashboard/ActiveScansPanel";
import { RiskOverviewChart } from "@/components/features/dashboard/RiskOverviewChart";
import { AgentActivityFeed } from "@/components/features/dashboard/AgentActivityFeed";
import { RecentFindings } from "@/components/features/dashboard/RecentFindings";
import { ComplianceSnapshot } from "@/components/features/dashboard/ComplianceSnapshot";
import { ThreatTicker } from "@/components/features/dashboard/ThreatTicker";
import { Skeleton } from "@/components/ui/Skeleton";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Dashboard",
};

export default function DashboardPage() {
  return (
    <div className="space-y-6 animate-fade-in">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground tracking-tight">
            Security Command Center
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Real-time multi-agent security posture across all environments
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground bg-white/5 border border-white/10 rounded-lg px-3 py-2">
          <div className="w-1.5 h-1.5 rounded-full bg-cyber-emerald animate-pulse" />
          <span className="font-mono">47 agents active</span>
          <span className="text-white/20">|</span>
          <span className="font-mono">Last sync: just now</span>
        </div>
      </div>

      {/* Threat Ticker */}
      <Suspense fallback={<Skeleton className="h-10 w-full rounded-lg" />}>
        <ThreatTicker />
      </Suspense>

      {/* Metrics Grid */}
      <Suspense
        fallback={
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[...Array(8)].map((_, i) => (
              <Skeleton key={i} className="h-28 rounded-xl" />
            ))}
          </div>
        }
      >
        <MetricsGrid />
      </Suspense>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Risk Chart - spans 2 cols */}
        <div className="lg:col-span-2">
          <Suspense fallback={<Skeleton className="h-72 rounded-xl" />}>
            <RiskOverviewChart />
          </Suspense>
        </div>

        {/* Compliance Snapshot */}
        <div>
          <Suspense fallback={<Skeleton className="h-72 rounded-xl" />}>
            <ComplianceSnapshot />
          </Suspense>
        </div>
      </div>

      {/* Bottom Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Findings - spans 2 cols */}
        <div className="lg:col-span-2">
          <Suspense fallback={<Skeleton className="h-96 rounded-xl" />}>
            <RecentFindings />
          </Suspense>
        </div>

        {/* Right Column */}
        <div className="space-y-6">
          <Suspense fallback={<Skeleton className="h-44 rounded-xl" />}>
            <ActiveScansPanel />
          </Suspense>
          <Suspense fallback={<Skeleton className="h-44 rounded-xl" />}>
            <AgentActivityFeed />
          </Suspense>
        </div>
      </div>
    </div>
  );
}