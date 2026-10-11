// src/lib/utils.ts
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { Severity, AgentStatus, ScanStatus } from "@/types";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(
  date: string | Date,
  options?: Intl.DateTimeFormatOptions,
): string {
  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    ...options,
  }).format(new Date(date));
}

export function formatRelativeTime(date: string | Date): string {
  const now = new Date();
  const target = new Date(date);
  const diffInSeconds = Math.floor((now.getTime() - target.getTime()) / 1000);

  if (diffInSeconds < 60) return `${diffInSeconds}s ago`;
  if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
  if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`;
  return `${Math.floor(diffInSeconds / 86400)}d ago`;
}

export function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
  return `${Math.floor(seconds / 3600)}h ${Math.floor((seconds % 3600) / 60)}m`;
}

export function getSeverityColor(severity: Severity): string {
  const colors: Record<Severity, string> = {
    CRITICAL: "#ff3366",
    HIGH: "#ff6b35",
    MEDIUM: "#ffd700",
    LOW: "#00ff88",
    INFO: "#00f5ff",
  };
  return colors[severity];
}

export function getSeverityBgColor(severity: Severity): string {
  const colors: Record<Severity, string> = {
    CRITICAL: "rgba(255, 51, 102, 0.15)",
    HIGH: "rgba(255, 107, 53, 0.15)",
    MEDIUM: "rgba(255, 215, 0, 0.15)",
    LOW: "rgba(0, 255, 136, 0.15)",
    INFO: "rgba(0, 245, 255, 0.15)",
  };
  return colors[severity];
}

export function getSeverityBadgeClass(severity: Severity): string {
  const classes: Record<Severity, string> = {
    CRITICAL: "badge-critical",
    HIGH: "badge-high",
    MEDIUM: "badge-medium",
    LOW: "badge-low",
    INFO: "badge-info",
  };
  return classes[severity];
}

export function getAgentStatusColor(status: AgentStatus): string {
  const colors: Record<AgentStatus, string> = {
    ACTIVE: "#00ff88",
    IDLE: "#5a8fd0",
    ERROR: "#ff3366",
    COMPLETED: "#00f5ff",
  };
  return colors[status];
}

export function getScanStatusColor(status: ScanStatus): string {
  const colors: Record<ScanStatus, string> = {
    QUEUED: "#ffd700",
    RUNNING: "#00f5ff",
    COMPLETED: "#00ff88",
    FAILED: "#ff3366",
    CANCELLED: "#94a3b8",
  };
  return colors[status];
}

export function truncate(str: string, maxLength: number): string {
  if (str.length <= maxLength) return str;
  return str.substring(0, maxLength) + "...";
}

export function formatNumber(num: number): string {
  if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
  if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
  return num.toString();
}

export function calculateRiskScore(
  critical: number,
  high: number,
  medium: number,
  low: number,
): number {
  const score = critical * 10 + high * 7 + medium * 4 + low * 1;
  return Math.min(Math.round(score), 100);
}
