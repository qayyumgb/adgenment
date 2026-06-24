"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import clsx from "clsx";
import toast from "react-hot-toast";
import {
  RefreshCw,
  Plus,
  Search,
  LayoutGrid,
  List,
  RotateCcw,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Pencil,
  PauseCircle,
  PlayCircle,
  Copy,
  Trash2,
  Calendar,
  Megaphone,
  Loader2,
} from "lucide-react";
import CreateCampaignModal, {
  type CampaignPrefill,
} from "@/components/campaigns/CreateCampaignModal";
import { SkeletonCampaignCard, SkeletonTableRow } from "@/components/ui/Skeleton";
import EmptyState from "@/components/ui/EmptyState";
import { useApi } from "@/hooks/useApi";
import { useApiClient } from "@/lib/api";
import { fmtMoney } from "@/lib/money";
import type {
  Campaign,
  CampaignsResponse,
  CampaignStatus,
  Platform,
} from "@/lib/api";

type DateRange = "7" | "30" | "90" | "CUSTOM";

const PLATFORM_META: Record<
  Platform,
  { label: string; color: string; bg: string; text: string }
> = {
  META: {
    label: "Meta",
    color: "#1877F2",
    bg: "bg-[#1877F2]/10",
    text: "text-[#1877F2]",
  },
  GOOGLE: {
    label: "Google",
    color: "#EA4335",
    bg: "bg-[#EA4335]/10",
    text: "text-[#EA4335]",
  },
  TIKTOK: {
    label: "TikTok",
    color: "#0f172a",
    bg: "bg-slate-900/[0.08]",
    text: "text-slate-900",
  },
  LINKEDIN: {
    label: "LinkedIn",
    color: "#0A66C2",
    bg: "bg-[#0A66C2]/10",
    text: "text-[#0A66C2]",
  },
  YOUTUBE: {
    label: "YouTube",
    color: "#FF0000",
    bg: "bg-[#FF0000]/10",
    text: "text-[#FF0000]",
  },
  SNAPCHAT: {
    label: "Snapchat",
    color: "#FFFC00",
    bg: "bg-[#FFFC00]/20",
    text: "text-slate-900",
  },
  PINTEREST: {
    label: "Pinterest",
    color: "#E60023",
    bg: "bg-[#E60023]/10",
    text: "text-[#E60023]",
  },
  X: {
    label: "X",
    color: "#0f172a",
    bg: "bg-slate-900/[0.08]",
    text: "text-slate-900",
  },
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

function fmtCompact(n: number): string {
  if (n >= 1_000_000)
    return (n / 1_000_000).toFixed(1).replace(/\.0$/, "") + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(1).replace(/\.0$/, "") + "K";
  return n.toString();
}

const VIEW_STORAGE_KEY = "campaigns-view";
const PAGE_SIZE = 9;

export default function CampaignsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [view, setView] = useState<"grid" | "list">("grid");
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [platformFilter, setPlatformFilter] = useState<"ALL" | Platform>(
    "ALL"
  );
  const [statusFilter, setStatusFilter] = useState<"ALL" | CampaignStatus>(
    "ALL"
  );
  const [range, setRange] = useState<DateRange>("30");
  const [page, setPage] = useState(1);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalPrefill, setModalPrefill] = useState<CampaignPrefill | null>(
    null
  );

  // Open the modal automatically when redirected with ?new=1 (used by
  // Header, Dashboard Quick Actions, and the AI Planner "Apply" button).
  // If the AI Planner stashed prefill data in sessionStorage, pop it once
  // and feed it into the modal.
  useEffect(() => {
    if (searchParams.get("new") === "1") {
      try {
        const raw = sessionStorage.getItem("aiPlanPrefill");
        if (raw) {
          setModalPrefill(JSON.parse(raw) as CampaignPrefill);
          sessionStorage.removeItem("aiPlanPrefill");
        }
      } catch {
        // ignore
      }
      setModalOpen(true);
      const params = new URLSearchParams(searchParams.toString());
      params.delete("new");
      const qs = params.toString();
      router.replace(qs ? `/campaigns?${qs}` : "/campaigns", { scroll: false });
    }
  }, [searchParams, router]);

  // Restore view preference
  useEffect(() => {
    const stored =
      typeof window !== "undefined"
        ? (localStorage.getItem(VIEW_STORAGE_KEY) as "grid" | "list" | null)
        : null;
    if (stored === "grid" || stored === "list") setView(stored);
  }, []);
  useEffect(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem(VIEW_STORAGE_KEY, view);
    }
  }, [view]);

  // Debounce the search input to avoid hammering the API on every keystroke
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  // Reset to page 1 when filters change
  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, platformFilter, statusFilter]);

  const filtersActive =
    debouncedSearch.trim() !== "" ||
    platformFilter !== "ALL" ||
    statusFilter !== "ALL" ||
    range !== "30";

  // Real campaigns fetch
  const { data, loading, error, refetch } = useApi<CampaignsResponse>(
    (client) =>
      client.getCampaigns({
        platform: platformFilter !== "ALL" ? platformFilter : undefined,
        status: statusFilter !== "ALL" ? statusFilter : undefined,
        search: debouncedSearch.trim() || undefined,
        page: String(page),
        limit: String(PAGE_SIZE),
      }),
    [debouncedSearch, platformFilter, statusFilter, page]
  );

  // Separate count fetches for the stat chips so they don't change with filters
  const counts = useApi(
    (client) =>
      Promise.all([
        client.getCampaigns({ limit: "1" }),
        client.getCampaigns({ status: "ACTIVE", limit: "1" }),
        client.getCampaigns({ status: "PAUSED", limit: "1" }),
        client.getCampaigns({ status: "DRAFT", limit: "1" }),
      ]).then(([total, active, paused, draft]) => ({
        total: total.total,
        active: active.total,
        paused: paused.total,
        draft: draft.total,
      })),
    []
  );

  const resetFilters = () => {
    setSearch("");
    setPlatformFilter("ALL");
    setStatusFilter("ALL");
    setRange("30");
  };

  const refetchAll = useCallback(async () => {
    await Promise.all([refetch(), counts.refetch()]);
  }, [refetch, counts]);

  // Pull fresh data FROM Meta (imports new campaigns like boosted posts, and
  // refreshes spend/reach), then reload the local views. Distinct from the
  // plain refetch, which only re-reads what we've already synced.
  const apiClient = useApiClient();
  const [syncing, setSyncing] = useState(false);
  const handleSync = useCallback(async () => {
    setSyncing(true);
    try {
      const r = await apiClient.syncMeta();
      await refetchAll();
      toast.success(`Synced ${r.campaignsSynced} campaign${r.campaignsSynced === 1 ? "" : "s"} from Meta`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Sync failed");
    } finally {
      setSyncing(false);
    }
  }, [apiClient, refetchAll]);

  const totalPages = data?.totalPages ?? 1;
  const campaigns = data?.campaigns ?? [];

  return (
    <div className="space-y-6">
      {/* ── Top bar ── */}
      <header className="flex flex-wrap items-end justify-between gap-3 animate-in stagger-1">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 lg:text-3xl">
            Campaigns
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Manage and monitor all your ad campaigns
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleSync}
            disabled={syncing}
            title="Pull the latest campaigns and metrics from Meta"
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50 disabled:opacity-60"
          >
            {syncing ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
            {syncing ? "Syncing…" : "Sync now"}
          </button>
          <button
            type="button"
            onClick={() => setModalOpen(true)}
            className="btn-brand"
          >
            <Plus className="h-4 w-4" strokeWidth={2.5} />
            New Campaign
          </button>
        </div>
      </header>

      {/* ── Stats chips ── */}
      <div className="flex flex-wrap items-center gap-2 animate-in stagger-2">
        <StatChip
          label="Total"
          value={counts.loading ? "…" : counts.data?.total ?? 0}
        />
        <StatChip
          label="Active"
          value={counts.loading ? "…" : counts.data?.active ?? 0}
          dot="active"
        />
        <StatChip
          label="Paused"
          value={counts.loading ? "…" : counts.data?.paused ?? 0}
          dot="paused"
        />
        <StatChip
          label="Draft"
          value={counts.loading ? "…" : counts.data?.draft ?? 0}
          dot="draft"
        />
      </div>

      {/* ── Filter bar ── */}
      <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-slate-200/70 bg-white p-3 shadow-card animate-in stagger-3">
        <div className="relative min-w-[220px] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search campaigns by name…"
            className="h-10 w-full rounded-xl border border-slate-200 bg-white pl-10 pr-3 text-sm transition placeholder:text-slate-400 focus:border-primary focus:outline-none"
          />
        </div>

        <Select
          value={platformFilter}
          onChange={(v) => setPlatformFilter(v as "ALL" | Platform)}
          options={[
            { value: "ALL", label: "All Platforms" },
            { value: "META", label: "Meta" },
            { value: "GOOGLE", label: "Google" },
            { value: "TIKTOK", label: "TikTok" },
            { value: "LINKEDIN", label: "LinkedIn" },
          ]}
        />
        <Select
          value={statusFilter}
          onChange={(v) => setStatusFilter(v as "ALL" | CampaignStatus)}
          options={[
            { value: "ALL", label: "All Status" },
            { value: "ACTIVE", label: "Active" },
            { value: "PAUSED", label: "Paused" },
            { value: "DRAFT", label: "Draft" },
            { value: "ENDED", label: "Ended" },
          ]}
        />
        <Select
          value={range}
          onChange={(v) => setRange(v as DateRange)}
          options={[
            { value: "7", label: "Last 7 days" },
            { value: "30", label: "Last 30 days" },
            { value: "90", label: "Last 90 days" },
            { value: "CUSTOM", label: "Custom range" },
          ]}
          icon={Calendar}
        />

        {filtersActive && (
          <button
            type="button"
            onClick={resetFilters}
            className="inline-flex items-center gap-1 rounded-xl px-3 py-2 text-xs font-bold text-primary hover:bg-primary/5"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            Reset Filters
          </button>
        )}
      </div>

      {/* ── Section header w/ view toggle ── */}
      <div className="flex items-center justify-between animate-in stagger-4">
        <p className="text-sm font-medium text-slate-500">
          {loading
            ? "Loading…"
            : campaigns.length === 0
              ? "No matches"
              : `Showing ${(page - 1) * PAGE_SIZE + 1}–${
                  (page - 1) * PAGE_SIZE + campaigns.length
                } of ${data?.total ?? 0}`}
        </p>
        <div className="inline-flex rounded-xl border border-slate-200 bg-slate-50 p-0.5">
          <button
            type="button"
            onClick={() => setView("grid")}
            aria-label="Grid view"
            className={clsx(
              "flex h-8 w-8 items-center justify-center rounded-lg transition",
              view === "grid"
                ? "bg-white text-slate-900 shadow-sm"
                : "text-slate-500 hover:text-slate-700"
            )}
          >
            <LayoutGrid className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => setView("list")}
            aria-label="List view"
            className={clsx(
              "flex h-8 w-8 items-center justify-center rounded-lg transition",
              view === "list"
                ? "bg-white text-slate-900 shadow-sm"
                : "text-slate-500 hover:text-slate-700"
            )}
          >
            <List className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* ── Results ── */}
      {error ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm font-medium text-rose-700">
          Couldn&apos;t load campaigns — {error}.{" "}
          <button
            type="button"
            onClick={() => refetch()}
            className="underline"
          >
            Retry
          </button>
        </div>
      ) : loading ? (
        view === "grid" ? (
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: PAGE_SIZE }).map((_, i) => (
              <SkeletonCampaignCard key={i} />
            ))}
          </div>
        ) : (
          <div className="overflow-hidden rounded-2xl border border-slate-200/70 bg-white shadow-card">
            <table className="min-w-full text-sm">
              <tbody>
                {Array.from({ length: 8 }).map((_, i) => (
                  <SkeletonTableRow key={i} cols={11} />
                ))}
              </tbody>
            </table>
          </div>
        )
      ) : campaigns.length === 0 ? (
        <EmptyState
          icon={Megaphone}
          title={filtersActive ? "No campaigns found" : "No campaigns yet"}
          description={
            filtersActive
              ? "Try adjusting your filters or clearing them to see all campaigns."
              : "Connect an ad account in Settings, then click Sync to pull your existing campaigns into Advertix."
          }
          action={
            filtersActive
              ? { label: "Clear filters", onClick: resetFilters, icon: RotateCcw }
              : {
                  label: "Connect Ad Account",
                  onClick: () =>
                    (window.location.href = "/settings?tab=integrations"),
                  icon: Plus,
                }
          }
        />
      ) : view === "grid" ? (
        <div className="grid grid-cols-1 gap-5 animate-in stagger-5 md:grid-cols-2 xl:grid-cols-3">
          {campaigns.map((c) => (
            <CampaignCard key={c.id} c={c} onMutate={refetchAll} />
          ))}
        </div>
      ) : (
        <CampaignListTable rows={campaigns} onMutate={refetchAll} />
      )}

      {/* ── Pagination ── */}
      {!loading && campaigns.length > 0 && totalPages > 1 && (
        <div className="flex items-center justify-between animate-in stagger-6">
          <p className="text-xs text-slate-500">
            Page{" "}
            <span className="font-semibold text-slate-700">{page}</span> of{" "}
            <span className="font-semibold text-slate-700">{totalPages}</span>
          </p>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      <CreateCampaignModal
        open={modalOpen}
        onClose={() => {
          setModalOpen(false);
          setModalPrefill(null);
        }}
        onCreated={refetchAll}
        prefill={modalPrefill}
      />
    </div>
  );
}

