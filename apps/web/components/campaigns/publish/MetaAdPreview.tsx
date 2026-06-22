"use client";

import { useState } from "react";
import clsx from "clsx";
import {
  ThumbsUp,
  MessageCircle,
  Share2,
  Bookmark,
  MoreHorizontal,
  Heart,
  Send,
  ChevronRight,
} from "lucide-react";
import { VideoThumbnailPlayer } from "@/components/ui/VideoThumbnailPlayer";

/**
 * Renders a faithful mock of how an ad will look in Facebook Feed and
 * Instagram Feed — the two most common placements for Meta ads. The mock
 * uses the same fields the publish wizard sends to the Marketing API so
 * what the user sees here is what they'll see on Meta.
 *
 * This is intentionally not pixel-perfect to Meta's UI (their CSS changes
 * monthly) — it gives users enough visual signal to validate copy + image
 * length, line wrapping, and CTA placement before they hit Publish.
 */
export function MetaAdPreview({
  pageName,
  imageUrl,
  videoUrl,
  videoThumbnailUrl,
  videoId,
  message,
  headline,
  description,
  linkUrl,
  callToAction,
  initialPlacement = "facebook",
}: {
  pageName: string;
  imageUrl: string | null;
  /** When set, the preview renders an inline video instead of an image. */
  videoUrl?: string | null;
  /** Used as the <video poster> — Meta's auto-generated thumbnail. */
  videoThumbnailUrl?: string | null;
  /** Meta video_id — used by the player to fetch a fresh signed MP4 URL
   *  on demand (device-upload videos don't have a public stream URL). */
  videoId?: string | null;
  message: string;
  headline: string;
  description: string;
  linkUrl: string;
  callToAction: string;
  /** Which tab to land on initially. Driven by the wizard's placement
   *  picker so "Reels & Stories only" auto-selects the Reels mockup
   *  here instead of the default Facebook Feed. The user can still
   *  flip tabs after — this is just the seed. */
  initialPlacement?: "facebook" | "instagram" | "reels";
}) {
  const [placement, setPlacement] = useState<
    "facebook" | "instagram" | "reels"
  >(initialPlacement);

  // Strip protocol + path → just the bare domain to look like a real ad's
  // bottom row ("yourbrand.com" rather than "https://yourbrand.com/path").
  const displayDomain = (() => {
    if (!linkUrl) return "yourbrand.com";
    try {
      return new URL(linkUrl).hostname.replace(/^www\./, "");
    } catch {
      return linkUrl;
    }
  })();

  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <label className="text-xs font-bold uppercase tracking-wider text-slate-500">
          Ad preview
        </label>
        <div className="flex rounded-full border border-slate-200 bg-white p-0.5">
          <button
            type="button"
            onClick={() => setPlacement("facebook")}
            className={clsx(
              "rounded-full px-3 py-1 text-xs font-bold transition",
              placement === "facebook"
                ? "bg-[#1877F2] text-white shadow-sm"
                : "text-slate-600 hover:text-slate-900"
            )}
          >
            Facebook
          </button>
          <button
            type="button"
            onClick={() => setPlacement("instagram")}
            className={clsx(
              "rounded-full px-3 py-1 text-xs font-bold transition",
              placement === "instagram"
                ? "bg-gradient-to-tr from-yellow-400 via-pink-500 to-purple-600 text-white shadow-sm"
                : "text-slate-600 hover:text-slate-900"
            )}
          >
            Instagram
          </button>
          <button
            type="button"
            onClick={() => setPlacement("reels")}
            className={clsx(
              "rounded-full px-3 py-1 text-xs font-bold transition",
              placement === "reels"
                ? "bg-slate-900 text-white shadow-sm"
                : "text-slate-600 hover:text-slate-900"
            )}
          >
            Reels / Stories
          </button>
        </div>
      </div>

      <div className="rounded-2xl bg-slate-100 p-4">
        {placement === "facebook" && (
          <FacebookFeedAd
            pageName={pageName}
            imageUrl={imageUrl}
            videoUrl={videoUrl ?? null}
            videoThumbnailUrl={videoThumbnailUrl ?? null}
            videoId={videoId ?? null}
            message={message}
            headline={headline}
            description={description}
            displayDomain={displayDomain}
            callToAction={callToAction}
          />
        )}
        {placement === "instagram" && (
          <InstagramFeedAd
            pageName={pageName}
            imageUrl={imageUrl}
            videoUrl={videoUrl ?? null}
            videoThumbnailUrl={videoThumbnailUrl ?? null}
            videoId={videoId ?? null}
            message={message}
            callToAction={callToAction}
          />
        )}
        {placement === "reels" && (
          <ReelsAd
            pageName={pageName}
            imageUrl={imageUrl}
            videoUrl={videoUrl ?? null}
            videoThumbnailUrl={videoThumbnailUrl ?? null}
            videoId={videoId ?? null}
            message={message}
            callToAction={callToAction}
          />
        )}
      </div>
    </div>
  );
}

