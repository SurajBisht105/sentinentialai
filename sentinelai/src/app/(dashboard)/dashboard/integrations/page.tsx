// src/app/(dashboard)/dashboard/integrations/page.tsx
"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  GitBranch,
  CheckCircle,
  Plus,
  Settings,
  Zap,
  AlertTriangle,
  RefreshCw,
  ExternalLink,
  X,
  Key,
  Globe,
  Lock,
  Server,
  Eye,
  EyeOff,
  Check,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";

type IntegrationItem = {
  id: string;
  name: string;
  description: string;
  logo: string;
  connected?: boolean;
  status?: string;
  repos?: number;
  lastSync?: string | null;
};

type IntegrationField = {
  key: string;
  label: string;
  placeholder: string;
  type?: "text" | "password" | "textarea" | "select";
  options?: string[];
  required?: boolean;
  helpText?: string;
};

const INTEGRATION_FIELDS: Record<string, IntegrationField[]> = {
  github: [
    {
      key: "token",
      label: "Personal Access Token (PAT)",
      placeholder: "ghp_xxxxxxxxxxxxxxxxxxxx",
      type: "password",
      required: true,
      helpText: "Token with repo, read:org, and workflow scopes.",
    },
    {
      key: "organization",
      label: "Organization or Username",
      placeholder: "e.g. acme-corp",
      type: "text",
      required: false,
    },
    {
      key: "webhook_secret",
      label: "Webhook Secret (Optional)",
      placeholder: "Your HMAC secret",
      type: "password",
      required: false,
    },
  ],
  gitlab: [
    {
      key: "base_url",
      label: "GitLab Host URL",
      placeholder: "https://gitlab.com",
      type: "text",
      required: true,
      helpText: "Enter https://gitlab.com or your self-managed GitLab instance URL.",
    },
    {
      key: "token",
      label: "Personal Access Token (PAT)",
      placeholder: "glpat-xxxxxxxxxxxxxxxxxxxx",
      type: "password",
      required: true,
      helpText: "Requires api, read_repository, and read_api scopes.",
    },
    {
      key: "project_id",
      label: "Project ID or Group Path (Optional)",
      placeholder: "e.g. 12345678 or my-group/my-repo",
      type: "text",
      required: false,
    },
  ],
  bitbucket: [
    {
      key: "workspace",
      label: "Workspace / Username",
      placeholder: "e.g. my-team-workspace",
      type: "text",
      required: true,
    },
    {
      key: "app_password",
      label: "App Password / Token",
      placeholder: "Bitbucket App Password",
      type: "password",
      required: true,
      helpText: "Create an App Password with repository:read and pullrequest:write scopes.",
    },
  ],
  aws: [
    {
      key: "access_key_id",
      label: "AWS Access Key ID",
      placeholder: "AKIAIOSFODNN7EXAMPLE",
      type: "text",
      required: true,
    },
    {
      key: "secret_access_key",
      label: "AWS Secret Access Key",
      placeholder: "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY",
      type: "password",
      required: true,
    },
    {
      key: "region",
      label: "AWS Default Region",
      placeholder: "us-east-1",
      type: "select",
      options: ["us-east-1", "us-east-2", "us-west-1", "us-west-2", "eu-west-1", "eu-central-1", "ap-southeast-1"],
      required: true,
    },
    {
      key: "role_arn",
      label: "Assume Role ARN (Optional)",
      placeholder: "arn:aws:iam::123456789012:role/SentinelAIScannerRole",
      type: "text",
      required: false,
    },
  ],
  gcp: [
    {
      key: "project_id",
      label: "GCP Project ID",
      placeholder: "my-gcp-project-12345",
      type: "text",
      required: true,
    },
    {
      key: "service_account_json",
      label: "Service Account Key (JSON)",
      placeholder: '{\n  "type": "service_account",\n  "project_id": "..."\n}',
      type: "textarea",
      required: true,
      helpText: "Paste your Service Account JSON credentials with Security Reviewer role.",
    },
  ],
  azure: [
    {
      key: "tenant_id",
      label: "Entra Directory (Tenant) ID",
      placeholder: "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
      type: "text",
      required: true,
    },
    {
      key: "client_id",
      label: "Application (Client) ID",
      placeholder: "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
      type: "text",
      required: true,
    },
    {
      key: "client_secret",
      label: "Client Secret Value",
      placeholder: "Your Azure App Registration Client Secret",
      type: "password",
      required: true,
    },
    {
      key: "subscription_id",
      label: "Subscription ID (Optional)",
      placeholder: "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
      type: "text",
      required: false,
    },
  ],
  slack: [
    {
      key: "webhook_url",
      label: "Slack Incoming Webhook URL",
      placeholder: "https://hooks.slack.com/services/T000/B000/XXXX",
      type: "text",
      required: true,
      helpText: "Create an Incoming Webhook in your Slack App settings.",
    },
    {
      key: "channel",
      label: "Default Channel Name",
      placeholder: "#security-alerts",
      type: "text",
      required: false,
    },
    {
      key: "bot_token",
      label: "Bot User OAuth Token (Optional)",
      placeholder: "xoxb-xxxxxxxxxxxxxxxxxxxx",
      type: "password",
      required: false,
    },
  ],
  jira: [
    {
      key: "domain",
      label: "Jira Instance URL",
      placeholder: "https://your-company.atlassian.net",
      type: "text",
      required: true,
    },
    {
      key: "email",
      label: "Account Email",
      placeholder: "security-bot@company.com",
      type: "text",
      required: true,
    },
    {
      key: "api_token",
      label: "Atlassian API Token",
      placeholder: "Your Jira API token",
      type: "password",
      required: true,
    },
    {
      key: "project_key",
      label: "Default Project Key",
      placeholder: "e.g. SEC or VULN",
      type: "text",
      required: true,
    },
  ],
  pagerduty: [
    {
      key: "routing_key",
      label: "Integration / Routing Key",
      placeholder: "32-character PagerDuty Integration Key",
      type: "password",
      required: true,
      helpText: "From your PagerDuty Service -> Integrations -> Events API v2.",
    },
    {
      key: "api_key",
      label: "REST API Key (Optional)",
      placeholder: "Your PagerDuty Global API Key",
      type: "password",
      required: false,
    },
  ],
  jenkins: [
    {
      key: "server_url",
      label: "Jenkins Server URL",
      placeholder: "https://jenkins.company.com:8080",
      type: "text",
      required: true,
    },
    {
      key: "username",
      label: "Jenkins Username",
      placeholder: "sentinel-bot",
      type: "text",
      required: true,
    },
    {
      key: "api_token",
      label: "API Token / Password",
      placeholder: "User API Token",
      type: "password",
      required: true,
    },
  ],
  circleci: [
    {
      key: "token",
      label: "Personal API Token",
      placeholder: "Your CircleCI personal API token",
      type: "password",
      required: true,
    },
    {
      key: "org_slug",
      label: "Organization Slug (Optional)",
      placeholder: "gh/my-org",
      type: "text",
      required: false,
    },
  ],
  "github-actions": [
    {
      key: "secret_name",
      label: "Action Secret Name",
      placeholder: "SENTINEL_API_KEY",
      type: "text",
      required: false,
      helpText: "Name of the secret to inject into your GitHub Actions workflow.",
    },
    {
      key: "default_branch",
      label: "Default Scan Branch",
      placeholder: "main",
      type: "text",
      required: false,
    },
  ],
  nvd: [
    {
      key: "api_key",
      label: "NVD API Key (Optional)",
      placeholder: "NVD API Key for higher rate limits",
      type: "password",
      required: false,
      helpText: "Allows requesting up to 50 requests / 30s instead of 5 requests / 30s.",
    },
    {
      key: "sync_interval_hours",
      label: "Sync Frequency (Hours)",
      placeholder: "6",
      type: "select",
      options: ["1", "6", "12", "24"],
      required: false,
    },
  ],
  exploitdb: [
    {
      key: "api_key",
      label: "Exploit-DB API Key (Optional)",
      placeholder: "API Key if applicable",
      type: "password",
      required: false,
    },
  ],
  osv: [
    {
      key: "api_endpoint",
      label: "OSV API Endpoint",
      placeholder: "https://api.osv.dev/v1",
      type: "text",
      required: false,
    },
  ],
};