/* ───────────────────────────────────────── */
function StatChip({
  label,
  value,
  dot,
}: {
  label: string;
  value: string | number;
  dot?: "active" | "paused" | "draft" | "ended";
}) {
  return (
    <div className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 shadow-card">
      {dot && <span className={clsx("status-dot", dot)} />}
      <span className="text-xs font-semibold text-slate-500">{label}</span>
      <span className="text-sm font-bold text-slate-900">{value}</span>
    </div>
  );
}

function Select({
  value,
  onChange,
  options,
  icon: Icon,
}: {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  icon?: typeof Calendar;
}) {
  return (
    <div className="relative">
      {Icon && (
        <Icon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
      )}
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={clsx(
          "h-10 cursor-pointer appearance-none rounded-xl border border-slate-200 bg-white pr-9 text-sm font-medium text-slate-700 transition focus:border-primary focus:outline-none",
          Icon ? "pl-9" : "pl-3"
        )}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
    </div>
  );
}

/* ───────────────────────────────────────── */
function useCampaignActions(c: Campaign, onMutate: () => void) {
  const client = useApiClient();
  const router = useRouter();
  const [busy, setBusy] = useState<null | "toggle" | "duplicate" | "delete">(null);

  const wrap = async (
    kind: "toggle" | "duplicate" | "delete",
    fn: () => Promise<unknown>
  ) => {
    setBusy(kind);
    try {
      await fn();
      onMutate();
    } catch (err) {
      // eslint-disable-next-line no-alert
      alert(err instanceof Error ? err.message : "Action failed");
    } finally {
      setBusy(null);
    }
  };

  const toggleStatus = () => {
    const next: CampaignStatus =
      c.status === "ACTIVE" ? "PAUSED" : "ACTIVE";
    return wrap("toggle", () =>
      client.updateCampaign(c.id, { status: next })
    );
  };

  const duplicate = () =>
    wrap("duplicate", () =>
      client.createCampaign({
        name: `${c.name} (copy)`,
        platform: c.platform,
        objective: c.objective,
        budget: Number(c.budget) || 0,
        budgetType: c.budgetType,
        startDate: c.startDate ?? null,
        endDate: c.endDate ?? null,
        adAccountId: c.adAccountId,
        targeting: c.targeting,
      })
    );

  const remove = () => {
    if (
      typeof window !== "undefined" &&
      !window.confirm(
        `Delete "${c.name}"? This also removes its metrics and creative links. This cannot be undone.`
      )
    ) {
      return;
    }
    return wrap("delete", () => client.deleteCampaign(c.id));
  };

  const edit = () => router.push(`/campaigns/${c.id}`);

  return { busy, toggleStatus, duplicate, remove, edit };
}

