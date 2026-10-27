/**
 * OAuth `state` for the platform connect flows (Meta, Google, TikTok,
 * LinkedIn). The platforms hand `state` back untouched on the redirect, so it
 * carries who started the connect — signed, so it can't be forged for
 * another user, expiring, single-use and tied to one platform.
 *
 * Format: `<base64url(payload)>.<base64url(hmac)>`, payload
 * `{ u: userId, p: platform, n: nonce, e: expiresAtMs }`. The HMAC key is
 * derived from ENCRYPTION_KEY (domain-separated, so it never doubles as the
 * token-encryption key and needs no new env var).
 */

import crypto from "node:crypto";

export type OAuthPlatform = "META" | "GOOGLE" | "TIKTOK" | "LINKEDIN";

/** Long enough for someone to read the consent screen (and an App Review tester to take their time). */
const TTL_MS = 2 * 60 * 60 * 1000;

function key(): Buffer {
  const raw = process.env.ENCRYPTION_KEY;
  if (!raw) throw new Error("ENCRYPTION_KEY is not configured");
  return crypto.createHash("sha256").update(`advertix:oauth-state:v1:${raw}`).digest();
}

const sign = (data: string) => crypto.createHmac("sha256", key()).update(data).digest("base64url");

/** Nonces already used, kept until they'd expire anyway (per server instance). */
const used = new Map<string, number>();
function markUsed(nonce: string, expiresAt: number): boolean {
  const now = Date.now();
  if (used.size > 5000) for (const [n, e] of used) if (e < now) used.delete(n);
  if (used.has(nonce)) return false;
  used.set(nonce, expiresAt);
  return true;
}

export function createOAuthState(userId: string, platform: OAuthPlatform): string {
  const payload = Buffer.from(JSON.stringify({ u: userId, p: platform, n: crypto.randomBytes(16).toString("base64url"), e: Date.now() + TTL_MS })).toString("base64url");
  return `${payload}.${sign(payload)}`;
}

/**
 * The user id the connect belongs to, or null when the state is forged,
 * tampered with, expired, already used or for another platform.
 */
export function verifyOAuthState(state: unknown, platform: OAuthPlatform): string | null {
  if (typeof state !== "string" || !state) return null;
  // The old format (a bare user id) is never accepted: a connect that was
  // mid-flow during the deploy just fails and is started again.
  const dot = state.indexOf(".");
  if (dot < 0) return null;
  const payload = state.slice(0, dot);
  const given = Buffer.from(state.slice(dot + 1));
  const expected = Buffer.from(sign(payload));
  if (given.length !== expected.length || !crypto.timingSafeEqual(given, expected)) return null;
  let data: { u?: unknown; p?: unknown; n?: unknown; e?: unknown };
  try {
    data = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
  } catch {
    return null;
  }
  if (typeof data.u !== "string" || data.p !== platform || typeof data.n !== "string" || typeof data.e !== "number") return null;
  if (data.e < Date.now()) return null;
  if (!markUsed(data.n, data.e)) return null;
  return data.u;
}
