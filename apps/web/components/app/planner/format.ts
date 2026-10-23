import type { AiPlan, PlannerTurn } from "@/lib/api";
import { fmtMoney } from "@/lib/money";

/** Formatting and small derivations for the AI Planner (plan A12). */

export const STEP_LABELS = ["Read 30 days of performance", "Compared campaigns across platforms", "Checked creative fatigue and audience overlap", "Built budget split and timeline"];

export const money = (plan: Pick<AiPlan, "currency">, n: number) => fmtMoney(n, plan.currency, { whole: true });

/** ROAS ("4.30x") or cost per result ("$18 per result"). */
export function ratioText(plan: Pick<AiPlan, "metric" | "currency">, r: number | null | undefined, short = false) {
  if (r == null || !Number.isFinite(r)) return "—";
  return plan.metric === "revenue" ? `${r.toFixed(2)}x` : `${fmtMoney(r, plan.currency)}${short ? "" : " per result"}`;
}

export const fmtDay = (isoDay: string) => new Date(`${isoDay}T00:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });
export const fmtRange = (a: string, b: string) => (a === b ? fmtDay(a) : `${fmtDay(a)} – ${fmtDay(b)}`);

export function targetText(plan: AiPlan) {
  if (plan.target.metric === "roas") return `${plan.target.value}x`;
  if (plan.target.metric === "cpa") return `${fmtMoney(plan.target.value, plan.currency)} per result`;
  return "None set";
}

/** The plan as plain text, for pasting into an email or a doc. */
export function planSummaryText(plan: AiPlan) {
  const m = (n: number) => money(plan, n);
  const lines = [
    `${plan.title} (${plan.clientName})`,
    `${m(plan.budget)} over ${plan.days} days, ${fmtRange(plan.start, plan.end)}${plan.target.metric !== "none" ? ` · target ${targetText(plan)}` : ""}`,
    "",
    ...(plan.phases.length ? ["Timeline:", ...plan.phases.map((p) => `- ${p.name}: ${fmtRange(p.start, p.end)}`), ""] : []),
    "Campaigns:",
    ...plan.campaigns.map((c) => `- ${c.name} (${c.platform}): ${m(c.daily)}/day, ${m(c.total)} total (${c.share}%) · ${c.audience}${c.needs.length ? ` · needs ${c.needs.join(", ")}` : ""}`),
    "",
    plan.forecast
      ? `Forecast: ${plan.metric === "revenue" ? `${m(plan.forecast.value)} revenue` : `${Math.round(plan.forecast.value)} results`} at ${ratioText(plan, plan.forecast.ratio)}${plan.forecast.low != null && plan.forecast.high != null ? ` (range ${plan.metric === "revenue" ? `${m(plan.forecast.low)} – ${m(plan.forecast.high)}` : `${Math.round(plan.forecast.low)} – ${Math.round(plan.forecast.high)}`})` : ""}, from ${plan.forecast.basis}.`
      : (plan.forecastNote ?? ""),
    ...(plan.watchOuts.length ? ["", "Watch-outs:", ...plan.watchOuts.map((w) => `- ${w}`)] : []),
  ];
  return lines.join("\n");
}

export type Refinement = { label: string; message: string };

/**
 * Refinement chips for a plan: lean into the platform whose history returns
 * best (when the plan has more than one), cut the budget, stretch the dates.
 */
export function refinements(plan: AiPlan): Refinement[] {
  const out: Refinement[] = [];
  const byPlatform = new Map<string, { share: number; ratio: number | null }>();
  for (const c of plan.campaigns.filter((x) => !x.blocker)) {
    const e = byPlatform.get(c.platform) ?? { share: 0, ratio: c.expected?.ratio ?? null };
    e.share += c.share;
    byPlatform.set(c.platform, e);
  }
  if (byPlatform.size > 1) {
    const better = (a: number, b: number) => (plan.metric === "revenue" ? a > b : a < b);
    const largest = [...byPlatform.entries()].sort((a, b) => b[1].share - a[1].share)[0][0];
    const best = [...byPlatform.entries()].filter(([, v]) => v.ratio != null).sort((a, b) => (better(a[1].ratio!, b[1].ratio!) ? -1 : 1))[0];
    const pick = best && best[0] !== largest ? best[0] : [...byPlatform.keys()].find((p) => p !== largest);
    if (pick) {
      const name = { META: "Meta", GOOGLE: "Google", TIKTOK: "TikTok", LINKEDIN: "LinkedIn" }[pick] ?? pick;
      out.push({ label: `Make it ${name}-heavy`, message: `Make it more ${name}-heavy.` });
    }
  }
  out.push({ label: "Cut budget by a third", message: "Cut the budget by a third." });
  out.push({ label: "Stretch by a week", message: "Stretch it by a week." });
  return out;
}

/** What gets saved per version: the plan and the conversation that produced it. */
export type SavedVersionPlan = AiPlan & { chat?: PlannerTurn[] };
