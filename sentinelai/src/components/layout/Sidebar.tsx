// src/components/layout/Sidebar.tsx
"use client";

import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Shield,
  LayoutDashboard,
  FolderOpen,
  Bot,
  AlertTriangle,
  FileCheck,
  Zap,
  Settings,
  ChevronLeft,
  ChevronRight,
  Terminal,
  Target,
  Activity,
  Database,
  GitBranch,
} from "lucide-react";
import { useAppStore } from "@/store";
import { usePermissions } from "@/hooks/usePermissions";
import { cn } from "@/lib/utils";
import type { AppRole } from "@/types";

interface NavItem {
  href: string;
  label: string;
  icon: any; // Using 'any' for simplicity since it's a Lucide icon component
  badge?: string;
  badgeColor?: string;
  requiresRole?: AppRole;
  dangerous?: boolean;
}

const NAV_ITEMS: Array<{
  section: string;
  items: NavItem[];
}> = [
  {
    section: "OVERVIEW",
    items: [
      { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
      { href: "/dashboard/projects", label: "Projects", icon: FolderOpen },
    ],
  },
  {
    section: "SECURITY",
    items: [
      {
        href: "/dashboard/agents",
        label: "Agent Orchestration",
        icon: Bot,
        badge: "LIVE",
        badgeColor: "cyber-emerald",
      },
      {
        href: "/dashboard/vulnerabilities",
        label: "Vulnerabilities",
        icon: AlertTriangle,
      },
      {
        href: "/dashboard/scans",
        label: "Scan History",
        icon: Activity,
      },
      {
        href: "/dashboard/threat-intel",
        label: "Threat Intelligence",
        icon: Target,
      },
    ],
  },
  {
    section: "GOVERNANCE",
    items: [
      {
        href: "/dashboard/compliance",
        label: "Compliance",
        icon: FileCheck,
        requiresRole: "CISO" as const,
      },
      {
        href: "/dashboard/audit",
        label: "Audit Logs",
        icon: Database,
        requiresRole: "CISO" as const,
      },
    ],
  },
  {
    section: "ADVANCED",
    items: [
      {
        href: "/dashboard/exploits",
        label: "Exploit Lab",
        icon: Zap,
        requiresRole: "Superadmin" as const,
        dangerous: true,
      },
      {
        href: "/dashboard/integrations",
        label: "Integrations",
        icon: GitBranch,
      },
      {
        href: "/dashboard/settings",
        label: "Settings",
        icon: Settings,
      },
    ],
  },
];

export function Sidebar() {
  const pathname = usePathname();
  const { sidebarCollapsed, toggleSidebar } = useAppStore();
  const { hasRole } = usePermissions();

  const isActive = (href: string) => {
    if (href === "/dashboard") return pathname === "/dashboard";
    return pathname.startsWith(href);
  };

  return (
    <motion.aside
      animate={{ width: sidebarCollapsed ? 72 : 260 }}
      transition={{ duration: 0.3, ease: "easeInOut" }}
      className="relative flex flex-col h-full border-r border-white/5 overflow-visible flex-shrink-0"
      style={{ background: "rgba(4, 9, 16, 0.95)" }}
    >
      {/* Logo */}
      <div className="flex items-center h-16 px-4 border-b border-white/5 flex-shrink-0 overflow-hidden">
        <div className="flex items-center gap-3 overflow-hidden">
          <div className="relative flex-shrink-0">
            <Shield
              className="w-8 h-8 text-cyber-cyan"
              style={{ filter: "drop-shadow(0 0 6px rgba(0, 245, 255, 0.5))" }}
            />
            <div className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-cyber-emerald animate-pulse" />
          </div>
          <AnimatePresence>
            {!sidebarCollapsed && (
              <motion.div
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                transition={{ duration: 0.2 }}
              >
                <p className="font-bold text-white text-lg tracking-tight leading-none">
                  Sentinel<span className="text-cyber-cyan">AI</span>
                </p>
                <p className="text-xs text-muted-foreground font-mono mt-0.5">
                  v2.4.0
                </p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto overflow-x-hidden py-4 px-3 space-y-6">
        {NAV_ITEMS.map((section) => {
          const visibleItems = section.items.filter((item) =>
            item.requiresRole ? hasRole(item.requiresRole) : true
          );

          if (visibleItems.length === 0) return null;

          return (
            <div key={section.section}>
              <AnimatePresence>
                {!sidebarCollapsed && (
                  <motion.p
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="text-xs font-semibold text-muted-foreground/60 uppercase tracking-widest px-3 mb-2"
                  >
                    {section.section}
                  </motion.p>
                )}
              </AnimatePresence>

              <div className="space-y-1">
                {visibleItems.map((item) => {
                  const Icon = item.icon;
                  const active = isActive(item.href);

                  return (
                    <Link key={item.href} href={item.href}>
                      <div
                        className={cn(
                          "relative flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 group",
                          active
                            ? item.dangerous
                              ? "bg-red-500/10 text-red-400 border border-red-500/20"
                              : "bg-cyber-cyan/10 text-cyber-cyan border border-cyber-cyan/20"
                            : "text-muted-foreground hover:text-foreground hover:bg-white/5"
                        )}
                        style={
                          active && !item.dangerous
                            ? {
                                boxShadow: "inset 0 0 20px rgba(0, 245, 255, 0.05)",
                              }
                            : {}
                        }
                      >
                        {/* Active indicator */}
                        {active && (
                          <motion.div
                            layoutId="active-indicator"
                            className={cn(
                              "absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 rounded-full",
                              item.dangerous ? "bg-red-400" : "bg-cyber-cyan"
                            )}
                          />
                        )}

                        <Icon
                          className={cn(
                            "w-4 h-4 flex-shrink-0 transition-all duration-200",
                            active
                              ? item.dangerous
                                ? "text-red-400"
                                : "text-cyber-cyan"
                              : "text-muted-foreground group-hover:text-foreground"
                          )}
                          style={
                            active && !item.dangerous
                              ? {
                                  filter:
                                    "drop-shadow(0 0 4px rgba(0, 245, 255, 0.5))",
                                }
                              : {}
                          }
                        />

                        <AnimatePresence>
                          {!sidebarCollapsed && (
                            <motion.span
                              initial={{ opacity: 0 }}
                              animate={{ opacity: 1 }}
                              exit={{ opacity: 0 }}
                              className="flex-1 truncate"
                            >
                              {item.label}
                            </motion.span>
                          )}
                        </AnimatePresence>

                        {/* Badge */}
                        {item.badge && !sidebarCollapsed && (
                          <motion.span
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="text-xs font-bold px-1.5 py-0.5 rounded text-cyber-emerald bg-cyber-emerald/10 border border-cyber-emerald/20 font-mono"
                          >
                            {item.badge}
                          </motion.span>
                        )}

                        {/* Tooltip for collapsed state */}
                        {sidebarCollapsed && (
                          <div className="absolute left-full ml-2 px-2 py-1 rounded-md bg-sentinel-700 border border-white/10 text-xs text-foreground whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50 shadow-xl">
                            {item.label}
                          </div>
                        )}
                      </div>
                    </Link>
                  );
                })}
              </div>
            </div>
          );
        })}
      </nav>

      {/* System Status */}
      <AnimatePresence>
        {!sidebarCollapsed && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="mx-3 mb-3 p-3 rounded-lg bg-cyber-emerald/5 border border-cyber-emerald/20"
          >
            <div className="flex items-center gap-2 mb-2">
              <div className="w-2 h-2 rounded-full bg-cyber-emerald animate-pulse" />
              <span className="text-xs font-semibold text-cyber-emerald">
                All Systems Operational
              </span>
            </div>
            <div className="space-y-1">
              {[
                { label: "Active Agents", value: "47" },
                { label: "Guardrail Status", value: "100%" },
              ].map(({ label, value }) => (
                <div key={label} className="flex justify-between">
                  <span className="text-xs text-muted-foreground">{label}</span>
                  <span className="text-xs text-foreground font-mono">
                    {value}
                  </span>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Collapse Toggle */}
      <button
        onClick={toggleSidebar}
        className="absolute right-0 translate-x-1/2 top-20 w-6 h-6 rounded-full bg-sentinel-700 border border-white/20 flex items-center justify-center text-muted-foreground hover:text-foreground hover:border-cyber-cyan/50 hover:bg-sentinel-600 transition-all z-20 shadow-lg"
      >
        {sidebarCollapsed ? (
          <ChevronRight className="w-3 h-3" />
        ) : (
          <ChevronLeft className="w-3 h-3" />
        )}
      </button>
    </motion.aside>
  );
}