import { createHash, randomBytes } from "crypto";
import { prisma } from "../lib/prisma";
import { decryptToken, encryptToken } from "../lib/crypto";
import { assertClientAccess, type Access } from "../lib/access";
import { computePacing } from "./pacing.service";

/**
 * Client portal (plan C4): a read-only link per client that anyone with the
 * link can open, without a login. The owner or media buyer chooses what it
 * shows (spend, revenue, the campaign list) and can regenerate or revoke it.
 * The link carries a 32-byte random token; we look it up by its sha256 and
 * keep the token encrypted so the link can be copied again later.
 */

const DAY = 86_400_000;
const FRONTEND_URL = () => process.env.FRONTEND_URL ?? process.env.WEB_ORIGIN ?? "http://localhost:3000";
const hash = (token: string) => createHash("sha256").update(token).digest("hex");
export const portalUrl = (token: string) => `${FRONTEND_URL()}/portal/${token}`;

type Toggles = { showSpend?: unknown; showRevenue?: unknown; showCampaigns?: unknown };
const toggles = (t: Toggles) => ({
  ...(typeof t.showSpend === "boolean" ? { showSpend: t.showSpend } : {}),
  ...(typeof t.showRevenue === "boolean" ? { showRevenue: t.showRevenue } : {}),
  ...(typeof t.showCampaigns === "boolean" ? { showCampaigns: t.showCampaigns } : {}),
});

/* ── Managing links (signed in) ──────────────────────────────────────────── */

async function clientOf(access: Access, clientId: unknown) {
  if (typeof clientId !== "string") throw Object.assign(new Error("Pick a client."), { status: 400 });
  const c = await prisma.client.findFirst({ where: { id: clientId, workspaceId: access.workspaceId }, select: { id: true, name: true } });
  if (!c) throw Object.assign(new Error("Client not found."), { status: 404 });
  assertClientAccess(access, c.id);
  return c;
}

const view = (s: { id: string; clientId: string; tokenEnc: string; showSpend: boolean; showRevenue: boolean; showCampaigns: boolean; createdAt: Date; expiresAt: Date | null; lastViewedAt: Date | null; viewCount: number }) => ({
  id: s.id,
  clientId: s.clientId,
  url: portalUrl(decryptToken(s.tokenEnc)),
  showSpend: s.showSpend,
  showRevenue: s.showRevenue,
  showCampaigns: s.showCampaigns,
  createdAt: s.createdAt,
  expiresAt: s.expiresAt,
  lastViewedAt: s.lastViewedAt,
  viewCount: s.viewCount,
});

const active = (clientId: string) => ({ clientId, revokedAt: null, OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }] });

/** The client's live link, or null. */
export async function getShare(access: Access, clientId: unknown) {
  const c = await clientOf(access, clientId);
  const s = await prisma.clientShare.findFirst({ where: active(c.id), orderBy: { createdAt: "desc" } });
  return s ? view(s) : null;
}

/** A new link (the old one stops working). */
export async function createShare(access: Access, userId: string, input: { clientId?: unknown; expiresInDays?: unknown } & Toggles) {
  const c = await clientOf(access, input.clientId);
  const days = input.expiresInDays == null || input.expiresInDays === "" ? null : Math.round(Number(input.expiresInDays));
  if (days !== null && (!Number.isFinite(days) || days < 1 || days > 365)) throw Object.assign(new Error("Expiry must be between 1 and 365 days, or none."), { status: 400 });
  const token = randomBytes(32).toString("base64url");
  const s = await prisma.$transaction(async (tx) => {
    await tx.clientShare.updateMany({ where: { clientId: c.id, revokedAt: null }, data: { revokedAt: new Date() } });
    return tx.clientShare.create({
      data: { workspaceId: access.workspaceId, clientId: c.id, tokenHash: hash(token), tokenEnc: encryptToken(token), createdById: userId, expiresAt: days ? new Date(Date.now() + days * DAY) : null, ...toggles(input) },
    });
  });
  return view(s);
}

