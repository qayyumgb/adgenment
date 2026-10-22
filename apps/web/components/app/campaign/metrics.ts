import type { CampaignMetric } from "@/lib/api";

/** One day of campaign numbers (zeros on days without a metric row). */
export type Day = { date: string; spend: number; revenue: number; impressions: number; clicks: number; conversions: number };
export type Totals = Omit<Day, "date">;

export const ZERO: Totals = { spend: 0, revenue: 0, impressions: 0, clicks: 0, conversions: 0 };

export function sum(days: Day[]): Totals {
  return days.reduce(
    (a, d) => ({
      spend: a.spend + d.spend,
      revenue: a.revenue + d.revenue,
      impressions: a.impressions + d.impressions,
      clicks: a.clicks + d.clicks,
      conversions: a.conversions + d.conversions,
    }),
    ZERO
  );
}

export const roas = (t: Totals) => (t.spend > 0 && t.revenue > 0 ? t.revenue / t.spend : null);
export const cpa = (t: Totals) => (t.conversions > 0 ? t.spend / t.conversions : null);
export const ctr = (t: Totals) => (t.impressions > 0 ? (t.clicks / t.impressions) * 100 : null);

/** Last `n` UTC days, oldest first, ending today, filled from the metric rows. */
export function dailySeries(rows: CampaignMetric[], n: number, endOffset = 0): Day[] {
  const byDate = new Map(rows.map((m) => [m.date.slice(0, 10), m]));
  const now = new Date();
  const out: Day[] = [];
  for (let i = n - 1 + endOffset; i >= endOffset; i--) {
    const date = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - i)).toISOString().slice(0, 10);
    const m = byDate.get(date);
    out.push({
      date,
      spend: m ? Number(m.spend) || 0 : 0,
      revenue: m ? Number(m.revenue) || 0 : 0,
      impressions: m?.impressions ?? 0,
      clicks: m?.clicks ?? 0,
      conversions: m?.conversions ?? 0,
    });
  }
  return out;
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
/** "2026-10-14" → "14 Oct" */
export const dayLabel = (iso: string) => {
  const [, m, d] = iso.split("-").map(Number);
  return `${d} ${MONTHS[m - 1]}`;
};

/** % change, or null when there's no previous value to compare with. */
export const pct = (c: number | null, p: number | null) => (c === null || p === null || p === 0 ? null : ((c - p) / p) * 100);
