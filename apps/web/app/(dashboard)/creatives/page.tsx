"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import clsx from "clsx";
import toast from "react-hot-toast";
import {
  Sparkles,
  Upload,
  Search,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Image as ImageIcon,
  ImagePlus,
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
  Eye,
  EyeOff,
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
      // Name the creative after the AI-generated headline the user picked
      // (image/text: content.headlines[0]; carousel: first card's headline).
      // Fall back to the generic "AI image · META · date" label only when
      // no headline is present.
      const content = input.content as Record<string, unknown>;
      const headlines = content.headlines;
      const cards = content.cards;
      const pickedHeadline =
        (Array.isArray(headlines) &&
          typeof headlines[0] === "string" &&
          headlines[0].trim()) ||
        (Array.isArray(cards) &&
          cards[0] &&
          typeof (cards[0] as Record<string, unknown>).headline === "string" &&
          ((cards[0] as Record<string, unknown>).headline as string).trim()) ||
        "";
      const cleanHeadline = headlineToName(pickedHeadline);
      const name =
        cleanHeadline.length > 0
          ? cleanHeadline
          : `AI ${input.type.toLowerCase()} · ${input.platform} · ${new Date().toLocaleDateString()}`;
      await apiClient.createCreative({
        name,
        type: input.type,
        content: input.content,
        aiGenerated: true,
      });
      // Carousel-specific toast — the user needs to know they have to
      // upload images per card before this is publishable. For image /
      // video / text creatives the standard "saved" message is fine.
      if (
        input.type === "CAROUSEL" &&
        Array.isArray(
          (input.content as Record<string, unknown>).cards
        )
      ) {
        toast.success(
          "Carousel saved — open it to upload one image per card",
          { duration: 5000 }
        );
      } else {
        toast.success("Creative saved to your library");
      }
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

  // Detect video-hosting page URLs (YouTube, Vimeo, TikTok, etc.) so we can
  // refuse them up-front with a clear message. None of these expose a
  // direct media file at the page URL — they serve an HTML player — so
  // both <video src> and Meta's /advideos endpoint will fail. The user
  // either uploads from device or pastes a direct .mp4/.mov/.webm URL.
  const hostedVideoPagePattern =
    /(?:youtube\.com|youtu\.be|vimeo\.com|tiktok\.com|dailymotion\.com|twitch\.tv|facebook\.com\/watch|instagram\.com\/reel)/i;
  const isHostedVideoPage =
    type === "VIDEO" && tab === "url" && hostedVideoPagePattern.test(url);

  // Live validation of the pasted URL — kicks off a probe whenever the URL
  // changes (debounced). For video we mount a hidden <video preload=metadata>
  // and wait for `loadedmetadata` (ok) or `error` (broken). For image we
  // do the same with an Image() object. Drives the inline status pill and
  // gates the submit button — a probed-broken URL can't be saved.
  type UrlStatus = "idle" | "validating" | "ok" | "error";
  const [urlStatus, setUrlStatus] = useState<UrlStatus>("idle");
  useEffect(() => {
    if (tab !== "url" || !looksLikeUrl || isHostedVideoPage) {
      setUrlStatus("idle");
      return;
    }
    setUrlStatus("validating");
    let cancelled = false;
    const debounce = setTimeout(() => {
      if (type === "VIDEO") {
        const probe = document.createElement("video");
        probe.preload = "metadata";
        probe.muted = true;
        probe.crossOrigin = "anonymous";
        probe.onloadedmetadata = () => {
          if (cancelled) return;
          // Sanity check: a real video has non-zero dimensions. Some HTML
          // pages served as application/octet-stream load enough bytes
          // for `loadedmetadata` to fire on a malformed stream.
          if (probe.videoWidth > 0 && probe.videoHeight > 0) {
            setUrlStatus("ok");
          } else {
            setUrlStatus("error");
          }
        };
        probe.onerror = () => {
          if (!cancelled) setUrlStatus("error");
        };
        probe.src = url;
      } else {
        const probe = new Image();
        probe.onload = () => {
          if (cancelled) return;
          if (probe.naturalWidth > 0 && probe.naturalHeight > 0) {
            setUrlStatus("ok");
          } else {
            setUrlStatus("error");
          }
        };
        probe.onerror = () => {
          if (!cancelled) setUrlStatus("error");
        };
        probe.src = url;
      }
    }, 400);
    return () => {
      cancelled = true;
      clearTimeout(debounce);
    };
  }, [url, type, tab, looksLikeUrl, isHostedVideoPage]);

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
                placeholder={
                  type === "VIDEO"
                    ? "https://your-cdn.com/clip.mp4"
                    : "https://example.com/asset.jpg"
                }
                className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm placeholder:text-slate-400 focus:border-primary focus:outline-none"
              />
              <p className="mt-1.5 text-[11px] text-slate-500">
                {type === "VIDEO" ? (
                  <>
                    Must be a <strong>direct video file URL</strong> ending
                    in .mp4, .mov, or .webm — hosted on your CDN, S3,
                    Cloudflare R2, etc. YouTube / Vimeo / TikTok page links
                    won&apos;t work (they serve a web player, not a
                    downloadable video).
                  </>
                ) : (
                  <>
                    Must be publicly reachable over HTTPS. Imgur, Cloudinary,
                    your CDN, or a Meta-hosted image URL all work.
                  </>
                )}
              </p>

              {/* Live URL status pill — visible whenever a syntactically
                  valid URL is being probed or has been classified. */}
              {looksLikeUrl && !isHostedVideoPage && urlStatus !== "idle" && (
                <div className="mt-2 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold">
                  {urlStatus === "validating" && (
                    <span className="inline-flex items-center gap-1.5 text-slate-500">
                      <Loader2 className="h-3 w-3 animate-spin" />
                      Checking URL…
                    </span>
                  )}
                  {urlStatus === "ok" && (
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2 py-0.5 text-emerald-700 ring-1 ring-emerald-200">
                      <Check className="h-3 w-3" strokeWidth={3} />
                      URL looks good — {type === "VIDEO" ? "video" : "image"}
                      {" loaded"}
                    </span>
                  )}
                  {urlStatus === "error" && (
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-rose-50 px-2 py-0.5 text-rose-700 ring-1 ring-rose-200">
                      <X className="h-3 w-3" strokeWidth={3} />
                      Can&apos;t load — not a public {type === "VIDEO" ? "video" : "image"} file
                    </span>
                  )}
                </div>
              )}

              {/* YouTube / Vimeo / TikTok detection — fail fast with a
                  clear message instead of letting <video src> silently
                  flop into the generic "Could not load preview". */}
              {isHostedVideoPage && (
                <div className="mt-3 flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50/70 p-3 text-[12px] leading-relaxed text-amber-900">
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    className="mt-0.5 h-3.5 w-3.5 shrink-0"
                    aria-hidden
                  >
                    <path d="M12 9v4M12 17h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
                  </svg>
                  <div>
                    <strong>That&apos;s a page URL, not a video file.</strong>{" "}
                    YouTube / Vimeo / TikTok don&apos;t expose direct downloads
                    — Meta can&apos;t fetch the video from a page link.
                    <br />
                    Use <strong>Upload from device</strong> instead, or paste a
                    direct <code>.mp4</code> URL from your own CDN.
                  </div>
                </div>
              )}

              {/* Preview — skipped for known page URLs above. */}
              {looksLikeUrl && !isHostedVideoPage && (
                <div className="mt-4">
                  <div className="mb-2 block text-xs font-bold uppercase tracking-wider text-slate-600">
                    Preview
                  </div>
                  <div className="overflow-hidden rounded-xl border border-slate-200 bg-slate-900">
                    {previewError ? (
                      <div className="flex aspect-video items-center justify-center text-xs text-slate-400">
                        Could not load preview — check the URL is public and
                        points to a direct file
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

          {/* Carousel cards editor — only when type=CAROUSEL. Brief is
              piped through as the creative name so the AI image-generation
              button has some campaign context to work with. */}
          {type === "CAROUSEL" && (
            <CarouselCardsEditor
              cards={cards}
              setCards={setCards}
              disabled={submitting}
              brief={name}
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
                  ? !looksLikeUrl ||
                    isHostedVideoPage ||
                    urlStatus === "validating" ||
                    urlStatus === "error"
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
  brief,
}: {
  cards: CarouselCardDraft[];
  setCards: React.Dispatch<React.SetStateAction<CarouselCardDraft[]>>;
  disabled: boolean;
  brief?: string;
}) {
  const api = useApiClient();
  const [generatingCardId, setGeneratingCardId] = useState<string | null>(null);

  async function generateImage(card: CarouselCardDraft) {
    if (generatingCardId) return;
    setGeneratingCardId(card.id);
    try {
      const result = await api.generateAdImage({
        brief: brief || undefined,
        headline: card.headline.trim() || undefined,
        description: card.description.trim() || undefined,
      });
      setCards((prev) =>
        prev.map((c) => {
          if (c.id !== card.id) return c;
          if (c.filePreviewUrl) URL.revokeObjectURL(c.filePreviewUrl);
          return {
            ...c,
            savedImageUrl: result.url,
            savedImageHash: result.hash,
            file: null,
            filePreviewUrl: null,
          };
        })
      );
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Image generation failed"
      );
    } finally {
      setGeneratingCardId(null);
    }
  }

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
                  with a new file. Below empty slots: "Generate with AI"
                  shortcut that calls Gemini + uploads to Meta. */}
              <div className="shrink-0">
                {generatingCardId === card.id ? (
                  <div className="flex h-20 w-20 flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed border-primary/30 bg-primary/5">
                    <Loader2 className="h-5 w-5 animate-spin text-primary" />
                    <span className="text-[9px] font-semibold text-primary">
                      Generating…
                    </span>
                  </div>
                ) : card.filePreviewUrl || card.savedImageUrl ? (
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
                  <div className="flex flex-col gap-1">
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
                    {/* AI image generation — Gemini needs at least ONE of
                        brief / headline / description (backend validation).
                        We show the button as soon as any of those is set
                        so the user always has the option. */}
                    {(brief?.trim() ||
                      card.headline.trim() ||
                      card.description.trim()) && (
                      <button
                        type="button"
                        onClick={() => generateImage(card)}
                        disabled={disabled || !!generatingCardId}
                        title="Generate this card's image with AI (Gemini)"
                        className="inline-flex w-20 items-center justify-center gap-0.5 rounded-md border border-primary/30 bg-primary/5 px-1 py-0.5 text-[9px] font-semibold text-primary transition hover:bg-primary/10 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        <Sparkles className="h-2.5 w-2.5" />
                        AI image
                      </button>
                    )}
                  </div>
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
                brief={creative.name}
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
                  ? (i) => {
                      // Selecting a headline makes it the creative's name —
                      // the title in the library follows the chosen headline.
                      setPicked((p) => ({ ...p, headline: i }));
                      const h = headlineToName(edited.headlines[i] ?? "");
                      if (h) setName(h);
                    }
                  : undefined
              }
              onEdit={
                editing
                  ? (i, next) => {
                      setEdited((e) => {
                        const arr = [...e.headlines];
                        arr[i] = next;
                        return { ...e, headlines: arr };
                      });
                      // Editing the currently-selected headline keeps the
                      // name in sync as the user types.
                      if (i === picked.headline) {
                        const h = headlineToName(next);
                        if (h) setName(h);
                      }
                    }
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
  // Image / video / text creatives return all four arrays.
  headlines?: string[];
  primary_texts: string[];
  descriptions?: string[];
  ctas: string[];
  /** Carousel creatives return a `cards` array (length 2-5) instead of
   *  flat headlines/descriptions. Each card has its own per-card copy;
   *  the user uploads one image per card later (via Edit) to complete
   *  the creative. */
  cards?: Array<{ headline: string; description?: string }>;
};

const TONE_OPTIONS: { value: Tone; label: string }[] = [
  { value: "professional", label: "Professional" },
  { value: "playful", label: "Playful" },
  { value: "urgent", label: "Urgent" },
  { value: "inspirational", label: "Inspirational" },
];

/** Aspect-ratio chip on the AI Generate prompt input. Drives image
 *  generation (Gemini) — square fits Feed, portrait fits Reels/Stories,
 *  landscape fits Feed video / display. */
type AspectRatio = "square" | "portrait" | "landscape";
const ASPECT_OPTIONS: {
  value: AspectRatio;
  label: string;
  hint: string;
}[] = [
  { value: "square", label: "Square", hint: "1:1 · Feed" },
  { value: "portrait", label: "Portrait", hint: "9:16 · Reels / Stories" },
  { value: "landscape", label: "Landscape", hint: "16:9 · Video / Display" },
];

/** Output-count chip. Controls how many parallel copy + image variants
 *  the AI generates per click. 3 is the practical cap — beyond that the
 *  free Gemini quota dries fast and the result panel gets noisy. */
const OUTPUT_OPTIONS: { value: 1 | 2 | 3; label: string }[] = [
  { value: 1, label: "1 output" },
  { value: 2, label: "2 outputs" },
  { value: 3, label: "3 outputs" },
];

/** Curated starter briefs the user can drop into the prompt field with one
 *  click. Picked from the most-common SMB ad archetypes — each is enough
 *  of a seed that the AI can produce a usable creative even before the
 *  user customizes. Tone + audience hints are baked in. */
/**
 * Starter prompts for the AI Generate brief. These are intentionally
 * detailed, structured templates — the user picks one, edits the
 * [BRACKETED PLACEHOLDERS] to fit their product/offer, and sends. The brief
 * drives BOTH copy generation (product / audience / offer / tone) AND the
 * image (the "Visual direction:" block becomes the image context). They're
 * written for text-to-image generation — we don't composite an uploaded
 * product photo yet, so the visual direction describes a scene to render
 * rather than a product to place. Anything in [brackets] is meant to be
 * replaced.
 */
const PROMPT_TEMPLATES: { label: string; brief: string }[] = [
  {
    label: "E-commerce product + sale",
    brief: [
      "Promote [PRODUCT] to [AUDIENCE — e.g. \"women 25–40 who shop sustainable brands\"].",
      "",
      "Goal: drive sales.",
      "Key benefit: [the #1 reason to buy — e.g. \"lasts 3× longer than the alternatives\"].",
      "Offer: [e.g. \"sitewide sale, 20% off, free shipping over $50, ends Sunday\"].",
      "Tone: [e.g. confident and warm].",
      "",
      "Visual direction: photo-realistic shot of [PRODUCT] [in/on SETTING — e.g. \"a sunlit modern kitchen counter\"]. Natural lighting, realistic shadows and reflections, shallow depth of field, premium e-commerce look. No text, logos, or watermarks in the image.",
    ].join("\n"),
  },
  {
    label: "SaaS free-trial signup",
    brief: [
      "Promote a free [14-day] trial of [PRODUCT], a [one line on what it does] for [AUDIENCE — e.g. \"small-business owners\"].",
      "",
      "Goal: trial signups.",
      "Key benefit: [e.g. \"cut reporting from hours to minutes\"].",
      "Proof: [e.g. \"used by 12,000+ teams\", \"no credit card required\"].",
      "Tone: [e.g. clear and credible, no hype].",
      "",
      "Visual direction: clean, modern lifestyle scene of [WHO] using a laptop or phone in [SETTING — e.g. \"a bright, uncluttered workspace\"]. Realistic lighting, professional, aspirational. No UI screenshots, text, or logos in the image.",
    ].join("\n"),
  },
  {
    label: "DTC product launch",
    brief: [
      "Launch [PRODUCT] to first-time buyers [aged 25–40].",
      "",
      "Goal: launch-week sales.",
      "Hero feature: [e.g. \"clinically tested, visible results in 2 weeks\"].",
      "Social proof: [e.g. \"5,000+ on the waitlist\", \"rated 4.8/5\"].",
      "Offer: [e.g. \"15% off launch week only\"].",
      "Tone: [e.g. fresh, bold, premium].",
      "",
      "Visual direction: striking hero shot of [PRODUCT] in [STYLE/SETTING — e.g. \"a minimalist studio with a soft gradient backdrop\"]. Crisp focus, balanced commercial lighting, brand-forward. No text or logos in the image.",
    ].join("\n"),
  },
  {
    label: "Local service lead-gen",
    brief: [
      "Generate leads for [BUSINESS — e.g. \"a home HVAC service\"] targeting homeowners within [25 miles] of [CITY/AREA].",
      "",
      "Goal: free-quote requests and calls.",
      "Why trust us: [e.g. \"licensed & insured, same-week availability, 5-star reviews\"].",
      "Offer: [e.g. \"free, no-obligation quote\"].",
      "Tone: [e.g. friendly, trustworthy, local].",
      "",
      "Visual direction: authentic real-world photo of [the service in action — e.g. \"a friendly technician at a customer's doorstep\"] in [SETTING]. Well-lit and approachable, not staged or stocky. No text or logos in the image.",
    ].join("\n"),
  },
  {
    label: "Food / café / restaurant",
    brief: [
      "Promote [DISH / MENU / OFFER] at [VENUE — e.g. \"a cozy neighborhood café\"] to [AUDIENCE — e.g. \"locals and weekend brunch-goers\"].",
      "",
      "Goal: [foot traffic / online orders / bookings].",
      "Key appeal: [e.g. \"freshly roasted, made to order\"].",
      "Offer: [e.g. \"buy-one-get-one before 10am\"].",
      "Tone: [e.g. warm, inviting, sensory].",
      "",
      "Visual direction: appetizing, photo-realistic shot of [DISH/DRINK] on [SURFACE — e.g. \"a rustic wooden table in soft morning light\"]. Rich color, natural shadows, mouth-watering detail, food-photography quality. No text or logos in the image.",
    ].join("\n"),
  },
  {
    label: "Webinar / event signup",
    brief: [
      "Fill seats for [a free webinar / event] on [TOPIC] aimed at [AUDIENCE — e.g. \"marketing professionals\"].",
      "",
      "Goal: registrations.",
      "Hook: [speaker or takeaway — e.g. \"led by [EXPERT]; 3 tactics you can apply the same day\"].",
      "Proof: [e.g. \"live Q&A, recording sent to all registrants\"].",
      "Tone: [e.g. credible and energetic].",
      "",
      "Visual direction: professional, modern scene suggesting [TOPIC — e.g. \"a confident speaker on stage\" or \"a focused professional at a laptop\"] in [SETTING]. Clean, aspirational, well-lit. No text or logos in the image.",
    ].join("\n"),
  },
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
  const api = useApiClient();
  const [brief, setBrief] = useState("");
  const [platform, setPlatform] = useState<Platform>("META");
  const [objective, setObjective] = useState<string>("Conversions");
  const [kind, setKind] = useState<CreativeKind>("image");
  const [tone, setTone] = useState<Tone>("professional");
  const [aspect, setAspect] = useState<AspectRatio>("square");
  const [outputs, setOutputs] = useState<1 | 2 | 3>(1);
  const [templatesOpen, setTemplatesOpen] = useState(false);
  // Carousel card count — only meaningful when kind === "carousel". Range
  // is 2-5 (Meta supports up to 10, but more cards → longer AI prompts →
  // weaker per-card quality. 5 is the sweet spot for narrative + completion.)
  const [cardCount, setCardCount] = useState(4);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<CopyResult | null>(null);
  // Editable working copy — the displayed values for headlines / texts /
  // descriptions / CTAs. Initialized from `result` on every fresh
  // generation; inline edits update this state without touching the raw
  // AI response. Save uses these values.
  const [edited, setEdited] = useState<{
    headlines: string[];
    primary_texts: string[];
    descriptions: string[];
    ctas: string[];
  }>({ headlines: [], primary_texts: [], descriptions: [], ctas: [] });
  // Index of the user's chosen variant within each edited array. Defaults
  // to 0 (the AI is prompted to put the strongest variant first), but the
  // user can pick a different one before saving. The picked variant is then
  // moved to index 0 when saving so the publish wizard auto-fills with it.
  const [picked, setPicked] = useState({
    headline: 0,
    primaryText: 0,
    description: 0,
    cta: 0,
  });
  // Per-section visibility. When a flag is true the section is "eye-off":
  // excluded from the saved creative AND hidden from the preview card. Lets
  // the user ship, say, an image ad with just a headline + CTA (no body /
  // description). Keyed to match `picked`.
  const [hidden, setHidden] = useState({
    headline: false,
    primaryText: false,
    description: false,
    cta: false,
  });
  // Generated images — for IMAGE type, an array of {url, hash} (one per
  // output). For CAROUSEL, indexed by card position. Generated in parallel
  // with copy on the same "generate" click; failures degrade gracefully
  // (copy still shows, image slot stays empty).
  const [images, setImages] = useState<
    Array<{ url: string; hash: string; dataUrl: string; aspect: AspectRatio }>
  >([]);
  const [pickedImageIdx, setPickedImageIdx] = useState(0);
  const [imagesLoading, setImagesLoading] = useState(false);
  // Per-card image URLs for carousel. Length === result.cards.length on
  // success; entries that failed get `null` and the user can retry via
  // the per-card AI button after saving.
  const [carouselImages, setCarouselImages] = useState<
    Array<{ url: string; hash: string; dataUrl: string } | null>
  >([]);
  // Optional reference product image. When set, generation routes to the
  // image-guided /images/edits endpoint and the product is featured as the
  // hero subject. `refPreview` is an object URL for the thumbnail chip —
  // revoke it whenever it's replaced or cleared to avoid a memory leak.
  const [refImage, setRefImage] = useState<File | null>(null);
  const [refPreview, setRefPreview] = useState<string | null>(null);
  const refInputRef = useRef<HTMLInputElement>(null);

  function clearRefImage() {
    setRefImage(null);
    setRefPreview((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });
  }

  function handleRefImagePick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    // Reset the input so picking the same file again still fires onChange.
    e.target.value = "";
    if (!file) return;
    if (!["image/png", "image/jpeg", "image/webp"].includes(file.type)) {
      toast.error("Reference image must be PNG, JPEG, or WebP.");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast.error("Reference image is too large (max 10MB).");
      return;
    }
    setRefImage(file);
    setRefPreview((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return URL.createObjectURL(file);
    });
  }

  useEffect(() => {
    if (!open) {
      const t = setTimeout(() => {
        setBrief("");
        setResult(null);
        setLoading(false);
        setTemplatesOpen(false);
        setPicked({ headline: 0, primaryText: 0, description: 0, cta: 0 });
        setHidden({
          headline: false,
          primaryText: false,
          description: false,
          cta: false,
        });
        setEdited({
          headlines: [],
          primary_texts: [],
          descriptions: [],
          ctas: [],
        });
        setImages([]);
        setPickedImageIdx(0);
        setImagesLoading(false);
        setCarouselImages([]);
        clearRefImage();
      }, 250);
      return () => clearTimeout(t);
    }
  }, [open]);

  // Hydrate the editable working copy + reset picks whenever a fresh
  // result lands. Carousel results keep `cards` separate (per-card text
  // editing happens after save, in the Detail Modal).
  useEffect(() => {
    if (result) {
      setPicked({ headline: 0, primaryText: 0, description: 0, cta: 0 });
      setHidden({
        headline: false,
        primaryText: false,
        description: false,
        cta: false,
      });
      setEdited({
        headlines: [...(result.headlines ?? [])],
        primary_texts: [...(result.primary_texts ?? [])],
        descriptions: [...(result.descriptions ?? [])],
        ctas: [...(result.ctas ?? [])],
      });
    }
  }, [result]);

  // Close the templates popover on outside click / ESC.
  useEffect(() => {
    if (!templatesOpen) return;
    function onClick(e: MouseEvent) {
      const target = e.target as HTMLElement;
      if (!target.closest("[data-templates-popover]")) {
        setTemplatesOpen(false);
      }
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [templatesOpen]);

  async function generate() {
    if (brief.trim().length < 10) {
      toast.error("Tell the AI a bit more — at least 10 characters.");
      return;
    }
    setLoading(true);
    setResult(null);
    setImages([]);
    setPickedImageIdx(0);
    setCarouselImages([]);

    // Fire copy + (for image/carousel kinds) images in parallel — the user
    // shouldn't wait on a sequential chain. Copy is the load-bearing
    // result; image gen is best-effort and degrades to "no images" if
    // anything fails (rate limit, safety filter, no Meta account, etc.).
    const copyPromise = (async () => {
      const res = await fetch("/api/ai/generate-copy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          brief: `${brief}\n\nTone: ${tone}. Creative type: ${kind}. Aspect: ${aspect}.`,
          platform,
          objective,
          ...(kind === "carousel" ? { kind: "carousel", cardCount } : {}),
        }),
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        throw new Error(data.error ?? "Failed to generate copy");
      }
      return data.copy as CopyResult;
    })();

    // Track the FIRST image-gen error so we can show the real reason in
    // the toast instead of a generic "image generation failed" (the most
    // common cause is "no Meta ad account connected" — useless if hidden).
    let firstImageError: string | null = null;

    // For IMAGE kind: generate N images in parallel (N = outputs chip).
    const imagesPromise: Promise<
      Array<{ url: string; hash: string; dataUrl: string; aspect: AspectRatio }>
    > =
      kind === "image"
        ? (async () => {
            setImagesLoading(true);
            const calls = Array.from({ length: outputs }, () =>
              // Reference image (if any) applies to every output — the same
              // File is re-sent per parallel call. For N ≤ 3 that's fine;
              // it just multiplies the upload bytes, not the image cost.
              api.generateAdImage({ brief, aspect, image: refImage }).catch((err) => {
                if (!firstImageError) {
                  firstImageError =
                    err instanceof Error
                      ? err.message
                      : "Image generation failed";
                }
                console.error("[generate-image] failed:", err);
                return null;
              })
            );
            const capturedAspect = aspect;
            const settled = await Promise.all(calls);
            return settled
              .filter(
                (x): x is { url: string; hash: string; dataUrl: string } =>
                  x !== null
              )
              .map((img) => ({ ...img, aspect: capturedAspect }));
          })()
        : Promise.resolve([]);

    let copy: CopyResult | null = null;
    try {
      copy = await copyPromise;
      setResult(copy);
    } catch (err) {
      console.error("[generate-copy] error", err);
      toast.error("Couldn't reach AI service — showing example copy.");
      copy = FALLBACK_COPY;
      setResult(FALLBACK_COPY);
    }
    setLoading(false);

    // Image gen awaits separately so copy lands as soon as it's ready
    // (typical: copy ~1.5s, images 4-8s each at outputs=1, longer for 3
    // in parallel). UI shows copy first + a spinner over the image slot.
    if (kind === "image") {
      try {
        const imgs = await imagesPromise;
        setImages(imgs);
        if (imgs.length === 0) {
          // Surface the real error from the backend (e.g. "Connect a Meta
          // ad account first…", "Rate limit reached…", "prompt was blocked
          // by Gemini's safety filter") so the user knows what to fix.
          const msg = firstImageError ?? "Image generation failed";
          toast.error(msg, { duration: 6000 });
        }
      } catch {
        setImages([]);
      } finally {
        setImagesLoading(false);
      }
    }

    // For CAROUSEL: once copy returns with cards, generate one image per
    // card in parallel. Same best-effort semantics — failures leave the
    // card image empty for the user to fill via per-card AI button later.
    if (kind === "carousel" && copy?.cards && copy.cards.length >= 2) {
      setImagesLoading(true);
      let firstCarouselError: string | null = null;
      try {
        const cardCalls = copy.cards.map((card) =>
          api
            .generateAdImage({
              brief,
              headline: card.headline,
              description: card.description,
              aspect,
              // Same reference image guides every card.
              image: refImage,
            })
            .catch((err) => {
              if (!firstCarouselError) {
                firstCarouselError =
                  err instanceof Error
                    ? err.message
                    : "Image generation failed";
              }
              console.error("[generate-image:carousel] failed:", err);
              return null;
            })
        );
        const cardSettled = await Promise.all(cardCalls);
        setCarouselImages(cardSettled);
        const failed = cardSettled.filter((x) => x === null).length;
        if (failed > 0) {
          const msg = firstCarouselError
            ? `Image gen failed: ${firstCarouselError}`
            : `${failed} card image${failed > 1 ? "s" : ""} failed — retry per card after Save.`;
          toast.error(msg, { duration: 6000 });
        }
      } finally {
        setImagesLoading(false);
      }
    }
  }

  async function handleSaveCreative() {
    if (!result) return;
    const typeMap: Record<CreativeKind, CreativeType> = {
      image: "IMAGE",
      video: "VIDEO",
      carousel: "CAROUSEL",
      text: "TEXT",
    };
    if (result.cards && result.cards.length >= 2) {
      // Carousel: merge the per-card text from the AI result with the
      // per-card images (when image gen succeeded). Cards without an
      // image stay text-only — user adds via the per-card AI button or
      // file picker in the Detail Modal.
      const cardsForSave = result.cards.map((c, i) => {
        const img = carouselImages[i];
        return {
          headline: c.headline,
          description: c.description ?? undefined,
          // Persist the Meta-hosted url (small string) — NOT the base64
          // data URL, which would bloat the DB row and blow the request
          // body limit. imageHash is the Meta handle used at publish time.
          ...(img
            ? { url: img.url, imageUrl: img.url, imageHash: img.hash }
            : {}),
        };
      });
      // Top-level `url` is the first card's image — used as the library
      // card preview thumbnail in PreviewArea.
      const firstUrl = carouselImages[0]?.url;
      await onSave({
        type: "CAROUSEL",
        platform,
        objective,
        content: {
          cards: cardsForSave,
          // Ad-level copy — omit any section the user toggled "eye-off".
          ...(hidden.primaryText
            ? {}
            : {
                primary_texts: pickFirst(
                  edited.primary_texts,
                  picked.primaryText
                ),
              }),
          ...(hidden.cta
            ? {}
            : { ctas: pickFirst(edited.ctas, picked.cta) }),
          ...(firstUrl ? { url: firstUrl } : {}),
          brief,
          tone,
          aspect,
        },
      });
      onClose();
      return;
    }
    // Build the copy payload, omitting any section the user toggled
    // "eye-off" — a hidden section is excluded from the creative entirely
    // (and never made it onto the preview card either).
    const reordered: {
      headlines?: string[];
      primary_texts?: string[];
      descriptions?: string[];
      ctas?: string[];
    } = {};
    if (!hidden.headline)
      reordered.headlines = pickFirst(edited.headlines, picked.headline);
    if (!hidden.primaryText)
      reordered.primary_texts = pickFirst(
        edited.primary_texts,
        picked.primaryText
      );
    if (!hidden.description)
      reordered.descriptions = pickFirst(
        edited.descriptions,
        picked.description
      );
    if (!hidden.cta) reordered.ctas = pickFirst(edited.ctas, picked.cta);
    const pickedImage = images[pickedImageIdx];
    await onSave({
      type: typeMap[kind],
      platform,
      objective,
      content: {
        ...reordered,
        brief,
        tone,
        aspect,
        // Save the picked AI-generated image. The PreviewArea reads
        // `content.url` for the card thumbnail — we persist the Meta-hosted
        // url (small string), same as the device-upload flow, NOT the
        // base64 data URL (that would bloat the row + blow the body limit).
        // `imageHash` lets the publish wizard skip re-uploading to Meta.
        ...(pickedImage
          ? {
              url: pickedImage.url,
              imageUrl: pickedImage.url,
              imageHash: pickedImage.hash,
            }
          : {}),
      },
    });
    onClose();
  }

  const hasResult = Boolean(result);
  const aspectMeta = ASPECT_OPTIONS.find((a) => a.value === aspect)!;

  return (
    <Modal
      open={open}
      onClose={onClose}
      position="right"
      ariaLabel="Generate ad creative with AI"
    >
      {/* ──────────── Header bar ──────────── */}
      <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-6 py-3.5">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 shadow-glow">
            <Sparkles className="h-4 w-4 text-white" strokeWidth={2.5} />
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-900">
              Generate with AI
            </h2>
            <p className="text-[11px] font-medium text-slate-500">
              Type a prompt — get copy + images ready to publish
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {/* Primary save action moved from the right column into the
              header so it's anchored visibly while the user scrolls the
              variants. Hidden until a result exists — nothing to save
              before generation. */}
          {hasResult && (
            <button
              type="button"
              onClick={() => void handleSaveCreative()}
              className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 px-3.5 py-2 text-xs font-bold text-white shadow-glow transition hover:-translate-y-0.5 hover:shadow-xl"
            >
              <Save className="h-3.5 w-3.5" strokeWidth={2.5} />
              Add to library
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="flex h-9 w-9 items-center justify-center rounded-xl text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* ──────────── Body — 3-pane workspace ──────────── */}
      {/* Left: filter chips (always visible). Center: hero / loading /
          image preview. Right: variant pickers (only when there's a
          result). Settings moved off the top strip into the left rail
          so all the AI knobs live in one place. */}
      <div className="relative flex flex-1 overflow-hidden bg-gradient-to-b from-slate-50/40 via-white to-white">
        {/* ----- Left: filters chip column (15%) ----- */}
        <aside className="w-[16%] min-w-[200px] shrink-0 overflow-y-auto border-r border-slate-100 bg-slate-50/40 px-3 py-5">
          <h3 className="mb-3 px-1 text-[10px] font-bold uppercase tracking-wider text-slate-500">
            Filters
          </h3>
          <div className="space-y-4">
            <FilterPills
              label="Platform"
              value={platform}
              onChange={(v) => setPlatform(v as Platform)}
              options={[
                { value: "META", label: "Meta" },
                { value: "GOOGLE", label: "Google" },
                { value: "TIKTOK", label: "TikTok" },
                { value: "LINKEDIN", label: "LinkedIn" },
              ]}
            />
            <FilterPills
              label="Objective"
              value={objective}
              onChange={setObjective}
              options={[
                { value: "Conversions", label: "Conversions" },
                { value: "Awareness", label: "Awareness" },
                { value: "Traffic", label: "Traffic" },
                { value: "Leads", label: "Leads" },
              ]}
            />
            {/* Short labels for type — the long ones ("Image Ad Copy",
                "Video Script") wrap awkwardly at 200px rail width. The
                "Type" header gives the context. */}
            <FilterPills
              label="Type"
              value={kind}
              onChange={(v) => setKind(v as CreativeKind)}
              options={[
                { value: "image", label: "Image" },
                { value: "video", label: "Video" },
                { value: "carousel", label: "Carousel" },
                { value: "text", label: "Text" },
              ]}
            />
            <FilterPills
              label="Tone"
              value={tone}
              onChange={(v) => setTone(v as Tone)}
              options={TONE_OPTIONS.map((t) => ({
                value: t.value,
                label: t.label,
              }))}
            />
            {kind === "carousel" && (
              <FilterPills
                label="Cards"
                value={String(cardCount)}
                onChange={(v) => setCardCount(Number(v))}
                options={[2, 3, 4, 5].map((n) => ({
                  value: String(n),
                  label: `${n}`,
                }))}
              />
            )}
          </div>
        </aside>

        {/* ----- Center + right: main work area ----- */}
        <div className="flex flex-1 overflow-hidden">
          {/* Hero + loading stay centered; results split into preview (left)
              + variants (right). */}
          {!hasResult && !loading && (
            <div className="flex-1 overflow-y-auto px-6 py-6">
              <AIGenerateHero />
            </div>
          )}

          {loading && (
            <div className="flex flex-1 flex-col items-center justify-center gap-3 text-slate-500">
              <div className="relative">
                <div className="absolute inset-0 animate-pulse rounded-full bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 opacity-30 blur-2xl" />
                <div className="relative flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 shadow-glow">
                  <Sparkles className="h-7 w-7 animate-pulse text-white" strokeWidth={2.5} />
                </div>
              </div>
              <p className="mt-4 text-sm font-semibold text-slate-700">
                Generating your creative…
              </p>
              <p className="text-xs text-slate-500">
                {kind === "carousel"
                  ? `Writing a ${cardCount}-card story across hook → benefit → CTA`
                  : "Drafting headlines, body copy, descriptions, and CTAs"}
              </p>
            </div>
          )}

          {hasResult && result && (
            <AIGenerateResults
              kind={kind}
              result={result}
              edited={edited}
              setEdited={setEdited}
              picked={picked}
              setPicked={setPicked}
              hidden={hidden}
              setHidden={setHidden}
              images={images}
              pickedImageIdx={pickedImageIdx}
              setPickedImageIdx={setPickedImageIdx}
              imagesLoading={imagesLoading}
              carouselImages={carouselImages}
              aspect={aspect}
            />
          )}
        </div>
      </div>

      {/* ──────────── Bottom prompt input ──────────── */}
      <div className="border-t border-slate-100 bg-white px-6 py-4">
        <div className="mx-auto max-w-4xl">
          <div className="rounded-2xl border border-slate-200 bg-white shadow-md transition focus-within:border-primary/40 focus-within:shadow-glow">
            <div className="flex items-start gap-2 px-4 pt-3">
              <Sparkles
                className="mt-0.5 h-4 w-4 shrink-0 text-primary"
                strokeWidth={2.5}
              />
              <textarea
                value={brief}
                onChange={(e) => setBrief(e.target.value)}
                onKeyDown={(e) => {
                  if (
                    e.key === "Enter" &&
                    (e.metaKey || e.ctrlKey) &&
                    !loading &&
                    brief.trim().length >= 10
                  ) {
                    e.preventDefault();
                    void generate();
                  }
                }}
                rows={3}
                placeholder="Describe your ad idea — product, audience, what you want it to do…  (⌘/Ctrl + Enter to generate)"
                className="min-h-[40px] max-h-[40vh] w-full resize-y overflow-y-auto bg-transparent text-sm leading-relaxed text-slate-900 placeholder:text-slate-400 focus:outline-none"
              />
            </div>

            <div className="flex flex-wrap items-center gap-2 border-t border-slate-100 px-3 py-2.5">
              {/* Aspect ratio chip */}
              <ChipDropdown
                icon={aspectIcon(aspect)}
                label={aspectMeta.label}
                hint={aspectMeta.hint}
                options={ASPECT_OPTIONS.map((a) => ({
                  value: a.value,
                  label: a.label,
                  hint: a.hint,
                }))}
                value={aspect}
                onChange={(v) => setAspect(v as AspectRatio)}
              />

              {/* Reference image (+) — only for kinds that generate images.
                  When set, the product is featured as the hero subject. */}
              {(kind === "image" || kind === "carousel") && (
                <>
                  <input
                    ref={refInputRef}
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    className="hidden"
                    onChange={handleRefImagePick}
                  />
                  {refImage && refPreview ? (
                    <div className="inline-flex items-center gap-1.5 rounded-full border border-primary/40 bg-primary/5 py-1 pl-1 pr-2 text-xs font-semibold text-primary">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={refPreview}
                        alt="Reference"
                        className="h-5 w-5 rounded-full object-cover"
                      />
                      <span className="max-w-[7rem] truncate">
                        {refImage.name}
                      </span>
                      <button
                        type="button"
                        onClick={clearRefImage}
                        className="ml-0.5 rounded-full p-0.5 text-primary/70 transition hover:bg-primary/10 hover:text-primary"
                        aria-label="Remove reference image"
                      >
                        <X className="h-3 w-3" strokeWidth={2.5} />
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => refInputRef.current?.click()}
                      className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:border-primary/40 hover:text-primary"
                      title="Add a reference product image — the AI keeps it as the hero subject"
                    >
                      <ImagePlus className="h-3 w-3" strokeWidth={2.5} />
                      Reference image
                    </button>
                  )}
                </>
              )}

              {/* Prompt Templates chip */}
              <div className="relative" data-templates-popover>
                <button
                  type="button"
                  onClick={() => setTemplatesOpen((p) => !p)}
                  className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:border-primary/40 hover:text-primary"
                >
                  <Sparkles className="h-3 w-3" strokeWidth={2.5} />
                  Prompt Templates
                  <ChevronDown className="h-3 w-3" strokeWidth={2.5} />
                </button>
                {templatesOpen && (
                  <div className="absolute bottom-full left-0 mb-2 w-80 rounded-xl border border-slate-200 bg-white p-2 shadow-2xl">
                    <div className="px-2 py-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                      Pick one, fill the [brackets], then send
                    </div>
                    <ul className="space-y-0.5">
                      {PROMPT_TEMPLATES.map((t) => (
                        <li key={t.label}>
                          <button
                            type="button"
                            onClick={() => {
                              setBrief(t.brief);
                              setTemplatesOpen(false);
                            }}
                            className="w-full rounded-lg px-2 py-2 text-left transition hover:bg-slate-50"
                          >
                            <div className="text-xs font-semibold text-slate-900">
                              {t.label}
                            </div>
                            <div className="mt-0.5 line-clamp-2 text-[11px] text-slate-500">
                              {t.brief}
                            </div>
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>

              {/* Outputs chip */}
              <ChipDropdown
                icon={<Layers className="h-3 w-3" strokeWidth={2.5} />}
                label={`${outputs} output${outputs > 1 ? "s" : ""}`}
                options={OUTPUT_OPTIONS.map((o) => ({
                  value: String(o.value),
                  label: o.label,
                }))}
                value={String(outputs)}
                onChange={(v) => setOutputs(Number(v) as 1 | 2 | 3)}
              />

              {/* Spacer */}
              <div className="flex-1" />

              {/* Regenerate icon — only shown once there's a result.
                  Rerunning generate() with the same brief produces fresh
                  copy + images. Sits as a small ghost icon next to send. */}
              {hasResult && (
                <button
                  type="button"
                  onClick={generate}
                  disabled={loading || brief.trim().length < 10}
                  aria-label="Regenerate"
                  title="Regenerate copy + images with the same prompt"
                  className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 transition hover:border-primary/40 hover:text-primary disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <RefreshCw
                    className={clsx("h-4 w-4", loading && "animate-spin")}
                    strokeWidth={2.5}
                  />
                </button>
              )}

              {/* Send button */}
              <button
                type="button"
                onClick={generate}
                disabled={loading || brief.trim().length < 10}
                aria-label="Generate"
                className={clsx(
                  "inline-flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 text-white shadow-sm transition",
                  loading || brief.trim().length < 10
                    ? "opacity-40"
                    : "hover:-translate-y-0.5 hover:shadow-xl"
                )}
              >
                {loading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <ArrowRight className="h-4 w-4" strokeWidth={2.5} />
                )}
              </button>
            </div>
          </div>
        </div>
      </div>

    </Modal>
  );
}

/** Glyph for the aspect-ratio chip — a small rectangle in the chosen
 *  shape. Saves us from importing yet more icons just for three shapes. */
function aspectIcon(a: AspectRatio): React.ReactNode {
  const dims =
    a === "square"
      ? "h-3 w-3"
      : a === "portrait"
        ? "h-3 w-2"
        : "h-2 w-3.5";
  return (
    <span
      className={clsx(
        "inline-block rounded-[2px] border-2 border-current",
        dims
      )}
      aria-hidden
    />
  );
}

/** A vertical filter group: small label above + a flex-wrap row of
 *  selectable pills. Used in the AI Generate modal's left rail so users
 *  see every option at a glance instead of hunting through a dropdown.
 *  Selected pill is filled with the primary brand color; others stay
 *  subdued. */
function FilterPills({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: { value: string; label: string }[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="px-1">
      <span className="mb-1.5 block text-[9px] font-bold uppercase tracking-wider text-slate-400">
        {label}
      </span>
      <div className="flex flex-wrap gap-2">
        {options.map((opt) => {
          const isSelected = opt.value === value;
          return (
            <button
              key={opt.value}
              type="button"
              onClick={() => onChange(opt.value)}
              className={clsx(
                "rounded-full border px-2.5 py-1 text-[11px] font-semibold transition",
                isSelected
                  ? "border-primary bg-primary text-white shadow-sm"
                  : "border-slate-200 bg-white text-slate-600 hover:border-primary/40 hover:text-primary"
              )}
            >
              {opt.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/** Generic chip with a click-to-open dropdown — used for aspect ratio and
 *  outputs in the prompt bar. Falls back to a small CSS popover (no
 *  portal needed at this depth). */
function ChipDropdown({
  icon,
  label,
  hint,
  options,
  value,
  onChange,
}: {
  icon: React.ReactNode;
  label: string;
  hint?: string;
  options: { value: string; label: string; hint?: string }[];
  value: string;
  onChange: (v: string) => void;
}) {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (!open) return;
    function onClick(e: MouseEvent) {
      const target = e.target as HTMLElement;
      if (!target.closest("[data-chip-dropdown]")) setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  return (
    <div className="relative" data-chip-dropdown>
      <button
        type="button"
        onClick={() => setOpen((p) => !p)}
        className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:border-primary/40 hover:text-primary"
      >
        {icon}
        {label}
        {hint && <span className="text-[10px] font-medium text-slate-400">· {hint}</span>}
        <ChevronDown className="h-3 w-3" strokeWidth={2.5} />
      </button>
      {open && (
        <div className="absolute bottom-full left-0 mb-2 w-44 rounded-xl border border-slate-200 bg-white p-1 shadow-2xl">
          {options.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => {
                onChange(opt.value);
                setOpen(false);
              }}
              className={clsx(
                "flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-xs font-semibold transition",
                opt.value === value
                  ? "bg-primary/5 text-primary"
                  : "text-slate-700 hover:bg-slate-50"
              )}
            >
              <span>{opt.label}</span>
              {opt.hint && (
                <span className="text-[10px] font-medium text-slate-400">
                  {opt.hint}
                </span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/** Empty-state hero shown until the user kicks off their first generation
 *  — three layered example cards + a friendly headline. Builds intent
 *  ("here's what comes out") without needing a real example library. */
function AIGenerateHero() {
  return (
    <div className="flex min-h-[55vh] flex-col items-center justify-center text-center">
      {/* Floating example cards */}
      <div className="relative mb-6 h-44 w-72">
        {/* Sparkle accents */}
        <Sparkles
          className="absolute -left-4 top-2 h-3 w-3 text-purple-400"
          fill="currentColor"
        />
        <Sparkles
          className="absolute right-2 top-6 h-2.5 w-2.5 text-indigo-400"
          fill="currentColor"
        />
        <Sparkles
          className="absolute -right-6 bottom-6 h-3.5 w-3.5 text-pink-400"
          fill="currentColor"
        />
        {/* Left card */}
        <div className="absolute left-0 top-3 h-40 w-28 -rotate-[8deg] overflow-hidden rounded-xl bg-gradient-to-br from-rose-200 via-rose-100 to-amber-100 shadow-xl ring-1 ring-rose-200">
          <div className="flex h-full flex-col justify-between p-3">
            <div className="text-[10px] font-bold uppercase tracking-wider text-rose-900/70">
              Elegance
            </div>
            <div className="text-[11px] font-bold leading-tight text-rose-900">
              Made Effortless
            </div>
          </div>
        </div>
        {/* Right card */}
        <div className="absolute right-0 top-3 h-40 w-28 rotate-[8deg] overflow-hidden rounded-xl bg-gradient-to-br from-sky-100 via-blue-50 to-indigo-100 shadow-xl ring-1 ring-blue-200">
          <div className="flex h-full flex-col justify-between p-3">
            <div className="text-[10px] font-bold uppercase tracking-wider text-blue-900/70">
              Expert
            </div>
            <div className="text-[11px] font-bold leading-tight text-blue-900">
              Advice You Trust
            </div>
          </div>
        </div>
        {/* Center card (highest z) */}
        <div className="absolute left-1/2 top-0 h-44 w-32 -translate-x-1/2 overflow-hidden rounded-xl bg-gradient-to-br from-slate-900 via-slate-800 to-amber-900 shadow-2xl ring-1 ring-slate-700">
          <div className="flex h-full flex-col justify-between p-3 text-white">
            <div className="text-[9px] font-bold uppercase tracking-[0.18em] text-amber-200/80">
              Timeless Luxury
            </div>
            <div className="text-[11px] font-bold leading-tight">
              Limited Edition
            </div>
          </div>
        </div>
      </div>

      <h1 className="max-w-xl text-balance text-2xl font-bold leading-tight text-slate-900 sm:text-3xl">
        No creatives yet — let&apos;s bring your first idea to life.
      </h1>
      <p className="mt-3 max-w-md text-sm leading-relaxed text-slate-500">
        Type a prompt below or pick a template. Set platform, objective, and
        tone at the top — the AI tailors copy + images to match.
      </p>
    </div>
  );
}

/** Results panel — extracted so the modal JSX stays scannable. Handles
 *  carousel-story rendering, flat headline/body/desc/CTA pickers, and
 *  the Use / Regenerate action row. */
/**
 * Results panel — 2-column layout: preview card on the left, variant
 * pickers on the right. The picked headline / body / description / CTA
 * overlay onto the preview card in real-time so the user sees what they're
 * shipping.
 *
 * For IMAGE: left is one image (or gallery if outputs > 1) + selected
 * copy overlay.
 * For CAROUSEL: left is the per-card carousel (image + per-card text);
 * right shows only ad-level Primary Texts + CTAs.
 * For VIDEO / TEXT: left shows a copy-on-gradient card (no image).
 */
function AIGenerateResults({
  kind,
  result,
  edited,
  setEdited,
  picked,
  setPicked,
  hidden,
  setHidden,
  images,
  pickedImageIdx,
  setPickedImageIdx,
  imagesLoading,
  carouselImages,
  aspect,
}: {
  kind: CreativeKind;
  result: CopyResult;
  edited: {
    headlines: string[];
    primary_texts: string[];
    descriptions: string[];
    ctas: string[];
  };
  setEdited: React.Dispatch<
    React.SetStateAction<{
      headlines: string[];
      primary_texts: string[];
      descriptions: string[];
      ctas: string[];
    }>
  >;
  picked: { headline: number; primaryText: number; description: number; cta: number };
  setPicked: React.Dispatch<
    React.SetStateAction<{
      headline: number;
      primaryText: number;
      description: number;
      cta: number;
    }>
  >;
  hidden: { headline: boolean; primaryText: boolean; description: boolean; cta: boolean };
  setHidden: React.Dispatch<
    React.SetStateAction<{
      headline: boolean;
      primaryText: boolean;
      description: boolean;
      cta: boolean;
    }>
  >;
  images: Array<{ url: string; hash: string; dataUrl: string; aspect: AspectRatio }>;
  pickedImageIdx: number;
  setPickedImageIdx: React.Dispatch<React.SetStateAction<number>>;
  imagesLoading: boolean;
  carouselImages: Array<{ url: string; hash: string; dataUrl: string } | null>;
  aspect: AspectRatio;
}) {
  const isCarousel = result.cards && result.cards.length > 0;
  const selectedImage = images[pickedImageIdx];

  // Picked copy values used to render the preview overlay. Reads from
  // `edited` so inline edits show up live. A section toggled "eye-off"
  // resolves to "" so it drops off the preview card (the card already
  // conditionally renders each line).
  const pickedHeadline = hidden.headline ? "" : edited.headlines[picked.headline] ?? "";
  const pickedBody = hidden.primaryText ? "" : edited.primary_texts[picked.primaryText] ?? "";
  const pickedDescription = hidden.description ? "" : edited.descriptions[picked.description] ?? "";
  const pickedCta = hidden.cta ? "" : edited.ctas[picked.cta] ?? "";

  return (
    <div className="grid animate-in flex-1 grid-cols-1 overflow-hidden lg:grid-cols-[minmax(0,50fr)_minmax(0,25fr)]">
      {/* ──────────── CENTER: Preview card (50fr of the modal) ──────────── */}
      {/* Centered both axes so the card sits in the middle of the viewport
          regardless of aspect ratio. `overflow-hidden` (not auto) per the
          user's "no scroll" requirement — the card's internal sizing is
          height-constrained so it never overflows. */}
      <div className="flex items-center justify-center overflow-hidden px-6 py-6">
        {isCarousel ? (
          <div className="w-full max-w-sm">
            <AIGenerateCarouselPreview
              cards={result.cards!}
              images={carouselImages}
              primaryText={pickedBody}
              cta={pickedCta}
              imagesLoading={imagesLoading}
            />
          </div>
        ) : (
          <AIGenerateImagePreview
            image={selectedImage}
            allImages={images}
            pickedIdx={pickedImageIdx}
            onPick={setPickedImageIdx}
            imagesLoading={imagesLoading}
            kind={kind}
            currentAspect={aspect}
            headline={pickedHeadline}
            body={pickedBody}
            description={pickedDescription}
            cta={pickedCta}
          />
        )}
      </div>

      {/* ──────────── RIGHT: Variant pickers (25% of the modal) ──────────── */}
      <div className="space-y-5 overflow-y-auto border-l border-slate-100 bg-slate-50/30 px-5 py-6">
        <div className="rounded-xl border border-indigo-100 bg-indigo-50/60 p-3">
          <div className="flex items-start gap-2 text-[11px] leading-relaxed text-indigo-900">
            <Check
              className="mt-0.5 h-3.5 w-3.5 shrink-0 text-indigo-600"
              strokeWidth={3}
            />
            <p>
              <strong>Tap a row to pick it.</strong> Tap the pencil to edit
              the text. The picked variant lands on the preview card and
              becomes the default when you save.
            </p>
          </div>
        </div>

        {/* Headlines — hidden for carousel (per-card headlines below the
            cards instead) */}
        {!isCarousel && edited.headlines.length > 0 && (
          <EditableVariantList
            title="Headlines"
            count={edited.headlines.length}
            items={edited.headlines}
            selectedIndex={picked.headline}
            onSelect={(i) => setPicked((p) => ({ ...p, headline: i }))}
            onEdit={(i, next) =>
              setEdited((e) => {
                const arr = [...e.headlines];
                arr[i] = next;
                return { ...e, headlines: arr };
              })
            }
            multiline={false}
            maxLength={40}
            hidden={hidden.headline}
            onToggleHidden={() =>
              setHidden((h) => ({ ...h, headline: !h.headline }))
            }
          />
        )}

        {/* Primary Texts — ad-level body copy, always shown */}
        {edited.primary_texts.length > 0 && (
          <EditableVariantList
            title="Primary Texts"
            count={edited.primary_texts.length}
            items={edited.primary_texts}
            selectedIndex={picked.primaryText}
            onSelect={(i) => setPicked((p) => ({ ...p, primaryText: i }))}
            onEdit={(i, next) =>
              setEdited((e) => {
                const arr = [...e.primary_texts];
                arr[i] = next;
                return { ...e, primary_texts: arr };
              })
            }
            multiline
            maxLength={125}
            hidden={hidden.primaryText}
            onToggleHidden={() =>
              setHidden((h) => ({ ...h, primaryText: !h.primaryText }))
            }
          />
        )}

        {/* Descriptions — hidden for carousel (per-card descriptions
            instead) */}
        {!isCarousel && edited.descriptions.length > 0 && (
          <EditableVariantList
            title="Descriptions"
            count={edited.descriptions.length}
            items={edited.descriptions}
            selectedIndex={picked.description}
            onSelect={(i) => setPicked((p) => ({ ...p, description: i }))}
            onEdit={(i, next) =>
              setEdited((e) => {
                const arr = [...e.descriptions];
                arr[i] = next;
                return { ...e, descriptions: arr };
              })
            }
            multiline={false}
            maxLength={60}
            hidden={hidden.description}
            onToggleHidden={() =>
              setHidden((h) => ({ ...h, description: !h.description }))
            }
          />
        )}

        {/* CTAs — pill picker, edits less common (Meta has a fixed enum,
            but free-text edit is fine since we map to enum at publish) */}
        {edited.ctas.length > 0 && (
          <div>
            <div className="mb-2 flex items-center justify-between gap-2">
              <h3
                className={clsx(
                  "text-xs font-bold uppercase tracking-wider transition",
                  hidden.cta ? "text-slate-300 line-through" : "text-slate-500"
                )}
              >
                CTAs · {edited.ctas.length} options
              </h3>
              <button
                type="button"
                onClick={() => setHidden((h) => ({ ...h, cta: !h.cta }))}
                title={
                  hidden.cta
                    ? "Show CTAs — include in the creative"
                    : "Hide CTAs — leave out of the creative"
                }
                aria-label={hidden.cta ? "Show CTAs" : "Hide CTAs"}
                aria-pressed={hidden.cta}
                className={clsx(
                  "flex h-6 w-6 shrink-0 items-center justify-center rounded-lg transition",
                  hidden.cta
                    ? "text-slate-300 hover:bg-slate-100 hover:text-slate-500"
                    : "text-slate-400 hover:bg-slate-100 hover:text-primary"
                )}
              >
                {hidden.cta ? (
                  <EyeOff className="h-3.5 w-3.5" />
                ) : (
                  <Eye className="h-3.5 w-3.5" />
                )}
              </button>
            </div>
            <div
              className={clsx(
                "flex flex-wrap gap-2 transition",
                hidden.cta && "pointer-events-none select-none opacity-40"
              )}
            >
              {edited.ctas.map((c, i) => {
                const isPicked = picked.cta === i;
                return (
                  <button
                    key={`c-${i}`}
                    type="button"
                    onClick={() => setPicked((p) => ({ ...p, cta: i }))}
                    className={clsx(
                      "inline-flex items-center gap-1.5 rounded-full border-2 px-3.5 py-1.5 text-xs font-bold transition",
                      isPicked
                        ? "border-primary bg-primary text-white shadow-sm"
                        : "border-slate-200 bg-white text-slate-700 hover:border-primary/40 hover:text-primary"
                    )}
                  >
                    {isPicked && <Check className="h-3 w-3" strokeWidth={3} />}
                    {c}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Save lives in the modal header now (the gradient "Add to library"
            button). No bottom action row here — keeps the right column
            scrollable to the last variant without a sticky footer. */}
      </div>
    </div>
  );
}

/** Image-ad preview card — shows the picked AI-generated image (or a
 *  placeholder while loading / when no image was generated) with the
 *  picked copy overlaid below as a faux ad caption + CTA. When `outputs > 1`
 *  and multiple images are generated, a thumbnail row appears below for
 *  picking which image to use. The image surface respects the aspect
 *  picked in the prompt bar so users see what they'll actually publish. */
function AIGenerateImagePreview({
  image,
  allImages,
  pickedIdx,
  onPick,
  imagesLoading,
  kind,
  currentAspect,
  headline,
  body,
  description,
  cta,
}: {
  image:
    | { url: string; hash: string; dataUrl: string; aspect: AspectRatio }
    | undefined;
  allImages: Array<{ url: string; hash: string; dataUrl: string; aspect: AspectRatio }>;
  pickedIdx: number;
  onPick: React.Dispatch<React.SetStateAction<number>>;
  imagesLoading: boolean;
  kind: CreativeKind;
  /** The chip's current selection — only used for the placeholder/spinner
   *  before any image is generated. Once an image exists, image.aspect
   *  (frozen at generation time) drives all sizing. */
  currentAspect: AspectRatio;
  headline: string;
  body: string;
  description: string;
  cta: string;
}) {
  const showImageSlot = kind === "image";
  // Use the aspect frozen at generation time; fall back to currentAspect
  // only while no image exists yet (placeholder / spinner state).
  const frozenAspect: AspectRatio = image?.aspect ?? currentAspect;
  // The backend center-crops the OpenAI output to these EXACT placement
  // ratios, so the card matches the real asset 1:1 (no letterboxing):
  //   square    1:1   (Feed)
  //   portrait  9:16  (Reels / Stories)
  //   landscape 16:9  (Video / Display)
  const aspectClass =
    frozenAspect === "portrait"
      ? "aspect-[9/16]"
      : frozenAspect === "landscape"
        ? "aspect-[16/9]"
        : "aspect-square";
  // Fixed card width per aspect so it genuinely looks like its placement.
  // Image fills the full width (`w-full`); height derives from the ratio:
  //   portrait  240 → 427px tall   square 300 → 300px   landscape 440 → 247px
  const cardWidth =
    frozenAspect === "portrait"
      ? "w-[240px]"
      : frozenAspect === "landscape"
        ? "w-[440px]"
        : "w-[300px]";
  return (
    <div className="flex flex-col items-center">
      <div className="flex flex-col items-center">
        {/* Image floats on its own — rounded on ALL corners, no card box
            around image + copy. Width applies to the IMAGE only; the copy
            block below is wider (matches the reference design). */}
        <div className={clsx("relative overflow-hidden rounded-2xl bg-slate-100 shadow-sm", cardWidth)}>
          {showImageSlot ? (
            image ? (
              <>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={image.dataUrl}
                  alt={headline || "AI-generated image"}
                  className={clsx("w-full object-cover", aspectClass)}
                />
                <span className="absolute right-3 top-3 inline-flex items-center gap-1 rounded-full bg-white/95 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-primary shadow-sm ring-1 ring-primary/30 backdrop-blur">
                  <Sparkles className="h-2.5 w-2.5" />
                  AI
                </span>
              </>
            ) : imagesLoading ? (
              <div
                className={clsx(
                  "flex w-full items-center justify-center bg-gradient-to-br from-indigo-50 via-purple-50 to-pink-50",
                  aspectClass
                )}
              >
                <div className="flex flex-col items-center gap-2 text-slate-500">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 shadow-glow">
                    <Sparkles
                      className="h-5 w-5 animate-pulse text-white"
                      strokeWidth={2.5}
                    />
                  </div>
                  <p className="text-xs font-semibold">Generating image…</p>
                </div>
              </div>
            ) : (
              <div
                className={clsx(
                  "flex w-full items-center justify-center bg-slate-50 text-xs text-slate-400",
                  aspectClass
                )}
              >
                No image — add one via Edit after Save
              </div>
            )
          ) : (
            <div
              className={clsx(
                "flex w-full flex-col items-center justify-center gap-2 bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 p-6 text-white",
                aspectClass
              )}
            >
              <Sparkles className="h-6 w-6" strokeWidth={2.25} />
              <p className="text-center text-sm font-bold leading-tight">
                {headline || "Your headline appears here"}
              </p>
            </div>
          )}
        </div>

        {/* Copy block below the image — centered, wider than the image
            (its own width, not the image's), no border/box. */}
        <div className="mt-3 w-[420px] max-w-full space-y-1.5 px-1 text-center">
          {headline && (
            <div className="text-sm font-bold leading-tight text-slate-900">
              {headline}
            </div>
          )}
          {body && (
            <p className="line-clamp-3 text-[11px] leading-relaxed text-slate-600">
              {body}
            </p>
          )}
          {description && (
            <p className="line-clamp-2 text-[10px] leading-relaxed text-slate-400">
              {description}
            </p>
          )}
          {cta && (
            <button
              type="button"
              className="mt-2 inline-flex items-center gap-1.5 rounded-md bg-slate-100 px-3 py-1.5 text-[11px] font-bold text-slate-900"
              tabIndex={-1}
            >
              {cta}
            </button>
          )}
        </div>
      </div>

      {/* Thumbnail row for picking when multiple images were generated. */}
      {showImageSlot && allImages.length > 1 && (
        <div className="mt-2 flex items-center gap-2">
          {allImages.map((img, i) => (
            <button
              key={img.url}
              type="button"
              onClick={() => onPick(i)}
              className={clsx(
                "h-14 w-14 overflow-hidden rounded-lg ring-2 transition",
                i === pickedIdx
                  ? "ring-primary"
                  : "ring-transparent hover:ring-slate-300"
              )}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={img.dataUrl}
                alt={`Variant ${i + 1}`}
                className="h-full w-full object-cover"
              />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/** Carousel preview — shows the AI-generated cards as a horizontal
 *  paginated carousel (one card at a time, prev/next chevrons + dots).
 *  Body copy + CTA underneath are ad-level and reflect the user's
 *  current picks. */
function AIGenerateCarouselPreview({
  cards,
  images,
  primaryText,
  cta,
  imagesLoading,
}: {
  cards: Array<{ headline: string; description?: string }>;
  images: Array<{ url: string; hash: string; dataUrl: string } | null>;
  primaryText: string;
  cta: string;
  imagesLoading: boolean;
}) {
  const [idx, setIdx] = useState(0);
  const safeIdx = Math.min(idx, Math.max(0, cards.length - 1));
  const total = cards.length;

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-card">
      {/* Sliding track */}
      <div className="relative">
        <div className="overflow-hidden">
          <div
            className="flex transition-transform duration-300 ease-out"
            style={{ transform: `translateX(-${safeIdx * 100}%)` }}
          >
            {cards.map((card, i) => {
              const img = images[i];
              return (
                <div
                  key={`card-${i}`}
                  className="w-full shrink-0"
                  aria-hidden={i !== safeIdx}
                >
                  <div className="relative bg-slate-100">
                    {img ? (
                      <>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={img.dataUrl}
                          alt={card.headline || `Card ${i + 1}`}
                          className="aspect-square w-full bg-white object-contain"
                        />
                        <span className="absolute right-3 top-3 inline-flex items-center gap-1 rounded-full bg-white/95 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-primary shadow-sm ring-1 ring-primary/30 backdrop-blur">
                          <Sparkles className="h-2.5 w-2.5" />
                          AI
                        </span>
                      </>
                    ) : imagesLoading ? (
                      <div className="flex aspect-square w-full items-center justify-center bg-gradient-to-br from-indigo-50 via-purple-50 to-pink-50">
                        <div className="flex flex-col items-center gap-1.5 text-slate-500">
                          <Loader2 className="h-5 w-5 animate-spin text-primary" />
                          <p className="text-[10px] font-semibold">
                            Generating image…
                          </p>
                        </div>
                      </div>
                    ) : (
                      <div className="flex aspect-square w-full items-center justify-center bg-slate-50 text-[10px] text-slate-400">
                        No image — retry per card after Save
                      </div>
                    )}
                  </div>
                  <div className="space-y-0.5 px-3 py-2.5">
                    <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                      Card {i + 1} of {total}
                    </div>
                    <div className="text-sm font-bold leading-snug text-slate-900">
                      {card.headline}
                    </div>
                    {card.description && (
                      <p className="text-[11px] text-slate-500 line-clamp-2">
                        {card.description}
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Chevrons */}
        {safeIdx > 0 && (
          <button
            type="button"
            onClick={() => setIdx((i) => Math.max(0, i - 1))}
            aria-label="Previous card"
            className="absolute left-2 top-1/3 flex h-7 w-7 items-center justify-center rounded-full bg-white/95 text-slate-700 shadow-md ring-1 ring-slate-200 hover:bg-white"
          >
            <ChevronLeft className="h-4 w-4" strokeWidth={2.5} />
          </button>
        )}
        {safeIdx < total - 1 && (
          <button
            type="button"
            onClick={() => setIdx((i) => Math.min(total - 1, i + 1))}
            aria-label="Next card"
            className="absolute right-2 top-1/3 flex h-7 w-7 items-center justify-center rounded-full bg-white/95 text-slate-700 shadow-md ring-1 ring-slate-200 hover:bg-white"
          >
            <ChevronRight className="h-4 w-4" strokeWidth={2.5} />
          </button>
        )}
      </div>

      {/* Dots */}
      <div className="flex items-center justify-center gap-1.5 border-t border-slate-100 py-2">
        {cards.map((_, i) => (
          <button
            key={`dot-${i}`}
            type="button"
            onClick={() => setIdx(i)}
            aria-label={`Go to card ${i + 1}`}
            className={clsx(
              "h-1.5 rounded-full transition-all",
              i === safeIdx ? "w-4 bg-slate-900" : "w-1.5 bg-slate-300"
            )}
          />
        ))}
      </div>

      {/* Ad-level body + CTA below the carousel */}
      {(primaryText || cta) && (
        <div className="space-y-2 border-t border-slate-100 px-4 py-3">
          {primaryText && (
            <p className="text-[11px] leading-relaxed text-slate-700 line-clamp-3">
              {primaryText}
            </p>
          )}
          {cta && (
            <button
              type="button"
              className="inline-flex items-center gap-1.5 rounded-md bg-slate-100 px-3 py-1.5 text-[11px] font-bold text-slate-900"
              tabIndex={-1}
            >
              {cta}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

/** Clickable + editable list of copy variants — used for the right-side
 *  panel sections (Headlines, Primary Texts, Descriptions). Click a row
 *  to pick it as the default. Click the pencil to swap the row into an
 *  inline `<input>` / `<textarea>`. Enter or the green check saves the
 *  edit; Escape or X cancels. */
function EditableVariantList({
  title,
  count,
  items,
  selectedIndex,
  onSelect,
  onEdit,
  multiline,
  maxLength,
  hidden,
  onToggleHidden,
}: {
  title: string;
  count: number;
  items: string[];
  selectedIndex: number;
  onSelect: (i: number) => void;
  onEdit: (i: number, next: string) => void;
  multiline: boolean;
  maxLength?: number;
  /** When `hidden` is true the section is excluded from the saved creative
   *  and the preview card. The eye toggle (rendered when `onToggleHidden` is
   *  provided) flips it; the list stays visible but dimmed so the user can
   *  see what they're leaving out. */
  hidden?: boolean;
  onToggleHidden?: () => void;
}) {
  const [editingIdx, setEditingIdx] = useState<number | null>(null);
  const [draft, setDraft] = useState("");

  function commit(i: number) {
    onEdit(i, draft);
    setEditingIdx(null);
  }
  function cancel() {
    setEditingIdx(null);
    setDraft("");
  }

  return (
    <div>
      <div className="mb-2 flex items-center justify-between gap-2">
        <h3
          className={clsx(
            "text-xs font-bold uppercase tracking-wider transition",
            hidden ? "text-slate-300 line-through" : "text-slate-500"
          )}
        >
          {title} · {count} options
        </h3>
        {onToggleHidden && (
          <button
            type="button"
            onClick={onToggleHidden}
            title={
              hidden
                ? `Show ${title} — include in the creative`
                : `Hide ${title} — leave out of the creative`
            }
            aria-label={hidden ? `Show ${title}` : `Hide ${title}`}
            aria-pressed={hidden}
            className={clsx(
              "flex h-6 w-6 shrink-0 items-center justify-center rounded-lg transition",
              hidden
                ? "text-slate-300 hover:bg-slate-100 hover:text-slate-500"
                : "text-slate-400 hover:bg-slate-100 hover:text-primary"
            )}
          >
            {hidden ? (
              <EyeOff className="h-3.5 w-3.5" />
            ) : (
              <Eye className="h-3.5 w-3.5" />
            )}
          </button>
        )}
      </div>
      <ul
        className={clsx(
          "space-y-1.5 transition",
          hidden && "pointer-events-none select-none opacity-40"
        )}
      >
        {items.map((line, i) => {
          const isSelected = selectedIndex === i;
          const isEditing = editingIdx === i;
          return (
            <li
              key={i}
              onClick={isEditing ? undefined : () => onSelect(i)}
              className={clsx(
                "group flex items-start justify-between gap-2 rounded-xl border-2 px-3 py-2 transition",
                !isEditing && "cursor-pointer",
                isSelected
                  ? "border-primary bg-primary/10 shadow-sm"
                  : "border-slate-200 bg-white hover:border-primary/40 hover:bg-primary/[0.04]"
              )}
            >
              {isEditing ? (
                multiline ? (
                  <textarea
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Escape") {
                        e.preventDefault();
                        cancel();
                      } else if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                        e.preventDefault();
                        commit(i);
                      }
                    }}
                    onClick={(e) => e.stopPropagation()}
                    autoFocus
                    rows={3}
                    maxLength={maxLength}
                    className="flex-1 resize-none rounded-md border border-primary/40 bg-white px-2 py-1.5 text-sm leading-snug text-slate-900 outline-none ring-2 ring-primary/15"
                  />
                ) : (
                  <input
                    type="text"
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        commit(i);
                      } else if (e.key === "Escape") {
                        e.preventDefault();
                        cancel();
                      }
                    }}
                    onClick={(e) => e.stopPropagation()}
                    autoFocus
                    maxLength={maxLength}
                    className="flex-1 rounded-md border border-primary/40 bg-white px-2 py-1 text-sm text-slate-900 outline-none ring-2 ring-primary/15"
                  />
                )
              ) : (
                <div className="flex flex-1 items-start gap-2">
                  <span
                    className={clsx(
                      "mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2 transition",
                      isSelected
                        ? "border-primary bg-primary text-white"
                        : "border-slate-300 bg-white"
                    )}
                    aria-hidden
                  >
                    {isSelected && <Check className="h-2.5 w-2.5" strokeWidth={4} />}
                  </span>
                  <p
                    className={clsx(
                      "min-w-0 flex-1 text-sm leading-snug text-slate-800",
                      multiline ? "whitespace-pre-line" : "break-words"
                    )}
                  >
                    {line}
                  </p>
                </div>
              )}
              <div className="flex shrink-0 items-center gap-1">
                {isEditing ? (
                  <>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        commit(i);
                      }}
                      title="Save edit"
                      aria-label="Save edit"
                      className="flex h-7 w-7 items-center justify-center rounded-lg text-emerald-600 hover:bg-emerald-50"
                    >
                      <Check className="h-3.5 w-3.5" strokeWidth={3} />
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        cancel();
                      }}
                      title="Cancel edit"
                      aria-label="Cancel edit"
                      className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setEditingIdx(i);
                      setDraft(line);
                    }}
                    title="Edit"
                    aria-label={`Edit "${line}"`}
                    className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 opacity-0 transition group-hover:opacity-100 hover:bg-white hover:text-primary"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/**
 * Return a copy of `arr` with the item at `idx` moved to position 0. Used
 * when saving an AI creative — the wizard auto-fills from index [0], so
 * putting the user's pick first makes the chosen variant the default.
 */
/**
 * Turn an AI-generated headline into a creative name: strip the wrapping
 * quotes the model sometimes adds and cap the length so the library card
 * title stays on a single line. Returns "" for an empty/blank headline so
 * callers can fall back to their own label.
 */
function headlineToName(headline: string): string {
  return headline.replace(/^["']|["']$/g, "").trim().slice(0, 80);
}

function pickFirst<T>(arr: T[] | undefined, idx: number): T[] {
  if (!arr || arr.length === 0) return [];
  if (idx <= 0 || idx >= arr.length) return arr;
  const out = [...arr];
  const [picked] = out.splice(idx, 1);
  out.unshift(picked);
  return out;
}

