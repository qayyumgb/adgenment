import type { Prisma, WorkspaceRole } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { normalizeRole, type Role } from "../lib/access";
import { emailConfigured, emailLayout, escapeHtml, sendEmail } from "../lib/email";
import { computePacing } from "./pacing.service";
import { changeLog } from "./change-log.service";

/**
 * Email alerts (plan A14; decision: real email for a few events). Advertix
 * checks hourly for things it already knows about: ad-platform access about to
 * expire, accounts that failed to sync, clients pacing ahead of or behind their
 * monthly budget, and a weekly summary on the workspace's first day of the
 * week. Each person picks which ones they get; every alert is logged once per
 * person (NotificationLog), so nobody gets the same email twice. The morning
 * briefing (C12, opt-in) is one email per person per local day from 08:00.
 */

const DAY = 86_400_000;
const FRONTEND_URL = () => process.env.FRONTEND_URL ?? process.env.WEB_ORIGIN ?? "http://localhost:3000";
const PLATFORM_NAME: Record<string, string> = { META: "Meta", GOOGLE: "Google Ads", TIKTOK: "TikTok", LINKEDIN: "LinkedIn" };

export type NotificationEvent = "ACCESS" | "SYNC_FAILED" | "PACING" | "WEEKLY_SUMMARY" | "APPROVALS" | "SAFETY" | "MORNING_BRIEFING";

export const EVENTS: { id: NotificationEvent; label: string; sub: string; roles: Role[] }[] = [
  { id: "ACCESS", label: "Ad platform access", sub: "A connected account's access expires within 7 days, or has expired", roles: ["OWNER", "MEDIA_BUYER"] },
  { id: "SYNC_FAILED", label: "Sync failures", sub: "An ad account couldn't sync its spend and results", roles: ["OWNER", "MEDIA_BUYER"] },
  { id: "PACING", label: "Budget pacing", sub: "A client will run out early or underspend this month", roles: ["OWNER", "MEDIA_BUYER", "ANALYST"] },
  { id: "APPROVALS", label: "Approvals", sub: "A change is waiting for an owner, or a change you asked for was approved or rejected", roles: ["OWNER", "MEDIA_BUYER"] },
  { id: "SAFETY", label: "Automatic changes", sub: "A safety rule or auto-apply changed a campaign on its own (with Undo)", roles: ["OWNER", "MEDIA_BUYER"] },
  { id: "MORNING_BRIEFING", label: "Morning briefing", sub: "Every morning at 08:00: the top decisions for your clients, what changed in the last 24 hours and yesterday's spend", roles: ["OWNER", "MEDIA_BUYER", "ANALYST"] },
  { id: "WEEKLY_SUMMARY", label: "Weekly summary", sub: "Spend and results per client, on the first day of your week at 09:00", roles: ["OWNER", "MEDIA_BUYER", "ANALYST", "CLIENT_VIEWER"] },
];

