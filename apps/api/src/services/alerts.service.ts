import type { AlertSeverity, Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma";
import type { Access } from "../lib/access";
import { accountStatus } from "./connections.service";
import { computePacing } from "./pacing.service";
import { changeLog } from "./change-log.service";
import { localParts } from "./notifications.service";
import { trialReminders } from "./billing.service";
import { emailConfigured } from "../lib/email";

/**
 * Alerts inbox (plan C2). An engine turns what Advertix already stores into
 * alerts, one row per condition (dedupeKey): it stays open while the condition
 * holds, resolves on its own when it clears, and reopens if it comes back.
 * Reads stored data only (no platform calls), so it is cheap to run hourly and
 * when someone opens the inbox.
 *
 *  - ACCESS / ACCOUNT: the Connections status (expired or expiring access,
 *    blocked account, pixel issue).
 *  - SYNC_FAILED: an account whose last sync failed (within a day).
 *  - PACING: a client on pace to overspend or underspend its monthly budget.
 *  - CPA_SPIKE: yesterday's cost per conversion ≥ 1.5× the 7 days before (or
 *    spend with no conversions), for campaigns with enough history.
 *  - TRACKING: an account spent yesterday with no conversions after a normal
 *    week, which usually means tracking broke.
 *  - AUTOMATION: what auto-apply and safety rules did in the last 24 hours (Undo).
 */

const DAY = 86_400_000;
const PLATFORM: Record<string, string> = { META: "Meta", GOOGLE: "Google Ads", TIKTOK: "TikTok", LINKEDIN: "LinkedIn" };
/** CPA spike: at least this many conversions in the 7 days before, and this multiple. */
const CPA_MIN_CONVERSIONS = 10;
const CPA_SPIKE = 1.5;
/** Tracking silence: at least this many conversions in the 7 days before. */
const TRACKING_MIN_CONVERSIONS = 14;

export type AlertAction =
  | { type: "link"; label: string; href: string }
  | { type: "sync"; label: string; adAccountId: string }
  | { type: "pause"; label: string; campaignId: string }
  | { type: "undo"; label: string; changeId: string };

type Found = {
  dedupeKey: string;
  kind: string;
  severity: AlertSeverity;
  title: string;
  detail: string;
  groupLabel: string;
  clientId: string | null;
  campaignId?: string | null;
  adAccountId?: string | null;
  actions: AlertAction[];
};

const money = (n: number, c: string | null) => {
  try {
    return new Intl.NumberFormat("en-US", { style: "currency", currency: c ?? "USD", maximumFractionDigits: n < 100 ? 2 : 0 }).format(n);
  } catch {
    return String(Math.round(n));
  }
};
const CONNECTIONS = { type: "link", label: "Open Connections", href: "/connections?filter=attention" } as const;

/* ── Finding ─────────────────────────────────────────────────────────────── */

async function accountAlerts(workspaceId: string, now: Date): Promise<Found[]> {
  const [accounts, clientCount] = await Promise.all([
    prisma.adAccount.findMany({ where: { workspaceId, archivedAt: null }, include: { client: { select: { name: true } } } }),
    prisma.client.count({ where: { workspaceId } }),
  ]);
  const out: Found[] = [];
  for (const a of accounts) {
    const name = `${PLATFORM[a.platform] ?? a.platform} · ${a.accountName}`;
    const base = { groupLabel: name, clientId: a.clientId, adAccountId: a.id };
    const s = accountStatus(a, clientCount > 1, now.getTime());
    if (s.status === "TOKEN_EXPIRED") {
      out.push({ ...base, dedupeKey: `access:${a.id}:expired`, kind: "ACCESS", severity: "CRITICAL", title: "Access expired", detail: `${s.detail ?? "Access expired"}. Spend and results stopped syncing; reconnect to resume.`, actions: [{ type: "link", label: "Reconnect", href: "/connections?filter=attention" }] });
    } else if (s.status === "TOKEN_EXPIRING") {
      out.push({ ...base, dedupeKey: `access:${a.id}:soon`, kind: "ACCESS", severity: "WARNING", title: s.detail ?? "Access expires soon", detail: "Reconnect before it expires so syncing doesn't stop.", actions: [{ type: "link", label: "Reconnect", href: "/connections?filter=attention" }] });
    } else if (s.status === "BLOCKED") {
      out.push({ ...base, dedupeKey: `account:${a.id}:blocked`, kind: "ACCOUNT", severity: "CRITICAL", title: s.detail ?? "Account needs attention", detail: "The ad platform reports a problem that can stop delivery. Connections shows what to fix.", actions: [CONNECTIONS] });
    } else if (s.status === "PIXEL_ISSUE") {
      out.push({ ...base, dedupeKey: `account:${a.id}:pixel`, kind: "ACCOUNT", severity: "WARNING", title: s.detail ?? "Pixel issue", detail: "Sales and lead campaigns barely deliver without a working pixel.", actions: [CONNECTIONS] });
    }
    if (a.isActive && a.lastSyncError && a.lastSyncErrorAt && now.getTime() - a.lastSyncErrorAt.getTime() < DAY && (!a.lastSyncedAt || a.lastSyncedAt < a.lastSyncErrorAt)) {
      out.push({ ...base, dedupeKey: `sync:${a.id}`, kind: "SYNC_FAILED", severity: "WARNING", title: "Didn't sync", detail: a.lastSyncError.slice(0, 300), actions: [{ type: "sync", label: "Sync now", adAccountId: a.id }, CONNECTIONS] });
    }
  }
  return out;
}

async function pacingAlerts(workspaceId: string, now: Date): Promise<Found[]> {
  const p = await computePacing(workspaceId, null, undefined, now);
  if (p.dayOfMonth < 5) return []; // too early for a projection worth flagging
  const clients = await prisma.client.findMany({ where: { workspaceId }, select: { id: true, safetyCap: true } });
  return p.clients
    .filter((c) => (c.status === "AHEAD" || c.status === "BEHIND") && c.monthlyBudget)
    .map((c) => {
      const ahead = c.status === "AHEAD";
      const capOn = clients.find((x) => x.id === c.clientId)?.safetyCap;
      return {
        dedupeKey: `pacing:${c.clientId}:${p.month}:${c.status}`,
        kind: "PACING",
        severity: ahead ? "WARNING" : "INFO",
        title: ahead ? `On pace to overspend${c.runOutDay ? `, running out around day ${c.runOutDay}` : ""}` : "On pace to underspend",
        detail: ahead
          ? `Projected ${money(c.projected, c.currency)} of the ${money(c.monthlyBudget!, c.currency)} monthly budget (${money(c.spent, c.currency)} spent so far).`
          : `Projected ${money(c.projected, c.currency)} of ${money(c.monthlyBudget!, c.currency)}, leaving ${money(c.unspentProjected ?? 0, c.currency)} unspent.`,
        groupLabel: c.name,
        clientId: c.clientId,
        actions: [{ type: "link", label: "Open Budgets", href: "/budgets" }, ...(ahead && !capOn ? [{ type: "link" as const, label: "Turn on the cap rule", href: "/settings?tab=ai#automation" }] : [])],
      } satisfies Found;
    });
}

/** CPA spikes per campaign and tracking silence per account, from daily metrics. */
async function performanceAlerts(workspaceId: string, yesterday: string): Promise<Found[]> {
  const y = new Date(`${yesterday}T00:00:00Z`);
  const from = new Date(y.getTime() - 7 * DAY);
  const rows = await prisma.campaignMetrics.findMany({
    where: { campaign: { workspaceId, adAccount: { archivedAt: null } }, date: { gte: from, lt: new Date(y.getTime() + DAY) } },
    select: { campaignId: true, date: true, spend: true, conversions: true },
  });
  if (!rows.length) return [];
  const campaigns = await prisma.campaign.findMany({
    where: { id: { in: [...new Set(rows.map((r) => r.campaignId))] } },
    select: { id: true, name: true, status: true, platform: true, externalId: true, adAccountId: true, adAccount: { select: { accountName: true, platform: true, currency: true, clientId: true, client: { select: { safetyPixel: true } } } } },
  });
  type Sum = { ySpend: number; yConv: number; pSpend: number; pConv: number };
  const zero = (): Sum => ({ ySpend: 0, yConv: 0, pSpend: 0, pConv: 0 });
  const byCampaign = new Map<string, Sum>();
  const byAccount = new Map<string, Sum>();
  const accountOf = new Map(campaigns.map((c) => [c.id, c.adAccountId]));
  for (const r of rows) {
    const isY = r.date.getTime() === y.getTime();
    for (const [map, key] of [[byCampaign, r.campaignId], [byAccount, accountOf.get(r.campaignId)]] as const) {
      if (!key) continue;
      const s = map.get(key) ?? zero();
      if (isY) {
        s.ySpend += Number(r.spend);
        s.yConv += r.conversions;
      } else {
        s.pSpend += Number(r.spend);
        s.pConv += r.conversions;
      }
      map.set(key, s);
    }
  }

  const out: Found[] = [];
  const silentAccounts = new Set<string>();
  for (const [accountId, s] of byAccount) {
    const c = campaigns.find((x) => x.adAccountId === accountId)!;
    const cur = c.adAccount.currency;
    const avgSpend = s.pSpend / 7;
    if (s.pConv >= TRACKING_MIN_CONVERSIONS && s.yConv === 0 && s.ySpend > 0 && s.ySpend >= avgSpend * 0.5) {
      silentAccounts.add(accountId);
      out.push({
        dedupeKey: `tracking:${accountId}:${yesterday}`,
        kind: "TRACKING",
        severity: "CRITICAL",
        title: "Conversions stopped",
        detail: `Spent ${money(s.ySpend, cur)} yesterday with no conversions, after ${s.pConv} in the 7 days before. Tracking (the pixel or conversion setup) may be broken.`,
        groupLabel: `${PLATFORM[c.adAccount.platform] ?? c.adAccount.platform} · ${c.adAccount.accountName}`,
        clientId: c.adAccount.clientId,
        adAccountId: accountId,
        actions: [CONNECTIONS, ...(c.adAccount.platform === "META" && !c.adAccount.client?.safetyPixel ? [{ type: "link" as const, label: "Turn on the pixel rule", href: "/settings?tab=ai#automation" }] : [])],
      });
    }
  }
  for (const [campaignId, s] of byCampaign) {
    const c = campaigns.find((x) => x.id === campaignId)!;
    if (silentAccounts.has(c.adAccountId) || s.pConv < CPA_MIN_CONVERSIONS || s.ySpend <= 0) continue;
    const cur = c.adAccount.currency;
    const prevCpa = s.pSpend / s.pConv;
    const meaningful = s.ySpend >= (s.pSpend / 7) * 0.5;
    let detail: string | null = null;
    if (s.yConv > 0 && meaningful && s.ySpend / s.yConv >= prevCpa * CPA_SPIKE) {
      const cpa = s.ySpend / s.yConv;
      detail = `${money(cpa, cur)} per conversion yesterday, ${Math.round((cpa / prevCpa - 1) * 100)}% above the 7 days before (${money(prevCpa, cur)}).`;
    } else if (s.yConv === 0 && s.ySpend >= prevCpa * 2) {
      detail = `Spent ${money(s.ySpend, cur)} yesterday with no conversions; it usually takes about ${money(prevCpa, cur)} per conversion.`;
    }
    if (!detail) continue;
    const canPause = c.platform === "META" && Boolean(c.externalId) && c.status === "ACTIVE";
    out.push({
      dedupeKey: `cpa:${campaignId}:${yesterday}`,
      kind: "CPA_SPIKE",
      severity: "WARNING",
      title: "Cost per conversion jumped",
      detail,
      groupLabel: c.name,
      clientId: c.adAccount.clientId,
      campaignId,
      adAccountId: c.adAccountId,
      actions: [{ type: "link", label: "Open campaign", href: `/campaigns/${campaignId}` }, ...(canPause ? [{ type: "pause" as const, label: "Pause", campaignId }] : [])],
    });
  }
  return out;
}

async function automationAlerts(workspaceId: string, now: Date): Promise<Found[]> {
  const rows = await prisma.changeLog.findMany({
    where: { workspaceId, createdAt: { gte: new Date(now.getTime() - DAY) }, undoneAt: null, revertOfId: null, actorUserId: null, actorType: { in: ["RULE", "AI"] } },
    orderBy: { createdAt: "desc" },
    take: 50,
  });
  return rows.map((e) => ({
    dedupeKey: `auto:${e.id}`,
    kind: "AUTOMATION",
    severity: "INFO",
    title: e.actorType === "RULE" ? "A safety rule acted" : "Applied automatically",
    detail: e.summary,
    groupLabel: e.campaignName,
    clientId: e.clientId,
    campaignId: e.campaignId,
    actions: [...(changeLog.canUndo(e) ? [{ type: "undo" as const, label: "Undo", changeId: e.id }] : []), { type: "link", label: "Activity", href: "/activity" }],
  }));
}

/* ── Refreshing ──────────────────────────────────────────────────────────── */

const lastRefresh = new Map<string, number>();
/** Opening the inbox refreshes at most this often (the hourly job covers the rest). */
const REFRESH_EVERY_MS = 10 * 60_000;

/** Recompute a workspace's alerts: upsert what holds now, resolve what no longer does. */
export async function refreshAlerts(workspaceId: string, now = new Date()) {
  const ws = await prisma.workspace.findUniqueOrThrow({ where: { id: workspaceId }, select: { timezone: true } });
  const today = localParts(now, ws.timezone).date;
  const yesterday = new Date(new Date(`${today}T00:00:00Z`).getTime() - DAY).toISOString().slice(0, 10);
  const found = (await Promise.all([accountAlerts(workspaceId, now), pacingAlerts(workspaceId, now), performanceAlerts(workspaceId, yesterday), automationAlerts(workspaceId, now)])).flat();

  const existing = await prisma.alert.findMany({ where: { workspaceId }, select: { id: true, dedupeKey: true, resolvedAt: true } });
  const byKey = new Map(existing.map((a) => [a.dedupeKey, a]));
  for (const f of found) {
    const data = {
      kind: f.kind,
      severity: f.severity,
      title: f.title.slice(0, 200),
      detail: f.detail,
      groupLabel: f.groupLabel.slice(0, 200),
      clientId: f.clientId,
      campaignId: f.campaignId ?? null,
      adAccountId: f.adAccountId ?? null,
      actions: f.actions as unknown as Prisma.InputJsonValue,
      lastSeenAt: now,
    };
    const prev = byKey.get(f.dedupeKey);
    if (!prev) {
      await prisma.alert.create({ data: { workspaceId, dedupeKey: f.dedupeKey, firstSeenAt: now, ...data } });
    } else if (prev.resolvedAt) {
      // It came back: a new episode, unread and not dismissed.
      await prisma.alert.update({ where: { id: prev.id }, data: { ...data, firstSeenAt: now, resolvedAt: null, dismissedAt: null, dismissedById: null } });
    } else {
      await prisma.alert.update({ where: { id: prev.id }, data });
    }
  }
  const live = new Set(found.map((f) => f.dedupeKey));
  const gone = existing.filter((a) => !a.resolvedAt && !live.has(a.dedupeKey)).map((a) => a.id);
  if (gone.length) await prisma.alert.updateMany({ where: { id: { in: gone } }, data: { resolvedAt: now } });
  // Resolved more than 30 days ago: no longer worth keeping.
  await prisma.alert.deleteMany({ where: { workspaceId, resolvedAt: { lt: new Date(now.getTime() - 30 * DAY) } } });
  lastRefresh.set(workspaceId, now.getTime());
  return found.length;
}

async function refreshIfStale(workspaceId: string) {
  if (Date.now() - (lastRefresh.get(workspaceId) ?? 0) < REFRESH_EVERY_MS) return;
  try {
    await refreshAlerts(workspaceId);
  } catch (err) {
    console.error("[alerts] refresh", workspaceId, err instanceof Error ? err.message : err);
  }
}

/* ── Reading (scoped to the member's clients) ────────────────────────────── */

const SEVERITY_ORDER: Record<AlertSeverity, number> = { CRITICAL: 0, WARNING: 1, INFO: 2 };

/** Alerts without a client (unassigned accounts) are for members who see every client. */
const scope = (access: Access): Prisma.AlertWhereInput => (access.clientIds ? { clientId: { in: access.clientIds } } : {});

/** `fresh`: recompute now (after a one-click fix), not only when stale. */
export async function listAlerts(access: Access, userId: string, state: "open" | "resolved", fresh = false) {
  if (fresh) lastRefresh.delete(access.workspaceId);
  await refreshIfStale(access.workspaceId);
  const member = await prisma.workspaceMember.findUnique({ where: { workspaceId_userId: { workspaceId: access.workspaceId, userId } }, select: { alertsSeenAt: true } });
  const rows = await prisma.alert.findMany({
    where: {
      workspaceId: access.workspaceId,
      ...scope(access),
      ...(state === "open" ? { resolvedAt: null, dismissedAt: null } : { OR: [{ resolvedAt: { not: null } }, { dismissedAt: { not: null } }], lastSeenAt: { gte: new Date(Date.now() - 7 * DAY) } }),
    },
    orderBy: { lastSeenAt: "desc" },
    take: 200,
  });
  const seen = member?.alertsSeenAt?.getTime() ?? 0;
  const alerts = rows
    .map((a) => ({
      id: a.id,
      kind: a.kind,
      severity: a.severity,
      title: a.title,
      detail: a.detail,
      groupLabel: a.groupLabel,
      clientId: a.clientId,
      campaignId: a.campaignId,
      adAccountId: a.adAccountId,
      actions: (a.actions ?? []) as AlertAction[],
      firstSeenAt: a.firstSeenAt,
      resolvedAt: a.resolvedAt,
      dismissedAt: a.dismissedAt,
      unread: state === "open" && a.firstSeenAt.getTime() > seen,
    }))
    .sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity] || b.firstSeenAt.getTime() - a.firstSeenAt.getTime());
  return { alerts, refreshedAt: new Date(lastRefresh.get(access.workspaceId) ?? Date.now()) };
}

