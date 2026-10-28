"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import toast from "react-hot-toast";
import { Check, CreditCard, ExternalLink } from "lucide-react";
import { useApi } from "@/hooks/useApi";
import { useApiClient, type BillingInterval, type BillingStatus, type PaidTier } from "@/lib/api";
import { cn } from "@/lib/cn";
import { fmtMoney } from "@/lib/money";
import { PLANS, yearlyMonthly, type Plan } from "@/lib/marketing/pricing";
import { Button, ButtonLink, Card, Pill, Segmented, Skeleton, useConfirm, type PillTone } from "@/components/app/ui";
import { useAccess } from "@/components/app/team/access";
import { CreditsCard } from "@/components/app/credits/Credits";

/**
 * Settings › Billing (plan C11): the plan and its state (trial, active, past
 * due, cancelling, ended), choosing or switching plans (Stripe Checkout the
 * first time, an in-app prorated switch after), Stripe's portal for invoices,
 * the card and cancelling, and usage against the plan's limits.
 */

const TIER_OF_NAME: Record<Exclude<Plan["name"], "Enterprise">, PaidTier> = { Founder: "FOUNDER", Team: "TEAM", Agency: "AGENCY" };
const NAME_OF_TIER: Record<PaidTier | "ENTERPRISE", Plan["name"]> = { FOUNDER: "Founder", TEAM: "Team", AGENCY: "Agency", ENTERPRISE: "Enterprise" };
const day = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "long", year: "numeric" }) : "");

function Usage({ label, value, used, limit, tone = "brand" }: { label: string; value: string; used: number; limit: number | null; tone?: "brand" | "mid" }) {
  const pct = limit && Number.isFinite(limit) ? Math.min(100, (used / limit) * 100) : 0;
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex justify-between gap-3 text-[13px]">
        <span className="text-ink-2">{label}</span>
        <span className="font-semibold tabular-nums">{value}</span>
      </div>
      <span className="block h-2 overflow-hidden rounded-full bg-surface-3">
        <span className={cn("block h-full rounded-full", pct >= 90 ? "bg-warn" : tone === "mid" ? "bg-brand-mid" : "bg-brand")} style={{ width: `${pct}%` }} />
      </span>
    </div>
  );
}

function statusLine(s: BillingStatus): { label: string; tone: PillTone; text: string } {
  if (s.state === "TRIAL") return { label: `${s.trialDaysLeft} day${s.trialDaysLeft === 1 ? "" : "s"} left`, tone: "brand", text: `Until ${day(s.trialEndsAt)}. Team limits (5 clients, 5 seats) with 100 AI credits; no card needed.` };
  if (s.state === "EXPIRED") return { label: "Trial ended", tone: "neg", text: "Your data is safe and syncing continues. Choose a plan to turn the AI and automation back on." };
  if (s.state === "PAST_DUE") return { label: "Payment failed", tone: "warn", text: "Stripe couldn't charge your card and will retry. Update it in Manage billing to keep your plan." };
  if (s.cancelAtPeriodEnd) return { label: "Cancelling", tone: "warn", text: `Your plan ends on ${day(s.renewsAt)}. Choose it again below to keep it.` };
  return { label: "Active", tone: "pos", text: s.renewsAt ? `${s.interval === "year" ? "Renews yearly" : "Renews monthly"} on ${day(s.renewsAt)}.` : "Set up by the Advertix team." };
}

