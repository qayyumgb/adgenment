"use client";

import {
  Sparkles,
  RefreshCw,
  DollarSign,
  TrendingUp,
  Zap,
  Megaphone,
  Rocket,
  Palette,
  Users,
  BarChart3,
  Bot,
  Target,
  Layers,
  Wand2,
} from "lucide-react";
import MetricCard from "@/components/dashboard/MetricCard";
import SpendChart from "@/components/dashboard/SpendChart";
import PlatformBreakdown from "@/components/dashboard/PlatformBreakdown";
import CampaignTable from "@/components/dashboard/CampaignTable";

const USER_NAME = "Alex";

const METRICS = [
  {
    title: "Total Spend",
    value: "24,521",
    change: 12.4,
    changeLabel: "vs last week",
    icon: DollarSign,
    iconColor: "#059669",
    iconBg: "rgba(16, 185, 129, 0.12)",
    trend: "up" as const,
    prefix: "$",
    sparklineData: [1820, 2010, 1980, 2240, 2180, 2390, 2410],
  },
  {
    title: "Total Revenue",
    value: "89,340",
    change: 28.1,
    changeLabel: "vs last week",
    icon: TrendingUp,
    iconColor: "#2563eb",
    iconBg: "rgba(59, 130, 246, 0.12)",
    trend: "up" as const,
    prefix: "$",
    sparklineData: [5800, 6400, 6900, 7100, 7600, 8200, 8930],
  },
  {
    title: "Avg ROAS",
    value: "3.64",
    change: 0.4,
    changeLabel: "vs last week",
    icon: Zap,
    iconColor: "#7c3aed",
    iconBg: "rgba(139, 92, 246, 0.12)",
    trend: "up" as const,
    suffix: "x",
    sparklineData: [3.0, 3.1, 3.2, 3.3, 3.4, 3.55, 3.64],
  },
  {
    title: "Active Campaigns",
    value: "12",
    change: 25,
    changeLabel: "3 new this week",
    icon: Megaphone,
    iconColor: "#ea580c",
    iconBg: "rgba(249, 115, 22, 0.12)",
    trend: "up" as const,
    sparklineData: [9, 9, 10, 10, 11, 12, 12],
  },
];

const AI_ACTIVITY = [
  {
    icon: Wand2,
    color: "#6366f1",
    bg: "rgba(99,102,241,0.12)",
    title: "Optimized budget allocation",
    detail: "Shifted $180/day from LinkedIn to Meta on \"Summer Sale 2026\"",
    time: "2h ago",
  },
  {
    icon: Target,
    color: "#0ea5e9",
    bg: "rgba(14,165,233,0.12)",
    title: "New lookalike audience built",
    detail: "1.2M Meta users · seed from top 5% LTV customers",
    time: "5h ago",
  },
  {
    icon: Layers,
    color: "#ec4899",
    bg: "rgba(236,72,153,0.12)",
    title: "Paused 3 underperforming ad sets",
    detail: "CTR fell below 0.9% threshold for 48h on \"Retargeting Q3\"",
    time: "yesterday",
  },
  {
    icon: Bot,
    color: "#10b981",
    bg: "rgba(16,185,129,0.12)",
    title: "Generated 6 new creative variants",
    detail: "Tested headlines for \"Product Launch — Tide+\" using Claude 4.7",
    time: "yesterday",
  },
];

const QUICK_ACTIONS = [
  {
    label: "Launch Campaign",
    sub: "From scratch or template",
    icon: Rocket,
    color: "#6366f1",
    bg: "linear-gradient(135deg, rgba(99,102,241,0.12), rgba(99,102,241,0.04))",
    ring: "rgba(99,102,241,0.25)",
  },
  {
    label: "Generate Creative",
    sub: "AI image + copy variants",
    icon: Palette,
    color: "#a855f7",
    bg: "linear-gradient(135deg, rgba(168,85,247,0.12), rgba(168,85,247,0.04))",
    ring: "rgba(168,85,247,0.25)",
  },
  {
    label: "Build Audience",
    sub: "Lookalike or interest‐based",
    icon: Users,
    color: "#06b6d4",
    bg: "linear-gradient(135deg, rgba(6,182,212,0.12), rgba(6,182,212,0.04))",
    ring: "rgba(6,182,212,0.25)",
  },
  {
    label: "View Reports",
    sub: "Full analytics breakdown",
    icon: BarChart3,
    color: "#10b981",
    bg: "linear-gradient(135deg, rgba(16,185,129,0.12), rgba(16,185,129,0.04))",
    ring: "rgba(16,185,129,0.25)",
  },
];

