"use client";

import { useEffect, useMemo, useState } from "react";
import clsx from "clsx";
import toast from "react-hot-toast";
import {
  Sparkles,
  Upload,
  Search,
  ChevronDown,
  Image as ImageIcon,
  Film,
  Layers,
  MessageSquareQuote,
  Play,
  Copy,
  X,
  ArrowRight,
  Loader2,
  RefreshCw,
  type LucideIcon,
} from "lucide-react";

/* ───────────────────────────────────────── */
/* Types & Mock Data                          */
/* ───────────────────────────────────────── */

type CreativeType = "IMAGE" | "VIDEO" | "CAROUSEL" | "TEXT";
type Platform = "META" | "GOOGLE" | "TIKTOK" | "LINKEDIN";
type Status = "ACTIVE" | "PAUSED" | "DRAFT";

type Creative = {
  id: string;
  name: string;
  type: CreativeType;
  platforms: Platform[];
  status: Status;
  aiGenerated: boolean;
  ctr: number;
  impressions: number;
  copy?: string;
  gradient: string;
  createdAt: string;
};

const CREATIVES: Creative[] = [
  {
    id: "cr-1",
    name: "Summer Sale Hero",
    type: "IMAGE",
    platforms: ["META", "GOOGLE"],
    status: "ACTIVE",
    aiGenerated: true,
    ctr: 3.2,
    impressions: 124000,
    gradient: "from-indigo-500 via-purple-500 to-pink-500",
    createdAt: "2026-05-20",
  },
  {
    id: "cr-2",
    name: "Tide+ Product Demo",
    type: "VIDEO",
    platforms: ["TIKTOK"],
    status: "ACTIVE",
    aiGenerated: true,
    ctr: 4.1,
    impressions: 96000,
    gradient: "from-emerald-500 via-teal-500 to-cyan-500",
    createdAt: "2026-05-18",
  },
  {
    id: "cr-3",
    name: "Best Sellers Carousel",
    type: "CAROUSEL",
    platforms: ["META"],
    status: "ACTIVE",
    aiGenerated: false,
    ctr: 2.4,
    impressions: 78000,
    gradient: "from-amber-400 via-orange-500 to-rose-500",
    createdAt: "2026-05-15",
  },
  {
    id: "cr-4",
    name: "Testimonial · Sarah",
    type: "TEXT",
    platforms: ["LINKEDIN"],
    status: "ACTIVE",
    aiGenerated: false,
    ctr: 1.8,
    impressions: 18400,
    copy: "AdGenius helped us cut our CAC by 38% in just 6 weeks. Highly recommend.",
    gradient: "",
    createdAt: "2026-05-12",
  },
  {
    id: "cr-5",
    name: "Black Friday Tease",
    type: "IMAGE",
    platforms: ["META", "TIKTOK"],
    status: "DRAFT",
    aiGenerated: true,
    ctr: 0,
    impressions: 0,
    gradient: "from-slate-900 via-purple-900 to-indigo-900",
    createdAt: "2026-05-22",
  },
  {
    id: "cr-6",
    name: "Founder Story 15s",
    type: "VIDEO",
    platforms: ["LINKEDIN", "META"],
    status: "PAUSED",
    aiGenerated: true,
    ctr: 1.4,
    impressions: 42000,
    gradient: "from-violet-500 via-fuchsia-500 to-pink-500",
    createdAt: "2026-05-08",
  },
  {
    id: "cr-7",
    name: "Spring Drop Lookbook",
    type: "CAROUSEL",
    platforms: ["META", "TIKTOK"],
    status: "ACTIVE",
    aiGenerated: true,
    ctr: 3.6,
    impressions: 188000,
    gradient: "from-rose-400 via-pink-500 to-fuchsia-600",
    createdAt: "2026-05-21",
  },
  {
    id: "cr-8",
    name: "Quote · Founder Vision",
    type: "TEXT",
    platforms: ["LINKEDIN"],
    status: "ACTIVE",
    aiGenerated: true,
    ctr: 2.1,
    impressions: 24000,
    copy: "We don't sell software. We sell back the 12 hours per week you waste on busywork.",
    gradient: "",
    createdAt: "2026-05-19",
  },
  {
    id: "cr-9",
    name: "Cart Abandon Static",
    type: "IMAGE",
    platforms: ["META"],
    status: "ACTIVE",
    aiGenerated: true,
    ctr: 4.2,
    impressions: 64000,
    gradient: "from-blue-500 via-indigo-500 to-purple-600",
    createdAt: "2026-05-10",
  },
  {
    id: "cr-10",
    name: "Reel · Behind the Scenes",
    type: "VIDEO",
    platforms: ["META", "TIKTOK"],
    status: "ACTIVE",
    aiGenerated: false,
    ctr: 3.8,
    impressions: 142000,
    gradient: "from-cyan-500 via-blue-500 to-indigo-600",
    createdAt: "2026-05-14",
  },
  {
    id: "cr-11",
    name: "Holiday Catalog Sweep",
    type: "CAROUSEL",
    platforms: ["GOOGLE"],
    status: "DRAFT",
    aiGenerated: false,
    ctr: 0,
    impressions: 0,
    gradient: "from-orange-400 via-red-500 to-pink-600",
    createdAt: "2026-05-23",
  },
  {
    id: "cr-12",
    name: "Punchy CTA Headline",
    type: "TEXT",
    platforms: ["GOOGLE"],
    status: "ACTIVE",
    aiGenerated: true,
    ctr: 5.4,
    impressions: 41000,
    copy: "Stop guessing. Start scaling. AdGenius optimizes 24/7 so you don't have to.",
    gradient: "",
    createdAt: "2026-05-16",
  },
];

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
};

