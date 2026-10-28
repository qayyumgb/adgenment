"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { AlertTriangle, Clock, X } from "lucide-react";
import { useApi } from "@/hooks/useApi";
import { cn } from "@/lib/cn";
import { ButtonLink } from "@/components/app/ui";
import { useAccess } from "@/components/app/team/access";

/**
 * The plan banner under the top bar (plan C11): the trial ending soon
 * (owners, last 3 days, hideable for the session), the trial ended
 * (everyone; AI and automation paused) and a failed payment (owners).
 * Hidden on Settings › Billing, which says the same thing in full.
 */

const HIDE_KEY = "advertix.trial-banner.hidden";

export function BillingBanner() {
  const access = useAccess();
  const pathname = usePathname();
  const can = access.role !== null && access.role !== "CLIENT_VIEWER";
  const owner = access.can("workspace");
  const { data: s } = useApi((c) => (can ? c.getBillingStatus() : new Promise<never>(() => {})), [can], { key: "billing-status" });
  const [hidden, setHidden] = useState(false);
  useEffect(() => {
    try {
      setHidden(sessionStorage.getItem(HIDE_KEY) === "1");
    } catch {
      /* show it */
    }
  }, []);
  if (!s || !s.configured || pathname.startsWith("/settings")) return null;

  const endsSoon = s.state === "TRIAL" && s.trialDaysLeft <= 3 && owner && !hidden;
  const kind = s.state === "EXPIRED" ? "expired" : s.state === "PAST_DUE" && owner ? "pastDue" : endsSoon ? "soon" : null;
  if (!kind) return null;

  const text = {
    expired: owner ? "Your free trial has ended. AI and automation are paused; your data and syncing are fine." : "This workspace's free trial has ended, so AI and automation are paused. Ask an owner to choose a plan.",
    pastDue: "A payment didn't go through. Stripe will retry; update your card to keep your plan.",
    soon: `Your free trial ends in ${s.trialDaysLeft} day${s.trialDaysLeft === 1 ? "" : "s"}. Choose a plan now; you're only charged when it ends.`,
  }[kind];
  const hide = () => {
    try {
      sessionStorage.setItem(HIDE_KEY, "1");
    } catch {
      /* hidden until reload */
    }
    setHidden(true);
  };

  return (
    <div role="status" className={cn("flex flex-wrap items-center gap-x-3 gap-y-2 border-b px-[clamp(16px,4vw,32px)] py-2.5 text-[13px]", kind === "soon" ? "border-brand-soft-2 bg-brand-soft" : "border-warn/40 bg-warn-soft")}>
      {kind === "soon" ? <Clock size={16} className="flex-none text-brand" aria-hidden="true" /> : <AlertTriangle size={16} className="flex-none text-warn" aria-hidden="true" />}
      <span className="min-w-0 flex-[1_1_240px]">{text}</span>
      {owner && (
        <ButtonLink href="/settings?tab=billing" variant={kind === "soon" ? "primary" : "secondary"} size="sm">
          {kind === "pastDue" ? "Update card" : "Choose a plan"}
        </ButtonLink>
      )}
      {kind === "soon" && (
        <button type="button" onClick={hide} aria-label="Hide until next time" className="inline-flex h-7 w-7 items-center justify-center rounded-md text-ink-3 hover:bg-surface hover:text-ink">
          <X size={15} />
        </button>
      )}
    </div>
  );
}
