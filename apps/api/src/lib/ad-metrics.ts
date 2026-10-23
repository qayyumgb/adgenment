import { prisma } from "./prisma";

/**
 * Ad-level results shared by the campaign ad-set view and the Creatives
 * board (plan B4 / A8): period totals per ad and the creative-fatigue read.
 */

export type Totals = { spend: number; impressions: number; clicks: number; conversions: number; revenue: number; landingPageViews: number; addToCart: number };
export const zero = (): Totals => ({ spend: 0, impressions: 0, clicks: 0, conversions: 0, revenue: 0, landingPageViews: 0, addToCart: 0 });

export const ctrOf = (t: { impressions: number; clicks: number }) => (t.impressions > 0 ? t.clicks / t.impressions : null);

/**
 * Creative fatigue: frequency (30 days) and the change in CTR between the
 * last 7 days and the 7 before. The CTR signal needs 1,000+ impressions in
 * both weeks to count.
 */
export function fatigueOf(frequency: number, recent: Totals, prior: Totals) {
  const r = ctrOf(recent);
  const p = ctrOf(prior);
  const enough = recent.impressions >= 1000 && prior.impressions >= 1000 && r !== null && p !== null && p > 0;
  const drop = enough ? (p! - r!) / p! : 0;
  const pct = (v: number) => `${(v * 100).toFixed(2)}%`;
  const f = frequency.toFixed(1);
  if (frequency >= 4) return { level: "fatigued" as const, reason: `Frequency ${f}: most of this audience has seen it several times.` };
  if (frequency >= 2.5 && drop >= 0.3)
    return { level: "fatigued" as const, reason: `CTR fell ${Math.round(drop * 100)}% week on week (${pct(p!)} → ${pct(r!)}) at frequency ${f}.` };
  if (frequency >= 3) return { level: "watch" as const, reason: `Frequency ${f} and climbing. Have a fresh variant ready.` };
  if (drop >= 0.2) return { level: "watch" as const, reason: `CTR down ${Math.round(drop * 100)}% week on week (${pct(p!)} → ${pct(r!)}).` };
  return { level: "ok" as const, reason: null };
}

export type FatigueRead = ReturnType<typeof fatigueOf>;

const DAY = 24 * 60 * 60 * 1000;

/** Sum AdMetrics per ad id between `since` (inclusive) and `until` (exclusive). */
export async function sumAdMetrics(adIds: string[], since: number, until?: number): Promise<Map<string, Totals>> {
  if (adIds.length === 0) return new Map();
  const rows = await prisma.adMetrics.groupBy({
    by: ["adId"],
    where: { adId: { in: adIds }, date: { gte: new Date(since), ...(until ? { lt: new Date(until) } : {}) } },
    _sum: { spend: true, impressions: true, clicks: true, conversions: true, revenue: true, landingPageViews: true, addToCart: true },
  });
  return new Map(
    rows.map((r) => [
      r.adId,
      {
        spend: Number(r._sum.spend ?? 0),
        impressions: r._sum.impressions ?? 0,
        clicks: r._sum.clicks ?? 0,
        conversions: r._sum.conversions ?? 0,
        revenue: Number(r._sum.revenue ?? 0),
        landingPageViews: r._sum.landingPageViews ?? 0,
        addToCart: r._sum.addToCart ?? 0,
      },
    ])
  );
}

/**
 * Period totals plus the two fatigue windows (the last 7 complete UTC days
 * and the 7 before; today is partial, so it's left out of both).
 */
export async function adResults(adIds: string[], days: number) {
  const todayStart = new Date();
  todayStart.setUTCHours(0, 0, 0, 0);
  const today = todayStart.getTime();
  const [period, recent, prior] = await Promise.all([
    sumAdMetrics(adIds, today - days * DAY),
    sumAdMetrics(adIds, today - 7 * DAY, today),
    sumAdMetrics(adIds, today - 14 * DAY, today - 7 * DAY),
  ]);
  return {
    totals: (id: string) => period.get(id) ?? zero(),
    fatigue: (id: string, frequency: number) => fatigueOf(frequency, recent.get(id) ?? zero(), prior.get(id) ?? zero()),
  };
}
