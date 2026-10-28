import type { PlanType, Workspace } from "@prisma/client";
import { prisma } from "./prisma";

/**
 * What a workspace is entitled to (plan C11): the one place that turns the
 * stored plan + Stripe subscription + trial into limits. Same numbers as the
 * pricing page (apps/web/lib/marketing/pricing.ts).
 *
 *  - TRIAL: 14 days, no card, Team limits (5 clients, 5 seats) with 100 AI credits.
 *  - ACTIVE / PAST_DUE: the subscribed plan (past due keeps working while Stripe retries).
 *  - EXPIRED: no plan after the trial: AI stops, nothing new can be added; nothing is deleted.
 */

export type Tier = "FOUNDER" | "TEAM" | "AGENCY" | "ENTERPRISE";
export type BillingState = "TRIAL" | "ACTIVE" | "PAST_DUE" | "EXPIRED";
export const TRIAL_DAYS = 14;
const DAY = 86_400_000;

export const TIER_OF: Partial<Record<PlanType, Tier>> = { FOUNDER: "FOUNDER", STARTER: "TEAM", PRO: "AGENCY", ENTERPRISE: "ENTERPRISE" };
export const PLAN_OF: Record<Exclude<Tier, "ENTERPRISE">, PlanType> = { FOUNDER: "FOUNDER", TEAM: "STARTER", AGENCY: "PRO" };
/** Monthly price in USD (yearly = 10 months). */
export const PRICE: Record<Exclude<Tier, "ENTERPRISE">, number> = { FOUNDER: 22, TEAM: 79, AGENCY: 199 };

type Limits = { clients: number; seats: number; credits: number | null; clientViewersFree: boolean };
const LIMITS: Record<Tier, Limits> = {
  FOUNDER: { clients: 1, seats: 2, credits: 100, clientViewersFree: false },
  TEAM: { clients: 5, seats: 5, credits: 400, clientViewersFree: false },
  AGENCY: { clients: 10, seats: 10, credits: null, clientViewersFree: true },
  ENTERPRISE: { clients: Infinity, seats: Infinity, credits: null, clientViewersFree: true },
};
const TRIAL: Limits = { ...LIMITS.TEAM, credits: 100 };
const EXPIRED: Limits = { ...LIMITS.FOUNDER, credits: 0 };

type BillingFields = Pick<Workspace, "plan" | "trialEndsAt" | "subscriptionStatus" | "currentPeriodStart" | "currentPeriodEnd" | "cancelAtPeriodEnd" | "planInterval" | "stripeCustomerId">;

export function entitlement(ws: BillingFields, now = new Date()) {
  const tier = TIER_OF[ws.plan];
  // A plan set by hand (a comped workspace, never billed through Stripe) stays as set.
  const manual = Boolean(tier) && !ws.subscriptionStatus;
  const subscribed = manual || Boolean(ws.subscriptionStatus && ["active", "trialing", "past_due"].includes(ws.subscriptionStatus));
  let state: BillingState;
  let limits: Limits;
  if (ws.plan === "ENTERPRISE") {
    state = "ACTIVE";
    limits = LIMITS.ENTERPRISE;
  } else if (subscribed && tier) {
    state = ws.subscriptionStatus === "past_due" ? "PAST_DUE" : "ACTIVE";
    limits = LIMITS[tier];
  } else if (ws.trialEndsAt && ws.trialEndsAt > now) {
    state = "TRIAL";
    limits = TRIAL;
  } else {
    state = "EXPIRED";
    limits = EXPIRED;
  }
  const trialDaysLeft = ws.trialEndsAt ? Math.max(0, Math.ceil((ws.trialEndsAt.getTime() - now.getTime()) / DAY)) : 0;
  return {
    state,
    tier: state === "ACTIVE" || state === "PAST_DUE" ? (tier ?? null) : null,
    limits,
    trialEndsAt: ws.trialEndsAt,
    trialDaysLeft: state === "TRIAL" ? trialDaysLeft : 0,
    interval: ws.planInterval as "month" | "year" | null,
    /**
     * The credits period: the subscription's billing period; the trial's own
     * 14 days (100 credits for the whole trial, not 100 per calendar month);
     * else null = the calendar month.
     */
    period:
      subscribed && ws.currentPeriodStart && ws.currentPeriodEnd
        ? { start: ws.currentPeriodStart, end: ws.currentPeriodEnd }
        : state === "TRIAL" && ws.trialEndsAt
          ? { start: new Date(ws.trialEndsAt.getTime() - TRIAL_DAYS * DAY), end: ws.trialEndsAt }
          : null,
    renewsAt: subscribed ? ws.currentPeriodEnd : null,
    cancelAtPeriodEnd: Boolean(subscribed && ws.cancelAtPeriodEnd),
    hasCustomer: Boolean(ws.stripeCustomerId),
  };
}
export type Entitlement = ReturnType<typeof entitlement>;

/**
 * The workspace's entitlement. Workspaces from before billing get their 14
 * days from the first time this runs, so nobody is cut off on deploy day.
 */
export async function workspaceEntitlement(workspaceId: string, now = new Date()) {
  let ws = await prisma.workspace.findUniqueOrThrow({ where: { id: workspaceId } });
  if (!ws.trialEndsAt) ws = await prisma.workspace.update({ where: { id: workspaceId }, data: { trialEndsAt: new Date(now.getTime() + TRIAL_DAYS * DAY) } });
  return { ws, ...entitlement(ws, now) };
}

export const trialEnd = (from = new Date()) => new Date(from.getTime() + TRIAL_DAYS * DAY);
