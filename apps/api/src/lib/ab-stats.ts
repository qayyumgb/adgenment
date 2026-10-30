/**
 * A/B test maths (Experiments, C9): the chance each version is the best one,
 * by sampling from Bayesian posteriors.
 *
 * - Cost goals ("purchase", "click"): results arrive at a rate per unit of
 *   spend, results ~ Poisson(rate × spend), rate ~ Gamma(1 + results, spend).
 *   Higher rate = cheaper per result.
 * - "ctr": clicks out of impressions, Beta(1 + clicks, 1 + non-clicks).
 *
 * A fixed seed keeps the number steady between page loads.
 */

export type Goal = "purchase" | "click" | "ctr";
export type Arm = { spend: number; impressions: number; clicks: number; conversions: number };

/** Small, fast, seeded PRNG (mulberry32). */
function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function normal(r: () => number) {
  let u = 0;
  while (u === 0) u = r();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * r());
}

/** Gamma(shape, 1) by Marsaglia–Tsang (shape < 1 boosted). */
function gamma(shape: number, r: () => number): number {
  if (shape < 1) return gamma(shape + 1, r) * Math.pow(r() || 1e-12, 1 / shape);
  const d = shape - 1 / 3;
  const c = 1 / Math.sqrt(9 * d);
  for (;;) {
    let x: number;
    let v: number;
    do {
      x = normal(r);
      v = 1 + c * x;
    } while (v <= 0);
    v = v * v * v;
    const u = r();
    if (u < 1 - 0.0331 * x ** 4 || Math.log(u) < 0.5 * x * x + d * (1 - v + Math.log(v))) return d * v;
  }
}

const successes = (a: Arm, goal: Goal) => (goal === "purchase" ? a.conversions : a.clicks);

/** One draw of each arm's "goodness" (higher = better). */
function draw(arms: Arm[], goal: Goal, r: () => number) {
  return arms.map((a) => {
    if (goal === "ctr") {
      const x = gamma(1 + a.clicks, r);
      const y = gamma(1 + Math.max(0, a.impressions - a.clicks), r);
      return x / (x + y);
    }
    // Rate per unit of spend; a sliver of spend keeps an unspent arm defined.
    return gamma(1 + successes(a, goal), r) / Math.max(a.spend, 1e-6);
  });
}

/** Chance each arm is the best (sums to 1). */
export function probBest(arms: Arm[], goal: Goal, draws = 20_000, seed = 7): number[] {
  if (arms.length < 2) return arms.map(() => 1);
  const r = rng(seed);
  const wins = arms.map(() => 0);
  for (let i = 0; i < draws; i++) {
    const v = draw(arms, goal, r);
    let best = 0;
    for (let j = 1; j < v.length; j++) if (v[j] > v[best]) best = j;
    wins[best]++;
  }
  return wins.map((w) => w / draws);
}

/** Cost per result (or CTR) as people read it. */
export function metricOf(a: Arm, goal: Goal): number | null {
  if (goal === "ctr") return a.impressions > 0 ? a.clicks / a.impressions : null;
  const s = successes(a, goal);
  return s > 0 ? a.spend / s : null;
}

export const CONCLUSIVE = 0.95;

/**
 * How much more data (×, at today's pace and rates) until the leader is 95%
 * likely best; null if it wouldn't get there within 8× (it's too close to call).
 */
export function dataNeeded(arms: Arm[], goal: Goal): number | null {
  const p = probBest(arms, goal, 6_000);
  const lead = p.indexOf(Math.max(...p));
  if (p[lead] >= CONCLUSIVE) return 1;
  for (const k of [1.25, 1.5, 2, 3, 4, 6, 8]) {
    const scaled = arms.map((a) => ({ spend: a.spend * k, impressions: a.impressions * k, clicks: a.clicks * k, conversions: a.conversions * k }));
    const q = probBest(scaled, goal, 6_000);
    if (q[lead] >= CONCLUSIVE) return k;
  }
  return null;
}
