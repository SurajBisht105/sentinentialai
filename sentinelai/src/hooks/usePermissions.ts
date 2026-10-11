// src/hooks/usePermissions.ts
import { useAppStore } from "@/store";
import { AppRole } from "@/types";

const ROLE_HIERARCHY: Record<AppRole, number> = {
  Viewer: 1,
  Engineer: 2,
  CISO: 3,
  Superadmin: 4,
};

export function usePermissions() {
  const userRole = useAppStore((state) => state.userRole);

  const hasRole = (requiredRole: AppRole): boolean => {
    if (!userRole) return false;
    return ROLE_HIERARCHY[userRole] >= ROLE_HIERARCHY[requiredRole];
  };

  const isSuperadmin = userRole === "Superadmin";
  const isCISO = hasRole("CISO");
  const isEngineer = hasRole("Engineer");

  const canViewExploits = isSuperadmin;
  const canTriggerScans = isEngineer;
  const canViewCompliance = isCISO;
  const canManageSettings = isCISO;

  return {
    userRole,
    hasRole,
    isSuperadmin,
    isCISO,
    isEngineer,
    canViewExploits,
    canTriggerScans,
    canViewCompliance,
    canManageSettings,
  };
}