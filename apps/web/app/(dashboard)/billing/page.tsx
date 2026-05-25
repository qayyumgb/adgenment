"use client";

import { useState } from "react";
import clsx from "clsx";
import {
  Check,
  X,
  Download,
  CreditCard,
  Receipt,
  Zap,
  Sparkles,
  Crown,
  Building2,
  ArrowRight,
  AlertTriangle,
  type LucideIcon,
} from "lucide-react";

type Cycle = "monthly" | "annual";

type Plan = {
  id: "starter" | "pro" | "agency" | "enterprise";
  name: string;
  priceMonthly: number | null;
  priceAnnual: number | null;
  icon: LucideIcon;
  color: string;
  accent: string;
  popular?: boolean;
  cta: string;
};

const PLANS: Plan[] = [
  {
    id: "starter",
    name: "Starter",
    priceMonthly: 99,
    priceAnnual: 79,
    icon: Zap,
    color: "text-slate-700",
    accent: "from-slate-500 to-slate-700",
    cta: "Upgrade",
  },
  {
    id: "pro",
    name: "Pro",
    priceMonthly: 299,
    priceAnnual: 239,
    icon: Sparkles,
    color: "text-primary",
    accent: "from-indigo-500 via-purple-500 to-pink-500",
    popular: true,
    cta: "Upgrade",
  },
  {
    id: "agency",
    name: "Agency",
    priceMonthly: 699,
    priceAnnual: 559,
    icon: Crown,
    color: "text-amber-600",
    accent: "from-amber-500 to-orange-500",
    cta: "Upgrade",
  },
  {
    id: "enterprise",
    name: "Enterprise",
    priceMonthly: null,
    priceAnnual: null,
    icon: Building2,
    color: "text-slate-900",
    accent: "from-slate-700 to-slate-900",
    cta: "Contact Sales",
  },
];

const FEATURES: Array<{
  label: string;
  values: [
    string | boolean,
    string | boolean,
    string | boolean,
    string | boolean,
  ];
}> = [
  { label: "Ad Spend Managed", values: ["$5K/mo", "$25K/mo", "$100K/mo", "Unlimited"] },
  { label: "Connected Platforms", values: ["3", "6", "All 10+", "All + Custom"] },
  { label: "Team Members", values: ["1", "5", "Unlimited", "Unlimited"] },
  {
    label: "AI Campaign Planner",
    values: ["Basic", "Advanced", "Advanced", "Fine-tuned"],
  },
  { label: "AI Creative Generator", values: [false, true, true, true] },
  { label: "Budget Optimizer", values: [false, true, true, true] },
  { label: "A/B Testing", values: [false, true, true, true] },
  { label: "White-label Portal", values: [false, false, true, true] },
  { label: "API Access", values: [false, false, true, true] },
  {
    label: "Support",
    values: ["Email", "Priority", "Dedicated CSM", "24/7 SLA"],
  },
];

const CURRENT_PLAN_ID: Plan["id"] = "starter"; // visually mark Starter — adjust as needed
const ACTUAL_USER_PLAN = "free"; // user is on free tier (no upgrade)

