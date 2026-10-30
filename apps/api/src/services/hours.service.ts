import { Prisma, type AdAccount, type Platform } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { decryptToken, encryptToken } from "../lib/crypto";
import { metaService } from "./meta.service";
import { hh, hourRange } from "../lib/schedule-grid";
import { googleService, isGoogleAuthError } from "./google.service";
import { tiktokService } from "./tiktok.service";
import { metaResults } from "./sync.service";
import { suggestionsService, type SmartHoursDraft } from "./suggestions.service";

/**
 * Smart hours (plan C7): when does a campaign convert cheaply?
 *
 * - **Data:** once a day per ad account, the platform's hour-by-hour report
 *   for the last 45 days becomes a 7 × 24 week per campaign (HourlyStat), in
 *   the account's time zone.
 * - **Gate:** suggestions only after 14+ days with spend and 300+ conversions
 *   (guide §8). Before that the heatmap is for reading only.
 * - **Suggestion:** the run of hours (2–8, may wrap past midnight) that costs
 *   40%+ more per conversion than average, with enough spend to be sure (a
 *   clear shortfall against the conversions expected at the average cost).
 * - **Acting:** Meta can only switch hours off, and only on a lifetime budget
 *   (one click for campaigns published from Advertix, through Approvals, with
 *   Undo). Google (bid adjustment) and TikTok (dayparting) get exact steps:
 *   Advertix doesn't write to those platforms yet.
 */

export const WINDOW_DAYS = 45;
export const MIN_DAYS = 14;
export const MIN_CONVERSIONS = 300;
/** A run of hours this much costlier than average is worth acting on. */
export const EXPENSIVE = 1.4;
const MAX_RUN = 8;
const MIN_RUN = 2;
/** A cell needs this many conversions (or clicks, for click campaigns) to be judged. */
const THIN_CELL = { conversion: 3, click: 20 };
const THIN_HOUR = { conversion: 10, click: 60 };
const DAY = 86_400_000;
/** Cell value for "spent 3× the average cost, got nothing" (finite, so it survives JSON). */
export const NOTHING = 99;

export type Cell = { weekday: number; hour: number; spend: number; impressions: number; clicks: number; conversions: number; revenue: number };
export type Metric = "conversion" | "click";
export type Recommendation = {
  /** Switch off (or bid down) from this hour … */
  from: number;
  /** … up to this hour (exclusive; may be ≤ from when it wraps past midnight). */
  to: number;
  /** Null: no conversions at all in those hours. */
  cost: number | null;
  average: number;
  pctMore: number;
  spendShare: number;
  conversionShare: number;
  savedPerWeek: number;
  /** Google: suggested bid adjustment for those hours (negative %). */
  bidAdjustment: number;
};

const blank = (weekday: number, hour: number): Cell => ({ weekday, hour, spend: 0, impressions: 0, clicks: 0, conversions: 0, revenue: 0 });
const add = (a: Cell, b: Cell) => {
  a.spend += b.spend;
  a.impressions += b.impressions;
  a.clicks += b.clicks;
  a.conversions += b.conversions;
  a.revenue += b.revenue;
};

/* ── Analysis (pure) ─────────────────────────────────────────────────────── */

/**
 * The heatmap and the suggestion from a week of cells. `days` = days with
 * spend in the window. Values are cost per result against the average (1 =
 * average); null = too few to judge (or no delivery); NOTHING = spent plenty,
 * got nothing.
 */