/** Who gets what unless they change it. The morning briefing (C12) is opt-in. */
const DEFAULT_ON: Record<Role, NotificationEvent[]> = {
  OWNER: ["ACCESS", "SYNC_FAILED", "PACING", "WEEKLY_SUMMARY", "APPROVALS", "SAFETY"],
  MEDIA_BUYER: ["ACCESS", "SYNC_FAILED", "PACING", "WEEKLY_SUMMARY", "APPROVALS", "SAFETY"],
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

export type AlertItem = { key: string; clientId: string | null; line: string };
type Item = AlertItem;

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

/**
 * Send one event to some members right away (approvals, C1), with the same
 * preferences, once-per-item log and layout as the scheduled alerts.
 */
export async function notifyMembers(
  workspaceId: string,
  who: (m: { userId: string; role: Role }) => boolean,
  event: NotificationEvent,
  item: Item,
  subject: string,
  intro: string,
  cta: { label: string; path: string }
) {
  const ms = (await members(workspaceId)).filter(who);
  return deliver(workspaceId, ms, event, [item], () => subject, intro, cta);
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

  const wanting = ms.filter((m) => m.prefs.find((p) => p.id === "MORNING_BRIEFING")?.email);
  const local = localParts(now, ws.timezone);
  if (wanting.length && local.hour >= BRIEFING_FROM && local.hour <= BRIEFING_UNTIL) {
    const data = await briefingData(workspaceId, now, local.date);
    for (const m of wanting) if (await sendBriefing(workspaceId, ws.name, m, data)) sent++;
  }
  return sent;
}

/* ── Morning briefing (C12) ───────────────────────────────────────────────── */

/** Goes out from 08:00 local; until 11:00 a late server still catches up, after that it waits for tomorrow. */
const BRIEFING_FROM = 8;
const BRIEFING_UNTIL = 11;

const money = (n: number, c: string | null) => {
  try {
    return new Intl.NumberFormat("en-US", { style: "currency", currency: c ?? "USD", maximumFractionDigits: 0 }).format(n);
  } catch {
    return String(Math.round(n));
  }
};

type BriefingData = {
  date: string;
  decisions: { clientId: string | null; title: string; reason: string; impact: string | null; client: string | null; path: string }[];
  changes: { clientId: string | null; line: string }[];
  spend: { clientId: string; name: string; spend: number; revenue: number; results: number; currency: string | null }[];
  pending: number;
};

/** Everything the briefing can say for one workspace on local date `date`; each member gets their clients' part. */
async function briefingData(workspaceId: string, now: Date, date: string): Promise<BriefingData> {
  const today = new Date(`${date}T00:00:00Z`);
  const [suggestions, logs, clients, pending] = await Promise.all([
    prisma.suggestion.findMany({
      where: { workspaceId, status: "OPEN", OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] },
      include: { client: { select: { name: true } } },
      orderBy: [{ priority: "asc" }, { createdAt: "desc" }],
      take: 50,
    }),
    changeLog.list(workspaceId, { limit: 100 }),
    prisma.client.findMany({ where: { workspaceId }, select: { id: true, name: true, currency: true, adAccounts: { where: { archivedAt: null }, select: { id: true, currency: true } } } }),
    prisma.approvalRequest.count({ where: { workspaceId, status: "PENDING" } }),
  ]);

  const who = (e: (typeof logs)[number]) =>
    e.actorType === "SYNC" ? "changed on the ad platform" : e.actorType === "AI" ? `Advertix suggestion, ${e.actorName ? `applied by ${escapeHtml(e.actorName)}` : "applied automatically"}` : e.actorType === "RULE" ? "safety rule" : `${escapeHtml(e.actorName ?? "a teammate")}${e.approvalId ? " (approved)" : ""}`;
  const changes = logs
    .filter((e) => e.createdAt.getTime() >= now.getTime() - DAY)
    .map((e) => ({ clientId: e.clientId, line: `<strong>${escapeHtml(e.campaignName)}</strong>: ${escapeHtml(e.summary)} · ${who(e)}` }));

  const spend = [];
  for (const c of clients) {
    const ids = c.adAccounts.map((a) => a.id);
    if (!ids.length) continue;
    const s = await prisma.campaignMetrics.aggregate({ where: { campaign: { adAccountId: { in: ids } }, date: { gte: new Date(today.getTime() - DAY), lt: today } }, _sum: { spend: true, revenue: true, conversions: true } });
    const amount = Number(s._sum.spend ?? 0);
    if (amount > 0) spend.push({ clientId: c.id, name: c.name, spend: amount, revenue: Number(s._sum.revenue ?? 0), results: s._sum.conversions ?? 0, currency: c.currency ?? c.adAccounts[0]?.currency ?? null });
  }
  spend.sort((a, b) => b.spend - a.spend);

  return {
    date,
    decisions: suggestions.map((s) => ({
      clientId: s.clientId,
      title: s.title,
      reason: s.reason,
      impact: s.impact,
      client: s.client?.name ?? null,
      path: s.reviewHref?.startsWith("/") ? s.reviewHref : s.campaignId ? `/campaigns/${s.campaignId}` : "/dashboard",
    })),
    changes,
    spend,
    pending,
  };
}

