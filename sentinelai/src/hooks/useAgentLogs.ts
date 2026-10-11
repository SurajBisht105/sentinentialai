// src/hooks/useAgentLogs.ts
// WebSocket hook for real-time agent execution log streaming
"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";

export interface AgentLog {
  id: string;
  timestamp: string;
  level: "INFO" | "WARNING" | "ERROR" | "SUCCESS" | "DEBUG" | "REASONING";
  agent_type: string;
  message: string;
  tokens_used?: number;
  metadata?: Record<string, unknown>;
}

interface UseAgentLogsOptions {
  /** Auto-reconnect on unexpected close. Default: true */
  autoReconnect?: boolean;
  /** Max reconnect attempts. Default: 5 */
  maxRetries?: number;
  /** Max logs to keep in memory. Default: 500 */
  maxLogs?: number;
}

interface UseAgentLogsReturn {
  logs: AgentLog[];
  isConnected: boolean;
  isConnecting: boolean;
  error: string | null;
  clearLogs: () => void;
  disconnect: () => void;
}

export function useAgentLogs(
  scanId: string | null,
  options: UseAgentLogsOptions = {},
): UseAgentLogsReturn {
  const { autoReconnect = true, maxRetries = 5, maxLogs = 500 } = options;

  const [logs, setLogs] = useState<AgentLog[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const retryCountRef = useRef(0);
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isMountedRef = useRef(true);

  const disconnect = useCallback(() => {
    if (retryTimerRef.current) {
      clearTimeout(retryTimerRef.current);
    }
    if (wsRef.current) {
      wsRef.current.onclose = null; // prevent reconnect on manual close
      wsRef.current.close();
      wsRef.current = null;
    }
    setIsConnected(false);
    setIsConnecting(false);
  }, []);

  const clearLogs = useCallback(() => setLogs([]), []);

  const connect = useCallback(async () => {
    if (!scanId || !isMountedRef.current) return;

    const supabase = createClient();
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;

    const wsBaseUrl =
      process.env.NEXT_PUBLIC_API_URL?.replace("http", "ws").replace(
        "/api/v1",
        "",
      ) ?? "ws://localhost:8000";

    const url = `${wsBaseUrl}/api/v1/ws/scans/${scanId}?token=${encodeURIComponent(token ?? "")}`;

    setIsConnecting(true);
    setError(null);

    const ws = new WebSocket(url);
    wsRef.current = ws;

    ws.onopen = () => {
      if (!isMountedRef.current) return;
      setIsConnected(true);
      setIsConnecting(false);
      retryCountRef.current = 0;
    };

    ws.onmessage = (event) => {
      if (!isMountedRef.current) return;
      try {
        const payload = JSON.parse(event.data) as {
          type?: string;
          data?: unknown;
        };

        const levelFromStatus = (status?: string): AgentLog["level"] => {
          if (status === "FAILED") return "ERROR";
          if (status === "COMPLETED") return "SUCCESS" as AgentLog["level"];
          return "INFO";
        };

        const genLogId = (prefix = "log") =>
          typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
            ? crypto.randomUUID()
            : `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

        const normalize = (): AgentLog[] => {
          if (
            payload.type === "AGENT_TASK_UPDATE" &&
            Array.isArray(payload.data)
          ) {
            return payload.data.map((task: Record<string, unknown>) => ({
              id: genLogId(String(task.id ?? "task")),
              timestamp: String(task.updated_at ?? new Date().toISOString()),
              level: levelFromStatus(String(task.status ?? "")),
              agent_type: String(task.agent_type ?? "AGENT"),
              message: `${String(task.status ?? "UPDATED")}${task.error_message ? `: ${String(task.error_message)}` : ""}`,
            }));
          }

          if (
            (payload.type === "SCAN_UPDATE" || payload.type === "SCAN_STATE") &&
            payload.data &&
            typeof payload.data === "object"
          ) {
            const scan = payload.data as Record<string, unknown>;
            return [
              {
                id: genLogId(String(scan.id ?? "scan")),
                timestamp: new Date().toISOString(),
                level: "INFO",
                agent_type: "SCAN",
                message: `Scan ${String(scan.status ?? "UPDATED")} (${String(scan.progress_percent ?? scan.progress ?? 0)}%)`,
              },
            ];
          }

          return [];
        };

        const normalized = normalize();
        if (normalized.length === 0) return;

        setLogs((prev) => {
          const next = [...prev, ...normalized];
          // Trim to maxLogs
          return next.length > maxLogs
            ? next.slice(next.length - maxLogs)
            : next;
        });
      } catch {
        // Non-JSON message — treat as plain text log
        const fallbackId =
          typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
            ? crypto.randomUUID()
            : `plain-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
        setLogs((prev) => [
          ...prev,
          {
            id: fallbackId,
            timestamp: new Date().toISOString(),
            level: "INFO",
            agent_type: "SYSTEM",
            message: event.data,
          },
        ]);
      }
    };

    ws.onerror = () => {
      if (!isMountedRef.current) return;
      setError("WebSocket connection error");
      setIsConnected(false);
      setIsConnecting(false);
    };

    ws.onclose = (event) => {
      if (!isMountedRef.current) return;
      setIsConnected(false);
      setIsConnecting(false);

      // Auto-reconnect with exponential backoff
      if (
        autoReconnect &&
        !event.wasClean &&
        retryCountRef.current < maxRetries
      ) {
        const delay = Math.min(1000 * 2 ** retryCountRef.current, 30000);
        retryCountRef.current += 1;
        retryTimerRef.current = setTimeout(() => {
          if (isMountedRef.current) {
            void connect();
          }
        }, delay);
      } else if (retryCountRef.current >= maxRetries) {
        setError(`Failed to connect after ${maxRetries} attempts`);
      }
    };
  }, [scanId, autoReconnect, maxRetries, maxLogs]);

  useEffect(() => {
    isMountedRef.current = true;
    if (scanId) {
      void connect();
    }
    return () => {
      isMountedRef.current = false;
      disconnect();
    };
  }, [scanId, connect, disconnect]);

  return { logs, isConnected, isConnecting, error, clearLogs, disconnect };
}
