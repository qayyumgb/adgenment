import { NextResponse } from "next/server";

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

/**
 * Thin proxy to the API's planner endpoint.
 *
 * The upstream route is authenticated (it reads the workspace's real currency,
 * budget floor and pixel state to ground the advice), so the caller's bearer
 * token has to be forwarded. The dashboard calls the API directly via
 * `useApiClient().planCampaign` — this proxy stays for any caller that would
 * rather go through the Next origin.
 */
export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const auth = request.headers.get("authorization");
  if (!auth) {
    return NextResponse.json(
      { error: "Sign in to use the AI planner." },
      { status: 401 }
    );
  }

  try {
    const upstream = await fetch(`${API_BASE}/api/ai/plan-campaign`, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: auth },
      body: JSON.stringify(body),
      cache: "no-store",
    });

    const data = await upstream.json().catch(() => ({
      error: "Backend returned an invalid response.",
    }));

    return NextResponse.json(data, { status: upstream.status });
  } catch {
    return NextResponse.json(
      { error: "Could not reach the AI service. Is the API server running?" },
      { status: 502 }
    );
  }
}
