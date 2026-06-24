"use client";

import { useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useUser } from "@clerk/nextjs";
import clsx from "clsx";
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
  ArrowRight,
} from "lucide-react";
import MetricCard from "@/components/dashboard/MetricCard";
import SpendChart, {
  type SpendChartPoint,
} from "@/components/dashboard/SpendChart";
import PlatformBreakdown, {
  type PlatformBreakdownPoint,
} from "@/components/dashboard/PlatformBreakdown";
import {
  SkeletonMetricCard,
  SkeletonChartCard,
  SkeletonCard,
} from "@/components/ui/Skeleton";
import EmptyState from "@/components/ui/EmptyState";
import { useApi } from "@/hooks/useApi";
import { fmtMoney as fmtMoneyCur } from "@/lib/money";
import type {
  AnalyticsOverview,
  CampaignsResponse,
  TimeseriesPoint,
  PlatformBreakdown as PlatformBreakdownData,
  Campaign,
  BudgetRecommendationRow,
} from "@/lib/api";

/* ─────────────────────────────── */
/* Static content (not yet backed) */
/* ─────────────────────────────── */

// TODO: wire to /api/ai/activity once AI activity audit log lands.
const AI_ACTIVITY = [
  {
    icon: Wand2,
    color: "#6366f1",
    bg: "rgba(99,102,241,0.12)",
    title: "Optimized budget allocation",
    detail:
      "Shifted $180/day from LinkedIn to Meta on \"Summer Sale 2026\"",
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
    href: "/campaigns?new=1",
  },
  {
    label: "Generate Creative",
    sub: "AI image + copy variants",
    icon: Palette,
    color: "#a855f7",
    bg: "linear-gradient(135deg, rgba(168,85,247,0.12), rgba(168,85,247,0.04))",
    href: "/creatives",
  },
  {
    label: "Build Audience",
    sub: "Lookalike or interest-based",
    icon: Users,
    color: "#06b6d4",
    bg: "linear-gradient(135deg, rgba(6,182,212,0.12), rgba(6,182,212,0.04))",
    href: "/audiences",
  },
  {
    label: "View Reports",
    sub: "Full analytics breakdown",
    icon: BarChart3,
    color: "#10b981",
    bg: "linear-gradient(135deg, rgba(16,185,129,0.12), rgba(16,185,129,0.04))",
    href: "/analytics",
  },
];

/* ─────────────────────────────── */
/* Helpers                          */
/* ─────────────────────────────── */

function timeBasedGreeting(): string {
  const h = new Date().getHours();
  if (h < 5) return "Up late";
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  if (h < 22) return "Good evening";
  return "Working late";
}

function fmtMoney(n: number): string {
  return n.toLocaleString("en-US", {
    maximumFractionDigits: 0,
  });
}

function trend(change: number): "up" | "down" | "neutral" {
  if (change > 0.1) return "up";
  if (change < -0.1) return "down";
  return "neutral";
}

/* ─────────────────────────────── */
/* Page                              */
/* ─────────────────────────────── */