export async function updateShare(access: Access, id: string, input: Toggles) {
  const s = await prisma.clientShare.findFirst({ where: { id, workspaceId: access.workspaceId, revokedAt: null } });
  if (!s) throw Object.assign(new Error("Link not found."), { status: 404 });
  assertClientAccess(access, s.clientId);
  return view(await prisma.clientShare.update({ where: { id }, data: toggles(input) }));
}

export async function revokeShare(access: Access, id: string) {
  const s = await prisma.clientShare.findFirst({ where: { id, workspaceId: access.workspaceId, revokedAt: null } });
  if (!s) throw Object.assign(new Error("Link not found."), { status: 404 });
  assertClientAccess(access, s.clientId);
  await prisma.clientShare.update({ where: { id }, data: { revokedAt: new Date() } });
}

/* ── The portal (public) ─────────────────────────────────────────────────── */

const DAYS = [7, 30, 90] as const;
const notFound = () => Object.assign(new Error("This link doesn't work any more. Ask your agency for a new one."), { status: 404 });

type Sum = { spend: number; impressions: number; clicks: number; conversions: number; revenue: number };
const zero = (): Sum => ({ spend: 0, impressions: 0, clicks: 0, conversions: 0, revenue: 0 });
const add = (s: Sum, r: { spend: unknown; impressions: number; clicks: number; conversions: number; revenue: unknown }) => {
  s.spend += Number(r.spend);
  s.impressions += r.impressions;
  s.clicks += r.clicks;
  s.conversions += r.conversions;
  s.revenue += Number(r.revenue);
};

export type Shows = { showSpend: boolean; showRevenue: boolean; showCampaigns: boolean };

/**
 * One client's numbers for `start`…`end` (UTC dates, inclusive) vs the same
 * number of days just before: the portal (C4a) and scheduled reports (C4b)
 * share it, so they always agree. Spend-derived numbers (spend, CPA, budget)
 * and revenue-derived ones (revenue, ROAS) are left out entirely when hidden.
 */
