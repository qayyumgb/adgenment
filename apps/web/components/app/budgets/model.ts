import type { AllocatorPlatform } from "@/lib/api";

/**
 * What-if maths for the Budgets allocator (plan A11), on the curves the API
 * fitted (apps/api/src/lib/curves.ts): value(b) = A · (1 − e^(−b/k)).
 * Platforms without a curve are fixed at today's budget and count at their
 * recent average.
 */

export type Mix = Record<string, number>;

export const valueAt = (p: AllocatorPlatform, b: number) => (p.curve ? p.curve.A * (1 - Math.exp(-b / p.curve.k)) : p.avgDaily.value);
/** What the next dollar returns at budget b (null without a curve). */
export const marginalAt = (p: AllocatorPlatform, b: number) => (p.curve ? (p.curve.A / p.curve.k) * Math.exp(-b / p.curve.k) : null);

export const currentMix = (ps: AllocatorPlatform[]): Mix => Object.fromEntries(ps.map((p) => [p.platform, p.currentDaily]));

/** The target total a platform set can reach within its bounds. */
export function reachable(ps: AllocatorPlatform[]) {
  return { min: ps.reduce((a, p) => a + p.bounds.min, 0), max: ps.reduce((a, p) => a + p.bounds.max, 0) };
}

/**
 * Advertix's mix for a daily total: start every platform at its lower bound,
 * then hand out the rest in small steps to whichever platform's next dollar
 * returns most, within each platform's bounds. Fixed platforms stay put.
 */
export function recommendMix(ps: AllocatorPlatform[], total: number): Mix {
  const mix: Mix = Object.fromEntries(ps.map((p) => [p.platform, p.bounds.min]));
  const r = reachable(ps);
  let left = Math.min(Math.max(total, r.min), r.max) - r.min;
  const step = Math.max(0.5, total / 400);
  while (left > 0.001) {
    let best: AllocatorPlatform | null = null;
    let bestValue = -Infinity;
    for (const p of ps) {
      if (!p.curve || mix[p.platform] >= p.bounds.max - 0.001) continue;
      const m = marginalAt(p, mix[p.platform] + step / 2)!;
      if (m > bestValue) {
        bestValue = m;
        best = p;
      }
    }
    if (!best) break;
    const add = Math.min(step, left, best.bounds.max - mix[best.platform]);
    mix[best.platform] += add;
    left -= add;
  }
  // Whole currency units read better than cents for daily budgets.
  for (const p of ps) mix[p.platform] = Math.round(mix[p.platform]);
  return mix;
}

export function project(ps: AllocatorPlatform[], mix: Mix) {
  const budget = ps.reduce((a, p) => a + (mix[p.platform] ?? p.currentDaily), 0);
  const value = ps.reduce((a, p) => a + valueAt(p, mix[p.platform] ?? p.currentDaily), 0);
  return { budget, value, ratio: budget > 0 ? value / budget : null };
}

/** The proportional split of a platform's new total (decision 2026-10-22), per campaign. */
export function splitPlatform(p: AllocatorPlatform, target: number) {
  const ratio = p.currentDaily > 0 ? target / p.currentDaily : 1;
  return p.campaigns.map((c) => ({ ...c, to: Math.round(c.budget * ratio * 100) / 100 }));
}
