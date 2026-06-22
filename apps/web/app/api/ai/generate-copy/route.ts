import { NextResponse } from "next/server";

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

export async function POST(request: Request) {
  let body: {
    brief?: unknown;
    platform?: unknown;
    objective?: unknown;
    kind?: unknown;
    cardCount?: unknown;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const { brief, platform, objective, kind, cardCount } = body;
  if (typeof brief !== "string" || brief.trim().length < 10) {
    return NextResponse.json(
      { error: "Brief must be at least 10 characters." },
      { status: 400 }
    );
  }
  if (typeof platform !== "string" || !platform.trim()) {
    return NextResponse.json(
      { error: "Platform is required." },
      { status: 400 }
    );
  }
  if (typeof objective !== "string" || !objective.trim()) {
    return NextResponse.json(
      { error: "Objective is required." },
      { status: 400 }
    );
  }

  try {
    const upstream = await fetch(`${API_BASE}/api/ai/generate-copy`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        brief,
        platform,
        objective,
        ...(typeof kind === "string" ? { kind } : {}),
        ...(typeof cardCount === "number" ? { cardCount } : {}),
      }),
      cache: "no-store",
    });

    const data = await upstream.json().catch(() => ({
      error: "Backend returned an invalid response.",
    }));

    return NextResponse.json(data, { status: upstream.status });
  } catch (err) {
    console.error("[proxy/generate-copy]", err);
    return NextResponse.json(
      { error: "Could not reach AI service. Is the API server running?" },
      { status: 500 }
    );
  }
}
