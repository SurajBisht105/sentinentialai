"use client";

import { useEffect } from "react";
import { useAppStore } from "@/store";
import type { AppRole } from "@/types";

const APP_ROLES: AppRole[] = ["Viewer", "Engineer", "CISO", "Superadmin"];

function asAppRole(value: unknown): AppRole | null {
  return typeof value === "string" && APP_ROLES.includes(value as AppRole)
    ? (value as AppRole)
    : null;
}

export function RoleSync({ role }: { role: unknown }) {
  const setUserRole = useAppStore((state) => state.setUserRole);

  useEffect(() => {
    setUserRole(asAppRole(role));
  }, [role, setUserRole]);

  return null;
}
