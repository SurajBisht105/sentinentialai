// src/hooks/useDashboardMetrics.ts
import { useEffect, useState } from "react";
import axios from "axios";

interface DashboardMetrics {
  totalFindings: number;
  criticalThreats: number;
  avgTimeToDetect: number; // in minutes
  avgTimeToRemediate: number; // in minutes
  falsePositiveRate: number; // percentage
  activeAgents: number; // number of active scans/tasks
  guardrailSuccess: number; // percentage
  complianceScore: number; // percentage
}

export function useDashboardMetrics() {
  const [metrics, setMetrics] = useState<DashboardMetrics>({
    totalFindings: 0,
    criticalThreats: 0,
    avgTimeToDetect: 0,
    avgTimeToRemediate: 0,
    falsePositiveRate: 0,
    activeAgents: 0,
    guardrailSuccess: 100, // Default to 100% as in mock data
    complianceScore: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch all the data we need
  useEffect(() => {
    let isMounted = true;

    const fetchMetrics = async () => {
      if (!isMounted) return;
      setLoading(true);
      setError(null);

      try {
        const response = await axios.get('/api/system/analytics');
        
        if (isMounted && response.data?.metrics) {
          setMetrics(response.data.metrics);
        }
      } catch (err: any) {
        console.error("Failed to fetch dashboard metrics:", err);
        if (isMounted) {
          setError(
            err.response?.data?.error ||
              err.message ||
              "Failed to load metrics"
          );
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    fetchMetrics();

    return () => {
      isMounted = false;
    };
  }, []);

  // Refetch function
  const refetch = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await axios.get('/api/system/analytics');
      setMetrics(response.data.metrics);
    } catch (err: any) {
      setError(
        err.response?.data?.error ||
          err.message ||
          "Failed to load metrics"
      );
    } finally {
      setLoading(false);
    }
  };

  return {
    ...metrics,
    loading,
    error,
    refetch,
  };
}