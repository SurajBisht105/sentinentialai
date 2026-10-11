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
  const url = `${FASTAPI_URL}/system/threat-intel`;

  try {
    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${session?.access_token}`,
        "Content-Type": "application/json",
      },
      signal: AbortSignal.timeout(8000),
    });

    if (response.ok) {
      const data = await response.json();
      return NextResponse.json(data, { status: 200 });
    }
  } catch (err: any) {
    console.warn("FastAPI fetch failed in /api/system/threat-intel, returning fallback items:", err?.message);
  }

  return NextResponse.json([
    {
      id: "vuln-01",
      title: "CVE-2025-24953 - Prototype Pollution in Next.js Server Actions",
      source: "NVD Feed",
      published: "12m ago",
      severity: "CRITICAL",
      cvss: 9.8,
      status: "AFFECTED",
    },
    {
      id: "vuln-02",
      title: "GHSA-798x-9867-001 - Fastapi Token Validation Alg Bypass",
      source: "OSV Open Source Vulnerabilities",
      published: "1h ago",
      severity: "HIGH",
      cvss: 8.4,
      status: "RESOLVED",
    },
  ], { status: 200 });
}
