// src/services/api.ts
import axios from "axios";
import { createClient } from "@/lib/supabase/client";

const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL ?? "/api",
  timeout: 30000,
  headers: {
    "Content-Type": "application/json",
  },
});

// Request interceptor — inject Supabase JWT
api.interceptors.request.use(async (config) => {
  const supabase = createClient();
  const { data } = await supabase.auth.getSession();

  if (data.session?.access_token) {
    config.headers.Authorization = `Bearer ${data.session.access_token}`;
  }
  return config;
});

// Response interceptor — handle 401 with token refresh
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;
      const supabase = createClient();
      const { data } = await supabase.auth.refreshSession();
      if (data.session) {
        originalRequest.headers.Authorization = `Bearer ${data.session.access_token}`;
        return api(originalRequest);
      }
    }
    return Promise.reject(error);
  }
);

// Scan endpoints
export const scanService = {
  create: (payload: {
    target_repo: string;
    branch: string;
    scan_types: string[];
  }) => api.post("/scans", payload),

  getById: (id: string) => api.get(`/scans/${id}`),

  list: (projectId: string) =>
    api.get(`/scans?project_id=${projectId}`),
};

// Exploit generation (Superadmin only)
export const exploitService = {
  generate: (payload: {
    exploit_type: string;
    target_description: string;
    complexity: string;
    project_id: string;
  }) => api.post("/exploits/generate", payload),
};

export default api;