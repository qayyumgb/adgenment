"use client";

import { useMemo, useState } from "react";
import clsx from "clsx";
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

type Range = "7" | "30" | "90" | "CUSTOM";
type Metric =
  | "spend"
  | "revenue"
  | "roas"
  | "impressions"
  | "clicks"
  | "conversions";

const METRIC_META: Record<
  Metric,
  { label: string; color: string; format: (n: number) => string; axis: string }
> = {
  spend: {
    label: "Spend",
    color: "#6366f1",
    format: (n) => `$${n.toLocaleString()}`,
    axis: "$",
  },
  revenue: {
    label: "Revenue",
    color: "#10b981",
    format: (n) => `$${n.toLocaleString()}`,
    axis: "$",
  },
  roas: {
    label: "ROAS",
    color: "#a855f7",
    format: (n) => `${n.toFixed(2)}x`,
    axis: "x",
  },
  impressions: {
    label: "Impressions",
    color: "#f59e0b",
    format: (n) => formatCompact(n),
    axis: "",
  },
  clicks: {
    label: "Clicks",
    color: "#0ea5e9",
    format: (n) => formatCompact(n),
    axis: "",
  },
  conversions: {
    label: "Conversions",
    color: "#ec4899",
    format: (n) => formatCompact(n),
    axis: "",
  },
};

function formatCompact(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1).replace(/\.0$/, "") + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(1).replace(/\.0$/, "") + "K";
  return n.toString();
}

// Deterministic mock series
function seeded(i: number, salt: number): number {
  const x = Math.sin(i * 12.9898 + salt * 78.233) * 43758.5453;
  return x - Math.floor(x);
}

function generateSeries(days: number) {
  const today = new Date("2026-05-25T00:00:00Z");
  const out: Array<{
    date: string;
    label: string;
    spend: number;
    revenue: number;
    roas: number;
    impressions: number;
    clicks: number;
    conversions: number;
  }> = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setUTCDate(today.getUTCDate() - i);
    const dow = d.getUTCDay();
    const weekend = dow === 0 || dow === 6;

    const spend = Math.round(
      (weekend ? 2200 : 3200) + (seeded(days - i, 1) - 0.5) * 1200
    );
    const roas = +(
      3.2 +
      (seeded(days - i, 2) - 0.5) * 0.9 -
      (weekend ? 0.2 : 0)
    ).toFixed(2);
    const revenue = Math.round(spend * roas);
    const impressions = Math.round(spend * (35 + seeded(days - i, 3) * 18));
    const clicks = Math.round(impressions * (0.018 + seeded(days - i, 4) * 0.012));
    const conversions = Math.round(clicks * (0.04 + seeded(days - i, 5) * 0.025));
    out.push({
      date: d.toISOString().slice(0, 10),
      label: d.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
      spend: Math.max(800, spend),
      revenue: Math.max(2000, revenue),
      roas: Math.max(1.5, Math.min(5, roas)),
      impressions,
      clicks,
      conversions,
    });
  }
  return out;
}

const PLATFORM_DATA = [
  { platform: "Meta", spend: 38420, revenue: 142600, roas: 3.71 },
  { platform: "Google", spend: 26840, revenue: 89320, roas: 3.33 },
  { platform: "TikTok", spend: 16280, revenue: 58940, roas: 3.62 },
  { platform: "LinkedIn", spend: 7880, revenue: 21980, roas: 2.79 },
];

const FUNNEL = [
  { stage: "Impressions", count: 2_840_000, color: "#6366f1" },
  { stage: "Clicks", count: 89_420, color: "#8b5cf6", note: "3.15% CTR" },
  { stage: "Landing Page Views", count: 67_340, color: "#a855f7" },
  { stage: "Add to Cart / Lead Form", count: 12_840, color: "#ec4899" },
  { stage: "Conversions", count: 4_821, color: "#f43f5e", note: "5.39% CVR" },
];

type TableRow = {
  id: string;
  name: string;
  platform: "META" | "GOOGLE" | "TIKTOK" | "LINKEDIN";
  spend: number;
  revenue: number;
  roas: number;
  impressions: number;
  clicks: number;
  ctr: number;
  conv: number;
  cpa: number;
};

