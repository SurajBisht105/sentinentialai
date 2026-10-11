// src/hooks/useScans.ts
import { useEffect, useState, useCallback, useRef } from "react";
import axios from "axios";
import { Scan, ScanStatus } from "@/types";

interface UseScansOptions {
  projectId?: string;
  status?: ScanStatus;
}

export function useScans(options: UseScansOptions = {}) {
  const [scans, setScans] = useState<Scan[]>([]);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const requestInFlight = useRef(false);
  const hasLoadedOnce = useRef(false);

  const fetchScans = useCallback(
    async (page: number = 1, isInitial: boolean = false) => {
      if (requestInFlight.current) return;
      requestInFlight.current = true;

      if (isInitial || !hasLoadedOnce.current) {
        setLoading(true);
      } else {
        setIsRefreshing(true);
      }
      setError(null);

      try {
        // Build query parameters
        const params = new URLSearchParams();
        if (options.projectId) params.append("project_id", options.projectId);
        if (options.status) params.append("status", options.status);
        params.append("limit", "20");
        params.append("offset", String((page - 1) * 20));

        const response = await axios.get<Scan[]>(
          `/api/scans?${params.toString()}`,
        );

        const rawList = Array.isArray(response.data) ? response.data : [];
        const transformedScans = rawList.map((scan: any) => ({
          id: scan.id ?? scan.scan_id,
          project_id: scan.project_id,
          tenant_id: scan.tenant_id,
          user_id: scan.user_id,
          status: scan.status,
          scan_types: Array.isArray(scan.scan_types)
            ? scan.scan_types
            : Array.isArray(scan.types)
              ? scan.types
              : [],
          branch: scan.branch ?? "main",
          commit_sha: scan.commit_sha,
          target_url: scan.target_url,
          trigger_type: scan.trigger_type,
          progress: scan.progress ?? scan.progress_percent ?? 0,
          finding_count: scan.finding_count ?? 0,
          critical_count: scan.critical_count ?? 0,
          high_count: scan.high_count ?? 0,
          medium_count: scan.medium_count ?? 0,
          low_count: scan.low_count ?? 0,
          false_positive_count: scan.false_positive_count ?? 0,
          total_agents: scan.total_agents ?? 0,
          completed_agents: scan.completed_agents ?? 0,
          failed_agents: scan.failed_agents ?? 0,
          total_tokens_used: scan.total_tokens_used ?? 0,
          llm_calls_count: scan.llm_calls_count ?? 0,
          hallucination_score: scan.hallucination_score,
          consensus_confidence: scan.consensus_confidence,
          started_at: scan.started_at,
          completed_at: scan.completed_at,
          duration_seconds: scan.duration_seconds,
          error_message: scan.error_message,
          created_at: scan.created_at,
          updated_at: scan.updated_at,
        }));

        setScans(transformedScans);
        hasLoadedOnce.current = true;
      } catch (err: any) {
        console.error("Failed to fetch scans:", err);
        setError(
          err.response?.data?.error || err.message || "Failed to load scans",
        );
        if (!hasLoadedOnce.current) {
          setScans([]);
        }
      } finally {
        setLoading(false);
        setIsRefreshing(false);
        requestInFlight.current = false;
      }
    },
    [options.projectId, options.status],
  );

  // Initial load and silent refetch interval
  useEffect(() => {
    fetchScans(1, true);

    const refreshTimer = window.setInterval(() => {
      fetchScans(1, false);
    }, 8000);

    return () => window.clearInterval(refreshTimer);
  }, [fetchScans]);

  return { scans, loading, isRefreshing, error, refetch: () => fetchScans(1, false) };
}
