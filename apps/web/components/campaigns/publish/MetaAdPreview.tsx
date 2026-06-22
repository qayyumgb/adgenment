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
  ChevronLeft,
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
  carouselCards,
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
  /** Carousel cards (2-10) — when set the preview becomes a multi-card
   *  carousel ad instead of a single-asset image/video. */
  carouselCards?: Array<{
    imageUrl: string | null;
    headline: string;
    description: string;
    link: string;
  }> | null;
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
            carouselCards={carouselCards ?? null}
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
            carouselCards={carouselCards ?? null}
            message={message}
            callToAction={callToAction}
          />
        )}
        {placement === "reels" &&
          (carouselCards && carouselCards.length >= 2 ? (
            // Carousels DO run on Reels & Stories (Meta added support in
            // 2023), but the format is paginated 9:16 vertical cards.
            // Square / landscape cards (the common Feed shape) get
            // letterboxed there — we render the carousel paginated inside
            // the 9:16 frame so the user sees what Meta would show.
            <ReelsCarouselAd
              pageName={pageName}
              cards={carouselCards}
              callToAction={callToAction}
            />
          ) : (
            <ReelsAd
              pageName={pageName}
              imageUrl={imageUrl}
              videoUrl={videoUrl ?? null}
              videoThumbnailUrl={videoThumbnailUrl ?? null}
              videoId={videoId ?? null}
              message={message}
              callToAction={callToAction}
            />
          ))}
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

/**
 * Carousel asset preview — paginated, one card at a time. Prev/Next arrow
 * buttons on the sides, dot indicator below. Matches how Meta actually
 * renders carousels in-feed (one card visible, swipe through) better than
 * a horizontal scroll strip.
 *
 * `square` flips the per-card aspect ratio from 1.91:1 (Facebook Feed
 * default) to 1:1 (Instagram Feed default). Reels carousels render the
 * same paginated layout — when used in the Reels mockup, the parent
 * caller wraps this in the 9:16 vertical frame.
 */
