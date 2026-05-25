"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import clsx from "clsx";
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
  Inbox,
  Sparkles,
} from "lucide-react";
import CreateCampaignModal from "@/components/campaigns/CreateCampaignModal";

type Platform = "META" | "GOOGLE" | "TIKTOK" | "LINKEDIN";
type Status = "ACTIVE" | "PAUSED" | "DRAFT" | "ENDED";
type DateRange = "7" | "30" | "90" | "CUSTOM";

type Campaign = {
  id: string;
  name: string;
  objective: string;
  platform: Platform;
  status: Status;
  budget: number;
  spend: number;
  impressions: number;
  clicks: number;
  ctr: number;
  roas: number;
  startDate: string;
  endDate: string;
};

const CAMPAIGNS: Campaign[] = [
  {
    id: "summer-sale-2026",
    name: "Summer Sale 2026",
    objective: "Conversions · Retargeting",
    platform: "META",
    status: "ACTIVE",
    budget: 5000,
    spend: 3240,
    impressions: 412000,
    clicks: 8240,
    ctr: 2.0,
    roas: 4.2,
    startDate: "2026-04-28",
    endDate: "2026-06-30",
  },
  {
    id: "brand-q2",
    name: "Brand Awareness Q2",
    objective: "Reach · Top of funnel",
    platform: "GOOGLE",
    status: "ACTIVE",
    budget: 3500,
    spend: 2890,
    impressions: 287000,
    clicks: 4310,
    ctr: 1.5,
    roas: 2.8,
    startDate: "2026-05-01",
    endDate: "2026-06-15",
  },
  {
    id: "tide-launch",
    name: "Product Launch — Tide+",
    objective: "Conversions · New SKU",
    platform: "TIKTOK",
    status: "ACTIVE",
    budget: 4200,
    spend: 1820,
    impressions: 198400,
    clicks: 6190,
    ctr: 3.1,
    roas: 3.7,
    startDate: "2026-05-12",
    endDate: "2026-07-01",
  },
  {
    id: "enterprise-leadgen",
    name: "Enterprise Lead Gen",
    objective: "Lead form · B2B",
    platform: "LINKEDIN",
    status: "PAUSED",
    budget: 6000,
    spend: 4100,
    impressions: 84200,
    clicks: 980,
    ctr: 1.2,
    roas: 1.6,
    startDate: "2026-03-18",
    endDate: "2026-06-30",
  },
  {
    id: "cart-abandon",
    name: "Retargeting · Cart Abandon",
    objective: "Conversions · Warm",
    platform: "META",
    status: "ACTIVE",
    budget: 2200,
    spend: 1670,
    impressions: 142800,
    clicks: 4280,
    ctr: 3.0,
    roas: 5.1,
    startDate: "2026-04-02",
    endDate: "2026-06-30",
  },
  {
    id: "bf-teaser",
    name: "Black Friday Teaser",
    objective: "Awareness · Wait-list",
    platform: "META",
    status: "DRAFT",
    budget: 8000,
    spend: 0,
    impressions: 0,
    clicks: 0,
    ctr: 0,
    roas: 0,
    startDate: "2026-11-15",
    endDate: "2026-11-29",
  },
  {
    id: "brand-search",
    name: "Search · Branded Terms",
    objective: "Search · Brand defense",
    platform: "GOOGLE",
    status: "ACTIVE",
    budget: 1800,
    spend: 1240,
    impressions: 96400,
    clicks: 3850,
    ctr: 4.0,
    roas: 6.2,
    startDate: "2026-02-08",
    endDate: "2026-12-31",
  },
  {
    id: "winter-2025",
    name: "Winter Collection 2025",
    objective: "Conversions · Apparel",
    platform: "TIKTOK",
    status: "ENDED",
    budget: 3000,
    spend: 2980,
    impressions: 218000,
    clicks: 5240,
    ctr: 2.4,
    roas: 2.1,
    startDate: "2025-12-01",
    endDate: "2026-02-15",
  },
  {
    id: "creator-collab",
    name: "Creator Collab — Spring Drop",
    objective: "Spark Ads · Influencer",
    platform: "TIKTOK",
    status: "ACTIVE",
    budget: 2500,
    spend: 980,
    impressions: 124000,
    clicks: 3720,
    ctr: 3.0,
    roas: 4.6,
    startDate: "2026-05-04",
    endDate: "2026-06-04",
  },
  {
    id: "youtube-shorts",
    name: "YouTube Shorts Push",
    objective: "Video Views · Awareness",
    platform: "GOOGLE",
    status: "PAUSED",
    budget: 2800,
    spend: 1150,
    impressions: 412000,
    clicks: 1840,
    ctr: 0.4,
    roas: 0.9,
    startDate: "2026-04-10",
    endDate: "2026-06-10",
  },
  {
    id: "abm-tier1",
    name: "ABM · Tier 1 Accounts",
    objective: "Lead form · Enterprise",
    platform: "LINKEDIN",
    status: "ACTIVE",
    budget: 4500,
    spend: 2310,
    impressions: 41200,
    clicks: 620,
    ctr: 1.5,
    roas: 2.4,
    startDate: "2026-04-21",
    endDate: "2026-07-21",
  },
  {
    id: "back-to-school",
    name: "Back to School Prep",
    objective: "Catalog Sales",
    platform: "META",
    status: "DRAFT",
    budget: 5500,
    spend: 0,
    impressions: 0,
    clicks: 0,
    ctr: 0,
    roas: 0,
    startDate: "2026-07-15",
    endDate: "2026-09-15",
  },
];

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

