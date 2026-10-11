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

  try {
    const response = await fetch(`${FASTAPI_URL}/integrations`, {
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
    console.warn("FastAPI fetch failed in GET /api/integrations, checking Supabase DB:", err?.message);
  }

  try {
    const { data: dbIntegrations, error: dbErr } = await supabase
      .from("integrations")
      .select("*");

    if (!dbErr && dbIntegrations) {
      return NextResponse.json(dbIntegrations, { status: 200 });
    }
  } catch (dbError) {
    console.error("Direct Supabase integrations query failed:", dbError);
  }

  return NextResponse.json([], { status: 200 });
}

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: { session } } = await supabase.auth.getSession();
  const body = await req.json();

  try {
    const response = await fetch(`${FASTAPI_URL}/integrations`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${session?.access_token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    const data = await response.json();
    return NextResponse.json(data, { status: response.status });
  } catch (err: any) {
    console.error("FastAPI fetch failed in POST /api/integrations:", err);
    return NextResponse.json(
      { error: "Backend service unavailable", details: err.message },
      { status: 503 }
    );
  }
}
