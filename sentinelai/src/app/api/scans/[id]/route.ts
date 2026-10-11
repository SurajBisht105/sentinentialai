import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const FASTAPI_URL =
  process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8000/api/v1";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const {
    data: { session },
  } = await supabase.auth.getSession();
  const { id } = await params;

  try {
    const response = await fetch(`${FASTAPI_URL}/scans/${id}/cancel`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${session?.access_token}`,
        "Content-Type": "application/json",
      },
    });
    const data = await response.json();
    return NextResponse.json(data, { status: response.status });
  } catch (err: unknown) {
    return NextResponse.json(
      {
        error: "Backend service unavailable",
        details: err instanceof Error ? err.message : "Unknown error",
      },
      { status: 503 },
    );
  }
}
