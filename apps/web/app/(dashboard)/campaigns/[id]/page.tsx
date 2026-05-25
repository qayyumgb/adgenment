"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useMemo, useState } from "react";
import clsx from "clsx";
import {
  ArrowLeft,
  PauseCircle,
  PlayCircle,
  Pencil,
  MoreVertical,
  Copy,
  Archive,
  Trash2,
  DollarSign,
  TrendingUp,
  Zap,
  Eye,
  MousePointerClick,
  Plus,
  Sparkles,
  Image as ImageIcon,
  Film,
  Layers,
  Users,
  AlertTriangle,
  type LucideIcon,
} from "lucide-react";
import MetricCard from "@/components/dashboard/MetricCard";
import SpendChart from "@/components/dashboard/SpendChart";

type Platform = "META" | "GOOGLE" | "TIKTOK" | "LINKEDIN";
type Status = "ACTIVE" | "PAUSED" | "DRAFT" | "ENDED";

type CampaignDetail = {
  id: string;
  name: string;
  objective: string;
  platform: Platform;
  status: Status;
  budget: number;
  spend: number;
  revenue: number;
  roas: number;
  impressions: number;
  clicks: number;
  ctr: number;
  startDate: string;
  endDate: string;
};

const KNOWN: Record<string, Partial<CampaignDetail>> = {
  "summer-sale-2026": {
    name: "Summer Sale 2026",
    objective: "Conversions · Retargeting",
    platform: "META",
    status: "ACTIVE",
    budget: 5000,
    spend: 3240,
    revenue: 13608,
    roas: 4.2,
    impressions: 412000,
    clicks: 8240,
    ctr: 2.0,
    startDate: "2026-04-28",
    endDate: "2026-06-30",
  },
  "brand-q2": {
    name: "Brand Awareness Q2",
    objective: "Reach · Top of funnel",
    platform: "GOOGLE",
    status: "ACTIVE",
    budget: 3500,
    spend: 2890,
    revenue: 8092,
    roas: 2.8,
    impressions: 287000,
    clicks: 4310,
    ctr: 1.5,
    startDate: "2026-05-01",
    endDate: "2026-06-15",
  },
};

const PLATFORM_META: Record<
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
};

const STATUS_META: Record<
  Status,
  { label: string; cls: string; dot: "active" | "paused" | "draft" | "ended" }
> = {
  ACTIVE: { label: "Active", cls: "text-emerald-700", dot: "active" },
  PAUSED: { label: "Paused", cls: "text-amber-700", dot: "paused" },
  DRAFT: { label: "Draft", cls: "text-slate-600", dot: "draft" },
  ENDED: { label: "Ended", cls: "text-rose-700", dot: "ended" },
};

function fmtMoney(n: number) {
  return n.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  });
}

function fmtCompact(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1).replace(/\.0$/, "") + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(1).replace(/\.0$/, "") + "K";
  return n.toString();
}

type Tab = "overview" | "adsets" | "creatives" | "audience" | "settings";

const TABS: { key: Tab; label: string }[] = [
  { key: "overview", label: "Overview" },
  { key: "adsets", label: "Ad Sets" },
  { key: "creatives", label: "Creatives" },
  { key: "audience", label: "Audience" },
  { key: "settings", label: "Settings" },
];

function buildMockFromId(id: string): CampaignDetail {
  const known = KNOWN[id];
  const fallback: CampaignDetail = {
    id,
    name: id
      .split("-")
      .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
      .join(" "),
    objective: "Conversions · Custom audience",
    platform: "META",
    status: "ACTIVE",
    budget: 3500,
    spend: 2120,
    revenue: 7420,
    roas: 3.5,
    impressions: 184000,
    clicks: 3680,
    ctr: 2.0,
    startDate: "2026-05-01",
    endDate: "2026-06-30",
  };
  return { ...fallback, ...known, id };
}

