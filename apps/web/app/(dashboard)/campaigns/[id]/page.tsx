"use client";

import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
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
  Rocket,
  ExternalLink,
  type LucideIcon,
} from "lucide-react";
import PublishToMetaModal from "@/components/campaigns/publish/PublishToMetaModal";
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

import { fmtMoney as fmtMoneyShared, currencySymbol } from "@/lib/money";
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
  const searchParams = useSearchParams();
  // `?publish=1` is how the create wizard hands off — the user pressed
  // "Create & Add Creative", so drop them straight into the publish flow
  // instead of on a detail page they'd have to find the button on.
  const autoPublish = searchParams.get("publish") === "1";

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
      autoPublish={autoPublish}
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
  autoPublish,
}: {
  campaign: Campaign;
  metrics: CampaignMetric[];
  metricsLoading: boolean;
  onRefetch: () => void;
  tab: Tab;
  setTab: (t: Tab) => void;
  menuOpen: boolean;
  setMenuOpen: (b: boolean) => void;
  autoPublish: boolean;
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

  const [publishOpen, setPublishOpen] = useState(false);
  const isPublishedToMeta = c.platform === "META" && Boolean(c.externalId);
  const canPublish = c.platform === "META" && !c.externalId;
  // Ads Manager keys off Meta's OWN numeric account id (act_<digits>), not our
  // internal adAccountId cuid — the old link built from the cuid always landed
  // on an "account not found" page.
  const adsManagerUrl =
    isPublishedToMeta && c.adAccount?.accountId
      ? `https://business.facebook.com/adsmanager/manage/campaigns?act=${c.adAccount.accountId}&selected_campaign_ids=${c.externalId}`
      : null;

  // Open the publish wizard automatically when we arrived via ?publish=1, and
  // strip the param so a refresh (or a back-nav) doesn't reopen it.
  useEffect(() => {
    if (autoPublish && canPublish) {
      setPublishOpen(true);
      router.replace(`/campaigns/${c.id}`, { scroll: false });
    }
  }, [autoPublish, canPublish, c.id, router]);

  async function toggleStatus() {
    if (busy) return;
    const nextStatus: CampaignStatus = c.status === "ACTIVE" ? "PAUSED" : "ACTIVE";
    setBusy(true);
    try {
      // If campaign is published to Meta, flip the status BOTH locally AND on
      // Meta in one call (the /launch route does both). Otherwise just update
      // our local DB row.
      if (isPublishedToMeta) {
        await api.launchCampaign(c.id, nextStatus);
      } else {
        await api.updateCampaign(c.id, { status: nextStatus });
      }
      toast.success(
        nextStatus === "ACTIVE"
          ? isPublishedToMeta
            ? "Launched on Meta"
            : "Campaign resumed"
          : isPublishedToMeta
            ? "Paused on Meta"
            : "Campaign paused"
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
    // Deleting a published campaign stops real spend on Meta — say so.
    if (
      !window.confirm(
        isPublishedToMeta
          ? `Delete "${c.name}"?\n\nThis deletes the campaign ON META too — its ad set and ad stop delivering immediately — along with its metrics here. This cannot be undone.`
          : `Delete "${c.name}"? This removes its metrics and creatives.`
      )
    )
      return;
    setBusy(true);
    try {
      await api.deleteCampaign(c.id);
      toast.success(
        isPublishedToMeta ? "Campaign deleted here and on Meta" : "Campaign deleted"
      );
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
            {canPublish && (
              <button
                type="button"
                onClick={() => setPublishOpen(true)}
                disabled={busy}
                className="btn-brand"
              >
                <Rocket className="h-4 w-4" strokeWidth={2.5} />
                Publish to Meta
              </button>
            )}
            {adsManagerUrl && (
              <a
                href={adsManagerUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-bold text-emerald-700 ring-1 ring-inset ring-emerald-200 transition hover:bg-emerald-100"
                title="Open in Facebook Ads Manager"
              >
                <Sparkles className="h-3 w-3" />
                Live on Meta
                <ExternalLink className="h-3 w-3" />
              </a>
            )}
            <button
              type="button"
              onClick={toggleStatus}
              disabled={busy || c.status === "DRAFT"}
              className={clsx(
                "inline-flex items-center gap-1.5 rounded-xl border px-3.5 py-2.5 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-60",
                c.status === "ACTIVE"
                  ? "border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100"
                  : "border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
              )}
              title={
                c.status === "DRAFT"
                  ? canPublish
                    ? "Publish to Meta first to enable launch"
                    : "DRAFT campaigns can't be launched directly"
                  : undefined
              }
            >
              {busy ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : c.status === "ACTIVE" ? (
                <PauseCircle className="h-4 w-4" />
              ) : (
                <PlayCircle className="h-4 w-4" />
              )}
              {isPublishedToMeta && c.status !== "ACTIVE"
                ? "Launch on Meta"
                : c.status === "ACTIVE"
                  ? "Pause"
                  : "Resume"}
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
      <div className="grid grid-cols-2 gap-4 animate-in stagger-2 md:grid-cols-3 lg:grid-cols-6">
        {metricsLoading ? (
          [0, 1, 2, 3, 4, 5].map((i) => <SkeletonMetricCard key={i} />)
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
              value={totals.revenue === 0 ? "—" : fmtMoney(totals.revenue, currency)}
              change={0}
              changeLabel={
                totals.revenue === 0 ? "no revenue tracked" : `${metrics.length}d window`
              }
              icon={TrendingUp}
              iconColor="#2563eb"
              iconBg="rgba(59, 130, 246, 0.12)"
              trend="neutral"
            />
            <MetricCard
              title="ROAS"
              value={avgRoas === 0 ? "—" : avgRoas.toFixed(2)}
              change={0}
              changeLabel="avg"
              icon={Zap}
              iconColor="#7c3aed"
              iconBg="rgba(139, 92, 246, 0.12)"
              trend={avgRoas >= 2 ? "up" : avgRoas >= 1 ? "neutral" : "down"}
              suffix={avgRoas === 0 ? "" : "x"}
            />
            <MetricCard
              title="Reach"
              value={(c?.reach ?? 0) === 0 ? "—" : fmtCompact(c?.reach ?? 0)}
              change={0}
              changeLabel="unique"
              icon={Users}
              iconColor="#0d9488"
              iconBg="rgba(13, 148, 136, 0.12)"
              trend="neutral"
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

      {/* Surface last publish error so user sees what Meta said */}
      {c.publishError && c.platform === "META" && (
        <div className="animate-in stagger-2 rounded-xl border border-rose-200 bg-rose-50 p-4">
          <div className="flex items-start gap-2">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-rose-600" />
            <div className="flex-1">
              <div className="text-sm font-bold text-rose-900">
                Last publish attempt failed
              </div>
              <div className="mt-0.5 text-xs text-rose-700">
                {c.publishError}
              </div>
              <div className="mt-2 text-[11px] text-rose-600">
                Click <strong>Publish to Meta</strong> above to retry. Any
                partial Meta-side objects were rolled back automatically.
              </div>
            </div>
          </div>
        </div>
      )}

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

      <PublishToMetaModal
        open={publishOpen}
        campaign={c}
        onClose={() => setPublishOpen(false)}
        onPublished={() => {
          setPublishOpen(false);
          onRefetch();
        }}
      />
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
    const cur = campaign.adAccount?.currency;
    const ctr =
      totals.impressions > 0 ? totals.clicks / totals.impressions : 0;
    if (ctr > 0 && ctr < 0.01) {
      const cpc = totals.clicks > 0 ? totals.spend / totals.clicks : 0;
      out.push({
        icon: AlertTriangle,
        color: "#f59e0b",
        bg: "rgba(245,158,11,0.12)",
        title: "CTR below 1%",
        body: `${totals.clicks.toLocaleString()} clicks from ${totals.impressions.toLocaleString()} impressions is ${(
          ctr * 100
        ).toFixed(2)}% — under the 1% bar for Meta feed ads${
          cpc > 0 ? `, at ${fmtMoney(cpc, cur)} per click` : ""
        }. The creative is the lever here, not the targeting: try a new opening line or a different image.`,
      });
    }

    // Spend with nothing to show for it is the most expensive failure mode a
    // beginner can sit in, so call it out explicitly rather than leaving them
    // to infer it from a zero in the ROAS tile.
    if (totals.spend > 0 && totals.conversions === 0) {
      out.push({
        icon: AlertTriangle,
        color: "#ef4444",
        bg: "rgba(239,68,68,0.12)",
        title: "Spending but no conversions recorded",
        body: `${fmtMoney(totals.spend, cur)} spent with 0 conversions tracked over ${
          metrics.length
        } day${metrics.length === 1 ? "" : "s"}. Either the offer isn't landing, or the Meta Pixel isn't recording the conversion event — check Events Manager before you change the budget.`,
      });
    } else if (totals.conversions > 0 && totals.spend > 0) {
      const cpa = totals.spend / totals.conversions;
      out.push({
        icon: TrendingUp,
        color: "#0d9488",
        bg: "rgba(13,148,136,0.12)",
        title: `Cost per result: ${fmtMoney(cpa, cur)}`,
        body: `${totals.conversions.toLocaleString()} result${
          totals.conversions === 1 ? "" : "s"
        } from ${fmtMoney(totals.spend, cur)}. Decide your ceiling — if a customer is worth more than ${fmtMoney(
          cpa,
          cur
        )} to you, this is working and you can scale it.`,
      });
    }

    const budget = Number(campaign.budget) || 0;
    // Daily budgets are compared to the LATEST day's spend; a lifetime budget
    // is compared to the running total. Comparing lifetime spend to a daily
    // budget is what made this warning fire on every healthy campaign.
    const latestDaySpend = metrics.length > 0 ? Number(metrics[0].spend) || 0 : 0;
    const pacingSpend =
      campaign.budgetType === "LIFETIME" ? totals.spend : latestDaySpend;
    if (budget > 0 && pacingSpend / budget > 0.9) {
      out.push({
        icon: AlertTriangle,
        color: "#ef4444",
        bg: "rgba(239,68,68,0.12)",
        title:
          campaign.budgetType === "LIFETIME"
            ? "Lifetime budget nearly used up"
            : "Hitting the daily budget cap",
        body:
          campaign.budgetType === "LIFETIME"
            ? `${fmtMoney(totals.spend, cur)} of the ${fmtMoney(budget, cur)} lifetime budget is gone. Delivery stops when it runs out — raise it or set an end date you're happy with.`
            : `Yesterday used ${fmtMoney(latestDaySpend, cur)} of the ${fmtMoney(budget, cur)} daily budget. Meta is capping delivery, so there's more demand than you're paying for.`,
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
  }, [
    metrics,
    avgRoas,
    totals.clicks,
    totals.impressions,
    totals.spend,
    totals.conversions,
    campaign.budget,
    campaign.budgetType,
    campaign.adAccount?.currency,
  ]);

  // Zero data isn't an error state — a campaign published an hour ago has
  // nothing to analyse yet. Say that plainly instead of showing an empty
  // insights panel or a broken chart.
  if (metrics.length === 0) {
    const published = Boolean(campaign.externalId);
    return (
      <div className="space-y-6">
        <EmptyState
          icon={TrendingUp}
          title={
            published
              ? "No performance data yet"
              : "This campaign hasn't run yet"
          }
          description={
            published
              ? "Meta reports results a few hours after delivery starts. Hit Sync on the Campaigns page once it's been live for a day."
              : "Publish it to Meta and let it deliver — spend, clicks and conversions will show up here once Meta starts reporting."
          }
          action={{
            label: published ? "Go to Campaigns" : "Go to Integrations",
            onClick: () =>
              (window.location.href = published
                ? "/campaigns"
                : "/settings?tab=integrations"),
          }}
        />

        <div className="rounded-2xl border border-slate-200/70 bg-white p-5 shadow-card">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-base font-bold text-slate-900">AI Insights</h3>
            <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-slate-500">
              <Sparkles className="h-2.5 w-2.5" />
              Waiting for data
            </span>
          </div>
          <div className="flex items-start gap-3 rounded-xl border border-slate-100 bg-slate-50/50 p-4">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Sparkles className="h-4 w-4" strokeWidth={2.25} />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-bold text-slate-900">
                Run this campaign for a few days to see AI insights
              </p>
              <p className="mt-0.5 text-xs leading-relaxed text-slate-600">
                Insights are read off this campaign&apos;s own numbers — ROAS,
                CTR, cost per result and budget pacing. Meta needs roughly
                48–72 hours of delivery before those figures mean anything, so
                there&apos;s nothing honest to say about{" "}
                <strong>{campaign.name}</strong> yet.
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <SpendChart data={chartData} showRangeTabs={false} currency={currency} />

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
  // Raw text, same reason as the create wizard: a number-typed state makes the
  // last character undeletable because "" coerces straight back to 0.
  const [budgetInput, setBudgetInput] = useState(String(Number(c.budget) || 0));
  const budget = (() => {
    const n = Number(budgetInput);
    return budgetInput.trim() !== "" && Number.isFinite(n) ? n : 0;
  })();
  const [busy, setBusy] = useState(false);

  const dirty = (name.trim() !== c.name && name.trim() !== "") || budget !== Number(c.budget);
  // Block daily budgets below the account's real Meta minimum (publish would
  // be rejected otherwise). Only when the minimum is known — but a zero or
  // empty budget is invalid regardless, and without this guard an account that
  // hasn't synced its minimum yet could save a 0 that fails at publish.
  const minDaily = c.adAccount?.minDailyBudget ?? null;
  const belowMin =
    budget <= 0 ||
    (c.budgetType === "DAILY" && !!minDaily && minDaily > 0 && budget < minDaily);

  async function save() {
    if (busy || !dirty || belowMin) return;
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
    const liveOnMeta = c.platform === "META" && Boolean(c.externalId);
    if (
      !window.confirm(
        liveOnMeta
          ? `Delete "${c.name}"?\n\nThis deletes the campaign ON META too — its ad set and ad stop delivering immediately — along with all its metrics here. This cannot be undone.`
          : `Delete "${c.name}"? This removes all its metrics and creatives.`
      )
    )
      return;
    setBusy(true);
    try {
      await api.deleteCampaign(c.id);
      toast.success(
        liveOnMeta ? "Campaign deleted here and on Meta" : "Campaign deleted"
      );
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
              {c.budgetType === "DAILY" ? "Daily budget" : "Total budget"}
            </label>
            <div className="relative">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">
                {currencySymbol(c.adAccount?.currency)}
              </span>
              <input
                type="number"
                value={budgetInput}
                min={c.budgetType === "DAILY" && minDaily ? minDaily : 1}
                inputMode="decimal"
                onChange={(e) => setBudgetInput(e.target.value)}
                onBlur={() => {
                  if (budgetInput.trim() === "") {
                    setBudgetInput(
                      String(Math.ceil(c.budgetType === "DAILY" && minDaily ? minDaily : 1))
                    );
                  }
                }}
                className={clsx(
                  "h-11 w-full rounded-xl border pl-12 pr-3 text-sm font-medium text-slate-900 transition focus:outline-none",
                  belowMin
                    ? "border-rose-300 focus:border-rose-400"
                    : "border-slate-200 focus:border-primary"
                )}
              />
            </div>
            {belowMin && (
              <p className="mt-1.5 text-xs font-semibold text-rose-600">
                {budget <= 0
                  ? "Enter a budget above zero."
                  : `Below this account's minimum of ${currencySymbol(
                      c.adAccount?.currency
                    )}${(minDaily ?? 0).toLocaleString()} per day.`}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={save}
            disabled={!dirty || busy || belowMin}
            className={clsx("btn-brand", (!dirty || busy || belowMin) && "opacity-60")}
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

