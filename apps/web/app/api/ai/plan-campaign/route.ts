import { NextResponse } from "next/server";

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

export async function POST(request: Request) {
  let body: { prompt?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const prompt = body?.prompt;
  if (typeof prompt !== "string" || prompt.trim().length < 10) {
    return NextResponse.json(
      { error: "Prompt must be at least 10 characters." },
      { status: 400 }
    );
  }

  try {
    const upstream = await fetch(`${API_BASE}/api/ai/plan-campaign`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ prompt }),
      cache: "no-store",
    });

    const data = await upstream.json().catch(() => ({
      error: "Backend returned an invalid response.",
    }));

    return NextResponse.json(data, { status: upstream.status });
  } catch (err) {
    console.error("[proxy/plan-campaign]", err);
    return NextResponse.json(
      { error: "Could not reach AI service. Is the API server running?" },
      { status: 500 }
    );
  }
}
