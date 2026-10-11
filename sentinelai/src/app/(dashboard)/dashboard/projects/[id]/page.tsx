// src/app/(dashboard)/dashboard/projects/[id]/page.tsx
"use client";

import { use } from "react";
import { motion } from "framer-motion";
import {
  FolderOpen,
  ArrowLeft,
  GitBranch,
  Activity,
  AlertTriangle,
  CheckCircle,
  Clock,
  Play,
  ExternalLink,
  Shield,
  TrendingDown,
  Code,
  Trash2,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { getSeverityBadgeClass, formatRelativeTime } from "@/lib/utils";
import { toast } from "sonner";

import { useState, useEffect, useRef } from "react";
import axios from "axios";

export default function ProjectDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const [project, setProject] = useState<any>(null);
  const [findings, setFindings] = useState<any[]>([]);
  const [scans, setScans] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isScanning, setIsScanning] = useState(false);
  const requestInFlight = useRef(false);
  const projectLoadAttempts = useRef(0);

  useEffect(() => {
    let isMounted = true;
    const fetchProjectDetails = async (showLoading = false) => {
      if (requestInFlight.current) return;
      requestInFlight.current = true;
      projectLoadAttempts.current += 1;
      let retryingProject = false;
      try {
        if (showLoading) setLoading(true);
        const [projRes, findRes, scanRes] = await Promise.all([
          axios.get(`/api/projects/${id}`).catch(() => ({ data: null })),
          axios
            .get(`/api/findings?project_id=${id}`)
            .catch(() => ({ data: { findings: [] } })),
          axios.get(`/api/scans?project_id=${id}`).catch(() => ({ data: [] })),
        ]);

        if (!projRes.data && projectLoadAttempts.current < 10 && isMounted) {
          retryingProject = true;
          window.setTimeout(() => fetchProjectDetails(false), 1000);
          return;
        }

        if (isMounted) {
          if (projRes.data) {
            setProject(projRes.data);
            projectLoadAttempts.current = 0;
          }
          const rawFindings =
            findRes.data?.findings ||
            (Array.isArray(findRes.data) ? findRes.data : []);
          setFindings(rawFindings);

          const rawScans = Array.isArray(scanRes.data) ? scanRes.data : [];
          setScans(rawScans);
        }
      } catch (err) {
        console.error("Failed to load project details:", err);
      } finally {
        if (isMounted && !retryingProject) setLoading(false);
        requestInFlight.current = false;
      }
    };

    fetchProjectDetails(true);
    return () => {
      isMounted = false;
    };
  }, [id]);

  const hasActiveScan = scans.some(
    (scan: any) => scan.status === "QUEUED" || scan.status === "RUNNING",
  );

  useEffect(() => {
    const refreshTimer = window.setInterval(async () => {
      try {
        const [projRes, findRes, scanRes] = await Promise.all([
          axios.get(`/api/projects/${id}`).catch(() => null),
          axios.get(`/api/findings?project_id=${id}`).catch(() => null),
          axios.get(`/api/scans?project_id=${id}`).catch(() => null),
        ]);

        if (projRes?.data) setProject(projRes.data);
        if (findRes?.data) {
          const rawFindings =
            findRes.data?.findings ||
            (Array.isArray(findRes.data) ? findRes.data : []);
          setFindings(rawFindings);
        }
        if (scanRes?.data && Array.isArray(scanRes.data)) {
          setScans(scanRes.data);
        }
      } catch {
        // ignore polling errors
      }
    }, 5000);

    return () => window.clearInterval(refreshTimer);
  }, [id, hasActiveScan]);

  const handleRunScan = async () => {
    if (!project) return;
    setIsScanning(true);
    try {
      await axios.post("/api/scans", {
        project_id: id,
        target_repo: project.repo_url || undefined,
        branch: project.branch || "main",
        scan_types: ["SAST", "SCA", "SECRETS"],
      });
      // Refetch
      const [findRes, scanRes] = await Promise.all([
        axios
          .get(`/api/findings?project_id=${id}`)
          .catch(() => ({ data: { findings: [] } })),
        axios.get(`/api/scans?project_id=${id}`).catch(() => ({ data: [] })),
      ]);
      setFindings(findRes.data?.findings || []);
      setScans(Array.isArray(scanRes.data) ? scanRes.data : []);
    } catch (err: any) {
      console.error("Scan trigger failed:", err);
      toast.error("Scan could not be started", {
        description:
          err.response?.data?.detail?.message ||
          err.response?.data?.detail ||
          err.response?.data?.error ||
          "The scan service rejected the request.",
      });
    } finally {
      setIsScanning(false);
    }
  };

  const PROJECT = {
    id: project?.id || id,
    name: project?.name || "Connected Repository",
    repo_url: project?.repo_url || "",
    created_at: project?.created_at || new Date().toISOString(),
    last_scan: project?.last_scan_at
      ? formatRelativeTime(project.last_scan_at)
      : "Just now",
    risk_score: project?.risk_score ?? 0,
    language: project?.language || "Unknown",
    branches: 1,
    total_findings: findings.length,
    critical: findings.filter((f: any) => f.severity === "CRITICAL").length,
    high: findings.filter((f: any) => f.severity === "HIGH").length,
    medium: findings.filter((f: any) => f.severity === "MEDIUM").length,
    low: findings.filter((f: any) => f.severity === "LOW").length,
  };

  const scanTrend = scans
    .filter((scan) => scan.created_at || scan.started_at)
    .slice()
    .sort(
      (a, b) =>
        new Date(a.created_at || a.started_at).getTime() -
        new Date(b.created_at || b.started_at).getTime(),
    )
    .slice(-6)
    .map((scan) => ({
      date: new Date(scan.created_at || scan.started_at).toLocaleDateString(
        undefined,
        { month: "short", day: "numeric" },
      ),
      critical: scan.critical_count || 0,
      high: scan.high_count || 0,
      medium: scan.medium_count || 0,
    }));

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="glass-card rounded-lg p-3 border border-white/10 text-xs">
          <p className="font-semibold text-foreground mb-1">{label}</p>
          {payload.map((e: any) => (
            <div key={e.name} className="flex items-center gap-2">
              <div
                className="w-2 h-2 rounded-full"
                style={{ background: e.color }}
              />
              <span className="text-muted-foreground capitalize">
                {e.name}:{" "}
              </span>
              <span className="font-mono font-bold text-foreground">
                {e.value}
              </span>
            </div>
          ))}
        </div>
      );
    }
    return null;
  };

  const router = useRouter();
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDeleteProject = async () => {
    if (
      !confirm(
        `Are you sure you want to completely delete "${PROJECT.name}"? This action cannot be undone.`,
      )
    ) {
      return;
    }
    setIsDeleting(true);
    try {
      await axios.delete(`/api/projects/${id}`);
      toast.success(`Project "${PROJECT.name}" completely deleted`);
      router.push("/dashboard/projects");
    } catch (err: any) {
      console.error("Failed to delete project:", err);
      toast.error(
        err.response?.data?.error ||
          err.response?.data?.detail ||
          "Failed to delete project",
      );
      setIsDeleting(false);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link
            href="/dashboard/projects"
            className="p-2 rounded-lg bg-white/5 border border-white/10 text-muted-foreground hover:text-foreground transition-all"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-foreground tracking-tight flex items-center gap-2">
              <FolderOpen className="w-6 h-6 text-cyber-cyan" />
              {PROJECT.name}
            </h1>
            {PROJECT.repo_url && (
              <a
                href={PROJECT.repo_url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-muted-foreground hover:text-cyber-cyan flex items-center gap-1 mt-0.5 transition-colors"
              >
                {PROJECT.repo_url}
                <ExternalLink className="w-3 h-3" />
              </a>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleDeleteProject}
            disabled={isDeleting}
            className="flex items-center gap-2 px-3.5 py-2 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm hover:bg-red-500/20 transition-all disabled:opacity-50"
            title="Delete project completely"
          >
            <Trash2 className="w-4 h-4" />
            {isDeleting ? "Deleting..." : "Delete Project"}
          </button>
          <button
            onClick={handleRunScan}
            disabled={isScanning}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-cyber-cyan/10 border border-cyber-cyan/20 text-cyber-cyan text-sm hover:bg-cyber-cyan/20 transition-all disabled:opacity-50"
          >
            <Play className="w-4 h-4" />
            {isScanning ? "Scanning..." : "Run Full Scan"}
          </button>
        </div>
      </div>

      {/* Risk Score + Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-6 gap-4">
        {/* Risk Score Card */}
        <div className="col-span-2 glass-card rounded-xl border border-white/5 p-5 flex items-center gap-5">
          <div className="relative w-20 h-20 flex-shrink-0">
            <svg className="w-full h-full -rotate-90" viewBox="0 0 36 36">
              <circle
                cx="18"
                cy="18"
                r="16"
                fill="none"
                stroke="rgba(255,255,255,0.05)"
                strokeWidth="3"
              />
              <motion.circle
                cx="18"
                cy="18"
                r="16"
                fill="none"
                stroke={
                  PROJECT.risk_score > 70
                    ? "#ff3366"
                    : PROJECT.risk_score > 40
                      ? "#ffd700"
                      : "#00ff88"
                }
                strokeWidth="3"
                strokeLinecap="round"
                initial={{ strokeDasharray: "0 100" }}
                animate={{
                  strokeDasharray: `${PROJECT.risk_score} ${100 - PROJECT.risk_score}`,
                }}
                transition={{ duration: 1, delay: 0.3 }}
                strokeDashoffset="25"
              />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
              <span
                className="text-xl font-extrabold font-mono"
                style={{
                  color:
                    PROJECT.risk_score > 70
                      ? "#ff3366"
                      : PROJECT.risk_score > 40
                        ? "#ffd700"
                        : "#00ff88",
                }}
              >
                {PROJECT.risk_score}
              </span>
            </div>
          </div>
          <div>
            <p className="text-sm font-bold text-foreground">Risk Score</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {PROJECT.risk_score > 70
                ? "High Risk"
                : PROJECT.risk_score > 40
                  ? "Medium Risk"
                  : "Low Risk"}
            </p>
            <div className="flex items-center gap-1.5 mt-2 text-emerald-400 text-xs">
              <TrendingDown className="w-3.5 h-3.5" />
              <span>Calculated from scan findings</span>
            </div>
          </div>
        </div>

        {/* Severity Breakdown */}
        {[
          { label: "Critical", value: PROJECT.critical, color: "#ff3366" },
          { label: "High", value: PROJECT.high, color: "#ff6b35" },
          { label: "Medium", value: PROJECT.medium, color: "#ffd700" },
          { label: "Low", value: PROJECT.low, color: "#00ff88" },
        ].map((stat, i) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
            className="glass-card rounded-xl border border-white/5 p-4 text-center"
          >
            <p
              className="text-2xl font-bold font-mono"
              style={{ color: stat.color }}
            >
              {stat.value}
            </p>
            <p className="text-xs text-muted-foreground mt-1">{stat.label}</p>
          </motion.div>
        ))}
      </div>

      {/* Project Info Bar */}
      <div className="glass-card rounded-xl border border-white/5 p-4 flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
        {[
          { icon: Code, label: PROJECT.language },
          { icon: GitBranch, label: `${PROJECT.branches} branch` },
          { icon: Activity, label: `Last scan: ${PROJECT.last_scan}` },
          { icon: Shield, label: "SOC2 · ISO27001 tracking" },
        ].map(({ icon: Icon, label }) => (
          <div key={label} className="flex items-center gap-1.5">
            <Icon className="w-3.5 h-3.5" />
            <span>{label}</span>
          </div>
        ))}
      </div>

      {/* Trend Chart + Recent Scans */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Trend Chart */}
        <div className="lg:col-span-2 glass-card rounded-xl border border-white/5 p-6">
          <h3 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
            <Activity className="w-4 h-4 text-cyber-cyan" />
            Finding Trend (6 Weeks)
          </h3>
          <div style={{ height: 220 }}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart
                data={scanTrend}
                margin={{ top: 5, right: 5, left: -20, bottom: 5 }}
              >
                <defs>
                  {[
                    ["critical", "#ff3366"],
                    ["high", "#ff6b35"],
                    ["medium", "#ffd700"],
                  ].map(([key, color]) => (
                    <linearGradient
                      key={key}
                      id={`grad-${key}`}
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
                  ["critical", "#ff3366"],
                  ["high", "#ff6b35"],
                  ["medium", "#ffd700"],
                ].map(([key, color]) => (
                  <Area
                    key={key}
                    type="monotone"
                    dataKey={key}
                    stroke={color}
                    strokeWidth={1.5}
                    fill={`url(#grad-${key})`}
                  />
                ))}
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Recent Scans */}
        <div className="glass-card rounded-xl border border-white/5 p-5">
          <h3 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
            <Clock className="w-4 h-4 text-cyber-cyan" />
            Recent Scans
          </h3>
          <div className="space-y-3">
            {scans.length === 0 ? (
              <div className="p-4 text-center text-xs text-muted-foreground">
                No scans run yet.
              </div>
            ) : (
              scans.map((scan: any, i: number) => (
                <motion.div
                  key={scan.scan_id || scan.id || i}
                  initial={{ opacity: 0, x: 10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.07 }}
                  className="p-3 rounded-lg bg-white/3 border border-white/5 hover:border-white/10 transition-all cursor-pointer group"
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs font-mono text-muted-foreground">
                      {scan.branch || "main"}
                    </span>
                    <div className="flex items-center gap-1">
                      {scan.status === "RUNNING" ? (
                        <Activity className="w-3.5 h-3.5 text-cyber-cyan animate-pulse" />
                      ) : (
                        <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />
                      )}
                      <span className="text-xs text-muted-foreground">
                        {scan.completed_at
                          ? formatRelativeTime(scan.completed_at)
                          : scan.status}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex gap-1">
                      {(scan.scan_types || scan.types || []).map(
                        (type: string) => (
                          <span
                            key={type}
                            className="text-xs px-1 py-0.5 rounded bg-white/5 text-muted-foreground font-mono"
                          >
                            {type}
                          </span>
                        ),
                      )}
                    </div>
                    {scan.finding_count > 0 && (
                      <span className="text-xs text-red-400 font-bold">
                        {scan.finding_count} findings
                      </span>
                    )}
                  </div>
                </motion.div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Recent Findings */}
      <div className="glass-card rounded-xl border border-white/5 overflow-hidden">
        <div className="flex items-center justify-between p-5 border-b border-white/5">
          <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-cyber-red" />
            Open Findings
          </h3>
          <Link
            href="/dashboard/vulnerabilities"
            className="text-xs text-cyber-cyan hover:underline flex items-center gap-1"
          >
            View all <ExternalLink className="w-3 h-3" />
          </Link>
        </div>
        <div className="divide-y divide-white/5">
          {findings.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground text-xs">
              No security findings detected in this repository.
            </div>
          ) : (
            findings.map((finding: any, i: number) => (
              <motion.div
                key={finding.id || i}
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                className="flex items-center gap-4 px-5 py-3.5 hover:bg-white/3 transition-colors cursor-pointer group"
              >
                <span
                  className={getSeverityBadgeClass(finding.severity || "HIGH")}
                >
                  {finding.severity || "HIGH"}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-foreground font-medium">
                    {finding.title}
                  </p>
                  <p className="text-xs text-muted-foreground font-mono mt-0.5">
                    {finding.file_path || finding.file || (finding.metadata as any)?.url || (finding.metadata as any)?.endpoint || (finding.metadata as any)?.target || "Target Application"}
                    {finding.line_number ? `:${finding.line_number}` : ""}
                  </p>
                </div>
                {finding.verified_by_consensus && (
                  <CheckCircle className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
                )}
                <span className="text-xs text-muted-foreground flex-shrink-0">
                  {finding.created_at
                    ? formatRelativeTime(finding.created_at)
                    : "Just now"}
                </span>
              </motion.div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
