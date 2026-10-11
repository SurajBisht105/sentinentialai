// src/app/(dashboard)/layout.tsx
import type { Metadata } from "next";
import { Sidebar } from "@/components/layout/Sidebar";
import { Header } from "@/components/layout/Header";
import { RoleSync } from "@/components/providers/RoleSync";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

// Block all search engines from indexing any dashboard route
export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();
  const role =
    profile?.role ??
    user.app_metadata?.app_role ??
    user.user_metadata?.app_role;

  return (
    <div className="flex h-screen overflow-hidden bg-sentinel-900 cyber-grid-bg">
      <RoleSync role={role} />
      <Sidebar />
      <div className="flex flex-col flex-1 overflow-hidden">
        <Header user={user} role={role} />
        <main className="flex-1 overflow-y-auto p-6 space-y-6">{children}</main>
      </div>
    </div>
  );
}
