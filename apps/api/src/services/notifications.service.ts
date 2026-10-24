import type { Prisma, WorkspaceRole } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { normalizeRole, type Role } from "../lib/access";
import { emailConfigured, emailLayout, escapeHtml, sendEmail } from "../lib/email";
import { computePacing } from "./pacing.service";

/**
 * Email alerts (plan A14; decision: real email for a few events). Advertix
 * checks hourly for things it already knows about: ad-platform access about to
 * expire, accounts that failed to sync, clients pacing ahead of or behind their
 * monthly budget, and a weekly summary on the workspace's first day of the
 * week. Each person picks which ones they get; every alert is logged once per
 * person (NotificationLog), so nobody gets the same email twice.
 */

const DAY = 86_400_000;
const FRONTEND_URL = () => process.env.FRONTEND_URL ?? process.env.WEB_ORIGIN ?? "http://localhost:3000";
const PLATFORM_NAME: Record<string, string> = { META: "Meta", GOOGLE: "Google Ads", TIKTOK: "TikTok", LINKEDIN: "LinkedIn" };

export type NotificationEvent = "ACCESS" | "SYNC_FAILED" | "PACING" | "WEEKLY_SUMMARY";

export const EVENTS: { id: NotificationEvent; label: string; sub: string; roles: Role[] }[] = [
  { id: "ACCESS", label: "Ad platform access", sub: "A connected account's access expires within 7 days, or has expired", roles: ["OWNER", "MEDIA_BUYER"] },
  { id: "SYNC_FAILED", label: "Sync failures", sub: "An ad account couldn't sync its spend and results", roles: ["OWNER", "MEDIA_BUYER"] },
  { id: "PACING", label: "Budget pacing", sub: "A client will run out early or underspend this month", roles: ["OWNER", "MEDIA_BUYER", "ANALYST"] },
  { id: "WEEKLY_SUMMARY", label: "Weekly summary", sub: "Spend and results per client, on the first day of your week at 09:00", roles: ["OWNER", "MEDIA_BUYER", "ANALYST", "CLIENT_VIEWER"] },
];

/** Who gets what unless they change it. */
const DEFAULT_ON: Record<Role, NotificationEvent[]> = {
  OWNER: ["ACCESS", "SYNC_FAILED", "PACING", "WEEKLY_SUMMARY"],
  MEDIA_BUYER: ["ACCESS", "SYNC_FAILED", "PACING", "WEEKLY_SUMMARY"],
  ANALYST: ["WEEKLY_SUMMARY"],
  CLIENT_VIEWER: ["WEEKLY_SUMMARY"],
};

export function preferences(role: WorkspaceRole, stored: Prisma.JsonValue | null) {
  const r = normalizeRole(role);
  const saved = stored && typeof stored === "object" && !Array.isArray(stored) ? (stored as Record<string, unknown>) : {};
  return EVENTS.map((e) => {
    const eligible = e.roles.includes(r);
    const email = eligible && (typeof saved[e.id] === "boolean" ? (saved[e.id] as boolean) : DEFAULT_ON[r].includes(e.id));
    return { id: e.id, label: e.label, sub: e.sub, eligible, email };
  });
}

/** GET /auth/notifications: my choices, whether email works, my recent alerts. */
export async function myNotifications(userId: string, workspaceId: string) {
  const member = await prisma.workspaceMember.findUnique({ where: { workspaceId_userId: { workspaceId, userId } } });
  if (!member) throw Object.assign(new Error("Not a member"), { status: 404 });
  const recent = await prisma.notificationLog.findMany({ where: { workspaceId, userId }, orderBy: { createdAt: "desc" }, take: 8 });
  return {
    events: preferences(member.role, member.notifications),
    emailConfigured: emailConfigured(),
    recent: recent.map((r) => ({ event: r.event, status: r.status, error: r.error, createdAt: r.createdAt })),
  };
}

export async function saveNotifications(userId: string, workspaceId: string, prefs: Record<string, unknown>) {
  const member = await prisma.workspaceMember.findUnique({ where: { workspaceId_userId: { workspaceId, userId } } });
  if (!member) throw Object.assign(new Error("Not a member"), { status: 404 });
  const allowed = preferences(member.role, null).filter((e) => e.eligible).map((e) => e.id as string);
  const clean = Object.fromEntries(Object.entries(prefs ?? {}).filter(([k, v]) => allowed.includes(k) && typeof v === "boolean"));
  const merged = { ...((member.notifications as Record<string, boolean> | null) ?? {}), ...clean };
  await prisma.workspaceMember.update({ where: { id: member.id }, data: { notifications: merged as Prisma.InputJsonValue } });
  return myNotifications(userId, workspaceId);
}

