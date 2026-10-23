/**
 * Shared creative helpers (moved from the old Creatives page in A8): upload
 * limits, video metadata, carousel card drafts, and readers for the
 * free-form `creative.content` JSON.
 */
import type { Creative as ApiCreative } from "@/lib/api";

export const MAX_IMAGE_BYTES = 8 * 1024 * 1024; // Meta's hard cap on /adimages
export const MAX_VIDEO_BYTES = 200 * 1024 * 1024; // Matches the API route's multer limit
export const ACCEPTED_IMAGE_TYPES = "image/jpeg,image/jpg,image/png,image/webp,image/gif";
export const ACCEPTED_VIDEO_TYPES = "video/mp4,video/quicktime,video/webm";

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
export async function readVideoMetadata(
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
export type VideoOrientation = "horizontal" | "square" | "vertical";
export function classifyOrientation(width: number, height: number): VideoOrientation {
  const ratio = width / height;
  if (ratio >= 1.5) return "horizontal";
  if (ratio >= 0.85) return "square";
  return "vertical";
}

export type UploadTab = "device" | "url";

/** Single carousel card while the user is composing it in the upload
 *  modal OR editing it in the detail modal. `file` is a freshly picked
 *  image; `savedImageUrl` / `savedImageHash` are present when the card
 *  was already uploaded (edit mode). Headlines / descriptions / links
 *  are all optional — Meta falls back to the ad-level link + the card
 *  index when omitted. */
export type CarouselCardDraft = {
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

export function emptyCard(): CarouselCardDraft {
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
export function cardId(): string {
  return Math.random().toString(36).slice(2, 10);
}

/** The view of a library creative the edit dialog works with. */
export type CreativeView = {
  id: string;
  name: string;
  type: ApiCreative["type"];
  aiGenerated: boolean;
  url?: string;
  videoId?: string;
  copy?: string;
  cardCount?: number;
  createdAt: string;
};

export function extractCopy(content: unknown): string | undefined {
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

export function extractMediaUrl(content: unknown): string | undefined {
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

export function extractVideoId(content: unknown): string | undefined {
  if (!content || typeof content !== "object") return undefined;
  const obj = content as Record<string, unknown>;
  return typeof obj.videoId === "string" ? obj.videoId : undefined;
}

export function extractCardCount(content: unknown): number | undefined {
  if (!content || typeof content !== "object") return undefined;
  const obj = content as Record<string, unknown>;
  return Array.isArray(obj.cards) ? obj.cards.length : undefined;
}

export function toView(c: ApiCreative): CreativeView {
  return {
    id: c.id,
    name: c.name,
    type: c.type,
    aiGenerated: c.aiGenerated,
    url: extractMediaUrl(c.content),
    videoId: extractVideoId(c.content),
    copy: extractCopy(c.content),
    cardCount: extractCardCount(c.content),
    createdAt: c.createdAt.slice(0, 10),
  };
}

/**
 * Turn an AI-generated headline into a creative name: strip wrapping quotes
 * and cap the length so the card title stays on one line. "" when blank.
 */
export function headlineToName(headline: string): string {
  return headline.replace(/^["']|["']$/g, "").trim().slice(0, 80);
}

/** `arr` with the item at `idx` moved first (the publish wizard uses index 0). */
export function pickFirst<T>(arr: T[] | undefined, idx: number): T[] {
  if (!arr || arr.length === 0) return [];
  if (idx <= 0 || idx >= arr.length) return arr;
  const out = [...arr];
  const [picked] = out.splice(idx, 1);
  out.unshift(picked);
  return out;
}
