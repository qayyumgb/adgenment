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
  Check,
  Pencil,
  Save,
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
import { Modal, ModalHeader, ModalBody, ModalFooter } from "@/components/ui/Modal";
import { VideoThumbnailPlayer } from "@/components/ui/VideoThumbnailPlayer";

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
  /** Public asset URL — present for uploaded image/video creatives. For
   *  videos this is the Meta-hosted *thumbnail* (still image), not a
   *  streamable URL. Use `videoId` + the /meta/video-source endpoint to
   *  fetch a playable URL on demand. */
  url?: string;
  /** Meta video_id for device-uploaded videos. Use with the video-source
   *  endpoint to get a playable MP4 URL. */
  videoId?: string;
  /** Number of cards in a CAROUSEL creative. Drives the "+N cards" badge
   *  on the grid card preview. */
  cardCount?: number;
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

function extractVideoId(content: unknown): string | undefined {
  if (!content || typeof content !== "object") return undefined;
  const obj = content as Record<string, unknown>;
  return typeof obj.videoId === "string" ? obj.videoId : undefined;
}

function extractCardCount(content: unknown): number | undefined {
  if (!content || typeof content !== "object") return undefined;
  const obj = content as Record<string, unknown>;
  return Array.isArray(obj.cards) ? obj.cards.length : undefined;
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
    videoId: extractVideoId(c.content),
    cardCount: extractCardCount(c.content),
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

  // Map from creative id → raw API object, so the detail modal can render
  // the full generated copy (headlines, primary_texts, descriptions, CTAs).
  // mapApiCreative() flattens to a single `copy` string for the card preview.
  const rawById = useMemo(() => {
    const m = new Map<string, ApiCreative>();
    for (const r of creativesQ.data?.creatives ?? []) m.set(r.id, r);
    return m;
  }, [creativesQ.data]);

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
          {filtered.map((c) => {
            const raw = rawById.get(c.id);
            if (!raw) return null;
            return (
              <CreativeCard
                key={c.id}
                c={c}
                raw={raw}
                onDeleted={() => {
                  creativesQ.refetch();
                  statsQ.refetch();
                }}
                onUpdated={() => {
                  creativesQ.refetch();
                  statsQ.refetch();
                }}
              />
            );
          })}
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
const MAX_VIDEO_BYTES = 200 * 1024 * 1024; // Matches the API route's multer limit
const ACCEPTED_IMAGE_TYPES = "image/jpeg,image/jpg,image/png,image/webp,image/gif";
const ACCEPTED_VIDEO_TYPES = "video/mp4,video/quicktime,video/webm";

/**
 * Read width / height / duration off a picked video file by mounting an
 * off-DOM <video> with `preload="metadata"`. Cheap (only the moov atom is
 * fetched, not the bytes). Returns null on decode error so callers can fall
 * back to "unknown orientation" gracefully.
 *
 * We use this to (a) save the aspect ratio with the creative so the publish
 * wizard can later warn about placement mismatches and (b) drive the orient-
 * ation badge in the upload UI.
 */
async function readVideoMetadata(
  file: File
): Promise<{ width: number; height: number; duration: number } | null> {
  return new Promise((resolve) => {
    const video = document.createElement("video");
    video.preload = "metadata";
    video.muted = true;
    const objectUrl = URL.createObjectURL(file);
    const cleanup = () => URL.revokeObjectURL(objectUrl);
    video.onloadedmetadata = () => {
      const result = {
        width: video.videoWidth,
        height: video.videoHeight,
        duration: video.duration,
      };
      cleanup();
      resolve(
        result.width > 0 && result.height > 0 ? result : null
      );
    };
    video.onerror = () => {
      cleanup();
      resolve(null);
    };
    video.src = objectUrl;
  });
}

/**
 * Classify a video's aspect ratio into the placement bucket Meta supports.
 * Used in the upload UI (orientation badge) and at publish time (mismatch
 * warning when the user targets Reels with a 16:9 video).
 *
 *   ≥ 1.5  → "horizontal" (16:9 ish) — Feed eligible, NOT Reels/Stories
 *   ≥ 0.85 → "square"     (1:1 or 4:5) — Feed eligible
 *   < 0.85 → "vertical"   (9:16 ish) — Reels/Stories eligible
 */
type VideoOrientation = "horizontal" | "square" | "vertical";
function classifyOrientation(width: number, height: number): VideoOrientation {
  const ratio = width / height;
  if (ratio >= 1.5) return "horizontal";
  if (ratio >= 0.85) return "square";
  return "vertical";
}

type UploadTab = "device" | "url";

/** Single carousel card while the user is composing it in the upload
 *  modal OR editing it in the detail modal. `file` is a freshly picked
 *  image; `savedImageUrl` / `savedImageHash` are present when the card
 *  was already uploaded (edit mode). Headlines / descriptions / links
 *  are all optional — Meta falls back to the ad-level link + the card
 *  index when omitted. */
type CarouselCardDraft = {
  /** Stable ID for React keys — random because we splice cards in/out. */
  id: string;
  /** New file picked in this session. Mutually exclusive with savedImageUrl
   *  for *display* purposes (picking a file replaces the saved image). */
  file: File | null;
  filePreviewUrl: string | null;
  /** Pre-existing Meta-hosted URL (edit mode). Cleared when the user
   *  picks a new file. */
  savedImageUrl: string | null;
  /** Pre-existing Meta image_hash (edit mode). Preserved through save so
   *  cards without a new file don't get re-uploaded. */
  savedImageHash: string | null;
  headline: string;
  description: string;
  link: string;
};

function emptyCard(): CarouselCardDraft {
  return {
    id: cardId(),
    file: null,
    filePreviewUrl: null,
    savedImageUrl: null,
    savedImageHash: null,
    headline: "",
    description: "",
    link: "",
  };
}

/** Tiny non-crypto unique id — fine for React keys, not for anything else.
 *  Math.random in workflow scripts is forbidden but not in app code. */
function cardId(): string {
  return Math.random().toString(36).slice(2, 10);
}

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
  const [type, setType] = useState<"IMAGE" | "VIDEO" | "CAROUSEL">("IMAGE");
  // Carousel state — 2-10 cards, each with one image + optional headline/
  // description/link. Cards start with a single placeholder so the user
  // sees the shape; "Add card" pushes more until 10.
  const [cards, setCards] = useState<CarouselCardDraft[]>(() => [
    emptyCard(),
    emptyCard(),
  ]);
  // URL-paste mode
  const [url, setUrl] = useState("");
  const [previewError, setPreviewError] = useState(false);
  // File-pick mode
  const [file, setFile] = useState<File | null>(null);
  const [filePreviewUrl, setFilePreviewUrl] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  // Shared
  const [submitting, setSubmitting] = useState(false);
  // Video upload progress / Meta transcode polling state — only set during
  // a video submit. `phase` drives the spinner copy so users understand
  // *why* we're still spinning ("Uploading…" vs "Meta is processing…").
  const [uploadPct, setUploadPct] = useState(0);
  const [phase, setPhase] = useState<"upload" | "processing" | null>(null);
  // Probed dimensions of the picked video — used for the orientation badge
  // (so the user sees "Vertical · 9:16" vs "Horizontal · 16:9" before they
  // commit). Re-probed every time `file` changes.
  const [videoMeta, setVideoMeta] = useState<{
    width: number;
    height: number;
    duration: number;
    orientation: VideoOrientation;
  } | null>(null);

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
      setUploadPct(0);
      setPhase(null);
      setVideoMeta(null);
      setCards([emptyCard(), emptyCard()]);
    }
  }, [open]);

  // Object-URL lifecycle for carousel card previews. When a card's File
  // changes (picked, replaced, removed), we revoke the old object URL and
  // create a fresh one. Cleanup runs on modal close via the cards reset.
  useEffect(() => {
    return () => {
      cards.forEach((c) => {
        if (c.filePreviewUrl) URL.revokeObjectURL(c.filePreviewUrl);
      });
    };
    // We only want cleanup-on-unmount semantics — the per-card preview URL
    // is created at pick time and revoked at remove time, not in this effect.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

  // Probe video metadata as soon as a file is picked (only for VIDEO type).
  // The result hydrates the orientation badge in the upload card so users
  // can sanity-check aspect ratio *before* a 30-second Meta upload.
  useEffect(() => {
    if (!file || type !== "VIDEO") {
      setVideoMeta(null);
      return;
    }
    let cancelled = false;
    void readVideoMetadata(file).then((m) => {
      if (cancelled || !m) return;
      setVideoMeta({
        ...m,
        orientation: classifyOrientation(m.width, m.height),
      });
    });
    return () => {
      cancelled = true;
    };
  }, [file, type]);

  // Clear the picked file when the user flips IMAGE ↔ VIDEO so we never end
  // up with a JPEG selected while the type says VIDEO (and vice-versa).
  useEffect(() => {
    setFile(null);
  }, [type]);

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
    if (type === "IMAGE") {
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
    } else {
      if (!picked.type.startsWith("video/")) {
        toast.error("Pick a video file (MP4, MOV, or WebM)");
        return;
      }
      if (picked.size > MAX_VIDEO_BYTES) {
        toast.error(
          `Video is ${(picked.size / 1024 / 1024).toFixed(0)} MB — we cap device uploads at 200 MB. Host it yourself and use Paste URL instead.`
        );
        return;
      }
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
      // The shape we persist on the Creative row varies by asset type:
      //   - IMAGE: { url } — a hosted URL the publish wizard re-uploads to
      //     Meta on publish (image_hash is account-scoped so we don't cache).
      //   - VIDEO: { url, videoId, thumbnailUrl } — videoId is Meta's
      //     handle (account-scoped); the publish wizard uses it directly
      //     and skips re-upload. `url` is kept for the in-app preview.
      let content: Record<string, unknown>;

      if (type === "IMAGE") {
        if (tab === "device") {
          if (!file) {
            toast.error("Pick a file to upload");
            setSubmitting(false);
            return;
          }
          setPhase("upload");
          const result = await api.uploadMetaImage(file);
          content = { url: result.url };
        } else {
          if (!looksLikeUrl) {
            toast.error("Paste a public HTTPS URL to the asset");
            setSubmitting(false);
            return;
          }
          content = { url: url.trim() };
        }
      } else if (type === "CAROUSEL") {
        // CAROUSEL — for each card, upload its image to Meta's /adimages
        // and stash the hosted URL. We require a file per card (paste-URL
        // per card is deferred polish). Sequential uploads to stay on the
        // safe side of Meta's per-account rate limits.
        if (cards.length < 2) {
          toast.error("A carousel needs at least 2 cards");
          setSubmitting(false);
          return;
        }
        const missing = cards.findIndex(
          (c) => !c.file && !c.savedImageUrl
        );
        if (missing !== -1) {
          toast.error(`Pick an image for card ${missing + 1}`);
          setSubmitting(false);
          return;
        }
        setPhase("upload");
        const uploadedCards: Array<Record<string, unknown>> = [];
        for (const c of cards) {
          // Either a fresh file (upload it) or a saved card (preserve the
          // existing url + hash so we don't re-upload unchanged images).
          let url: string;
          let hash: string | undefined;
          if (c.file) {
            const result = await api.uploadMetaImage(c.file);
            url = result.url;
            hash = result.hash;
          } else {
            url = c.savedImageUrl!;
            hash = c.savedImageHash ?? undefined;
          }
          uploadedCards.push({
            url,
            imageUrl: url,
            ...(hash ? { imageHash: hash } : {}),
            headline: c.headline.trim() || undefined,
            description: c.description.trim() || undefined,
            link: c.link.trim() || undefined,
          });
        }
        // Persist the cards array. `url` on the top-level content is the
        // first card's image — used as the library card preview thumbnail.
        content = {
          url: (uploadedCards[0]?.url as string) ?? undefined,
          cards: uploadedCards,
        };
      } else {
        // VIDEO path — two flavors: device upload (file → /upload-video,
        // then poll transcode) and URL paste (defer upload to publish time
        // since we don't have Meta context at this point in the URL flow
        // we could trigger it server-side, but keeping it simple: pasted
        // URLs get re-uploaded when the user hits Publish).
        if (tab === "device") {
          if (!file) {
            toast.error("Pick a video to upload");
            setSubmitting(false);
            return;
          }
          // Probe the video locally for width/height before we ship the
          // bytes. Cheap (~1ms after the metadata atom arrives), and lets
          // us save the orientation server-side so the publish wizard can
          // later warn if placements + aspect ratio mismatch.
          const meta = await readVideoMetadata(file);
          setPhase("upload");
          setUploadPct(0);
          const uploaded = await api.uploadMetaVideo(file, {
            onProgress: (pct) => setUploadPct(pct),
          });
          // Poll for Meta's transcode to finish. Short videos take ~10-30s,
          // longer/4K can take a few minutes — we cap waiting at ~3 min.
          setPhase("processing");
          let thumbnailUrl: string | null = null;
          const startedAt = Date.now();
          const maxMs = 3 * 60 * 1000;
          while (true) {
            const probe = await api.getMetaVideoStatus(uploaded.id);
            if (probe.status === "ready") {
              thumbnailUrl = probe.thumbnailUrl;
              break;
            }
            if (probe.status === "error") {
              throw new Error("Meta failed to transcode this video");
            }
            if (Date.now() - startedAt > maxMs) {
              throw new Error(
                "Video is still processing on Meta — try again in a minute or use a smaller file"
              );
            }
            await new Promise((r) => setTimeout(r, 3000));
          }
          // Persistence note: we cannot store `filePreviewUrl` (blob: URL)
          // — those die when the page reloads. Meta's /advideos upload
          // doesn't give us a public streaming URL either, only the
          // `video_id` (used at publish time) and a thumbnail. So the
          // in-app preview becomes the thumbnail. The actual video is only
          // streamed when Meta serves the ad.
          content = {
            url: thumbnailUrl ?? undefined,
            videoId: uploaded.id,
            thumbnailUrl: thumbnailUrl ?? undefined,
            ...(meta
              ? {
                  videoWidth: meta.width,
                  videoHeight: meta.height,
                  videoDurationSec: Math.round(meta.duration),
                  videoOrientation: classifyOrientation(
                    meta.width,
                    meta.height
                  ),
                }
              : {}),
          };
        } else {
          if (!looksLikeUrl) {
            toast.error("Paste a public HTTPS URL to the video");
            setSubmitting(false);
            return;
          }
          // For URL paste we just save the URL — the publish wizard will
          // upload it to Meta + poll status at publish time.
          content = { url: url.trim() };
        }
      }

      await api.createCreative({
        name: name.trim(),
        type,
        content,
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
      setPhase(null);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="md"
      ariaLabel="Upload creative"
      closeOnBackdrop={!submitting}
      closeOnEscape={!submitting}
    >
      <form onSubmit={handleSubmit} className="contents">
        <ModalHeader>
          <div className="flex items-center gap-2.5">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-slate-700 to-slate-900 shadow-sm">
              <Upload className="h-5 w-5 text-white" strokeWidth={2.25} />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">
                Upload Creative
              </h2>
              <p className="text-[11px] font-medium text-slate-500">
                Image upload or paste a URL
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            disabled={submitting}
            className="flex h-9 w-9 items-center justify-center rounded-xl text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 disabled:opacity-50"
          >
            <X className="h-4 w-4" />
          </button>
        </ModalHeader>

        <ModalBody className="space-y-5">
          {/* Type */}
          <div>
            <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-slate-600">
              Type
            </label>
            <div className="grid grid-cols-3 gap-2">
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
              <button
                type="button"
                onClick={() => setType("CAROUSEL")}
                className={clsx(
                  "flex items-center justify-center gap-2 rounded-xl border px-3 py-2.5 text-sm font-semibold transition",
                  type === "CAROUSEL"
                    ? "border-primary bg-primary/5 text-primary"
                    : "border-slate-200 bg-white text-slate-700 hover:border-slate-300"
                )}
              >
                <Layers className="h-4 w-4" />
                Carousel
              </button>
            </div>
          </div>

          {/* Source tabs — hidden for CAROUSEL (device upload only at MVP) */}
          {type !== "CAROUSEL" && <div>
            <div className="mb-2 flex items-center justify-between">
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-600">
                Source
              </label>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setTab("device")}
                className={clsx(
                  "flex items-center justify-center gap-2 rounded-xl border px-3 py-2 text-xs font-semibold transition",
                  tab === "device"
                    ? "border-slate-900 bg-slate-900 text-white"
                    : "border-slate-200 bg-white text-slate-700 hover:border-slate-300"
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
          </div>}

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

          {/* Source body — device picker OR URL input — hidden for CAROUSEL */}
          {type !== "CAROUSEL" && (tab === "device" ? (
            <div>
              <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-slate-600">
                {type === "VIDEO" ? "Video file" : "Image file"}
              </label>
              {file && filePreviewUrl ? (
                <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-2">
                  {type === "VIDEO" ? (
                    <video
                      src={filePreviewUrl}
                      className="h-16 w-16 shrink-0 rounded-lg bg-slate-900 object-cover"
                      preload="metadata"
                      muted
                    />
                  ) : (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img
                      src={filePreviewUrl}
                      alt={file.name}
                      className="h-16 w-16 shrink-0 rounded-lg object-cover bg-slate-900"
                    />
                  )}
                  <div className="min-w-0 flex-1 text-xs">
                    <div className="truncate font-semibold text-slate-700">
                      {file.name}
                    </div>
                    <div className="text-[10px] text-slate-500">
                      {(file.size / 1024 / 1024).toFixed(2)} MB · {file.type}
                    </div>
                    {type === "VIDEO" && videoMeta && (
                      <div className="mt-1 flex items-center gap-1.5">
                        <span
                          className={clsx(
                            "inline-flex items-center rounded-full px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider",
                            videoMeta.orientation === "vertical"
                              ? "bg-purple-100 text-purple-800"
                              : videoMeta.orientation === "square"
                                ? "bg-amber-100 text-amber-800"
                                : "bg-sky-100 text-sky-800"
                          )}
                        >
                          {videoMeta.orientation === "vertical"
                            ? "Vertical · 9:16"
                            : videoMeta.orientation === "square"
                              ? "Square · 1:1"
                              : "Horizontal · 16:9"}
                        </span>
                        <span className="text-[10px] text-slate-400">
                          {videoMeta.width}×{videoMeta.height} ·{" "}
                          {Math.round(videoMeta.duration)}s
                        </span>
                      </div>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => setFile(null)}
                    disabled={submitting}
                    className="shrink-0 rounded-lg px-2.5 py-1.5 text-[11px] font-semibold text-slate-600 transition hover:bg-slate-100 hover:text-slate-900 disabled:opacity-50"
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
                    {type === "VIDEO"
                      ? "MP4 / MOV / WebM · max 200 MB"
                      : "JPEG / PNG / WebP / GIF · max 8 MB"}
                  </div>
                  <input
                    id="creative-file"
                    type="file"
                    accept={
                      type === "VIDEO"
                        ? ACCEPTED_VIDEO_TYPES
                        : ACCEPTED_IMAGE_TYPES
                    }
                    onChange={(e) => handlePickFile(e.target.files?.[0] ?? null)}
                    className="sr-only"
                  />
                </label>
              )}

              {/* Submit-time status — only meaningful for video (image upload
                  is fast enough to skip the meter). */}
              {submitting && type === "VIDEO" && phase && (
                <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
                  <div className="flex items-center gap-2 text-xs font-semibold text-slate-700">
                    <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
                    {phase === "upload"
                      ? `Uploading to Meta… ${uploadPct}%`
                      : "Meta is processing the video (transcoding)…"}
                  </div>
                  <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-200">
                    <div
                      className={clsx(
                        "h-full rounded-full bg-primary transition-all",
                        phase === "processing" && "animate-pulse"
                      )}
                      style={{
                        width:
                          phase === "upload"
                            ? `${uploadPct}%`
                            : "100%",
                      }}
                    />
                  </div>
                  <p className="mt-2 text-[10px] text-slate-500">
                    Short clips usually take 10–30s. Don&apos;t close this dialog.
                  </p>
                </div>
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
          ))}

          {/* Carousel cards editor — only when type=CAROUSEL */}
          {type === "CAROUSEL" && (
            <CarouselCardsEditor
              cards={cards}
              setCards={setCards}
              disabled={submitting}
            />
          )}
        </ModalBody>

        <ModalFooter>
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
              (type === "CAROUSEL"
                ? cards.length < 2 ||
                  cards.some((c) => !c.file && !c.savedImageUrl)
                : tab === "url"
                  ? !looksLikeUrl
                  : !file)
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
        </ModalFooter>
      </form>
    </Modal>
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

/**
 * Carousel cards editor — 2-10 ordered cards, each with one image + the
 * standard ad-card copy (headline, description, link). The headline is the
 * load-bearing field per card; description + link are optional. The ad-
 * level message + CTA come from the publish wizard (shared across cards),
 * so we don't ask for them here.
 *
 * UX shape: a vertical stack of card rows. Each row shows an image
 * dropzone + thumbnail on the left, the three text fields on the right.
 * "Add card" sits at the bottom (disabled at 10). Each card has its own
 * X to remove (disabled at 2).
 */
function CarouselCardsEditor({
  cards,
  setCards,
  disabled,
}: {
  cards: CarouselCardDraft[];
  setCards: React.Dispatch<React.SetStateAction<CarouselCardDraft[]>>;
  disabled: boolean;
}) {
  function patchCard(id: string, updates: Partial<CarouselCardDraft>) {
    setCards((prev) => prev.map((c) => (c.id === id ? { ...c, ...updates } : c)));
  }
  function removeCard(id: string) {
    setCards((prev) => {
      if (prev.length <= 2) return prev;
      const found = prev.find((c) => c.id === id);
      if (found?.filePreviewUrl) URL.revokeObjectURL(found.filePreviewUrl);
      return prev.filter((c) => c.id !== id);
    });
  }
  function addCard() {
    setCards((prev) => (prev.length >= 10 ? prev : [...prev, emptyCard()]));
  }
  function pickFile(id: string, file: File | null) {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Pick an image file (JPEG, PNG, WebP, GIF)");
      return;
    }
    if (file.size > MAX_IMAGE_BYTES) {
      toast.error(
        `Image is ${(file.size / 1024 / 1024).toFixed(1)} MB — Meta caps uploads at 8 MB`
      );
      return;
    }
    const url = URL.createObjectURL(file);
    setCards((prev) =>
      prev.map((c) => {
        if (c.id !== id) return c;
        if (c.filePreviewUrl) URL.revokeObjectURL(c.filePreviewUrl);
        // Picking a new file means the user is replacing the saved card
        // image — clear the savedImageUrl/Hash so the save path uploads
        // the new bytes rather than preserving the old reference.
        return {
          ...c,
          file,
          filePreviewUrl: url,
          savedImageUrl: null,
          savedImageHash: null,
        };
      })
    );
  }

  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <label className="block text-xs font-bold uppercase tracking-wider text-slate-600">
          Cards · {cards.length} of 10
        </label>
        <button
          type="button"
          onClick={addCard}
          disabled={disabled || cards.length >= 10}
          className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-700 transition hover:border-primary/40 hover:text-primary disabled:cursor-not-allowed disabled:opacity-50"
        >
          + Add card
        </button>
      </div>
      <p className="mb-3 text-[11px] text-slate-500">
        2–10 cards · square (1:1) images render best across Feed + Reels. The
        body copy and CTA come from the publish wizard and are shared across
        cards.
      </p>
      <ul className="space-y-2.5">
        {cards.map((card, idx) => (
          <li
            key={card.id}
            className="rounded-xl border border-slate-200 bg-white p-3"
          >
            <div className="mb-2 flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                Card {idx + 1}
              </span>
              <button
                type="button"
                onClick={() => removeCard(card.id)}
                disabled={disabled || cards.length <= 2}
                aria-label={`Remove card ${idx + 1}`}
                className="text-slate-400 transition hover:text-rose-600 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="flex gap-3">
              {/* Image picker — shows freshly-picked file OR previously
                  saved Meta-hosted image (edit mode). Click swaps either
                  with a new file. */}
              <div className="shrink-0">
                {card.filePreviewUrl || card.savedImageUrl ? (
                  <label className="block cursor-pointer">
                    <input
                      type="file"
                      accept={ACCEPTED_IMAGE_TYPES}
                      onChange={(e) =>
                        pickFile(card.id, e.target.files?.[0] ?? null)
                      }
                      className="hidden"
                      disabled={disabled}
                    />
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={card.filePreviewUrl ?? card.savedImageUrl ?? ""}
                      alt={`Card ${idx + 1}`}
                      className="h-20 w-20 rounded-lg object-cover ring-1 ring-slate-200"
                    />
                  </label>
                ) : (
                  <label
                    className={clsx(
                      "flex h-20 w-20 cursor-pointer flex-col items-center justify-center gap-0.5 rounded-lg border-2 border-dashed border-slate-300 bg-slate-50 text-center text-[10px] font-semibold text-slate-500 transition hover:border-primary/40 hover:bg-slate-100",
                      disabled && "pointer-events-none opacity-60"
                    )}
                  >
                    <input
                      type="file"
                      accept={ACCEPTED_IMAGE_TYPES}
                      onChange={(e) =>
                        pickFile(card.id, e.target.files?.[0] ?? null)
                      }
                      className="hidden"
                      disabled={disabled}
                    />
                    <Upload className="h-4 w-4 text-slate-400" />
                    Pick image
                  </label>
                )}
              </div>

              {/* Copy fields */}
              <div className="min-w-0 flex-1 space-y-1.5">
                <input
                  type="text"
                  value={card.headline}
                  onChange={(e) =>
                    patchCard(card.id, { headline: e.target.value })
                  }
                  maxLength={40}
                  placeholder="Headline (≤ 40 chars)"
                  disabled={disabled}
                  className="h-8 w-full rounded-md border border-slate-200 bg-white px-2 text-xs placeholder:text-slate-400 focus:border-primary focus:outline-none disabled:opacity-60"
                />
                <input
                  type="text"
                  value={card.description}
                  onChange={(e) =>
                    patchCard(card.id, { description: e.target.value })
                  }
                  maxLength={125}
                  placeholder="Description (optional)"
                  disabled={disabled}
                  className="h-8 w-full rounded-md border border-slate-200 bg-white px-2 text-xs placeholder:text-slate-400 focus:border-primary focus:outline-none disabled:opacity-60"
                />
                <input
                  type="url"
                  value={card.link}
                  onChange={(e) =>
                    patchCard(card.id, { link: e.target.value })
                  }
                  placeholder="Link URL (optional — falls back to ad link)"
                  disabled={disabled}
                  className="h-8 w-full rounded-md border border-slate-200 bg-white px-2 text-xs placeholder:text-slate-400 focus:border-primary focus:outline-none disabled:opacity-60"
                />
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * Read-only carousel preview shown in the Detail Modal when NOT editing.
 * Mirrors the shape of the editor (image left, copy stacked right) but
 * with no inputs, no replace controls — just the saved data.
 */
function CarouselDetailList({ cards }: { cards: CarouselCardDraft[] }) {
  if (cards.length === 0) {
    return (
      <div className="rounded-xl bg-slate-50 p-4 text-sm text-slate-500">
        This carousel has no cards saved yet.
      </div>
    );
  }
  return (
    <div>
      <div className="mb-2 text-xs font-bold uppercase tracking-wider text-slate-500">
        Cards · {cards.length}
      </div>
      <ul className="space-y-2.5">
        {cards.map((card, idx) => (
          <li
            key={card.id}
            className="flex gap-3 rounded-xl border border-slate-200 bg-white p-2.5"
          >
            <div className="shrink-0">
              {card.savedImageUrl ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                  src={card.savedImageUrl}
                  alt={`Card ${idx + 1}`}
                  className="h-20 w-20 rounded-lg object-cover ring-1 ring-slate-200"
                />
              ) : (
                <div className="flex h-20 w-20 items-center justify-center rounded-lg bg-slate-100 text-[10px] text-slate-400">
                  No image
                </div>
              )}
            </div>
            <div className="min-w-0 flex-1 space-y-0.5">
              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Card {idx + 1}
              </div>
              <div className="truncate text-sm font-semibold text-slate-900">
                {card.headline || (
                  <span className="font-normal italic text-slate-400">
                    No headline
                  </span>
                )}
              </div>
              {card.description && (
                <div className="line-clamp-2 text-xs text-slate-600">
                  {card.description}
                </div>
              )}
              {card.link && (
                <div className="truncate text-[11px] text-primary">
                  {card.link}
                </div>
              )}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ───────────────────────────────────────── */
function CreativeCard({
  c,
  raw,
  onDeleted,
  onUpdated,
}: {
  c: Creative;
  /** Original API creative — needed for the detail modal so we can show
   *  all generated copy fields (headlines, primary_texts, descriptions, ctas). */
  raw: ApiCreative;
  onDeleted: () => void;
  onUpdated: () => void;
}) {
  const Icon = TYPE_ICON[c.type];
  const st = STATUS_META[c.status];
  const api = useApiClient();
  const [deleting, setDeleting] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  // When the user clicks the pencil we open the same modal but with the
  // editable fields visible from the start. Reading the card → opening
  // read-only is the default.
  const [openInEditMode, setOpenInEditMode] = useState(false);

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
    <>
    <div
      onClick={() => setDetailOpen(true)}
      className="group cursor-pointer overflow-hidden rounded-2xl border border-slate-200/70 bg-white shadow-card transition hover:-translate-y-0.5 hover:shadow-card-hover"
    >
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

        {/* Hover actions — Edit + Delete, anchored bottom-right */}
        <div className="absolute right-3 bottom-3 z-10 flex items-center gap-1.5 opacity-0 transition group-hover:opacity-100">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setOpenInEditMode(true);
              setDetailOpen(true);
            }}
            aria-label="Edit creative"
            title="Edit creative"
            className="flex h-7 w-7 items-center justify-center rounded-lg bg-white/95 text-slate-700 shadow-sm ring-1 ring-slate-200 backdrop-blur transition hover:bg-slate-50 hover:text-primary"
          >
            <Pencil className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={handleDelete}
            disabled={deleting}
            aria-label="Delete creative"
            title="Delete creative"
            className="flex h-7 w-7 items-center justify-center rounded-lg bg-white/95 text-rose-600 shadow-sm ring-1 ring-rose-200 backdrop-blur transition hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {deleting ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Trash2 className="h-3.5 w-3.5" />
            )}
          </button>
        </div>

        {/* Type badge */}
        <span className="absolute left-3 top-3 inline-flex items-center gap-1 rounded-full bg-white/90 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-slate-700 shadow-sm backdrop-blur">
          <Icon className="h-2.5 w-2.5" />
          {c.type}
        </span>

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

    <CreativeDetailModal
      open={detailOpen}
      onClose={() => {
        setDetailOpen(false);
        setOpenInEditMode(false);
      }}
      creative={c}
      rawContent={raw.content}
      startInEditMode={openInEditMode}
      onSaved={onUpdated}
    />
    </>
  );
}

/* ───────────────────────────────────────── */
/* Creative Detail Modal                      */
/* ───────────────────────────────────────── */

function CreativeDetailModal({
  open,
  onClose,
  creative,
  rawContent,
  startInEditMode = false,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  creative: Creative;
  rawContent: unknown;
  /** If true, the modal opens with the edit fields visible. The pencil
   *  button on the card sets this; clicking the card body leaves it false. */
  startInEditMode?: boolean;
  /** Called after a successful save so the parent can refetch the list. */
  onSaved?: () => void;
}) {
  const api = useApiClient();
  const [editing, setEditing] = useState(startInEditMode);
  const [name, setName] = useState(creative.name);
  // For attaching an image to a copy-only creative. Mirrors the small subset
  // of state UploadCreativeModal manages — we don't need URL paste here;
  // device upload is enough.
  const [file, setFile] = useState<File | null>(null);
  const [filePreviewUrl, setFilePreviewUrl] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  // Video replacement flow for VIDEO creatives. When the user picks a new
  // file, we upload + poll on Save (same path as UploadCreativeModal); the
  // result swaps out videoId / thumbnailUrl on the creative content.
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [videoPct, setVideoPct] = useState(0);
  const [videoPhase, setVideoPhase] = useState<"upload" | "processing" | null>(null);
  // Carousel editing state — only used when creative.type === "CAROUSEL".
  // Initialized from rawContent.cards on open; each saved card becomes a
  // `CarouselCardDraft` with savedImageUrl/Hash so the editor can render
  // the existing image without re-uploading.
  const [carouselCards, setCarouselCards] = useState<CarouselCardDraft[]>([]);

  // Edit-mode copy state. We keep a local mutable copy of each variant array
  // so the user can tweak text inline without clobbering the original until
  // they hit Save. `picked` tracks which variant in each array the user wants
  // as the default — at save time we reorder so picked lands at index [0].
  const [edited, setEdited] = useState({
    headlines: [] as string[],
    primary_texts: [] as string[],
    descriptions: [] as string[],
    ctas: [] as string[],
  });
  const [picked, setPicked] = useState({
    headline: 0,
    primaryText: 0,
    description: 0,
    cta: 0,
  });

  // Reset local state every time the modal opens. Otherwise a previous
  // edit/attach can leak across creatives.
  useEffect(() => {
    if (open) {
      setEditing(startInEditMode);
      setName(creative.name);
      setFile(null);
      setVideoFile(null);
      setVideoPct(0);
      setVideoPhase(null);
      setSaving(false);
      // Snapshot the copy arrays from rawContent. If a field is missing or
      // malformed we fall back to [] so the section just renders empty.
      const c =
        rawContent && typeof rawContent === "object"
          ? (rawContent as Record<string, unknown>)
          : {};
      const asStringArr = (v: unknown): string[] =>
        Array.isArray(v) ? v.filter((s): s is string => typeof s === "string") : [];
      setEdited({
        headlines: asStringArr(c.headlines),
        primary_texts: asStringArr(c.primary_texts),
        descriptions: asStringArr(c.descriptions),
        ctas: asStringArr(c.ctas),
      });
      setPicked({ headline: 0, primaryText: 0, description: 0, cta: 0 });
      // Carousel: hydrate the editor draft list from saved card data.
      const savedCards = Array.isArray(c.cards) ? c.cards : [];
      setCarouselCards(
        savedCards.map((raw) => {
          const card = (raw ?? {}) as Record<string, unknown>;
          return {
            id: cardId(),
            file: null,
            filePreviewUrl: null,
            savedImageUrl:
              typeof card.imageUrl === "string"
                ? card.imageUrl
                : typeof card.url === "string"
                  ? card.url
                  : null,
            savedImageHash:
              typeof card.imageHash === "string" ? card.imageHash : null,
            headline:
              typeof card.headline === "string"
                ? card.headline
                : typeof card.name === "string"
                  ? card.name
                  : "",
            description:
              typeof card.description === "string" ? card.description : "",
            link: typeof card.link === "string" ? card.link : "",
          };
        })
      );
    }
  }, [open, startInEditMode, creative.name, rawContent]);

  // Object-URL lifecycle for the local file preview.
  useEffect(() => {
    if (!file) {
      setFilePreviewUrl(null);
      return;
    }
    const objUrl = URL.createObjectURL(file);
    setFilePreviewUrl(objUrl);
    return () => URL.revokeObjectURL(objUrl);
  }, [file]);

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
  }

  async function handleSave() {
    if (saving) return;
    const trimmed = name.trim();
    if (!trimmed) {
      toast.error("Name can't be empty");
      return;
    }
    // Strip empty lines after edit (a user can blank a chip to delete it).
    const cleaned = {
      headlines: edited.headlines.map((s) => s.trim()).filter(Boolean),
      primary_texts: edited.primary_texts.map((s) => s.trim()).filter(Boolean),
      descriptions: edited.descriptions.map((s) => s.trim()).filter(Boolean),
      ctas: edited.ctas.map((s) => s.trim()).filter(Boolean),
    };
    setSaving(true);
    try {
      // Build the new content payload. If the user attached an image,
      // upload it via Meta first and merge the resulting URL into whatever
      // copy fields the creative already has (so AI variants survive).
      const baseContent =
        rawContent && typeof rawContent === "object"
          ? (rawContent as Record<string, unknown>)
          : {};
      let nextContent: Record<string, unknown> = { ...baseContent };
      if (file) {
        const result = await api.uploadMetaImage(file);
        nextContent.url = result.url;
      }
      // Carousel — for each card, either upload its new file or preserve
      // the existing saved url + hash. Final shape mirrors what
      // UploadCreativeModal saves so the publish wizard reads them the
      // same way.
      if (creative.type === "CAROUSEL") {
        if (carouselCards.length < 2) {
          throw new Error("A carousel needs at least 2 cards");
        }
        const missing = carouselCards.findIndex(
          (c) => !c.file && !c.savedImageUrl
        );
        if (missing !== -1) {
          throw new Error(`Pick an image for card ${missing + 1}`);
        }
        const out: Array<Record<string, unknown>> = [];
        for (const c of carouselCards) {
          let url: string;
          let hash: string | undefined;
          if (c.file) {
            const result = await api.uploadMetaImage(c.file);
            url = result.url;
            hash = result.hash;
          } else {
            url = c.savedImageUrl!;
            hash = c.savedImageHash ?? undefined;
          }
          out.push({
            url,
            imageUrl: url,
            ...(hash ? { imageHash: hash } : {}),
            headline: c.headline.trim() || undefined,
            description: c.description.trim() || undefined,
            link: c.link.trim() || undefined,
          });
        }
        nextContent.cards = out;
        nextContent.url = (out[0]?.url as string) ?? nextContent.url;
      }

      // Video replacement — upload to /advideos, then poll transcode.
      // Same shape as UploadCreativeModal: persist videoId + thumbnailUrl,
      // with `url` pointing at the thumbnail for the in-app preview.
      if (videoFile) {
        setVideoPhase("upload");
        setVideoPct(0);
        const uploaded = await api.uploadMetaVideo(videoFile, {
          onProgress: (pct) => setVideoPct(pct),
        });
        setVideoPhase("processing");
        let newThumb: string | null = null;
        const startedAt = Date.now();
        const maxMs = 3 * 60 * 1000;
        while (true) {
          const probe = await api.getMetaVideoStatus(uploaded.id);
          if (probe.status === "ready") {
            newThumb = probe.thumbnailUrl;
            break;
          }
          if (probe.status === "error") {
            throw new Error("Meta failed to transcode the new video");
          }
          if (Date.now() - startedAt > maxMs) {
            throw new Error(
              "Video still processing — try again in a minute or use a smaller file"
            );
          }
          await new Promise((r) => setTimeout(r, 3000));
        }
        nextContent.videoId = uploaded.id;
        nextContent.thumbnailUrl = newThumb ?? undefined;
        nextContent.url = newThumb ?? nextContent.url;
        setVideoPhase(null);
      }
      // Reorder each array so the picked variant lands at index [0] —
      // this is what makes "picking a default" actually take effect when
      // the creative is used in the publish wizard later.
      if (cleaned.headlines.length)
        nextContent.headlines = pickFirst(cleaned.headlines, picked.headline);
      if (cleaned.primary_texts.length)
        nextContent.primary_texts = pickFirst(
          cleaned.primary_texts,
          picked.primaryText
        );
      if (cleaned.descriptions.length)
        nextContent.descriptions = pickFirst(
          cleaned.descriptions,
          picked.description
        );
      if (cleaned.ctas.length)
        nextContent.ctas = pickFirst(cleaned.ctas, picked.cta);

      await api.updateCreative(creative.id, {
        name: trimmed,
        content: nextContent,
      });
      toast.success("Creative updated");
      onSaved?.();
      setEditing(false);
      onClose();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Update failed";
      if (
        msg.toLowerCase().includes("no meta") ||
        msg.toLowerCase().includes("ad account")
      ) {
        toast.error(
          "Connect a Meta ad account first (Settings → Integrations) to attach an image"
        );
      } else {
        toast.error(msg);
      }
      setSaving(false);
      setVideoPhase(null);
    }
  }

  // Pluck the AI-generated copy arrays. If this isn't an AI creative, these
  // will all be undefined and the modal falls back to whatever it has.
  const copy =
    rawContent && typeof rawContent === "object"
      ? (rawContent as {
          headlines?: unknown;
          primary_texts?: unknown;
          descriptions?: unknown;
          ctas?: unknown;
        })
      : null;
  const headlines = Array.isArray(copy?.headlines)
    ? (copy!.headlines as string[]).filter((s) => typeof s === "string")
    : [];
  const primaryTexts = Array.isArray(copy?.primary_texts)
    ? (copy!.primary_texts as string[]).filter((s) => typeof s === "string")
    : [];
  const descriptions = Array.isArray(copy?.descriptions)
    ? (copy!.descriptions as string[]).filter((s) => typeof s === "string")
    : [];
  const ctas = Array.isArray(copy?.ctas)
    ? (copy!.ctas as string[]).filter((s) => typeof s === "string")
    : [];

  const hasCopy = Boolean(
    headlines.length || primaryTexts.length || descriptions.length || ctas.length
  );

  function copyToClipboard(text: string) {
    if (typeof navigator === "undefined" || !navigator.clipboard) {
      toast.error("Clipboard not available");
      return;
    }
    void navigator.clipboard.writeText(text).then(() => {
      toast.success("Copied");
    });
  }

  return (
    <Modal
      open={open}
      onClose={saving ? () => {} : onClose}
      size="lg"
      ariaLabel={creative.name}
      closeOnBackdrop={!saving}
      closeOnEscape={!saving}
    >
      <ModalHeader>
        <div className="min-w-0 flex-1">
          {editing ? (
            <div>
              <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-slate-500">
                Name
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Creative name"
                maxLength={120}
                disabled={saving}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-900 outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/15 disabled:opacity-60"
              />
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <h2 className="truncate text-base font-bold text-slate-900">
                {creative.name}
              </h2>
              {creative.aiGenerated && (
                <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-primary ring-1 ring-primary/20">
                  <Sparkles className="h-2.5 w-2.5" />
                  AI
                </span>
              )}
            </div>
          )}
          {!editing && (
            <p className="mt-0.5 text-[11px] font-medium text-slate-500">
              {creative.type} · created {creative.createdAt}
            </p>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-1">
          {!editing && (
            <button
              type="button"
              onClick={() => setEditing(true)}
              aria-label="Edit"
              title="Edit"
              className="flex h-9 items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 transition hover:border-primary/40 hover:text-primary"
            >
              <Pencil className="h-3.5 w-3.5" />
              Edit
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            disabled={saving}
            className="flex h-9 w-9 items-center justify-center rounded-xl text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 disabled:opacity-50"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </ModalHeader>

      <ModalBody className="space-y-5">
          {/* Media preview. Render priority by type:
              - CAROUSEL + editing → CarouselCardsEditor (replace, add, remove, reorder copy)
              - CAROUSEL + read mode → CarouselDetailList (horizontal cards)
              - VIDEO → interactive player (click to play)
              - IMAGE → static <img> */}
          {creative.type === "CAROUSEL" ? (
            editing ? (
              <CarouselCardsEditor
                cards={carouselCards}
                setCards={setCarouselCards}
                disabled={saving}
              />
            ) : (
              <CarouselDetailList cards={carouselCards} />
            )
          ) : creative.type === "VIDEO" && (creative.url || creative.videoId) ? (
            <div className="overflow-hidden rounded-xl border border-slate-200 bg-slate-900">
              <VideoThumbnailPlayer
                thumbnailUrl={creative.url ?? null}
                videoId={creative.videoId ?? null}
                alt={creative.name}
                className="aspect-video w-full"
                buttonSize="lg"
                showBadge={false}
              />
            </div>
          ) : creative.url ? (
            <div className="overflow-hidden rounded-xl border border-slate-200 bg-slate-900">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={creative.url}
                alt={creative.name}
                className="aspect-video w-full object-contain"
              />
            </div>
          ) : null}

          {/* Replace-video picker — only in edit mode for VIDEO creatives.
              Mirrors the upload + transcode flow from UploadCreativeModal
              but staged: nothing actually goes to Meta until the user clicks
              Save changes. */}
          {editing && creative.type === "VIDEO" && (
            <div>
              <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-slate-600">
                Replace video
              </label>
              {videoFile ? (
                <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-2">
                  <video
                    src={URL.createObjectURL(videoFile)}
                    className="h-16 w-16 shrink-0 rounded-lg bg-slate-900 object-cover"
                    preload="metadata"
                    muted
                  />
                  <div className="min-w-0 flex-1 text-xs">
                    <div className="truncate font-semibold text-slate-700">
                      {videoFile.name}
                    </div>
                    <div className="text-[10px] text-slate-500">
                      {(videoFile.size / 1024 / 1024).toFixed(2)} MB ·{" "}
                      {videoFile.type}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setVideoFile(null)}
                    disabled={saving}
                    className="shrink-0 rounded-lg px-2.5 py-1.5 text-[11px] font-semibold text-slate-600 transition hover:bg-slate-100 hover:text-slate-900 disabled:opacity-50"
                  >
                    Remove
                  </button>
                </div>
              ) : (
                <label
                  className={clsx(
                    "flex cursor-pointer flex-col items-center justify-center gap-1.5 rounded-xl border-2 border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-center transition hover:border-primary/40 hover:bg-slate-100",
                    saving && "pointer-events-none opacity-60"
                  )}
                >
                  <input
                    type="file"
                    accept={ACCEPTED_VIDEO_TYPES}
                    onChange={(e) => {
                      const picked = e.target.files?.[0];
                      if (!picked) return;
                      if (!picked.type.startsWith("video/")) {
                        toast.error("Pick a video file (MP4, MOV, WebM)");
                        return;
                      }
                      if (picked.size > MAX_VIDEO_BYTES) {
                        toast.error(
                          `Video is ${(picked.size / 1024 / 1024).toFixed(
                            0
                          )} MB — we cap at 200 MB`
                        );
                        return;
                      }
                      setVideoFile(picked);
                    }}
                    className="hidden"
                    disabled={saving}
                  />
                  <Upload className="h-5 w-5 text-slate-500" />
                  <p className="text-xs font-semibold text-slate-700">
                    Click to pick a new video
                  </p>
                  <p className="text-[11px] text-slate-500">
                    MP4 / MOV / WebM · up to 200 MB
                  </p>
                </label>
              )}

              {/* Live status row while saving. Same UI as UploadCreativeModal
                  so users see the same progress treatment whether they
                  upload a fresh video or replace an existing one. */}
              {saving && videoPhase && (
                <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
                  <div className="flex items-center gap-2 text-xs font-semibold text-slate-700">
                    <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
                    {videoPhase === "upload"
                      ? `Uploading replacement… ${videoPct}%`
                      : "Meta is processing the new video…"}
                  </div>
                  <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-200">
                    <div
                      className={clsx(
                        "h-full rounded-full bg-primary transition-all",
                        videoPhase === "processing" && "animate-pulse"
                      )}
                      style={{
                        width:
                          videoPhase === "upload" ? `${videoPct}%` : "100%",
                      }}
                    />
                  </div>
                </div>
              )}

              <p className="mt-2 text-[11px] text-slate-500">
                The old Meta video stays on Meta — replacing here points the
                creative at the new one for future campaigns.
              </p>
            </div>
          )}

          {/* Attach-image picker — shown in edit mode when no media exists. */}
          {editing && creative.type !== "VIDEO" && !creative.url && (
            <div>
              <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-slate-600">
                Attach image
              </label>
              {filePreviewUrl ? (
                <div className="relative overflow-hidden rounded-xl border border-slate-200">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={filePreviewUrl}
                    alt="New image preview"
                    className="aspect-video w-full object-cover"
                  />
                  <button
                    type="button"
                    onClick={() => setFile(null)}
                    disabled={saving}
                    aria-label="Remove image"
                    className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-lg bg-white/95 text-rose-600 shadow-sm ring-1 ring-rose-200 backdrop-blur transition hover:bg-rose-50 disabled:opacity-60"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              ) : (
                <label
                  className={clsx(
                    "flex cursor-pointer flex-col items-center justify-center gap-1.5 rounded-xl border-2 border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-center transition hover:border-primary/40 hover:bg-slate-100",
                    saving && "pointer-events-none opacity-60"
                  )}
                >
                  <input
                    type="file"
                    accept={ACCEPTED_IMAGE_TYPES}
                    onChange={(e) => handlePickFile(e.target.files?.[0] ?? null)}
                    className="hidden"
                    disabled={saving}
                  />
                  <Upload className="h-5 w-5 text-slate-500" />
                  <p className="text-xs font-semibold text-slate-700">
                    Click to pick an image
                  </p>
                  <p className="text-[11px] text-slate-500">
                    JPEG / PNG / WebP / GIF · up to 8 MB
                  </p>
                </label>
              )}
              <p className="mt-2 text-[11px] text-slate-500">
                The image is uploaded to your Meta ad account and attached to
                this creative so it can be used in a campaign.
              </p>
            </div>
          )}

          {/* Needs-an-image hint when AI copy creative has no upload yet
              and the user isn't already in edit mode. */}
          {!editing && !creative.url && creative.aiGenerated && hasCopy && (
            <div className="rounded-xl border border-amber-100 bg-amber-50/60 p-3 text-[12px] text-amber-900">
              <strong>Next step:</strong> click <strong>Edit</strong> above
              and attach an image. The copy below is ready to use when you
              launch the campaign.
            </div>
          )}

          {/* Helper banner when editing copy variants — keep users oriented. */}
          {editing && hasCopy && (
            <div className="rounded-xl border border-indigo-100 bg-indigo-50/60 p-3">
              <div className="flex items-start gap-2 text-[11px] leading-relaxed text-indigo-900">
                <Check
                  className="mt-0.5 h-3.5 w-3.5 shrink-0 text-indigo-600"
                  strokeWidth={3}
                />
                <p>
                  <strong>Tap a row to pick it as the default.</strong> Tap
                  the pencil to edit the text. The picked variant becomes
                  the default that pre-fills your next campaign — the rest
                  stay as swap options.
                </p>
              </div>
            </div>
          )}

          {/* AI-generated copy sections — flip to editable arrays in edit mode. */}
          {(editing ? edited.headlines : headlines).length > 0 && (
            <CopySection
              title="Headlines"
              hint="≤ 40 chars · pick the strongest"
              items={editing ? edited.headlines : headlines}
              onCopy={copyToClipboard}
              selectedIndex={editing ? picked.headline : undefined}
              onSelect={
                editing
                  ? (i) => setPicked((p) => ({ ...p, headline: i }))
                  : undefined
              }
              onEdit={
                editing
                  ? (i, next) =>
                      setEdited((e) => {
                        const arr = [...e.headlines];
                        arr[i] = next;
                        return { ...e, headlines: arr };
                      })
                  : undefined
              }
            />
          )}
          {(editing ? edited.primary_texts : primaryTexts).length > 0 && (
            <CopySection
              title="Primary text"
              hint="≤ 125 chars · the body of the ad"
              items={editing ? edited.primary_texts : primaryTexts}
              onCopy={copyToClipboard}
              selectedIndex={editing ? picked.primaryText : undefined}
              onSelect={
                editing
                  ? (i) => setPicked((p) => ({ ...p, primaryText: i }))
                  : undefined
              }
              onEdit={
                editing
                  ? (i, next) =>
                      setEdited((e) => {
                        const arr = [...e.primary_texts];
                        arr[i] = next;
                        return { ...e, primary_texts: arr };
                      })
                  : undefined
              }
            />
          )}
          {(editing ? edited.descriptions : descriptions).length > 0 && (
            <CopySection
              title="Descriptions"
              hint="Sub-headline shown under the headline"
              items={editing ? edited.descriptions : descriptions}
              onCopy={copyToClipboard}
              selectedIndex={editing ? picked.description : undefined}
              onSelect={
                editing
                  ? (i) => setPicked((p) => ({ ...p, description: i }))
                  : undefined
              }
              onEdit={
                editing
                  ? (i, next) =>
                      setEdited((e) => {
                        const arr = [...e.descriptions];
                        arr[i] = next;
                        return { ...e, descriptions: arr };
                      })
                  : undefined
              }
            />
          )}
          {(editing ? edited.ctas : ctas).length > 0 && (
            <CopySection
              title="Call-to-action"
              hint="Button label shown on the ad"
              items={editing ? edited.ctas : ctas}
              onCopy={copyToClipboard}
              selectedIndex={editing ? picked.cta : undefined}
              onSelect={
                editing
                  ? (i) => setPicked((p) => ({ ...p, cta: i }))
                  : undefined
              }
              onEdit={
                editing
                  ? (i, next) =>
                      setEdited((e) => {
                        const arr = [...e.ctas];
                        arr[i] = next;
                        return { ...e, ctas: arr };
                      })
                  : undefined
              }
            />
          )}

          {/* Fallback when there's nothing structured to show */}
          {!creative.url && !hasCopy && (
            <div className="rounded-xl bg-slate-50 p-4 text-sm text-slate-600">
              <p>
                This creative has no media uploaded and no generated copy
                attached. You can delete it and start over, or upload an image
                via <strong>Upload Creative</strong>.
              </p>
            </div>
          )}
      </ModalBody>

      {editing && (
        <ModalFooter>
          <button
            type="button"
            onClick={() => {
              // Cancel = revert local state to the snapshot taken on open.
              // We re-trigger the open effect by toggling editing off; the
              // file inputs and carousel-card edits already in local state
              // get blown away by setEditing(false) leading to nothing
              // mutating remotely. Re-init carousel cards from rawContent
              // so any inline text edits revert too.
              setEditing(false);
              setName(creative.name);
              setFile(null);
              setVideoFile(null);
              setVideoPhase(null);
              setVideoPct(0);
              const c =
                rawContent && typeof rawContent === "object"
                  ? (rawContent as Record<string, unknown>)
                  : {};
              const savedCards = Array.isArray(c.cards) ? c.cards : [];
              setCarouselCards(
                savedCards.map((raw) => {
                  const card = (raw ?? {}) as Record<string, unknown>;
                  return {
                    id: cardId(),
                    file: null,
                    filePreviewUrl: null,
                    savedImageUrl:
                      typeof card.imageUrl === "string"
                        ? card.imageUrl
                        : typeof card.url === "string"
                          ? card.url
                          : null,
                    savedImageHash:
                      typeof card.imageHash === "string"
                        ? card.imageHash
                        : null,
                    headline:
                      typeof card.headline === "string"
                        ? card.headline
                        : typeof card.name === "string"
                          ? card.name
                          : "",
                    description:
                      typeof card.description === "string"
                        ? card.description
                        : "",
                    link: typeof card.link === "string" ? card.link : "",
                  };
                })
              );
            }}
            disabled={saving}
            className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="btn-brand"
          >
            {saving ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Saving…
              </>
            ) : (
              <>
                <Save className="h-4 w-4" strokeWidth={2.5} />
                Save changes
              </>
            )}
          </button>
        </ModalFooter>
      )}
    </Modal>
  );
}

function CopySection({
  title,
  hint,
  items,
  onCopy,
  selectedIndex,
  onSelect,
  onEdit,
}: {
  title: string;
  hint: string;
  items: string[];
  onCopy: (text: string) => void;
  /** When provided, the section renders in "edit / pick" mode: rows are
   *  clickable to set the default, and a pencil reveals an inline editor. */
  selectedIndex?: number;
  onSelect?: (index: number) => void;
  onEdit?: (index: number, next: string) => void;
}) {
  const isEditMode = onSelect !== undefined && onEdit !== undefined;
  // Only one row at a time can be open for inline editing. Tracked locally
  // so the parent doesn't have to know about transient draft state.
  const [editingIdx, setEditingIdx] = useState<number | null>(null);
  const [draft, setDraft] = useState("");

  function commitEdit(i: number) {
    if (!onEdit) return;
    onEdit(i, draft);
    setEditingIdx(null);
  }
  function cancelEdit() {
    setEditingIdx(null);
    setDraft("");
  }

  return (
    <div>
      <div className="mb-2 flex items-baseline justify-between">
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">
          {title}
          {isEditMode && items.length > 0 && (
            <span className="ml-1.5 text-[10px] font-medium text-slate-400">
              · {items.length} options
            </span>
          )}
        </h3>
        <span className="text-[10px] font-medium text-slate-400">{hint}</span>
      </div>
      <ul className="space-y-1.5">
        {items.map((line, i) => {
          const isSelected = isEditMode && selectedIndex === i;
          const isInlineEditing = editingIdx === i;
          return (
            <li
              key={i}
              onClick={
                isEditMode && !isInlineEditing
                  ? () => onSelect?.(i)
                  : undefined
              }
              className={clsx(
                "group flex items-start justify-between gap-3 rounded-xl border px-3 py-2 transition",
                isEditMode && !isInlineEditing && "cursor-pointer",
                isSelected
                  ? "border-primary bg-primary/5 ring-1 ring-primary/20"
                  : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50"
              )}
            >
              {isInlineEditing ? (
                <input
                  type="text"
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      commitEdit(i);
                    } else if (e.key === "Escape") {
                      e.preventDefault();
                      cancelEdit();
                    }
                  }}
                  onClick={(e) => e.stopPropagation()}
                  autoFocus
                  className="flex-1 rounded-md border border-primary/40 bg-white px-2 py-1 text-sm leading-snug text-slate-900 outline-none ring-2 ring-primary/15"
                />
              ) : (
                <div className="flex flex-1 items-start gap-2">
                  {isEditMode && (
                    <span
                      className={clsx(
                        "mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2 transition",
                        isSelected
                          ? "border-primary bg-primary text-white"
                          : "border-slate-300 bg-white"
                      )}
                      aria-hidden
                    >
                      {isSelected && (
                        <Check className="h-2.5 w-2.5" strokeWidth={4} />
                      )}
                    </span>
                  )}
                  <p className="flex-1 text-sm leading-snug text-slate-800">
                    {line}
                  </p>
                </div>
              )}

              <div className="flex shrink-0 items-center gap-1">
                {isInlineEditing ? (
                  <>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        commitEdit(i);
                      }}
                      title="Save"
                      aria-label="Save edit"
                      className="flex h-7 w-7 items-center justify-center rounded-lg text-emerald-600 hover:bg-emerald-50"
                    >
                      <Check className="h-3.5 w-3.5" strokeWidth={3} />
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        cancelEdit();
                      }}
                      title="Cancel"
                      aria-label="Cancel edit"
                      className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </>
                ) : (
                  <>
                    {isEditMode && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setEditingIdx(i);
                          setDraft(line);
                        }}
                        className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 opacity-0 transition group-hover:opacity-100 hover:bg-white hover:text-primary"
                        aria-label={`Edit "${line}"`}
                        title="Edit"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onCopy(line);
                      }}
                      className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 opacity-0 transition group-hover:opacity-100 hover:bg-white hover:text-slate-700"
                      aria-label={`Copy "${line}"`}
                      title="Copy"
                    >
                      <Copy className="h-3.5 w-3.5" />
                    </button>
                  </>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function PreviewArea({ creative }: { creative: Creative }) {
  const Icon = TYPE_ICON[creative.type];

  // Copy-only creative (no media URL but we did generate text) — render the
  // copy as the preview instead of an empty image/video placeholder. Covers
  // AI-generated creatives where the user chose "Image Ad Copy" / "Carousel
  // Copy" — we have the headline + body but no image yet.
  if (
    !creative.url &&
    creative.copy &&
    (creative.type === "IMAGE" || creative.type === "VIDEO" || creative.type === "CAROUSEL")
  ) {
    return (
      <div
        className={clsx(
          "flex h-full w-full flex-col justify-between bg-gradient-to-br p-4",
          creative.gradient
        )}
      >
        <div className="flex items-center justify-between">
          <Icon className="h-6 w-6 text-white/60" strokeWidth={2} />
          <span className="rounded-full bg-white/20 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-white backdrop-blur">
            Needs {creative.type === "VIDEO" ? "video" : "image"}
          </span>
        </div>
        <p className="line-clamp-4 text-sm font-bold leading-snug text-white drop-shadow">
          “{creative.copy}”
        </p>
      </div>
    );
  }

  // Uploaded image/video — render the still asset. For video this is the
  // Meta thumbnail with a decorative play overlay; click-to-play is only
  // wired in the Detail Modal (so each grid card doesn't trigger a Meta
  // API call when the user opens the page).
  if (creative.url && (creative.type === "IMAGE" || creative.type === "VIDEO")) {
    return (
      <div className="relative h-full w-full bg-slate-900">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={creative.url}
          alt={creative.name}
          className="h-full w-full object-cover"
        />
        {creative.type === "VIDEO" && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/15">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-white/95 shadow-xl">
              <Play
                className="ml-0.5 h-5 w-5 text-slate-900"
                fill="currentColor"
                strokeWidth={0}
              />
            </div>
          </div>
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
    // Show the first card's image with a stacked-edges visual hint so the
    // grid card feels distinct from a single-image creative. The "+N more"
    // badge clarifies how many cards are behind the front one.
    const cardCount = creative.cardCount ?? 0;
    if (creative.url) {
      return (
        <div className="relative h-full w-full bg-slate-900">
          {/* Stack illusion — two faint rectangles peeking out behind. */}
          <div className="absolute right-1 top-1 bottom-1 left-3 rounded-md bg-white/10" />
          <div className="absolute right-2 top-2 bottom-2 left-2 rounded-md bg-white/15" />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={creative.url}
            alt={creative.name}
            className="absolute inset-0 h-full w-full rounded-none object-cover"
          />
          {cardCount > 1 && (
            <span className="absolute right-3 bottom-3 inline-flex items-center gap-1 rounded-full bg-slate-900/85 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white shadow-sm backdrop-blur">
              <Layers className="h-2.5 w-2.5" />
              {cardCount} cards
            </span>
          )}
        </div>
      );
    }
    // No images uploaded yet — fall back to the original gradient-stack.
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
  { value: "image", label: "Image Ad Copy" },
  { value: "video", label: "Video Script" },
  { value: "carousel", label: "Carousel Copy" },
  { value: "text", label: "Text Ad Copy" },
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
  // Index of the user's chosen variant within each result array. Defaults
  // to 0 (the AI is prompted to put the strongest variant first), but the
  // user can pick a different one before saving. The picked variant is then
  // moved to index 0 when saving so the publish wizard auto-fills with it.
  const [picked, setPicked] = useState({
    headline: 0,
    primaryText: 0,
    description: 0,
    cta: 0,
  });

  useEffect(() => {
    if (!open) {
      const t = setTimeout(() => {
        setBrief("");
        setResult(null);
        setLoading(false);
        setPicked({ headline: 0, primaryText: 0, description: 0, cta: 0 });
      }, 250);
      return () => clearTimeout(t);
    }
  }, [open]);

  // Reset picks whenever a fresh result lands.
  useEffect(() => {
    if (result) {
      setPicked({ headline: 0, primaryText: 0, description: 0, cta: 0 });
    }
  }, [result]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

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
    <Modal
      open={open}
      onClose={onClose}
      size="md"
      ariaLabel="Generate ad copy with AI"
    >
      <ModalHeader>
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 shadow-glow">
            <Sparkles className="h-4 w-4 text-white" strokeWidth={2.5} />
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-900">
              Generate Ad Copy with AI
            </h2>
            <p className="text-[11px] font-medium text-slate-500">
              Headlines, body &amp; CTAs — image upload separate
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
      </ModalHeader>

      <ModalBody className="space-y-4">
          {/* Honest disclaimer — we generate copy (text), not images. Image
              generation is bookmarked in FUTURE_FEATURES.md. */}
          <div className="rounded-xl border border-indigo-100 bg-indigo-50/60 p-3">
            <div className="flex items-start gap-2">
              <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-indigo-600" strokeWidth={2.5} />
              <p className="text-[11px] leading-relaxed text-indigo-900">
                <strong>What this generates:</strong> ad copy only — headlines,
                body text, descriptions, and CTAs. Upload your image or video
                separately via <strong>Upload Creative</strong> on the main page.
              </p>
            </div>
          </div>

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
              <div className="rounded-xl border border-indigo-100 bg-indigo-50/60 p-3">
                <div className="flex items-start gap-2 text-[11px] leading-relaxed text-indigo-900">
                  <Check
                    className="mt-0.5 h-3.5 w-3.5 shrink-0 text-indigo-600"
                    strokeWidth={3}
                  />
                  <p>
                    <strong>Tap any variant to pick it.</strong> The picked
                    one becomes the default when this creative is used in a
                    campaign — the rest are kept as swap options.
                  </p>
                </div>
              </div>

              <div className="border-t border-slate-100 pt-4">
                <h3 className="mb-2 text-xs font-bold uppercase tracking-wider text-slate-500">
                  Headlines · {result.headlines?.length ?? 0} options
                </h3>
                <ul className="space-y-1.5">
                  {result.headlines?.map((h, i) => (
                    <CopyItem
                      key={`h-${i}`}
                      text={h}
                      onCopy={copyToClipboard}
                      selected={picked.headline === i}
                      onSelect={() =>
                        setPicked((p) => ({ ...p, headline: i }))
                      }
                    />
                  ))}
                </ul>
              </div>

              <div>
                <h3 className="mb-2 text-xs font-bold uppercase tracking-wider text-slate-500">
                  Primary Texts · {result.primary_texts?.length ?? 0} options
                </h3>
                <ul className="space-y-1.5">
                  {result.primary_texts?.map((p, i) => (
                    <CopyItem
                      key={`p-${i}`}
                      text={p}
                      onCopy={copyToClipboard}
                      multiline
                      selected={picked.primaryText === i}
                      onSelect={() =>
                        setPicked((pp) => ({ ...pp, primaryText: i }))
                      }
                    />
                  ))}
                </ul>
              </div>

              {result.descriptions && result.descriptions.length > 0 && (
                <div>
                  <h3 className="mb-2 text-xs font-bold uppercase tracking-wider text-slate-500">
                    Descriptions · {result.descriptions.length} options
                  </h3>
                  <ul className="space-y-1.5">
                    {result.descriptions.map((d, i) => (
                      <CopyItem
                        key={`d-${i}`}
                        text={d}
                        onCopy={copyToClipboard}
                        selected={picked.description === i}
                        onSelect={() =>
                          setPicked((p) => ({ ...p, description: i }))
                        }
                      />
                    ))}
                  </ul>
                </div>
              )}

              <div>
                <h3 className="mb-2 text-xs font-bold uppercase tracking-wider text-slate-500">
                  CTAs · {result.ctas?.length ?? 0} options
                </h3>
                <div className="flex flex-wrap gap-2">
                  {result.ctas?.map((c, i) => {
                    const isPicked = picked.cta === i;
                    return (
                      <button
                        key={`c-${i}`}
                        type="button"
                        onClick={() =>
                          setPicked((p) => ({ ...p, cta: i }))
                        }
                        className={clsx(
                          "inline-flex items-center gap-1.5 rounded-full border-2 px-3.5 py-1.5 text-xs font-bold transition",
                          isPicked
                            ? "border-primary bg-primary text-white shadow-sm"
                            : "border-slate-200 bg-white text-slate-700 hover:border-primary/40 hover:text-primary"
                        )}
                      >
                        {isPicked && (
                          <Check className="h-3 w-3" strokeWidth={3} />
                        )}
                        {c}
                      </button>
                    );
                  })}
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
                    // Reorder each array so the user's picked variant lands
                    // at index [0]. The publish wizard auto-fills from [0],
                    // so this is what makes "pick a variant" actually stick
                    // when the creative gets used later.
                    const reordered = {
                      headlines: pickFirst(result.headlines, picked.headline),
                      primary_texts: pickFirst(
                        result.primary_texts,
                        picked.primaryText
                      ),
                      descriptions: pickFirst(
                        result.descriptions,
                        picked.description
                      ),
                      ctas: pickFirst(result.ctas, picked.cta),
                    };
                    await onSave({
                      type: typeMap[kind],
                      platform,
                      objective,
                      content: { ...reordered, brief, tone },
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
      </ModalBody>
    </Modal>
  );
}

/**
 * Return a copy of `arr` with the item at `idx` moved to position 0. Used
 * when saving an AI creative — the wizard auto-fills from index [0], so
 * putting the user's pick first makes the chosen variant the default.
 */
function pickFirst<T>(arr: T[] | undefined, idx: number): T[] {
  if (!arr || arr.length === 0) return [];
  if (idx <= 0 || idx >= arr.length) return arr;
  const out = [...arr];
  const [picked] = out.splice(idx, 1);
  out.unshift(picked);
  return out;
}

function CopyItem({
  text,
  onCopy,
  multiline,
  selected = false,
  onSelect,
}: {
  text: string;
  onCopy: (t: string) => void;
  multiline?: boolean;
  /** When true, this variant is the user's pick — gets a clear visual
   *  highlight + a checkmark icon. */
  selected?: boolean;
  /** Click the row (not the copy icon) to select. Stop-propagation on the
   *  copy icon keeps the two interactions cleanly separated. */
  onSelect?: () => void;
}) {
  return (
    <li
      className={clsx(
        "group flex cursor-pointer items-start gap-2 rounded-lg border-2 px-3 py-2 transition",
        selected
          ? "border-primary bg-primary/10 shadow-sm"
          : "border-slate-200 bg-slate-50/50 hover:border-primary/40 hover:bg-primary/[0.04]",
        multiline ? "items-start" : "items-center"
      )}
      onClick={onSelect}
    >
      <div
        className={clsx(
          "flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2 transition",
          selected
            ? "border-primary bg-primary text-white"
            : "border-slate-300 bg-white text-transparent group-hover:border-primary/60"
        )}
        aria-hidden
      >
        <Check className="h-2.5 w-2.5" strokeWidth={4} />
      </div>
      <p
        className={clsx(
          "flex-1 text-xs leading-relaxed",
          selected ? "font-semibold text-slate-900" : "text-slate-700"
        )}
      >
        {text}
      </p>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onCopy(text);
        }}
        aria-label="Copy"
        title="Copy to clipboard"
        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-slate-400 transition hover:bg-white hover:text-primary"
      >
        <Copy className="h-3.5 w-3.5" />
      </button>
    </li>
  );
}