export default function DashboardPage() {
  return (
    <div className="space-y-6">
      {/* ── Page Header ── */}
      <header className="flex flex-wrap items-end justify-between gap-3 animate-in stagger-1">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 lg:text-3xl">
            Good morning, {USER_NAME} <span aria-hidden>👋</span>
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Here&apos;s what&apos;s happening with your campaigns today.
          </p>
        </div>
        <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-500 shadow-card">
          <RefreshCw className="h-3.5 w-3.5 text-slate-400" />
          <span>
            Last synced <span className="font-semibold text-slate-700">2 min ago</span>
          </span>
          <span className="h-3 w-px bg-slate-200" />
          <span className="font-medium text-slate-500">May 25, 2026</span>
        </div>
      </header>

      {/* ── AI Insight Banner ── */}
      <section className="animate-in stagger-2">
        <div className="relative overflow-hidden rounded-2xl bg-gradient-brand p-5 shimmer-overlay">
          <div className="relative z-10 flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/15 backdrop-blur">
                <Sparkles className="h-5 w-5 text-white" strokeWidth={2.5} />
              </div>
              <div className="text-white">
                <div className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider backdrop-blur">
                  AI Insight
                </div>
                <p className="mt-1.5 max-w-2xl text-sm font-medium leading-snug text-white/95 sm:text-[15px]">
                  Your Meta campaigns are outperforming last week by{" "}
                  <strong className="font-bold">34%</strong>. Consider shifting{" "}
                  <strong className="font-bold">$200/day</strong> from LinkedIn
                  to Meta for better ROAS.
                </p>
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-3">
              <button
                type="button"
                className="rounded-xl bg-white px-4 py-2 text-sm font-bold text-primary-700 shadow-md transition hover:-translate-y-0.5 hover:shadow-lg"
              >
                Apply Suggestion
              </button>
              <button
                type="button"
                className="text-sm font-medium text-white/80 transition hover:text-white"
              >
                Dismiss
              </button>
            </div>
          </div>
          <div className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-white/10 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-16 left-1/3 h-40 w-40 rounded-full bg-fuchsia-300/20 blur-3xl" />
        </div>
      </section>

      {/* ── Metric Cards Row ── */}
      <section className="grid grid-cols-1 gap-5 animate-in stagger-3 sm:grid-cols-2 lg:grid-cols-4 lg:gap-6">
        {METRICS.map((m) => (
          <MetricCard key={m.title} {...m} />
        ))}
      </section>

      {/* ── Charts Row ── */}
      <section className="grid grid-cols-1 gap-6 animate-in stagger-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <SpendChart />
        </div>
        <div className="lg:col-span-1">
          <PlatformBreakdown />
        </div>
      </section>

      {/* ── Campaign Table ── */}
      <section className="animate-in stagger-5">
        <CampaignTable />
      </section>

      {/* ── Bottom Row ── */}
      <section className="grid grid-cols-1 gap-6 animate-in stagger-6 lg:grid-cols-2">
        {/* Recent AI Activity */}
        <div className="rounded-2xl border border-slate-200/70 bg-white p-5 shadow-card">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h3 className="text-base font-bold text-slate-900">
                Recent AI Activity
              </h3>
              <p className="text-xs text-slate-500">
                Autonomous optimizations from the last 48 hours
              </p>
            </div>
            <a
              href="/insights"
              className="text-xs font-semibold text-primary hover:underline"
            >
              View log →
            </a>
          </div>
          <ul className="space-y-1">
            {AI_ACTIVITY.map((a) => (
              <li
                key={a.title}
                className="group flex items-start gap-3 rounded-xl p-2.5 transition hover:bg-slate-50"
              >
                <div
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl"
                  style={{ backgroundColor: a.bg, color: a.color }}
                >
                  <a.icon className="h-4 w-4" strokeWidth={2.25} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-slate-900">
                    {a.title}
                  </p>
                  <p className="line-clamp-2 text-xs text-slate-500">
                    {a.detail}
                  </p>
                </div>
                <span className="shrink-0 text-[11px] font-medium text-slate-400">
                  {a.time}
                </span>
              </li>
            ))}
          </ul>
        </div>

        {/* Quick Actions */}
        <div className="rounded-2xl border border-slate-200/70 bg-white p-5 shadow-card">
          <div className="mb-4">
            <h3 className="text-base font-bold text-slate-900">Quick Actions</h3>
            <p className="text-xs text-slate-500">
              Jump straight into your most‐used workflows
            </p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {QUICK_ACTIONS.map((a) => (
              <button
                key={a.label}
                type="button"
                className="group relative overflow-hidden rounded-xl border border-slate-200 p-4 text-left transition hover:-translate-y-0.5 hover:shadow-md"
                style={{ background: a.bg }}
              >
                <div
                  className="mb-3 flex h-9 w-9 items-center justify-center rounded-xl ring-1 ring-inset transition group-hover:scale-110"
                  style={{
                    backgroundColor: "white",
                    color: a.color,
                    boxShadow: `0 0 0 1px ${a.ring}`,
                  }}
                >
                  <a.icon className="h-4.5 w-4.5" strokeWidth={2.25} />
                </div>
                <div className="text-sm font-bold text-slate-900">{a.label}</div>
                <div className="text-[11px] text-slate-500">{a.sub}</div>
              </button>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