function CampaignCard({
  c,
  onMutate,
}: {
  c: Campaign;
  onMutate: () => void;
}) {
  const plat = PLATFORM_META[c.platform] ?? PLATFORM_META.META;
  const st = STATUS_META[c.status];
  const latest = c.metrics?.[0];
  const currency = c.adAccount?.currency ?? null;
  const budget = Number(c.budget) || 0;
  // Lifetime totals — cumulative across every metric row for this campaign.
  // Falls back to the latest daily row only when totals weren't returned
  // (older clients without the schema update).
  const totalSpend = c.totals?.spend ?? (latest ? Number(latest.spend) : 0);
  const impressions = c.totals?.impressions ?? 0;
  const clicks = c.totals?.clicks ?? 0;
  const ctr = impressions > 0 ? (clicks / impressions) * 100 : 0;
  const revenue = c.totals?.revenue ?? 0;
  const roas = totalSpend > 0 ? revenue / totalSpend : 0;
  // Budget tracking: daily budget = daily spend ratio; lifetime = total
  // spend ratio. The card shows the appropriate one.
  const dailySpend = latest ? Number(latest.spend) : 0;
  const referenceSpend = c.budgetType === "LIFETIME" ? totalSpend : dailySpend;
  const pct =
    budget > 0
      ? Math.min(100, Math.round((referenceSpend / budget) * 100))
      : 0;
  const actions = useCampaignActions(c, onMutate);

  return (
    <Link
      href={`/campaigns/${c.id}`}
      className="group relative block overflow-hidden rounded-2xl border border-slate-200/70 bg-white p-5 shadow-card transition-all duration-300 hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-card-hover"
    >
      <span
        className="absolute inset-y-0 left-0 w-1 rounded-l-2xl"
        style={{ backgroundColor: plat.color }}
      />

      <div className="flex items-center justify-between">
        <span className={clsx("pill", plat.bg, plat.text)}>{plat.label}</span>
        <span className="inline-flex items-center gap-1.5">
          <span className={clsx("status-dot", st.dot)} />
          <span className={clsx("text-[11px] font-bold uppercase", st.cls)}>
            {st.label}
          </span>
        </span>
      </div>

      <div className="mt-3">
        <h3 className="truncate text-base font-bold text-slate-900 transition group-hover:text-primary">
          {c.name}
        </h3>
        <p className="truncate text-xs text-slate-500">{c.objective}</p>
      </div>

      <div className="mt-4 grid grid-cols-3 gap-3">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
            Spend
          </p>
          <p className="mt-0.5 text-sm font-bold text-slate-900">
            {totalSpend === 0 ? "—" : fmtMoney(totalSpend, currency)}
          </p>
          <p className="text-[10px] text-slate-400">
            {c.budgetType === "DAILY"
              ? `${fmtMoney(budget, currency)}/day`
              : `of ${fmtMoney(budget, currency)}`}
          </p>
          <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-slate-100">
            <div
              className={clsx(
                "h-full rounded-full transition-all",
                pct >= 90
                  ? "bg-rose-500"
                  : pct >= 70
                    ? "bg-amber-500"
                    : "bg-primary"
              )}
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>
        <div>
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
            ROAS
          </p>
          <p
            className={clsx(
              "mt-0.5 text-sm font-bold",
              roas === 0
                ? "text-slate-400"
                : roas >= 2
                  ? "text-emerald-600"
                  : roas >= 1
                    ? "text-amber-600"
                    : "text-rose-600"
            )}
          >
            {roas === 0 ? "—" : `${roas.toFixed(2)}x`}
          </p>
        </div>
        <div>
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
            CTR
          </p>
          <p
            className={clsx(
              "mt-0.5 text-sm font-bold",
              ctr === 0
                ? "text-slate-400"
                : ctr > 2
                  ? "text-emerald-600"
                  : "text-amber-600"
            )}
          >
            {ctr === 0 ? "—" : `${ctr.toFixed(2)}%`}
          </p>
        </div>
      </div>

      <div className="mt-4 flex items-center justify-between gap-2 border-t border-slate-100 pt-3">
        <div className="flex flex-wrap items-center gap-1.5">
          {c.startDate && (
            <span className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-600">
              <Calendar className="h-2.5 w-2.5" />
              {c.startDate.slice(0, 10)}
            </span>
          )}
          {(c.reach ?? 0) > 0 && (
            <span className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-600">
              {(c.reach ?? 0).toLocaleString()} reached
            </span>
          )}
        </div>
        <div
          className={clsx(
            "flex items-center gap-1 transition",
            actions.busy ? "opacity-100" : "opacity-0 group-hover:opacity-100"
          )}
        >
          <CardIconBtn label="Edit" onClick={actions.edit}>
            <Pencil className="h-3.5 w-3.5" />
          </CardIconBtn>
          <CardIconBtn
            label={c.status === "ACTIVE" ? "Pause" : "Resume"}
            onClick={actions.toggleStatus}
            loading={actions.busy === "toggle"}
            disabled={!!actions.busy}
          >
            {c.status === "ACTIVE" ? (
              <PauseCircle className="h-3.5 w-3.5" />
            ) : (
              <PlayCircle className="h-3.5 w-3.5" />
            )}
          </CardIconBtn>
          <CardIconBtn
            label="Duplicate"
            onClick={actions.duplicate}
            loading={actions.busy === "duplicate"}
            disabled={!!actions.busy}
          >
            <Copy className="h-3.5 w-3.5" />
          </CardIconBtn>
          <CardIconBtn
            label="Delete"
            tone="danger"
            onClick={actions.remove}
            loading={actions.busy === "delete"}
            disabled={!!actions.busy}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </CardIconBtn>
        </div>
      </div>
    </Link>
  );
}