export default function DashboardPage() {
  const router = useRouter();
  const { user } = useUser();

  const overview = useApi<AnalyticsOverview>(
    (api) => api.getAnalyticsOverview(30),
    []
  );
  const timeseries = useApi<TimeseriesPoint[]>(
    (api) => api.getTimeseries(30, "spend"),
    []
  );
  const roasSeries = useApi<TimeseriesPoint[]>(
    (api) => api.getTimeseries(30, "roas"),
    []
  );
  const platforms = useApi<PlatformBreakdownData[]>(
    (api) => api.getPlatformBreakdown(30),
    []
  );
  const campaigns = useApi<CampaignsResponse>(
    (api) =>
      api.getCampaigns({
        limit: "5",
        status: "ACTIVE",
      }),
    []
  );

  const loading =
    overview.loading ||
    timeseries.loading ||
    roasSeries.loading ||
    platforms.loading ||
    campaigns.loading;

  const hasError =
    overview.error || campaigns.error || timeseries.error || platforms.error;

  const hasAnyData = (overview.data?.spend ?? 0) > 0;
  const hasNoCampaigns =
    !campaigns.loading &&
    (campaigns.data?.total ?? 0) === 0 &&
    !overview.loading &&
    (overview.data?.spend ?? 0) === 0;

  // Conditional AI insight message based on real metrics.
  const aiInsight = useMemo<string | null>(() => {
    const o = overview.data;
    if (!o || o.spend <= 0) return null;
    if (o.changes.spend > 20) {
      return `Spend is up ${Math.round(o.changes.spend)}% vs the previous period — monitor ROAS closely to avoid overspending.`;
    }
    if (o.roas > 3) {
      return `Great ROAS at ${o.roas.toFixed(2)}x. Consider scaling budget on your best-performing campaigns.`;
    }
    if (o.roas < 2) {
      return `ROAS is ${o.roas.toFixed(2)}x — below the 2x healthy mark. AI recommends pausing underperformers and reallocating budget.`;
    }
    return `Your campaigns are running steadily at ${o.roas.toFixed(2)}x ROAS. Sync ad accounts for the latest data.`;
  }, [overview.data]);

  // Build SpendChart data by zipping spend + roas timeseries on date.
  const chartData = useMemo<SpendChartPoint[]>(() => {
    const spendByDate = new Map(
      (timeseries.data ?? []).map((p) => [p.date, p.value])
    );
    const roasByDate = new Map(
      (roasSeries.data ?? []).map((p) => [p.date, p.value])
    );
    const dates = Array.from(
      new Set<string>([...spendByDate.keys(), ...roasByDate.keys()])
    ).sort();
    return dates.map((date) => ({
      date,
      spend: spendByDate.get(date) ?? 0,
      roas: roasByDate.get(date) ?? 0,
    }));
  }, [timeseries.data, roasSeries.data]);

  const totalSpendSparkline = useMemo(
    () => (timeseries.data ?? []).slice(-7).map((p) => p.value),
    [timeseries.data]
  );

  return (
    <div className="space-y-6">
      {/* ── Page Header ── */}
      <header className="flex flex-wrap items-end justify-between gap-3 animate-in stagger-1">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 lg:text-3xl">
            {timeBasedGreeting()}
            {user?.firstName ? `, ${user.firstName}` : ""}{" "}
            <span aria-hidden>👋</span>
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Here&apos;s what&apos;s happening with your campaigns today.
          </p>
        </div>
        <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-500 shadow-card">
          <RefreshCw className="h-3.5 w-3.5 text-slate-400" />
          <span>
            {hasAnyData ? (
              <>
                Last synced{" "}
                <span className="font-semibold text-slate-700">
                  just now
                </span>
              </>
            ) : (
              <span className="font-semibold text-slate-700">
                Never synced
              </span>
            )}
          </span>
          <span className="h-3 w-px bg-slate-200" />
          <span className="font-medium text-slate-500">
            {new Date().toLocaleDateString("en-US", {
              month: "short",
              day: "numeric",
              year: "numeric",
            })}
          </span>
        </div>
      </header>

      {/* ── AI Insight Banner ── (only if real data) */}
      {hasAnyData && aiInsight && (
        <section className="animate-in stagger-2">
          <div className="relative overflow-hidden rounded-2xl bg-gradient-brand p-5 shimmer-overlay">
            <div className="relative z-10 flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/15 backdrop-blur">
                  <Sparkles
                    className="h-5 w-5 text-white"
                    strokeWidth={2.5}
                  />
                </div>
                <div className="text-white">
                  <div className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider backdrop-blur">
                    Advertix AI Insight
                  </div>
                  <p className="mt-1.5 max-w-2xl text-sm font-medium leading-snug text-white/95 sm:text-[15px]">
                    {aiInsight}{" "}
                    <Link
                      href="/ai-planner"
                      className="underline underline-offset-2"
                    >
                      Open AI Planner →
                    </Link>
                  </p>
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-3">
                <Link
                  href="/ai-planner"
                  className="rounded-xl bg-white px-4 py-2 text-sm font-bold text-primary-700 shadow-md transition hover:-translate-y-0.5 hover:shadow-lg"
                >
                  Open AI Planner
                </Link>
              </div>
            </div>
            <div className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-white/10 blur-3xl" />
            <div className="pointer-events-none absolute -bottom-16 left-1/3 h-40 w-40 rounded-full bg-fuchsia-300/20 blur-3xl" />
          </div>
        </section>
      )}

      {/* ── Metric Cards ── */}
      <section className="grid grid-cols-1 gap-5 animate-in stagger-3 sm:grid-cols-2 lg:grid-cols-4 lg:gap-6">
        {overview.loading ? (
          <>
            <SkeletonMetricCard />
            <SkeletonMetricCard />
            <SkeletonMetricCard />
            <SkeletonMetricCard />
          </>
        ) : overview.data ? (
          <>
            <MetricCard
              title="Total Spend"
              value={fmtMoney(overview.data.spend)}
              change={overview.data.changes.spend}
              changeLabel="vs prev period"
              icon={DollarSign}
              iconColor="#059669"
              iconBg="rgba(16, 185, 129, 0.12)"
              trend={trend(overview.data.changes.spend)}
              prefix="$"
              sparklineData={totalSpendSparkline}
            />
            <MetricCard
              title="Total Revenue"
              value={fmtMoney(overview.data.revenue)}
              change={overview.data.changes.revenue}
              changeLabel="vs prev period"
              icon={TrendingUp}
              iconColor="#2563eb"
              iconBg="rgba(59, 130, 246, 0.12)"
              trend={trend(overview.data.changes.revenue)}
              prefix="$"
              sparklineData={totalSpendSparkline.map((v) => v * 3)}
            />
            <MetricCard
              title="Avg ROAS"
              value={overview.data.roas.toFixed(2)}
              change={overview.data.changes.roas}
              changeLabel="vs prev period"
              icon={Zap}
              iconColor="#7c3aed"
              iconBg="rgba(139, 92, 246, 0.12)"
              trend={trend(overview.data.changes.roas)}
              suffix="x"
              sparklineData={(roasSeries.data ?? [])
                .slice(-7)
                .map((p) => p.value)}
            />
            <MetricCard
              title="Active Campaigns"
              value={String(campaigns.data?.total ?? 0)}
              change={0}
              changeLabel="now serving"
              icon={Megaphone}
              iconColor="#ea580c"
              iconBg="rgba(249, 115, 22, 0.12)"
              trend="neutral"
            />
          </>
        ) : (
          <div className="col-span-full text-sm text-rose-600">
            Couldn&apos;t load metrics — {overview.error}
          </div>
        )}
      </section>

      {/* ── Welcome empty state (first-time user, no campaigns at all) ── */}
      {hasNoCampaigns ? (
        <section className="animate-in stagger-4">
          <EmptyState
            icon={Rocket}
            title={`Welcome to Advertix${user?.firstName ? `, ${user.firstName}` : ""}! 👋`}
            description="Connect your first ad account to start syncing campaigns and seeing real performance metrics here."
            action={{
              label: "Connect Ad Account",
              onClick: () => router.push("/settings?tab=integrations"),
              icon: ArrowRight,
            }}
            secondaryAction={{
              label: "Or plan a campaign with AI",
              href: "/ai-planner",
            }}
          />
        </section>
      ) : (
      <>
      {/* ── Charts ── */}
      <section className="grid grid-cols-1 gap-6 animate-in stagger-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          {loading ? (
            <SkeletonChartCard />
          ) : chartData.length === 0 ? (
            <EmptyState
              icon={BarChart3}
              title="No spend data yet"
              description="Connect your ad accounts and sync to see your spend trend."
              action={{
                label: "Connect Ad Account",
                onClick: () =>
                  router.push("/settings?tab=integrations"),
              }}
              compact
            />
          ) : (
            <SpendChart data={chartData} showRangeTabs={false} />
          )}
        </div>
        <div className="lg:col-span-1">
          {loading ? (
            <SkeletonChartCard height={336} />
          ) : (
            <PlatformBreakdown data={platforms.data ?? []} />
          )}
        </div>
      </section>

      {/* ── Active Campaigns ── */}
      <section className="animate-in stagger-5">
        <ActiveCampaignsCard
          loading={campaigns.loading}
          campaigns={campaigns.data?.campaigns ?? []}
          total={campaigns.data?.total ?? 0}
          onConnect={() => router.push("/settings?tab=integrations")}
        />
      </section>

      {/* ── Bottom Row ── */}
      <section className="grid grid-cols-1 gap-6 animate-in stagger-6 lg:grid-cols-2">
        <div className="rounded-2xl border border-slate-200/70 bg-white p-5 shadow-card">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h3 className="text-base font-bold text-slate-900">
                Recent AI Activity
              </h3>
              <p className="text-xs text-slate-500">
                {hasAnyData
                  ? "Autonomous optimizations from the last 48 hours"
                  : "Example activity — appears here when AI starts optimizing"}
              </p>
            </div>
            <Link
              href="/insights"
              className="text-xs font-semibold text-primary hover:underline"
            >
              View log →
            </Link>
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

        <div className="rounded-2xl border border-slate-200/70 bg-white p-5 shadow-card">
          <div className="mb-4">
            <h3 className="text-base font-bold text-slate-900">
              Quick Actions
            </h3>
            <p className="text-xs text-slate-500">
              Jump straight into your most-used workflows
            </p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {QUICK_ACTIONS.map((a) => (
              <Link
                key={a.label}
                href={a.href}
                className="group relative overflow-hidden rounded-xl border border-slate-200 p-4 text-left transition hover:-translate-y-0.5 hover:shadow-md"
                style={{ background: a.bg }}
              >
                <div
                  className="mb-3 flex h-9 w-9 items-center justify-center rounded-xl ring-1 ring-inset transition group-hover:scale-110"
                  style={{
                    backgroundColor: "white",
                    color: a.color,
                    boxShadow: `0 0 0 1px ${a.color}40`,
                  }}
                >
                  <a.icon className="h-4 w-4" strokeWidth={2.25} />
                </div>
                <div className="text-sm font-bold text-slate-900">
                  {a.label}
                </div>
                <div className="text-[11px] text-slate-500">{a.sub}</div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className="animate-in stagger-6">
        <BudgetOptimizerWidget />
      </section>
      </>
      )}

      {hasError && !loading && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-2 text-xs font-medium text-rose-700">
          Some data couldn&apos;t be loaded. Refresh the page or check that the
          API server is running.
        </div>
      )}
    </div>
  );
}