export function analyze(input: Cell[], days: number) {
  const grid = Array.from({ length: 7 }, (_, d) => Array.from({ length: 24 }, (_, h) => blank(d, h)));
  for (const c of input) if (c.weekday >= 0 && c.weekday < 7 && c.hour >= 0 && c.hour < 24) add(grid[c.weekday][c.hour], c);
  const byHour = Array.from({ length: 24 }, (_, h) => {
    const t = blank(-1, h);
    for (let d = 0; d < 7; d++) add(t, grid[d][h]);
    return t;
  });
  const total = blank(-1, -1);
  for (const h of byHour) add(total, h);

  const metric: Metric = total.conversions >= 1 ? "conversion" : "click";
  const results = (c: Cell) => (metric === "conversion" ? c.conversions : c.clicks);
  const average = results(total) > 0 ? total.spend / results(total) : 0;
  const value = (c: Cell, thin: number) => {
    if (!(average > 0) || c.spend <= 0) return { value: null as number | null, thin: false, empty: c.spend <= 0 };
    const r = results(c);
    // Nothing back for several times the average cost is a verdict, not noise.
    if (r === 0) return c.spend >= 3 * average ? { value: NOTHING, thin: false, empty: false } : { value: null, thin: true, empty: false };
    if (r < thin) return { value: null, thin: true, empty: false };
    return { value: c.spend / r / average, thin: false, empty: false };
  };
  const cells = grid.flat().map((c) => ({ ...c, ...value(c, THIN_CELL[metric]) }));
  const hours = byHour.map((c) => ({ ...c, ...value(c, THIN_HOUR[metric]) }));

  const eligible = { days, conversions: Math.round(total.conversions), needDays: MIN_DAYS, needConversions: MIN_CONVERSIONS, ok: days >= MIN_DAYS && total.conversions >= MIN_CONVERSIONS };
  return { metric, average, total, cells, hours, eligible, recommendation: eligible.ok ? recommend(byHour, total, days) : null };
}

/** The costliest run of hours we can be sure about, or null to keep it running around the clock. */
export function recommend(byHour: Cell[], total: Cell, days: number): Recommendation | null {
  if (!(total.conversions > 0) || !(total.spend > 0)) return null;
  const average = total.spend / total.conversions;
  let best: (Recommendation & { excess: number }) | null = null;
  for (let from = 0; from < 24; from++) {
    for (let len = MIN_RUN; len <= MAX_RUN; len++) {
      const hrs = hourRange(from, (from + len) % 24);
      let s = 0;
      let c = 0;
      for (const h of hrs) {
        s += byHour[h].spend;
        c += byHour[h].conversions;
      }
      // Every hour in the run is at or above average (no cheap hour dragged along).
      if (hrs.some((h) => byHour[h].conversions > 0 && byHour[h].spend / byHour[h].conversions < average)) continue;
      const expected = s / average;
      if (expected < 10) continue; // too little spend to be sure
      if (c > expected / EXPENSIVE) continue; // under 40% costlier
      if (c > expected - 2 * Math.sqrt(expected)) continue; // within normal variation
      if (s / total.spend > 0.35) continue; // never cut more than a third of delivery
      const excess = s - c * average;
      if (!best || excess > best.excess) {
        const cost = c > 0 ? s / c : Infinity;
        best = {
          from,
          to: (from + len) % 24,
          cost: Number.isFinite(cost) ? cost : null,
          average,
          pctMore: Number.isFinite(cost) ? Math.round((cost / average - 1) * 100) : 999,
          spendShare: s / total.spend,
          conversionShare: c / total.conversions,
          savedPerWeek: (excess * 7) / Math.max(1, days),
          bidAdjustment: -Math.min(90, Math.max(10, Math.round((1 - (c > 0 ? average / cost : 0)) * 100 / 5) * 5)),
          excess,
        };
      }
    }
  }
  if (!best) return null;
  const { excess: _excess, ...rec } = best;
  return rec;
}

/* ── Syncing the hourly report ───────────────────────────────────────────── */

const ymd = (d: Date) => d.toISOString().slice(0, 10);
const weekdayOf = (day: string) => new Date(`${day}T00:00:00Z`).getUTCDay();

