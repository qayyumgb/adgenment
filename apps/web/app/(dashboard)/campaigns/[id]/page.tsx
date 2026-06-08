"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import clsx from "clsx";
import toast from "react-hot-toast";
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
  Sparkles,
  Image as ImageIcon,
  Film,
  Layers,
  Users,
  AlertTriangle,
  Megaphone,
  Loader2,
  type LucideIcon,
} from "lucide-react";
import MetricCard from "@/components/dashboard/MetricCard";
import SpendChart, {
  type SpendChartPoint,
} from "@/components/dashboard/SpendChart";
import {
  SkeletonCard,
  SkeletonMetricCard,
  SkeletonChartCard,
} from "@/components/ui/Skeleton";
import EmptyState from "@/components/ui/EmptyState";
import { useApi } from "@/hooks/useApi";
import { useApiClient } from "@/lib/api";
import type {
  Campaign,
  CampaignMetric,
  CampaignStatus,
  Platform,
} from "@/lib/api";

type Tab = "overview" | "adsets" | "creatives" | "audience" | "settings";

const TABS: { key: Tab; label: string }[] = [
  { key: "overview", label: "Overview" },
  { key: "adsets", label: "Ad Sets" },
  { key: "creatives", label: "Creatives" },
  { key: "audience", label: "Audience" },
  { key: "settings", label: "Settings" },
];

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

const STATUS_META: Record<
  CampaignStatus,
  { label: string; cls: string; dot: "active" | "paused" | "draft" | "ended" }
> = {
  ACTIVE: { label: "Active", cls: "text-emerald-700", dot: "active" },
  PAUSED: { label: "Paused", cls: "text-amber-700", dot: "paused" },
  DRAFT: { label: "Draft", cls: "text-slate-600", dot: "draft" },
  ENDED: { label: "Ended", cls: "text-rose-700", dot: "ended" },
};

import { fmtMoney as fmtMoneyShared } from "@/lib/money";
function fmtMoney(n: number, currency?: string | null) {
  return fmtMoneyShared(n, currency);
}

function fmtCompact(n: number): string {
  if (n >= 1_000_000)
    return (n / 1_000_000).toFixed(1).replace(/\.0$/, "") + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(1).replace(/\.0$/, "") + "K";
  return n.toString();
}

export default function CampaignDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params?.id ?? "";

  const campaignQ = useApi<Campaign>(
    (client) => client.getCampaign(id),
    [id]
  );
  const metricsQ = useApi<CampaignMetric[]>(
    (client) => client.getCampaignMetrics(id, 30),
    [id]
  );

  const [tab, setTab] = useState<Tab>("overview");
  const [menuOpen, setMenuOpen] = useState(false);

  const c = campaignQ.data;
  const metrics = metricsQ.data ?? [];

  if (campaignQ.loading) {
    return <DetailSkeleton />;
  }

  if (campaignQ.error || !c) {
    return (
      <div className="space-y-6">
        <Link
          href="/campaigns"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-primary"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Campaigns
        </Link>
        <EmptyState
          icon={Megaphone}
          title="Campaign not found"
          description={
            campaignQ.error ??
            "This campaign doesn't exist in your workspace, or you don't have access to it."
          }
          action={{
            label: "Back to Campaigns",
            onClick: () => (window.location.href = "/campaigns"),
          }}
        />
      </div>
    );
  }

  return (
    <CampaignDetail
      campaign={c}
      metrics={metrics}
      metricsLoading={metricsQ.loading}
      onRefetch={() => {
        campaignQ.refetch();
        metricsQ.refetch();
      }}
      tab={tab}
      setTab={setTab}
      menuOpen={menuOpen}
      setMenuOpen={setMenuOpen}
    />
  );
}

function DetailSkeleton() {
  return (
    <div className="space-y-6">
      <div className="h-6 w-32 animate-pulse rounded bg-slate-200/70" />
      <div className="h-10 w-2/3 animate-pulse rounded bg-slate-200/70" />
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-5">
        {[0, 1, 2, 3, 4].map((i) => (
          <SkeletonMetricCard key={i} />
        ))}
      </div>
      <SkeletonChartCard height={288} />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <SkeletonCard className="h-72" />
        <SkeletonCard className="h-72" />
      </div>
    </div>
  );
}