export default function CampaignDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params?.id ?? "unknown";
  const c = useMemo(() => buildMockFromId(id), [id]);

  const [tab, setTab] = useState<Tab>("overview");
  const [menuOpen, setMenuOpen] = useState(false);
  const [paused, setPaused] = useState(c.status !== "ACTIVE");

  const plat = PLATFORM_META[c.platform];
  const st = STATUS_META[paused ? "PAUSED" : c.status];

  return (
    <div className="space-y-6">
      {/* ── Header ── */}
      <div className="animate-in stagger-1">
        <Link
          href="/campaigns"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-primary"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Campaigns
        </Link>

        <div className="mt-2 flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-bold tracking-tight text-slate-900 lg:text-3xl">
                {c.name}
              </h1>
              <span className={clsx("pill", plat.bg, plat.text)}>
                {plat.label}
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-50 px-2.5 py-0.5 ring-1 ring-inset ring-slate-200">
                <span className={clsx("status-dot", st.dot)} />
                <span className={clsx("text-[11px] font-bold uppercase", st.cls)}>
                  {st.label}
                </span>
              </span>
            </div>
            <p className="mt-1 text-sm text-slate-500">{c.objective}</p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setPaused((p) => !p)}
              className={clsx(
                "inline-flex items-center gap-1.5 rounded-xl border px-3.5 py-2.5 text-sm font-semibold transition",
                paused
                  ? "border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                  : "border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100"
              )}
            >
              {paused ? (
                <>
                  <PlayCircle className="h-4 w-4" />
                  Resume
                </>
              ) : (
                <>
                  <PauseCircle className="h-4 w-4" />
                  Pause
                </>
              )}
            </button>
            <button
              type="button"
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
            >
              <Pencil className="h-4 w-4" />
              Edit
            </button>
            <div className="relative">
              <button
                type="button"
                onClick={() => setMenuOpen((v) => !v)}
                aria-label="More actions"
                className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 transition hover:border-slate-300 hover:bg-slate-50"
              >
                <MoreVertical className="h-4 w-4" />
              </button>
              {menuOpen && (
                <>
                  <div
                    className="fixed inset-0 z-30"
                    onClick={() => setMenuOpen(false)}
                  />
                  <div className="absolute right-0 top-12 z-40 w-44 origin-top-right animate-in rounded-xl border border-slate-200 bg-white p-1 shadow-xl">
                    <MenuItem icon={Copy} label="Duplicate" />
                    <MenuItem icon={Archive} label="Archive" />
                    <MenuItem icon={Trash2} label="Delete" tone="danger" />
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── Metric cards ── */}
      <div className="grid grid-cols-2 gap-4 animate-in stagger-2 md:grid-cols-3 lg:grid-cols-5">
        <MetricCard
          title="Spend"
          value={fmtMoney(c.spend).replace("$", "")}
          change={8.2}
          changeLabel="vs yesterday"
          icon={DollarSign}
          iconColor="#059669"
          iconBg="rgba(16, 185, 129, 0.12)"
          trend="up"
          prefix="$"
          sparklineData={[280, 310, 340, 320, 410, 380, 460]}
        />
        <MetricCard
          title="Revenue"
          value={fmtMoney(c.revenue).replace("$", "")}
          change={14.6}
          changeLabel="vs yesterday"
          icon={TrendingUp}
          iconColor="#2563eb"
          iconBg="rgba(59, 130, 246, 0.12)"
          trend="up"
          prefix="$"
          sparklineData={[820, 960, 1040, 1180, 1290, 1340, 1480]}
        />
        <MetricCard
          title="ROAS"
          value={c.roas.toFixed(2)}
          change={0.3}
          changeLabel="vs yesterday"
          icon={Zap}
          iconColor="#7c3aed"
          iconBg="rgba(139, 92, 246, 0.12)"
          trend="up"
          suffix="x"
          sparklineData={[3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7]}
        />
        <MetricCard
          title="Impressions"
          value={fmtCompact(c.impressions)}
          change={6.4}
          changeLabel="vs yesterday"
          icon={Eye}
          iconColor="#ea580c"
          iconBg="rgba(249, 115, 22, 0.12)"
          trend="up"
          sparklineData={[42, 48, 51, 55, 58, 62, 64]}
        />
        <MetricCard
          title="Clicks"
          value={fmtCompact(c.clicks)}
          change={-1.8}
          changeLabel="vs yesterday"
          icon={MousePointerClick}
          iconColor="#0ea5e9"
          iconBg="rgba(14, 165, 233, 0.12)"
          trend="down"
          sparklineData={[920, 880, 940, 900, 870, 860, 820]}
        />
      </div>

      {/* ── Tabs ── */}
      <div className="border-b border-slate-200 animate-in stagger-3">
        <div className="flex flex-wrap items-center gap-1">
          {TABS.map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => setTab(t.key)}
              className={clsx(
                "relative px-4 py-3 text-sm font-semibold transition",
                tab === t.key
                  ? "text-slate-900"
                  : "text-slate-500 hover:text-slate-700"
              )}
            >
              {t.label}
              {tab === t.key && (
                <span className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-primary" />
              )}
            </button>
          ))}
        </div>
      </div>

      {/* ── Tab Panels ── */}
      <div className="animate-in stagger-4">
        {tab === "overview" && <OverviewTab campaign={c} />}
        {tab === "adsets" && <AdSetsTab />}
        {tab === "creatives" && <CreativesTab />}
        {tab === "audience" && <AudienceTab />}
        {tab === "settings" && <SettingsTab campaign={c} />}
      </div>
    </div>
  );
}

