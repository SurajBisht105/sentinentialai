import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const FASTAPI_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8000/api/v1";

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: { session } } = await supabase.auth.getSession();
  const body = await req.json();

  try {
    const response = await fetch(`${FASTAPI_URL}/integrations/${id}`, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${session?.access_token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    const data = await response.json();
    return NextResponse.json(data, { status: response.status });
  } catch (err: any) {
    console.error(`FastAPI fetch failed in PUT /api/integrations/${id}:`, err);
    return NextResponse.json(
      { error: "Backend service unavailable", details: err.message },
      { status: 503 }
    );
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: { session } } = await supabase.auth.getSession();

  try {
    const response = await fetch(`${FASTAPI_URL}/integrations/${id}`, {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${session?.access_token}`,
        "Content-Type": "application/json",
      },
    });

    const data = await response.json();
    return NextResponse.json(data, { status: response.status });
  } catch (err: any) {
    console.error(`FastAPI fetch failed in DELETE /api/integrations/${id}:`, err);
    return NextResponse.json(
      { error: "Backend service unavailable", details: err.message },
      { status: 503 }
    );
  }
}
