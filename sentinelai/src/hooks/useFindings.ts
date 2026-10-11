// src/hooks/useFindings.ts
import { useEffect, useState, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import axios from "axios";
import { Finding } from "@/types";

export interface FindingsResponse {
  findings: Finding[];
  total: number;
  page: number;
  per_page: number;
}

interface UseFindingsOptions {
  projectId?: string;
  scanId?: string;
  severity?: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";
  verifiedOnly?: boolean;
  excludeFalsePositives?: boolean;
}

export function useFindings(options: UseFindingsOptions = {}) {
  const [findings, setFindings] = useState<Finding[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(50);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const searchParams = useSearchParams();

  const fetchFindings = useCallback(
    async (pageNum: number = 1) => {
      if (!searchParams) return;

      setLoading(true);
      setError(null);

      try {
        // Build query parameters
        const params = new URLSearchParams();
        if (options.projectId) params.append("project_id", options.projectId);
        if (options.scanId) params.append("scan_id", options.scanId);
        if (options.severity) params.append("severity", options.severity);
        if (options.verifiedOnly) params.append("verified_only", "true");
        if (options.excludeFalsePositives !== undefined)
          params.append("false_positives", String(!options.excludeFalsePositives)); // API expects false_positives=true to include false positives
        params.append("page", String(pageNum));
        params.append("per_page", String(perPage));

        const response = await axios.get<FindingsResponse>(
          `/api/findings?${params.toString()}`
        );

        setFindings(response.data.findings);
        setTotal(response.data.total);
        setPage(response.data.page);
        setPerPage(response.data.per_page);
      } catch (err: any) {
        console.error("Failed to fetch findings:", err);
        setError(
          err.response?.data?.error ||
            err.message ||
            "Failed to load findings"
        );
        setFindings([]);
        setTotal(0);
      } finally {
        setLoading(false);
      }
    },
    [
      options.projectId,
      options.scanId,
      options.severity,
      options.verifiedOnly,
      options.excludeFalsePositives,
      perPage,
      searchParams
    ]
  );

  // Initial load and refetch when options change
  useEffect(() => {
    fetchFindings();
  }, [fetchFindings]);

  const refetch = useCallback(() => {
    fetchFindings(page);
  }, [fetchFindings, page]);

  return {
    findings,
    total,
    page,
    perPage,
    loading,
    error,
    refetch,
  };
}