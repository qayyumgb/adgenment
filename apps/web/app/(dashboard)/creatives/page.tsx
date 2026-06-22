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
  Palette,
  Trash2,
  type LucideIcon,
} from "lucide-react";
import { useApi } from "@/hooks/useApi";
import { useApiClient } from "@/lib/api";
import type {
  Creative as ApiCreative,
  CreativeStatus as ApiCreativeStatus,
  Platform as ApiPlatform,
} from "@/lib/api";
import { SkeletonCard } from "@/components/ui/Skeleton";
import EmptyState from "@/components/ui/EmptyState";

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
  /** Public asset URL — present for uploaded image/video creatives. */
  url?: string;
  gradient: string;
  createdAt: string;
};

// Gradient palette assigned deterministically per creative id so the
// preview tile colors stay stable across renders.
const GRADIENTS = [
  "from-indigo-500 via-purple-500 to-pink-500",
  "from-emerald-500 via-teal-500 to-cyan-500",
  "from-amber-400 via-orange-500 to-rose-500",
  "from-slate-900 via-purple-900 to-indigo-900",
  "from-violet-500 via-fuchsia-500 to-pink-500",
  "from-rose-400 via-pink-500 to-fuchsia-600",
  "from-blue-500 via-indigo-500 to-purple-600",
  "from-cyan-500 via-blue-500 to-indigo-600",
  "from-orange-400 via-red-500 to-pink-600",
] as const;

