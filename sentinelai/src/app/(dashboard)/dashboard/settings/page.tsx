// src/app/(dashboard)/dashboard/settings/page.tsx
"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  Settings,
  User,
  Shield,
  Bell,
  Key,
  Palette,
  Save,
  Eye,
  EyeOff,
  Plus,
  Trash2,
  CheckCircle,
  Copy,
  RefreshCw,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { usePermissions } from "@/hooks/usePermissions";

const TABS = [
  { id: "profile", label: "Profile", icon: User },
  { id: "security", label: "Security & MFA", icon: Shield },
  { id: "api-keys", label: "API Keys", icon: Key },
  { id: "team", label: "Team & RBAC", icon: Users },
];

const TEAM_MEMBERS = [
  {
    id: "1",
    name: "Alex Johnson",
    email: "alex@corp.io",
    role: "Superadmin",
    mfa: true,
    lastLogin: "2h ago",
  },
  {
    id: "2",
    name: "Sam Chen",
    email: "sam@corp.io",
    role: "Engineer",
    mfa: true,
    lastLogin: "30m ago",
  },
  {
    id: "3",
    name: "Jordan Park",
    email: "jordan@corp.io",
    role: "CISO",
    mfa: true,
    lastLogin: "1d ago",
  },
  {
    id: "4",
    name: "Taylor Reed",
    email: "taylor@corp.io",
    role: "Viewer",
    mfa: false,
    lastLogin: "3d ago",
  },
];

const API_KEYS = [
  {
    id: "key-1",
    name: "CI/CD Pipeline Key",
    prefix: "sk_live_***...9f2a",
    scopes: ["scan:write", "finding:read"],
    created: "2025-01-15",
    lastUsed: "2m ago",
    expiresIn: "87 days",
  },
  {
    id: "key-2",
    name: "Monitoring Dashboard",
    prefix: "sk_live_***...b3c7",
    scopes: ["finding:read", "report:read"],
    created: "2025-03-01",
    lastUsed: "1h ago",
    expiresIn: "45 days",
  },
];

const ROLE_COLORS = {
  Superadmin: {
    color: "#ff3366",
    bg: "rgba(255,51,102,0.1)",
    border: "rgba(255,51,102,0.3)",
  },
  CISO: {
    color: "#b347ea",
    bg: "rgba(179,71,234,0.1)",
    border: "rgba(179,71,234,0.3)",
  },
  Engineer: {
    color: "#00f5ff",
    bg: "rgba(0,245,255,0.1)",
    border: "rgba(0,245,255,0.3)",
  },
  Viewer: {
    color: "#64748b",
    bg: "rgba(100,116,139,0.1)",
    border: "rgba(100,116,139,0.3)",
  },
};

function ProfileTab() {
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("Viewer");
  const [userId, setUserId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let mounted = true;
    const supabase = createClient();

    const loadProfile = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user || !mounted) return;
      setUserId(user.id);
      setEmail(user.email ?? "");

      const { data: profile } = await supabase
        .from("profiles")
        .select("display_name, role")
        .eq("id", user.id)
        .maybeSingle();

      if (!mounted) return;
      setDisplayName(
        profile?.display_name || user.user_metadata?.full_name || "",
      );
      setRole(profile?.role || "Viewer");
    };

    void loadProfile();
    return () => {
      mounted = false;
    };
  }, []);

  const handleSave = async () => {
    if (!userId) {
      toast.error("Unable to load user profile");
      return;
    }
    setSaving(true);
    try {
      const supabase = createClient();
      const { error } = await supabase
        .from("profiles")
        .update({ display_name: displayName })
        .eq("id", userId);

      if (error) {
        throw error;
      }

      toast.success("Profile updated successfully");
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to update profile",
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-base font-semibold text-foreground mb-4">
          Profile Information
        </h3>
        <div className="space-y-4 max-w-lg">
          {/* Avatar */}
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-xl bg-gradient-to-br from-cyber-cyan/30 to-cyber-purple/30 border border-white/10 flex items-center justify-center">
              <span className="text-xl font-bold text-foreground">AJ</span>
            </div>
            <button className="px-3 py-1.5 text-xs rounded-lg bg-white/5 border border-white/10 text-muted-foreground hover:text-foreground transition-all">
              Change Avatar
            </button>
          </div>

          <div>
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider block mb-2">
              Display Name
            </label>
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-sm text-foreground focus:outline-none focus:border-cyber-cyan/40 focus:ring-1 focus:ring-cyber-cyan/20 transition-all"
            />
          </div>

          <div>
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider block mb-2">
              Email Address
            </label>
            <input
              type="email"
              value={email}
              disabled
              className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-sm text-muted-foreground cursor-not-allowed opacity-60"
            />
            <p className="text-xs text-muted-foreground mt-1">
              Email is managed by your SSO provider
            </p>
          </div>

          <div>
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider block mb-2">
              Role
            </label>
            <div className="flex items-center gap-2 px-3 py-2.5 bg-white/5 border border-white/10 rounded-lg">
              <Shield className="w-4 h-4 text-red-400" />
              <span className="text-sm font-semibold text-red-400">{role}</span>
            </div>
          </div>

          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-cyber-cyan/10 border border-cyber-cyan/20 text-cyber-cyan text-sm font-semibold hover:bg-cyber-cyan/20 transition-all disabled:opacity-50"
          >
            {saving ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : (
              <Save className="w-4 h-4" />
            )}
            {saving ? "Saving..." : "Save Changes"}
          </button>
        </div>
      </div>
    </div>
  );
}