const TABLE_DATA: TableRow[] = [
  {
    id: "1",
    name: "Summer Sale 2026",
    platform: "META",
    spend: 11420,
    revenue: 47960,
    roas: 4.2,
    impressions: 1240000,
    clicks: 24800,
    ctr: 2.0,
    conv: 1240,
    cpa: 9.21,
  },
  {
    id: "2",
    name: "Brand Awareness Q2",
    platform: "GOOGLE",
    spend: 9840,
    revenue: 27552,
    roas: 2.8,
    impressions: 980000,
    clicks: 14700,
    ctr: 1.5,
    conv: 412,
    cpa: 23.88,
  },
  {
    id: "3",
    name: "Product Launch — Tide+",
    platform: "TIKTOK",
    spend: 8200,
    revenue: 30340,
    roas: 3.7,
    impressions: 720000,
    clicks: 22320,
    ctr: 3.1,
    conv: 892,
    cpa: 9.19,
  },
  {
    id: "4",
    name: "Enterprise Lead Gen",
    platform: "LINKEDIN",
    spend: 6420,
    revenue: 10272,
    roas: 1.6,
    impressions: 184000,
    clicks: 2208,
    ctr: 1.2,
    conv: 124,
    cpa: 51.77,
  },
  {
    id: "5",
    name: "Cart Abandon Retargeting",
    platform: "META",
    spend: 4680,
    revenue: 23868,
    roas: 5.1,
    impressions: 412000,
    clicks: 12360,
    ctr: 3.0,
    conv: 612,
    cpa: 7.65,
  },
  {
    id: "6",
    name: "Search · Branded Terms",
    platform: "GOOGLE",
    spend: 3240,
    revenue: 20088,
    roas: 6.2,
    impressions: 184000,
    clicks: 7360,
    ctr: 4.0,
    conv: 480,
    cpa: 6.75,
  },
  {
    id: "7",
    name: "Creator Collab Spring",
    platform: "TIKTOK",
    spend: 2980,
    revenue: 13708,
    roas: 4.6,
    impressions: 340000,
    clicks: 10200,
    ctr: 3.0,
    conv: 410,
    cpa: 7.27,
  },
  {
    id: "8",
    name: "ABM Tier 1 Accounts",
    platform: "LINKEDIN",
    spend: 1460,
    revenue: 3504,
    roas: 2.4,
    impressions: 84000,
    clicks: 1260,
    ctr: 1.5,
    conv: 51,
    cpa: 28.63,
  },
];

const PLATFORM_BADGE: Record<
  TableRow["platform"],
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
};

const AI_INSIGHTS = [
  "Meta campaigns are generating 2.3x better ROAS than LinkedIn this month. Consider reallocating $300/day from LinkedIn to Meta.",
  "Your Tuesday–Thursday campaigns outperform weekends by 41%. Scheduling more campaigns mid-week could improve efficiency.",
  "Video creatives are achieving 67% lower CPL than static images across all platforms.",
  "Your audience in the 25–34 age group converts at 3.2x the rate of 45–54. Consider tightening targeting.",
];

const TABS: Range[] = ["7", "30", "90", "CUSTOM"];
const TAB_LABEL: Record<Range, string> = {
  "7": "Last 7D",
  "30": "Last 30D",
  "90": "Last 90D",
  CUSTOM: "Custom",
};

type SortKey = keyof Pick<
  TableRow,
  "name" | "spend" | "revenue" | "roas" | "impressions" | "clicks" | "ctr" | "conv" | "cpa"
>;

