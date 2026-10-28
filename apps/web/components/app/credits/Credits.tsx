"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { Sparkles } from "lucide-react";
import { useApi } from "@/hooks/useApi";
import { useRefreshOnNavigate } from "@/hooks/useRefreshOnNavigate";
import { CREDITS_CHANGED_EVENT, CREDITS_EXHAUSTED_EVENT, type CreditStatus } from "@/lib/api";
import { cn } from "@/lib/cn";
import { Button, ButtonLink, Dialog } from "@/components/app/ui";
import { useAccess } from "@/components/app/team/access";

/**
 * AI credits (plan C11): the meter ("342 / 400 credits used"), a one-time
 * warning at 80% each period, and the dialog shown when an AI action is
 * refused at 100%. Agency and Enterprise are unlimited: no meter.
 */

const resetDay = (iso: string) => new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "long" });

/** This period's credits; refreshes after every AI action and on page changes. Null for client viewers. */
export function useCredits() {
  const access = useAccess();
  const can = access.role !== null && access.role !== "CLIENT_VIEWER";
  const q = useApi((c) => (can ? c.getCredits() : new Promise<never>(() => {})), [can], { key: "credits" });
  const { refetch } = q;
  useRefreshOnNavigate("credits", refetch, 60_000);
  useEffect(() => {
    const on = () => void refetch();
    window.addEventListener(CREDITS_CHANGED_EVENT, on);
    window.addEventListener(CREDITS_EXHAUSTED_EVENT, on);
    return () => {
      window.removeEventListener(CREDITS_CHANGED_EVENT, on);
      window.removeEventListener(CREDITS_EXHAUSTED_EVENT, on);
    };
  }, [refetch]);
  return q;
}

function Bar({ c, className }: { c: CreditStatus; className?: string }) {
  return (
    <span className={cn("block h-1.5 overflow-hidden rounded-full bg-surface-3", className)}>
      <span className={cn("block h-full rounded-full transition-[width] duration-500", c.exhausted ? "bg-neg" : c.warn ? "bg-warn" : "bg-brand")} style={{ width: `${Math.round((c.share ?? 0) * 100)}%` }} />
    </span>
  );
}

/** Sidebar meter (limited plans only), plus the 80% heads-up once per period. */
export function CreditMeter({ onNavigate }: { onNavigate?: () => void }) {
  const { data: c } = useCredits();
  useEffect(() => {
    if (!c?.warn || c.exhausted || c.limit === null) return;
    const key = `advertix.credits.warned.${c.periodStart}`;
    try {
      if (localStorage.getItem(key)) return;
      localStorage.setItem(key, "1");
    } catch {
      /* private window: warn every time is fine */
    }
    toast(c.billingState === "TRIAL" ? `You've used ${c.used} of the trial's ${c.limit} AI credits.` : `You've used ${c.used} of ${c.limit} AI credits this month. They reset on ${resetDay(c.resetsAt)}.`, { icon: "⚠️", duration: 7000 });
  }, [c]);
  if (!c || c.limit === null) return null;
  return (
    <Link
      href="/settings?tab=billing"
      onClick={onNavigate}
      className={cn("flex flex-none flex-col gap-1.5 rounded-xl border px-3.5 py-3 text-[13px] no-underline transition-colors hover:border-line-2", c.exhausted ? "border-neg/40 bg-neg-soft" : c.warn ? "border-warn/40 bg-warn-soft" : "border-line bg-surface-2")}
      title={`AI credits reset on ${resetDay(c.resetsAt)}`}
    >
      <span className="flex items-center gap-1.5">
        <Sparkles size={13} className="text-brand" aria-hidden="true" />
        <span className="text-ink-2">AI credits</span>
        <span className="ml-auto font-semibold tabular-nums text-ink">
          {c.used} / {c.limit}
        </span>
      </span>
      <Bar c={c} />
      {(c.warn || c.exhausted) && <span className={cn("text-xs font-medium", c.exhausted ? "text-neg" : "text-ink")}>{c.exhausted ? "All used. Upgrade for more" : `${c.remaining} left · resets ${resetDay(c.resetsAt)}`}</span>}
    </Link>
  );
}

