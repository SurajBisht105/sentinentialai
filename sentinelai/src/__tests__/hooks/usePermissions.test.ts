// src/__tests__/hooks/usePermissions.test.ts
import { describe, it, expect, beforeEach, vi } from "vitest";
import { renderHook } from "@testing-library/react";
import { usePermissions } from "@/hooks/usePermissions";
import { useAppStore } from "@/store";
import type { AppRole } from "@/types";

// Mock the Zustand store
vi.mock("@/store", () => ({
  useAppStore: vi.fn(),
}));

const mockUseAppStore = vi.mocked(useAppStore);

function setupRole(role: AppRole | null) {
  mockUseAppStore.mockImplementation((selector: any) =>
    selector({ userRole: role })
  );
}

describe("usePermissions", () => {
  describe("Viewer role", () => {
    beforeEach(() => setupRole("Viewer"));

    it("should not be Superadmin", () => {
      const { result } = renderHook(() => usePermissions());
      expect(result.current.isSuperadmin).toBe(false);
    });

    it("should not be able to view exploits", () => {
      const { result } = renderHook(() => usePermissions());
      expect(result.current.canViewExploits).toBe(false);
    });

    it("should not be able to trigger scans", () => {
      const { result } = renderHook(() => usePermissions());
      expect(result.current.canTriggerScans).toBe(false);
    });
  });

  describe("Engineer role", () => {
    beforeEach(() => setupRole("Engineer"));

    it("should be able to trigger scans", () => {
      const { result } = renderHook(() => usePermissions());
      expect(result.current.canTriggerScans).toBe(true);
    });

    it("should not be able to view exploits", () => {
      const { result } = renderHook(() => usePermissions());
      expect(result.current.canViewExploits).toBe(false);
    });

    it("should not be CISO", () => {
      const { result } = renderHook(() => usePermissions());
      expect(result.current.isCISO).toBe(false);
    });
  });

  describe("CISO role", () => {
    beforeEach(() => setupRole("CISO"));

    it("should be able to view compliance", () => {
      const { result } = renderHook(() => usePermissions());
      expect(result.current.canViewCompliance).toBe(true);
    });

    it("should be able to manage settings", () => {
      const { result } = renderHook(() => usePermissions());
      expect(result.current.canManageSettings).toBe(true);
    });

    it("should not be able to view exploits", () => {
      const { result } = renderHook(() => usePermissions());
      expect(result.current.canViewExploits).toBe(false);
    });
  });

  describe("Superadmin role", () => {
    beforeEach(() => setupRole("Superadmin"));

    it("should be Superadmin", () => {
      const { result } = renderHook(() => usePermissions());
      expect(result.current.isSuperadmin).toBe(true);
    });

    it("should be able to view exploits", () => {
      const { result } = renderHook(() => usePermissions());
      expect(result.current.canViewExploits).toBe(true);
    });

    it("should pass hasRole check for all roles", () => {
      const { result } = renderHook(() => usePermissions());
      expect(result.current.hasRole("Viewer")).toBe(true);
      expect(result.current.hasRole("Engineer")).toBe(true);
      expect(result.current.hasRole("CISO")).toBe(true);
      expect(result.current.hasRole("Superadmin")).toBe(true);
    });
  });

  describe("Unauthenticated (null role)", () => {
    beforeEach(() => setupRole(null));

    it("should deny all permissions", () => {
      const { result } = renderHook(() => usePermissions());
      expect(result.current.isSuperadmin).toBe(false);
      expect(result.current.isCISO).toBe(false);
      expect(result.current.canTriggerScans).toBe(false);
      expect(result.current.canViewExploits).toBe(false);
    });
  });
});