export default function AnalyticsPage() {
  const [range, setRange] = useState<Range>("30");
  const [metric, setMetric] = useState<Metric>("spend");
  const [sortKey, setSortKey] = useState<SortKey>("spend");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const days = range === "CUSTOM" ? 30 : Number(range);
  const series = useMemo(() => generateSeries(days), [days]);

  const sortedRows = useMemo(() => {
    const copy = [...TABLE_DATA];
    copy.sort((a, b) => {
      const av = a[sortKey];
      const bv = b[sortKey];
      if (typeof av === "number" && typeof bv === "number") {
        return sortDir === "asc" ? av - bv : bv - av;
      }
      const as = String(av);
      const bs = String(bv);
      return sortDir === "asc" ? as.localeCompare(bs) : bs.localeCompare(as);
    });
    return copy;
  }, [sortKey, sortDir]);

  function toggleSort(k: SortKey) {
    if (k === sortKey) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(k);
      setSortDir("desc");
    }
  }

  const meta = METRIC_META[metric];
  const maxFunnel = FUNNEL[0].count;

  return (
    <div className="space-y-6">
      {/* ── Top bar ── */}
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

      {/* ── Summary metric cards ── */}
      <div className="grid grid-cols-2 gap-5 animate-in stagger-2 lg:grid-cols-4 lg:gap-6">
        <MetricCard
          title="Total Spend"
          value="89,420"
          change={14.2}
          changeLabel="vs prev period"
          icon={DollarSign}
          iconColor="#059669"
          iconBg="rgba(16, 185, 129, 0.12)"
          trend="up"
          prefix="$"
          sparklineData={[2600, 2820, 2940, 3120, 3080, 3240, 3410]}
        />
        <MetricCard
          title="Total Revenue"
          value="312,840"
          change={28.7}
          changeLabel="vs prev period"
          icon={TrendingUp}
          iconColor="#2563eb"
          iconBg="rgba(59, 130, 246, 0.12)"
          trend="up"
          prefix="$"
          sparklineData={[8400, 9200, 9800, 10400, 10800, 11400, 12100]}
        />
        <MetricCard
          title="Avg ROAS"
          value="3.50"
          change={0.3}
          changeLabel="vs prev period"
          icon={Zap}
          iconColor="#7c3aed"
          iconBg="rgba(139, 92, 246, 0.12)"
          trend="up"
          suffix="x"
          sparklineData={[3.1, 3.2, 3.25, 3.3, 3.4, 3.45, 3.5]}
        />
        <MetricCard
          title="Conversions"
          value="4,821"
          change={19.4}
          changeLabel="vs prev period"
          icon={CheckCircle2}
          iconColor="#ea580c"
          iconBg="rgba(249, 115, 22, 0.12)"
          trend="up"
          sparklineData={[110, 132, 150, 168, 178, 192, 208]}
        />
      </div>

      {/* ── Main chart ── */}
      <section className="rounded-2xl border border-slate-200/70 bg-white p-5 shadow-card animate-in stagger-3">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-base font-bold text-slate-900">
              Performance Over Time
            </h3>
            <p className="text-xs text-slate-500">
              {days}-day {meta.label.toLowerCase()} trend
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

        <div className="h-72 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart
              data={series}
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
                interval={Math.max(1, Math.floor(series.length / 6)) - 1}
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
                dataKey={metric}
                stroke={meta.color}
                strokeWidth={2.5}
                fill="url(#metric-fill)"
                isAnimationActive
                animationDuration={700}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </section>

      {/* ── Platform comparison + Funnel ── */}
      <section className="grid grid-cols-1 gap-6 animate-in stagger-4 lg:grid-cols-2">
        {/* Bar chart */}
        <div className="rounded-2xl border border-slate-200/70 bg-white p-5 shadow-card">
          <div className="mb-3">
            <h3 className="text-base font-bold text-slate-900">
              Platform Performance
            </h3>
            <p className="text-xs text-slate-500">Spend vs Revenue, last {days}D</p>
          </div>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={PLATFORM_DATA}
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
                  tickFormatter={(v) =>
                    `$${(v / 1000).toFixed(0)}k`
                  }
                  width={48}
                />
                <Tooltip
                  cursor={{ fill: "rgba(99, 102, 241, 0.06)" }}
                  content={<PlatformTooltip />}
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
        </div>

        {/* Funnel */}
        <div className="rounded-2xl border border-slate-200/70 bg-white p-5 shadow-card">
          <div className="mb-3">
            <h3 className="text-base font-bold text-slate-900">
              Conversion Funnel
            </h3>
            <p className="text-xs text-slate-500">
              From impressions to conversions, last {days}D
            </p>
          </div>
          <ul className="space-y-2">
            {FUNNEL.map((f, i) => {
              const pct = (f.count / maxFunnel) * 100;
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
                        boxShadow: `0 4px 14px -4px ${f.color}80`,
                      }}
                    />
                  </div>
                  {i < FUNNEL.length - 1 && (
                    <p className="mt-1 text-right text-[10px] font-semibold text-slate-400">
                      {((FUNNEL[i + 1].count / f.count) * 100).toFixed(1)}%
                      &nbsp;→
                    </p>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      </section>

      {/* ── Campaign breakdown table ── */}
      <section className="overflow-hidden rounded-2xl border border-slate-200/70 bg-white shadow-card animate-in stagger-5">
        <div className="border-b border-slate-100 p-5">
          <h3 className="text-base font-bold text-slate-900">
            Campaign Breakdown
          </h3>
          <p className="text-xs text-slate-500">
            Click a column to sort. {sortedRows.length} campaigns.
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="text-left text-[11px] font-bold uppercase tracking-wider text-slate-500">
                <SortableTh
                  label="Campaign"
                  k="name"
                  sortKey={sortKey}
                  sortDir={sortDir}
                  onSort={toggleSort}
                  className="px-5"
                />
                <th className="py-3">Platform</th>
                <SortableTh
                  label="Spend"
                  k="spend"
                  sortKey={sortKey}
                  sortDir={sortDir}
                  onSort={toggleSort}
                />
                <SortableTh
                  label="Revenue"
                  k="revenue"
                  sortKey={sortKey}
                  sortDir={sortDir}
                  onSort={toggleSort}
                />
                <SortableTh
                  label="ROAS"
                  k="roas"
                  sortKey={sortKey}
                  sortDir={sortDir}
                  onSort={toggleSort}
                />
                <SortableTh
                  label="Impressions"
                  k="impressions"
                  sortKey={sortKey}
                  sortDir={sortDir}
                  onSort={toggleSort}
                />
                <SortableTh
                  label="Clicks"
                  k="clicks"
                  sortKey={sortKey}
                  sortDir={sortDir}
                  onSort={toggleSort}
                />
                <SortableTh
                  label="CTR"
                  k="ctr"
                  sortKey={sortKey}
                  sortDir={sortDir}
                  onSort={toggleSort}
                />
                <SortableTh
                  label="Conv"
                  k="conv"
                  sortKey={sortKey}
                  sortDir={sortDir}
                  onSort={toggleSort}
                />
                <SortableTh
                  label="CPA"
                  k="cpa"
                  sortKey={sortKey}
                  sortDir={sortDir}
                  onSort={toggleSort}
                  className="pr-5"
                />
              </tr>
            </thead>
            <tbody>
              {sortedRows.map((r) => {
                const plat = PLATFORM_BADGE[r.platform];
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
                          r.roas >= 2 ? "text-emerald-600" : "text-rose-600"
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
                    <td className="py-3.5">
                      <span
                        className={clsx(
                          "text-sm font-semibold",
                          r.ctr > 2 ? "text-emerald-600" : "text-amber-600"
                        )}
                      >
                        {r.ctr.toFixed(2)}%
                      </span>
                    </td>
                    <td className="py-3.5 text-xs font-semibold text-slate-700">
                      {formatCompact(r.conv)}
                    </td>
                    <td className="pr-5 py-3.5 text-xs font-semibold text-slate-700">
                      ${r.cpa.toFixed(2)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      {/* ── AI Insights ── */}
      <section className="animate-in stagger-6">
        <div className="rounded-2xl p-[1px] bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500">
          <div className="rounded-[15px] bg-white p-5">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  🤖 AI Performance Analysis
                </h3>
                <p className="text-xs text-slate-500">
                  Auto-generated observations across all your campaigns
                </p>
              </div>
              <button
                type="button"
                className="inline-flex items-center gap-1.5 rounded-xl border border-primary/30 bg-primary/5 px-3.5 py-2 text-xs font-bold text-primary transition hover:bg-primary/10"
              >
                <Sparkles className="h-3.5 w-3.5" />
                Refresh Insights
              </button>
            </div>
            <ul className="space-y-2">
              {AI_INSIGHTS.map((insight, i) => (
                <li
                  key={i}
                  className="flex items-start gap-3 rounded-xl bg-slate-50/70 p-3"
                >
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-white text-primary shadow-sm ring-1 ring-primary/15">
                    <Sparkles className="h-3.5 w-3.5" strokeWidth={2.5} />
                  </div>
                  <p className="text-sm leading-relaxed text-slate-700">
                    {insight}
                  </p>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>
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

function PlatformTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ payload: (typeof PLATFORM_DATA)[number] }>;
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  const p = payload[0]?.payload;
  if (!p) return null;
  return (
    <div className="rounded-xl border border-slate-200 bg-white px-3 py-2 shadow-lg">
      <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
        {label}
      </div>
      <div className="mt-1 space-y-0.5 text-xs">
        <div className="flex items-center justify-between gap-6">
          <span className="text-slate-600">Spend</span>
          <span className="font-bold text-slate-900">
            ${p.spend.toLocaleString()}
          </span>
        </div>
        <div className="flex items-center justify-between gap-6">
          <span className="text-slate-600">Revenue</span>
          <span className="font-bold text-emerald-600">
            ${p.revenue.toLocaleString()}
          </span>
        </div>
        <div className="mt-1 flex items-center justify-between gap-6 border-t border-slate-100 pt-1">
          <span className="font-bold text-slate-700">ROAS</span>
          <span className="font-bold text-primary">{p.roas.toFixed(2)}x</span>
        </div>
      </div>
    </div>
  );
}