export default function BillingPage() {
  const [cycle, setCycle] = useState<Cycle>("monthly");

  return (
    <div className="space-y-6">
      {/* ── Header ── */}
      <header className="animate-in stagger-1">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 lg:text-3xl">
          Billing &amp; Plans
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Manage your subscription, usage, and payment method.
        </p>
      </header>

      {/* ── Current plan card ── */}
      <section className="animate-in stagger-2">
        <div className="rounded-2xl p-[1px] bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500">
          <div className="rounded-[15px] bg-white p-6 lg:p-8">
            <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex-1">
                <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-primary">
                  Current Plan
                </p>
                <div className="mt-1 flex items-baseline gap-2">
                  <h2 className="text-3xl font-bold text-slate-900">
                    Free Plan
                  </h2>
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-slate-600">
                    Started May 2026
                  </span>
                </div>

                <ul className="mt-5 grid grid-cols-1 gap-2 sm:grid-cols-2">
                  <FeatureLine included label="3 ad platform connections" />
                  <FeatureLine included label="Up to $5,000/mo ad spend managed" />
                  <FeatureLine included label="AI Campaign Planner (basic)" />
                  <FeatureLine label="AI Creative Generator (Pro+)" />
                  <FeatureLine label="Budget Optimizer (Pro+)" />
                  <FeatureLine label="White-label portal (Agency+)" />
                </ul>
              </div>

              <div className="lg:max-w-[260px] lg:text-right">
                <p className="text-4xl font-bold tracking-tight text-slate-900">
                  $0
                  <span className="text-sm font-semibold text-slate-500">
                    /mo
                  </span>
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  Upgrade to unlock all features
                </p>
                <button
                  type="button"
                  className="mt-4 inline-flex w-full items-center justify-center gap-1.5 rounded-xl bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 px-4 py-3 text-sm font-bold text-white shadow-glow transition hover:-translate-y-0.5 hover:shadow-xl"
                >
                  <Sparkles className="h-4 w-4" strokeWidth={2.5} />
                  Upgrade Plan
                </button>
                <a
                  href="#plans"
                  className="mt-2 block text-xs font-semibold text-primary hover:underline"
                >
                  View all features →
                </a>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Usage stats ── */}
      <section className="grid grid-cols-1 gap-5 animate-in stagger-3 lg:grid-cols-3">
        <UsageCard
          label="Ad Spend Managed"
          used="$2,340"
          limit="$5,000"
          pct={47}
          tone="emerald"
        />
        <UsageCard
          label="AI Requests"
          used="142"
          limit="500/mo"
          pct={28}
          tone="brand"
        />
        <UsageCard
          label="Connected Platforms"
          used="2"
          limit="3"
          pct={67}
          tone="amber"
        />
      </section>

      {/* ── Plans comparison ── */}
      <section
        id="plans"
        className="overflow-hidden rounded-2xl border border-slate-200/70 bg-white shadow-card animate-in stagger-4"
      >
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 p-5">
          <div>
            <h3 className="text-base font-bold text-slate-900">
              Choose Your Plan
            </h3>
            <p className="text-xs text-slate-500">
              Cancel or change plans anytime.
            </p>
          </div>
          <div className="inline-flex items-center gap-2">
            <div className="inline-flex rounded-xl border border-slate-200 bg-slate-50 p-0.5">
              {(["monthly", "annual"] as Cycle[]).map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setCycle(c)}
                  className={clsx(
                    "rounded-lg px-3 py-1.5 text-xs font-bold capitalize transition",
                    cycle === c
                      ? "bg-white text-slate-900 shadow-sm"
                      : "text-slate-500 hover:text-slate-700"
                  )}
                >
                  {c}
                </button>
              ))}
            </div>
            {cycle === "annual" && (
              <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-emerald-700">
                Save 20%
              </span>
            )}
          </div>
        </div>

        {/* Plan headers + feature rows */}
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px]">
            <thead>
              <tr>
                <th className="px-5 py-5 text-left align-bottom">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                    Features
                  </span>
                </th>
                {PLANS.map((p) => {
                  const isCurrent = ACTUAL_USER_PLAN === "free" && p.id === CURRENT_PLAN_ID;
                  const price = cycle === "monthly" ? p.priceMonthly : p.priceAnnual;
                  return (
                    <th
                      key={p.id}
                      className={clsx(
                        "relative px-3 pb-5 pt-5 text-left align-bottom",
                        p.popular && "bg-primary/[0.04]"
                      )}
                    >
                      {p.popular && (
                        <span className="absolute right-2 top-2 rounded-full bg-gradient-to-r from-indigo-500 to-pink-500 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-white shadow-sm">
                          Most Popular
                        </span>
                      )}
                      <div className="flex items-center gap-2">
                        <div
                          className={clsx(
                            "flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br text-white shadow-sm",
                            p.accent
                          )}
                        >
                          <p.icon className="h-3.5 w-3.5" strokeWidth={2.5} />
                        </div>
                        <span className={clsx("text-sm font-bold", p.color)}>
                          {p.name}
                        </span>
                      </div>
                      <div className="mt-2">
                        {price === null ? (
                          <span className="text-lg font-bold text-slate-900">
                            Custom
                          </span>
                        ) : (
                          <>
                            <span className="text-2xl font-bold text-slate-900">
                              ${price}
                            </span>
                            <span className="text-xs font-semibold text-slate-500">
                              /mo
                            </span>
                            {cycle === "annual" && (
                              <p className="text-[10px] font-medium text-emerald-600">
                                billed annually
                              </p>
                            )}
                          </>
                        )}
                      </div>
                      <button
                        type="button"
                        disabled={isCurrent}
                        className={clsx(
                          "mt-3 inline-flex w-full items-center justify-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-bold transition",
                          isCurrent
                            ? "cursor-default bg-slate-100 text-slate-500"
                            : p.popular
                              ? "bg-primary text-white shadow-sm hover:-translate-y-0.5 hover:shadow-md"
                              : "border border-slate-300 bg-white text-slate-700 hover:border-slate-400 hover:bg-slate-50"
                        )}
                      >
                        {isCurrent ? "Current" : p.cta}
                      </button>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {FEATURES.map((f, i) => (
                <tr
                  key={f.label}
                  className={clsx(
                    "border-t border-slate-50",
                    i % 2 === 0 ? "bg-white" : "bg-slate-50/30"
                  )}
                >
                  <td className="px-5 py-3 text-xs font-semibold text-slate-700">
                    {f.label}
                  </td>
                  {f.values.map((v, j) => (
                    <td
                      key={j}
                      className={clsx(
                        "px-3 py-3 text-xs",
                        PLANS[j].popular && "bg-primary/[0.03]"
                      )}
                    >
                      {typeof v === "boolean" ? (
                        v ? (
                          <Check className="h-4 w-4 text-emerald-500" strokeWidth={2.5} />
                        ) : (
                          <X className="h-4 w-4 text-slate-300" strokeWidth={2.5} />
                        )
                      ) : (
                        <span className="font-semibold text-slate-700">{v}</span>
                      )}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* ── Billing history + Payment method ── */}
      <section className="grid grid-cols-1 gap-5 animate-in stagger-5 lg:grid-cols-3">
        <div className="rounded-2xl border border-slate-200/70 bg-white shadow-card lg:col-span-2">
          <div className="flex items-center justify-between border-b border-slate-100 p-5">
            <h3 className="text-base font-bold text-slate-900">
              Billing History
            </h3>
            <button
              type="button"
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
            >
              <Download className="h-3.5 w-3.5" />
              Download All
            </button>
          </div>
          <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
            <div className="relative mb-4">
              <div className="absolute inset-0 rounded-3xl bg-slate-200/40 blur-xl" />
              <div className="relative flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100">
                <Receipt
                  className="h-6 w-6 text-slate-400"
                  strokeWidth={1.75}
                />
              </div>
            </div>
            <p className="text-sm font-bold text-slate-900">
              No billing history yet
            </p>
            <p className="mt-1 max-w-xs text-xs text-slate-500">
              Your first charge will appear here after upgrading to a paid plan.
            </p>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200/70 bg-white p-5 shadow-card">
          <h3 className="text-base font-bold text-slate-900">Payment Method</h3>
          <p className="mt-0.5 text-xs text-slate-500">
            Add a card to upgrade your plan instantly.
          </p>

          <div className="my-5">
            <div className="relative mx-auto aspect-[1.586/1] max-w-[220px] overflow-hidden rounded-2xl bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 p-4 text-white shadow-xl">
              <div className="absolute -right-6 -top-6 h-20 w-20 rounded-full bg-white/15 blur-lg" />
              <div className="relative flex h-full flex-col justify-between">
                <CreditCard className="h-6 w-6" />
                <div>
                  <div className="text-sm font-bold tracking-widest">
                    •••• •••• •••• ••••
                  </div>
                  <div className="mt-1 flex items-center justify-between text-[10px] font-semibold opacity-90">
                    <span>CARDHOLDER</span>
                    <span>EXP MM/YY</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <button
            type="button"
            className="btn-brand w-full justify-center"
          >
            <CreditCard className="h-4 w-4" />
            Add Payment Method
          </button>
        </div>
      </section>
    </div>
  );
}

/* ───────────────────────────────────────── */
function FeatureLine({ label, included }: { label: string; included?: boolean }) {
  return (
    <li
      className={clsx(
        "flex items-center gap-2 text-sm",
        included ? "text-slate-700" : "text-slate-400"
      )}
    >
      {included ? (
        <Check className="h-4 w-4 text-emerald-500" strokeWidth={2.5} />
      ) : (
        <X className="h-4 w-4 text-slate-300" strokeWidth={2.5} />
      )}
      {label}
    </li>
  );
}

function UsageCard({
  label,
  used,
  limit,
  pct,
  tone,
}: {
  label: string;
  used: string;
  limit: string;
  pct: number;
  tone: "emerald" | "brand" | "amber";
}) {
  const bgColor =
    tone === "emerald" ? "#10b981" : tone === "brand" ? "#6366f1" : "#f59e0b";
  const isHigh = pct >= 80;
  return (
    <div className="rounded-2xl border border-slate-200/70 bg-white p-5 shadow-card transition hover:-translate-y-0.5 hover:shadow-card-hover">
      <div className="flex items-baseline justify-between">
        <p className="text-xs font-semibold text-slate-500">{label}</p>
        <p className="text-xs font-bold text-slate-400">{pct}%</p>
      </div>
      <p className="mt-1 text-2xl font-bold text-slate-900">
        {used}{" "}
        <span className="text-sm font-medium text-slate-400">of {limit}</span>
      </p>
      <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{
            width: `${pct}%`,
            backgroundColor: bgColor,
            boxShadow: `0 0 12px -2px ${bgColor}80`,
          }}
        />
      </div>
      {isHigh && (
        <div className="mt-3 flex items-center justify-between gap-2 rounded-lg bg-amber-50 px-2.5 py-1.5">
          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-700">
            <AlertTriangle className="h-3 w-3" />
            Approaching limit
          </span>
          <a
            href="#plans"
            className="inline-flex items-center gap-0.5 text-[11px] font-bold text-primary hover:underline"
          >
            Upgrade
            <ArrowRight className="h-3 w-3" />
          </a>
        </div>
      )}
    </div>
  );
}