const DEFAULT_GENERIC_FIELDS: IntegrationField[] = [
  {
    key: "api_key",
    label: "API Key / Access Token",
    placeholder: "Enter secret key or token",
    type: "password",
    required: true,
  },
  {
    key: "endpoint_url",
    label: "Endpoint URL (Optional)",
    placeholder: "https://api.service.com/v1",
    type: "text",
    required: false,
  },
];

const INTEGRATIONS = [
  {
    category: "Source Control",
    items: [
      {
        id: "github",
        name: "GitHub",
        description: "Connect repositories, webhooks, and PR automation",
        logo: "🐙",
      },
      {
        id: "gitlab",
        name: "GitLab",
        description: "CI/CD pipeline integration and MR scanning",
        logo: "🦊",
      },
      {
        id: "bitbucket",
        name: "Bitbucket",
        description: "Atlassian repository scanning and PR creation",
        logo: "🪣",
      },
    ],
  },
  {
    category: "Cloud Providers",
    items: [
      {
        id: "aws",
        name: "AWS",
        description: "S3, EC2, IAM, Lambda, and EKS security scanning",
        logo: "☁️",
      },
      {
        id: "gcp",
        name: "Google Cloud",
        description: "GKE, Cloud Run, and IAM configuration review",
        logo: "🔵",
      },
      {
        id: "azure",
        name: "Microsoft Azure",
        description: "AKS, Key Vault, and Entra ID security posture",
        logo: "🔷",
      },
    ],
  },
  {
    category: "CI/CD",
    items: [
      {
        id: "github-actions",
        name: "GitHub Actions",
        description: "Automatic scan triggers on push and PR events",
        logo: "⚙️",
      },
      {
        id: "jenkins",
        name: "Jenkins",
        description: "Pipeline plugin for automated security gates",
        logo: "🤖",
      },
      {
        id: "circleci",
        name: "CircleCI",
        description: "Orb-based scan integration",
        logo: "🔵",
      },
    ],
  },
  {
    category: "Notifications & Ticketing",
    items: [
      {
        id: "slack",
        name: "Slack",
        description: "Real-time alerts for critical findings and scan completions",
        logo: "💬",
      },
      {
        id: "jira",
        name: "Jira",
        description: "Automatic ticket creation for verified vulnerabilities",
        logo: "🔵",
      },
      {
        id: "pagerduty",
        name: "PagerDuty",
        description: "On-call escalation for critical severity findings",
        logo: "🚨",
      },
    ],
  },
  {
    category: "Threat Intelligence",
    items: [
      {
        id: "nvd",
        name: "NVD (NIST)",
        description: "National Vulnerability Database CVE feed",
        logo: "🏛️",
      },
      {
        id: "exploitdb",
        name: "Exploit-DB",
        description: "Known exploit signatures and PoC database",
        logo: "💣",
      },
      {
        id: "osv",
        name: "OSV (Google)",
        description: "Open Source Vulnerability database",
        logo: "🔓",
      },
    ],
  },
];

