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
  message,
  headline,
  description,
  linkUrl,
  callToAction,
}: {
  pageName: string;
  imageUrl: string | null;
  message: string;
  headline: string;
  description: string;
  linkUrl: string;
  callToAction: string;
}) {
  const [placement, setPlacement] = useState<"facebook" | "instagram">(
    "facebook"
  );

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
        </div>
      </div>

      <div className="rounded-2xl bg-slate-100 p-4">
        {placement === "facebook" ? (
          <FacebookFeedAd
            pageName={pageName}
            imageUrl={imageUrl}
            message={message}
            headline={headline}
            description={description}
            displayDomain={displayDomain}
            callToAction={callToAction}
          />
        ) : (
          <InstagramFeedAd
            pageName={pageName}
            imageUrl={imageUrl}
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
  message: string;
  headline: string;
  description: string;
  displayDomain: string;
  callToAction: string;
}) {
  const {
    pageName,
    imageUrl,
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

      {/* Image */}
      <div className="relative bg-slate-200">
        {imageUrl ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={imageUrl}
            alt={headline || "Ad creative"}
            className="aspect-[1.91/1] w-full object-cover"
          />
        ) : (
          <div className="flex aspect-[1.91/1] w-full items-center justify-center bg-slate-200 text-xs text-slate-500">
            No image — upload one in Step 5
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
  message: string;
  callToAction: string;
}) {
  const { pageName, imageUrl, message, callToAction } = props;

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

      {/* Image (square — IG default) */}
      <div className="relative bg-slate-200">
        {imageUrl ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={imageUrl}
            alt="Ad creative"
            className="aspect-square w-full object-cover"
          />
        ) : (
          <div className="flex aspect-square w-full items-center justify-center bg-slate-200 text-xs text-slate-500">
            No image — upload one in Step 5
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
