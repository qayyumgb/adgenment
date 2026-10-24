import { prisma } from "../lib/prisma";
import { clientMark, ensureClients } from "../lib/clients";

/**
 * Monthly pacing per client (B1; shared by GET /budgets/pacing and the pacing
 * email alerts, A14). Month-to-date spend against each client's monthly
 * budget, with a straight-line projection. Months are UTC calendar months.
 * Spend is summed in each account's own currency; clients whose accounts mix
 * currencies get a raw sum (flagged with `mixedCurrency`).
 */

/** Above this share of the budget (projected) a client is "ahead". */
const AHEAD = 1.03;
/** Below this share (projected) a client is "behind". */
const BEHIND = 0.9;

export type PacingStatus = "ON_TRACK" | "AHEAD" | "BEHIND" | "NO_BUDGET" | "NO_SPEND";

export class PacingError extends Error {}

export async function computePacing(workspaceId: string, scope: string | null, monthParam?: unknown, now = new Date()) {
  await ensureClients(workspaceId);

  const m = typeof monthParam === "string" ? /^(\d{4})-(\d{2})$/.exec(monthParam) : null;
  const year = m ? Number(m[1]) : now.getUTCFullYear();
  const month = m ? Number(m[2]) - 1 : now.getUTCMonth();
  if (month < 0 || month > 11) throw new PacingError("month must be YYYY-MM");
  const monthStart = new Date(Date.UTC(year, month, 1));
  const nextMonth = new Date(Date.UTC(year, month + 1, 1));
  const daysInMonth = Math.round((nextMonth.getTime() - monthStart.getTime()) / 86_400_000);
  const isCurrent = year === now.getUTCFullYear() && month === now.getUTCMonth();
  const isFuture = monthStart > now;
  const dayOfMonth = isFuture ? 0 : isCurrent ? now.getUTCDate() : daysInMonth;

  const clients = await prisma.client.findMany({
    where: { workspaceId, ...(scope ? { id: scope } : {}) },
    include: { adAccounts: { select: { id: true, platform: true, currency: true, isActive: true } } },
    orderBy: [{ isDefault: "desc" }, { name: "asc" }],
  });
  const accountToClient = new Map<string, string>();
  for (const c of clients) for (const a of c.adAccounts) accountToClient.set(a.id, c.id);

  const spendByClient = new Map<string, number>();
  if (accountToClient.size && !isFuture) {
    const campaigns = await prisma.campaign.findMany({
      where: { workspaceId, adAccountId: { in: [...accountToClient.keys()] } },
      select: { id: true, adAccountId: true },
    });
    const campaignToClient = new Map(campaigns.map((c) => [c.id, accountToClient.get(c.adAccountId)!]));
    if (campaignToClient.size) {
      const grouped = await prisma.campaignMetrics.groupBy({
        by: ["campaignId"],
        where: { campaignId: { in: [...campaignToClient.keys()] }, date: { gte: monthStart, lt: nextMonth } },
        _sum: { spend: true },
      });
      for (const g of grouped) {
        const cid = campaignToClient.get(g.campaignId);
        if (!cid) continue;
        spendByClient.set(cid, (spendByClient.get(cid) ?? 0) + Number(g._sum.spend ?? 0));
      }
    }
  }

  const expectedPct = daysInMonth ? dayOfMonth / daysInMonth : 0;
  const rows = clients.map((c) => {
    const budget = c.monthlyBudget == null ? null : Number(c.monthlyBudget);
    const spent = Math.round((spendByClient.get(c.id) ?? 0) * 100) / 100;
    const dailyRate = dayOfMonth > 0 ? spent / dayOfMonth : 0;
    const projected = Math.round(dailyRate * daysInMonth * 100) / 100;
    let status: PacingStatus;
    if (budget == null || budget <= 0) status = "NO_BUDGET";
    else if (spent === 0) status = "NO_SPEND";
    else if (projected > budget * AHEAD) status = "AHEAD";
    else if (projected < budget * BEHIND) status = "BEHIND";
    else status = "ON_TRACK";
    // Day of the month the budget runs out at the current rate (AHEAD only).
    const runOutDay = status === "AHEAD" && dailyRate > 0 ? Math.min(daysInMonth, Math.floor(budget! / dailyRate)) : null;
    const currencies = new Set(c.adAccounts.map((a) => a.currency).filter(Boolean));
    return {
      clientId: c.id,
      name: c.name,
      short: c.short ?? clientMark(c.name),
      monthlyBudget: budget,
      currency: c.currency ?? (currencies.size === 1 ? [...currencies][0] : null),
      mixedCurrency: currencies.size > 1,
      spent,
      spentPct: budget ? Math.round((spent / budget) * 1000) / 10 : null,
      projected,
      projectedPct: budget ? Math.round((projected / budget) * 1000) / 10 : null,
      status,
      runOutDay,
      unspentProjected: budget && status === "BEHIND" ? Math.round((budget - projected) * 100) / 100 : null,
      platforms: [...new Set(c.adAccounts.filter((a) => a.isActive).map((a) => a.platform))],
    };
  });

  return {
    month: `${year}-${String(month + 1).padStart(2, "0")}`,
    daysInMonth,
    dayOfMonth,
    expectedPct: Math.round(expectedPct * 1000) / 10,
    clients: rows,
  };
}
