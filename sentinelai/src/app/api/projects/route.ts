// src/app/api/projects/route.ts
// BFF route: project CRUD proxied to FastAPI
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const FASTAPI_URL =
  process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8000/api/v1";

export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const authorization = req.headers.get("authorization");
  const token = authorization?.startsWith("Bearer ")
    ? authorization.slice("Bearer ".length)
    : undefined;
  const {
    data: { user },
    error,
  } = token
    ? await supabase.auth.getUser(token)
    : await supabase.auth.getUser();
  if (error || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const {
    data: { session },
  } = await supabase.auth.getSession();
  const accessToken = token ?? session?.access_token;

  try {
    const response = await fetch(`${FASTAPI_URL}/projects/`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      signal: AbortSignal.timeout(2500),
    });

    if (response.ok) {
      const data = await response.json();
      return NextResponse.json(data, { status: 200 });
    }
  } catch (err: unknown) {
    console.warn("FastAPI GET /projects unavailable or timed out, falling back to direct Supabase query:", err instanceof Error ? err.message : "error");
  }

  // Resilient fallback: read directly from Supabase projects table
  try {
    const { data: projects, error: dbError } = await supabase
      .from("projects")
      .select("*")
      .order("created_at", { ascending: false });

    if (!dbError && projects) {
      const transformed = projects.map((p: any) => ({
        id: p.id,
        tenant_id: p.tenant_id,
        name: p.name || "Project",
        description: p.description || `Repository ${p.name}`,
        status: p.status || "active",
        repo_url: p.repo_url || "",
        branch: p.default_branch || "main",
        language: p.primary_language || "TypeScript",
        created_at: p.created_at || new Date().toISOString(),
        updated_at: p.updated_at || p.created_at || new Date().toISOString(),
        scan_count: p.total_scans || p.scan_count || 0,
        finding_count: p.total_findings || 0,
        risk_score: p.risk_score || 0,
        trend: "stable",
      }));
      return NextResponse.json(transformed, { status: 200 });
    }
  } catch (dbFallbackErr) {
    console.error("Direct Supabase projects fallback failed:", dbFallbackErr);
  }

  return NextResponse.json([], { status: 200 });
}

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const authorization = req.headers.get("authorization");
  const token = authorization?.startsWith("Bearer ")
    ? authorization.slice("Bearer ".length)
    : undefined;
  const {
    data: { user },
    error,
  } = token
    ? await supabase.auth.getUser(token)
    : await supabase.auth.getUser();
  if (error || !user) {
    console.error("Supabase auth failed:", error);
    return NextResponse.json(
      { error: "Unauthorized from Supabase" },
      { status: 401 },
    );
  }

  const {
    data: { session },
  } = await supabase.auth.getSession();
  const accessToken = token ?? session?.access_token;
  const body = await req.json();

  try {
    const response = await fetch(`${FASTAPI_URL}/projects/`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(2500),
      cache: "no-store",
    });

    if (response.ok) {
      const data = await response.json();
      return NextResponse.json(data, { status: response.status });
    }
  } catch (err: unknown) {
    console.warn("FastAPI POST /projects unavailable or slow, creating in Supabase directly:", err instanceof Error ? err.message : "error");
  }

  // Resilient fallback: create directly in Supabase
  try {
    let repoUrl = (body.repo_url || "").trim();
    if (!repoUrl.startsWith("http://") && !repoUrl.startsWith("https://")) {
      repoUrl = `https://github.com/local/${repoUrl.replace(/[^a-zA-Z0-9-_.]/g, "-") || "project"}`;
    }

    const tenantId = user.user_metadata?.tenant_id || "00000000-0000-0000-0000-000000000001";
    const newProject = {
      id: crypto.randomUUID(),
      tenant_id: tenantId,
      created_by: user.id,
      name: body.name || "Project",
      description: body.description || `Repository ${body.name || "Project"}`,
      repo_url: repoUrl,
      repo_type: "GITHUB",
      default_branch: body.branch || "main",
      primary_language: body.language || "TypeScript",
      risk_score: 0,
      total_scans: 0,
      total_findings: 0,
      open_findings: 0,
      critical_findings: 0,
      created_at: new Date().toISOString(),
    };

    const { data: created, error: createErr } = await supabase
      .from("projects")
      .insert(newProject)
      .select()
      .maybeSingle();

    if (!createErr && created) {
      return NextResponse.json({
        id: created.id,
        tenant_id: created.tenant_id,
        name: created.name,
        description: created.description || `Repository ${created.name}`,
        status: "active",
        repo_url: created.repo_url || repoUrl,
        branch: created.default_branch || "main",
        language: created.primary_language || "TypeScript",
        created_at: created.created_at,
        updated_at: created.updated_at || created.created_at,
        scan_count: 0,
        finding_count: 0,
        risk_score: 0,
        trend: "stable",
      }, { status: 201 });
    }
    if (createErr) {
      console.error("Supabase insert error details:", createErr);
    }
  } catch (dbErr) {
    console.error("Direct Supabase project creation failed:", dbErr);
  }

  return NextResponse.json(
    { error: "Failed to create project" },
    { status: 500 },
  );
}
