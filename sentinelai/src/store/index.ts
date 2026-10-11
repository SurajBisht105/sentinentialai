// src/store/index.ts
import { create } from "zustand";
import { persist, subscribeWithSelector } from "zustand/middleware";
import { User, Project, AppRole } from "@/types";

interface AppState {
  // User & Auth
  user: User | null;
  userRole: AppRole | null;
  setUser: (user: User | null) => void;
  setUserRole: (role: AppRole | null) => void;

  // Active Project Context
  activeProject: Project | null;
  setActiveProject: (project: Project | null) => void;

  // UI State
  sidebarCollapsed: boolean;
  toggleSidebar: () => void;
  setSidebarCollapsed: (collapsed: boolean) => void;

  // Active Scan IDs being tracked in real-time
  activeScanIds: string[];
  addActiveScanId: (id: string) => void;
  removeActiveScanId: (id: string) => void;

  // Notifications count
  unreadNotifications: number;
  setUnreadNotifications: (count: number) => void;

  // Theme
  theme: "dark" | "light";
  setTheme: (theme: "dark" | "light") => void;

  // Terminal/Agent Trace view
  activeTraceId: string | null;
  setActiveTraceId: (id: string | null) => void;
}

export const useAppStore = create<AppState>()(
  persist(
    subscribeWithSelector((set) => ({
      user: null,
      userRole: null,
      setUser: (user) => set({ user, userRole: user?.role ?? null }),
      setUserRole: (userRole) => set({ userRole }),

      activeProject: null,
      setActiveProject: (project) => set({ activeProject: project }),

      sidebarCollapsed: false,
      toggleSidebar: () =>
        set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),
      setSidebarCollapsed: (collapsed) => set({ sidebarCollapsed: collapsed }),

      activeScanIds: [],
      addActiveScanId: (id) =>
        set((state) => ({
          activeScanIds: [...state.activeScanIds, id],
        })),
      removeActiveScanId: (id) =>
        set((state) => ({
          activeScanIds: state.activeScanIds.filter((sid) => sid !== id),
        })),

      unreadNotifications: 0,
      setUnreadNotifications: (count) => set({ unreadNotifications: count }),

      theme: "dark",
      setTheme: (theme) => set({ theme }),

      activeTraceId: null,
      setActiveTraceId: (id) => set({ activeTraceId: id }),
    })),
    {
      name: "sentinel-app-store",
      partialize: (state) => ({
        sidebarCollapsed: state.sidebarCollapsed,
        theme: state.theme,
        activeProject: state.activeProject,
      }),
    },
  ),
);