const STATUS_META: Record<
  Status,
  { label: string; cls: string; dot: "active" | "paused" | "draft" }
> = {
  ACTIVE: { label: "Active", cls: "text-emerald-700", dot: "active" },
  PAUSED: { label: "Paused", cls: "text-amber-700", dot: "paused" },
  DRAFT: { label: "Draft", cls: "text-slate-600", dot: "draft" },
};

const TYPE_ICON: Record<CreativeType, LucideIcon> = {
  IMAGE: ImageIcon,
  VIDEO: Film,
  CAROUSEL: Layers,
  TEXT: MessageSquareQuote,
};

function formatCompact(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1).replace(/\.0$/, "") + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(1).replace(/\.0$/, "") + "K";
  return n.toString();
}

/* ───────────────────────────────────────── */
/* Page                                       */
/* ───────────────────────────────────────── */

export default function CreativesPage() {
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<"ALL" | CreativeType>("ALL");
  const [platformFilter, setPlatformFilter] = useState<"ALL" | Platform>("ALL");
  const [statusFilter, setStatusFilter] = useState<"ALL" | Status>("ALL");
  const [sort, setSort] = useState<"NEWEST" | "CTR" | "USAGE">("NEWEST");
  const [modalOpen, setModalOpen] = useState(false);

  const filtered = useMemo(() => {
    let rows = CREATIVES.filter((c) => {
      if (
        search.trim() &&
        !c.name.toLowerCase().includes(search.trim().toLowerCase())
      ) {
        return false;
      }
      if (typeFilter !== "ALL" && c.type !== typeFilter) return false;
      if (statusFilter !== "ALL" && c.status !== statusFilter) return false;
      if (
        platformFilter !== "ALL" &&
        !c.platforms.includes(platformFilter as Platform)
      )
        return false;
      return true;
    });

    if (sort === "NEWEST") {
      rows = rows.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    } else if (sort === "CTR") {
      rows = rows.sort((a, b) => b.ctr - a.ctr);
    } else {
      rows = rows.sort((a, b) => b.impressions - a.impressions);
    }
    return rows;
  }, [search, typeFilter, platformFilter, statusFilter, sort]);

  const counts = useMemo(
    () => ({
      total: CREATIVES.length,
      ai: CREATIVES.filter((c) => c.aiGenerated).length,
      active: CREATIVES.filter((c) => c.status === "ACTIVE").length,
    }),
    []
  );

  return (
    <div className="space-y-6">
      {/* ── Top bar ── */}
      <header className="flex flex-wrap items-end justify-between gap-3 animate-in stagger-1">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 lg:text-3xl">
            Creatives
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Manage and generate your ad creatives
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setModalOpen(true)}
            className="group relative inline-flex items-center gap-1.5 overflow-hidden rounded-xl bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 px-4 py-2.5 text-sm font-bold text-white shadow-glow transition hover:-translate-y-0.5 hover:shadow-xl"
          >
            <Sparkles className="h-4 w-4" strokeWidth={2.5} />
            Generate with AI
          </button>
          <button
            type="button"
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
          >
            <Upload className="h-4 w-4" />
            Upload Creative
          </button>
        </div>
      </header>

      {/* ── Filter bar ── */}
      <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-slate-200/70 bg-white p-3 shadow-card animate-in stagger-2">
        <div className="relative min-w-[200px] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search creatives…"
            className="h-10 w-full rounded-xl border border-slate-200 bg-white pl-10 pr-3 text-sm placeholder:text-slate-400 focus:border-primary focus:outline-none"
          />
        </div>

        <FilterSelect
          value={typeFilter}
          onChange={(v) => setTypeFilter(v as "ALL" | CreativeType)}
          options={[
            { value: "ALL", label: "All Types" },
            { value: "IMAGE", label: "Image" },
            { value: "VIDEO", label: "Video" },
            { value: "CAROUSEL", label: "Carousel" },
            { value: "TEXT", label: "Text" },
          ]}
        />
        <FilterSelect
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
        <FilterSelect
          value={statusFilter}
          onChange={(v) => setStatusFilter(v as "ALL" | Status)}
          options={[
            { value: "ALL", label: "All Status" },
            { value: "ACTIVE", label: "Active" },
            { value: "PAUSED", label: "Paused" },
            { value: "DRAFT", label: "Draft" },
          ]}
        />
        <FilterSelect
          value={sort}
          onChange={(v) => setSort(v as "NEWEST" | "CTR" | "USAGE")}
          options={[
            { value: "NEWEST", label: "Newest" },
            { value: "CTR", label: "Best CTR" },
            { value: "USAGE", label: "Most Used" },
          ]}
        />
      </div>

      {/* ── Stats chips ── */}
      <div className="flex flex-wrap items-center gap-2 animate-in stagger-3">
        <div className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 shadow-card">
          <span className="text-xs font-semibold text-slate-500">Total</span>
          <span className="text-sm font-bold text-slate-900">
            {counts.total} creatives
          </span>
        </div>
        <div className="inline-flex items-center gap-2 rounded-xl border border-primary/20 bg-primary/[0.06] px-4 py-2 shadow-card">
          <Sparkles className="h-3.5 w-3.5 text-primary" />
          <span className="text-xs font-semibold text-primary">AI Generated</span>
          <span className="text-sm font-bold text-primary">{counts.ai}</span>
        </div>
        <div className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 shadow-card">
          <span className="status-dot active" />
          <span className="text-xs font-semibold text-slate-500">Active</span>
          <span className="text-sm font-bold text-slate-900">
            {counts.active}
          </span>
        </div>
      </div>

      {/* ── Creatives grid ── */}
      {filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-12 text-center animate-in">
          <p className="text-sm font-semibold text-slate-700">
            No creatives match your filters.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4 animate-in stagger-4 md:grid-cols-3 lg:grid-cols-4">
          {filtered.map((c) => (
            <CreativeCard key={c.id} c={c} />
          ))}
        </div>
      )}

      <AIGenerateModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
      />
    </div>
  );
}