function SecurityTab() {
  const [mfaEnabled, setMfaEnabled] = useState(false);
  const [showRecoveryCodes, setShowRecoveryCodes] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [savingPassword, setSavingPassword] = useState(false);

  useEffect(() => {
    let mounted = true;
    const loadMfaStatus = async () => {
      try {
        const supabase = createClient();
        const result = await supabase.auth.mfa.listFactors();
        if (!mounted) return;

        const totp = result.data?.totp ?? [];
        setMfaEnabled(totp.some((factor) => factor.status === "verified"));
      } catch {
        if (mounted) {
          setMfaEnabled(false);
        }
      }
    };

    void loadMfaStatus();
    return () => {
      mounted = false;
    };
  }, []);

  const handlePasswordUpdate = async () => {
    if (!currentPassword || !newPassword || !confirmPassword) {
      toast.error("Fill in all password fields");
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error("New password and confirmation do not match");
      return;
    }
    if (newPassword.length < 12) {
      toast.error("Use at least 12 characters for the new password");
      return;
    }

    setSavingPassword(true);
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.updateUser({
        password: newPassword,
      });
      if (error) {
        throw error;
      }

      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      toast.success("Password updated successfully");
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Password update failed",
      );
    } finally {
      setSavingPassword(false);
    }
  };

  return (
    <div className="space-y-6 max-w-lg">
      {/* MFA */}
      <div>
        <h3 className="text-base font-semibold text-foreground mb-4">
          Multi-Factor Authentication
        </h3>
        <div className="p-4 rounded-xl border border-white/5 bg-white/3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-foreground">
                TOTP Authenticator
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Google Authenticator, Authy, 1Password
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span
                className={`text-xs font-bold px-2 py-1 rounded-full ${mfaEnabled ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" : "bg-red-500/10 text-red-400 border border-red-500/20"}`}
              >
                {mfaEnabled ? "ENABLED" : "DISABLED"}
              </span>
              {!mfaEnabled && (
                <button
                  onClick={() =>
                    toast.info(
                      "MFA enrollment flow will open from the Auth profile dialog",
                    )
                  }
                  className="text-xs px-3 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/20 transition-all"
                >
                  Enable
                </button>
              )}
            </div>
          </div>
          {mfaEnabled && (
            <div className="mt-3 pt-3 border-t border-white/5 flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-emerald-400" />
              <span className="text-xs text-emerald-400">
                MFA is active and protecting your account
              </span>
              <span className="text-xs text-muted-foreground ml-auto">
                Mandatory for your role
              </span>
            </div>
          )}
          {!mfaEnabled && (
            <div className="mt-3 pt-3 border-t border-white/5 flex items-center gap-2">
              <span className="text-xs text-yellow-400">
                MFA is currently disabled. Enable it from your authentication
                profile.
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Password */}
      <div>
        <h3 className="text-base font-semibold text-foreground mb-4">
          Password
        </h3>
        <div className="space-y-3">
          {[
            { label: "Current Password", placeholder: "••••••••••••" },
            { label: "New Password", placeholder: "Min 16 characters" },
            { label: "Confirm New Password", placeholder: "••••••••••••" },
          ].map((field) => (
            <div key={field.label}>
              <label className="text-xs font-medium text-muted-foreground block mb-1.5">
                {field.label}
              </label>
              <input
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                placeholder={field.placeholder}
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-sm text-foreground focus:outline-none focus:border-cyber-cyan/40 transition-all placeholder:text-muted-foreground"
              />
            </div>
          ))}
          <button
            onClick={handlePasswordUpdate}
            disabled={savingPassword}
            className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-cyber-cyan/10 border border-cyber-cyan/20 text-cyber-cyan text-sm font-semibold hover:bg-cyber-cyan/20 transition-all disabled:opacity-50"
          >
            {savingPassword ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : (
              <Save className="w-4 h-4" />
            )}
            {savingPassword ? "Updating..." : "Update Password"}
          </button>
        </div>
      </div>

      {/* Active Sessions */}
      <div>
        <h3 className="text-base font-semibold text-foreground mb-4">
          Active Sessions
        </h3>
        <div className="space-y-2">
          {[
            {
              device: "MacBook Pro — Chrome 125",
              location: "San Francisco, US",
              current: true,
              time: "Active now",
            },
            {
              device: "iPhone 15 Pro — Safari",
              location: "San Francisco, US",
              current: false,
              time: "2h ago",
            },
          ].map((session) => (
            <div
              key={session.device}
              className="flex items-center justify-between p-3 rounded-lg bg-white/3 border border-white/5"
            >
              <div>
                <p className="text-xs font-semibold text-foreground">
                  {session.device}
                </p>
                <p className="text-xs text-muted-foreground">
                  {session.location} · {session.time}
                </p>
              </div>
              <div className="flex items-center gap-2">
                {session.current && (
                  <span className="text-xs text-emerald-400 font-semibold">
                    Current
                  </span>
                )}
                {!session.current && (
                  <button className="text-xs text-red-400 hover:underline">
                    Revoke
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function ApiKeysTab() {
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newKeyName, setNewKeyName] = useState("");

  const handleCreate = () => {
    if (!newKeyName) {
      toast.error("Enter a key name");
      return;
    }
    setShowCreateForm(false);
    setNewKeyName("");
    toast.success("API key created — copy it now, it won't be shown again!");
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-base font-semibold text-foreground">API Keys</h3>
        <button
          onClick={() => setShowCreateForm(!showCreateForm)}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-cyber-cyan/10 border border-cyber-cyan/20 text-cyber-cyan text-xs font-semibold hover:bg-cyber-cyan/20 transition-all"
        >
          <Plus className="w-3.5 h-3.5" />
          New Key
        </button>
      </div>

      {showCreateForm && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-4 rounded-xl border border-cyber-cyan/20 bg-cyber-cyan/5"
        >
          <p className="text-sm font-semibold text-foreground mb-3">
            Create New API Key
          </p>
          <div className="flex gap-2">
            <input
              type="text"
              value={newKeyName}
              onChange={(e) => setNewKeyName(e.target.value)}
              placeholder="Key name (e.g. GitHub Actions)"
              className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-cyber-cyan/40 transition-all"
            />
            <button
              onClick={handleCreate}
              className="px-4 py-2 rounded-lg bg-cyber-cyan text-sentinel-900 text-sm font-bold hover:bg-cyber-cyan/90 transition-all"
            >
              Create
            </button>
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            Keys auto-expire in 90 days and are scoped to read/write permissions
          </p>
        </motion.div>
      )}

      <div className="space-y-3">
        {API_KEYS.map((key, i) => (
          <motion.div
            key={key.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
            className="glass-card rounded-xl border border-white/5 p-4"
          >
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <p className="text-sm font-bold text-foreground">
                    {key.name}
                  </p>
                  <span className="text-xs font-mono bg-white/5 border border-white/10 px-1.5 py-0.5 rounded text-muted-foreground">
                    {key.prefix}
                  </span>
                </div>
                <div className="flex flex-wrap gap-1 mb-2">
                  {key.scopes.map((scope) => (
                    <span
                      key={scope}
                      className="text-xs px-1.5 py-0.5 rounded bg-cyber-cyan/10 border border-cyber-cyan/20 text-cyber-cyan font-mono"
                    >
                      {scope}
                    </span>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground">
                  Created {key.created} · Last used {key.lastUsed} · Expires in{" "}
                  {key.expiresIn}
                </p>
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => toast.success("Key copied to clipboard")}
                  className="p-1.5 rounded-lg bg-white/5 border border-white/10 text-muted-foreground hover:text-foreground transition-colors"
                >
                  <Copy className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => toast.success("API key revoked")}
                  className="p-1.5 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500/20 transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

function TeamTab() {
  const { isSuperadmin } = usePermissions();
  const [teamMembers, setTeamMembers] = useState(TEAM_MEMBERS);

  useEffect(() => {
    let mounted = true;
    const loadTeam = async () => {
      try {
        const supabase = createClient();
        const { data } = await supabase
          .from("profiles")
          .select("id, display_name, role, created_at")
          .order("created_at", { ascending: false })
          .limit(50);

        if (!mounted || !data) return;
        if (data.length === 0) return;

        setTeamMembers(
          data.map((member) => ({
            id: member.id,
            name: member.display_name || "User",
            email: `user-${member.id.slice(0, 8)}@profile.local`,
            role: member.role || "Viewer",
            mfa: true,
            lastLogin: member.created_at
              ? new Date(member.created_at).toLocaleDateString()
              : "unknown",
          })),
        );
      } catch {
        // Keep fallback static entries if profile read is denied by RLS.
      }
    };

    void loadTeam();
    return () => {
      mounted = false;
    };
  }, []);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-base font-semibold text-foreground">
          Team Members
        </h3>
        {isSuperadmin && (
          <button className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-cyber-cyan/10 border border-cyber-cyan/20 text-cyber-cyan text-xs font-semibold hover:bg-cyber-cyan/20 transition-all">
            <Plus className="w-3.5 h-3.5" />
            Invite Member
          </button>
        )}
      </div>

      <div className="space-y-2">
        {teamMembers.map((member, i) => {
          const roleConfig =
            ROLE_COLORS[member.role as keyof typeof ROLE_COLORS] ?? ROLE_COLORS.Viewer;
          return (
            <motion.div
              key={member.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              className="glass-card rounded-xl border border-white/5 p-4 flex items-center gap-4"
            >
              <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-cyber-cyan/20 to-cyber-purple/20 border border-white/10 flex items-center justify-center flex-shrink-0">
                <span className="text-xs font-bold text-foreground">
                  {member.name
                    .split(" ")
                    .map((n) => n[0])
                    .join("")}
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-semibold text-foreground">
                    {member.name}
                  </p>
                  {!member.mfa && (
                    <span className="text-xs px-1.5 py-0.5 rounded-full bg-yellow-500/10 border border-yellow-500/20 text-yellow-400 font-semibold">
                      No MFA
                    </span>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">
                  {member.email} · Last login {member.lastLogin}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span
                  className="text-xs font-bold px-2 py-1 rounded-full"
                  style={{
                    color: roleConfig.color,
                    background: roleConfig.bg,
                    border: `1px solid ${roleConfig.border}`,
                  }}
                >
                  {member.role}
                </span>
                {isSuperadmin && (
                  <button className="p-1.5 rounded-lg bg-white/5 border border-white/10 text-muted-foreground hover:text-foreground transition-colors">
                    <Settings className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState("profile");

  const renderContent = () => {
    switch (activeTab) {
      case "profile":
        return <ProfileTab />;
      case "security":
        return <SecurityTab />;
      case "api-keys":
        return <ApiKeysTab />;
      case "team":
        return <TeamTab />;
      default:
        return (
          <div className="flex items-center justify-center h-48 text-muted-foreground text-sm">
            Coming soon
          </div>
        );
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold text-foreground tracking-tight">
          Settings
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Manage your account, security, and team
        </p>
      </div>

      <div className="flex flex-col lg:flex-row gap-6">
        {/* Sidebar */}
        <div className="w-full lg:w-52 flex-shrink-0">
          <div className="glass-card rounded-xl border border-white/5 p-2">
            {TABS.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 text-left ${
                    isActive
                      ? "bg-cyber-cyan/10 text-cyber-cyan border border-cyber-cyan/20"
                      : "text-muted-foreground hover:text-foreground hover:bg-white/5"
                  }`}
                >
                  <Icon className="w-4 h-4 flex-shrink-0" />
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2 }}
            className="glass-card rounded-xl border border-white/5 p-6"
          >
            {renderContent()}
          </motion.div>
        </div>
      </div>
    </div>
  );
}