// Configuration Modal Component
function IntegrationConfigModal({
  item,
  dbIntegration,
  isOpen,
  onClose,
  onSaved,
}: {
  item: IntegrationItem | null;
  dbIntegration?: any;
  isOpen: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [formData, setFormData] = useState<Record<string, string>>({});
  const [showSecrets, setShowSecrets] = useState<Record<string, boolean>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isTesting, setIsTesting] = useState(false);

  useEffect(() => {
    if (item) {
      const initial: Record<string, string> = {};
      const fields = INTEGRATION_FIELDS[item.id] || DEFAULT_GENERIC_FIELDS;
      fields.forEach((f) => {
        initial[f.key] = dbIntegration?.config?.[f.key] || "";
      });
      setFormData(initial);
    }
  }, [item, dbIntegration]);

  if (!isOpen || !item) return null;

  const fields = INTEGRATION_FIELDS[item.id] || DEFAULT_GENERIC_FIELDS;
  const isConnected = !!dbIntegration;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      if (isConnected && dbIntegration?.id) {
        // Update existing integration
        const res = await fetch(`/api/integrations/${dbIntegration.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: item.name,
            enabled: true,
            config: formData,
          }),
        });
        if (!res.ok) throw new Error("Failed to update integration configuration");
        toast.success(`${item.name} settings updated successfully`);
      } else {
        // Connect new integration with user inputs
        const res = await fetch("/api/integrations", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: item.name,
            type: item.id.toUpperCase().replace("-", "_"),
            enabled: true,
            config: formData,
          }),
        });
        if (!res.ok) throw new Error("Failed to connect integration");
        toast.success(`${item.name} connected successfully!`);
      }
      onSaved();
      onClose();
    } catch (err: any) {
      toast.error(err.message || "Failed to save configuration");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleTestConnection = async () => {
    if (!dbIntegration?.id) {
      toast.error("Please connect and save the integration first to test connection.");
      return;
    }
    setIsTesting(true);
    try {
      const res = await fetch(`/api/integrations/${dbIntegration.id}/test`, {
        method: "POST",
      });
      const data = await res.json();
      if (data.success) {
        toast.success(data.message || "Connection verified successfully!");
      } else {
        toast.error(data.message || "Connection test failed.");
      }
      onSaved();
    } catch (err: any) {
      toast.error(err.message || "Test request failed");
    } finally {
      setIsTesting(false);
    }
  };

  const toggleShowSecret = (key: string) => {
    setShowSecrets((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          className="glass-card relative w-full max-w-lg rounded-2xl border border-white/10 p-6 bg-cyber-dark/95 shadow-2xl overflow-hidden"
        >
          {/* Header */}
          <div className="flex items-start justify-between pb-4 border-b border-white/10">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-2xl flex-shrink-0">
                {item.logo}
              </div>
              <div>
                <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
                  {item.name}
                  {isConnected ? (
                    <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
                      Connected
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-cyber-cyan/10 border border-cyber-cyan/20 text-cyber-cyan">
                      Connect Integration
                    </span>
                  )}
                </h2>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {item.description}
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="text-muted-foreground hover:text-foreground p-1 rounded-lg hover:bg-white/5 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="mt-5 space-y-4">
            {fields.map((field) => {
              const isPassword = field.type === "password";
              const isShowing = showSecrets[field.key];

              return (
                <div key={field.key} className="space-y-1.5">
                  <label className="block text-xs font-medium text-foreground">
                    {field.label}
                    {field.required && (
                      <span className="text-red-400 ml-1">*</span>
                    )}
                  </label>

                  {field.type === "textarea" ? (
                    <textarea
                      rows={3}
                      required={field.required}
                      placeholder={field.placeholder}
                      value={formData[field.key] || ""}
                      onChange={(e) =>
                        setFormData({ ...formData, [field.key]: e.target.value })
                      }
                      className="w-full px-3 py-2 rounded-lg bg-black/40 border border-white/10 text-xs font-mono text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-cyber-cyan transition-colors"
                    />
                  ) : field.type === "select" ? (
                    <select
                      value={formData[field.key] || field.options?.[0] || ""}
                      onChange={(e) =>
                        setFormData({ ...formData, [field.key]: e.target.value })
                      }
                      className="w-full px-3 py-2 rounded-lg bg-black/40 border border-white/10 text-xs text-foreground focus:outline-none focus:border-cyber-cyan transition-colors"
                    >
                      {field.options?.map((opt) => (
                        <option key={opt} value={opt} className="bg-slate-900">
                          {opt}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <div className="relative">
                      <input
                        type={isPassword && !isShowing ? "password" : "text"}
                        required={field.required}
                        placeholder={field.placeholder}
                        value={formData[field.key] || ""}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            [field.key]: e.target.value,
                          })
                        }
                        className="w-full px-3 py-2 pr-9 rounded-lg bg-black/40 border border-white/10 text-xs text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-cyber-cyan transition-colors"
                      />
                      {isPassword && (
                        <button
                          type="button"
                          onClick={() => toggleShowSecret(field.key)}
                          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                        >
                          {isShowing ? (
                            <EyeOff className="w-3.5 h-3.5" />
                          ) : (
                            <Eye className="w-3.5 h-3.5" />
                          )}
                        </button>
                      )}
                    </div>
                  )}

                  {field.helpText && (
                    <p className="text-[11px] text-muted-foreground">
                      {field.helpText}
                    </p>
                  )}
                </div>
              );
            })}

            {/* Actions */}
            <div className="pt-4 border-t border-white/10 flex items-center justify-between gap-3">
              {isConnected ? (
                <button
                  type="button"
                  onClick={handleTestConnection}
                  disabled={isTesting}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-xs font-semibold text-muted-foreground hover:text-foreground hover:bg-white/10 transition-all disabled:opacity-50"
                >
                  <RefreshCw
                    className={`w-3.5 h-3.5 ${isTesting ? "animate-spin" : ""}`}
                  />
                  {isTesting ? "Testing..." : "Test Connection"}
                </button>
              ) : (
                <div />
              )}

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-3.5 py-2 rounded-lg bg-white/5 border border-white/10 text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-cyber-cyan text-black font-semibold text-xs hover:bg-cyber-cyan/90 transition-all disabled:opacity-50 shadow-lg shadow-cyber-cyan/20"
                >
                  {isSubmitting ? (
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Check className="w-3.5 h-3.5" />
                  )}
                  {isSubmitting
                    ? "Saving..."
                    : isConnected
                      ? "Save Configuration"
                      : "Connect & Authorize"}
                </button>
              </div>
            </div>
          </form>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}

// Integration Card Component
function IntegrationCard({
  item,
  dbIntegration,
  onRefresh,
  onOpenConfig,
}: {
  item: IntegrationItem;
  dbIntegration?: any;
  onRefresh: () => void;
  onOpenConfig: (item: IntegrationItem) => void;
}) {
  const connected = !!dbIntegration;
  const [loading, setLoading] = useState(false);
  const lastSync = dbIntegration?.last_test
    ? `${new Date(dbIntegration.last_test).toLocaleString()}`
    : null;

  const handleDisconnect = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/integrations/${dbIntegration.id}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Failed to disconnect integration");
      toast.success(`${item.name} disconnected`);
      onRefresh();
    } catch (err: any) {
      toast.error(err.message || "Operation failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <motion.div
      whileHover={{ y: -2 }}
      className="glass-card rounded-xl p-5 border border-white/5 hover:border-white/10 transition-all duration-200"
    >
      <div className="flex items-start justify-between gap-3">
        {/* Logo + Name/Description */}
        <div className="flex items-start gap-3 flex-1 min-w-0">
          <div className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-xl flex-shrink-0">
            {item.logo}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-foreground leading-tight">
              {item.name}
            </p>
            {connected && (
              <span className="inline-flex items-center gap-1 mt-1 px-1.5 py-0.5 rounded-full text-xs bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-semibold">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                Connected
              </span>
            )}
            <p className="text-xs text-muted-foreground mt-1 truncate">
              {item.description}
            </p>
          </div>
        </div>

        {/* Actions: Settings + Connect/Disconnect */}
        <div className="flex flex-col items-end gap-2 flex-shrink-0">
          {connected ? (
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => onOpenConfig(item)}
                title="Configure Settings"
                className="p-1.5 rounded-lg bg-white/5 border border-white/10 text-muted-foreground hover:text-foreground hover:bg-white/10 transition-colors"
              >
                <Settings className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={handleDisconnect}
                disabled={loading}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500/20 transition-all disabled:opacity-50 whitespace-nowrap"
              >
                {loading ? (
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <>Disconnect</>
                )}
              </button>
            </div>
          ) : (
            <button
              onClick={() => onOpenConfig(item)}
              disabled={loading}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-cyber-cyan/10 border border-cyber-cyan/20 text-cyber-cyan hover:bg-cyber-cyan/20 transition-all disabled:opacity-50 whitespace-nowrap"
            >
              <Plus className="w-3.5 h-3.5" />
              Connect
            </button>
          )}
        </div>
      </div>

      {connected && lastSync && (
        <div className="mt-3 pt-3 border-t border-white/5 flex items-center justify-between text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <RefreshCw className="w-3 h-3" />
            Last test {lastSync}
          </span>
        </div>
      )}
    </motion.div>
  );
}

export default function IntegrationsPage() {
  const [dbIntegrations, setDbIntegrations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedConfigItem, setSelectedConfigItem] = useState<IntegrationItem | null>(null);
  const [webhookUrl, setWebhookUrl] = useState(
    "https://app.sentinelai.io/api/v1/webhooks/inbound/tenant",
  );

  useEffect(() => {
    const loadTenantContext = async () => {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      const tenantId = user?.app_metadata?.tenant_id as string | undefined;
      const origin =
        typeof window !== "undefined"
          ? window.location.origin
          : "https://app.sentinelai.io";
      setWebhookUrl(
        `${origin}/api/v1/webhooks/inbound/${tenantId ?? "tenant"}`,
      );
    };
    void loadTenantContext();
  }, []);

  const fetchIntegrations = async () => {
    try {
      const res = await fetch("/api/integrations");
      if (!res.ok) throw new Error("Failed to fetch integrations");
      const data = await res.json();
      setDbIntegrations(Array.isArray(data) ? data : []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchIntegrations();
  }, []);

  const totalCount = INTEGRATIONS.flatMap((c) => c.items).length;
  const connectedCount = dbIntegrations.length;

  const currentDbIntegration = selectedConfigItem
    ? dbIntegrations.find(
        (d) => d.type === selectedConfigItem.id.toUpperCase().replace("-", "_"),
      )
    : undefined;

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground tracking-tight">
            Integrations
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Connect SentinelAI to your development ecosystem
          </p>
        </div>
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-sm text-muted-foreground font-semibold">
          <CheckCircle className="w-4 h-4 text-emerald-400" />
          <span>
            {connectedCount}/{totalCount} connected
          </span>
        </div>
      </div>

      {/* Webhook Config Panel */}
      <div className="glass-card rounded-xl border border-white/5 p-5">
        <div className="flex items-start justify-between">
          <div>
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
              <Zap className="w-4 h-4 text-cyber-cyan" />
              Webhook Configuration
            </h3>
            <p className="text-xs text-muted-foreground mt-1">
              Use this endpoint to trigger SentinelAI scans from external
              systems
            </p>
          </div>
          <span className="text-xs font-semibold px-2 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
            HMAC-SHA256 Signed
          </span>
        </div>
        <div className="mt-4 flex items-center gap-2">
          <div className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-2 font-mono text-xs text-cyber-cyan truncate">
            {webhookUrl}
          </div>
          <button
            onClick={() => {
              navigator.clipboard.writeText(webhookUrl);
              toast.success("Webhook URL copied");
            }}
            className="px-3 py-2 rounded-lg bg-cyber-cyan/10 border border-cyber-cyan/20 text-cyber-cyan text-xs hover:bg-cyber-cyan/20 transition-all flex-shrink-0"
          >
            Copy URL
          </button>
        </div>
      </div>

      {/* Integration Categories */}
      {INTEGRATIONS.map((category, ci) => (
        <motion.div
          key={category.category}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: ci * 0.1 }}
        >
          <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-3">
            {category.category}
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {category.items.map((item) => {
              const matchingDb = dbIntegrations.find(
                (dbInt) =>
                  dbInt.type === item.id.toUpperCase().replace("-", "_"),
              );
              return (
                <IntegrationCard
                  key={item.id}
                  item={item}
                  dbIntegration={matchingDb}
                  onRefresh={fetchIntegrations}
                  onOpenConfig={(clickedItem) => setSelectedConfigItem(clickedItem)}
                />
              );
            })}
          </div>
        </motion.div>
      ))}

      {/* Configuration & Connect Modal */}
      <IntegrationConfigModal
        item={selectedConfigItem}
        dbIntegration={currentDbIntegration}
        isOpen={!!selectedConfigItem}
        onClose={() => setSelectedConfigItem(null)}
        onSaved={fetchIntegrations}
      />
    </div>
  );
}