/** One member's briefing, or null when there's nothing to say. */
function briefingEmail(m: Member, d: BriefingData, workspaceName: string) {
  const url = (path: string) => `${FRONTEND_URL()}${path}`;
  const decisions = d.decisions.filter((s) => visible(m, s.clientId)).slice(0, 3);
  const changes = d.changes.filter((c) => visible(m, c.clientId));
  const spend = d.spend.filter((s) => visible(m, s.clientId));
  const pending = m.role === "OWNER" ? d.pending : 0;
  if (!decisions.length && !changes.length && !spend.length && !pending) return null;

  const h = (t: string) => `<p style="margin:20px 0 8px;font-weight:600;color:#14121f">${t}</p>`;
  const ul = (items: string[]) => `<ul style="margin:0;padding-left:18px">${items.map((i) => `<li style="margin:0 0 8px">${i}</li>`).join("")}</ul>`;
  const parts: string[] = [];
  if (pending) {
    parts.push(`<p style="margin:0;padding:10px 12px;border-radius:10px;background:#fff4e0;color:#14121f"><strong>${pending} change${pending === 1 ? "" : "s"} waiting for your approval.</strong> <a href="${url("/activity")}" style="color:#6448f2">Review</a></p>`);
  }
  if (decisions.length) {
    parts.push(h(`Today's top ${decisions.length === 1 ? "decision" : `${decisions.length} decisions`}`));
    parts.push(
      ul(
        decisions.map(
          (s) =>
            `<a href="${url(s.path)}" style="color:#14121f;font-weight:600">${escapeHtml(s.title)}</a>${s.client ? ` · ${escapeHtml(s.client)}` : ""}${s.impact ? ` · <span style="color:#16794a;font-weight:600">${escapeHtml(s.impact)}</span>` : ""}<br><span>${escapeHtml(s.reason.length > 200 ? `${s.reason.slice(0, 197)}…` : s.reason)}</span>`
        )
      )
    );
  }
  if (changes.length) {
    parts.push(h("What changed in the last 24 hours"));
    parts.push(ul(changes.slice(0, 6).map((c) => c.line)));
    if (changes.length > 6) parts.push(`<p style="margin:0"><a href="${url("/activity")}" style="color:#6448f2">and ${changes.length - 6} more in Activity</a></p>`);
  }
  if (spend.length) {
    parts.push(h("Yesterday"));
    parts.push(
      ul(
        spend.slice(0, 6).map(
          (s) =>
            `<strong>${escapeHtml(s.name)}</strong>: ${money(s.spend, s.currency)} spent · ${s.revenue > 0 ? `${money(s.revenue, s.currency)} revenue (${(s.revenue / s.spend).toFixed(2)}x ROAS)` : `${s.results} result${s.results === 1 ? "" : "s"}`}`
        )
      )
    );
  }

  const n = decisions.length;
  const subject = n ? `Your morning in ${workspaceName}: ${n} decision${n === 1 ? "" : "s"}` : `Your morning in ${workspaceName}`;
  return {
    subject,
    html: emailLayout({
      heading: "Good morning",
      body: `<p style="margin:0 0 4px">Here's where ${escapeHtml(workspaceName)} stands today.</p>${parts.join("")}`,
      cta: { label: "Open Advertix", url: url("/dashboard") },
      footer: `You get this because the morning briefing is on in <a href="${url("/settings?tab=notifications")}" style="color:#6448f2">Settings › Notifications</a>.`,
    }),
  };
}

/** Send a member today's briefing once (logged per local date). `force` skips the once-a-day check (Send me today's briefing). */
async function sendBriefing(workspaceId: string, workspaceName: string, m: Member, d: BriefingData, force = false) {
  const key = `briefing:${d.date}`;
  if (!force && (await prisma.notificationLog.findFirst({ where: { userId: m.userId, event: "MORNING_BRIEFING", key } }))) return false;
  const email = briefingEmail(m, d, workspaceName);
  if (!email) return false;
  const r = await sendEmail(m.email, email.subject, email.html);
  await prisma.notificationLog.create({ data: { workspaceId, userId: m.userId, event: "MORNING_BRIEFING", key: force ? `${key}:now:${Date.now()}` : key, status: r.ok ? "sent" : "failed", error: r.error } });
  return r.ok;
}

/** POST /auth/notifications/briefing: today's briefing to me now, whatever the time or my setting. */
export async function sendBriefingNow(userId: string, workspaceId: string, now = new Date()) {
  const ws = await prisma.workspace.findUniqueOrThrow({ where: { id: workspaceId }, select: { name: true, timezone: true } });
  const m = (await members(workspaceId)).find((x) => x.userId === userId);
  if (!m || m.role === "CLIENT_VIEWER") throw Object.assign(new Error("The morning briefing isn't available for your role."), { status: 403 });
  const d = await briefingData(workspaceId, now, localParts(now, ws.timezone).date);
  if (!briefingEmail(m, d, ws.name)) return { ok: false, empty: true, error: null };
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { email: true } });
  const sent = await sendBriefing(workspaceId, ws.name, { ...m, email: user.email }, d, true);
  return { ok: sent, empty: false, error: sent ? null : "The email didn't send." };
}

/** For tests: the briefing a member would get at `now` (null = nothing to say). */
export async function previewBriefing(workspaceId: string, userId: string, now = new Date()) {
  const ws = await prisma.workspace.findUniqueOrThrow({ where: { id: workspaceId }, select: { name: true, timezone: true } });
  const m = (await members(workspaceId)).find((x) => x.userId === userId);
  if (!m) return null;
  return briefingEmail(m, await briefingData(workspaceId, now, localParts(now, ws.timezone).date), ws.name);
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

