"use client";

import { useEffect } from "react";
import { useApi } from "@/hooks/useApi";
import { PLAN_LOCKED_EVENT, type PaidTier, type PlanFeature } from "@/lib/api";

/**
 * The workspace's plan (C15), from /auth/me (already loaded by the shell, so
 * no extra request). Same rules as the API (apps/api/src/lib/plans.ts): the
 * API enforces them; this only shows them.
 */

export const FEATURE_TIER: Record<PlanFeature, PaidTier> = { approvals: "TEAM", automation: "AGENCY", portal: "AGENCY", reports: "AGENCY" };
export const FEATURE_LABEL: Record<PlanFeature, string> = { approvals: "Approvals", automation: "Auto-apply and safety rules", portal: "Client portal links", reports: "Scheduled client reports" };
export const TIER_LABEL: Record<PaidTier, string> = { FOUNDER: "Founder", TEAM: "Team", AGENCY: "Agency" };

export function usePlan() {
  const me = useApi((c) => c.getMe(), [], { key: "me" });
  const plan = me.data?.plan ?? null;
  return {
    plan,
    loading: me.loading,
    locked: Boolean(plan?.locked),
    /** Unknown (still loading, or an older API) counts as included, so nothing flashes locked. */
    has: (f: PlanFeature) => !plan || plan.features.includes(f),
    refetch: me.refetch,
  };
}

/** Refetch the plan when any request comes back locked (the trial ended mid-session). */
export function usePlanLockListener(refetch: () => Promise<void>) {
  useEffect(() => {
    const on = () => void refetch();
    window.addEventListener(PLAN_LOCKED_EVENT, on);
    return () => window.removeEventListener(PLAN_LOCKED_EVENT, on);
  }, [refetch]);
}