/* ───────────────────────────────────────── */
function FilterSelect({
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
function CreativeCard({ c }: { c: Creative }) {
  const Icon = TYPE_ICON[c.type];
  const st = STATUS_META[c.status];

  return (
    <div className="group overflow-hidden rounded-2xl border border-slate-200/70 bg-white shadow-card transition hover:-translate-y-0.5 hover:shadow-card-hover">
      {/* Preview */}
      <div className="relative aspect-square overflow-hidden">
        <PreviewArea creative={c} />

        {/* AI badge */}
        {c.aiGenerated && (
          <span className="absolute right-3 top-3 inline-flex items-center gap-1 rounded-full bg-white/95 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-primary shadow-sm ring-1 ring-primary/30 backdrop-blur">
            <Sparkles className="h-2.5 w-2.5" />
            AI
          </span>
        )}

        {/* Type badge */}
        <span className="absolute left-3 top-3 inline-flex items-center gap-1 rounded-full bg-white/90 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-slate-700 shadow-sm backdrop-blur">
          <Icon className="h-2.5 w-2.5" />
          {c.type}
        </span>

        {/* Hover overlay */}
        <div className="absolute inset-x-0 bottom-0 translate-y-full bg-gradient-to-t from-slate-900/95 via-slate-900/80 to-transparent px-3 py-3 opacity-0 transition-all duration-300 group-hover:translate-y-0 group-hover:opacity-100">
          <div className="flex items-end justify-between gap-2">
            <div className="text-xs">
              <div className="text-[10px] font-bold uppercase tracking-wider text-white/60">
                CTR
              </div>
              <div className="font-bold text-white">
                {c.ctr === 0 ? "—" : `${c.ctr.toFixed(2)}%`}
              </div>
            </div>
            <button
              type="button"
              className="inline-flex items-center gap-1 rounded-lg bg-white px-2.5 py-1 text-[11px] font-bold text-slate-900 shadow-md transition hover:-translate-y-0.5"
            >
              Details
              <ArrowRight className="h-3 w-3" />
            </button>
          </div>
        </div>
      </div>

      {/* Below preview */}
      <div className="p-3">
        <p className="truncate text-sm font-bold text-slate-900">{c.name}</p>
        <div className="mt-1.5 flex flex-wrap items-center gap-1">
          {c.platforms.map((p) => {
            const pm = PLATFORM_BADGE[p];
            return (
              <span
                key={p}
                className={clsx(
                  "rounded-md px-1.5 py-0.5 text-[9px] font-bold uppercase",
                  pm.bg,
                  pm.text
                )}
              >
                {pm.label}
              </span>
            );
          })}
        </div>
        <div className="mt-2 flex items-center justify-between border-t border-slate-100 pt-2">
          <span className="inline-flex items-center gap-1.5">
            <span className={clsx("status-dot", st.dot)} />
            <span className={clsx("text-[10px] font-bold uppercase", st.cls)}>
              {st.label}
            </span>
          </span>
          <span className="text-[10px] font-medium text-slate-500">
            CTR{" "}
            <span
              className={clsx(
                "font-bold",
                c.ctr === 0
                  ? "text-slate-400"
                  : c.ctr > 2
                    ? "text-emerald-600"
                    : "text-amber-600"
              )}
            >
              {c.ctr === 0 ? "—" : `${c.ctr.toFixed(1)}%`}
            </span>{" "}
            · {formatCompact(c.impressions)} imp.
          </span>
        </div>
      </div>
    </div>
  );
}

function PreviewArea({ creative }: { creative: Creative }) {
  const Icon = TYPE_ICON[creative.type];
  if (creative.type === "TEXT") {
    return (
      <div className="flex h-full w-full flex-col justify-between bg-gradient-to-br from-slate-50 to-white p-4">
        <MessageSquareQuote className="h-7 w-7 text-primary/40" strokeWidth={2} />
        <p className="line-clamp-5 text-sm font-bold leading-snug text-slate-800">
          “{creative.copy}”
        </p>
      </div>
    );
  }
  if (creative.type === "CAROUSEL") {
    return (
      <div className="relative h-full w-full">
        <div
          className={clsx(
            "absolute inset-3 rounded-xl bg-gradient-to-br opacity-40",
            creative.gradient
          )}
        />
        <div
          className={clsx(
            "absolute inset-1.5 rounded-xl bg-gradient-to-br opacity-70",
            creative.gradient
          )}
        />
        <div
          className={clsx(
            "absolute inset-0 flex items-center justify-center rounded-none bg-gradient-to-br",
            creative.gradient
          )}
        >
          <Layers className="h-12 w-12 text-white/40" strokeWidth={1.5} />
        </div>
      </div>
    );
  }
  return (
    <div
      className={clsx(
        "relative flex h-full w-full items-center justify-center bg-gradient-to-br",
        creative.gradient
      )}
    >
      <Icon className="h-14 w-14 text-white/30" strokeWidth={1.5} />
      {creative.type === "VIDEO" && (
        <div className="absolute flex h-12 w-12 items-center justify-center rounded-full bg-white/95 shadow-xl">
          <Play
            className="ml-0.5 h-5 w-5 text-slate-900"
            fill="currentColor"
            strokeWidth={0}
          />
        </div>
      )}
    </div>
  );
}

/* ───────────────────────────────────────── */
/* AI Generate Modal                          */
/* ───────────────────────────────────────── */

type CreativeKind = "image" | "video" | "carousel" | "text";
type Tone = "professional" | "playful" | "urgent" | "inspirational";

type CopyResult = {
  headlines: string[];
  primary_texts: string[];
  descriptions: string[];
  ctas: string[];
};

const KIND_OPTIONS: { value: CreativeKind; label: string }[] = [
  { value: "image", label: "Image Ad" },
  { value: "video", label: "Video Script" },
  { value: "carousel", label: "Carousel" },
  { value: "text", label: "Text Ad" },
];

const TONE_OPTIONS: { value: Tone; label: string }[] = [
  { value: "professional", label: "Professional" },
  { value: "playful", label: "Playful" },
  { value: "urgent", label: "Urgent" },
  { value: "inspirational", label: "Inspirational" },
];

const FALLBACK_COPY: CopyResult = {
  headlines: [
    "Scale faster, spend less.",
    "Your AI ads strategist.",
    "Outperform on autopilot.",
    "From idea to launch in 5 minutes.",
    "Ad ROI, doubled.",
  ],
  primary_texts: [
    "AdGenius AI runs your campaigns 24/7 so you can focus on what actually grows the business. No more guessing.",
    "Teams using AdGenius cut their CPA by 38% in the first 30 days. See why 12,000+ marketers made the switch.",
    "Tired of duct-taped dashboards? One workspace, all your platforms, optimized continuously by AI.",
  ],
  descriptions: [
    "Free 14-day trial. No credit card required.",
    "Trusted by 12,000+ growth teams worldwide.",
    "Multi-platform AI ad management, redefined.",
  ],
  ctas: ["Start Free Trial", "Get Started", "See It in Action", "Book a Demo"],
};

function AIGenerateModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const [brief, setBrief] = useState("");
  const [platform, setPlatform] = useState<Platform>("META");
  const [objective, setObjective] = useState<string>("Conversions");
  const [kind, setKind] = useState<CreativeKind>("image");
  const [tone, setTone] = useState<Tone>("professional");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<CopyResult | null>(null);

  useEffect(() => {
    if (!open) {
      const t = setTimeout(() => {
        setBrief("");
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

  async function generate() {
    if (brief.trim().length < 10) {
      toast.error("Brief must be at least 10 characters.");
      return;
    }
    setLoading(true);
    setResult(null);
    try {
      const res = await fetch("/api/ai/generate-copy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          brief: `${brief}\n\nTone: ${tone}. Creative type: ${kind}.`,
          platform,
          objective,
        }),
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        throw new Error(data.error ?? "Failed to generate copy");
      }
      setResult(data.copy as CopyResult);
    } catch (err) {
      console.error("[generate-copy] error", err);
      toast.error("Couldn't reach AI service — showing example copy.");
      setResult(FALLBACK_COPY);
    } finally {
      setLoading(false);
    }
  }

  function copyToClipboard(text: string) {
    if (typeof navigator === "undefined" || !navigator.clipboard) return;
    navigator.clipboard.writeText(text).then(
      () => toast.success("Copied!"),
      () => toast.error("Couldn't copy")
    );
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-in"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" />
      <div className="relative z-10 flex max-h-[88vh] w-full max-w-xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 shadow-glow">
              <Sparkles className="h-4 w-4 text-white" strokeWidth={2.5} />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">
                Generate Ad Creative with AI
              </h2>
              <p className="text-[11px] font-medium text-slate-500">
                Powered by Claude Sonnet
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

        {/* Scrollable body */}
        <div className="flex-1 space-y-4 overflow-y-auto px-6 py-5">
          <div>
            <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-slate-500">
              Campaign brief
            </label>
            <textarea
              value={brief}
              onChange={(e) => setBrief(e.target.value)}
              rows={4}
              placeholder="Describe your product/service and what you want to achieve…"
              className="w-full resize-none rounded-xl border border-slate-200 px-3 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-primary focus:outline-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-slate-500">
                Platform
              </label>
              <FilterSelect
                value={platform}
                onChange={(v) => setPlatform(v as Platform)}
                options={[
                  { value: "META", label: "Meta" },
                  { value: "GOOGLE", label: "Google" },
                  { value: "TIKTOK", label: "TikTok" },
                  { value: "LINKEDIN", label: "LinkedIn" },
                ]}
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-slate-500">
                Objective
              </label>
              <FilterSelect
                value={objective}
                onChange={setObjective}
                options={[
                  { value: "Conversions", label: "Conversions" },
                  { value: "Awareness", label: "Awareness" },
                  { value: "Traffic", label: "Traffic" },
                  { value: "Leads", label: "Leads" },
                ]}
              />
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-slate-500">
              Creative type
            </label>
            <div className="flex flex-wrap gap-1.5">
              {KIND_OPTIONS.map((k) => (
                <button
                  key={k.value}
                  type="button"
                  onClick={() => setKind(k.value)}
                  className={clsx(
                    "rounded-full px-3 py-1.5 text-xs font-semibold transition",
                    kind === k.value
                      ? "bg-primary text-white shadow-sm"
                      : "border border-slate-200 bg-white text-slate-600 hover:border-slate-300"
                  )}
                >
                  {k.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-slate-500">
              Tone
            </label>
            <div className="flex flex-wrap gap-1.5">
              {TONE_OPTIONS.map((t) => (
                <button
                  key={t.value}
                  type="button"
                  onClick={() => setTone(t.value)}
                  className={clsx(
                    "rounded-full px-3 py-1.5 text-xs font-semibold transition",
                    tone === t.value
                      ? "bg-primary text-white shadow-sm"
                      : "border border-slate-200 bg-white text-slate-600 hover:border-slate-300"
                  )}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          <button
            type="button"
            onClick={generate}
            disabled={loading || brief.trim().length < 10}
            className={clsx(
              "inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 px-4 py-3 text-sm font-bold text-white shadow-glow transition",
              loading || brief.trim().length < 10
                ? "opacity-60"
                : "hover:-translate-y-0.5 hover:shadow-xl"
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
                Generate Copy
              </>
            )}
          </button>

          {/* Results */}
          {result && (
            <div className="space-y-4 pt-2 animate-in">
              <div className="border-t border-slate-100 pt-4">
                <h3 className="mb-2 text-xs font-bold uppercase tracking-wider text-slate-500">
                  Headlines
                </h3>
                <ul className="space-y-1.5">
                  {result.headlines?.map((h, i) => (
                    <CopyItem key={`h-${i}`} text={h} onCopy={copyToClipboard} />
                  ))}
                </ul>
              </div>

              <div>
                <h3 className="mb-2 text-xs font-bold uppercase tracking-wider text-slate-500">
                  Primary Texts
                </h3>
                <ul className="space-y-1.5">
                  {result.primary_texts?.map((p, i) => (
                    <CopyItem
                      key={`p-${i}`}
                      text={p}
                      onCopy={copyToClipboard}
                      multiline
                    />
                  ))}
                </ul>
              </div>

              {result.descriptions && result.descriptions.length > 0 && (
                <div>
                  <h3 className="mb-2 text-xs font-bold uppercase tracking-wider text-slate-500">
                    Descriptions
                  </h3>
                  <ul className="space-y-1.5">
                    {result.descriptions.map((d, i) => (
                      <CopyItem
                        key={`d-${i}`}
                        text={d}
                        onCopy={copyToClipboard}
                      />
                    ))}
                  </ul>
                </div>
              )}

              <div>
                <h3 className="mb-2 text-xs font-bold uppercase tracking-wider text-slate-500">
                  CTAs
                </h3>
                <div className="flex flex-wrap gap-2">
                  {result.ctas?.map((c, i) => (
                    <button
                      key={`c-${i}`}
                      type="button"
                      onClick={() => copyToClipboard(c)}
                      className="rounded-full bg-primary px-3.5 py-1.5 text-xs font-bold text-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-glow"
                    >
                      {c}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex items-center gap-2 pt-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="btn-brand flex-1"
                >
                  Use This Creative
                  <ArrowRight className="h-4 w-4" strokeWidth={2.5} />
                </button>
                <button
                  type="button"
                  onClick={generate}
                  disabled={loading}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50 disabled:opacity-60"
                >
                  <RefreshCw className={clsx("h-4 w-4", loading && "animate-spin")} />
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

function CopyItem({
  text,
  onCopy,
  multiline,
}: {
  text: string;
  onCopy: (t: string) => void;
  multiline?: boolean;
}) {
  return (
    <li
      className={clsx(
        "group flex items-start gap-2 rounded-lg border border-slate-200 bg-slate-50/50 px-3 py-2 transition hover:border-primary/30 hover:bg-primary/[0.04]",
        multiline ? "items-start" : "items-center"
      )}
    >
      <p className="flex-1 text-xs leading-relaxed text-slate-700">{text}</p>
      <button
        type="button"
        onClick={() => onCopy(text)}
        aria-label="Copy"
        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-slate-400 transition hover:bg-white hover:text-primary"
      >
        <Copy className="h-3.5 w-3.5" />
      </button>
    </li>
  );
}