function hashId(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) {
    h = (h * 31 + id.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

function gradientFor(id: string): string {
  return GRADIENTS[hashId(id) % GRADIENTS.length];
}

function extractCopy(content: unknown): string | undefined {
  if (typeof content === "string") return content;
  if (content && typeof content === "object") {
    const obj = content as Record<string, unknown>;
    if (typeof obj.text === "string") return obj.text;
    if (typeof obj.copy === "string") return obj.copy;
    if (Array.isArray(obj.headlines) && typeof obj.headlines[0] === "string") {
      return obj.headlines[0] as string;
    }
    if (Array.isArray(obj.primary_texts) && typeof obj.primary_texts[0] === "string") {
      return obj.primary_texts[0] as string;
    }
  }
  return undefined;
}

function extractMediaUrl(content: unknown): string | undefined {
  if (!content || typeof content !== "object") return undefined;
  const obj = content as Record<string, unknown>;
  if (typeof obj.url === "string" && obj.url.startsWith("http")) return obj.url;
  if (typeof obj.image_url === "string" && obj.image_url.startsWith("http")) {
    return obj.image_url;
  }
  if (typeof obj.video_url === "string" && obj.video_url.startsWith("http")) {
    return obj.video_url;
  }
  return undefined;
}

function mapApiStatus(s: ApiCreativeStatus): Status {
  switch (s) {
    case "APPROVED":
      return "ACTIVE";
    case "REJECTED":
    case "ARCHIVED":
      return "PAUSED";
    case "DRAFT":
    default:
      return "DRAFT";
  }
}

function mapApiCreative(c: ApiCreative): Creative {
  return {
    id: c.id,
    name: c.name,
    type: c.type,
    platforms: c.campaign?.platform
      ? ([c.campaign.platform] as ApiPlatform[]).filter(
          (p): p is Platform =>
            p === "META" || p === "GOOGLE" || p === "TIKTOK" || p === "LINKEDIN"
        )
      : [],
    status: mapApiStatus(c.status),
    aiGenerated: c.aiGenerated,
    ctr: 0, // not joined to campaign metrics today
    impressions: 0,
    copy: extractCopy(c.content),
    url: extractMediaUrl(c.content),
    gradient: gradientFor(c.id),
    createdAt: c.createdAt.slice(0, 10),
  };
}

// Mock data removed — creatives now fetched via useApiClient().getCreatives().

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
  const apiClient = useApiClient();
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<"ALL" | CreativeType>("ALL");
  const [platformFilter, setPlatformFilter] = useState<"ALL" | Platform>("ALL");
  const [statusFilter, setStatusFilter] = useState<"ALL" | ApiCreativeStatus>(
    "ALL"
  );
  const [sort, setSort] = useState<"NEWEST" | "CTR" | "USAGE">("NEWEST");
  const [modalOpen, setModalOpen] = useState(false);
  const [uploadModalOpen, setUploadModalOpen] = useState(false);

  // Debounce the search input
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  // Fetch creatives with the live filters
  const creativesQ = useApi(
    (client) =>
      client.getCreatives({
        type: typeFilter !== "ALL" ? typeFilter : undefined,
        status: statusFilter !== "ALL" ? statusFilter : undefined,
        platform: platformFilter !== "ALL" ? platformFilter : undefined,
        search: debouncedSearch.trim() || undefined,
        limit: "48",
      }),
    [typeFilter, statusFilter, platformFilter, debouncedSearch]
  );

  // Stats — independent counts (full workspace, not filter-scoped)
  const statsQ = useApi(
    (client) =>
      Promise.all([
        client.getCreatives({ limit: "1" }),
        client.getCreatives({ limit: "1", status: "APPROVED" }),
      ]).then(([all, approved]) => ({
        total: all.total,
        active: approved.total,
      })),
    []
  );

  // Sort client-side since the API endpoint doesn't yet expose a sort param
  const filtered = useMemo(() => {
    const rows = (creativesQ.data?.creatives ?? []).map(mapApiCreative);
    if (sort === "NEWEST") {
      rows.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    } else if (sort === "CTR") {
      rows.sort((a, b) => b.ctr - a.ctr);
    } else {
      rows.sort((a, b) => b.impressions - a.impressions);
    }
    return rows;
  }, [creativesQ.data, sort]);

  const filtersActive =
    debouncedSearch.trim() !== "" ||
    typeFilter !== "ALL" ||
    platformFilter !== "ALL" ||
    statusFilter !== "ALL";

  const aiCount = useMemo(
    () =>
      (creativesQ.data?.creatives ?? []).filter((c) => c.aiGenerated).length,
    [creativesQ.data]
  );

  const counts = {
    total: statsQ.data?.total ?? 0,
    ai: aiCount,
    active: statsQ.data?.active ?? 0,
  };

  // Called when the AI modal's "Use This Creative" button is clicked.
  async function handleSaveAiCreative(input: {
    type: CreativeType;
    platform: string;
    objective: string;
    content: Record<string, unknown>;
  }) {
    try {
      const name = `AI ${input.type.toLowerCase()} · ${input.platform} · ${new Date().toLocaleDateString()}`;
      await apiClient.createCreative({
        name,
        type: input.type,
        content: input.content,
        aiGenerated: true,
      });
      toast.success("Creative saved to your library");
      creativesQ.refetch();
      statsQ.refetch();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Save failed");
    }
  }

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
            onClick={() => setUploadModalOpen(true)}
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
          onChange={(v) => setStatusFilter(v as "ALL" | ApiCreativeStatus)}
          options={[
            { value: "ALL", label: "All Status" },
            { value: "DRAFT", label: "Draft" },
            { value: "APPROVED", label: "Approved" },
            { value: "REJECTED", label: "Rejected" },
            { value: "ARCHIVED", label: "Archived" },
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
      {creativesQ.error ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm font-medium text-rose-700">
          Couldn&apos;t load creatives — {creativesQ.error}.{" "}
          <button
            type="button"
            onClick={() => creativesQ.refetch()}
            className="underline"
          >
            Retry
          </button>
        </div>
      ) : creativesQ.loading ? (
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <SkeletonCard key={i} className="aspect-[4/5]" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={Palette}
          title={
            filtersActive ? "No creatives match your filters" : "No creatives yet"
          }
          description={
            filtersActive
              ? "Try clearing filters to see all your creatives."
              : "Generate your first ad creative with AI or upload one to get started."
          }
          action={{
            label: filtersActive ? "Clear filters" : "Generate with AI",
            onClick: filtersActive
              ? () => {
                  setSearch("");
                  setTypeFilter("ALL");
                  setPlatformFilter("ALL");
                  setStatusFilter("ALL");
                }
              : () => setModalOpen(true),
            icon: Sparkles,
          }}
        />
      ) : (
        <div className="grid grid-cols-2 gap-4 animate-in stagger-4 md:grid-cols-3 lg:grid-cols-4">
          {filtered.map((c) => (
            <CreativeCard
              key={c.id}
              c={c}
              onDeleted={() => {
                creativesQ.refetch();
                statsQ.refetch();
              }}
            />
          ))}
        </div>
      )}

      <AIGenerateModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onSave={handleSaveAiCreative}
      />

      <UploadCreativeModal
        open={uploadModalOpen}
        onClose={() => setUploadModalOpen(false)}
        onSaved={() => {
          creativesQ.refetch();
          statsQ.refetch();
        }}
      />
    </div>
  );
}

/* ───────────────────────────────────────── */
/* Upload Creative Modal                      */
/* ───────────────────────────────────────── */

/** Hard limits — fail fast client-side instead of waiting for Meta to 400. */
const MAX_IMAGE_BYTES = 8 * 1024 * 1024; // Meta's hard cap on /adimages
const ACCEPTED_IMAGE_TYPES = "image/jpeg,image/jpg,image/png,image/webp,image/gif";

type UploadTab = "device" | "url";

function UploadCreativeModal({
  open,
  onClose,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const api = useApiClient();
  const [tab, setTab] = useState<UploadTab>("device");
  const [name, setName] = useState("");
  const [type, setType] = useState<"IMAGE" | "VIDEO">("IMAGE");
  // URL-paste mode
  const [url, setUrl] = useState("");
  const [previewError, setPreviewError] = useState(false);
  // File-pick mode
  const [file, setFile] = useState<File | null>(null);
  const [filePreviewUrl, setFilePreviewUrl] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  // Shared
  const [submitting, setSubmitting] = useState(false);

  // Reset state every time the modal opens so a previous in-flight submit
  // doesn't leak through.
  useEffect(() => {
    if (open) {
      setTab("device");
      setName("");
      setType("IMAGE");
      setUrl("");
      setFile(null);
      setFilePreviewUrl(null);
      setSubmitting(false);
      setPreviewError(false);
      setIsDragging(false);
    }
  }, [open]);

  // Revoke the object URL when the picked file changes or the modal closes —
  // otherwise we leak browser memory on each pick.
  useEffect(() => {
    if (!file) {
      setFilePreviewUrl(null);
      return;
    }
    const objUrl = URL.createObjectURL(file);
    setFilePreviewUrl(objUrl);
    return () => URL.revokeObjectURL(objUrl);
  }, [file]);

  // Device upload only supports images right now (Meta's /adimages endpoint).
  // If the user picks "Video" type, force them onto the URL tab — building
  // video upload requires Meta's /advideos endpoint, which is Phase 1B work.
  useEffect(() => {
    if (type === "VIDEO" && tab === "device") setTab("url");
  }, [type, tab]);

  // Lightweight client-side URL validity check. We only care that the string
  // looks like an HTTPS URL — actual reachability is the user's problem (and
  // the platform's, when this creative gets attached to an ad).
  const looksLikeUrl =
    url.startsWith("https://") &&
    url.length > "https://".length &&
    !url.includes(" ");

  function handlePickFile(picked: File | null) {
    if (!picked) {
      setFile(null);
      return;
    }
    if (!picked.type.startsWith("image/")) {
      toast.error("Pick an image file (JPEG, PNG, WebP, GIF)");
      return;
    }
    if (picked.size > MAX_IMAGE_BYTES) {
      toast.error(
        `Image is ${(picked.size / 1024 / 1024).toFixed(1)} MB — Meta caps uploads at 8 MB`
      );
      return;
    }
    setFile(picked);
    // Auto-name from filename if the user hasn't typed one yet.
    if (!name.trim()) {
      const stem = picked.name.replace(/\.[^.]+$/, "");
      setName(stem.slice(0, 120));
    }
  }

  function onDrop(e: React.DragEvent<HTMLLabelElement>) {
    e.preventDefault();
    setIsDragging(false);
    const dropped = e.dataTransfer.files?.[0] ?? null;
    handlePickFile(dropped);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (submitting) return;
    if (!name.trim()) {
      toast.error("Give your creative a name");
      return;
    }

    setSubmitting(true);
    try {
      // Resolve the final asset URL — either by uploading to Meta, or by
      // taking the user-pasted URL verbatim.
      let finalUrl: string;
      if (tab === "device") {
        if (!file) {
          toast.error("Pick a file to upload");
          setSubmitting(false);
          return;
        }
        const result = await api.uploadMetaImage(file);
        finalUrl = result.url;
      } else {
        if (!looksLikeUrl) {
          toast.error("Paste a public HTTPS URL to the asset");
          setSubmitting(false);
          return;
        }
        finalUrl = url.trim();
      }

      await api.createCreative({
        name: name.trim(),
        type,
        content: { url: finalUrl },
        aiGenerated: false,
      });
      toast.success("Creative added to your library");
      onSaved();
      onClose();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Upload failed";
      // Most common upload failure path: no Meta ad account connected. Give
      // a useful nudge instead of the raw API error.
      if (msg.toLowerCase().includes("no meta") || msg.toLowerCase().includes("ad account")) {
        toast.error(
          "Connect a Meta ad account first (Settings → Integrations), then try again — or use Paste URL instead"
        );
      } else {
        toast.error(msg);
      }
      setSubmitting(false);
    }
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-in">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <form
        onSubmit={handleSubmit}
        className="relative z-10 flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-slate-700 to-slate-900 shadow-sm">
              <Upload className="h-5 w-5 text-white" strokeWidth={2.25} />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">
                Upload Creative
              </h2>
              <p className="text-[11px] font-medium text-slate-500">
                Paste a public URL — we&apos;ll fetch the asset on demand
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
        <div className="space-y-5 overflow-y-auto px-6 py-5">
          {/* Type */}
          <div>
            <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-slate-600">
              Type
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setType("IMAGE")}
                className={clsx(
                  "flex items-center justify-center gap-2 rounded-xl border px-3 py-2.5 text-sm font-semibold transition",
                  type === "IMAGE"
                    ? "border-primary bg-primary/5 text-primary"
                    : "border-slate-200 bg-white text-slate-700 hover:border-slate-300"
                )}
              >
                <ImageIcon className="h-4 w-4" />
                Image
              </button>
              <button
                type="button"
                onClick={() => setType("VIDEO")}
                className={clsx(
                  "flex items-center justify-center gap-2 rounded-xl border px-3 py-2.5 text-sm font-semibold transition",
                  type === "VIDEO"
                    ? "border-primary bg-primary/5 text-primary"
                    : "border-slate-200 bg-white text-slate-700 hover:border-slate-300"
                )}
              >
                <Film className="h-4 w-4" />
                Video
              </button>
            </div>
          </div>

          {/* Source tabs */}
          <div>
            <div className="mb-2 flex items-center justify-between">
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-600">
                Source
              </label>
              {type === "VIDEO" && (
                <span className="text-[10px] font-semibold text-slate-400">
                  Device upload coming with Phase 1B
                </span>
              )}
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setTab("device")}
                disabled={type === "VIDEO"}
                className={clsx(
                  "flex items-center justify-center gap-2 rounded-xl border px-3 py-2 text-xs font-semibold transition",
                  tab === "device" && type !== "VIDEO"
                    ? "border-slate-900 bg-slate-900 text-white"
                    : "border-slate-200 bg-white text-slate-700 hover:border-slate-300",
                  type === "VIDEO" && "cursor-not-allowed opacity-50"
                )}
              >
                <Upload className="h-3.5 w-3.5" strokeWidth={2.5} />
                Upload from device
              </button>
              <button
                type="button"
                onClick={() => setTab("url")}
                className={clsx(
                  "flex items-center justify-center gap-2 rounded-xl border px-3 py-2 text-xs font-semibold transition",
                  tab === "url"
                    ? "border-slate-900 bg-slate-900 text-white"
                    : "border-slate-200 bg-white text-slate-700 hover:border-slate-300"
                )}
              >
                <Copy className="h-3.5 w-3.5" strokeWidth={2.5} />
                Paste URL
              </button>
            </div>
          </div>

          {/* Name */}
          <div>
            <label
              htmlFor="creative-name"
              className="mb-2 block text-xs font-bold uppercase tracking-wider text-slate-600"
            >
              Name
            </label>
            <input
              id="creative-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Summer sale hero — 1200x628"
              maxLength={120}
              className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm placeholder:text-slate-400 focus:border-primary focus:outline-none"
            />
          </div>

          {/* Source body — device picker OR URL input */}
          {tab === "device" ? (
            <div>
              <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-slate-600">
                Image file
              </label>
              {file && filePreviewUrl ? (
                <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-2">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={filePreviewUrl}
                    alt={file.name}
                    className="h-16 w-16 shrink-0 rounded-lg object-cover bg-slate-900"
                  />
                  <div className="min-w-0 flex-1 text-xs">
                    <div className="truncate font-semibold text-slate-700">
                      {file.name}
                    </div>
                    <div className="text-[10px] text-slate-500">
                      {(file.size / 1024).toFixed(0)} KB · {file.type}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setFile(null)}
                    className="shrink-0 rounded-lg px-2.5 py-1.5 text-[11px] font-semibold text-slate-600 transition hover:bg-slate-100 hover:text-slate-900"
                  >
                    Change
                  </button>
                </div>
              ) : (
                <label
                  htmlFor="creative-file"
                  onDragOver={(e) => {
                    e.preventDefault();
                    setIsDragging(true);
                  }}
                  onDragLeave={() => setIsDragging(false)}
                  onDrop={onDrop}
                  className={clsx(
                    "flex h-28 cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed bg-white transition",
                    isDragging
                      ? "border-primary bg-primary/5"
                      : "border-slate-300 hover:border-slate-400 hover:bg-slate-50"
                  )}
                >
                  <Upload className="h-5 w-5 text-slate-400" strokeWidth={1.75} />
                  <div className="text-sm font-semibold text-slate-700">
                    Drag &amp; drop or click to pick
                  </div>
                  <div className="text-[11px] text-slate-500">
                    JPEG / PNG / WebP / GIF · max 8 MB
                  </div>
                  <input
                    id="creative-file"
                    type="file"
                    accept={ACCEPTED_IMAGE_TYPES}
                    onChange={(e) => handlePickFile(e.target.files?.[0] ?? null)}
                    className="sr-only"
                  />
                </label>
              )}
              <p className="mt-1.5 text-[11px] text-slate-500">
                Uploaded to Meta&apos;s CDN and stored against your connected ad
                account. Meta hosts the file — we just keep the reference.
              </p>
            </div>
          ) : (
            <div>
              <label
                htmlFor="creative-url"
                className="mb-2 block text-xs font-bold uppercase tracking-wider text-slate-600"
              >
                {type === "VIDEO" ? "Video URL" : "Image URL"}
              </label>
              <input
                id="creative-url"
                type="url"
                value={url}
                onChange={(e) => {
                  setUrl(e.target.value);
                  setPreviewError(false);
                }}
                placeholder="https://example.com/asset.jpg"
                className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm placeholder:text-slate-400 focus:border-primary focus:outline-none"
              />
              <p className="mt-1.5 text-[11px] text-slate-500">
                Must be publicly reachable over HTTPS. Imgur, Cloudinary, your CDN,
                or a Meta-hosted image URL all work.
              </p>

              {/* Preview */}
              {looksLikeUrl && (
                <div className="mt-4">
                  <div className="mb-2 block text-xs font-bold uppercase tracking-wider text-slate-600">
                    Preview
                  </div>
                  <div className="overflow-hidden rounded-xl border border-slate-200 bg-slate-900">
                    {previewError ? (
                      <div className="flex aspect-video items-center justify-center text-xs text-slate-400">
                        Could not load preview — check the URL is public
                      </div>
                    ) : type === "VIDEO" ? (
                      <video
                        src={url}
                        controls
                        playsInline
                        preload="metadata"
                        onError={() => setPreviewError(true)}
                        className="aspect-video w-full bg-slate-900"
                      />
                    ) : (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={url}
                        alt="preview"
                        onError={() => setPreviewError(true)}
                        className="aspect-video w-full object-cover"
                      />
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 border-t border-slate-100 bg-slate-50/60 px-6 py-3">
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="rounded-xl px-3.5 py-2 text-sm font-semibold text-slate-600 transition hover:text-slate-900 disabled:opacity-60"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={
              submitting ||
              !name.trim() ||
              (tab === "url" ? !looksLikeUrl : !file)
            }
            className="inline-flex items-center gap-1.5 rounded-xl bg-slate-900 px-4 py-2 text-sm font-bold text-white shadow-sm transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300"
          >
            {submitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                {tab === "device" ? "Uploading…" : "Saving…"}
              </>
            ) : (
              <>
                <Upload className="h-4 w-4" strokeWidth={2.5} />
                Add to library
              </>
            )}
          </button>
        </div>
      </form>
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
function CreativeCard({
  c,
  onDeleted,
}: {
  c: Creative;
  onDeleted: () => void;
}) {
  const Icon = TYPE_ICON[c.type];
  const st = STATUS_META[c.status];
  const api = useApiClient();
  const [deleting, setDeleting] = useState(false);

  async function handleDelete(e: React.MouseEvent) {
    e.stopPropagation();
    if (deleting) return;
    if (
      typeof window !== "undefined" &&
      !window.confirm(`Delete "${c.name}"? This cannot be undone.`)
    ) {
      return;
    }
    setDeleting(true);
    try {
      await api.deleteCreative(c.id);
      toast.success("Creative deleted");
      onDeleted();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Delete failed");
      setDeleting(false);
    }
  }

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

        {/* Delete (hover) */}
        <button
          type="button"
          onClick={handleDelete}
          disabled={deleting}
          aria-label="Delete creative"
          title="Delete creative"
          className="absolute right-3 bottom-3 z-10 flex h-7 w-7 items-center justify-center rounded-lg bg-white/95 text-rose-600 opacity-0 shadow-sm ring-1 ring-rose-200 backdrop-blur transition group-hover:opacity-100 hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {deleting ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Trash2 className="h-3.5 w-3.5" />
          )}
        </button>

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

  // Uploaded image/video — render the real asset. Wrapped in a black bg so
  // letterboxed assets and slow loads look intentional instead of broken.
  if (creative.url && (creative.type === "IMAGE" || creative.type === "VIDEO")) {
    return (
      <div className="relative h-full w-full bg-slate-900">
        {creative.type === "VIDEO" ? (
          <>
            <video
              src={creative.url}
              muted
              playsInline
              preload="metadata"
              className="h-full w-full object-cover"
            />
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-white/95 shadow-xl">
                <Play
                  className="ml-0.5 h-5 w-5 text-slate-900"
                  fill="currentColor"
                  strokeWidth={0}
                />
              </div>
            </div>
          </>
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={creative.url}
            alt={creative.name}
            className="h-full w-full object-cover"
          />
        )}
      </div>
    );
  }

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
    "Advertix runs your campaigns 24/7 so you can focus on what actually grows the business. No more guessing.",
    "Teams using Advertix cut their CPA by 38% in the first 30 days. See why 12,000+ marketers made the switch.",
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
  onSave,
}: {
  open: boolean;
  onClose: () => void;
  onSave: (input: {
    type: CreativeType;
    platform: string;
    objective: string;
    content: Record<string, unknown>;
  }) => Promise<void>;
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
                Generate Ad Creative with Advertix AI
              </h2>
              <p className="text-[11px] font-medium text-slate-500">
                Powered by Advertix AI
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
                  onClick={async () => {
                    if (!result) return;
                    const typeMap: Record<CreativeKind, CreativeType> = {
                      image: "IMAGE",
                      video: "VIDEO",
                      carousel: "CAROUSEL",
                      text: "TEXT",
                    };
                    await onSave({
                      type: typeMap[kind],
                      platform,
                      objective,
                      content: { ...result, brief, tone },
                    });
                    onClose();
                  }}
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