function PageAvatar({ pageName }: { pageName: string }) {
  const initial = (pageName.trim().charAt(0) || "A").toUpperCase();
  return (
    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 text-sm font-bold text-white">
      {initial}
    </div>
  );
}

function FacebookFeedAd(props: {
  pageName: string;
  imageUrl: string | null;
  videoUrl: string | null;
  videoThumbnailUrl: string | null;
  videoId: string | null;
  message: string;
  headline: string;
  description: string;
  displayDomain: string;
  callToAction: string;
}) {
  const {
    pageName,
    imageUrl,
    videoUrl,
    videoThumbnailUrl,
    videoId,
    message,
    headline,
    description,
    displayDomain,
    callToAction,
  } = props;

  return (
    <div className="mx-auto max-w-md overflow-hidden rounded-xl bg-white shadow-sm ring-1 ring-slate-200">
      {/* Header */}
      <div className="flex items-center gap-2.5 px-3 pt-3 pb-2">
        <PageAvatar pageName={pageName} />
        <div className="min-w-0 flex-1">
          <div className="truncate text-[13px] font-semibold text-slate-900">
            {pageName}
          </div>
          <div className="text-[11px] text-slate-500">Sponsored · 🌐</div>
        </div>
        <button
          type="button"
          aria-label="More"
          className="flex h-7 w-7 items-center justify-center rounded-full text-slate-500 hover:bg-slate-100"
        >
          <MoreHorizontal className="h-4 w-4" />
        </button>
      </div>

      {/* Body text */}
      {message && (
        <div className="px-3 pb-2">
          <p className="whitespace-pre-line text-[13px] leading-snug text-slate-900">
            {message}
          </p>
        </div>
      )}

      {/* Asset render priority:
            1. streamable video (videoUrl OR Meta videoId via source fetch)
               → <video controls> (click-to-play, lazy fetch)
            2. imageUrl → <img>
            3. fallback */}
      <div className="relative bg-slate-200">
        {videoUrl || videoId || videoThumbnailUrl ? (
          <VideoThumbnailPlayer
            thumbnailUrl={videoThumbnailUrl ?? null}
            videoId={videoId ?? null}
            directSrc={videoUrl ?? null}
            alt={headline || "Video ad preview"}
            className="aspect-[1.91/1] w-full"
            buttonSize="md"
            showBadge={false}
          />
        ) : imageUrl ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={imageUrl}
            alt={headline || "Ad creative"}
            className="aspect-[1.91/1] w-full object-cover"
          />
        ) : (
          <div className="flex aspect-[1.91/1] w-full items-center justify-center bg-slate-200 text-xs text-slate-500">
            No asset — pick a creative in Step 5
          </div>
        )}
      </div>

      {/* Link card (domain + headline + description + CTA) */}
      <div className="flex items-center gap-3 bg-slate-50 px-3 py-2">
        <div className="min-w-0 flex-1">
          <div className="truncate text-[10px] uppercase tracking-wide text-slate-500">
            {displayDomain}
          </div>
          <div className="truncate text-[13px] font-bold leading-tight text-slate-900">
            {headline || "Your headline goes here"}
          </div>
          {description && (
            <div className="truncate text-[11px] text-slate-500">
              {description}
            </div>
          )}
        </div>
        <button
          type="button"
          className="shrink-0 rounded-md bg-slate-200 px-3 py-1.5 text-[11px] font-semibold text-slate-900 hover:bg-slate-300"
        >
          {callToAction || "Learn more"}
        </button>
      </div>

      {/* Engagement bar (visual only) */}
      <div className="flex items-center gap-1 border-t border-slate-100 px-1.5 py-1 text-slate-600">
        <EngagementButton icon={ThumbsUp} label="Like" />
        <EngagementButton icon={MessageCircle} label="Comment" />
        <EngagementButton icon={Share2} label="Share" />
      </div>
    </div>
  );
}