export async function sendTestEmail(userId: string, workspaceId: string) {
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
  const ws = await prisma.workspace.findUniqueOrThrow({ where: { id: workspaceId }, select: { name: true } });
  const r = await sendEmail(
    user.email,
    "Advertix test email",
    emailLayout({
      heading: "Your Advertix alerts work",
      body: `<p style="margin:0">This is a test from ${escapeHtml(ws.name)}. Alerts you turn on in Settings › Notifications arrive at this address.</p>`,
      cta: { label: "Notification settings", url: `${FRONTEND_URL()}/settings?tab=notifications` },
    })
  );
  await prisma.notificationLog.create({ data: { workspaceId, userId, event: "TEST", key: `test:${Date.now()}`, status: r.ok ? "sent" : "failed", error: r.error } });
  return r;
}

/* ── Finding alerts ───────────────────────────────────────────────────────── */

type Item = { key: string; clientId: string | null; line: string };

const ymd = (d: Date) => d.toISOString().slice(0, 10);

/** Local date / weekday / hour in a time zone (falls back to UTC). */
function localParts(now: Date, tz: string | null) {
  try {
    const f = new Intl.DateTimeFormat("en-CA", { timeZone: tz || "UTC", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", hourCycle: "h23", weekday: "short" });
    const p = Object.fromEntries(f.formatToParts(now).map((x) => [x.type, x.value]));
    const weekday = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(p.weekday);
    return { date: `${p.year}-${p.month}-${p.day}`, weekday, hour: Number(p.hour) };
  } catch {
    return { date: ymd(now), weekday: now.getUTCDay(), hour: now.getUTCHours() };
  }
}

async function accessItems(workspaceId: string, now: Date): Promise<Item[]> {
  const accounts = await prisma.adAccount.findMany({ where: { workspaceId, archivedAt: null, tokenExpiresAt: { not: null, lt: new Date(now.getTime() + 7 * DAY) } }, include: { client: { select: { name: true } } } });
  return accounts.map((a) => {
    const expired = a.tokenExpiresAt!.getTime() <= now.getTime();
    const days = Math.max(1, Math.ceil((a.tokenExpiresAt!.getTime() - now.getTime()) / DAY));
    const who = `${escapeHtml(a.accountName)}${a.client ? ` (${escapeHtml(a.client.name)})` : ""}`;
    return {
      // One email when it enters the 7-day window, one when it expires.
      key: `${a.id}:${ymd(a.tokenExpiresAt!)}:${expired ? "expired" : "soon"}`,
      clientId: a.clientId,
      line: `${PLATFORM_NAME[a.platform] ?? a.platform} · ${who}: ${expired ? "access has expired, so spend and results stopped syncing" : `access expires in ${days} day${days === 1 ? "" : "s"}`}`,
    };
  });
}

async function syncItems(workspaceId: string, now: Date): Promise<Item[]> {
  const accounts = await prisma.adAccount.findMany({ where: { workspaceId, archivedAt: null, lastSyncError: { not: null }, lastSyncErrorAt: { gte: new Date(now.getTime() - DAY) } }, include: { client: { select: { name: true } } } });
  return accounts.map((a) => ({
    key: `${a.id}:${ymd(a.lastSyncErrorAt!)}`,
    clientId: a.clientId,
    line: `${PLATFORM_NAME[a.platform] ?? a.platform} · ${escapeHtml(a.accountName)}${a.client ? ` (${escapeHtml(a.client.name)})` : ""}: ${escapeHtml((a.lastSyncError ?? "").slice(0, 200))}`,
  }));
}

async function pacingItems(workspaceId: string, now: Date): Promise<Item[]> {
  // Too early in the month for a projection worth emailing about.
  if (now.getUTCDate() < 5) return [];
  const p = await computePacing(workspaceId, null, undefined, now);
  const money = (n: number, c: string | null) => {
    try {
      return new Intl.NumberFormat("en-US", { style: "currency", currency: c ?? "USD", maximumFractionDigits: 0 }).format(n);
    } catch {
      return String(Math.round(n));
    }
  };
  return p.clients
    .filter((c) => c.status === "AHEAD" || c.status === "BEHIND")
    .map((c) => ({
      key: `${c.clientId}:${p.month}:${c.status}`,
      clientId: c.clientId,
      line:
        c.status === "AHEAD"
          ? `${escapeHtml(c.name)}: on pace to spend ${money(c.projected, c.currency)} of ${money(c.monthlyBudget!, c.currency)}${c.runOutDay ? `, running out around day ${c.runOutDay}` : ""}`
          : `${escapeHtml(c.name)}: on pace to spend ${money(c.projected, c.currency)} of ${money(c.monthlyBudget!, c.currency)}, leaving ${money(c.unspentProjected ?? 0, c.currency)} unspent`,
    }));
}

/** Last 7 days vs the 7 before, per client. Key = the local date of this week's first day. */
async function weeklyItems(workspaceId: string, now: Date, tz: string | null, weekStartsOn: number): Promise<{ key: string; rows: { clientId: string | null; name: string; spend: number; value: number; prevSpend: number; prevValue: number; revenue: boolean; currency: string | null }[] } | null> {
  const local = localParts(now, tz);
  if (local.weekday !== weekStartsOn || local.hour < 9) return null;
  const today = new Date(`${local.date}T00:00:00Z`);
  const clients = await prisma.client.findMany({ where: { workspaceId }, select: { id: true, name: true, currency: true, adAccounts: { where: { archivedAt: null }, select: { id: true, currency: true } } } });
  const rows = [];
  for (const c of clients) {
    const ids = c.adAccounts.map((a) => a.id);
    if (!ids.length) continue;
    const sum = async (from: number, to: number) =>
      prisma.campaignMetrics.aggregate({ where: { campaign: { adAccountId: { in: ids } }, date: { gte: new Date(today.getTime() - from * DAY), lt: new Date(today.getTime() - to * DAY) } }, _sum: { spend: true, revenue: true, conversions: true } });
    const [cur, prev] = await Promise.all([sum(7, 0), sum(14, 7)]);
    const spend = Number(cur._sum.spend ?? 0);
    const prevSpend = Number(prev._sum.spend ?? 0);
    if (!spend && !prevSpend) continue;
    const revenue = Number(cur._sum.revenue ?? 0) > 0 || Number(prev._sum.revenue ?? 0) > 0;
    rows.push({
      clientId: c.id,
      name: c.name,
      spend,
      prevSpend,
      value: revenue ? Number(cur._sum.revenue ?? 0) : cur._sum.conversions ?? 0,
      prevValue: revenue ? Number(prev._sum.revenue ?? 0) : prev._sum.conversions ?? 0,
      revenue,
      currency: c.currency ?? c.adAccounts[0]?.currency ?? null,
    });
  }
  return rows.length ? { key: local.date, rows } : null;
}

/* ── Sending ──────────────────────────────────────────────────────────────── */

type Member = { userId: string; email: string; role: Role; clientIds: string[] | null; prefs: ReturnType<typeof preferences> };

async function members(workspaceId: string): Promise<Member[]> {
  const rows = await prisma.workspaceMember.findMany({ where: { workspaceId }, include: { user: { select: { email: true } }, clientAccess: { select: { clientId: true } } } });
  return rows.map((m) => ({
    userId: m.userId,
    email: m.user.email,
    role: normalizeRole(m.role),
    clientIds: m.clientAccess.length ? m.clientAccess.map((x) => x.clientId) : normalizeRole(m.role) === "CLIENT_VIEWER" ? [] : null,
    prefs: preferences(m.role, m.notifications),
  }));
}

const visible = (m: Member, clientId: string | null) => !m.clientIds || (clientId !== null && m.clientIds.includes(clientId));

/** Send each member the items they haven't had yet; log every item once per member. */
async function deliver(workspaceId: string, ms: Member[], event: NotificationEvent, items: Item[], subject: (n: number) => string, intro: string, cta: { label: string; path: string }) {
  let sent = 0;
  for (const m of ms) {
    if (!m.prefs.find((p) => p.id === event)?.email) continue;
    const mine = items.filter((i) => visible(m, i.clientId));
    if (!mine.length) continue;
    const already = new Set((await prisma.notificationLog.findMany({ where: { userId: m.userId, event, key: { in: mine.map((i) => i.key) } }, select: { key: true } })).map((r) => r.key));
    const fresh = mine.filter((i) => !already.has(i.key));
    if (!fresh.length) continue;
    const r = await sendEmail(
      m.email,
      subject(fresh.length),
      emailLayout({
        heading: subject(fresh.length),
        body: `<p style="margin:0 0 10px">${intro}</p><ul style="margin:0;padding-left:18px">${fresh.map((i) => `<li style="margin:0 0 6px">${i.line}</li>`).join("")}</ul>`,
        cta: { label: cta.label, url: `${FRONTEND_URL()}${cta.path}` },
        footer: `You get these because they're on in <a href="${FRONTEND_URL()}/settings?tab=notifications" style="color:#6448f2">Settings › Notifications</a>.`,
      })
    );
    await prisma.notificationLog.createMany({ data: fresh.map((i) => ({ workspaceId, userId: m.userId, event, key: i.key, status: r.ok ? "sent" : "failed", error: r.error })), skipDuplicates: true });
    if (r.ok) sent++;
  }
  return sent;
}

/** One pass over a workspace: find and send everything due. Returns the number of emails sent. */
export async function runWorkspaceAlerts(workspaceId: string, now = new Date()) {
  const ws = await prisma.workspace.findUniqueOrThrow({ where: { id: workspaceId }, select: { name: true, timezone: true, weekStartsOn: true } });
  const ms = await members(workspaceId);
  let sent = 0;
  const name = escapeHtml(ws.name);
  sent += await deliver(workspaceId, ms, "ACCESS", await accessItems(workspaceId, now), (n) => (n === 1 ? "Ad platform access needs renewing" : `${n} ad accounts need their access renewed`), `Renew access in ${name} so spend and results keep syncing:`, { label: "Open Connections", path: "/connections?filter=attention" });
  sent += await deliver(workspaceId, ms, "SYNC_FAILED", await syncItems(workspaceId, now), (n) => (n === 1 ? "An ad account didn't sync" : `${n} ad accounts didn't sync`), `These accounts in ${name} couldn't sync their latest spend and results:`, { label: "Open Connections", path: "/connections" });
  sent += await deliver(workspaceId, ms, "PACING", await pacingItems(workspaceId, now), (n) => (n === 1 ? "A client is off pace this month" : `${n} clients are off pace this month`), `Monthly budget pacing in ${name}:`, { label: "Open Budgets", path: "/budgets" });

  const weekly = await weeklyItems(workspaceId, now, ws.timezone, ws.weekStartsOn);
  if (weekly) {
    const fmt = (n: number, c: string | null) => {
      try {
        return new Intl.NumberFormat("en-US", { style: "currency", currency: c ?? "USD", maximumFractionDigits: 0 }).format(n);
      } catch {
        return String(Math.round(n));
      }
    };
    const delta = (a: number, b: number) => (b > 0 ? ` (${a >= b ? "+" : ""}${Math.round(((a - b) / b) * 100)}%)` : "");
    const items: Item[] = weekly.rows.map((r) => ({
      key: `${weekly.key}:${r.clientId}`,
      clientId: r.clientId,
      line: `<strong>${escapeHtml(r.name)}</strong>: ${fmt(r.spend, r.currency)} spent${delta(r.spend, r.prevSpend)} · ${r.revenue ? `${fmt(r.value, r.currency)} revenue${delta(r.value, r.prevValue)}${r.spend > 0 ? ` · ${(r.value / r.spend).toFixed(2)}x ROAS` : ""}` : `${Math.round(r.value)} results${delta(r.value, r.prevValue)}`}`,
    }));
    sent += await deliver(workspaceId, ms, "WEEKLY_SUMMARY", items, () => `Your week in ${ws.name}`, "The last 7 days, compared with the 7 before:", { label: "Open Analytics", path: "/analytics" });
  }
  return sent;
}

/* ── Scheduler ────────────────────────────────────────────────────────────── */

let handle: NodeJS.Timeout | null = null;
let running = false;

async function tick() {
  if (running || !emailConfigured()) return;
  running = true;
  try {
    const workspaces = await prisma.workspace.findMany({ select: { id: true } });
    for (const w of workspaces) {
      try {
        await runWorkspaceAlerts(w.id);
      } catch (err) {
        console.error("[alerts] workspace", w.id, err instanceof Error ? err.message : err);
      }
    }
  } finally {
    running = false;
  }
}

/** Hourly alert checks. Disable with NOTIFICATIONS_ENABLED=false; nothing is sent without RESEND_API_KEY. */
export function startNotificationScheduler() {
  if ((process.env.NOTIFICATIONS_ENABLED ?? "true").toLowerCase() === "false" || handle) return;
  setTimeout(() => {
    void tick();
    handle = setInterval(() => void tick(), 60 * 60 * 1000);
  }, 120_000);
  console.log("[alerts] email alerts scheduled hourly");
}