function MenuItem({
  icon: Icon,
  label,
  tone = "default",
}: {
  icon: LucideIcon;
  label: string;
  tone?: "default" | "danger";
}) {
  return (
    <button
      type="button"
      className={clsx(
        "flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-xs font-semibold transition",
        tone === "danger"
          ? "text-rose-600 hover:bg-rose-50"
          : "text-slate-700 hover:bg-slate-50"
      )}
    >
      <Icon className="h-3.5 w-3.5" />
      {label}
    </button>
  );
}

/* ───────────────────────────────────────── */
/* Tab: Overview                              */
/* ───────────────────────────────────────── */
function OverviewTab({ campaign }: { campaign: CampaignDetail }) {
  const days = [
    { date: "Sat, May 24", spend: 1840, revenue: 6900, roas: 3.75, ctr: 2.1 },
    { date: "Fri, May 23", spend: 2020, revenue: 7320, roas: 3.62, ctr: 1.9 },
    { date: "Thu, May 22", spend: 1980, revenue: 7180, roas: 3.63, ctr: 2.2 },
    { date: "Wed, May 21", spend: 2240, revenue: 8410, roas: 3.75, ctr: 2.3 },
    { date: "Tue, May 20", spend: 2180, revenue: 7950, roas: 3.65, ctr: 2.0 },
    { date: "Mon, May 19", spend: 2390, revenue: 9120, roas: 3.82, ctr: 2.4 },
    { date: "Sun, May 18", spend: 1620, revenue: 6240, roas: 3.85, ctr: 2.0 },
  ];

  const insights = [
    {
      icon: Sparkles,
      color: "#6366f1",
      bg: "rgba(99,102,241,0.12)",
      title: "Audience expansion is paying off",
      body: "Your 1–3% lookalike segment delivered 28% lower CPA over the last 7 days. Consider scaling its budget by $80/day.",
    },
    {
      icon: TrendingUp,
      color: "#10b981",
      bg: "rgba(16,185,129,0.12)",
      title: "Tuesday & Wednesday outperform",
      body: "ROAS is 19% higher mid-week. Front-load 60% of weekly budget Mon–Wed for max impact.",
    },
    {
      icon: AlertTriangle,
      color: "#f59e0b",
      bg: "rgba(245,158,11,0.12)",
      title: "Creative fatigue forming",
      body: "Variant B's CTR dropped 22% since Wednesday. Generate 2 fresh image ads to refresh the rotation.",
    },
  ];

  return (
    <div className="space-y-6">
      <SpendChart />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="rounded-2xl border border-slate-200/70 bg-white p-5 shadow-card">
          <h3 className="mb-4 text-base font-bold text-slate-900">
            Performance Breakdown
          </h3>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="text-left text-[10px] font-bold uppercase tracking-wider text-slate-500">
                  <th className="pb-2">Date</th>
                  <th className="pb-2">Spend</th>
                  <th className="pb-2">Revenue</th>
                  <th className="pb-2">ROAS</th>
                  <th className="pb-2">CTR</th>
                </tr>
              </thead>
              <tbody>
                {days.map((d) => (
                  <tr
                    key={d.date}
                    className="border-t border-slate-50 transition hover:bg-slate-50/60"
                  >
                    <td className="py-2.5 text-xs font-medium text-slate-700">
                      {d.date}
                    </td>
                    <td className="py-2.5 text-xs font-semibold text-slate-900">
                      {fmtMoney(d.spend)}
                    </td>
                    <td className="py-2.5 text-xs font-semibold text-slate-900">
                      {fmtMoney(d.revenue)}
                    </td>
                    <td className="py-2.5 text-xs font-bold text-emerald-600">
                      {d.roas.toFixed(2)}x
                    </td>
                    <td className="py-2.5 text-xs font-semibold text-slate-700">
                      {d.ctr.toFixed(2)}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200/70 bg-white p-5 shadow-card">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-base font-bold text-slate-900">AI Insights</h3>
            <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-primary">
              <Sparkles className="h-2.5 w-2.5" />
              Auto-generated
            </span>
          </div>
          <ul className="space-y-3">
            {insights.map((i) => (
              <li
                key={i.title}
                className="flex items-start gap-3 rounded-xl border border-slate-100 bg-slate-50/50 p-3"
              >
                <div
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl"
                  style={{ backgroundColor: i.bg, color: i.color }}
                >
                  <i.icon className="h-4 w-4" strokeWidth={2.25} />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-bold text-slate-900">{i.title}</p>
                  <p className="mt-0.5 text-xs leading-relaxed text-slate-600">
                    {i.body}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

/* ───────────────────────────────────────── */
/* Tab: Ad Sets                               */
/* ───────────────────────────────────────── */
function AdSetsTab() {
  const sets = [
    {
      name: "Lookalike 1–3% — Purchasers",
      budget: 1800,
      spend: 1240,
      status: "ACTIVE" as Status,
      roas: 4.6,
    },
    {
      name: "Interest — SaaS Founders",
      budget: 1200,
      spend: 980,
      status: "ACTIVE" as Status,
      roas: 3.2,
    },
    {
      name: "Retargeting — Last 30 Days",
      budget: 800,
      spend: 460,
      status: "PAUSED" as Status,
      roas: 1.8,
    },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-base font-bold text-slate-900">Ad Sets</h3>
        <button type="button" className="btn-brand">
          <Plus className="h-4 w-4" strokeWidth={2.5} />
          Add Ad Set
        </button>
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200/70 bg-white shadow-card">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="text-left text-[11px] font-bold uppercase tracking-wider text-slate-500">
              <th className="px-5 py-3">Ad Set</th>
              <th className="py-3">Status</th>
              <th className="py-3">Budget</th>
              <th className="py-3">Spend</th>
              <th className="py-3">ROAS</th>
              <th className="px-5 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {sets.map((s) => {
              const st = STATUS_META[s.status];
              const pct = Math.round((s.spend / s.budget) * 100);
              return (
                <tr
                  key={s.name}
                  className="border-t border-slate-50 transition hover:bg-slate-50/60"
                >
                  <td className="px-5 py-3.5 text-sm font-semibold text-slate-900">
                    {s.name}
                  </td>
                  <td className="py-3.5">
                    <span className="inline-flex items-center gap-1.5">
                      <span className={clsx("status-dot", st.dot)} />
                      <span
                        className={clsx("text-xs font-semibold", st.cls)}
                      >
                        {st.label}
                      </span>
                    </span>
                  </td>
                  <td className="py-3.5 text-xs font-semibold text-slate-700">
                    {fmtMoney(s.budget)}
                  </td>
                  <td className="py-3.5">
                    <div className="text-xs font-semibold text-slate-700">
                      {fmtMoney(s.spend)}
                    </div>
                    <div className="mt-1 h-1 w-24 overflow-hidden rounded-full bg-slate-100">
                      <div
                        className="h-full rounded-full bg-primary"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </td>
                  <td className="py-3.5">
                    <span
                      className={clsx(
                        "text-sm font-bold",
                        s.roas >= 2 ? "text-emerald-600" : "text-amber-600"
                      )}
                    >
                      {s.roas.toFixed(2)}x
                    </span>
                  </td>
                  <td className="px-5 py-3.5 text-right">
                    <button
                      type="button"
                      className="flex h-7 w-7 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 transition hover:border-primary/40 hover:bg-primary/5 hover:text-primary"
                      aria-label="Edit"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ───────────────────────────────────────── */
/* Tab: Creatives                             */
/* ───────────────────────────────────────── */
function CreativesTab() {
  const creatives = [
    {
      id: "cr-1",
      kind: "Image",
      icon: ImageIcon,
      gradient: "from-indigo-500 via-purple-500 to-pink-500",
      headline: "Limited Drop · 30% Off Today",
      body: "Premium summer essentials — straight from our latest drop. Free shipping over $50.",
      status: "ACTIVE" as Status,
      ctr: 2.8,
      impressions: 184000,
    },
    {
      id: "cr-2",
      kind: "Video 15s",
      icon: Film,
      gradient: "from-emerald-500 via-teal-500 to-cyan-500",
      headline: "Watch How Customers Use It",
      body: "Real reviews from real buyers. See why 25k people made the switch this month.",
      status: "ACTIVE" as Status,
      ctr: 3.4,
      impressions: 96400,
    },
    {
      id: "cr-3",
      kind: "Carousel",
      icon: Layers,
      gradient: "from-amber-400 via-orange-500 to-rose-500",
      headline: "Shop the Best Sellers",
      body: "5 must-have items. Swipe through to find your favorite.",
      status: "PAUSED" as Status,
      ctr: 1.6,
      impressions: 41200,
    },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-base font-bold text-slate-900">Creatives</h3>
        <button type="button" className="btn-brand">
          <Sparkles className="h-4 w-4" strokeWidth={2.5} />
          Generate with AI
        </button>
      </div>

      <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
        {creatives.map((cr) => {
          const st = STATUS_META[cr.status];
          return (
            <div
              key={cr.id}
              className="overflow-hidden rounded-2xl border border-slate-200/70 bg-white shadow-card transition hover:-translate-y-0.5 hover:shadow-card-hover"
            >
              <div
                className={clsx(
                  "relative flex h-40 items-center justify-center bg-gradient-to-br p-5 text-white",
                  cr.gradient
                )}
              >
                <cr.icon className="h-12 w-12 opacity-30" strokeWidth={1.5} />
                <div className="absolute left-4 top-4 inline-flex items-center gap-1 rounded-full bg-white/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white backdrop-blur">
                  {cr.kind}
                </div>
                <div className="absolute right-4 top-4 inline-flex items-center gap-1.5 rounded-full bg-white/95 px-2 py-0.5 ring-1 ring-inset ring-white/40">
                  <span className={clsx("status-dot", st.dot)} />
                  <span className={clsx("text-[10px] font-bold", st.cls)}>
                    {st.label}
                  </span>
                </div>
              </div>
              <div className="p-4">
                <p className="text-sm font-bold text-slate-900">
                  {cr.headline}
                </p>
                <p className="mt-1 line-clamp-2 text-xs text-slate-500">
                  {cr.body}
                </p>
                <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-3">
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                      CTR
                    </p>
                    <p
                      className={clsx(
                        "text-sm font-bold",
                        cr.ctr > 2 ? "text-emerald-600" : "text-amber-600"
                      )}
                    >
                      {cr.ctr.toFixed(2)}%
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                      Impressions
                    </p>
                    <p className="text-sm font-bold text-slate-900">
                      {fmtCompact(cr.impressions)}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ───────────────────────────────────────── */
/* Tab: Audience                              */
/* ───────────────────────────────────────── */
function AudienceTab() {
  const interests = [
    "Business",
    "Entrepreneurship",
    "SaaS",
    "Productivity Tools",
    "Marketing",
  ];
  const locations = ["United States", "Canada", "United Kingdom"];
  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-slate-200/70 bg-white p-5 shadow-card">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h3 className="text-base font-bold text-slate-900">
            Current Targeting
          </h3>
          <button type="button" className="btn-brand">
            <Sparkles className="h-4 w-4" strokeWidth={2.5} />
            Optimize with AI
          </button>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <TargetingBlock label="Age">
            <span className="chip">25–45</span>
          </TargetingBlock>

          <TargetingBlock label="Gender">
            <span className="chip">All genders</span>
          </TargetingBlock>

          <TargetingBlock label="Interests">
            <div className="flex flex-wrap gap-1.5">
              {interests.map((i) => (
                <span key={i} className="chip">
                  {i}
                </span>
              ))}
            </div>
          </TargetingBlock>

          <TargetingBlock label="Locations">
            <div className="flex flex-wrap gap-1.5">
              {locations.map((l) => (
                <span key={l} className="chip">
                  {l}
                </span>
              ))}
            </div>
          </TargetingBlock>
        </div>
      </div>

      <div className="flex items-center justify-between rounded-2xl bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 p-5 text-white shadow-glow">
        <div className="flex items-start gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/15 backdrop-blur">
            <Users className="h-5 w-5" />
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-white/80">
              Estimated audience size
            </p>
            <p className="text-2xl font-bold">2.4M people</p>
            <p className="text-xs text-white/80">
              within your targeting parameters
            </p>
          </div>
        </div>
        <button
          type="button"
          className="rounded-xl bg-white px-4 py-2 text-sm font-bold text-primary-700 shadow-md transition hover:-translate-y-0.5 hover:shadow-lg"
        >
          Refine Audience
        </button>
      </div>

      <style jsx>{`
        :global(.chip) {
          display: inline-flex;
          align-items: center;
          padding: 0.25rem 0.625rem;
          border-radius: 0.5rem;
          background: #f1f5f9;
          color: #334155;
          font-size: 0.75rem;
          font-weight: 600;
        }
      `}</style>
    </div>
  );
}

function TargetingBlock({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <p className="mb-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400">
        {label}
      </p>
      <div>{children}</div>
    </div>
  );
}

/* ───────────────────────────────────────── */
/* Tab: Settings                              */
/* ───────────────────────────────────────── */
function SettingsTab({ campaign }: { campaign: CampaignDetail }) {
  const [name, setName] = useState(campaign.name);
  const [budget, setBudget] = useState(campaign.budget);
  const [active, setActive] = useState(campaign.status === "ACTIVE");

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-slate-200/70 bg-white p-5 shadow-card">
        <h3 className="mb-4 text-base font-bold text-slate-900">
          Campaign Settings
        </h3>
        <div className="space-y-4">
          <div>
            <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-slate-500">
              Campaign name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="h-11 w-full rounded-xl border border-slate-200 px-3 text-sm font-medium text-slate-900 transition focus:border-primary focus:outline-none"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-slate-500">
              Daily budget
            </label>
            <div className="relative">
              <DollarSign className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                type="number"
                value={budget}
                min={1}
                onChange={(e) => setBudget(Number(e.target.value) || 0)}
                className="h-11 w-full rounded-xl border border-slate-200 pl-9 pr-3 text-sm font-medium text-slate-900 transition focus:border-primary focus:outline-none"
              />
            </div>
          </div>
          <div className="flex items-center justify-between rounded-xl bg-slate-50 p-3">
            <div>
              <p className="text-sm font-bold text-slate-900">Campaign status</p>
              <p className="text-xs text-slate-500">
                {active ? "Currently serving" : "Currently paused"}
              </p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={active}
              onClick={() => setActive((v) => !v)}
              className={clsx(
                "relative h-6 w-11 rounded-full transition",
                active ? "bg-primary" : "bg-slate-300"
              )}
            >
              <span
                className={clsx(
                  "absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all",
                  active ? "left-[22px]" : "left-0.5"
                )}
              />
            </button>
          </div>
          <button type="button" className="btn-brand">
            Save Changes
          </button>
        </div>
      </div>

      <div className="rounded-2xl border border-rose-200/70 bg-rose-50/30 p-5">
        <div className="flex items-start gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-rose-100 text-rose-600">
            <AlertTriangle className="h-4 w-4" />
          </div>
          <div className="flex-1">
            <h4 className="text-sm font-bold text-rose-900">Danger zone</h4>
            <p className="mt-0.5 text-xs text-rose-700/80">
              Permanently delete this campaign and all its ad sets, creatives,
              and historical data. This cannot be undone.
            </p>
          </div>
          <button
            type="button"
            className="inline-flex items-center gap-1.5 rounded-xl bg-rose-600 px-3.5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-rose-700"
          >
            <Trash2 className="h-4 w-4" />
            Delete Campaign
          </button>
        </div>
      </div>
    </div>
  );
}