/** Rebuild an account's campaigns' weeks from the platform's hourly report. Returns campaigns updated. */
export async function syncAccountHours(account: AdAccount, now = new Date()): Promise<number> {
  const until = ymd(now);
  const since = ymd(new Date(now.getTime() - (WINDOW_DAYS - 1) * DAY));
  const campaigns = await prisma.campaign.findMany({ where: { adAccountId: account.id, externalId: { not: null } }, select: { id: true, externalId: true } });
  const idOf = new Map(campaigns.map((c) => [c.externalId!, c.id]));
  const weeks = new Map<string, Map<string, Cell>>();
  const put = (campaignId: string, c: Cell) => {
    const w = weeks.get(campaignId) ?? new Map<string, Cell>();
    const k = `${c.weekday}:${c.hour}`;
    const cur = w.get(k) ?? blank(c.weekday, c.hour);
    add(cur, c);
    w.set(k, cur);
    weeks.set(campaignId, w);
  };

  if (account.platform === "META") {
    const rows = await metaService.getHourlyInsights(metaService.decryptToken(account.accessToken), account.accountId, since, until);
    for (const r of rows) {
      const id = idOf.get(r.campaign_id);
      const hour = Number((r.hourly_stats_aggregated_by_advertiser_time_zone ?? "").slice(0, 2));
      if (!id || !Number.isInteger(hour) || hour < 0 || hour > 23) continue;
      const m = metaResults(r);
      put(id, { weekday: weekdayOf(r.date_start), hour, spend: m.spend, impressions: m.impressions, clicks: m.clicks, conversions: m.conversions, revenue: m.revenue });
    }
  } else if (account.platform === "GOOGLE") {
    const cid = googleService.normalizeCustomerId(account.accountId);
    let token = decryptToken(account.accessToken);
    let rows;
    try {
      rows = await googleService.getHourlyMetrics(token, cid, since, until);
    } catch (err) {
      if (!isGoogleAuthError(err) || !account.refreshToken) throw err;
      token = (await googleService.refreshAccessToken(decryptToken(account.refreshToken))).access_token;
      await prisma.adAccount.update({ where: { id: account.id }, data: { accessToken: encryptToken(token) } });
      rows = await googleService.getHourlyMetrics(token, cid, since, until);
    }
    for (const r of rows) {
      const id = idOf.get(r.campaignId);
      if (id) put(id, { weekday: r.weekday, hour: r.hour, spend: r.spend, impressions: r.impressions, clicks: r.clicks, conversions: r.conversions, revenue: r.revenue });
    }
  } else if (account.platform === "TIKTOK") {
    // A day per request: the last 14 days keep it to 14 calls a day per advertiser.
    const token = decryptToken(account.accessToken);
    for (let i = 0; i < MIN_DAYS; i++) {
      const day = ymd(new Date(now.getTime() - i * DAY));
      for (const r of await tiktokService.getHourlyMetrics(token, account.accountId, day)) {
        const id = idOf.get(r.campaignId);
        if (id) put(id, { weekday: weekdayOf(r.date), hour: r.hour, spend: r.spend, impressions: r.impressions, clicks: r.clicks, conversions: r.conversions, revenue: 0 });
      }
    }
  } else {
    return 0; // LinkedIn and others: dates only
  }

  let updated = 0;
  for (const [campaignId, w] of weeks) {
    const rows = [...w.values()].filter((c) => c.spend > 0 || c.impressions > 0);
    await prisma.$transaction([
      prisma.hourlyStat.deleteMany({ where: { campaignId } }),
      prisma.hourlyStat.createMany({
        data: rows.map((c) => ({
          campaignId,
          weekday: c.weekday,
          hour: c.hour,
          spend: new Prisma.Decimal(c.spend.toFixed(2)),
          impressions: c.impressions,
          clicks: c.clicks,
          conversions: Math.round(c.conversions * 100) / 100,
          revenue: new Prisma.Decimal(c.revenue.toFixed(2)),
        })),
      }),
      prisma.campaign.update({ where: { id: campaignId }, data: { hoursSyncedAt: now } }),
    ]);
    updated++;
  }
  await prisma.adAccount.update({ where: { id: account.id }, data: { hoursSyncedAt: now } });
  return updated;
}

/* ── Reading ─────────────────────────────────────────────────────────────── */

/** Days with spend in the window (from the daily metrics), per campaign. */
async function daysWithSpend(campaignIds: string[], now: Date) {
  if (!campaignIds.length) return new Map<string, number>();
  const since = new Date(now.getTime() - WINDOW_DAYS * DAY);
  const rows = await prisma.campaignMetrics.groupBy({ by: ["campaignId"], where: { campaignId: { in: campaignIds }, date: { gte: since }, spend: { gt: 0 } }, _count: { _all: true } });
  return new Map(rows.map((r) => [r.campaignId, r._count._all]));
}

const cellsOf = (rows: { weekday: number; hour: number; spend: Prisma.Decimal; impressions: number; clicks: number; conversions: number; revenue: Prisma.Decimal }[]): Cell[] =>
  rows.map((r) => ({ weekday: r.weekday, hour: r.hour, spend: Number(r.spend), impressions: r.impressions, clicks: r.clicks, conversions: r.conversions, revenue: Number(r.revenue) }));

