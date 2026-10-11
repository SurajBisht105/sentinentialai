// src/app/(dashboard)/dashboard/projects/page.tsx
"use client";

import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useRouter } from "next/navigation";
import {
  FolderOpen,
  Plus,
  Search,
  GitBranch,
  Clock,
  AlertTriangle,
  Shield,
  CheckCircle,
  MoreHorizontal,
  ExternalLink,
  Play,
  Trash2,
  Settings,
  TrendingUp,
  TrendingDown,
  X,
  Globe,
} from "lucide-react";
import { toast } from "sonner";
import {
  getSeverityColor,
  formatRelativeTime,
  calculateRiskScore,
} from "@/lib/utils";
import { Project } from "@/types";
import axios from "axios";
import { useAppStore } from "@/store";
import { createClient } from "@/lib/supabase/client";

async function getAuthConfig() {
  const {
    data: { session },
  } = await createClient().auth.getSession();
  return session
    ? { headers: { Authorization: `Bearer ${session.access_token}` } }
    : undefined;
}

const LANG_COLORS: Record<string, string> = {
  JavaScript: "#f1e05a",
  TypeScript: "#2b7489",
  Python: "#3572A5",
  Java: "#b07219",
  Ruby: "#701516",
  PHP: "#4F5D95",
  CSharp: "#178600",
  C: "#555555",
  "C++": "#f34b7d",
  Go: "#00ADD8",
  Rust: "#dea584",
};

