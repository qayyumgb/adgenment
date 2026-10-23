import type { Platform } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { EXTRAPOLATE, fitCurve, type Curve, type Point } from "../lib/curves";
import { ActionError, budgetBlocker, setDailyBudget, type CampaignWithAccount } from "./campaign-actions.service";
import { changeLog } from "./change-log.service";

/**
 * The Budgets allocator (plan A11): for one client, the daily budget on each
 * platform (sum of its active daily-budget campaigns), a response curve fitted
 * from that platform's daily results, and safe bounds for moving budget.
 * The web page does the what-if maths on the curves.
 *
 * Applying (decisions 2026-10-22): a platform's new daily total is split
 * across its campaigns in proportion to today's budgets (everyone moves by
 * the same %). Live Meta campaigns change on Meta now, each logged with Undo;
 * Google / TikTok / LinkedIn (read-only syncs) and budgets set on ad sets are
 * reported as "change it in the platform".
 */

const DAY = 86_400_000;
const WINDOW_DAYS = 60;
const PLATFORM_NAME: Record<string, string> = { META: "Meta", GOOGLE: "Google Ads", TIKTOK: "TikTok", LINKEDIN: "LinkedIn" };

type AllocCampaign = CampaignWithAccount;

async function loadClient(workspaceId: string, clientId: string | null) {
  const clients = await prisma.client.findMany({ where: { workspaceId }, orderBy: [{ isDefault: "desc" }, { name: "asc" }], select: { id: true, name: true, monthlyBudget: true, currency: true } });
  return { clients, client: clients.find((c) => c.id === clientId) ?? null };
}

/** Active campaigns with a daily budget: the ones a platform total is made of. */
async function allocatable(workspaceId: string, clientId: string): Promise<AllocCampaign[]> {
  return prisma.campaign.findMany({
    where: { workspaceId, status: "ACTIVE", budgetType: "DAILY", budget: { gt: 0 }, adAccount: { clientId, isActive: true } },
    include: { adAccount: true },
    orderBy: { name: "asc" },
  });
}

export async function allocatorData(workspaceId: string, requestedClientId: string | null) {
  const { clients } = await loadClient(workspaceId, requestedClientId);
  // "All clients": start with the first client that has something to allocate.
  let clientId = requestedClientId && clients.some((c) => c.id === requestedClientId) ? requestedClientId : null;
  if (!clientId) {
    for (const c of clients) {
      if ((await prisma.campaign.count({ where: { workspaceId, status: "ACTIVE", budgetType: "DAILY", adAccount: { clientId: c.id } } })) > 0) {
        clientId = c.id;
        break;
      }
    }
    clientId ??= clients[0]?.id ?? null;
  }
  const client = clients.find((c) => c.id === clientId) ?? null;
  const base = { clients: clients.map((c) => ({ id: c.id, name: c.name })), clientId, windowDays: WINDOW_DAYS };
  if (!client) return { ...base, currency: null, mixedCurrency: false, metric: "revenue" as const, platforms: [], month: null };

  const campaigns = await allocatable(workspaceId, client.id);
  const accounts = await prisma.adAccount.findMany({ where: { workspaceId, clientId: client.id, isActive: true }, select: { currency: true } });
  const currencies = [...new Set(accounts.map((a) => a.currency).filter((c): c is string => !!c))];
  const currency = client.currency ?? currencies[0] ?? null;

  // Daily results per platform over the window (every campaign of the client, any status).
  const since = new Date(Date.now() - WINDOW_DAYS * DAY);
  const all = await prisma.campaign.findMany({ where: { workspaceId, adAccount: { clientId: client.id } }, select: { id: true, platform: true } });
  const platformOf = new Map(all.map((c) => [c.id, c.platform]));
  const rows = all.length
    ? await prisma.campaignMetrics.findMany({ where: { campaignId: { in: all.map((c) => c.id) }, date: { gte: since } }, select: { campaignId: true, date: true, spend: true, revenue: true, conversions: true } })
    : [];
  const daily = new Map<string, Map<string, { spend: number; revenue: number; conversions: number }>>();
  for (const r of rows) {
    const p = platformOf.get(r.campaignId)!;
    const day = r.date.toISOString().slice(0, 10);
    const byDay = daily.get(p) ?? new Map();
    const d = byDay.get(day) ?? { spend: 0, revenue: 0, conversions: 0 };
    d.spend += Number(r.spend);
    d.revenue += Number(r.revenue);
    d.conversions += r.conversions;
    byDay.set(day, d);
    daily.set(p, byDay);
  }
  // Revenue when the client records it, otherwise conversions.
  const totalRevenue = rows.reduce((a, r) => a + Number(r.revenue), 0);
  const metric: "revenue" | "conversions" = totalRevenue > 0 ? "revenue" : "conversions";

  const platforms = [...new Set(campaigns.map((c) => c.platform))].map((platform) => {
    const mine = campaigns.filter((c) => c.platform === platform);
    const current = Math.round(mine.reduce((a, c) => a + Number(c.budget), 0) * 100) / 100;
    const days = [...(daily.get(platform)?.values() ?? [])];
    const points: Point[] = days.map((d) => ({ spend: d.spend, value: metric === "revenue" ? d.revenue : d.conversions }));
    const fit = mixedCurrency(currencies) ? ({ ok: false, reason: "This client's ad accounts use different currencies.", points: points.length } as const) : fitCurve(points);
    const last30 = days.slice(-30);
    const avg = (f: (d: { spend: number; revenue: number; conversions: number }) => number) => (last30.length ? last30.reduce((a, d) => a + f(d), 0) / Math.max(1, last30.length) : 0);
    const curve: Curve | null = fit.ok ? fit.curve : null;
    const max = fit.ok ? Math.max(current, Math.min(current * 2, EXTRAPOLATE * fit.observedMax)) : current;
    return {
      platform,
      name: PLATFORM_NAME[platform] ?? platform,
      currentDaily: current,
      curve,
      fit: fit.ok ? { r2: +fit.r2.toFixed(2), points: fit.points, observedMax: Math.round(fit.observedMax * 100) / 100 } : null,
      noCurveReason: fit.ok ? null : fit.reason,
      bounds: { min: fit.ok ? Math.round(current * 0.5 * 100) / 100 : current, max: Math.round(max * 100) / 100 },
      avgDaily: { spend: Math.round(avg((d) => d.spend) * 100) / 100, value: Math.round(avg((d) => (metric === "revenue" ? d.revenue : d.conversions)) * 100) / 100 },
      // Meta campaigns change on Meta; the others are read-only syncs.
      writable: platform === "META",
      campaigns: mine.map((c) => ({ id: c.id, name: c.name, budget: Number(c.budget), blocker: platform === "META" ? budgetBlocker(c) : `Change it in ${PLATFORM_NAME[platform] ?? platform}: Advertix only reads ${PLATFORM_NAME[platform] ?? platform} for now.`, minDailyBudget: c.adAccount.minDailyBudget })),
    };
  });

  // This month, for "fit to the monthly budget".
  const now = new Date();
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const nextMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
  const daysInMonth = Math.round((nextMonth.getTime() - monthStart.getTime()) / DAY);
  const spentThisMonth = rows.filter((r) => r.date >= monthStart).reduce((a, r) => a + Number(r.spend), 0);
  const month =
    client.monthlyBudget == null
      ? null
      : { budget: Number(client.monthlyBudget), spent: Math.round(spentThisMonth * 100) / 100, daysLeft: daysInMonth - now.getUTCDate() + 1, daysInMonth };

  return { ...base, clientId: client.id, currency, mixedCurrency: mixedCurrency(currencies), metric, platforms, month };
}

