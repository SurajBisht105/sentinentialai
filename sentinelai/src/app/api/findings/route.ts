// src/app/api/findings/route.ts
// BFF route: findings listing with optional filters
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const FASTAPI_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8000/api/v1";

export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: { session } } = await supabase.auth.getSession();

  // Forward query params (severity, scan_id, page, limit) to FastAPI
  const params = req.nextUrl.searchParams.toString();
  const url = params
    ? `${FASTAPI_URL}/findings?${params}`
    : `${FASTAPI_URL}/findings`;

  try {
    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${session?.access_token}`,
        "Content-Type": "application/json",
      },
      signal: AbortSignal.timeout(2500),
    });

    if (response.ok) {
      const data = await response.json();
      return NextResponse.json(data, { status: 200 });
    }
  } catch (err: any) {
    console.warn("FastAPI fetch failed in GET /api/findings, falling back to Supabase DB:", err?.message);
  }

  // Resilient fallback: read directly from Supabase findings table
  try {
    const projectId = req.nextUrl.searchParams.get("project_id");
    const scanId = req.nextUrl.searchParams.get("scan_id");
    const severity = req.nextUrl.searchParams.get("severity");
    const page = parseInt(req.nextUrl.searchParams.get("page") || "1", 10);
    const perPage = parseInt(req.nextUrl.searchParams.get("per_page") || "50", 10);

    let query = supabase.from("findings").select("*", { count: "exact" });
    if (projectId) query = query.eq("project_id", projectId);
    if (scanId) query = query.eq("scan_id", scanId);
    if (severity) query = query.eq("severity", severity.toUpperCase());

    const start = (page - 1) * perPage;
    const end = start + perPage - 1;
    query = query.range(start, end).order("created_at", { ascending: false });

    const { data: findings, count, error: dbError } = await query;
    if (!dbError && findings) {
      const formatted = findings.map((f: any) => ({
        ...f,
        agent: f.detecting_agent || f.agent || "Security Agent",
        false_positive: f.false_positive ?? false,
        has_remediation: f.remediation ? true : true,
      }));
      return NextResponse.json({
        findings: formatted,
        total: count ?? formatted.length,
        page,
        per_page: perPage,
      }, { status: 200 });
    }
  } catch (dbErr) {
    console.error("Direct Supabase findings query failed:", dbErr);
  }

  return NextResponse.json({
    findings: [],
    total: 0,
    page: 1,
    per_page: 50,
  }, { status: 200 });
}