type CampaignForHours = Prisma.CampaignGetPayload<{ include: { adAccount: true } }>;

export type ApplyMode =
  | { mode: "one-click"; label: string }
  | { mode: "manual"; reason: string; steps: string[] }
  | { mode: "none"; reason: string };

/** How the suggestion can be carried out on this campaign's platform. */
export function applyMode(c: CampaignForHours, rec: Recommendation | null): ApplyMode {
  if (!rec) return { mode: "none", reason: "Nothing to change." };
  const range = `${hh(rec.from)}–${hh(rec.to)}`;
  if (c.platform === "META") {
    if (c.externalId && c.externalAdSetId && c.budgetType === "LIFETIME" && (c.status === "ACTIVE" || c.status === "PAUSED")) {
      return { mode: "one-click", label: `Switch off ${range}` };
    }
    const steps = [
      "In Meta Ads Manager, open the campaign's ad set and go to Budget & schedule.",
      "Ad scheduling needs a lifetime budget: switch the budget to Lifetime (it can't be changed on an existing daily-budget ad set, so duplicate it with a lifetime budget if needed).",
      `Choose "Run ads on a schedule" and untick ${range} on every day (the ad account's time zone).`,
    ];
    return {
      mode: "manual",
      reason: c.budgetType !== "LIFETIME" ? "Meta allows hour schedules only on a total (lifetime) budget, and this campaign has a daily budget." : !c.externalAdSetId ? "This campaign wasn't published from Advertix, so its ad sets are set in Ads Manager." : "This campaign isn't live on Meta.",
      steps,
    };
  }
  if (c.platform === "GOOGLE") {
    return {
      mode: "manual",
      reason: "Advertix can't change Google Ads schedules yet.",
      steps: [
        "In Google Ads, open the campaign and go to Ad schedule.",
        `Add a schedule for ${range} on every day (the account's time zone).`,
        `Set its bid adjustment to ${rec.bidAdjustment}%. Keep the other hours at 0%.`,
      ],
    };
  }
  if (c.platform === "TIKTOK") {
    return {
      mode: "manual",
      reason: "Advertix can't change TikTok schedules yet.",
      steps: ["In TikTok Ads Manager, open the ad group and go to Budget & schedule.", "Set Dayparting to \"Select time slots\".", `Untick ${range} on every day (the advertiser's time zone).`],
    };
  }
  return { mode: "none", reason: "This platform only takes start and end dates." };
}

/** Everything the Hours tab shows for one campaign. */
export async function campaignHours(workspaceId: string, campaignId: string, now = new Date()) {
  const c = await prisma.campaign.findFirst({ where: { id: campaignId, workspaceId }, include: { adAccount: true } });
  if (!c) throw Object.assign(new Error("Campaign not found"), { status: 404 });
  const rows = await prisma.hourlyStat.findMany({ where: { campaignId } });
  const days = (await daysWithSpend([campaignId], now)).get(campaignId) ?? 0;
  const a = analyze(cellsOf(rows), days);
  const pending = await prisma.suggestion.findFirst({
    where: { workspaceId, campaignId, kind: "Smart hours", status: { in: ["OPEN", "APPLIED"] } },
    orderBy: { createdAt: "desc" },
  });
  return {
    campaignId: c.id,
    platform: c.platform,
    timezone: c.adAccount.timezone,
    currency: c.adAccount.currency,
    smartHours: c.smartHours,
    syncedAt: c.hoursSyncedAt ?? c.adAccount.hoursSyncedAt,
    windowDays: WINDOW_DAYS,
    ...a,
    apply: applyMode(c, a.recommendation),
    suggestion: pending ? { id: pending.id, status: pending.status, title: pending.title, appliedAt: pending.appliedAt, payload: pending.actionPayload } : null,
  };
}