export function BillingTab() {
  const api = useApiClient();
  const router = useRouter();
  const params = useSearchParams();
  const access = useAccess();
  const owner = access.can("workspace");
  const usage = useApi((c) => c.getBilling(), [], { key: "billing" });
  const q = useApi((c) => c.getBillingStatus(), [], { key: "billing-status" });
  const s = q.data;
  const [cycle, setCycle] = useState<BillingInterval>("month");
  const [busy, setBusy] = useState<string | null>(null);
  const { confirm, dialog } = useConfirm();
  const polled = useRef(false);

  useEffect(() => {
    if (s?.interval) setCycle(s.interval);
  }, [s?.interval]);

  // Back from Stripe Checkout: the webhook may land a moment later, so poll briefly.
  useEffect(() => {
    const result = params.get("checkout");
    if (!result || polled.current) return;
    polled.current = true;
    router.replace("/settings?tab=billing");
    if (result === "cancelled") return void toast("Checkout cancelled. Nothing was charged.");
    let tries = 0;
    const tick = async () => {
      tries++;
      await q.refetch();
      await usage.refetch();
    };
    toast.success("Thanks! Your plan is being set up.");
    const t = window.setInterval(() => {
      void tick();
      if (tries >= 8) window.clearInterval(t);
    }, 2000);
    return () => window.clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params]);

  const go = async (key: string, fn: () => Promise<{ url: string }>) => {
    setBusy(key);
    try {
      const { url } = await fn();
      window.location.assign(url);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't open Stripe. Try again.");
      setBusy(null);
    }
  };
  const choose = async (plan: Plan) => {
    if (!s || plan.name === "Enterprise") return;
    const tier = TIER_OF_NAME[plan.name];
    const subscribed = s.state === "ACTIVE" || s.state === "PAST_DUE";
    if (!subscribed) return go(tier, () => api.startCheckout(tier, cycle));
    if (s.tier === "ENTERPRISE") return;
    const price = cycle === "year" ? `$${(plan.monthly ?? 0) * 10} a year` : `$${plan.monthly} a month`;
    const ok = await confirm({ title: `Switch to ${plan.name}?`, body: `${price}. Stripe adjusts the next invoice for the days left on your current plan (prorated).`, confirmLabel: `Switch to ${plan.name}` });
    if (!ok) return;
    setBusy(tier);
    try {
      await api.changePlan(tier, cycle);
      await Promise.all([q.refetch(), usage.refetch()]);
      toast.success(`You're on ${plan.name} now.`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't switch plans.");
    } finally {
      setBusy(null);
    }
  };

  if (q.error || usage.error) {
    return (
      <Card className="flex flex-wrap items-center justify-between gap-3">
        <span className="text-sm text-neg">Couldn’t load billing: {q.error ?? usage.error}</span>
        <Button variant="secondary" size="sm" onClick={() => void (q.refetch(), usage.refetch())}>
          Try again
        </Button>
      </Card>
    );
  }
  if (!s || !usage.data) return <Skeleton className="h-[420px] rounded-card" />;
  const b = usage.data;
  const st = statusLine(s);
  const currentName = s.tier ? NAME_OF_TIER[s.tier] : null;
  const usd = b.spendThisMonth.find((x) => x.currency === "USD")?.amount ?? 0;
  const other = b.spendThisMonth.filter((x) => x.currency !== "USD");
  // The trial (and an ended trial) is sized like Team.
  const spendLimit = (PLANS.find((p) => p.name === (currentName ?? "Team")) ?? PLANS[1]).spendLimit;
  const subscribed = s.state === "ACTIVE" || s.state === "PAST_DUE";
  const why = !owner ? "Only owners can change the plan." : !s.configured ? "Billing isn't set up on this server yet." : undefined;

  return (
    <>
      <div className="flex flex-wrap gap-4">
        <Card padded={false} className="flex min-w-0 flex-[1.4_1_360px] flex-col gap-4 p-[22px]">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <span className="flex min-w-0 flex-col gap-0.5">
              <span className="text-xs text-ink-3">Current plan</span>
              <span className="flex items-center gap-2">
                <span className="text-[22px] font-semibold tracking-[-0.02em]">{currentName ?? (s.state === "TRIAL" ? "Free trial" : "No plan")}</span>
                <Pill tone={st.tone}>{st.label}</Pill>
              </span>
              <span className="text-[13px] text-ink-2">{st.text}</span>
            </span>
            {owner && s.hasCustomer && s.configured && (
              <Button variant="secondary" size="sm" icon={<CreditCard size={15} />} loading={busy === "portal"} disabled={busy !== null} onClick={() => void go("portal", () => api.openBillingPortal())}>
                Manage billing
              </Button>
            )}
          </div>
          <div className="flex flex-col gap-3.5">
            <Usage label="Clients" value={`${b.clients} of ${s.limits.clients ?? "unlimited"}`} used={b.clients} limit={s.limits.clients} />
            <Usage label="Team seats" value={`${b.seats.used} of ${b.seats.limit ?? "unlimited"}`} used={b.seats.used} limit={b.seats.limit} tone="mid" />
            {b.seats.clientViewersFree && <span className="-mt-2 text-xs text-ink-3">Client viewers don&apos;t use a seat.</span>}
            <Usage
              label="Ad spend managed this month"
              value={`${fmtMoney(usd, "USD", { whole: true })} of ${Number.isFinite(spendLimit) ? fmtMoney(spendLimit, "USD", { whole: true }) : "unlimited"}`}
              used={usd}
              limit={Number.isFinite(spendLimit) ? spendLimit : null}
            />
            {other.length > 0 && <span className="-mt-2 text-xs text-ink-3">Also {other.map((o) => fmtMoney(o.amount, o.currency, { whole: true })).join(", ")} in other currencies (not counted against the USD limit).</span>}
          </div>
          <div className="border-t border-line pt-4">
            <CreditsCard />
          </div>
        </Card>
        <Card padded={false} className="flex min-w-0 flex-[1_1_280px] flex-col gap-3 p-[22px]">
          <span className="text-base font-semibold">Invoices and payment</span>
          <p className="m-0 text-sm text-ink-2">
            {s.hasCustomer
              ? "Invoices, your card, billing details and cancelling are in Stripe's secure billing portal."
              : "Payments run through Stripe. Once you choose a plan, invoices and your card are here."}{" "}
            Ad spend is billed by each platform, as it is today.
          </p>
          <div className="mt-auto flex flex-wrap gap-2">
            {owner && s.hasCustomer && s.configured && (
              <Button variant="secondary" size="sm" icon={<ExternalLink size={14} />} disabled={busy !== null} onClick={() => void go("portal", () => api.openBillingPortal())}>
                Invoices and card
              </Button>
            )}
            <ButtonLink href="mailto:support@advertix.io?subject=Advertix%20billing" variant="soft" size="sm">
              Email support
            </ButtonLink>
          </div>
        </Card>
      </div>

      <Card padded={false} className="flex flex-col gap-4 p-[22px]">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <span className="flex flex-col gap-0.5">
            <span className="text-base font-semibold">{subscribed ? "Change plan" : "Choose a plan"}</span>
            <span className="text-[13px] text-ink-2">
              {s.state === "TRIAL" ? `Pick one now and you're only charged when the trial ends on ${day(s.trialEndsAt)}.` : subscribed ? "Switching is prorated: you only pay the difference for the rest of this period." : "Every plan includes the AI Planner, suggestions, budgets, creatives and reports."}
            </span>
          </span>
          <Segmented
            label="Billing period"
            value={cycle}
            onChange={setCycle}
            options={[
              { value: "month", label: "Monthly" },
              { value: "year", label: "Yearly · 2 months free" },
            ]}
          />
        </div>
        <div className="grid grid-cols-[repeat(auto-fit,minmax(220px,1fr))] gap-3">
          {PLANS.map((p) => {
            const isCurrent = currentName === p.name && (p.name === "Enterprise" || s.interval === cycle) && !s.cancelAtPeriodEnd;
            const tier = p.name === "Enterprise" ? null : TIER_OF_NAME[p.name];
            const perMonth = p.monthly == null ? null : cycle === "year" ? yearlyMonthly(p.monthly) : p.monthly;
            return (
              <div key={p.name} className={cn("flex flex-col gap-3 rounded-[14px] p-[18px]", isCurrent ? "border-[1.5px] border-brand bg-brand-soft" : "border border-line bg-surface")}>
                <span className="flex items-center justify-between gap-2">
                  <span className="font-semibold">{p.name}</span>
                  {isCurrent && <Pill tone="brand">Current</Pill>}
                </span>
                <span className="flex items-baseline gap-1">
                  {perMonth == null ? <span className="text-[22px] font-semibold">Custom</span> : <span className="text-[26px] font-semibold tabular-nums tracking-[-0.02em]">${perMonth}</span>}
                  {perMonth != null && <span className="text-[13px] text-ink-2">/ month{cycle === "year" ? `, $${(p.monthly ?? 0) * 10} yearly` : ""}</span>}
                </span>
                <span className="text-xs font-medium tracking-[.04em] text-ink-3">{p.limits}</span>
                <ul className="m-0 flex list-none flex-col gap-1.5 p-0 text-[13px] text-ink-2">
                  {p.items.slice(0, 4).map((i) => (
                    <li key={i} className="flex gap-1.5">
                      <Check size={14} className="mt-0.5 flex-none text-pos" aria-hidden="true" />
                      {i}
                    </li>
                  ))}
                </ul>
                <div className="mt-auto pt-1">
                  {p.name === "Enterprise" ? (
                    <ButtonLink href="mailto:support@advertix.io?subject=Advertix%20Enterprise" variant="secondary" size="sm" className="w-full justify-center">
                      Talk to us
                    </ButtonLink>
                  ) : (
                    <Button
                      variant={isCurrent ? "secondary" : "primary"}
                      size="sm"
                      className="w-full justify-center"
                      disabled={isCurrent || Boolean(why) || busy !== null || s.tier === "ENTERPRISE"}
                      loading={busy === tier}
                      title={why}
                      onClick={() => void choose(p)}
                    >
                      {isCurrent ? "Current plan" : subscribed ? `Switch to ${p.name}` : `Choose ${p.name}`}
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
        {why && <span className="text-[13px] text-ink-2">{why}</span>}
      </Card>
      {dialog}
    </>
  );
}
