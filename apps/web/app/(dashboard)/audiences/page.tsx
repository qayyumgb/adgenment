"use client";

import { useEffect, useMemo, useState } from "react";
import clsx from "clsx";
import {
  Sparkles,
  Plus,
  Search,
  ChevronDown,
  Users,
  TrendingUp,
  Pencil,
  Copy,
  Rocket,
  Trash2,
  X,
  Bot,
  Check,
  Loader2,
  RefreshCw,
} from "lucide-react";

type AudienceType =
  | "LOOKALIKE"
  | "INTEREST"
  | "RETARGETING"
  | "CUSTOM"
  | "BEHAVIORAL";
type Platform = "META" | "GOOGLE" | "TIKTOK" | "LINKEDIN";

type Audience = {
  id: string;
  name: string;
  description: string;
  type: AudienceType;
  platforms: Platform[];
  size: number;
  matchRate: number;
  avgCpm: number;
  reachLow: number;
  reachHigh: number;
  aiBuilt: boolean;
  daysSinceUpdate: number;
};

const AUDIENCES: Audience[] = [
  {
    id: "a1",
    name: "Lookalike 1–3% · Purchasers",
    description:
      "Seeded from top 5% LTV customers from Shopify, expanded across US and Canada.",
    type: "LOOKALIKE",
    platforms: ["META", "TIKTOK"],
    size: 3_200_000,
    matchRate: 84,
    avgCpm: 7.4,
    reachLow: 120000,
    reachHigh: 280000,
    aiBuilt: true,
    daysSinceUpdate: 2,
  },
  {
    id: "a2",
    name: "SaaS Decision Makers · Tier 1",
    description:
      "Founders, CMOs, and Head of Growth at companies with 20–500 employees.",
    type: "INTEREST",
    platforms: ["LINKEDIN"],
    size: 420_000,
    matchRate: 76,
    avgCpm: 22.1,
    reachLow: 14000,
    reachHigh: 38000,
    aiBuilt: true,
    daysSinceUpdate: 5,
  },
  {
    id: "a3",
    name: "Cart Abandoners · 30 Days",
    description: "Visited checkout but did not purchase in last 30 days.",
    type: "RETARGETING",
    platforms: ["META", "GOOGLE"],
    size: 92_400,
    matchRate: 91,
    avgCpm: 9.8,
    reachLow: 6000,
    reachHigh: 18000,
    aiBuilt: false,
    daysSinceUpdate: 1,
  },
  {
    id: "a4",
    name: "Gen-Z Apparel Enthusiasts",
    description:
      "18–28 year-olds engaging with streetwear and casual fashion on TikTok.",
    type: "INTEREST",
    platforms: ["TIKTOK"],
    size: 5_800_000,
    matchRate: 68,
    avgCpm: 6.2,
    reachLow: 180000,
    reachHigh: 420000,
    aiBuilt: true,
    daysSinceUpdate: 4,
  },
  {
    id: "a5",
    name: "Customer List · Enterprise",
    description: "CRM upload of 12,400 enterprise accounts targeted for ABM.",
    type: "CUSTOM",
    platforms: ["LINKEDIN", "META"],
    size: 45_000,
    matchRate: 89,
    avgCpm: 28.5,
    reachLow: 2000,
    reachHigh: 5500,
    aiBuilt: false,
    daysSinceUpdate: 8,
  },
  {
    id: "a6",
    name: "Active Online Shoppers",
    description: "Frequent buyers across multiple retailer categories.",
    type: "BEHAVIORAL",
    platforms: ["META", "GOOGLE"],
    size: 8_200_000,
    matchRate: 72,
    avgCpm: 5.9,
    reachLow: 280000,
    reachHigh: 640000,
    aiBuilt: true,
    daysSinceUpdate: 3,
  },
  {
    id: "a7",
    name: "Video Engagers · 75% Watch",
    description: "Watched 75% or more of any video ad in the last 60 days.",
    type: "RETARGETING",
    platforms: ["META", "TIKTOK"],
    size: 184_000,
    matchRate: 87,
    avgCpm: 8.4,
    reachLow: 8000,
    reachHigh: 22000,
    aiBuilt: false,
    daysSinceUpdate: 1,
  },
  {
    id: "a8",
    name: "Lookalike 4–6% · Lead Submitters",
    description:
      "Expanded lookalike from top lead-form submitters, broader reach.",
    type: "LOOKALIKE",
    platforms: ["META"],
    size: 6_400_000,
    matchRate: 64,
    avgCpm: 6.8,
    reachLow: 220000,
    reachHigh: 480000,
    aiBuilt: true,
    daysSinceUpdate: 6,
  },
  {
    id: "a9",
    name: "Tech Early Adopters",
    description: "Users who frequently try new SaaS and consumer-tech products.",
    type: "BEHAVIORAL",
    platforms: ["LINKEDIN", "META"],
    size: 1_400_000,
    matchRate: 71,
    avgCpm: 11.2,
    reachLow: 48000,
    reachHigh: 110000,
    aiBuilt: true,
    daysSinceUpdate: 9,
  },
  {
    id: "a10",
    name: "Newsletter Subscribers",
    description: "CRM upload of 38k newsletter subscribers from Mailchimp.",
    type: "CUSTOM",
    platforms: ["META", "GOOGLE"],
    size: 38_000,
    matchRate: 92,
    avgCpm: 4.6,
    reachLow: 1800,
    reachHigh: 4400,
    aiBuilt: false,
    daysSinceUpdate: 12,
  },
  {
    id: "a11",
    name: "B2B Software Buyers",
    description: "Decision makers actively researching SaaS in last 90 days.",
    type: "INTEREST",
    platforms: ["LINKEDIN", "GOOGLE"],
    size: 720_000,
    matchRate: 78,
    avgCpm: 18.4,
    reachLow: 24000,
    reachHigh: 62000,
    aiBuilt: true,
    daysSinceUpdate: 4,
  },
  {
    id: "a12",
    name: "Site Visitors · Last 7 Days",
    description: "Anyone who visited the site in the last week (warm).",
    type: "RETARGETING",
    platforms: ["META", "GOOGLE", "TIKTOK"],
    size: 124_000,
    matchRate: 95,
    avgCpm: 7.1,
    reachLow: 8000,
    reachHigh: 24000,
    aiBuilt: false,
    daysSinceUpdate: 1,
  },
];

