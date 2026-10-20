import { NextResponse, type NextRequest } from "next/server";

/**
 * POST /api/contact — marketing contact form ("Send a message") and the
 * demo-request fallback used when no Cal.com link is configured.
 *
 * Sends one email through Resend's REST API (no SDK). Env:
 *   RESEND_API_KEY  required; without it the route answers 503
 *   CONTACT_TO      inbox that receives submissions (default support@advertix.io)
 *   CONTACT_FROM    verified Resend sender, e.g. "Advertix <noreply@advertix.io>"
 *
 * Abuse protection: a honeypot field, server-side validation and a small
 * per-IP rate limit (per server instance — good enough for a contact form).
 */

const WINDOW_MS = 10 * 60 * 1000;
const MAX_PER_WINDOW = 5;
const hits = new Map<string, number[]>();

function rateLimited(ip: string) {
  const now = Date.now();
  const recent = (hits.get(ip) ?? []).filter((t) => now - t < WINDOW_MS);
  recent.push(now);
  hits.set(ip, recent);
  if (hits.size > 5000) hits.clear(); // keep memory bounded
  return recent.length > MAX_PER_WINDOW;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const TOPICS = ["Question", "Billing", "Bug report", "Partnership"];
const SPENDS = ["Under $10k", "$10k–$50k", "$50k–$250k", "$250k+"];

/** Trim, cap length and strip line breaks (for single-line fields). */
const line = (v: unknown, max: number) =>
  typeof v === "string" ? v.replace(/[\r\n]+/g, " ").trim().slice(0, max) : "";

export async function POST(req: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  // Honeypot: real visitors never see or fill this field.
  if (line(body.website, 200)) return NextResponse.json({ ok: true });

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  if (rateLimited(ip)) {
    return NextResponse.json({ error: "Too many messages. Please try again in a few minutes." }, { status: 429 });
  }

  const kind = body.kind === "demo" ? "demo" : "message";
  const name = line(body.name, 120);
  const email = line(body.email, 200);
  const company = line(body.company, 160);
  const topic = TOPICS.includes(line(body.topic, 40)) ? line(body.topic, 40) : "Question";
  const spend = SPENDS.includes(line(body.spend, 40)) ? line(body.spend, 40) : "";
  const day = line(body.day, 60);
  const slot = line(body.slot, 20);
  const message = typeof body.message === "string" ? body.message.trim().slice(0, 5000) : "";

  if (!EMAIL_RE.test(email)) {
    return NextResponse.json({ error: "Please enter a valid email address." }, { status: 400 });
  }
  if (kind === "message" && message.length < 4) {
    return NextResponse.json({ error: "Please write a short message." }, { status: 400 });
  }
  if (kind === "demo" && (!day || !slot)) {
    return NextResponse.json({ error: "Please pick a day and time." }, { status: 400 });
  }

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.error("[contact] RESEND_API_KEY is not set — submission not sent");
    return NextResponse.json(
      { error: "The contact form isn’t available right now. Please email support@advertix.io." },
      { status: 503 }
    );
  }

  const subject =
    kind === "demo"
      ? `Demo request: ${company || name || email} · ${day} ${slot}`
      : `[${topic}] ${name || email}`;
  const text = [
    kind === "demo" ? "New demo request from advertix.io" : "New message from advertix.io",
    "",
    `Name:    ${name || "—"}`,
    `Email:   ${email}`,
    company ? `Company: ${company}` : null,
    kind === "demo" ? `Wants:   ${day}, ${slot} (preferred)` : null,
    spend ? `Spend:   ${spend} / month` : null,
    kind === "message" ? `Topic:   ${topic}` : null,
    "",
    message || null,
  ]
    .filter((l) => l !== null)
    .join("\n");

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: process.env.CONTACT_FROM || "Advertix Website <onboarding@resend.dev>",
        to: [process.env.CONTACT_TO || "support@advertix.io"],
        reply_to: email,
        subject: subject.slice(0, 200),
        text,
      }),
    });
    if (!res.ok) {
      console.error("[contact] Resend error", res.status, await res.text().catch(() => ""));
      return NextResponse.json({ error: "We couldn’t send that. Please try again or email us." }, { status: 502 });
    }
  } catch (err) {
    console.error("[contact] Resend request failed", err);
    return NextResponse.json({ error: "We couldn’t send that. Please try again or email us." }, { status: 502 });
  }

  return NextResponse.json({ ok: true });
}