function fmtMoney(n: number, full = false): string {
  return n.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: full ? 0 : 0,
  });
}

function fmtCompact(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1).replace(/\.0$/, "") + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(1).replace(/\.0$/, "") + "K";
  return n.toString();
}

function daysRemaining(end: string): number {
  const e = new Date(end + "T00:00:00Z").getTime();
  const now = new Date("2026-05-25T00:00:00Z").getTime();
  return Math.round((e - now) / (1000 * 60 * 60 * 24));
}

const VIEW_STORAGE_KEY = "campaigns-view";
const PAGE_SIZE = 9;

export default function CampaignsPage() {
  const [view, setView] = useState<"grid" | "list">("grid");
  const [search, setSearch] = useState("");
  const [platformFilter, setPlatformFilter] = useState<"ALL" | Platform>("ALL");
  const [statusFilter, setStatusFilter] = useState<"ALL" | Status>("ALL");
  const [range, setRange] = useState<DateRange>("30");
  const [page, setPage] = useState(1);
  const [modalOpen, setModalOpen] = useState(false);

  // Restore view from localStorage
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

  const filtersActive =
    search.trim() !== "" ||
    platformFilter !== "ALL" ||
    statusFilter !== "ALL" ||
    range !== "30";

  const filtered = useMemo(() => {
    return CAMPAIGNS.filter((c) => {
      if (
        search.trim() &&
        !c.name.toLowerCase().includes(search.trim().toLowerCase()) &&
        !c.objective.toLowerCase().includes(search.trim().toLowerCase())
      ) {
        return false;
      }
      if (platformFilter !== "ALL" && c.platform !== platformFilter) return false;
      if (statusFilter !== "ALL" && c.status !== statusFilter) return false;
      return true;
    });
  }, [search, platformFilter, statusFilter]);

  useEffect(() => {
    setPage(1);
  }, [search, platformFilter, statusFilter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageStart = (page - 1) * PAGE_SIZE;
  const pageEnd = Math.min(pageStart + PAGE_SIZE, filtered.length);
  const pageRows = filtered.slice(pageStart, pageEnd);

  const counts = useMemo(
    () => ({
      total: CAMPAIGNS.length,
      active: CAMPAIGNS.filter((c) => c.status === "ACTIVE").length,
      paused: CAMPAIGNS.filter((c) => c.status === "PAUSED").length,
      draft: CAMPAIGNS.filter((c) => c.status === "DRAFT").length,
    }),
    []
  );

  const resetFilters = () => {
    setSearch("");
    setPlatformFilter("ALL");
    setStatusFilter("ALL");
    setRange("30");
  };

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
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
          >
            <RefreshCw className="h-4 w-4" />
            Sync All
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
        <StatChip label="Total" value={counts.total} />
        <StatChip label="Active" value={counts.active} dot="active" />
        <StatChip label="Paused" value={counts.paused} dot="paused" />
        <StatChip label="Draft" value={counts.draft} dot="draft" />
      </div>

      {/* ── Filter + search bar ── */}
      <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-slate-200/70 bg-white p-3 shadow-card animate-in stagger-3">
        <div className="relative min-w-[220px] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search campaigns by name or objective…"
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
          onChange={(v) => setStatusFilter(v as "ALL" | Status)}
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
          {filtered.length === 0
            ? "No matches"
            : `Showing ${pageStart + 1}–${pageEnd} of ${filtered.length}`}
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
      {filtered.length === 0 ? (
        <EmptyState onReset={resetFilters} />
      ) : view === "grid" ? (
        <div className="grid grid-cols-1 gap-5 animate-in stagger-5 md:grid-cols-2 xl:grid-cols-3">
          {pageRows.map((c) => (
            <CampaignCard key={c.id} c={c} />
          ))}
        </div>
      ) : (
        <CampaignListTable rows={pageRows} />
      )}

      {/* ── Pagination ── */}
      {filtered.length > 0 && (
        <div className="flex items-center justify-between animate-in stagger-6">
          <p className="text-xs text-slate-500">
            Showing{" "}
            <span className="font-semibold text-slate-700">
              {pageStart + 1}–{pageEnd}
            </span>{" "}
            of{" "}
            <span className="font-semibold text-slate-700">
              {filtered.length}
            </span>{" "}
            campaigns
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
            <span className="px-2 text-xs font-semibold text-slate-600">
              Page {page} of {totalPages}
            </span>
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
        onClose={() => setModalOpen(false)}
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
  value: number;
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
function CampaignCard({ c }: { c: Campaign }) {
  const plat = PLATFORM_META[c.platform];
  const st = STATUS_META[c.status];
  const pct = c.budget ? Math.min(100, Math.round((c.spend / c.budget) * 100)) : 0;
  const remaining = daysRemaining(c.endDate);

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
            {fmtMoney(c.spend)}
          </p>
          <p className="text-[10px] text-slate-400">
            of {fmtMoney(c.budget)} budget
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
              c.roas === 0
                ? "text-slate-400"
                : c.roas >= 2
                  ? "text-emerald-600"
                  : c.roas >= 1
                    ? "text-amber-600"
                    : "text-rose-600"
            )}
          >
            {c.roas.toFixed(2)}x
          </p>
        </div>
        <div>
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
            CTR
          </p>
          <p
            className={clsx(
              "mt-0.5 text-sm font-bold",
              c.ctr === 0
                ? "text-slate-400"
                : c.ctr > 2
                  ? "text-emerald-600"
                  : "text-amber-600"
            )}
          >
            {c.ctr.toFixed(2)}%
          </p>
        </div>
      </div>

      <div className="mt-4 flex items-center justify-between gap-2 border-t border-slate-100 pt-3">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-600">
            <Calendar className="h-2.5 w-2.5" />
            {c.startDate}
          </span>
          {remaining > 0 && c.status !== "ENDED" && (
            <span
              className={clsx(
                "rounded-md px-2 py-0.5 text-[10px] font-semibold",
                remaining < 7
                  ? "bg-rose-50 text-rose-700"
                  : "bg-emerald-50 text-emerald-700"
              )}
            >
              {remaining}d remaining
            </span>
          )}
        </div>
        <div className="flex items-center gap-1 opacity-0 transition group-hover:opacity-100">
          <CardIconBtn label="Edit">
            <Pencil className="h-3.5 w-3.5" />
          </CardIconBtn>
          <CardIconBtn label={c.status === "ACTIVE" ? "Pause" : "Resume"}>
            {c.status === "ACTIVE" ? (
              <PauseCircle className="h-3.5 w-3.5" />
            ) : (
              <PlayCircle className="h-3.5 w-3.5" />
            )}
          </CardIconBtn>
          <CardIconBtn label="Duplicate">
            <Copy className="h-3.5 w-3.5" />
          </CardIconBtn>
          <CardIconBtn label="Delete" tone="danger">
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
}: {
  children: React.ReactNode;
  label: string;
  tone?: "default" | "danger";
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
      }}
      className={clsx(
        "flex h-7 w-7 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 transition",
        tone === "danger"
          ? "hover:border-rose-300 hover:bg-rose-50 hover:text-rose-600"
          : "hover:border-primary/40 hover:bg-primary/5 hover:text-primary"
      )}
    >
      {children}
    </button>
  );
}