const mixedCurrency = (c: string[]) => c.length > 1;

export type ApplyResult = { campaignId: string; name: string; platform: Platform; from: number; to: number; status: "applied" | "skipped" | "failed"; reason: string | null };

export async function applyAllocation(workspaceId: string, userId: string, clientId: string, targets: Record<string, unknown>) {
  if (!clientId) throw new ActionError(400, "Pick a client.");
  const campaigns = await allocatable(workspaceId, clientId);
  const results: ApplyResult[] = [];
  for (const [platform, raw] of Object.entries(targets ?? {})) {
    const target = Number(raw);
    if (!Number.isFinite(target) || target <= 0) throw new ActionError(400, `The ${PLATFORM_NAME[platform] ?? platform} budget must be above zero.`);
    const mine = campaigns.filter((c) => c.platform === platform);
    const current = mine.reduce((a, c) => a + Number(c.budget), 0);
    if (!mine.length || Math.abs(target - current) < 0.01) continue;
    const ratio = target / current;
    for (const c of mine) {
      const from = Number(c.budget);
      const to = Math.round(from * ratio * 100) / 100;
      const row = { campaignId: c.id, name: c.name, platform: c.platform, from, to };
      if (Math.abs(to - from) < 0.01) continue;
      const blocker = c.platform === "META" ? budgetBlocker(c) : `Change it in ${PLATFORM_NAME[c.platform] ?? c.platform}: Advertix only reads it for now.`;
      if (blocker) {
        results.push({ ...row, status: "skipped", reason: blocker });
        continue;
      }
      try {
        await setDailyBudget(c, to);
        await changeLog.record({
          workspaceId,
          campaignId: c.id,
          campaignName: c.name,
          clientId,
          currency: c.adAccount.currency,
          actorType: "USER",
          userId,
          action: "campaign.budget",
          before: { budget: from, budgetType: "DAILY" },
          after: { budget: to, budgetType: "DAILY" },
          platformPushed: true,
          note: "(Budgets allocator)",
        });
        results.push({ ...row, status: "applied", reason: null });
      } catch (err) {
        results.push({ ...row, status: "failed", reason: err instanceof Error ? err.message : "Meta refused the change." });
      }
    }
  }
  return {
    results,
    applied: results.filter((r) => r.status === "applied").length,
    skipped: results.filter((r) => r.status === "skipped").length,
    failed: results.filter((r) => r.status === "failed").length,
  };
}
