"use client";

import { useState } from "react";
import clsx from "clsx";
import { Loader2, Play, ExternalLink } from "lucide-react";
import { useApiClient } from "@/lib/api";

/**
 * Renders a video creative's thumbnail with a play button overlay. On click
 * we hit `/meta/video-source/:videoId` to get a fresh signed MP4 URL from
 * Meta, then swap the thumbnail for an inline `<video controls autoPlay>`.
 *
 * Why fetch on click instead of at mount? Two reasons:
 *   1. The signed URL Meta returns rotates every few hours — caching it
 *      in state at mount time would break replay later in the session.
 *   2. Each fetch is a real Graph API call (cost / rate-limit). Lazy
 *      fetch keeps the library grid cheap to render.
 *
 * If `directSrc` is provided (e.g. user pasted a public video URL), we
 * skip the fetch entirely and use it directly. Useful for the URL-paste
 * code path where we already have a streamable URL.
 *
 * If the fetch fails (Meta rate-limited us, video not yet transcoded, etc),
 * we fall back to the Facebook permalink — opens in a new tab. Better than
 * a dead play button.
 */
export function VideoThumbnailPlayer({
  thumbnailUrl,
  videoId,
  directSrc,
  alt,
  className,
  buttonSize = "md",
  showBadge = true,
}: {
  thumbnailUrl: string | null;
  /** Meta's video_id — used to fetch the signed source URL on demand. */
  videoId: string | null;
  /** Bypasses the Meta source fetch when we already have a streamable URL. */
  directSrc?: string | null;
  alt?: string;
  className?: string;
  buttonSize?: "sm" | "md" | "lg";
  /** Hide the "VIDEO" corner badge — useful in MetaAdPreview where we
   *  don't want a chip cluttering the mock ad frame. */
  showBadge?: boolean;
}) {
  const api = useApiClient();
  const [src, setSrc] = useState<string | null>(directSrc ?? null);
  const [loading, setLoading] = useState(false);
  const [permalink, setPermalink] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handlePlay() {
    if (src || loading) return;
    if (directSrc) {
      setSrc(directSrc);
      return;
    }
    if (!videoId) {
      setError("This video has no playable preview");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const result = await api.getMetaVideoSource(videoId);
      if (result.source) {
        setSrc(result.source);
      } else if (result.permalinkUrl) {
        // Meta withheld the source — surface the FB permalink so the user
        // can still see it. Cleaner than a broken player.
        setPermalink(result.permalinkUrl);
        setError("Open on Facebook to play");
      } else {
        setError("Video is still processing — try again in a minute");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load video");
    } finally {
      setLoading(false);
    }
  }

  // Sizing for the central play button — the same component renders in
  // a 64px library card, a wizard preview, and a full detail modal.
  const btnClass = {
    sm: "h-9 w-9",
    md: "h-12 w-12",
    lg: "h-16 w-16",
  }[buttonSize];
  const iconClass = {
    sm: "h-4 w-4",
    md: "h-5 w-5",
    lg: "h-7 w-7",
  }[buttonSize];

  // Playback state — `<video>` element directly.
  if (src) {
    return (
      <video
        src={src}
        poster={thumbnailUrl ?? undefined}
        controls
        autoPlay
        playsInline
        className={clsx("bg-slate-900 object-contain", className)}
      />
    );
  }

  // Idle / loading / error state — thumbnail + clickable overlay.
  return (
    <button
      type="button"
      onClick={handlePlay}
      disabled={loading}
      className={clsx(
        "group relative block w-full overflow-hidden bg-slate-900",
        className
      )}
      aria-label={alt ?? "Play video"}
    >
      {thumbnailUrl ? (
        /* eslint-disable-next-line @next/next/no-img-element */
        <img
          src={thumbnailUrl}
          alt={alt ?? "Video thumbnail"}
          className="h-full w-full object-contain"
        />
      ) : (
        <div className="flex h-full w-full items-center justify-center bg-slate-800 text-xs text-slate-500">
          No thumbnail
        </div>
      )}

      {/* Dim + play button overlay. Brighter on hover. */}
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/20 transition group-hover:bg-black/30">
        <div
          className={clsx(
            "flex items-center justify-center rounded-full bg-white/95 shadow-xl transition group-hover:scale-105",
            btnClass
          )}
        >
          {loading ? (
            <Loader2
              className={clsx("animate-spin text-slate-900", iconClass)}
            />
          ) : (
            <Play
              className={clsx("ml-0.5 text-slate-900", iconClass)}
              fill="currentColor"
              strokeWidth={0}
            />
          )}
        </div>
      </div>

      {showBadge && (
        <span className="absolute left-2 top-2 inline-flex items-center gap-1 rounded-full bg-slate-900/85 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-white shadow-sm backdrop-blur">
          Video
        </span>
      )}

      {/* Error footer — only visible when Meta declined the source. The
          permalink (when present) lets users still see the video on FB. */}
      {error && (
        <div className="absolute inset-x-0 bottom-0 flex items-center justify-between gap-2 bg-slate-900/85 px-3 py-1.5 text-[10px] font-semibold text-white backdrop-blur">
          <span className="truncate">{error}</span>
          {permalink && (
            <a
              href={permalink}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="pointer-events-auto inline-flex items-center gap-1 rounded-md bg-white/15 px-1.5 py-0.5 hover:bg-white/25"
            >
              Open <ExternalLink className="h-2.5 w-2.5" />
            </a>
          )}
        </div>
      )}
    </button>
  );
}