/** The bell: open alerts, how many are new to me, and whether any is critical. Never recomputes. */
export async function alertSummary(access: Access, userId: string) {
  const member = await prisma.workspaceMember.findUnique({ where: { workspaceId_userId: { workspaceId: access.workspaceId, userId } }, select: { alertsSeenAt: true } });
  const open = await prisma.alert.findMany({ where: { workspaceId: access.workspaceId, ...scope(access), resolvedAt: null, dismissedAt: null }, select: { severity: true, firstSeenAt: true } });
  const seen = member?.alertsSeenAt?.getTime() ?? 0;
  return { open: open.length, unread: open.filter((a) => a.firstSeenAt.getTime() > seen).length, critical: open.filter((a) => a.severity === "CRITICAL").length };
}

export async function markSeen(access: Access, userId: string) {
  await prisma.workspaceMember.update({ where: { workspaceId_userId: { workspaceId: access.workspaceId, userId } }, data: { alertsSeenAt: new Date() } });
}

/** Dismiss for the whole workspace; it reopens only if the condition clears and comes back. */
export async function dismissAlert(access: Access, userId: string, id: string) {
  const r = await prisma.alert.updateMany({ where: { id, workspaceId: access.workspaceId, ...scope(access), dismissedAt: null }, data: { dismissedAt: new Date(), dismissedById: userId } });
  if (!r.count) throw Object.assign(new Error("Alert not found."), { status: 404 });
}

/* ── Scheduler ───────────────────────────────────────────────────────────── */

let handle: NodeJS.Timeout | null = null;
let running = false;

async function tick() {
  if (running) return;
  running = true;
  try {
    const workspaces = await prisma.workspace.findMany({ select: { id: true } });
    for (const w of workspaces) {
      try {
        await refreshAlerts(w.id);
        // Trial ending / ended emails (C11), once each.
        if (emailConfigured()) await trialReminders(w.id);
      } catch (err) {
        console.error("[alerts] workspace", w.id, err instanceof Error ? err.message : err);
      }
    }
  } finally {
    running = false;
  }
}

/** Hourly inbox refresh. Disable with ALERTS_INBOX_ENABLED=false (the inbox still refreshes when opened). */
export function startAlertsScheduler() {
  if ((process.env.ALERTS_INBOX_ENABLED ?? "true").toLowerCase() === "false" || handle) return;
  setTimeout(() => {
    void tick();
    handle = setInterval(() => void tick(), 60 * 60_000);
  }, 240_000);
  console.log("[alerts] inbox refresh scheduled hourly");
}
