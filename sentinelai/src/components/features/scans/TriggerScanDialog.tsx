// src/components/features/scans/TriggerScanDialog.tsx
// Trigger-scan modal supporting both Live Website URLs and Git Repositories
"use client";

import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ScanFormSchema, ScanFormValues } from "@/lib/schemas";
import { Dialog, DialogHeader, DialogBody, DialogFooter } from "@/components/ui/Dialog";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { toast } from "sonner";
import { Play, GitBranch, Globe, FolderGit2, ShieldAlert, Sparkles } from "lucide-react";
import { useState } from "react";

type ScanTargetMode = "WEBSITE" | "REPOSITORY";

const WEB_SCAN_TYPES = [
  { id: "DAST", label: "DAST & Injections", desc: "Runtime injection, XSS reflection & error probing" },
  { id: "SECURITY_HEADERS", label: "Security Headers & CORS", desc: "HSTS, CSP, Clickjacking & Cookie audits" },
  { id: "SENSITIVE_FILES", label: "Exposed Files & Endpoints", desc: "Probe .env, .git, Actuator, Swagger, phpinfo" },
  { id: "SECRETS", label: "Client Scripts & Secrets", desc: "Scan JS bundles for exposed API keys & tokens" },
];

const REPO_SCAN_TYPES = [
  { id: "SAST", label: "SAST (Static Code)", desc: "Deep AST security vulnerability analysis" },
  { id: "SCA", label: "SCA (Dependencies)", desc: "Known CVEs in open source packages" },
  { id: "SECRETS", label: "Secret Leakage", desc: "Hardcoded passwords, tokens & credentials" },
  { id: "IaC", label: "IaC & Cloud Config", desc: "Docker, Kubernetes & Terraform misconfigurations" },
];

interface TriggerScanDialogProps {
  open: boolean;
  onClose: () => void;
  /** Pre-selected project id (e.g., when triggered from a project page) */
  projectId?: string;
  projects?: { id: string; name: string }[];
}