function CardIconBtn({
  children,
  label,
  tone = "default",
  onClick,
  loading,
  disabled,
}: {
  children: React.ReactNode;
  label: string;
  tone?: "default" | "danger";
  onClick?: () => void;
  loading?: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onClick?.();
      }}
      className={clsx(
        "flex h-7 w-7 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 transition disabled:cursor-not-allowed disabled:opacity-50",
        tone === "danger"
          ? "hover:border-rose-300 hover:bg-rose-50 hover:text-rose-600"
          : "hover:border-primary/40 hover:bg-primary/5 hover:text-primary"
      )}
    >
      {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : children}
    </button>
  );
}

/* ───────────────────────────────────────── */
function CampaignListTable({
  rows,
  onMutate,
}: {
  rows: Campaign[];
  onMutate: () => void;
}) {
  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200/70 bg-white shadow-card animate-in stagger-5">
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="text-left text-[11px] font-bold uppercase tracking-wider text-slate-500">
              <th className="px-5 py-3">Name</th>
              <th className="py-3">Platform</th>
              <th className="py-3">Status</th>
              <th className="py-3">Objective</th>
              <th className="py-3">Budget</th>
              <th className="py-3">Spend</th>
              <th className="py-3">ROAS</th>
              <th className="py-3">CTR</th>
              <th className="py-3">Impressions</th>
              <th className="py-3">Reach</th>
              <th className="py-3">Start</th>
              <th className="px-5 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((c) => (
              <CampaignListRow key={c.id} c={c} onMutate={onMutate} />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function CampaignListRow({
  c,
  onMutate,
}: {
  c: Campaign;
  onMutate: () => void;
}) {
  const actions = useCampaignActions(c, onMutate);
  const plat = PLATFORM_META[c.platform] ?? PLATFORM_META.META;
  const st = STATUS_META[c.status];
  const currency = c.adAccount?.currency ?? null;
  const latest = c.metrics?.[0];
  const totalSpend = c.totals?.spend ?? (latest ? Number(latest.spend) : 0);
  const impressions = c.totals?.impressions ?? (latest ? latest.impressions : 0);
  const clicks = c.totals?.clicks ?? (latest ? latest.clicks : 0);
  const ctr = impressions > 0 ? (clicks / impressions) * 100 : 0;
  const revenue = c.totals?.revenue ?? 0;
  const roas = totalSpend > 0 ? revenue / totalSpend : 0;

  return (
    <tr className="group border-t border-slate-50 transition hover:bg-slate-50/70">
      <td className="max-w-[200px] px-5 py-3.5">
        <Link
          href={`/campaigns/${c.id}`}
          className="block truncate text-sm font-semibold text-slate-900 hover:text-primary"
        >
          {c.name}
        </Link>
      </td>
      <td className="py-3.5">
        <span className={clsx("pill", plat.bg, plat.text)}>{plat.label}</span>
      </td>
      <td className="py-3.5">
        <span className="inline-flex items-center gap-1.5">
          <span className={clsx("status-dot", st.dot)} />
          <span className={clsx("text-xs font-semibold", st.cls)}>{st.label}</span>
        </span>
      </td>
      <td className="max-w-[160px] py-3.5">
        <span className="block truncate text-xs text-slate-600">{c.objective}</span>
      </td>
      <td className="py-3.5 text-xs font-semibold text-slate-700">
        {fmtMoney(Number(c.budget) || 0, currency)}
      </td>
      <td className="py-3.5 text-xs font-semibold text-slate-700">
        {totalSpend === 0 ? "—" : fmtMoney(totalSpend, currency)}
      </td>
      <td className="py-3.5">
        <span
          className={clsx(
            "text-sm font-bold",
            roas === 0
              ? "text-slate-400"
              : roas >= 2
                ? "text-emerald-600"
                : "text-rose-600"
          )}
        >
          {roas === 0 ? "—" : `${roas.toFixed(2)}x`}
        </span>
      </td>
      <td className="py-3.5">
        <span
          className={clsx(
            "text-sm font-semibold",
            ctr === 0
              ? "text-slate-400"
              : ctr > 2
                ? "text-emerald-600"
                : "text-amber-600"
          )}
        >
          {ctr === 0 ? "—" : `${ctr.toFixed(2)}%`}
        </span>
      </td>
      <td className="py-3.5 text-xs font-medium text-slate-700">
        {impressions > 0 ? fmtCompact(impressions) : "—"}
      </td>
      <td className="py-3.5 text-xs font-medium text-slate-700">
        {(c.reach ?? 0) > 0 ? fmtCompact(c.reach ?? 0) : "—"}
      </td>
      <td className="py-3.5 text-xs text-slate-500">
        {c.startDate ? c.startDate.slice(0, 10) : "—"}
      </td>
      <td className="px-5 py-3.5 text-right">
        <div className="inline-flex items-center justify-end gap-1">
          <CardIconBtn
            label={c.status === "ACTIVE" ? "Pause" : "Resume"}
            onClick={actions.toggleStatus}
            loading={actions.busy === "toggle"}
            disabled={!!actions.busy}
          >
            {c.status === "ACTIVE" ? (
              <PauseCircle className="h-3.5 w-3.5" />
            ) : (
              <PlayCircle className="h-3.5 w-3.5" />
            )}
          </CardIconBtn>
          <CardIconBtn
            label="Duplicate"
            onClick={actions.duplicate}
            loading={actions.busy === "duplicate"}
            disabled={!!actions.busy}
          >
            <Copy className="h-3.5 w-3.5" />
          </CardIconBtn>
          <CardIconBtn
            label="Delete"
            tone="danger"
            onClick={actions.remove}
            loading={actions.busy === "delete"}
            disabled={!!actions.busy}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </CardIconBtn>
          <Link
            href={`/campaigns/${c.id}`}
            className="ml-2 text-xs font-semibold text-primary hover:underline"
          >
            Open →
          </Link>
        </div>
      </td>
    </tr>
  );
}
