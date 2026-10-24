"use client";

import { useApi } from "@/hooks/useApi";
import type { PlanType } from "@/lib/api";
import { cn } from "@/lib/cn";
import { fmtMoney } from "@/lib/money";
import { PLANS, type Plan } from "@/lib/marketing/pricing";
import { Button, ButtonLink, Card, Pill, Skeleton } from "@/components/app/ui";

/**
 * Settings › Billing (plan A14, decision 10): the workspace's real plan and
 * what it uses against the plan's limits (clients, spend managed this month,
 * seats), from the same plans as the pricing page. Advertix doesn't bill
 * through the app yet, so there are no invoices or cards to show.
 */

/** Workspace plan → pricing-page plan (the mapping lib/access.ts seat limits follow). */
const PLAN_OF: Record<PlanType, Plan["name"]> = { FREE: "Founder", STARTER: "Team", PRO: "Agency", ENTERPRISE: "Enterprise" };

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

export function BillingTab() {
  const q = useApi((c) => c.getBilling(), [], { key: "billing" });
  const b = q.data;
  if (q.error) {
    return (
      <Card className="flex flex-wrap items-center justify-between gap-3">
        <span className="text-sm text-neg">Couldn’t load billing: {q.error}</span>
        <Button variant="secondary" size="sm" onClick={() => void q.refetch()}>
          Try again
        </Button>
      </Card>
    );
  }
  if (!b) return <Skeleton className="h-[300px] rounded-card" />;
  const plan = PLANS.find((p) => p.name === PLAN_OF[b.plan]) ?? PLANS[0];
  const free = b.plan === "FREE";
  const usd = b.spendThisMonth.find((s) => s.currency === "USD")?.amount ?? 0;
  const other = b.spendThisMonth.filter((s) => s.currency !== "USD");
  const limitText = (n: number) => (Number.isFinite(n) ? n.toLocaleString("en-US") : "unlimited");

  return (
    <>
      <div className="flex flex-wrap gap-4">
        <Card padded={false} className="flex min-w-0 flex-[1.4_1_360px] flex-col gap-4 p-[22px]">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <span className="flex flex-col gap-0.5">
              <span className="text-xs text-ink-3">Current plan</span>
              <span className="text-[22px] font-semibold tracking-[-0.02em]">{plan.name}</span>
              <span className="text-[13px] text-ink-2">{free ? `${plan.limits.toLowerCase().replace(/(^|\s)\S/g, (m) => m.toUpperCase())} · free during the beta` : plan.monthly ? `$${plan.monthly} / month` : "Custom pricing"}</span>
            </span>
            {free && <Pill tone="brand">Beta</Pill>}
          </div>
          <div className="flex flex-col gap-3.5">
            <Usage label="Clients" value={`${b.clients} of ${limitText(plan.clientLimit)}`} used={b.clients} limit={plan.clientLimit} />
            <Usage
              label="Ad spend managed this month"
              value={`${fmtMoney(usd, "USD", { whole: true })} of ${Number.isFinite(plan.spendLimit) ? fmtMoney(plan.spendLimit, "USD", { whole: true }) : "unlimited"}`}
              used={usd}
              limit={plan.spendLimit}
            />
            {other.length > 0 && <span className="-mt-2 text-xs text-ink-3">Also {other.map((o) => fmtMoney(o.amount, o.currency, { whole: true })).join(", ")} in other currencies (not counted against the USD limit).</span>}
            <Usage label="Team seats" value={`${b.seats.used} of ${b.seats.limit ?? "unlimited"}`} used={b.seats.used} limit={b.seats.limit} tone="mid" />
            {b.seats.clientViewersFree && <span className="-mt-2 text-xs text-ink-3">Client viewers don&apos;t use a seat on this plan.</span>}
          </div>
        </Card>
        <Card padded={false} className="flex min-w-0 flex-[1_1_280px] flex-col gap-3 p-[22px]">
          <span className="text-base font-semibold">Invoices and payment</span>
          <p className="text-sm text-ink-2">Advertix doesn&apos;t bill through the app yet{free ? ", and the beta is free" : ""}. To change plan or ask about an invoice, get in touch and we&apos;ll sort it out.</p>
          <div className="mt-auto flex flex-wrap gap-2">
            <ButtonLink href="/pricing" variant="secondary" size="sm">
              Compare plans
            </ButtonLink>
            <ButtonLink href="mailto:support@advertix.io?subject=Advertix%20plan" variant="soft" size="sm">
              Email support
            </ButtonLink>
          </div>
        </Card>
      </div>
      <Card padded={false} className="flex flex-col gap-2 p-[22px]">
        <span className="text-base font-semibold">What&apos;s in {plan.name}</span>
        <ul className="grid grid-cols-[repeat(auto-fit,minmax(220px,1fr))] gap-x-6 gap-y-1.5 text-sm text-ink-2">
          {plan.items.map((i) => (
            <li key={i}>· {i}</li>
          ))}
        </ul>
        <span className="text-xs text-ink-3">Some plan features are still being built; Settings › AI & automation and Notifications show what works today.</span>
      </Card>
    </>
  );
}
