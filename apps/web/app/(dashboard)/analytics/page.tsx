"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import clsx from "clsx";
import toast from "react-hot-toast";
import {
  Download,
  DollarSign,
  TrendingUp,
  Zap,
  CheckCircle2,
  Sparkles,
  Minus,
  ArrowUp,
  ArrowDown,
  BarChart3,
  RefreshCw,
  Loader2,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ComposedChart,
  Area,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import MetricCard from "@/components/dashboard/MetricCard";
import {
  SkeletonMetricCard,
  SkeletonTableRow,
} from "@/components/ui/Skeleton";
import EmptyState from "@/components/ui/EmptyState";
import { useApi } from "@/hooks/useApi";
import { useApiClient } from "@/lib/api";
import type {
  AnalyticsOverview,
  AnalyticsCampaignsResponse,
  PlatformBreakdown,
  Platform,
  TimeseriesPoint,
  Insight,
} from "@/lib/api";

type Range = 7 | 30 | 90;
type Metric =
  | "spend"
  | "revenue"
  | "roas"
  | "impressions"
  | "clicks"
  | "conversions";

const METRIC_META: Record<
  Metric,
  { label: string; color: string; format: (n: number) => string }
> = {
  spend: {
    label: "Spend",
    color: "#6366f1",
    format: (n) => `$${n.toLocaleString()}`,
  },
  revenue: {
    label: "Revenue",
    color: "#10b981",
    format: (n) => `$${n.toLocaleString()}`,
  },
  roas: {
    label: "ROAS",
    color: "#a855f7",
    format: (n) => `${n.toFixed(2)}x`,
  },
  impressions: {
    label: "Impressions",
    color: "#f59e0b",
    format: (n) => formatCompact(n),
  },
  clicks: {
    label: "Clicks",
    color: "#0ea5e9",
    format: (n) => formatCompact(n),
  },
  conversions: {
    label: "Conversions",
    color: "#ec4899",
    format: (n) => formatCompact(n),
  },
};

function formatCompact(n: number): string {
  if (n >= 1_000_000)
    return (n / 1_000_000).toFixed(1).replace(/\.0$/, "") + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(1).replace(/\.0$/, "") + "K";
  return n.toString();
}

const PLATFORM_BADGE: Record<
  Platform,
  { label: string; bg: string; text: string }
> = {
  META: { label: "Meta", bg: "bg-[#1877F2]/10", text: "text-[#1877F2]" },
  GOOGLE: { label: "Google", bg: "bg-[#EA4335]/10", text: "text-[#EA4335]" },
  TIKTOK: { label: "TikTok", bg: "bg-slate-900/[0.08]", text: "text-slate-900" },
  LINKEDIN: {
    label: "LinkedIn",
    bg: "bg-[#0A66C2]/10",
    text: "text-[#0A66C2]",
  },
  YOUTUBE: { label: "YouTube", bg: "bg-[#FF0000]/10", text: "text-[#FF0000]" },
  SNAPCHAT: {
    label: "Snapchat",
    bg: "bg-[#FFFC00]/20",
    text: "text-slate-900",
  },
  PINTEREST: {
    label: "Pinterest",
    bg: "bg-[#E60023]/10",
    text: "text-[#E60023]",
  },
  X: { label: "X", bg: "bg-slate-900/[0.08]", text: "text-slate-900" },
};

const TABS: Range[] = [7, 30, 90];
const TAB_LABEL: Record<Range, string> = {
  7: "Last 7D",
  30: "Last 30D",
  90: "Last 90D",
};

type SortKey =
  | "spend"
  | "revenue"
  | "roas"
  | "impressions"
  | "clicks"
  | "conversions";

export default function AnalyticsPage() {
  const [range, setRange] = useState<Range>(30);
  const [metric, setMetric] = useState<Metric>("spend");
  const [sortBy, setSortBy] = useState<SortKey>("spend");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");

  const overview = useApi<AnalyticsOverview>(
    (c) => c.getAnalyticsOverview(range),
    [range]
  );
  const timeseries = useApi<TimeseriesPoint[]>(
    (c) => c.getTimeseries(range, metric),
    [range, metric]
  );
  const platforms = useApi<PlatformBreakdown[]>(
    (c) => c.getPlatformBreakdown(range),
    [range]
  );
  const campaigns = useApi<AnalyticsCampaignsResponse>(
    (c) =>
      c.getAnalyticsCampaigns({
        days: range,
        sortBy,
        sortOrder,
        page: 1,
        limit: 10,
      }),
    [range, sortBy, sortOrder]
  );

  const meta = METRIC_META[metric];

  function toggleSort(k: SortKey) {
    if (k === sortBy) {
      setSortOrder((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortBy(k);
      setSortOrder("desc");
    }
  }

  const hasAnyData = (overview.data?.spend ?? 0) > 0;
  const loading = overview.loading;

  // Series for the main chart
  const chartData = useMemo(
    () =>
      (timeseries.data ?? []).map((p) => ({
        label: new Date(p.date + "T00:00:00Z").toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
        }),
        date: p.date,
        value: p.value,
      })),
    [timeseries.data]
  );

  // Funnel from real overview data
  const funnel = useMemo(() => {
    const o = overview.data;
    if (!o) return [];
    return [
      { stage: "Impressions", count: o.impressions, color: "#6366f1" },
      {
        stage: "Clicks",
        count: o.clicks,
        color: "#8b5cf6",
        note: `${(o.ctr * 100).toFixed(2)}% CTR`,
      },
      {
        stage: "Conversions",
        count: o.conversions,
        color: "#ec4899",
        note:
          o.clicks > 0
            ? `${((o.conversions / o.clicks) * 100).toFixed(2)}% CVR`
            : undefined,
      },
    ];
  }, [overview.data]);

  const maxFunnel = funnel[0]?.count ?? 0;

  if (!loading && !hasAnyData && !overview.error) {
    return (
      <div className="space-y-6">
        <header className="animate-in stagger-1">
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 lg:text-3xl">
            Analytics
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Track performance across all your campaigns
          </p>
        </header>
        <EmptyState
          icon={BarChart3}
          title="No analytics data yet"
          description="Connect your ad accounts and sync campaigns to see performance data."
          action={{
            label: "Connect Ad Account",
            onClick: () =>
              (window.location.href = "/settings?tab=integrations"),
          }}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Top bar */}
      <header className="flex flex-wrap items-end justify-between gap-3 animate-in stagger-1">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 lg:text-3xl">
            Analytics
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Track performance across all your campaigns
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="inline-flex rounded-xl border border-slate-200 bg-slate-50 p-0.5">
            {TABS.map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setRange(t)}
                className={clsx(
                  "rounded-lg px-3 py-1.5 text-xs font-bold transition",
                  range === t
                    ? "bg-white text-slate-900 shadow-sm"
                    : "text-slate-500 hover:text-slate-700"
                )}
              >
                {TAB_LABEL[t]}
              </button>
            ))}
          </div>
          <button
            type="button"
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
          >
            <Download className="h-4 w-4" />
            Export Report
          </button>
        </div>
      </header>

      {/* Summary metric cards */}
      <div className="grid grid-cols-2 gap-5 animate-in stagger-2 lg:grid-cols-4 lg:gap-6">
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
              value={overview.data.spend.toLocaleString("en-US", {
                maximumFractionDigits: 0,
              })}
              change={overview.data.changes.spend}
              changeLabel="vs prev period"
              icon={DollarSign}
              iconColor="#059669"
              iconBg="rgba(16, 185, 129, 0.12)"
              trend={overview.data.changes.spend >= 0 ? "up" : "down"}
              prefix="$"
            />
            <MetricCard
              title="Total Revenue"
              value={overview.data.revenue.toLocaleString("en-US", {
                maximumFractionDigits: 0,
              })}
              change={overview.data.changes.revenue}
              changeLabel="vs prev period"
              icon={TrendingUp}
              iconColor="#2563eb"
              iconBg="rgba(59, 130, 246, 0.12)"
              trend={overview.data.changes.revenue >= 0 ? "up" : "down"}
              prefix="$"
            />
            <MetricCard
              title="Avg ROAS"
              value={overview.data.roas.toFixed(2)}
              change={overview.data.changes.roas}
              changeLabel="vs prev period"
              icon={Zap}
              iconColor="#7c3aed"
              iconBg="rgba(139, 92, 246, 0.12)"
              trend={overview.data.changes.roas >= 0 ? "up" : "down"}
              suffix="x"
            />
            <MetricCard
              title="Conversions"
              value={overview.data.conversions.toLocaleString()}
              change={overview.data.changes.conversions}
              changeLabel="vs prev period"
              icon={CheckCircle2}
              iconColor="#ea580c"
              iconBg="rgba(249, 115, 22, 0.12)"
              trend={overview.data.changes.conversions >= 0 ? "up" : "down"}
            />
          </>
        ) : null}
      </div>

      {/* Main chart */}
      <section className="rounded-2xl border border-slate-200/70 bg-white p-5 shadow-card animate-in stagger-3">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-base font-bold text-slate-900">
              Performance Over Time
            </h3>
            <p className="text-xs text-slate-500">
              {range}-day {meta.label.toLowerCase()} trend
            </p>
          </div>
          <div className="inline-flex flex-wrap rounded-xl border border-slate-200 bg-slate-50 p-0.5">
            {(Object.keys(METRIC_META) as Metric[]).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setMetric(m)}
                className={clsx(
                  "rounded-lg px-3 py-1.5 text-xs font-bold transition",
                  metric === m
                    ? "bg-white text-slate-900 shadow-sm"
                    : "text-slate-500 hover:text-slate-700"
                )}
              >
                {METRIC_META[m].label}
              </button>
            ))}
          </div>
        </div>

        {timeseries.loading ? (
          <div className="h-72 animate-pulse rounded-xl bg-slate-100" />
        ) : chartData.length === 0 ? (
          <div className="flex h-72 items-center justify-center rounded-xl border border-dashed border-slate-200 text-sm text-slate-500">
            No data in this window.
          </div>
        ) : (
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart
                data={chartData}
                margin={{ top: 12, right: 8, left: -8, bottom: 0 }}
              >
                <defs>
                  <linearGradient id="metric-fill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={meta.color} stopOpacity={0.34} />
                    <stop offset="100%" stopColor={meta.color} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid
                  strokeDasharray="3 4"
                  stroke="#e2e8f0"
                  vertical={false}
                />
                <XAxis
                  dataKey="label"
                  interval={Math.max(1, Math.floor(chartData.length / 6)) - 1}
                  tickLine={false}
                  axisLine={false}
                  tick={{ fill: "#94a3b8", fontSize: 11, fontWeight: 500 }}
                  dy={6}
                />
                <YAxis
                  tickLine={false}
                  axisLine={false}
                  tick={{ fill: "#94a3b8", fontSize: 11, fontWeight: 500 }}
                  tickFormatter={(v) => meta.format(v)}
                  width={50}
                />
                <Tooltip
                  cursor={{ stroke: "#cbd5e1", strokeDasharray: "3 4" }}
                  contentStyle={{
                    borderRadius: 12,
                    border: "1px solid #e2e8f0",
                    boxShadow: "0 8px 24px -8px rgba(15,23,42,0.18)",
                    fontSize: 12,
                    padding: "8px 12px",
                  }}
                  formatter={(v) => [meta.format(Number(v)), meta.label]}
                />
                <Area
                  type="monotone"
                  dataKey="value"
                  stroke={meta.color}
                  strokeWidth={2.5}
                  fill="url(#metric-fill)"
                  isAnimationActive
                  animationDuration={700}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        )}
      </section>

      {/* Platform comparison + Funnel */}
      <section className="grid grid-cols-1 gap-6 animate-in stagger-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-slate-200/70 bg-white p-5 shadow-card">
          <div className="mb-3">
            <h3 className="text-base font-bold text-slate-900">
              Platform Performance
            </h3>
            <p className="text-xs text-slate-500">
              Spend vs Revenue, last {range}D
            </p>
          </div>
          {platforms.loading ? (
            <div className="h-64 animate-pulse rounded-xl bg-slate-100" />
          ) : (platforms.data ?? []).length === 0 ? (
            <div className="flex h-64 items-center justify-center text-sm text-slate-500">
              No platform data yet.
            </div>
          ) : (
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={(platforms.data ?? []).map((p) => ({
                    platform: PLATFORM_BADGE[p.platform]?.label ?? p.platform,
                    spend: p.spend,
                    revenue: p.revenue,
                    roas: p.roas,
                  }))}
                  margin={{ top: 10, right: 8, left: -8, bottom: 0 }}
                  barCategoryGap={24}
                >
                  <CartesianGrid
                    strokeDasharray="3 4"
                    stroke="#e2e8f0"
                    vertical={false}
                  />
                  <XAxis
                    dataKey="platform"
                    tickLine={false}
                    axisLine={false}
                    tick={{ fill: "#475569", fontSize: 11, fontWeight: 600 }}
                  />
                  <YAxis
                    tickLine={false}
                    axisLine={false}
                    tick={{ fill: "#94a3b8", fontSize: 11, fontWeight: 500 }}
                    tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`}
                    width={48}
                  />
                  <Tooltip
                    cursor={{ fill: "rgba(99, 102, 241, 0.06)" }}
                    contentStyle={{
                      borderRadius: 12,
                      border: "1px solid #e2e8f0",
                      fontSize: 12,
                      padding: "8px 12px",
                    }}
                  />
                  <Legend
                    iconType="square"
                    iconSize={10}
                    wrapperStyle={{ fontSize: 11, paddingTop: 8 }}
                  />
                  <Bar
                    dataKey="spend"
                    name="Spend"
                    fill="#6366f1"
                    radius={[6, 6, 0, 0]}
                  />
                  <Bar
                    dataKey="revenue"
                    name="Revenue"
                    fill="#10b981"
                    radius={[6, 6, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        <div className="rounded-2xl border border-slate-200/70 bg-white p-5 shadow-card">
          <div className="mb-3">
            <h3 className="text-base font-bold text-slate-900">
              Conversion Funnel
            </h3>
            <p className="text-xs text-slate-500">
              Last {range}D, end-to-end conversion path
            </p>
          </div>
          {overview.loading ? (
            <div className="h-48 animate-pulse rounded-xl bg-slate-100" />
          ) : funnel.length === 0 ? (
            <div className="text-sm text-slate-500">No funnel data yet.</div>
          ) : (
            <ul className="space-y-2">
              {funnel.map((f, i) => {
                const pct = maxFunnel > 0 ? (f.count / maxFunnel) * 100 : 0;
                return (
                  <li key={f.stage}>
                    <div className="mb-1 flex items-baseline justify-between">
                      <span className="text-xs font-semibold text-slate-700">
                        {f.stage}
                      </span>
                      <span className="text-sm font-bold text-slate-900">
                        {f.count.toLocaleString()}
                        {f.note && (
                          <span className="ml-2 text-[10px] font-semibold text-emerald-600">
                            {f.note}
                          </span>
                        )}
                      </span>
                    </div>
                    <div className="h-7 overflow-hidden rounded-lg bg-slate-100">
                      <div
                        className="h-full rounded-lg transition-all duration-700"
                        style={{
                          width: `${pct}%`,
                          background: `linear-gradient(90deg, ${f.color}, ${f.color}cc)`,
                        }}
                      />
                    </div>
                    {i < funnel.length - 1 && funnel[i + 1].count > 0 && f.count > 0 && (
                      <p className="mt-1 text-right text-[10px] font-semibold text-slate-400">
                        {((funnel[i + 1].count / f.count) * 100).toFixed(1)}%
                        &nbsp;→
                      </p>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </section>

      {/* Campaign breakdown table */}
      <section className="overflow-hidden rounded-2xl border border-slate-200/70 bg-white shadow-card animate-in stagger-5">
        <div className="border-b border-slate-100 p-5">
          <h3 className="text-base font-bold text-slate-900">
            Campaign Breakdown
          </h3>
          <p className="text-xs text-slate-500">
            Click a column to sort. {campaigns.data?.total ?? 0} campaigns.
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="text-left text-[11px] font-bold uppercase tracking-wider text-slate-500">
                <th className="px-5 py-3">Campaign</th>
                <th className="py-3">Platform</th>
                <SortableTh
                  label="Spend"
                  k="spend"
                  sortKey={sortBy}
                  sortDir={sortOrder}
                  onSort={toggleSort}
                />
                <SortableTh
                  label="Revenue"
                  k="revenue"
                  sortKey={sortBy}
                  sortDir={sortOrder}
                  onSort={toggleSort}
                />
                <SortableTh
                  label="ROAS"
                  k="roas"
                  sortKey={sortBy}
                  sortDir={sortOrder}
                  onSort={toggleSort}
                />
                <SortableTh
                  label="Impressions"
                  k="impressions"
                  sortKey={sortBy}
                  sortDir={sortOrder}
                  onSort={toggleSort}
                />
                <SortableTh
                  label="Clicks"
                  k="clicks"
                  sortKey={sortBy}
                  sortDir={sortOrder}
                  onSort={toggleSort}
                />
                <SortableTh
                  label="Conv"
                  k="conversions"
                  sortKey={sortBy}
                  sortDir={sortOrder}
                  onSort={toggleSort}
                  className="pr-5"
                />
              </tr>
            </thead>
            <tbody>
              {campaigns.loading
                ? Array.from({ length: 5 }).map((_, i) => (
                    <SkeletonTableRow key={i} cols={8} />
                  ))
                : (campaigns.data?.campaigns ?? []).map((r) => {
                    const plat = PLATFORM_BADGE[r.platform] ?? {
                      label: r.platform,
                      bg: "bg-slate-100",
                      text: "text-slate-700",
                    };
                    return (
                      <tr
                        key={r.id}
                        className="border-t border-slate-50 transition hover:bg-slate-50/60"
                      >
                        <td className="max-w-[200px] truncate px-5 py-3.5 text-sm font-semibold text-slate-900">
                          {r.name}
                        </td>
                        <td className="py-3.5">
                          <span className={clsx("pill", plat.bg, plat.text)}>
                            {plat.label}
                          </span>
                        </td>
                        <td className="py-3.5 text-xs font-semibold text-slate-700">
                          ${r.spend.toLocaleString()}
                        </td>
                        <td className="py-3.5 text-xs font-semibold text-slate-700">
                          ${r.revenue.toLocaleString()}
                        </td>
                        <td className="py-3.5">
                          <span
                            className={clsx(
                              "text-sm font-bold",
                              r.roas >= 2
                                ? "text-emerald-600"
                                : "text-rose-600"
                            )}
                          >
                            {r.roas.toFixed(2)}x
                          </span>
                        </td>
                        <td className="py-3.5 text-xs font-medium text-slate-700">
                          {formatCompact(r.impressions)}
                        </td>
                        <td className="py-3.5 text-xs font-medium text-slate-700">
                          {formatCompact(r.clicks)}
                        </td>
                        <td className="pr-5 py-3.5 text-xs font-semibold text-slate-700">
                          {formatCompact(r.conversions)}
                        </td>
                      </tr>
                    );
                  })}
              {!campaigns.loading &&
                (campaigns.data?.campaigns ?? []).length === 0 && (
                  <tr>
                    <td
                      colSpan={8}
                      className="px-5 py-8 text-center text-sm text-slate-500"
                    >
                      No campaigns with metrics in this window.
                    </td>
                  </tr>
                )}
            </tbody>
          </table>
        </div>
      </section>

      {/* AI Insights (real — from /insights) */}
      <section className="animate-in stagger-6">
        <AnalyticsAIInsights />
      </section>

    </div>
  );
}

function AnalyticsAIInsights() {
  const api = useApiClient();
  const q = useApi<{ insights: Insight[] }>((c) => c.getInsights(), []);
  const [generating, setGenerating] = useState(false);
  const top = (q.data?.insights ?? []).slice(0, 4);

  async function refresh() {
    setGenerating(true);
    try {
      await api.generateInsights();
      await q.refetch();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't refresh insights");
    } finally {
      setGenerating(false);
    }
  }

  return (
    <div className="rounded-2xl p-[1px] bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500">
      <div className="rounded-[15px] bg-white p-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-base font-bold text-slate-900">🤖 AI Performance Analysis</h3>
            <p className="text-xs text-slate-500">Data-driven observations across your campaigns</p>
          </div>
          <div className="flex items-center gap-2">
            <Link href="/insights" className="text-xs font-semibold text-primary hover:underline">
              View all →
            </Link>
            <button
              type="button"
              onClick={refresh}
              disabled={generating}
              className="inline-flex items-center gap-1.5 rounded-xl border border-primary/30 bg-primary/5 px-3.5 py-2 text-xs font-bold text-primary transition hover:bg-primary/10 disabled:opacity-60"
            >
              {generating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
              Refresh Insights
            </button>
          </div>
        </div>
        {q.loading ? (
          <div className="space-y-2">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-12 animate-pulse rounded-xl bg-slate-100" />
            ))}
          </div>
        ) : top.length === 0 ? (
          <p className="rounded-xl bg-slate-50/70 p-3 text-sm text-slate-500">
            No insights yet. Run campaigns for a few days, then hit{" "}
            <span className="font-semibold text-slate-700">Refresh Insights</span> to generate AI analysis.
          </p>
        ) : (
          <ul className="space-y-2">
            {top.map((ins) => (
              <li key={ins.id} className="flex items-start gap-3 rounded-xl bg-slate-50/70 p-3">
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-white text-primary shadow-sm ring-1 ring-primary/15">
                  <Sparkles className="h-3.5 w-3.5" strokeWidth={2.5} />
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-800">{ins.title}</p>
                  <p className="text-xs leading-relaxed text-slate-600">{ins.message}</p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function SortableTh({
  label,
  k,
  sortKey,
  sortDir,
  onSort,
  className,
}: {
  label: string;
  k: SortKey;
  sortKey: SortKey;
  sortDir: "asc" | "desc";
  onSort: (k: SortKey) => void;
  className?: string;
}) {
  const active = sortKey === k;
  return (
    <th className={clsx("py-3", className)}>
      <button
        type="button"
        onClick={() => onSort(k)}
        className={clsx(
          "inline-flex items-center gap-1 text-[11px] font-bold uppercase tracking-wider transition",
          active ? "text-slate-900" : "text-slate-500 hover:text-slate-700"
        )}
      >
        {label}
        {active ? (
          sortDir === "asc" ? (
            <ArrowUp className="h-3 w-3" />
          ) : (
            <ArrowDown className="h-3 w-3" />
          )
        ) : (
          <Minus className="h-3 w-3 opacity-30" />
        )}
      </button>
    </th>
  );
}