function EngagementButton({
  icon: Icon,
  label,
}: {
  icon: typeof ThumbsUp;
  label: string;
}) {
  return (
    <button
      type="button"
      className="flex flex-1 items-center justify-center gap-1.5 rounded-md py-1.5 text-[11px] font-semibold hover:bg-slate-100"
    >
      <Icon className="h-3.5 w-3.5" />
      {label}
    </button>
  );
}

function InstagramFeedAd(props: {
  pageName: string;
  imageUrl: string | null;
  videoUrl: string | null;
  videoThumbnailUrl: string | null;
  videoId: string | null;
  message: string;
  callToAction: string;
}) {
  const {
    pageName,
    imageUrl,
    videoUrl,
    videoThumbnailUrl,
    videoId,
    message,
    callToAction,
  } = props;

  return (
    <div className="mx-auto max-w-sm overflow-hidden rounded-xl bg-white shadow-sm ring-1 ring-slate-200">
      {/* Header */}
      <div className="flex items-center gap-2.5 px-3 py-2">
        <div className="rounded-full bg-gradient-to-tr from-yellow-400 via-pink-500 to-purple-600 p-[2px]">
          <div className="rounded-full bg-white p-[2px]">
            <PageAvatar pageName={pageName} />
          </div>
        </div>
        <div className="min-w-0 flex-1">
          <div className="truncate text-[13px] font-semibold text-slate-900">
            {pageName}
          </div>
          <div className="text-[11px] text-slate-500">Sponsored</div>
        </div>
        <button
          type="button"
          aria-label="More"
          className="flex h-7 w-7 items-center justify-center rounded-full text-slate-500 hover:bg-slate-100"
        >
          <MoreHorizontal className="h-4 w-4" />
        </button>
      </div>

      {/* Asset (square — IG default). Same render-priority chain as the
          Facebook variant: playable video (lazy-fetched from Meta) > image
          > fallback. */}
      <div className="relative bg-slate-200">
        {videoUrl || videoId || videoThumbnailUrl ? (
          <VideoThumbnailPlayer
            thumbnailUrl={videoThumbnailUrl ?? null}
            videoId={videoId ?? null}
            directSrc={videoUrl ?? null}
            alt="Video ad preview"
            className="aspect-square w-full"
            buttonSize="md"
            showBadge={false}
          />
        ) : imageUrl ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={imageUrl}
            alt="Ad creative"
            className="aspect-square w-full object-cover"
          />
        ) : (
          <div className="flex aspect-square w-full items-center justify-center bg-slate-200 text-xs text-slate-500">
            No asset — pick a creative in Step 5
          </div>
        )}

        {/* CTA bar over the image (IG style) */}
        <div className="absolute inset-x-0 bottom-0 flex items-center justify-between bg-gradient-to-t from-black/40 to-transparent px-3 pt-6 pb-2 text-white">
          <span className="text-[11px] font-semibold">{callToAction || "Learn more"}</span>
          <ChevronRight className="h-4 w-4" />
        </div>
      </div>

      {/* Engagement row */}
      <div className="flex items-center gap-3 px-3 py-2 text-slate-700">
        <Heart className="h-5 w-5" />
        <MessageCircle className="h-5 w-5" />
        <Send className="h-5 w-5" />
        <Bookmark className="ml-auto h-5 w-5" />
      </div>

      {/* Caption */}
      {message && (
        <div className="px-3 pb-3 text-[12px] leading-snug text-slate-900">
          <span className="font-semibold">{pageName}</span>{" "}
          <span className="whitespace-pre-line text-slate-700">{message}</span>
        </div>
      )}
    </div>
  );
}