export function TriggerScanDialog({
  open,
  onClose,
  projectId,
  projects = [],
}: TriggerScanDialogProps) {
  const [targetMode, setTargetMode] = useState<ScanTargetMode>("WEBSITE");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    control,
    setValue,
    reset,
    formState: { errors },
  } = useForm<ScanFormValues>({
    resolver: zodResolver(ScanFormSchema),
    defaultValues: {
      project_id: projectId ?? "",
      target_url: "",
      branch: "main",
      scan_types: ["DAST", "SECRETS"],
    },
  });

  const handleModeChange = (mode: ScanTargetMode) => {
    setTargetMode(mode);
    if (mode === "WEBSITE") {
      setValue("scan_types", ["DAST", "SECRETS"]);
    } else {
      setValue("scan_types", ["SAST", "SCA", "SECRETS"]);
    }
  };

  const onSubmit = async (values: ScanFormValues) => {
    if (targetMode === "WEBSITE" && !values.target_url) {
      toast.error("Please enter a website URL to scan");
      return;
    }

    if (targetMode === "REPOSITORY" && !projectId && !values.project_id && !values.target_repo) {
      toast.error("Please select or specify a project repository");
      return;
    }

    setIsSubmitting(true);
    try {
      let targetUrl = values.target_url?.trim() || "";
      if (targetMode === "WEBSITE" && targetUrl) {
        if (!targetUrl.startsWith("http://") && !targetUrl.startsWith("https://")) {
          targetUrl = `https://${targetUrl}`;
        }
      }

      const payload: any = {
        scan_types: values.scan_types,
      };

      if (targetMode === "WEBSITE") {
        payload.target_url = targetUrl;
        payload.target_repo = targetUrl;
      } else {
        payload.project_id = values.project_id || projectId;
        payload.branch = values.branch || "main";
        if (values.target_repo) payload.target_repo = values.target_repo;
      }

      const res = await fetch("/api/scans", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        const errorMessage =
          typeof errData.detail === "string"
            ? errData.detail
            : (errData.detail?.message || errData.error || errData.message || "Failed to trigger scan");
        throw new Error(errorMessage);
      }

      toast.success("Scan launched successfully", {
        description: targetMode === "WEBSITE" 
          ? `Scanning live target: ${targetUrl}` 
          : `Running ${values.scan_types.join(", ")} on branch ${values.branch}`,
      });
      reset();
      onClose();
    } catch (err: any) {
      toast.error("Failed to trigger scan", {
        description: err.message || "Please check the target and try again.",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const currentScanTypes = targetMode === "WEBSITE" ? WEB_SCAN_TYPES : REPO_SCAN_TYPES;

  return (
    <Dialog open={open} onClose={handleClose}>
      <DialogHeader
        title="Launch Security Scan"
        subtitle="Perform live website vulnerability analysis or static repository auditing"
        onClose={handleClose}
      />

      <form onSubmit={handleSubmit(onSubmit)} noValidate>
        <DialogBody className="space-y-5">
          {/* Target Mode Selector */}
          <div className="flex rounded-lg bg-white/5 p-1 border border-white/10">
            <button
              type="button"
              onClick={() => handleModeChange("WEBSITE")}
              className={`flex-1 flex items-center justify-center gap-2 py-2 text-xs font-semibold rounded-md transition-all ${
                targetMode === "WEBSITE"
                  ? "bg-cyber-cyan text-sentinel-950 shadow-md font-bold"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Globe className="w-3.5 h-3.5" />
              Live Website / API
            </button>
            <button
              type="button"
              onClick={() => handleModeChange("REPOSITORY")}
              className={`flex-1 flex items-center justify-center gap-2 py-2 text-xs font-semibold rounded-md transition-all ${
                targetMode === "REPOSITORY"
                  ? "bg-cyber-cyan text-sentinel-950 shadow-md font-bold"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <FolderGit2 className="w-3.5 h-3.5" />
              Git Repository
            </button>
          </div>

          {/* Website URL Target Input */}
          {targetMode === "WEBSITE" && (
            <div className="space-y-1.5">
              <Input
                label="Target Website or API URL"
                placeholder="https://example.com or http://localhost:3000"
                leftIcon={<Globe className="w-3.5 h-3.5" />}
                error={errors.target_url?.message}
                {...register("target_url")}
              />
              <p className="text-[11px] text-muted-foreground flex items-center gap-1 mt-1">
                <Sparkles className="w-3 h-3 text-cyber-cyan" />
                Audits headers, cookies, exposed endpoints, scripts, and runtime injections.
              </p>
            </div>
          )}

          {/* Repository Selection */}
          {targetMode === "REPOSITORY" && (
            <>
              {!projectId && (
                <div className="flex flex-col gap-3">
                  {projects.length > 0 && (
                    <div className="flex flex-col gap-1.5">
                      <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                        Select Existing Project (Optional)
                      </label>
                      <select
                        {...register("project_id")}
                        className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 text-sm text-foreground focus:outline-none focus:border-cyber-cyan/40 transition-all"
                      >
                        <option value="" className="bg-sentinel-800">Or specify a Git URL below…</option>
                        {projects.map((p) => (
                          <option key={p.id} value={p.id} className="bg-sentinel-800">
                            {p.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  <Input
                    label="Git Repository URL"
                    placeholder="https://github.com/owner/repository"
                    leftIcon={<FolderGit2 className="w-3.5 h-3.5" />}
                    error={errors.target_repo?.message}
                    {...register("target_repo")}
                  />
                </div>
              )}

              <Input
                label="Branch"
                placeholder="main"
                leftIcon={<GitBranch className="w-3.5 h-3.5" />}
                error={errors.branch?.message}
                {...register("branch")}
              />
            </>
          )}

          {/* Scan Types / Modules */}
          <div className="flex flex-col gap-2">
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center justify-between">
              <span>Scan Modules & Capabilities</span>
              <span className="text-[10px] text-cyber-cyan font-mono">Agentic AI Enabled</span>
            </label>
            <Controller
              name="scan_types"
              control={control}
              render={({ field }) => (
                <div className="grid grid-cols-2 gap-2">
                  {currentScanTypes.map((mod) => {
                    const active = (field.value || []).includes(mod.id);
                    return (
                      <button
                        key={mod.id}
                        type="button"
                        onClick={() => {
                          const currentVals = field.value || [];
                          field.onChange(
                            active
                              ? currentVals.filter((t: string) => t !== mod.id)
                              : [...currentVals, mod.id]
                          );
                        }}
                        className={`flex items-start gap-2.5 p-3 rounded-lg border text-left transition-all ${
                          active
                            ? "border-cyber-cyan/40 bg-cyber-cyan/5"
                            : "border-white/10 bg-white/3 hover:border-white/20"
                        }`}
                      >
                        <div
                          className={`w-4 h-4 rounded flex items-center justify-center mt-0.5 flex-shrink-0 border transition-all ${
                            active
                              ? "bg-cyber-cyan border-cyber-cyan"
                              : "border-white/20"
                          }`}
                        >
                          {active && (
                            <svg viewBox="0 0 10 10" className="w-2.5 h-2.5">
                              <path d="M1 5l3 3 5-5" stroke="#0a0f1a" strokeWidth={2} fill="none" strokeLinecap="round" />
                            </svg>
                          )}
                        </div>
                        <div>
                          <p className={`text-xs font-bold ${active ? "text-cyber-cyan" : "text-foreground"}`}>
                            {mod.label}
                          </p>
                          <p className="text-[10px] text-muted-foreground mt-0.5 leading-snug">
                            {mod.desc}
                          </p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            />
            {errors.scan_types && (
              <p className="text-xs text-red-400">⚠ {errors.scan_types.message}</p>
            )}
          </div>
        </DialogBody>

        <DialogFooter>
          <Button type="button" variant="ghost" onClick={handleClose}>
            Cancel
          </Button>
          <Button
            type="submit"
            variant="primary"
            loading={isSubmitting}
            leftIcon={<Play className="w-3.5 h-3.5" />}
          >
            {targetMode === "WEBSITE" ? "Scan Website Now" : "Run Repository Scan"}
          </Button>
        </DialogFooter>
      </form>
    </Dialog>
  );
}