/** A client's (or the workspace's) campaigns together, optionally one platform: for reading only. */
export async function clientHours(workspaceId: string, clientId: string | null, platform: Platform | null, now = new Date()) {
  const campaigns = await prisma.campaign.findMany({
    where: { workspaceId, ...(clientId ? { adAccount: { clientId } } : {}), ...(platform ? { platform } : {}), hourlyStats: { some: {} } },
    select: { id: true, platform: true, adAccount: { select: { currency: true, timezone: true } } },
  });
  const currencies = [...new Set(campaigns.map((c) => c.adAccount.currency ?? "USD"))];
  const zones = [...new Set(campaigns.map((c) => c.adAccount.timezone).filter(Boolean))];
  if (currencies.length > 1) return { mixedCurrency: true as const, currencies, campaigns: campaigns.length };
  const rows = campaigns.length ? await prisma.hourlyStat.findMany({ where: { campaignId: { in: campaigns.map((c) => c.id) } } }) : [];
  const days = Math.max(0, ...(await daysWithSpend(campaigns.map((c) => c.id), now)).values());
  const a = analyze(cellsOf(rows), days);
  return {
    mixedCurrency: false as const,
    currency: currencies[0] ?? "USD",
    timezone: zones.length === 1 ? zones[0] : null,
    mixedZones: zones.length > 1,
    campaigns: campaigns.length,
    platforms: [...new Set(campaigns.map((c) => c.platform))],
    windowDays: WINDOW_DAYS,
    ...a,
  };
}

/* ── Suggestions ─────────────────────────────────────────────────────────── */

function draftFor(c: CampaignForHours, rec: Recommendation, prefix: "auto" | "manual"): SmartHoursDraft {
  const range = `${hh(rec.from)}–${hh(rec.to)}`;
  const mode = applyMode(c, rec);
  const cur = c.adAccount.currency ?? "USD";
  const money = (n: number) => {
    try {
      return new Intl.NumberFormat("en-US", { style: "currency", currency: cur, maximumFractionDigits: 0 }).format(n);
    } catch {
      return String(Math.round(n));
    }
  };
  const more = rec.pctMore >= 999 ? "bring no conversions for their spend" : `cost ${rec.pctMore}% more per conversion than average`;
  const title =
    c.platform === "GOOGLE" ? `Lower bids ${Math.abs(rec.bidAdjustment)}% from ${hh(rec.from)} to ${hh(rec.to)}` : c.platform === "TIKTOK" ? `Pause ${range} in dayparting` : `Switch off ${range}`;
  return {
    dedupeKey: `hours:${prefix}:${c.id}:${rec.from}-${rec.to}`,
    sourceRef: c.id,
    clientId: c.adAccount.clientId,
    campaignId: c.id,
    kind: "Smart hours",
    title,
    reason: `${range} ${more} and take ${Math.round(rec.spendShare * 100)}% of the spend for ${Math.round(rec.conversionShare * 100)}% of the conversions (last ${WINDOW_DAYS} days, the account's time zone).`,
    impact: rec.savedPerWeek >= 1 ? `≈ ${money(rec.savedPerWeek)} / week saved` : null,
    priority: 4,
    confidence: "HIGH",
    actionType: mode.mode === "one-click" ? "SET_AD_SCHEDULE" : null,
    actionLabel: mode.mode === "one-click" ? mode.label : "See how",
    doneLabel: mode.mode === "one-click" ? `Switched off ${range}` : null,
    actionPayload: mode.mode === "one-click" ? { campaignId: c.id, from: rec.from, to: rec.to } : null,
    reviewHref: `/campaigns/${c.id}?tab=hours`,
    expiresAt: new Date(Date.now() + 3 * DAY),
  };
}

/** Refresh the Smart hours suggestions of every campaign that has it on (after the daily sync). */
export async function refreshSmartHoursSuggestions(workspaceId: string, now = new Date()) {
  // Paused too: setting the hours before it resumes is useful (it has history either way).
  const campaigns = await prisma.campaign.findMany({ where: { workspaceId, smartHours: true, status: { in: ["ACTIVE", "PAUSED"] } }, include: { adAccount: true } });
  const days = await daysWithSpend(campaigns.map((c) => c.id), now);
  const drafts: SmartHoursDraft[] = [];
  for (const c of campaigns) {
    const a = analyze(cellsOf(await prisma.hourlyStat.findMany({ where: { campaignId: c.id } })), days.get(c.id) ?? 0);
    if (a.recommendation) drafts.push(draftFor(c, a.recommendation, "auto"));
  }
  await suggestionsService.syncSmartHours(workspaceId, drafts);
  return drafts.length;
}