function AddProjectModal({
  onClose,
  onSuccess,
}: {
  onClose: () => void;
  onSuccess?: (newProject: Project) => void;
}) {
  const [step, setStep] = useState(1);
  const [repoUrl, setRepoUrl] = useState("");
  const [projectName, setProjectName] = useState("");
  const [selectedBranch, setSelectedBranch] = useState("main");
  const [scanTypes, setScanTypes] = useState<string[]>([
    "SAST",
    "SCA",
    "SECRETS",
  ]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const ALL_SCAN_TYPES = [
    "SAST",
    "SCA",
    "SECRETS",
    "DAST",
    "IaC",
    "AI Security",
  ];

  const toggleScanType = (type: string) => {
    setScanTypes((prev) =>
      prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type],
    );
  };

  const handleNextStep = () => {
    if (step === 1) {
      if (!repoUrl.trim() || !projectName.trim()) {
        setSubmitError("Repository URL and Project Name are required");
        return;
      }
    }
    setSubmitError(null);
    setStep((prev) => Math.min(prev + 1, 3));
  };

  const handleSubmit = async () => {
    if (!repoUrl.trim() || !projectName.trim()) {
      setSubmitError("Repository URL and Project Name are required");
      return;
    }

    setIsSubmitting(true);
    setSubmitError(null);

    try {
      const response = await axios.post(
        `/api/projects`,
        {
          repo_url: repoUrl.trim(),
          name: projectName.trim(),
          branch: selectedBranch,
          scan_types: scanTypes,
        },
        await getAuthConfig(),
      );

      if (onSuccess) {
        onSuccess(response.data);
      }
      onClose();
    } catch (err: any) {
      console.error("Failed to create project:", err);
      setSubmitError(
        err.response?.data?.error ||
          err.message ||
          "Failed to connect repository",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4"
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.95, opacity: 0 }}
        className="w-full max-w-lg glass-card rounded-2xl border border-white/10 overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-white/5">
          <div>
            <h2 className="text-base font-bold text-foreground">
              Connect Repository
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Step {step} of 3
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-white/5 text-muted-foreground hover:text-foreground transition-all"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Progress */}
        <div className="flex h-1 bg-white/5">
          {[1, 2, 3].map((s) => (
            <div
              key={s}
              className="flex-1 transition-all duration-500"
              style={{
                background: s <= step ? "#00f5ff" : "transparent",
                opacity: s === step ? 1 : 0.4,
              }}
            />
          ))}
        </div>

        <div className="p-6">
          {submitError && (
            <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-xs text-red-400">
              {submitError}
            </div>
          )}

          <AnimatePresence mode="wait">
            {step === 1 && (
              <motion.div
                key="step1"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-4"
              >
                <div>
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block mb-2">
                    Repository URL
                  </label>
                  <div className="relative">
                    <Globe className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <input
                      type="url"
                      value={repoUrl}
                      onChange={(e) => {
                        setRepoUrl(e.target.value);
                        setSubmitError(null);
                      }}
                      placeholder="https://github.com/org/repo"
                      className="w-full bg-white/5 border border-white/10 rounded-lg pl-9 pr-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-cyber-cyan/40 transition-all"
                    />
                  </div>
                </div>
                <div>
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block mb-2">
                    Project Name
                  </label>
                  <input
                    type="text"
                    value={projectName}
                    onChange={(e) => {
                      setProjectName(e.target.value);
                      setSubmitError(null);
                    }}
                    placeholder="my-service"
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-cyber-cyan/40 transition-all"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block mb-2">
                    Default Branch
                  </label>
                  <select
                    value={selectedBranch}
                    onChange={(e) => setSelectedBranch(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 text-sm text-foreground focus:outline-none focus:border-cyber-cyan/40 transition-all"
                  >
                    {["main", "master", "develop", "staging"].map((b) => (
                      <option key={b} value={b} className="bg-sentinel-800">
                        {b}
                      </option>
                    ))}
                  </select>
                </div>
              </motion.div>
            )}

            {step === 2 && (
              <motion.div
                key="step2"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-4"
              >
                <div>
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block mb-3">
                    Select Scan Types
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    {ALL_SCAN_TYPES.map((type) => {
                      const active = scanTypes.includes(type);
                      return (
                        <button
                          key={type}
                          onClick={() => toggleScanType(type)}
                          className={`flex items-center gap-2 p-3 rounded-lg border text-left transition-all ${active ? "border-cyber-cyan/40 bg-cyber-cyan/5 text-cyber-cyan" : "border-white/10 bg-white/3 text-muted-foreground hover:border-white/20"}`}
                        >
                          <div
                            className={`w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 ${active ? "bg-cyber-cyan border-cyber-cyan" : "border-white/20"}`}
                          >
                            {active && (
                              <CheckCircle className="w-3 h-3 text-sentinel-900" />
                            )}
                          </div>
                          <span className="text-xs font-semibold">{type}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </motion.div>
            )}

            {step === 3 && (
              <motion.div
                key="step3"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-4"
              >
                <div className="text-center py-4">
                  <div className="w-16 h-16 rounded-2xl bg-cyber-cyan/10 border border-cyber-cyan/20 flex items-center justify-center mx-auto mb-4">
                    <Shield className="w-8 h-8 text-cyber-cyan" />
                  </div>
                  <h3 className="text-base font-bold text-foreground">
                    Ready to Connect
                  </h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    Review your configuration
                  </p>
                </div>
                <div className="space-y-2">
                  {[
                    {
                      label: "Repository",
                      value: repoUrl || "https://github.com/corp/service",
                    },
                    {
                      label: "Project Name",
                      value: projectName || "my-service",
                    },
                    { label: "Branch", value: selectedBranch },
                    { label: "Scan Types", value: scanTypes.join(", ") },
                  ].map(({ label, value }) => (
                    <div
                      key={label}
                      className="flex justify-between items-center p-3 rounded-lg bg-white/3 border border-white/5"
                    >
                      <span className="text-xs text-muted-foreground">
                        {label}
                      </span>
                      <span className="text-xs text-foreground font-medium text-right max-w-xs truncate">
                        {value}
                      </span>
                    </div>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <div className="flex items-center justify-between p-6 pt-0">
          <button
            onClick={() => (step > 1 ? setStep(step - 1) : onClose())}
            className="px-4 py-2 rounded-lg bg-white/5 border border-white/10 text-sm text-muted-foreground hover:text-foreground hover:border-white/20 transition-all"
          >
            {step === 1 ? "Cancel" : "Back"}
          </button>
          <button
            onClick={step < 3 ? handleNextStep : handleSubmit}
            className="btn-cyber rounded-lg px-6 py-2 text-sm font-semibold"
            disabled={isSubmitting}
          >
            {step === 3
              ? isSubmitting
                ? "Connecting..."
                : "Connect Repository"
              : "Next"}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

export default function ProjectsPage() {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [showAddModal, setShowAddModal] = useState(false);
  const [menuOpen, setMenuOpen] = useState<string | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const menuButtonRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const menuRefs = useRef<Record<string, HTMLDivElement | null>>({});

  // Fetch projects from API
  useEffect(() => {
    const fetchProjects = async () => {
      try {
        setLoading(true);
        setError(null);
        const response = await axios.get(
          `/api/projects`,
          await getAuthConfig(),
        );
        // Ensure we always set an array
        setProjects(Array.isArray(response.data) ? response.data : []);
      } catch (err: any) {
        console.error("Failed to fetch projects:", err);
        setError(
          err.response?.data?.error || err.message || "Failed to load projects",
        );
        setProjects([]);
      } finally {
        setLoading(false);
      }
    };

    fetchProjects();
  }, []);

  // Close the menu only for real outside clicks.
  useEffect(() => {
    const handleDocumentClick = (event: MouseEvent) => {
      if (!menuOpen) return;

      const target = event.target as Node;
      const trigger = menuButtonRefs.current[menuOpen];
      const menu = menuRefs.current[menuOpen];

      if (
        (trigger && trigger.contains(target)) ||
        (menu && menu.contains(target))
      ) {
        return;
      }

      setMenuOpen(null);
    };

    document.addEventListener("click", handleDocumentClick);
    return () => document.removeEventListener("click", handleDocumentClick);
  }, [menuOpen]);

  // Refetch function
  const refetchProjects = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await axios.get(`/api/projects`, await getAuthConfig());
      // Ensure we always set an array
      setProjects(Array.isArray(response.data) ? response.data : []);
    } catch (err: any) {
      console.error("Failed to refetch projects:", err);
      setError(
        err.response?.data?.error || err.message || "Failed to load projects",
      );
    } finally {
      setLoading(false);
    }
  };

  const handleTriggerScan = async (project: Project) => {
    toast.loading(`Starting multi-agent scan on ${project.name}...`, {
      id: `scan-${project.id}`,
    });
    try {
      await axios.post("/api/scans", {
        project_id: project.id,
        target_repo: project.repo_url || undefined,
        branch: project.branch || "main",
        scan_types: ["SAST", "SCA", "SECRETS"],
      });
      toast.success(`Scan initiated for ${project.name}`, {
        id: `scan-${project.id}`,
        description: "Agents are analyzing the repository...",
      });
      refetchProjects();
    } catch (err: any) {
      console.error("Scan trigger failed:", err);
      toast.error(`Could not start scan for ${project.name}`, {
        id: `scan-${project.id}`,
        description:
          err.response?.data?.detail?.message ||
          err.response?.data?.detail ||
          err.response?.data?.error ||
          "Scan request failed",
      });
    }
  };

  const handleOpenRepo = (repoUrl: string) => {
    if (!repoUrl) {
      toast.error("No repository URL configured for this project");
      return;
    }
    let url = repoUrl.trim();
    if (url.startsWith("git@")) {
      url = "https://" + url.slice(4).replace(":", "/").replace(/\.git$/, "");
    } else if (!url.startsWith("http://") && !url.startsWith("https://")) {
      if (url.includes("github.com") || url.includes("gitlab.com") || url.includes("bitbucket.org")) {
        url = `https://${url}`;
      } else {
        toast.info(`Local repository directory: ${repoUrl}`);
        return;
      }
    }
    window.open(url, "_blank", "noopener,noreferrer");
  };

  const handleDeleteProject = async (project: Project) => {
    toast.loading(`Removing project "${project.name}"...`, {
      id: `del-${project.id}`,
    });
    try {
      const config = await getAuthConfig();
      await axios.delete(`/api/projects/${project.id}`, config);
      setProjects((prev) => prev.filter((p) => p.id !== project.id));
      toast.success(`Project "${project.name}" removed successfully`, {
        id: `del-${project.id}`,
      });
    } catch (err: any) {
      console.error("Failed to remove project:", err);
      toast.error(
        err.response?.data?.error ||
        err.response?.data?.detail ||
        "Failed to remove project",
        { id: `del-${project.id}` }
      );
    }
  };

  const filtered = projects.filter(
    (p) =>
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      (p.language && p.language.toLowerCase().includes(search.toLowerCase())),
  );

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground tracking-tight">
            Projects
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {projects.length} repositories connected
          </p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="btn-cyber rounded-xl px-4 py-2.5 text-sm font-semibold flex items-center gap-2"
        >
          <Plus className="w-4 h-4" /> Connect Repository
        </button>
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search projects..."
          className="w-full bg-white/5 border border-white/10 rounded-lg pl-9 pr-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-cyber-cyan/40 transition-all"
        />
      </div>

      {/* Projects Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {filtered.map((project, i) => {
          const riskScore = project.risk_score ?? 0;
          const riskColor =
            riskScore >= 75
              ? "#ff3366"
              : riskScore >= 50
                ? "#ff6b35"
                : riskScore >= 25
                  ? "#ffd700"
                  : "#00ff88";
          const langColor = project.language
            ? LANG_COLORS[project.language]
            : "#64748b";

          return (
            <motion.div
              key={project.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.07 }}
              whileHover={{ y: -4, transition: { duration: 0.2 } }}
              className="group glass-card rounded-xl border border-white/5 cursor-pointer hover:border-white/10 transition-all duration-300"
              style={{ boxShadow: "0 0 0 0 transparent", overflow: "visible" }}
              onMouseEnter={(e) =>
                (e.currentTarget.style.boxShadow = `0 20px 40px rgba(0,0,0,0.4)`)
              }
              onMouseLeave={(e) =>
                (e.currentTarget.style.boxShadow = "0 0 0 0 transparent")
              }
              onClick={() => router.push(`/dashboard/projects/${project.id}`)}
            >
              {/* Top accent */}
              <div
                className="h-0.5"
                style={{
                  background: `linear-gradient(90deg, ${riskColor}60, transparent)`,
                }}
              />

              <div className="p-5">
                {/* Header */}
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <div className="w-8 h-8 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center flex-shrink-0">
                        <FolderOpen
                          className="h-4 w-4"
                          style={{
                            color: project.language
                              ? LANG_COLORS[project.language]
                              : "#64748b",
                          }}
                        />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-bold text-foreground truncate">
                          {project.name}
                        </p>
                        <div className="flex items-center gap-1.5">
                          {project.branch ? (
                            <>
                              <GitBranch className="w-3 h-3 text-muted-foreground" />
                              <span className="text-xs text-muted-foreground font-mono">
                                {project.branch}
                              </span>
                            </>
                          ) : null}
                          {project.language ? (
                            <span
                              className="text-xs px-1.5 py-0.5 rounded font-mono font-semibold"
                              style={{
                                color: langColor,
                                background: `${langColor}15`,
                                border: `1px solid ${langColor}30`,
                              }}
                            >
                              {project.language}
                            </span>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="relative flex-shrink-0">
                    <button
                      ref={(node) => {
                        menuButtonRefs.current[project.id] = node;
                      }}
                      onClick={(e) => {
                        e.stopPropagation();
                        setMenuOpen(
                          menuOpen === project.id ? null : project.id,
                        );
                      }}
                      className="p-1.5 rounded-lg hover:bg-white/5 text-muted-foreground hover:text-foreground transition-all opacity-0 group-hover:opacity-100"
                    >
                      <MoreHorizontal className="w-4 h-4" />
                    </button>
                    <AnimatePresence>
                      {menuOpen === project.id && (
                        <motion.div
                          ref={(node) => {
                            if (node) {
                              menuRefs.current[project.id] = node;
                            } else {
                              delete menuRefs.current[project.id];
                            }
                          }}
                          initial={{ opacity: 0, scale: 0.95, y: -5 }}
                          animate={{ opacity: 1, scale: 1, y: 0 }}
                          exit={{ opacity: 0, scale: 0.95 }}
                          onClick={(e) => e.stopPropagation()}
                          className="absolute right-0 top-full mt-1 w-44 glass-card rounded-xl border border-white/10 shadow-2xl z-30 overflow-hidden"
                        >
                          {[
                            {
                              icon: Play,
                              label: "Trigger Scan",
                              action: () => handleTriggerScan(project),
                            },
                            {
                              icon: ExternalLink,
                              label: "Open Repo",
                              action: () => handleOpenRepo(project.repo_url),
                            },
                            {
                              icon: Settings,
                              label: "Settings",
                              action: () => router.push(`/dashboard/projects/${project.id}`),
                            },
                            {
                              icon: Trash2,
                              label: "Remove",
                              action: () => handleDeleteProject(project),
                              danger: true,
                            },
                          ].map(({ icon: Icon, label, action, danger }) => (
                            <button
                              key={label}
                              type="button"
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                setMenuOpen(null);
                                action();
                              }}
                              className={`w-full flex items-center gap-2 px-3 py-2.5 text-xs transition-all text-left cursor-pointer ${danger ? "text-red-400 hover:bg-red-500/10" : "text-muted-foreground hover:text-foreground hover:bg-white/5"}`}
                            >
                              <Icon className="w-3.5 h-3.5" />
                              {label}
                            </button>
                          ))}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </div>

                {/* Risk Score */}
                <div className="mb-4">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs text-muted-foreground font-semibold">
                      Risk Score
                    </span>
                    <div className="flex items-center gap-1.5">
                      {project.trend === "down" ? (
                        <TrendingDown className="w-3 h-3 text-emerald-400" />
                      ) : project.trend === "up" ? (
                        <TrendingUp className="w-3 h-3 text-red-400" />
                      ) : null}
                      <span
                        className="text-sm font-bold font-mono"
                        style={{ color: riskColor }}
                      >
                        {riskScore}
                      </span>
                    </div>
                  </div>
                  <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${riskScore}%` }}
                      transition={{
                        delay: i * 0.07 + 0.3,
                        duration: 0.8,
                        ease: "easeOut",
                      }}
                      className="h-full rounded-full"
                      style={{
                        background: `linear-gradient(90deg, ${riskColor}60, ${riskColor})`,
                        boxShadow: `0 0 8px ${riskColor}40`,
                      }}
                    />
                  </div>
                </div>

                {/* Findings Summary - Total Findings */}
                <div className="mt-4">
                  <div
                    className="text-center p-3 rounded-lg"
                    style={{
                      background: "#ff6b3508",
                      border: "1px solid #ff6b3520",
                    }}
                  >
                    <p
                      className="text-base font-bold font-mono"
                      style={{ color: "#ff6b35" }}
                    >
                      {project.finding_count ?? 0}
                    </p>
                    <p className="text-xs text-muted-foreground">Findings</p>
                  </div>
                </div>

                {/* Footer */}
                <div className="flex items-center justify-between pt-3 border-t border-white/5">
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Clock className="w-3 h-3" />
                    <span>
                      {project.last_scan_at
                        ? formatRelativeTime(project.last_scan_at)
                        : "Never"}
                    </span>
                  </div>
                  <span className="text-xs text-muted-foreground font-mono">
                    {project.scan_count ?? 0} scans
                  </span>
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* Add Project Card */}
      <motion.button
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: filtered.length * 0.07 }}
        onClick={() => setShowAddModal(true)}
        className="group h-full min-h-[280px] rounded-xl border-2 border-dashed border-white/10 hover:border-cyber-cyan/30 flex flex-col items-center justify-center gap-3 transition-all duration-300 hover:bg-cyber-cyan/3"
      >
        <div className="w-12 h-12 rounded-xl bg-white/5 group-hover:bg-cyber-cyan/10 border border-white/10 group-hover:border-cyber-cyan/30 flex items-center justify-center transition-all duration-300">
          <Plus className="w-6 h-6 text-muted-foreground group-hover:text-cyber-cyan transition-colors" />
        </div>
        <div className="text-center">
          <p className="text-sm font-semibold text-muted-foreground group-hover:text-foreground transition-colors">
            Connect Repository
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">
            GitHub, GitLab, Bitbucket
          </p>
        </div>
      </motion.button>

      <AnimatePresence>
        {showAddModal && (
          <AddProjectModal
            onClose={() => setShowAddModal(false)}
            onSuccess={(newProj) => {
              setProjects((prev) => [newProj, ...prev]);
              refetchProjects();
            }}
          />
        )}
      </AnimatePresence>

      {menuOpen && (
        <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(null)} />
      )}
    </div>
  );
}
