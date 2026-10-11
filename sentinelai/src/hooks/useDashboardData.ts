import { useEffect, useState, useCallback } from "react";
import axios from "axios";

export function useRiskTrend() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchRiskTrend = useCallback(async () => {
    setLoading(true);
    try {
      const response = await axios.get("/api/system/analytics");
      setData(response.data.risk_trend);
      setError(null);
    } catch (err: any) {
      setError(err.message || "Failed to load risk trend");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRiskTrend();
  }, [fetchRiskTrend]);

  return { data, loading, error, refetch: fetchRiskTrend };
}

export function useThreatIntel() {
  const [threats, setThreats] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchThreats = useCallback(async () => {
    setLoading(true);
    try {
      const response = await axios.get("/api/system/threat-intel");
      setThreats(response.data);
      setError(null);
    } catch (err: any) {
      setError(err.message || "Failed to load threats");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchThreats();
  }, [fetchThreats]);

  return { threats, loading, error, refetch: fetchThreats };
}

export function useAgentActivityFeed() {
  const [activities, setActivities] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchActivity = useCallback(async () => {
    setLoading(true);
    try {
      const response = await axios.get("/api/system/agent-activity");
      const items = Array.isArray(response.data) ? response.data : [];
      const parsed = items.map((item: any) => ({
        ...item,
        timestamp: item.timestamp ? new Date(item.timestamp) : new Date()
      }));
      setActivities(parsed);
      setError(null);
    } catch (err: any) {
      setError(err.message || "Failed to load activity");
      setActivities([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchActivity();
    // Simulate real-time by polling every 5s for demo purposes since it's a feed
    const interval = setInterval(fetchActivity, 5000);
    return () => clearInterval(interval);
  }, [fetchActivity]);

  return { activities, loading, error, refetch: fetchActivity };
}

export function useComplianceSnapshot() {
  const [frameworks, setFrameworks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchSnapshot = useCallback(async () => {
    setLoading(true);
    try {
      const response = await axios.get("/api/compliance/snapshot");
      setFrameworks(response.data);
      setError(null);
    } catch (err: any) {
      setError(err.message || "Failed to load compliance snapshot");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSnapshot();
  }, [fetchSnapshot]);

  return { frameworks, loading, error, refetch: fetchSnapshot };
}