/** From the Hours tab: the current suggestion as a suggestion row, to apply through the usual flow (and Approvals). */
export async function suggestNow(workspaceId: string, campaignId: string, now = new Date()) {
  const c = await prisma.campaign.findFirst({ where: { id: campaignId, workspaceId }, include: { adAccount: true } });
  if (!c) throw Object.assign(new Error("Campaign not found"), { status: 404 });
  const days = (await daysWithSpend([c.id], now)).get(c.id) ?? 0;
  const a = analyze(cellsOf(await prisma.hourlyStat.findMany({ where: { campaignId: c.id } })), days);
  if (!a.recommendation) throw Object.assign(new Error(a.eligible.ok ? "There's nothing to change: no hours cost 40% more than average with enough data to be sure." : "Smart hours needs 14 days and 300 conversions first."), { status: 409 });
  const d = draftFor(c, a.recommendation, c.smartHours ? "auto" : "manual");
  if (!d.actionType) throw Object.assign(new Error("This can't be applied from Advertix. Follow the steps instead."), { status: 409 });
  return suggestionsService.upsertOne(workspaceId, d);
}

export async function setSmartHours(workspaceId: string, campaignId: string, on: boolean) {
  const c = await prisma.campaign.findFirst({ where: { id: campaignId, workspaceId }, select: { id: true } });
  if (!c) throw Object.assign(new Error("Campaign not found"), { status: 404 });
  await prisma.campaign.update({ where: { id: c.id }, data: { smartHours: on } });
  if (!on) {
    // Its waiting suggestions go; applied ones keep their Undo.
    await prisma.suggestion.updateMany({ where: { workspaceId, campaignId: c.id, kind: "Smart hours", status: { in: ["OPEN", "SNOOZED"] }, dedupeKey: { startsWith: "hours:auto:" } }, data: { status: "EXPIRED" } });
  } else {
    await refreshSmartHoursSuggestions(workspaceId);
  }
  return { smartHours: on };
}

/* ── Scheduler ───────────────────────────────────────────────────────────── */

let handle: NodeJS.Timeout | null = null;
let running = false;
const PER_TICK = 10;

/** One pass: accounts whose hourly report is a day old (with recent spend), then their workspaces' suggestions. */
export async function hoursTick(now = new Date()) {
  if (running) return;
  running = true;
  try {
    const since = new Date(now.getTime() - WINDOW_DAYS * DAY);
    const accounts = await prisma.adAccount.findMany({
      where: {
        isActive: true,
        archivedAt: null,
        platform: { in: ["META", "GOOGLE", "TIKTOK"] },
        OR: [{ hoursSyncedAt: null }, { hoursSyncedAt: { lt: new Date(now.getTime() - 20 * 3_600_000) } }],
        campaigns: { some: { metrics: { some: { date: { gte: since }, spend: { gt: 0 } } } } },
      },
      orderBy: { hoursSyncedAt: { sort: "asc", nulls: "first" } },
      take: PER_TICK,
    });
    const workspaces = new Set<string>();
    for (const a of accounts) {
      try {
        await syncAccountHours(a, now);
        workspaces.add(a.workspaceId);
      } catch (err) {
        console.error(`[hours] ${a.platform} account ${a.id}:`, err instanceof Error ? err.message : err);
        // Try again tomorrow rather than every hour.
        await prisma.adAccount.update({ where: { id: a.id }, data: { hoursSyncedAt: now } }).catch(() => {});
      }
    }
    for (const w of workspaces) await refreshSmartHoursSuggestions(w, now).catch((err) => console.error("[hours] suggestions", w, err instanceof Error ? err.message : err));
  } finally {
    running = false;
  }
}

/** Hourly check; each account's report is pulled once a day. Disable with SMART_HOURS_ENABLED=false. */
export function startHoursScheduler() {
  if ((process.env.SMART_HOURS_ENABLED ?? "true").toLowerCase() === "false" || handle) return;
  setTimeout(() => {
    void hoursTick();
    handle = setInterval(() => void hoursTick(), 3_600_000);
  }, 240_000);
  console.log("[hours] smart hours report scheduled daily per account");
}