/* ─────────────────────────────── */
/* AI Budget Optimizer widget       */
/* ─────────────────────────────── */

function BudgetOptimizerWidget() {
  const q = useApi<BudgetRecommendationRow | null>(
    (c) => c.getLatestRecommendation(),
    []
  );
  const rec = q.data;
  const items = rec?.recommendations ?? [];
  const top = [...items].sort((a, b) => a.priority - b.priority).slice(0, 2);

  return (
    <div className="rounded-2xl border border-slate-200/70 bg-white p-5 shadow-card">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 text-white">
            <Sparkles className="h-3.5 w-3.5" strokeWidth={2.5} />
          </span>
          <div>
            <h3 className="text-base font-bold text-slate-900">
              AI Budget Recommendation
            </h3>
            <p className="text-xs text-slate-500">
              {rec
                ? `Last analyzed ${new Date(rec.createdAt).toLocaleDateString()}`
                : "Reallocate spend toward your best-performing campaigns"}
            </p>
          </div>
        </div>
        <Link
          href="/budget-optimizer"
          className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
        >
          Open <ArrowRight className="h-3 w-3" />
        </Link>
      </div>

      {q.loading ? (
        <div className="h-20 animate-pulse rounded-xl bg-slate-100" />
      ) : rec && top.length > 0 ? (
        <div className="space-y-2">
          {top.map((r) => (
            <div
              key={r.campaignId}
              className="flex items-center justify-between gap-2 rounded-xl border border-slate-100 bg-slate-50/60 px-3 py-2"
            >
              <span className="truncate text-sm font-semibold text-slate-800">
                {r.campaignName}
              </span>
              <span
                className={clsx(
                  "shrink-0 rounded-md px-2 py-0.5 text-[11px] font-bold",
                  r.action === "INCREASE"
                    ? "bg-emerald-50 text-emerald-700"
                    : r.action === "PAUSE"
                      ? "bg-rose-50 text-rose-700"
                      : r.action === "DECREASE"
                        ? "bg-amber-50 text-amber-700"
                        : "bg-slate-100 text-slate-600"
                )}
              >
                {r.action === "PAUSE"
                  ? "Pause"
                  : `${fmtMoneyCur(r.recommendedBudget, rec.currency)}/day`}
              </span>
            </div>
          ))}
          <Link
            href="/budget-optimizer"
            className="mt-1 inline-block text-xs font-semibold text-primary hover:underline"
          >
            View all {items.length} recommendation{items.length === 1 ? "" : "s"} →
          </Link>
        </div>
      ) : (
        <div className="flex flex-col items-center gap-2 py-4 text-center">
          <p className="text-xs text-slate-500">
            No analysis yet — let AI review your campaign budgets.
          </p>
          <Link
            href="/budget-optimizer"
            className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-3.5 py-2 text-xs font-bold text-white transition hover:bg-primary/90"
          >
            <Sparkles className="h-3.5 w-3.5" strokeWidth={2.5} />
            Run AI Budget Analysis
          </Link>
        </div>
      )}
    </div>
  );
}