const TYPE_META: Record<
  AudienceType,
  { label: string; color: string; bg: string; text: string }
> = {
  LOOKALIKE: {
    label: "Lookalike",
    color: "#6366f1",
    bg: "bg-primary/10",
    text: "text-primary",
  },
  INTEREST: {
    label: "Interest",
    color: "#06B6D4",
    bg: "bg-cyan-50",
    text: "text-cyan-700",
  },
  RETARGETING: {
    label: "Retargeting",
    color: "#F59E0B",
    bg: "bg-amber-50",
    text: "text-amber-700",
  },
  CUSTOM: {
    label: "Custom",
    color: "#8B5CF6",
    bg: "bg-purple-50",
    text: "text-purple-700",
  },
  BEHAVIORAL: {
    label: "Behavioral",
    color: "#10B981",
    bg: "bg-emerald-50",
    text: "text-emerald-700",
  },
};

const PLATFORM_META: Record<
  Platform,
  { label: string; color: string; initial: string }
> = {
  META: { label: "Meta", color: "#1877F2", initial: "M" },
  GOOGLE: { label: "Google", color: "#EA4335", initial: "G" },
  TIKTOK: { label: "TikTok", color: "#010101", initial: "T" },
  LINKEDIN: { label: "LinkedIn", color: "#0A66C2", initial: "in" },
};

function formatSize(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1).replace(/\.0$/, "") + "M";
  if (n >= 1_000) return Math.round(n / 1000) + "K";
  return n.toString();
}

const MAX_SIZE = Math.max(...AUDIENCES.map((a) => a.size));

