import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

export async function GET() {
  const { getToken, userId } = auth();
  if (!userId) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }
  const token = await getToken();
  if (!token) {
    return NextResponse.json({ error: "No session token" }, { status: 401 });
  }

  try {
    const res = await fetch(`${API_BASE}/api/tiktok/oauth-url`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });
    const data = await res.json().catch(() => ({
      error: "Invalid response from API",
    }));
    if (!res.ok || !data?.url) {
      return NextResponse.json(
        { error: data?.error ?? `HTTP ${res.status}` },
        { status: res.status || 500 }
      );
    }
    return NextResponse.json({ url: data.url });
  } catch (err) {
    console.error("[proxy/tiktok/connect]", err);
    return NextResponse.json(
      { error: "Could not reach TikTok connect service" },
      { status: 500 }
    );
  }
}