function CarouselStrip({
  cards,
  displayDomain,
  callToAction,
  square,
}: {
  cards: Array<{
    imageUrl: string | null;
    headline: string;
    description: string;
    link: string;
  }>;
  displayDomain?: string;
  callToAction: string;
  square?: boolean;
}) {
  const [index, setIndex] = useState(0);
  const safeIndex = Math.min(index, Math.max(0, cards.length - 1));
  const total = cards.length;
  if (total === 0) return null;

  function go(direction: -1 | 1) {
    setIndex((i) => Math.max(0, Math.min(total - 1, i + direction)));
  }

  return (
    <div className="bg-slate-50">
      <div className="relative px-3 py-3">
        {/* Sliding track — all cards laid out side-by-side, translated by
            -index * 100% so each tap snaps the next card into view with
            a smooth ease-out transition. Standard carousel pattern, much
            nicer than swapping which card renders. */}
        <div className="overflow-hidden rounded-lg ring-1 ring-slate-200">
          <div
            className="flex transition-transform duration-300 ease-out"
            style={{ transform: `translateX(-${safeIndex * 100}%)` }}
          >
            {cards.map((c, i) => (
              <div
                key={i}
                className="w-full shrink-0 bg-white"
                aria-hidden={i !== safeIndex}
              >
                <div className="relative bg-slate-200">
                  {c.imageUrl ? (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img
                      src={c.imageUrl}
                      alt={c.headline || `Card ${i + 1}`}
                      className={clsx(
                        "w-full object-cover",
                        square ? "aspect-square" : "aspect-[1.91/1]"
                      )}
                      // Lazy-load off-screen slides so we don't fetch all
                      // card images up-front for long carousels.
                      loading={i === safeIndex ? "eager" : "lazy"}
                    />
                  ) : (
                    <div
                      className={clsx(
                        "flex w-full items-center justify-center text-[10px] text-slate-400",
                        square ? "aspect-square" : "aspect-[1.91/1]"
                      )}
                    >
                      No image
                    </div>
                  )}
                </div>
                <div className="space-y-0.5 px-3 py-2">
                  {displayDomain && (
                    <div className="truncate text-[10px] uppercase tracking-wide text-slate-500">
                      {displayDomain}
                    </div>
                  )}
                  <div className="truncate text-[12px] font-bold leading-tight text-slate-900">
                    {c.headline || `Card ${i + 1}`}
                  </div>
                  {c.description && (
                    <div className="truncate text-[11px] text-slate-500">
                      {c.description}
                    </div>
                  )}
                  <button
                    type="button"
                    className="mt-1.5 w-full rounded-md bg-slate-200 px-2 py-1.5 text-[11px] font-semibold text-slate-900"
                  >
                    {callToAction || "Learn more"}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Prev/Next arrows — Meta uses small chevron buttons on each
            edge of the visible card. Hidden at the corresponding edge so
            users don't get confused about non-existent off-screen cards. */}
        {safeIndex > 0 && (
          <button
            type="button"
            onClick={() => go(-1)}
            aria-label="Previous card"
            className="absolute left-5 top-1/2 -translate-y-1/2 flex h-7 w-7 items-center justify-center rounded-full bg-white/95 text-slate-700 shadow-md ring-1 ring-slate-200 transition hover:bg-white"
          >
            <ChevronLeft className="h-4 w-4" strokeWidth={2.5} />
          </button>
        )}
        {safeIndex < total - 1 && (
          <button
            type="button"
            onClick={() => go(1)}
            aria-label="Next card"
            className="absolute right-5 top-1/2 -translate-y-1/2 flex h-7 w-7 items-center justify-center rounded-full bg-white/95 text-slate-700 shadow-md ring-1 ring-slate-200 transition hover:bg-white"
          >
            <ChevronRight className="h-4 w-4" strokeWidth={2.5} />
          </button>
        )}
      </div>

      {/* Dot indicator */}
      <div className="flex items-center justify-center gap-1.5 pb-3">
        {cards.map((_, i) => (
          <button
            key={i}
            type="button"
            onClick={() => setIndex(i)}
            aria-label={`Go to card ${i + 1}`}
            className={clsx(
              "h-1.5 rounded-full transition-all",
              i === safeIndex
                ? "w-4 bg-slate-900"
                : "w-1.5 bg-slate-300 hover:bg-slate-400"
            )}
          />
        ))}
      </div>
    </div>
  );
}

function FacebookFeedAd(props: {
  pageName: string;
  imageUrl: string | null;
  videoUrl: string | null;
  videoThumbnailUrl: string | null;
  videoId: string | null;
  carouselCards: Array<{
    imageUrl: string | null;
    headline: string;
    description: string;
    link: string;
  }> | null;
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
    carouselCards,
    message,
    headline,
    description,
    displayDomain,
    callToAction,
  } = props;
  const isCarousel = !!carouselCards && carouselCards.length >= 2;

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
            1. carousel cards → horizontal scroll of per-card tiles
            2. streamable video (videoUrl OR Meta videoId via source fetch)
               → <video controls> (click-to-play, lazy fetch)
            3. imageUrl → <img>
            4. fallback */}
      {isCarousel ? (
        <CarouselStrip
          cards={carouselCards!}
          displayDomain={displayDomain}
          callToAction={callToAction}
        />
      ) : (
        <>
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
        </>
      )}

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
  carouselCards: Array<{
    imageUrl: string | null;
    headline: string;
    description: string;
    link: string;
  }> | null;
  message: string;
  callToAction: string;
}) {
  const {
    pageName,
    imageUrl,
    videoUrl,
    videoThumbnailUrl,
    videoId,
    carouselCards,
    message,
    callToAction,
  } = props;
  const isCarousel = !!carouselCards && carouselCards.length >= 2;

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

      {/* Asset (square — IG default). Render-priority chain:
            carousel cards > playable video > image > fallback. */}
      {isCarousel ? (
        <CarouselStrip cards={carouselCards!} square callToAction={callToAction} />
      ) : (
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
      )}

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
/**
 * Reels / Stories carousel mockup — 9:16 vertical frame with one card
 * visible at a time, dots indicator + chevrons to paginate. Mirrors the
 * actual Meta delivery format for carousel ads on vertical placements
 * (added in 2023). When the source carousel cards aren't 9:16, Meta
 * letterboxes them; this preview reflects that with `object-contain`.
 */
function ReelsCarouselAd({
  pageName,
  cards,
  callToAction,
}: {
  pageName: string;
  cards: Array<{
    imageUrl: string | null;
    headline: string;
    description: string;
    link: string;
  }>;
  callToAction: string;
}) {
  const [index, setIndex] = useState(0);
  const safeIndex = Math.min(index, Math.max(0, cards.length - 1));
  const total = cards.length;
  if (total === 0) return null;

  function go(direction: -1 | 1) {
    setIndex((i) => Math.max(0, Math.min(total - 1, i + direction)));
  }

  return (
    <div className="mx-auto w-full max-w-[240px] overflow-hidden rounded-2xl bg-black shadow-lg ring-1 ring-slate-300">
      <div className="relative aspect-[9/16] w-full overflow-hidden bg-slate-900">
        {/* Sliding track of full-frame cards. Each card stretches to the
            full 9:16 frame and holds its own asset + headline + CTA so
            the whole card slides as one unit (matches Reels delivery). */}
        <div
          className="absolute inset-0 flex transition-transform duration-300 ease-out"
          style={{ transform: `translateX(-${safeIndex * 100}%)` }}
        >
          {cards.map((c, i) => (
            <div
              key={i}
              className="relative h-full w-full shrink-0"
              aria-hidden={i !== safeIndex}
            >
              {c.imageUrl ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                  src={c.imageUrl}
                  alt={c.headline || `Card ${i + 1}`}
                  className="h-full w-full object-contain"
                  loading={i === safeIndex ? "eager" : "lazy"}
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-xs text-slate-500">
                  No image
                </div>
              )}

              {/* Per-card bottom caption + CTA — slides with the card so
                  the copy stays in sync with the image. */}
              <div className="absolute inset-x-0 bottom-0 space-y-2 bg-gradient-to-t from-black/85 via-black/40 to-transparent p-3 pb-7">
                {c.headline && (
                  <p className="line-clamp-2 text-[11px] font-bold leading-snug text-white">
                    {c.headline}
                  </p>
                )}
                <button
                  type="button"
                  className="w-full rounded-md bg-white py-1.5 text-[11px] font-bold text-slate-900 shadow-sm"
                >
                  {callToAction || "Learn more"}
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* Static chrome layered above the sliding track — page chip, side
            rail, chevrons, and dots all stay put as cards swipe under. */}
        <div className="pointer-events-none absolute left-3 top-3 flex items-center gap-2 text-white drop-shadow">
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

        <div className="pointer-events-none absolute right-2 top-1/3 flex flex-col items-center gap-3 text-white drop-shadow">
          <Heart className="h-5 w-5" />
          <MessageCircle className="h-5 w-5" />
          <Send className="h-5 w-5" />
          <Bookmark className="h-5 w-5" />
          <MoreHorizontal className="h-5 w-5" />
        </div>

        {safeIndex > 0 && (
          <button
            type="button"
            onClick={() => go(-1)}
            aria-label="Previous card"
            className="absolute left-2 top-1/2 -translate-y-1/2 flex h-6 w-6 items-center justify-center rounded-full bg-white/85 text-slate-900 shadow"
          >
            <ChevronLeft className="h-3.5 w-3.5" strokeWidth={2.5} />
          </button>
        )}
        {safeIndex < total - 1 && (
          <button
            type="button"
            onClick={() => go(1)}
            aria-label="Next card"
            className="absolute right-10 top-1/2 -translate-y-1/2 flex h-6 w-6 items-center justify-center rounded-full bg-white/85 text-slate-900 shadow"
          >
            <ChevronRight className="h-3.5 w-3.5" strokeWidth={2.5} />
          </button>
        )}

        {/* Dot indicator pinned to the very bottom of the frame. */}
        <div className="absolute inset-x-0 bottom-1 flex items-center justify-center gap-1.5">
          {cards.map((_, i) => (
            <button
              key={i}
              type="button"
              onClick={() => setIndex(i)}
              aria-label={`Go to card ${i + 1}`}
              className={clsx(
                "h-1 rounded-full transition-all",
                i === safeIndex ? "w-4 bg-white" : "w-1 bg-white/40"
              )}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

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
