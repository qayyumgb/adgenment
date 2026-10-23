"use client";

import { useState } from "react";
import toast from "react-hot-toast";
import { useApi } from "@/hooks/useApi";
import { useApiClient, type CampaignAd, type CampaignAdSet, type StructureTotals } from "@/lib/api";
import { fmtMoney } from "@/lib/money";
import type { PillTone } from "@/components/app/ui";

/**
 * Ad sets and ads of a campaign (plan B4): labels, plain reads and the
 * pause / resume / budget actions shared by the Overview, Ad sets and Ads tabs.
 */

export const FORMAT_LABEL: Record<CampaignAd["format"], string> = { IMAGE: "Image", VIDEO: "Video", CAROUSEL: "Carousel", UNKNOWN: "Ad" };

/** Frequency at which most audiences tune out; the fatigue bar is drawn against it. */
export const FREQ_CEILING = 5;

/** How it's delivering, in words ("Learning", "Campaign off", "In review"…). */
export function deliveryLabel(row: Pick<CampaignAdSet, "status" | "effectiveStatus"> & { learningStage?: string | null }): string {
  const eff = row.effectiveStatus;
  if (row.status === "ENDED" || eff === "DELETED" || eff === "ARCHIVED") return "Ended";
  switch (eff) {
    case "PAUSED":
      return "Paused";
    case "CAMPAIGN_PAUSED":
      return "Campaign off";
    case "ADSET_PAUSED":
      return "Ad set off";
    case "PENDING_REVIEW":
    case "IN_PROCESS":
    case "PREAPPROVED":
      return "In review";
    case "DISAPPROVED":
      return "Rejected";
    case "WITH_ISSUES":
      return "Has issues";
    case "PENDING_BILLING_INFO":
      return "Billing issue";
  }
  if (row.status === "ACTIVE") {
    if (row.learningStage === "LEARNING") return "Learning";
    if (row.learningStage === "FAIL") return "Learning limited";
    return "Active";
  }
  return row.status === "PAUSED" ? "Paused" : row.status === "DRAFT" ? "Draft" : "Ended";
}

export const DELIVERY_TONE: Record<string, PillTone> = {
  Active: "pos",
  Learning: "brand",
  "Learning limited": "warn",
  Paused: "warn",
  "Campaign off": "neutral",
  "Ad set off": "neutral",
  "In review": "brand",
  Rejected: "neg",
  "Has issues": "neg",
  "Billing issue": "neg",
  Draft: "neutral",
  Ended: "neutral",
};

export const roasOf = (t: StructureTotals) => (t.spend > 0 && t.revenue > 0 ? t.revenue / t.spend : null);
export const cpaOf = (t: StructureTotals) => (t.conversions > 0 ? t.spend / t.conversions : null);
export const ctrOf = (t: StructureTotals) => (t.impressions > 0 ? (t.clicks / t.impressions) * 100 : null);

/** One or two plain sentences about an ad set, from its own numbers. */
export function adSetRead(s: CampaignAdSet, all: CampaignAdSet[], currency: string | null): string {
  const out: string[] = [];
  if (s.learningStage === "LEARNING" && s.status === "ACTIVE") {
    out.push("Still in Meta's learning phase: results swing until it gets about 50 results a week, so hold off on big edits.");
  } else if (s.learningStage === "FAIL" && s.status === "ACTIVE") {
    out.push("Learning limited: it isn't getting enough results to finish learning. A bigger budget or a broader audience usually helps.");
  }
  const total = all.reduce((a, x) => a + x.totals.spend, 0);
  if (s.totals.spend <= 0) {
    out.push(s.status === "ACTIVE" ? "No spend in this period yet." : "No spend in this period.");
  } else {
    const share = total > 0 ? Math.round((s.totals.spend / total) * 100) : 100;
    const r = roasOf(s.totals);
    const others = all.filter((x) => x.id !== s.id && roasOf(x.totals) !== null);
    let line = `${fmtMoney(s.totals.spend, currency, { whole: s.totals.spend >= 1000 })} spent${all.length > 1 ? `, ${share}% of the campaign` : ""}`;
    if (r !== null && others.length > 0) {
      const best = others.every((x) => roasOf(x.totals)! <= r);
      const worst = others.every((x) => roasOf(x.totals)! >= r);
      line += ` at ${r.toFixed(2)}x ROAS${best ? ", the best of its ad sets" : worst ? ", the lowest of its ad sets" : ""}`;
    } else if (r !== null) {
      line += ` at ${r.toFixed(2)}x ROAS`;
    }
    out.push(line + ".");
  }
  if (s.frequency30d >= 3) out.push(`Frequency ${s.frequency30d.toFixed(1)}: people see its ads often, so fresh creative will help.`);
  return out.slice(0, 2).join(" ");
}

const errorText = (err: unknown) => (err instanceof Error && err.message ? err.message : "That didn't work. Try again.");

/** Structure data + actions. `onChanged` refreshes the campaign (budget / status shown in its header). */
export function useCampaignStructure(campaignId: string, onChanged?: () => void) {
  const api = useApiClient();
  const q = useApi((c) => c.getCampaignStructure(campaignId, 30), [campaignId], { key: "campaign-structure" });
  const [busy, setBusy] = useState<string | null>(null);

  const run = async (id: string, fn: () => Promise<unknown>, done: string) => {
    setBusy(id);
    try {
      await fn();
      toast.success(done);
      await q.refetch();
      onChanged?.();
      return true;
    } catch (err) {
      toast.error(errorText(err), { duration: 6000 });
      return false;
    } finally {
      setBusy(null);
    }
  };

  return {
    data: q.data,
    loading: q.loading,
    error: q.error,
    refetch: q.refetch,
    busy: (id: string) => busy === id,
    toggleAdSet: (s: CampaignAdSet) =>
      run(s.id, () => api.setAdSetStatus(campaignId, s.id, s.switchOn ? "PAUSED" : "ACTIVE"), s.switchOn ? `Paused “${s.name}” on Meta` : `Resumed “${s.name}” on Meta`),
    setAdSetBudget: (s: CampaignAdSet, amount: number) =>
      run(s.id, () => api.setAdSetBudget(campaignId, s.id, amount), `Budget for “${s.name}” updated on Meta`),
    toggleAd: (a: CampaignAd) =>
      run(a.id, () => api.setAdStatus(campaignId, a.id, a.switchOn ? "PAUSED" : "ACTIVE"), a.switchOn ? `Paused “${a.name}” on Meta` : `Resumed “${a.name}” on Meta`),
  };
}

export type CampaignStructureState = ReturnType<typeof useCampaignStructure>;