export default function AudiencesPage() {
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<"ALL" | AudienceType>("ALL");
  const [platformFilter, setPlatformFilter] = useState<"ALL" | Platform>("ALL");
  const [sort, setSort] = useState<
    "LARGEST" | "SMALLEST" | "NEWEST" | "BEST"
  >("LARGEST");
  const [modalOpen, setModalOpen] = useState(false);

  const filtered = useMemo(() => {
    let rows = AUDIENCES.filter((a) => {
      if (
        search.trim() &&
        !a.name.toLowerCase().includes(search.trim().toLowerCase()) &&
        !a.description.toLowerCase().includes(search.trim().toLowerCase())
      )
        return false;
      if (typeFilter !== "ALL" && a.type !== typeFilter) return false;
      if (platformFilter !== "ALL" && !a.platforms.includes(platformFilter))
        return false;
      return true;
    });
    if (sort === "LARGEST") rows.sort((a, b) => b.size - a.size);
    else if (sort === "SMALLEST") rows.sort((a, b) => a.size - b.size);
    else if (sort === "NEWEST")
      rows.sort((a, b) => a.daysSinceUpdate - b.daysSinceUpdate);
    else rows.sort((a, b) => b.matchRate - a.matchRate);
    return rows;
  }, [search, typeFilter, platformFilter, sort]);

  const counts = useMemo(() => {
    const total = AUDIENCES.length;
    const ai = AUDIENCES.filter((a) => a.aiBuilt).length;
    const avg =
      AUDIENCES.reduce((s, a) => s + a.size, 0) / Math.max(1, AUDIENCES.length);
    return { total, ai, avg };
  }, []);

  return (
    <div className="space-y-6">
      {/* ── Top bar ── */}
      <header className="flex flex-wrap items-end justify-between gap-3 animate-in stagger-1">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 lg:text-3xl">
            Audiences
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Build and manage your ad audiences
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setModalOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 px-4 py-2.5 text-sm font-bold text-white shadow-glow transition hover:-translate-y-0.5 hover:shadow-xl"
          >
            <Sparkles className="h-4 w-4" strokeWidth={2.5} />
            Build with AI
          </button>
          <button
            type="button"
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
          >
            <Plus className="h-4 w-4" strokeWidth={2.5} />
            Create Audience
          </button>
        </div>
      </header>

      {/* ── Stats chips ── */}
      <div className="flex flex-wrap items-center gap-2 animate-in stagger-2">
        <StatChip icon={Users} label="Total Audiences" value={counts.total} />
        <StatChip
          icon={Sparkles}
          label="AI Built"
          value={counts.ai}
          tone="brand"
        />
        <StatChip
          icon={TrendingUp}
          label="Avg Size"
          value={formatSize(counts.avg)}
          tone="emerald"
        />
      </div>

      {/* ── Filter bar ── */}
      <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-slate-200/70 bg-white p-3 shadow-card animate-in stagger-3">
        <div className="relative min-w-[200px] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search audiences…"
            className="h-10 w-full rounded-xl border border-slate-200 bg-white pl-10 pr-3 text-sm placeholder:text-slate-400 focus:border-primary focus:outline-none"
          />
        </div>
        <Select
          value={typeFilter}
          onChange={(v) => setTypeFilter(v as "ALL" | AudienceType)}
          options={[
            { value: "ALL", label: "All Types" },
            { value: "LOOKALIKE", label: "Lookalike" },
            { value: "INTEREST", label: "Interest" },
            { value: "RETARGETING", label: "Retargeting" },
            { value: "CUSTOM", label: "Custom" },
            { value: "BEHAVIORAL", label: "Behavioral" },
          ]}
        />
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
          value={sort}
          onChange={(v) =>
            setSort(v as "LARGEST" | "SMALLEST" | "NEWEST" | "BEST")
          }
          options={[
            { value: "LARGEST", label: "Largest" },
            { value: "SMALLEST", label: "Smallest" },
            { value: "NEWEST", label: "Newest" },
            { value: "BEST", label: "Best Performing" },
          ]}
        />
      </div>

      {/* ── Grid ── */}
      {filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-12 text-center animate-in">
          <p className="text-sm font-semibold text-slate-700">
            No audiences match your filters.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-5 animate-in stagger-4 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map((a) => (
            <AudienceCard key={a.id} a={a} />
          ))}
        </div>
      )}

      <BuildAudienceModal open={modalOpen} onClose={() => setModalOpen(false)} />
    </div>
  );
}