/**
 * Reels / Stories ad mockup. Renders the 9:16 vertical placement used by
 * Instagram Reels, Facebook Reels, and Stories on both platforms (they all
 * share the same vertical immersive layout — page avatar + name in the
 * top-left, side icons for like/comment/share/audio on the right, CTA
 * button anchored at the bottom over the asset).
 *
 * If the user picked a horizontal/square video this mockup looks visibly
 * wrong (the asset gets letterboxed inside the 9:16 frame) — that's an
 * intentional truthful preview. The PlacementPicker also warns explicitly
 * about that mismatch upstream.
 */
function ReelsAd(props: {
  pageName: string;
  imageUrl: string | null;
  videoUrl: string | null;
  videoThumbnailUrl: string | null;
  videoId: string | null;
  message: string;
  callToAction: string;
}) {
  const {
    pageName,
    imageUrl,
    videoUrl,
    videoThumbnailUrl,
    videoId,
    message,
    callToAction,
  } = props;

  const hasAsset =
    Boolean(videoUrl || videoId || videoThumbnailUrl) || Boolean(imageUrl);

  return (
    <div className="mx-auto w-full max-w-[240px] overflow-hidden rounded-2xl bg-black shadow-lg ring-1 ring-slate-300">
      {/* 9:16 stage */}
      <div className="relative aspect-[9/16] w-full bg-slate-900">
        {videoUrl || videoId || videoThumbnailUrl ? (
          <VideoThumbnailPlayer
            thumbnailUrl={videoThumbnailUrl ?? null}
            videoId={videoId ?? null}
            directSrc={videoUrl ?? null}
            alt="Reels ad preview"
            className="h-full w-full"
            buttonSize="md"
            showBadge={false}
          />
        ) : imageUrl ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={imageUrl}
            alt="Ad creative"
            className="h-full w-full object-contain"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-xs text-slate-500">
            No asset
          </div>
        )}

        {/* Top-left: page chip */}
        <div className="absolute left-3 top-3 flex items-center gap-2 text-white drop-shadow">
          <div className="rounded-full bg-gradient-to-tr from-yellow-400 via-pink-500 to-purple-600 p-[1.5px]">
            <div className="rounded-full bg-black p-[1.5px]">
              <PageAvatar pageName={pageName} />
            </div>
          </div>
          <div className="min-w-0">
            <div className="truncate text-[12px] font-semibold">{pageName}</div>
            <div className="text-[10px] opacity-80">Sponsored · Follow</div>
          </div>
        </div>

        {/* Right rail: like / comment / share / audio */}
        <div className="pointer-events-none absolute right-2 top-1/3 flex flex-col items-center gap-3 text-white drop-shadow">
          <Heart className="h-5 w-5" />
          <MessageCircle className="h-5 w-5" />
          <Send className="h-5 w-5" />
          <Bookmark className="h-5 w-5" />
          <MoreHorizontal className="h-5 w-5" />
        </div>

        {/* Bottom: caption + CTA, sitting over a gradient scrim so they're
            legible on any background. */}
        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 via-black/40 to-transparent p-3">
          {message && (
            <p className="line-clamp-3 text-[11px] leading-snug text-white">
              {message}
            </p>
          )}
          <button
            type="button"
            className="mt-2 w-full rounded-md bg-white py-1.5 text-[11px] font-bold text-slate-900 shadow-sm"
          >
            {callToAction || "Learn more"}
          </button>
        </div>

        {!hasAsset && null}
      </div>
    </div>
  );
}