function CampaignDetail({
  campaign: c,
  metrics,
  metricsLoading,
  onRefetch,
  tab,
  setTab,
  menuOpen,
  setMenuOpen,
}: {
  campaign: Campaign;
  metrics: CampaignMetric[];
  metricsLoading: boolean;
  onRefetch: () => void;
  tab: Tab;
  setTab: (t: Tab) => void;
  menuOpen: boolean;
  setMenuOpen: (b: boolean) => void;
}) {
  const router = useRouter();
  const api = useApiClient();
  const [busy, setBusy] = useState(false);

  const plat = PLATFORM_META[c.platform] ?? PLATFORM_META.META;
  const st = STATUS_META[c.status];
  const currency = c.adAccount?.currency ?? null;

  // Aggregate metric totals for the metric cards
  const totals = useMemo(() => {
    return metrics.reduce(
      (acc, m) => {
        acc.spend += Number(m.spend) || 0;
        acc.revenue += Number(m.revenue) || 0;
        acc.impressions += m.impressions;
        acc.clicks += m.clicks;
        acc.conversions += m.conversions;
        return acc;
      },
      { spend: 0, revenue: 0, impressions: 0, clicks: 0, conversions: 0 }
    );
  }, [metrics]);
  const avgRoas = totals.spend > 0 ? totals.revenue / totals.spend : 0;

  const chartData = useMemo<SpendChartPoint[]>(
    () =>
      [...metrics]
        .sort((a, b) => a.date.localeCompare(b.date))
        .map((m) => ({
          date: m.date.slice(0, 10),
          spend: Number(m.spend) || 0,
          roas: Number(m.roas) || 0,
        })),
    [metrics]
  );

  async function toggleStatus() {
    if (busy) return;
    const nextStatus: CampaignStatus = c.status === "ACTIVE" ? "PAUSED" : "ACTIVE";
    setBusy(true);
    try {
      await api.updateCampaign(c.id, { status: nextStatus });
      toast.success(
        nextStatus === "ACTIVE" ? "Campaign resumed" : "Campaign paused"
      );
      onRefetch();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Update failed");
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete() {
    if (busy) return;
    if (
      !window.confirm(
        `Delete "${c.name}"? This removes its metrics and creatives.`
      )
    )
      return;
    setBusy(true);
    try {
      await api.deleteCampaign(c.id);
      toast.success("Campaign deleted");
      router.push("/campaigns");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Delete failed");
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
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
              onClick={toggleStatus}
              disabled={busy}
              className={clsx(
                "inline-flex items-center gap-1.5 rounded-xl border px-3.5 py-2.5 text-sm font-semibold transition disabled:opacity-60",
                c.status === "ACTIVE"
                  ? "border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100"
                  : "border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
              )}
            >
              {busy ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : c.status === "ACTIVE" ? (
                <PauseCircle className="h-4 w-4" />
              ) : (
                <PlayCircle className="h-4 w-4" />
              )}
              {c.status === "ACTIVE" ? "Pause" : "Resume"}
            </button>
            <button
              type="button"
              onClick={() => setTab("settings")}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
            >
              <Pencil className="h-4 w-4" />
              Edit
            </button>
            <div className="relative">
              <button
                type="button"
                onClick={() => setMenuOpen(!menuOpen)}
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
                    <button
                      type="button"
                      onClick={() => {
                        setMenuOpen(false);
                        handleDelete();
                      }}
                      className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-xs font-semibold text-rose-600 transition hover:bg-rose-50"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      Delete
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Metric cards */}
      <div className="grid grid-cols-2 gap-4 animate-in stagger-2 md:grid-cols-3 lg:grid-cols-5">
        {metricsLoading ? (
          [0, 1, 2, 3, 4].map((i) => <SkeletonMetricCard key={i} />)
        ) : metrics.length === 0 ? (
          <div className="col-span-full">
            <EmptyState
              icon={TrendingUp}
              title="No metrics yet"
              description="Run a sync from Settings → Integrations to pull metrics for this campaign."
              compact
            />
          </div>
        ) : (
          <>
            <MetricCard
              title="Spend"
              value={fmtMoney(totals.spend, currency)}
              change={0}
              changeLabel={`${metrics.length}d window`}
              icon={DollarSign}
              iconColor="#059669"
              iconBg="rgba(16, 185, 129, 0.12)"
              trend="neutral"
            />
            <MetricCard
              title="Revenue"
              value={fmtMoney(totals.revenue, currency)}
              change={0}
              changeLabel={`${metrics.length}d window`}
              icon={TrendingUp}
              iconColor="#2563eb"
              iconBg="rgba(59, 130, 246, 0.12)"
              trend="neutral"
            />
            <MetricCard
              title="ROAS"
              value={avgRoas.toFixed(2)}
              change={0}
              changeLabel="avg"
              icon={Zap}
              iconColor="#7c3aed"
              iconBg="rgba(139, 92, 246, 0.12)"
              trend={avgRoas >= 2 ? "up" : avgRoas >= 1 ? "neutral" : "down"}
              suffix="x"
            />
            <MetricCard
              title="Impressions"
              value={fmtCompact(totals.impressions)}
              change={0}
              changeLabel="total"
              icon={Eye}
              iconColor="#ea580c"
              iconBg="rgba(249, 115, 22, 0.12)"
              trend="neutral"
            />
            <MetricCard
              title="Clicks"
              value={fmtCompact(totals.clicks)}
              change={0}
              changeLabel="total"
              icon={MousePointerClick}
              iconColor="#0ea5e9"
              iconBg="rgba(14, 165, 233, 0.12)"
              trend="neutral"
            />
          </>
        )}
      </div>

      {/* Tabs */}
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

      {/* Tab Panels */}
      <div className="animate-in stagger-4">
        {tab === "overview" && (
          <OverviewTab
            campaign={c}
            metrics={metrics}
            chartData={chartData}
            totals={totals}
            avgRoas={avgRoas}
          />
        )}
        {tab === "adsets" && <AdSetsTab />}
        {tab === "creatives" && <CreativesTab />}
        {tab === "audience" && <AudienceTab />}
        {tab === "settings" && (
          <SettingsTab campaign={c} onSaved={onRefetch} />
        )}
      </div>
    </div>
  );
}

function MenuItem({ icon: Icon, label }: { icon: LucideIcon; label: string }) {
  return (
    <button
      type="button"
      className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
    >
      <Icon className="h-3.5 w-3.5" />
      {label}
    </button>
  );
}

/* ───────────────────────────────────────── */
/* Overview                                   */
/* ───────────────────────────────────────── */

function OverviewTab({
  campaign,
  metrics,
  chartData,
  totals,
  avgRoas,
}: {
  campaign: Campaign;
  metrics: CampaignMetric[];
  chartData: SpendChartPoint[];
  totals: {
    spend: number;
    revenue: number;
    impressions: number;
    clicks: number;
    conversions: number;
  };
  avgRoas: number;
}) {
  const currency = campaign.adAccount?.currency ?? null;
  const last7 = useMemo(
    () =>
      [...metrics]
        .sort((a, b) => b.date.localeCompare(a.date))
        .slice(0, 7),
    [metrics]
  );

  // Smart, deterministic insights based on real metrics — no LLM call per page view.
  const insights = useMemo(() => {
    const out: Array<{
      icon: LucideIcon;
      color: string;
      bg: string;
      title: string;
      body: string;
    }> = [];
    if (metrics.length === 0) {
      return out;
    }
    if (avgRoas < 1) {
      out.push({
        icon: AlertTriangle,
        color: "#f59e0b",
        bg: "rgba(245,158,11,0.12)",
        title: "ROAS below break-even",
        body: `Last 30 days averaged ${avgRoas.toFixed(
          2
        )}x. Consider pausing low-performing ad sets or reducing budget.`,
      });
    } else if (avgRoas < 2) {
      out.push({
        icon: TrendingUp,
        color: "#6366f1",
        bg: "rgba(99,102,241,0.12)",
        title: "ROAS could improve",
        body: `${avgRoas.toFixed(
          2
        )}x is profitable but below the 2x benchmark — test new creatives or refine targeting.`,
      });
    } else {
      out.push({
        icon: TrendingUp,
        color: "#10b981",
        bg: "rgba(16,185,129,0.12)",
        title: "Healthy ROAS",
        body: `${avgRoas.toFixed(
          2
        )}x is above the 2x benchmark. Consider scaling budget up by 10-20% to capture more demand.`,
      });
    }
    const ctr =
      totals.impressions > 0 ? totals.clicks / totals.impressions : 0;
    if (ctr > 0 && ctr < 0.01) {
      out.push({
        icon: AlertTriangle,
        color: "#f59e0b",
        bg: "rgba(245,158,11,0.12)",
        title: "CTR below 1%",
        body: `Click-through rate is ${(ctr * 100).toFixed(
          2
        )}%. Creative refresh recommended — try new headlines or imagery.`,
      });
    }
    const budget = Number(campaign.budget) || 0;
    if (budget > 0 && totals.spend / budget > 0.9) {
      out.push({
        icon: AlertTriangle,
        color: "#ef4444",
        bg: "rgba(239,68,68,0.12)",
        title: "Budget nearly depleted",
        body: `Spent ${fmtMoney(totals.spend, campaign.adAccount?.currency)} of ${fmtMoney(
          budget,
          campaign.adAccount?.currency
        )} budget — consider increasing to maintain delivery.`,
      });
    }
    if (out.length === 0) {
      out.push({
        icon: Sparkles,
        color: "#6366f1",
        bg: "rgba(99,102,241,0.12)",
        title: "Performance looking solid",
        body: "Keep monitoring. Run an AI Planner session to find opportunities to scale.",
      });
    }
    return out;
  }, [metrics.length, avgRoas, totals.clicks, totals.impressions, totals.spend, campaign.budget]);

  if (metrics.length === 0) {
    return (
      <EmptyState
        icon={TrendingUp}
        title="No performance data yet"
        description="Sync this campaign's platform to pull spend, impressions, clicks, and conversions."
        action={{
          label: "Go to Integrations",
          onClick: () =>
            (window.location.href = "/settings?tab=integrations"),
        }}
      />
    );
  }

  return (
    <div className="space-y-6">
      <SpendChart data={chartData} showRangeTabs={false} />

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
                {last7.map((d) => {
                  const spend = Number(d.spend) || 0;
                  const revenue = Number(d.revenue) || 0;
                  const roas = Number(d.roas) || 0;
                  const ctr = (Number(d.ctr) || 0) * 100;
                  return (
                    <tr
                      key={d.date}
                      className="border-t border-slate-50 transition hover:bg-slate-50/60"
                    >
                      <td className="py-2.5 text-xs font-medium text-slate-700">
                        {d.date.slice(0, 10)}
                      </td>
                      <td className="py-2.5 text-xs font-semibold text-slate-900">
                        {fmtMoney(spend, currency)}
                      </td>
                      <td className="py-2.5 text-xs font-semibold text-slate-900">
                        {fmtMoney(revenue, currency)}
                      </td>
                      <td
                        className={clsx(
                          "py-2.5 text-xs font-bold",
                          roas >= 2 ? "text-emerald-600" : "text-amber-600"
                        )}
                      >
                        {roas.toFixed(2)}x
                      </td>
                      <td className="py-2.5 text-xs font-semibold text-slate-700">
                        {ctr.toFixed(2)}%
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200/70 bg-white p-5 shadow-card">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-base font-bold text-slate-900">AI Insights</h3>
            <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-primary">
              <Sparkles className="h-2.5 w-2.5" />
              Auto-derived
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
/* Other tabs — mock until backend lands     */
/* ───────────────────────────────────────── */

// TODO(phase-3): wire to /api/campaigns/:id/ad-sets
function AdSetsTab() {
  return (
    <EmptyState
      icon={Layers}
      title="Ad Sets coming soon"
      description="Ad set sync and management is on the Phase 3 roadmap. For now you can manage ad sets directly in the source platform."
      compact
    />
  );
}

// TODO(phase-3): wire to /api/creatives?campaignId=:id
function CreativesTab() {
  return (
    <EmptyState
      icon={ImageIcon}
      title="Creatives for this campaign"
      description="Once you generate creatives in the Creatives page and link them to this campaign, they'll appear here."
      action={{
        label: "Open Creatives",
        onClick: () => (window.location.href = "/creatives"),
        icon: Film,
      }}
      compact
    />
  );
}

// TODO(phase-3): wire to /api/audiences?campaignId=:id
function AudienceTab() {
  return (
    <EmptyState
      icon={Users}
      title="Audience targeting"
      description="Audience-level reporting comes online when audience-management APIs are wired up in Phase 3."
      action={{
        label: "Open Audiences",
        onClick: () => (window.location.href = "/audiences"),
      }}
      compact
    />
  );
}

/* ───────────────────────────────────────── */
/* Settings                                   */
/* ───────────────────────────────────────── */

function SettingsTab({
  campaign: c,
  onSaved,
}: {
  campaign: Campaign;
  onSaved: () => void;
}) {
  const api = useApiClient();
  const [name, setName] = useState(c.name);
  const [budget, setBudget] = useState(Number(c.budget) || 0);
  const [busy, setBusy] = useState(false);

  const dirty = name !== c.name || budget !== Number(c.budget);

  async function save() {
    if (busy || !dirty) return;
    setBusy(true);
    try {
      await api.updateCampaign(c.id, { name: name.trim(), budget });
      toast.success("Campaign saved");
      onSaved();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Save failed");
    } finally {
      setBusy(false);
    }
  }

  async function deleteCampaign() {
    if (
      !window.confirm(
        `Delete "${c.name}"? This removes all its metrics and creatives.`
      )
    )
      return;
    setBusy(true);
    try {
      await api.deleteCampaign(c.id);
      toast.success("Campaign deleted");
      window.location.href = "/campaigns";
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Delete failed");
      setBusy(false);
    }
  }

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
          <button
            type="button"
            onClick={save}
            disabled={!dirty || busy}
            className={clsx("btn-brand", (!dirty || busy) && "opacity-60")}
          >
            {busy ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <>Save Changes</>
            )}
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
              Permanently delete this campaign and all its metrics + creatives.
            </p>
          </div>
          <button
            type="button"
            onClick={deleteCampaign}
            disabled={busy}
            className="inline-flex items-center gap-1.5 rounded-xl bg-rose-600 px-3.5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-rose-700 disabled:opacity-60"
          >
            {busy ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Trash2 className="h-4 w-4" />
            )}
            Delete Campaign
          </button>
        </div>
      </div>
    </div>
  );
}