/* ───────────────────────────────────────── */
function StatChip({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: typeof Users;
  label: string;
  value: string | number;
  tone?: "brand" | "emerald";
}) {
  return (
    <div
      className={clsx(
        "inline-flex items-center gap-2 rounded-xl border bg-white px-4 py-2 shadow-card",
        tone === "brand"
          ? "border-primary/20 bg-primary/[0.06]"
          : tone === "emerald"
            ? "border-emerald-200 bg-emerald-50"
            : "border-slate-200"
      )}
    >
      <Icon
        className={clsx(
          "h-3.5 w-3.5",
          tone === "brand"
            ? "text-primary"
            : tone === "emerald"
              ? "text-emerald-600"
              : "text-slate-500"
        )}
      />
      <span
        className={clsx(
          "text-xs font-semibold",
          tone === "brand"
            ? "text-primary"
            : tone === "emerald"
              ? "text-emerald-700"
              : "text-slate-500"
        )}
      >
        {label}
      </span>
      <span
        className={clsx(
          "text-sm font-bold",
          tone === "brand"
            ? "text-primary"
            : tone === "emerald"
              ? "text-emerald-700"
              : "text-slate-900"
        )}
      >
        {value}
      </span>
    </div>
  );
}

function Select({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <div className="relative">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-10 cursor-pointer appearance-none rounded-xl border border-slate-200 bg-white pl-3 pr-9 text-sm font-medium text-slate-700 transition focus:border-primary focus:outline-none"
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
function AudienceCard({ a }: { a: Audience }) {
  const tm = TYPE_META[a.type];
  const sizePct = (a.size / MAX_SIZE) * 100;
  return (
    <div
      className="group relative overflow-hidden rounded-2xl border border-slate-200/70 bg-white p-5 shadow-card transition hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-card-hover"
    >
      <span
        className="absolute inset-y-0 left-0 w-1 rounded-l-2xl"
        style={{ backgroundColor: tm.color }}
      />

      {/* Top row */}
      <div className="flex items-center justify-between gap-2">
        <span className={clsx("pill", tm.bg, tm.text)}>{tm.label}</span>
        {a.aiBuilt && (
          <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-primary">
            <Sparkles className="h-2.5 w-2.5" />
            AI Built
          </span>
        )}
      </div>

      <div className="mt-3">
        <h3 className="truncate text-base font-bold text-slate-900">{a.name}</h3>
        <p className="mt-0.5 line-clamp-2 text-xs text-slate-500">
          {a.description}
        </p>
      </div>

      <div className="mt-4">
        <div className="flex items-baseline gap-1.5">
          <span className="text-3xl font-bold tracking-tight text-slate-900">
            {formatSize(a.size)}
          </span>
          <span className="text-xs font-semibold text-slate-500">people</span>
        </div>
        <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-slate-100">
          <div
            className="h-full rounded-full transition-all"
            style={{
              width: `${sizePct}%`,
              backgroundColor: tm.color,
            }}
          />
        </div>
      </div>

      <div className="mt-4 grid grid-cols-3 gap-3 border-t border-slate-100 pt-3">
        <Metric
          label="Match Rate"
          value={`${a.matchRate}%`}
          tone={a.matchRate > 70 ? "emerald" : "amber"}
        />
        <Metric label="Avg CPM" value={`$${a.avgCpm.toFixed(2)}`} />
        <Metric
          label="Est. Reach"
          value={`${formatSize(a.reachLow)}–${formatSize(a.reachHigh)}/d`}
          small
        />
      </div>

      <div className="mt-3 flex items-center justify-between gap-2">
        <div className="flex items-center gap-1">
          {a.platforms.map((p) => {
            const pm = PLATFORM_META[p];
            return (
              <span
                key={p}
                title={pm.label}
                className="flex h-5 w-5 items-center justify-center rounded-md text-[9px] font-bold text-white"
                style={{ backgroundColor: pm.color }}
              >
                {pm.initial}
              </span>
            );
          })}
        </div>
        <span className="text-[10px] font-medium text-slate-400">
          Updated {a.daysSinceUpdate}d ago
        </span>
      </div>

      <div className="mt-3 flex items-center justify-end gap-1 opacity-0 transition group-hover:opacity-100">
        <ActionBtn label="Edit">
          <Pencil className="h-3.5 w-3.5" />
        </ActionBtn>
        <ActionBtn label="Duplicate">
          <Copy className="h-3.5 w-3.5" />
        </ActionBtn>
        <ActionBtn label="Use in campaign">
          <Rocket className="h-3.5 w-3.5" />
        </ActionBtn>
        <ActionBtn label="Delete" tone="danger">
          <Trash2 className="h-3.5 w-3.5" />
        </ActionBtn>
      </div>
    </div>
  );
}

function Metric({
  label,
  value,
  tone,
  small,
}: {
  label: string;
  value: string;
  tone?: "emerald" | "amber";
  small?: boolean;
}) {
  return (
    <div>
      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
        {label}
      </p>
      <p
        className={clsx(
          "font-bold",
          small ? "text-xs" : "text-sm",
          tone === "emerald"
            ? "text-emerald-600"
            : tone === "amber"
              ? "text-amber-600"
              : "text-slate-900"
        )}
      >
        {value}
      </p>
    </div>
  );
}

function ActionBtn({
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
/* Build Audience Modal                       */
/* ───────────────────────────────────────── */

function BuildAudienceModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const [description, setDescription] = useState("");
  const [platforms, setPlatforms] = useState<Platform[]>([]);
  const [type, setType] = useState<AudienceType>("LOOKALIKE");
  const [budget, setBudget] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<null | {
    name: string;
    sizeLow: number;
    sizeHigh: number;
    age: string;
    gender: string;
    locations: string[];
    interests: string[];
    behaviors: string[];
    exclusions: string[];
    matchRate: number;
  }>(null);

  useEffect(() => {
    if (!open) {
      const t = setTimeout(() => {
        setDescription("");
        setPlatforms([]);
        setType("LOOKALIKE");
        setBudget("");
        setResult(null);
        setLoading(false);
      }, 250);
      return () => clearTimeout(t);
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  function togglePlatform(p: Platform) {
    setPlatforms((prev) =>
      prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p]
    );
  }

  function generate() {
    setLoading(true);
    setResult(null);
    // TODO: Replace with real Claude API call (POST /api/ai/build-audience)
    setTimeout(() => {
      setResult({
        name: "AI-Generated · SaaS Founders 28–45",
        sizeLow: 1_200_000,
        sizeHigh: 3_400_000,
        age: "28–45",
        gender: "Male",
        locations: ["United States", "Canada"],
        interests: [
          "SaaS",
          "Entrepreneurship",
          "Business Tools",
          "Productivity",
        ],
        behaviors: ["Small Business Owners", "Tech Early Adopters"],
        exclusions: ["Existing Customers"],
        matchRate: 74,
      });
      setLoading(false);
    }, 1500);
  }

  const canGenerate =
    description.trim().length >= 10 && platforms.length > 0 && !loading;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-in"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" />
      <div className="relative z-10 flex max-h-[88vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 shadow-glow">
              <Bot className="h-5 w-5 text-white" strokeWidth={2.25} />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">
                Build Audience with AI
              </h2>
              <p className="text-[11px] font-medium text-slate-500">
                Describe your ideal customer and we&apos;ll build the targeting
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="flex h-9 w-9 items-center justify-center rounded-xl text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 space-y-4 overflow-y-auto px-6 py-5">
          <div>
            <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-slate-500">
              Describe your ideal customer
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={5}
              placeholder="e.g. Male entrepreneurs aged 28–45 in the US who are interested in SaaS tools, have visited my website, and follow business influencers on Instagram"
              className="w-full resize-none rounded-xl border border-slate-200 px-3 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-primary focus:outline-none"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-slate-500">
              Platforms
            </label>
            <div className="flex flex-wrap gap-1.5">
              {(["META", "GOOGLE", "TIKTOK", "LINKEDIN"] as Platform[]).map(
                (p) => {
                  const pm = PLATFORM_META[p];
                  const selected = platforms.includes(p);
                  return (
                    <button
                      key={p}
                      type="button"
                      onClick={() => togglePlatform(p)}
                      className={clsx(
                        "inline-flex items-center gap-2 rounded-full border-2 px-3 py-1.5 text-xs font-semibold transition",
                        selected
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"
                      )}
                    >
                      <span
                        className="h-2 w-2 rounded-sm"
                        style={{ backgroundColor: pm.color }}
                      />
                      {pm.label}
                    </button>
                  );
                }
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-slate-500">
                Audience Type
              </label>
              <Select
                value={type}
                onChange={(v) => setType(v as AudienceType)}
                options={[
                  { value: "LOOKALIKE", label: "Lookalike" },
                  { value: "INTEREST", label: "Interest-based" },
                  { value: "RETARGETING", label: "Retargeting" },
                  { value: "BEHAVIORAL", label: "Behavioral" },
                  { value: "CUSTOM", label: "Custom" },
                ]}
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-slate-500">
                Daily Budget{" "}
                <span className="font-medium text-slate-400">(optional)</span>
              </label>
              <input
                type="number"
                min={0}
                value={budget}
                onChange={(e) => setBudget(e.target.value)}
                placeholder="$ per day"
                className="h-10 w-full rounded-xl border border-slate-200 px-3 text-sm font-medium text-slate-900 transition focus:border-primary focus:outline-none"
              />
            </div>
          </div>

          <button
            type="button"
            onClick={generate}
            disabled={!canGenerate}
            className={clsx(
              "inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 px-4 py-3 text-sm font-bold text-white shadow-glow transition",
              !canGenerate ? "opacity-60" : "hover:-translate-y-0.5 hover:shadow-xl"
            )}
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Generating…
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4" strokeWidth={2.5} />
                Generate Audience
              </>
            )}
          </button>

          {/* Result */}
          {result && (
            <div className="space-y-4 rounded-2xl border-2 border-primary/30 bg-primary/[0.04] p-5 animate-in">
              <div className="flex items-center justify-between">
                <h3 className="text-base font-bold text-slate-900">
                  {result.name}
                </h3>
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-emerald-700">
                  <Check className="h-2.5 w-2.5" strokeWidth={3} />
                  Generated
                </span>
              </div>

              <div className="rounded-xl bg-white p-3">
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Estimated size
                </p>
                <p className="text-2xl font-bold text-slate-900">
                  {formatSize(result.sizeLow)}–{formatSize(result.sizeHigh)}{" "}
                  <span className="text-sm font-semibold text-slate-500">
                    people
                  </span>
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <ChipsBlock label="Age" items={[result.age]} />
                <ChipsBlock label="Gender" items={[result.gender]} />
                <ChipsBlock label="Locations" items={result.locations} />
                <ChipsBlock label="Interests" items={result.interests} />
                <ChipsBlock label="Behaviors" items={result.behaviors} />
                <ChipsBlock
                  label="Exclusions"
                  items={result.exclusions}
                  tone="danger"
                />
              </div>

              <div className="flex items-center justify-between rounded-xl bg-white p-3">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                  Estimated match rate
                </span>
                <span className="text-lg font-bold text-emerald-600">
                  {result.matchRate}%
                </span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-emerald-500 px-4 py-2.5 text-sm font-bold text-white shadow-sm transition hover:-translate-y-0.5 hover:bg-emerald-600"
                >
                  <Check className="h-4 w-4" strokeWidth={2.5} />
                  Save Audience
                </button>
                <button
                  type="button"
                  onClick={generate}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
                >
                  <RefreshCw className="h-4 w-4" />
                  Regenerate
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function ChipsBlock({
  label,
  items,
  tone,
}: {
  label: string;
  items: string[];
  tone?: "danger";
}) {
  return (
    <div className="rounded-xl bg-white p-3">
      <p className="mb-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400">
        {label}
      </p>
      <div className="flex flex-wrap gap-1">
        {items.map((i) => (
          <span
            key={i}
            className={clsx(
              "rounded-md px-2 py-0.5 text-[11px] font-semibold",
              tone === "danger"
                ? "bg-rose-50 text-rose-700"
                : "bg-slate-100 text-slate-700"
            )}
          >
            {i}
          </span>
        ))}
      </div>
    </div>
  );
}