/* ───────────────────────────────────────── */
function CampaignListTable({ rows }: { rows: Campaign[] }) {
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
              <th className="py-3">Start</th>
              <th className="px-5 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((c) => {
              const plat = PLATFORM_META[c.platform];
              const st = STATUS_META[c.status];
              return (
                <tr
                  key={c.id}
                  className="group border-t border-slate-50 transition hover:bg-slate-50/70"
                >
                  <td className="max-w-[200px] px-5 py-3.5">
                    <Link
                      href={`/campaigns/${c.id}`}
                      className="block truncate text-sm font-semibold text-slate-900 hover:text-primary"
                    >
                      {c.name}
                    </Link>
                  </td>
                  <td className="py-3.5">
                    <span className={clsx("pill", plat.bg, plat.text)}>
                      {plat.label}
                    </span>
                  </td>
                  <td className="py-3.5">
                    <span className="inline-flex items-center gap-1.5">
                      <span className={clsx("status-dot", st.dot)} />
                      <span className={clsx("text-xs font-semibold", st.cls)}>
                        {st.label}
                      </span>
                    </span>
                  </td>
                  <td className="max-w-[160px] py-3.5">
                    <span className="block truncate text-xs text-slate-600">
                      {c.objective}
                    </span>
                  </td>
                  <td className="py-3.5 text-xs font-semibold text-slate-700">
                    {fmtMoney(c.budget)}
                  </td>
                  <td className="py-3.5 text-xs font-semibold text-slate-700">
                    {fmtMoney(c.spend)}
                  </td>
                  <td className="py-3.5">
                    <span
                      className={clsx(
                        "text-sm font-bold",
                        c.roas === 0
                          ? "text-slate-400"
                          : c.roas >= 2
                            ? "text-emerald-600"
                            : "text-rose-600"
                      )}
                    >
                      {c.roas.toFixed(2)}x
                    </span>
                  </td>
                  <td className="py-3.5">
                    <span
                      className={clsx(
                        "text-sm font-semibold",
                        c.ctr === 0
                          ? "text-slate-400"
                          : c.ctr > 2
                            ? "text-emerald-600"
                            : "text-amber-600"
                      )}
                    >
                      {c.ctr.toFixed(2)}%
                    </span>
                  </td>
                  <td className="py-3.5 text-xs font-medium text-slate-700">
                    {fmtCompact(c.impressions)}
                  </td>
                  <td className="py-3.5 text-xs text-slate-500">
                    {c.startDate}
                  </td>
                  <td className="px-5 py-3.5 text-right">
                    <div className="inline-flex items-center gap-1 opacity-0 transition group-hover:opacity-100">
                      <CardIconBtn label="Edit">
                        <Pencil className="h-3.5 w-3.5" />
                      </CardIconBtn>
                      <CardIconBtn
                        label={c.status === "ACTIVE" ? "Pause" : "Resume"}
                      >
                        {c.status === "ACTIVE" ? (
                          <PauseCircle className="h-3.5 w-3.5" />
                        ) : (
                          <PlayCircle className="h-3.5 w-3.5" />
                        )}
                      </CardIconBtn>
                      <CardIconBtn label="Duplicate">
                        <Copy className="h-3.5 w-3.5" />
                      </CardIconBtn>
                      <CardIconBtn label="Delete" tone="danger">
                        <Trash2 className="h-3.5 w-3.5" />
                      </CardIconBtn>
                    </div>
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
function EmptyState({ onReset }: { onReset: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-20 text-center animate-in">
      <div className="relative mb-5">
        <div className="absolute inset-0 rounded-3xl bg-primary/10 blur-2xl" />
        <div className="relative flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 text-white shadow-glow">
          <Inbox className="h-7 w-7" />
        </div>
        <div className="absolute -right-1 -top-1 flex h-6 w-6 items-center justify-center rounded-full bg-white shadow-md">
          <Sparkles className="h-3 w-3 text-primary" />
        </div>
      </div>
      <h4 className="text-base font-bold text-slate-900">No campaigns found</h4>
      <p className="mt-1 max-w-xs text-sm text-slate-500">
        Try adjusting your filters or search query.
      </p>
      <button type="button" onClick={onReset} className="btn-brand mt-5">
        <RotateCcw className="h-4 w-4" />
        Clear Filters
      </button>
    </div>
  );
}