/** Settings › Billing: the meter with what used the credits this period. */
export function CreditsCard() {
  const { data: c } = useCredits();
  if (!c) return null;
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-base font-semibold">AI credits</span>
        <span className="text-[13px] tabular-nums text-ink-2">{c.limit === null ? `${c.used} used · unlimited on your plan` : `${c.used} / ${c.limit} credits used`}</span>
      </div>
      {c.limit !== null && <Bar c={c} className="h-2" />}
      <span className="text-[13px] text-ink-2">
        {c.limit === null ? "" : c.exhausted ? "All of this month's credits are used, so AI actions are paused. " : c.warn ? `${c.remaining} left. ` : ""}
        {c.billingState === "TRIAL" ? `These cover the whole free trial, until ${resetDay(c.resetsAt)}.` : `Credits reset on ${resetDay(c.resetsAt)} and don’t carry over.`} Plans, questions, copy, audience ideas, checks and budget analyses use 1 credit; AI images use 1, 2 or 5 by quality.
      </span>
      {c.byFeature.length > 0 && (
        <ul className="m-0 flex list-none flex-col gap-1 p-0 text-[13px]">
          {c.byFeature.map((f) => (
            <li key={f.feature} className="flex justify-between gap-3">
              <span className="text-ink-2">{f.label}</span>
              <span className="tabular-nums">{f.credits}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** Opens when an AI action is refused for credits (any page). */
export function CreditsDialog() {
  const access = useAccess();
  const [open, setOpen] = useState<{ message: string; credits?: { used: number; limit: number; resetsAt: string } } | null>(null);
  useEffect(() => {
    const on = (e: Event) => setOpen((e as CustomEvent).detail ?? { message: "" });
    window.addEventListener(CREDITS_EXHAUSTED_EVENT, on);
    return () => window.removeEventListener(CREDITS_EXHAUSTED_EVENT, on);
  }, []);
  const owner = access.can("workspace");
  const c = open?.credits;
  return (
    <Dialog
      open={open !== null}
      onClose={() => setOpen(null)}
      title={c && c.used >= c.limit ? "You've used all your AI credits" : "Not enough AI credits"}
      width={460}
      footer={
        <>
          <Button variant="secondary" onClick={() => setOpen(null)}>
            Not now
          </Button>
          {owner && (
            <ButtonLink href="/settings?tab=billing" variant="primary" onClick={() => setOpen(null)}>
              See plans
            </ButtonLink>
          )}
        </>
      }
    >
      <div className="flex flex-col gap-3 text-sm">
        <p className="m-0">{open?.message}</p>
        {c && (
          <div className="flex flex-col gap-1.5 rounded-ctl bg-surface-2 px-3.5 py-3">
            <span className="flex justify-between text-[13px]">
              <span className="text-ink-2">This month</span>
              <span className="font-semibold tabular-nums">
                {c.used} / {c.limit} credits
              </span>
            </span>
            <span className="block h-1.5 overflow-hidden rounded-full bg-surface-3">
              <span className="block h-full rounded-full bg-neg" style={{ width: `${Math.min(100, (c.used / c.limit) * 100)}%` }} />
            </span>
            <span className="text-xs text-ink-3">Resets on {resetDay(c.resetsAt)}. Unused credits don’t carry over.</span>
          </div>
        )}
        {!owner && <p className="m-0 text-[13px] text-ink-2">Ask a workspace owner to upgrade the plan.</p>}
        <p className="m-0 text-[13px] text-ink-2">Everything else (campaigns, reports, rules and alerts) keeps working.</p>
      </div>
    </Dialog>
  );
}
