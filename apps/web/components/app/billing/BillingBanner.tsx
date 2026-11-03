"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { AlertTriangle, Clock, X } from "lucide-react";
import { useApi } from "@/hooks/useApi";
import { cn } from "@/lib/cn";
import { ButtonLink } from "@/components/app/ui";
import { useAccess } from "@/components/app/team/access";

/**
 * The plan banner under the top bar (plan C11): the trial running (owners,
 * every feature until the date; hidden for good once closed), the trial
 * ending soon (owners, last 3 days, hideable for the session) and a failed
 * payment (owners). A trial that ended locks the app instead (C15, AppShell).
 * Hidden on Settings › Billing, which says the same thing in full.
 */

const HIDE_KEY = "advertix.trial-banner.hidden";
const INTRO_KEY = "advertix.trial-intro.closed";

export function BillingBanner() {
  const access = useAccess();
  const pathname = usePathname();
  const can = access.role !== null && access.role !== "CLIENT_VIEWER";
  const owner = access.can("workspace");
  const { data: s } = useApi((c) => (can ? c.getBillingStatus() : new Promise<never>(() => {})), [can], { key: "billing-status" });
  const [hidden, setHidden] = useState(false);
  // The trial intro is closed per trial (a fresh trial shows it again).
  const [introClosed, setIntroClosed] = useState<string | null>(null);
  useEffect(() => {
    try {
      setHidden(sessionStorage.getItem(HIDE_KEY) === "1");
      setIntroClosed(localStorage.getItem(INTRO_KEY));
    } catch {
      /* show it */
    }
  }, []);
  if (!s || !s.configured || pathname.startsWith("/settings")) return null;

  const endsSoon = s.state === "TRIAL" && s.trialDaysLeft <= 3 && owner && !hidden;
  const intro = s.state === "TRIAL" && s.trialDaysLeft > 3 && owner && s.trialEndsAt !== null && introClosed !== s.trialEndsAt;
  const kind = s.state === "EXPIRED" ? "expired" : s.state === "PAST_DUE" && owner ? "pastDue" : endsSoon ? "soon" : intro ? "intro" : null;
  if (!kind) return null;

  const until = s.trialEndsAt ? new Date(s.trialEndsAt).toLocaleDateString(undefined, { day: "numeric", month: "long" }) : "";
  const text = {
    expired: owner ? "Your free trial has ended. Choose a plan to keep using Advertix." : "This workspace's free trial has ended. Ask an owner to choose a plan.",
    pastDue: "A payment didn't go through. Stripe will retry; update your card to keep your plan.",
    soon: `Your free trial ends in ${s.trialDaysLeft} day${s.trialDaysLeft === 1 ? "" : "s"}. Choose a plan now; you're only charged when it ends. Without one, the workspace locks and safety rules stop.`,
    intro: `Your free trial includes every feature until ${until}. Choose a plan any time; you're only charged when the trial ends.`,
  }[kind];
  const hide = () => {
    try {
      if (kind === "intro") localStorage.setItem(INTRO_KEY, s.trialEndsAt ?? "");
      else sessionStorage.setItem(HIDE_KEY, "1");
    } catch {
      /* hidden until reload */
    }
    if (kind === "intro") setIntroClosed(s.trialEndsAt);
    else setHidden(true);
  };
  const calm = kind === "soon" || kind === "intro";

  return (
    <div role="status" className={cn("flex flex-wrap items-center gap-x-3 gap-y-2 border-b px-[clamp(16px,4vw,32px)] py-2.5 text-[13px]", calm ? "border-brand-soft-2 bg-brand-soft" : "border-warn/40 bg-warn-soft")}>
      {calm ? <Clock size={16} className="flex-none text-brand" aria-hidden="true" /> : <AlertTriangle size={16} className="flex-none text-warn" aria-hidden="true" />}
      <span className="min-w-0 flex-[1_1_240px]">{text}</span>
      {owner && (
        <ButtonLink href="/settings?tab=billing" variant={kind === "soon" ? "primary" : "secondary"} size="sm">
          {kind === "pastDue" ? "Update card" : kind === "intro" ? "See plans" : "Choose a plan"}
        </ButtonLink>
      )}
      {calm && (
        <button type="button" onClick={hide} aria-label={kind === "intro" ? "Close" : "Hide until next time"} className="inline-flex h-7 w-7 items-center justify-center rounded-md text-ink-3 hover:bg-surface hover:text-ink">
          <X size={15} />
        </button>
      )}
    </div>
  );
}
