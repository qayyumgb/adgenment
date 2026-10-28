import { prisma } from "../lib/prisma";
import { workspaceEntitlement } from "../lib/plans";
import { localParts, notifyMembers } from "./notifications.service";

/**
 * AI credits (plan C11). Each AI action uses credits; plans get a monthly
 * allowance that doesn't roll over: Founder 100, Team 400, Agency and
 * Enterprise unlimited. Checked before the AI runs (402 when it would go
 * over) and charged only after it succeeds. Owners are emailed once at 80%
 * and once at 100% each period.
 *
 * Limits follow the plan (lib/plans): the 14-day trial gets 100, an ended
 * trial none. The period is the subscription's billing period, or the
 * calendar month in the workspace's time zone when there is no subscription.
 */

export type CreditFeature = "plan" | "ask" | "copy" | "audience" | "insights" | "budget" | "image";

/** What each action costs. Images by quality: high-quality images cost ~30× a low one to make. */
export const CREDIT_COST = { plan: 1, ask: 1, copy: 1, audience: 1, insights: 1, budget: 1, image_low: 1, image_medium: 2, image_high: 5 } as const;
export const imageCost = (quality: string) => (quality === "high" ? CREDIT_COST.image_high : quality === "medium" ? CREDIT_COST.image_medium : CREDIT_COST.image_low);

export const FEATURE_LABEL: Record<CreditFeature, string> = {
  plan: "AI Planner",
  ask: "Ask about a campaign",
  copy: "Creative copy",
  audience: "Audience suggestions",
  insights: "AI checks",
  budget: "Budget analysis",
  image: "AI images",
};

const WARN_AT = 0.8;

const enforced = () => (process.env.AI_CREDITS_ENFORCED ?? "true").toLowerCase() !== "false";

/** The current period: the calendar month in the workspace's time zone, as UTC instants. */
function period(tz: string | null, now: Date) {
  const local = localParts(now, tz);
  const [y, m] = local.date.split("-").map(Number);
  // Midnight local on the 1st, found by stepping back from now by the local day/hour offset.
  const startLocal = new Date(Date.UTC(y, m - 1, 1));
  const nextLocal = new Date(Date.UTC(y, m, 1));
  const offset = now.getTime() - Date.UTC(y, m - 1, Number(local.date.slice(8, 10)), local.hour, now.getUTCMinutes(), now.getUTCSeconds(), now.getUTCMilliseconds());
  return { key: local.date.slice(0, 7), start: new Date(startLocal.getTime() + offset), end: new Date(nextLocal.getTime() + offset) };
}

export async function creditStatus(workspaceId: string, now = new Date()) {
  // Limits and the period come from the plan, trial or ended trial (lib/plans):
  // the subscription's billing period once there is one, else the calendar month.
  const ent = await workspaceEntitlement(workspaceId, now);
  const ws = ent.ws;
  const p = ent.period ?? period(ws.timezone, now);
  const rows = await prisma.aiUsage.groupBy({ by: ["feature"], where: { workspaceId, createdAt: { gte: p.start, lt: p.end } }, _sum: { credits: true } });
  const used = rows.reduce((a, r) => a + (r._sum.credits ?? 0), 0);
  const limit = ent.limits.credits;
  return {
    plan: ws.plan,
    billingState: ent.state,
    used,
    limit,
    remaining: limit === null ? null : Math.max(0, limit - used),
    /** 0–1 (null when unlimited). */
    share: limit === null ? null : Math.min(1, used / limit),
    warn: limit !== null && used >= limit * WARN_AT,
    exhausted: limit !== null && used >= limit,
    periodStart: p.start,
    resetsAt: p.end,
    byFeature: rows.map((r) => ({ feature: r.feature as CreditFeature, label: FEATURE_LABEL[r.feature as CreditFeature] ?? r.feature, credits: r._sum.credits ?? 0 })).sort((a, b) => b.credits - a.credits),
    enforced: enforced(),
  };
}

export class CreditsError extends Error {
  status = 402;
  code = "CREDITS_EXHAUSTED";
  constructor(
    message: string,
    public credits: { used: number; limit: number; resetsAt: Date }
  ) {
    super(message);
  }
}

/** Throw (402) when this action would go past the plan's credits. */
export async function requireCredits(workspaceId: string, cost: number) {
  if (!enforced()) return;
  const s = await creditStatus(workspaceId);
  if (s.limit === null || s.used + cost <= s.limit) return;
  const left = s.limit - s.used;
  throw new CreditsError(
    s.billingState === "EXPIRED"
      ? "Your free trial has ended. Choose a plan to keep using Advertix AI. Everything else keeps working."
      : left > 0
      ? `This needs ${cost} AI credits and you have ${left} left this month. Upgrade for more, or wait until they reset.`
      : `You've used all ${s.limit} AI credits for this month. Upgrade your plan for more, or wait until they reset.`,
    { used: s.used, limit: s.limit, resetsAt: s.resetsAt }
  );
}

/** Record a successful AI action, and email owners when it crosses 80% or 100%. */
export async function chargeCredits(workspaceId: string, userId: string | null, feature: CreditFeature, cost: number) {
  const before = await creditStatus(workspaceId);
  await prisma.aiUsage.create({ data: { workspaceId, userId, feature, credits: cost } });
  if (before.limit === null) return;
  const after = before.used + cost;
  const key = (mark: string) => `credits:${before.periodStart.toISOString().slice(0, 10)}:${mark}`;
  const crossed = after >= before.limit && before.used < before.limit ? "100" : after >= before.limit * WARN_AT && before.used < before.limit * WARN_AT ? "80" : null;
  if (!crossed) return;
  const ws = await prisma.workspace.findUniqueOrThrow({ where: { id: workspaceId }, select: { name: true } });
  const resets = before.resetsAt.toLocaleDateString("en-US", { day: "numeric", month: "long" });
  await notifyMembers(
    workspaceId,
    (m) => m.role === "OWNER",
    "USAGE",
    { key: key(crossed), clientId: null, line: crossed === "100" ? `All ${before.limit} AI credits are used. AI actions are paused until ${resets} unless you upgrade.` : `${after} of ${before.limit} AI credits are used this month. They reset on ${resets}.` },
    crossed === "100" ? "You've used all your AI credits" : "You've used 80% of your AI credits",
    `AI credits in ${ws.name}:`,
    { label: "See plans", path: "/settings?tab=billing" }
  ).catch((err) => console.error("[credits] email:", err instanceof Error ? err.message : err));
}
