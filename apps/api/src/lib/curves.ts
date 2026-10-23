/**
 * Spend → result response curves for the Budgets allocator (plan A11).
 *
 * Model: value(b) = A · (1 − e^(−b/k)) — each extra dollar returns less as
 * the budget grows (diminishing returns). Fitted per platform from daily
 * points (spend, revenue or conversions) by least squares: for a fixed k
 * the best A has a closed form, so we scan k on a log grid.
 *
 * Honest limits, surfaced to the UI:
 *  - fewer than MIN_POINTS days with spend → no curve;
 *  - spend that barely varies → no curve (nothing to learn the shape from);
 *  - beyond the range we've seen, the curve is a guess, so recommendations
 *    stay within EXTRAPOLATE × the highest daily spend observed.
 */

export type Point = { spend: number; value: number };
export type Curve = { A: number; k: number };

export const MIN_POINTS = 10;
export const EXTRAPOLATE = 1.5;

export const valueAt = (c: Curve, b: number) => c.A * (1 - Math.exp(-b / c.k));
/** What the next dollar returns at budget b. */
export const marginalAt = (c: Curve, b: number) => (c.A / c.k) * Math.exp(-b / c.k);

export type FitResult =
  | { ok: true; curve: Curve; r2: number; points: number; observedMax: number; observedMin: number }
  | { ok: false; reason: string; points: number };

export function fitCurve(points: Point[]): FitResult {
  const pts = points.filter((p) => p.spend > 0 && Number.isFinite(p.spend) && Number.isFinite(p.value) && p.value >= 0);
  if (pts.length < MIN_POINTS) {
    return { ok: false, points: pts.length, reason: `Only ${pts.length} day${pts.length === 1 ? "" : "s"} with spend; a curve needs at least ${MIN_POINTS}.` };
  }
  const spends = pts.map((p) => p.spend).sort((a, b) => a - b);
  const observedMin = spends[0];
  const observedMax = spends[spends.length - 1];
  const totalValue = pts.reduce((a, p) => a + p.value, 0);
  if (totalValue <= 0) return { ok: false, points: pts.length, reason: "No results recorded in this period." };
  // Spread of spend: below ~15% (10th–90th percentile) there's no shape to learn.
  const p10 = spends[Math.floor(spends.length * 0.1)];
  const p90 = spends[Math.min(spends.length - 1, Math.floor(spends.length * 0.9))];
  const median = spends[Math.floor(spends.length / 2)];
  if ((p90 - p10) / median < 0.15) {
    return { ok: false, points: pts.length, reason: "Daily spend barely changed, so there's no way to tell how results respond to more or less budget." };
  }

  let best: { A: number; k: number; sse: number } | null = null;
  for (let i = 0; i <= 80; i++) {
    const k = median * Math.pow(10, -1 + (i / 80) * 2.5); // 0.1× … ~31.6× the median spend
    let fy = 0;
    let ff = 0;
    for (const p of pts) {
      const f = 1 - Math.exp(-p.spend / k);
      fy += f * p.value;
      ff += f * f;
    }
    if (ff <= 0) continue;
    const A = fy / ff;
    let sse = 0;
    for (const p of pts) sse += (p.value - A * (1 - Math.exp(-p.spend / k))) ** 2;
    if (!best || sse < best.sse) best = { A, k, sse };
  }
  if (!best || best.A <= 0) return { ok: false, points: pts.length, reason: "The data didn't fit a spend–results curve." };
  const mean = totalValue / pts.length;
  const sst = pts.reduce((a, p) => a + (p.value - mean) ** 2, 0);
  const r2 = sst > 0 ? Math.max(0, 1 - best.sse / sst) : 0;
  return { ok: true, curve: { A: best.A, k: best.k }, r2, points: pts.length, observedMax, observedMin };
}