export async function clientReport(opts: { workspaceId: string; clientId: string; shows: Shows; start: Date; end: Date; pacingAt?: Date | null }) {
  const { workspaceId, clientId, start, end } = opts;
  const s = opts.shows;
  const days = Math.round((end.getTime() - start.getTime()) / DAY) + 1;
  const today = end;
  const prevStart = new Date(start.getTime() - days * DAY);
  const [client, workspace, accounts] = await Promise.all([
    prisma.client.findUniqueOrThrow({ where: { id: clientId }, select: { name: true, currency: true, monthlyBudget: true } }),
    prisma.workspace.findUniqueOrThrow({ where: { id: workspaceId }, select: { name: true } }),
    prisma.adAccount.findMany({ where: { clientId, workspaceId }, select: { id: true, currency: true, lastSyncedAt: true } }),
  ]);
  const ids = accounts.map((a) => a.id);
  const [rows, campaigns] = await Promise.all([
    ids.length ? prisma.campaignMetrics.findMany({ where: { campaign: { adAccountId: { in: ids } }, date: { gte: prevStart, lt: new Date(today.getTime() + DAY) } }, select: { campaignId: true, date: true, spend: true, impressions: true, clicks: true, conversions: true, revenue: true } }) : [],
    ids.length ? prisma.campaign.findMany({ where: { adAccountId: { in: ids } }, select: { id: true, name: true, platform: true, status: true } }) : [],
  ]);

  const cur = zero();
  const prev = zero();
  const byDay = new Map<string, Sum>();
  const byCampaign = new Map<string, Sum>();
  for (const r of rows) {
    if (r.date >= start) {
      add(cur, r);
      const k = r.date.toISOString().slice(0, 10);
      add(byDay.get(k) ?? byDay.set(k, zero()).get(k)!, r);
      add(byCampaign.get(r.campaignId) ?? byCampaign.set(r.campaignId, zero()).get(r.campaignId)!, r);
    } else add(prev, r);
  }

  const kpis = (x: Sum) => ({
    impressions: x.impressions,
    clicks: x.clicks,
    ctr: x.impressions ? (x.clicks / x.impressions) * 100 : null,
    conversions: x.conversions,
    ...(s.showSpend ? { spend: x.spend, cpa: x.conversions ? x.spend / x.conversions : null } : {}),
    ...(s.showRevenue ? { revenue: x.revenue } : {}),
    ...(s.showSpend && s.showRevenue ? { roas: x.spend ? x.revenue / x.spend : null } : {}),
  });

  const series = [];
  for (let t = start.getTime(); t <= today.getTime(); t += DAY) {
    const k = new Date(t).toISOString().slice(0, 10);
    const d = byDay.get(k) ?? zero();
    series.push({ date: k, conversions: d.conversions, clicks: d.clicks, ...(s.showSpend ? { spend: d.spend } : {}), ...(s.showRevenue ? { revenue: d.revenue } : {}) });
  }

  const campaignRows = s.showCampaigns
    ? campaigns
        .map((c) => ({ c, m: byCampaign.get(c.id) ?? zero() }))
        .filter(({ c, m }) => m.impressions > 0 || m.spend > 0 || c.status === "ACTIVE")
        .sort((a, b) => b.m.spend - a.m.spend || b.m.conversions - a.m.conversions)
        .slice(0, 50)
        .map(({ c, m }) => ({ name: c.name, platform: c.platform, status: c.status, ...kpis(m) }))
    : null;

  // This month's budget (portal and weekly reports; a monthly report is about a finished month).
  let pacing = null;
  if (s.showSpend && client.monthlyBudget && opts.pacingAt) {
    const month = await computePacing(workspaceId, clientId, undefined, opts.pacingAt);
    const p = month.clients[0];
    if (p?.monthlyBudget) pacing = { month: month.month, monthlyBudget: p.monthlyBudget, spent: p.spent, projected: p.projected, status: p.status };
  }

  const currencies = [...new Set(accounts.map((a) => a.currency).filter(Boolean))];
  const synced = accounts.map((a) => a.lastSyncedAt?.getTime() ?? 0).filter(Boolean);
  return {
    agency: workspace.name,
    client: client.name,
    currency: client.currency ?? (currencies.length === 1 ? currencies[0] : null),
    days,
    from: start.toISOString().slice(0, 10),
    to: today.toISOString().slice(0, 10),
    shows: { spend: s.showSpend, revenue: s.showRevenue, campaigns: s.showCampaigns },
    kpis: kpis(cur),
    previous: kpis(prev),
    series,
    campaigns: campaignRows,
    pacing,
    updatedAt: synced.length ? new Date(Math.max(...synced)) : null,
  };
}
export type ClientReport = Awaited<ReturnType<typeof clientReport>>;

/** What a portal link shows for the last `days` days (7 / 30 / 90). */
export async function portalReport(token: string, daysParam: unknown, now = new Date()) {
  if (typeof token !== "string" || token.length < 20 || token.length > 100) throw notFound();
  const s = await prisma.clientShare.findUnique({ where: { tokenHash: hash(token) } });
  if (!s || s.revokedAt || (s.expiresAt && s.expiresAt <= now)) throw notFound();
  const days = DAYS.find((d) => d === Number(daysParam)) ?? 30;
  const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const report = await clientReport({ workspaceId: s.workspaceId, clientId: s.clientId, shows: s, start: new Date(today.getTime() - (days - 1) * DAY), end: today, pacingAt: now });
  // Count the visit (best effort).
  void prisma.clientShare.update({ where: { id: s.id }, data: { viewCount: { increment: 1 }, lastViewedAt: now } }).catch(() => {});
  return report;
}

/** The client's live portal link, if it has one (scheduled reports link to it). */
export async function liveShareUrl(clientId: string) {
  const s = await prisma.clientShare.findFirst({ where: active(clientId), orderBy: { createdAt: "desc" } });
  return s ? portalUrl(decryptToken(s.tokenEnc)) : null;
}