/* ─────────────────────────────── */
/* Active Campaigns sub-component   */
/* ─────────────────────────────── */

function ActiveCampaignsCard({
  loading,
  campaigns,
  total,
  onConnect,
}: {
  loading: boolean;
  campaigns: Campaign[];
  total: number;
  onConnect: () => void;
}) {
  return (
    <section className="rounded-2xl border border-slate-200/70 bg-white shadow-card">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 p-5">
        <div>
          <h3 className="text-base font-bold text-slate-900">
            Active Campaigns
          </h3>
          <p className="text-xs text-slate-500">
            Latest 5 active campaigns across all platforms
          </p>
        </div>
        <Link
          href="/campaigns"
          className="text-sm font-semibold text-primary hover:underline"
        >
          View All →
        </Link>
      </div>

      {loading ? (
        <div className="space-y-2 p-5">
          {[0, 1, 2, 3, 4].map((i) => (
            <SkeletonCard key={i} className="h-14" />
          ))}
        </div>
      ) : campaigns.length === 0 ? (
        <EmptyState
          icon={Megaphone}
          title="No campaigns yet"
          description="Connect your ad accounts and sync to see your campaigns here."
          action={{
            label: "Connect Ad Account",
            onClick: onConnect,
            icon: ArrowRight,
          }}
          secondaryAction={{ label: "Browse campaigns", href: "/campaigns" }}
          compact
          className="m-5"
        />
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="text-left text-[11px] font-bold uppercase tracking-wider text-slate-500">
                <th className="px-5 py-3">Name</th>
                <th className="py-3">Platform</th>
                <th className="py-3">Status</th>
                <th className="py-3">Budget</th>
                <th className="py-3">Last spend</th>
                <th className="py-3">ROAS</th>
                <th className="px-5 py-3 text-right">View</th>
              </tr>
            </thead>
            <tbody>
              {campaigns.map((c) => {
                const latest = c.metrics?.[0];
                const spend = latest ? Number(latest.spend) : 0;
                const roas = latest ? Number(latest.roas) : 0;
                return (
                  <tr
                    key={c.id}
                    className="border-t border-slate-50 transition hover:bg-slate-50/60"
                  >
                    <td className="max-w-[220px] px-5 py-3.5">
                      <Link
                        href={`/campaigns/${c.id}`}
                        className="block truncate text-sm font-semibold text-slate-900 hover:text-primary"
                      >
                        {c.name}
                      </Link>
                      <div className="truncate text-xs text-slate-500">
                        {c.objective}
                      </div>
                    </td>
                    <td className="py-3.5 text-xs font-semibold uppercase text-slate-600">
                      {c.platform}
                    </td>
                    <td className="py-3.5">
                      <span className="inline-flex items-center gap-1.5">
                        <span className="status-dot active" />
                        <span className="text-xs font-semibold text-emerald-700">
                          {c.status}
                        </span>
                      </span>
                    </td>
                    <td className="py-3.5 text-xs font-medium text-slate-700">
                      ${Number(c.budget).toLocaleString()}
                    </td>
                    <td className="py-3.5 text-xs font-medium text-slate-700">
                      {latest ? `$${spend.toLocaleString()}` : "—"}
                    </td>
                    <td className="py-3.5">
                      <span
                        className={clsx(
                          "text-sm font-bold",
                          roas === 0
                            ? "text-slate-400"
                            : roas >= 2
                              ? "text-emerald-600"
                              : "text-amber-600"
                        )}
                      >
                        {roas === 0 ? "—" : `${roas.toFixed(2)}x`}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      <Link
                        href={`/campaigns/${c.id}`}
                        className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
                      >
                        Open
                        <ArrowRight className="h-3 w-3" />
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      {total > campaigns.length && (
        <div className="border-t border-slate-100 px-5 py-3 text-right text-xs text-slate-500">
          Showing {campaigns.length} of {total} active campaigns —{" "}
          <Link
            href="/campaigns?status=ACTIVE"
            className="font-semibold text-primary hover:underline"
          >
            view all
          </Link>
        </div>
      )}
    </section>
  );
}
