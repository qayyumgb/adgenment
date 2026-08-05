"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import clsx from "clsx";
import toast from "react-hot-toast";
import {
  X,
  Check,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Rocket,
  Users,
  MapPin,
  Image as ImageIcon,
  Target,
  CalendarRange,
  Eye,
  Upload,
  Search,
  Library,
  Link as LinkIcon,
  Sparkles,
  Plus,
  Minus,
  ExternalLink,
} from "lucide-react";
import { useApi } from "@/hooks/useApi";
import { useApiClient, ApiError } from "@/lib/api";
import { fmtMoney } from "@/lib/money";
import { MetaAdPreview } from "./MetaAdPreview";
import MetaErrorCard from "@/components/ui/MetaErrorCard";
import type {
  Campaign,
  MetaPage,
  MetaCustomAudience,
  MetaSavedAudience,
  MetaTargetingSuggestion,
  MetaGeoLocation,
  MetaCallToAction,
  MetaTargetingSpec,
  MetaPixel,
  PublishCampaignPayload,
  PublishCampaignResult,
  Creative,
  CreativesResponse,
} from "@/lib/api";
import {
  CountryPicker,
  CityPicker,
  InterestPicker,
  CustomAudiencePicker,
  SavedAudiencePicker,
  type SelectedCity,
  type SelectedInterest,
  type SelectedAudience,
} from "@/components/targeting/pickers";

/* ──────────────────────────────────────────────────────────────────── */
/* Types                                                                */
/* ──────────────────────────────────────────────────────────────────── */

interface PublishToMetaModalProps {
  open: boolean;
  campaign: Campaign;
  onClose: () => void;
  onPublished: (result: PublishCampaignResult) => void;
}

interface WizardState {
  // Step 1
  pageId: string;
  pageName: string;
  // Step 2 (objective is taken from the campaign — confirmed here)
  // Step 3 — Audience (Full)
  countries: string[]; // ISO 2-letter codes
  cities: SelectedCity[];
  excludedCities: SelectedCity[];
  ageMin: number;
  ageMax: number;
  genders: number[]; // [] = all, [1] = male, [2] = female
  interests: SelectedInterest[];
  customAudiences: SelectedAudience[];
  excludedCustomAudiences: SelectedAudience[];
  savedAudiences: SelectedAudience[];
  // Step 4 (schedule is taken from the campaign — confirmed here)
  // Step 5
  creativeSource: "upload" | "library" | "url";
  /** Type of the chosen asset. Drives which fields downstream we use. */
  creativeType: "IMAGE" | "VIDEO" | "CAROUSEL";
  /** Carousel cards (2-10). Populated when the user picks a carousel
   *  library creative — read-only in the wizard for MVP (edits happen
   *  in the Creatives tab). */
  carouselCards: Array<{
    imageUrl: string | null;
    imageHash: string | null;
    headline: string;
    description: string;
    link: string;
  }>;
  /** Placement preset — translated into publisher_platforms +
   *  facebook_positions + instagram_positions at submit time. */
  placement: PlacementMode;
  /** Probed video dimensions when the picked creative is a video, used to
   *  warn about placement-vs-aspect-ratio mismatches. */
  videoWidth: number | null;
  videoHeight: number | null;
  imageHash: string | null;
  imageUrl: string | null; // populated either from URL paste OR from upload preview
  /** Video-ad inputs. `videoId` is Meta's already-uploaded handle (set when
   *  the user picks a library video that was uploaded via Upload Creative).
   *  `videoUrl` is set when the user pastes a public URL — the backend
   *  uploads to Meta + polls transcode at publish time. `thumbnailUrl` is
   *  Meta's auto-generated poster, surfaced after transcode. */
  videoId: string | null;
  videoUrl: string | null;
  thumbnailUrl: string | null;
  libraryCreativeId: string | null;
  libraryCreativeName: string | null;
  headline: string;
  message: string;
  description: string;
  // When the user picks a library creative that came from AI Generate, we
  // populate all the alternate variants here so they can swap between them
  // via inline chips below each field. Empty arrays = no variants to pick.
  headlineVariants: string[];
  messageVariants: string[];
  descriptionVariants: string[];
  // CTA variants come from the AI as free text ("Shop now", "Learn more")
  // but Meta's CTA field is a fixed enum. We store the enum-mapped variants
  // so the chips can directly patch `callToAction`.
  ctaVariants: MetaCallToAction[];
  linkUrl: string;
  callToAction: MetaCallToAction;
  uploading: boolean;
  uploadFile: File | null;
}

/* ──────────────────────────────────────────────────────────────────── */
/* Copy limits                                                          */
/* ──────────────────────────────────────────────────────────────────── */

/**
 * Meta's hard caps, and the soft "start warning here" points.
 *
 * The warning thresholds sit BELOW the hard caps on purpose: Meta truncates
 * with an ellipsis well before the field limit on most placements, so an ad
 * that fits the cap can still read as cut off in the feed. Warning at 38/120
 * gives the user room to land the sentence instead of discovering the problem
 * in a live ad.
 */
const COPY_LIMITS = {
  headline: { warn: 38, max: 40 },
  message: { warn: 120, max: 2200 },
  description: { warn: 28, max: 120 },
} as const;

/** Is this something Meta will accept as a destination? Mirrors the identical
 *  server-side check so the user is corrected before they hit Publish. */
function isValidDestinationUrl(value: string): boolean {
  let url: URL;
  try {
    url = new URL(value.trim());
  } catch {
    return false;
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") return false;
  return url.hostname.includes(".") && !url.hostname.endsWith(".");
}

/** Where the ad runs. Maps to Meta's publisher_platforms + positions
 *  arrays at submit time. "all" defers to Meta's Advantage+ placements
 *  recommendation, which is what 95% of advertisers should use unless they
 *  have a specific format constraint (e.g. a 9:16-only video). */
type PlacementMode = "all" | "feed" | "reels_stories";

const PLACEMENT_OPTIONS: Array<{
  value: PlacementMode;
  label: string;
  description: string;
}> = [
  {
    value: "all",
    label: "All placements",
    description:
      "Recommended. Meta picks the best mix of Feed, Reels, Stories and the rest.",
  },
  {
    value: "feed",
    label: "Feed only",
    description: "Facebook + Instagram Feed. Square / 4:5 / 16:9 videos work best.",
  },
  {
    value: "reels_stories",
    label: "Reels & Stories only",
    description:
      "Vertical placements only. Needs a 9:16 video — square / landscape will fail delivery.",
  },
];

/**
 * Convert a PlacementMode to the Meta targeting fields. Returns the partial
 * targeting object the caller merges into the full MetaTargetingSpec.
 *
 * For "all" we omit publisher_platforms entirely — Meta treats absence as
 * "auto placements". For the constrained modes we pin BOTH the platform
 * list AND the per-platform positions (Meta rejects an ad set that has
 * publisher_platforms without matching positions arrays).
 */
function placementToTargeting(
  mode: PlacementMode
): Partial<MetaTargetingSpec> {
  switch (mode) {
    case "all":
      return {};
    case "feed":
      return {
        publisher_platforms: ["facebook", "instagram"],
        facebook_positions: ["feed", "video_feeds"],
        instagram_positions: ["stream", "explore"],
      };
    case "reels_stories":
      return {
        publisher_platforms: ["facebook", "instagram"],
        facebook_positions: ["facebook_reels", "story"],
        instagram_positions: ["reels", "story"],
      };
  }
}

const STEP_LABELS = [
  { key: "page", label: "Page", icon: Sparkles },
  { key: "objective", label: "Objective", icon: Target },
  { key: "audience", label: "Audience", icon: Users },
  { key: "schedule", label: "Schedule", icon: CalendarRange },
  { key: "creative", label: "Creative", icon: ImageIcon },
  { key: "review", label: "Review", icon: Eye },
] as const;

const CTA_OPTIONS: { value: MetaCallToAction; label: string }[] = [
  { value: "LEARN_MORE", label: "Learn More" },
  { value: "SIGN_UP", label: "Sign Up" },
  { value: "SHOP_NOW", label: "Shop Now" },
  { value: "DOWNLOAD", label: "Download" },
  { value: "GET_QUOTE", label: "Get Quote" },
  { value: "SUBSCRIBE", label: "Subscribe" },
  { value: "CONTACT_US", label: "Contact Us" },
  { value: "APPLY_NOW", label: "Apply Now" },
  { value: "BOOK_TRAVEL", label: "Book Travel" },
  { value: "WATCH_MORE", label: "Watch More" },
  { value: "ORDER_NOW", label: "Order Now" },
];

/**
 * How each stored objective maps onto Meta, in plain English.
 *
 * `needsPixel` mirrors the server's `optimizationFor()` — those objectives
 * optimize against the Meta Pixel and Meta rejects the ad set without one, so
 * the wizard warns here rather than letting the user reach Publish and fail.
 */
const OBJECTIVE_META: Record<
  string,
  { meta: string; label: string; description: string; needsPixel?: boolean }
> = {
  conversions: {
    meta: "OUTCOME_SALES",
    label: "Sales",
    description:
      "Meta hunts for people likely to actually buy, learning from who has purchased before. Needs your Meta Pixel installed and recording purchases — that's how it knows what a buyer looks like.",
    needsPixel: true,
  },
  sales: {
    meta: "OUTCOME_SALES",
    label: "Sales",
    description:
      "Meta hunts for people likely to actually buy. Needs your Meta Pixel installed and recording purchases.",
    needsPixel: true,
  },
  awareness: {
    meta: "OUTCOME_AWARENESS",
    label: "Awareness",
    description:
      "Meta shows your ad to as many different people as your budget allows. The cheapest way to be seen — judge it on how many people you reached, not on sales.",
  },
  traffic: {
    meta: "OUTCOME_TRAFFIC",
    label: "Website Visits",
    description:
      "Meta finds the people most likely to click through to your site. Works without any tracking set up, which makes it the safest place to start.",
  },
  leads: {
    meta: "OUTCOME_LEADS",
    label: "Leads",
    description:
      "Meta looks for people likely to fill in your form, not just click. Needs the Meta Pixel on your site so Meta can see which visits turned into enquiries.",
    needsPixel: true,
  },
  "lead generation": {
    meta: "OUTCOME_LEADS",
    label: "Leads",
    description:
      "Meta looks for people likely to fill in your form, not just click. Needs the Meta Pixel on your site so Meta can see which visits turned into enquiries.",
    needsPixel: true,
  },
  engagement: {
    meta: "OUTCOME_ENGAGEMENT",
    label: "Engagement",
    description:
      "Meta optimizes for likes, comments, shares and video views. Builds social proof on the post and warms up an audience you can retarget later.",
  },
  "video views": {
    meta: "OUTCOME_ENGAGEMENT",
    label: "Engagement",
    description:
      "Meta optimizes for people who watch and react. Good for building an audience, not for selling something today.",
  },
};

/* ──────────────────────────────────────────────────────────────────── */
/* Master modal component                                                */
/* ──────────────────────────────────────────────────────────────────── */

export default function PublishToMetaModal({
  open,
  campaign,
  onClose,
  onPublished,
}: PublishToMetaModalProps) {
  const api = useApiClient();
  const [step, setStep] = useState(0);
  const [state, setState] = useState<WizardState>(() => initialState(campaign));
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<{
    message: string;
    detail?: string;
    step?: string;
  } | null>(null);
  // Set once the publish succeeds. The modal switches to a success screen
  // instead of vanishing — closing instantly gave no confirmation that
  // anything reached Meta, and no route to go look at it.
  const [published, setPublished] = useState<PublishCampaignResult | null>(null);

  // Reset when the modal closes or campaign changes
  useEffect(() => {
    if (!open) {
      const t = setTimeout(() => {
        setStep(0);
        setState(initialState(campaign));
        setSubmitting(false);
        setSubmitError(null);
        setPublished(null);
      }, 250);
      return () => clearTimeout(t);
    }
  }, [open, campaign]);

  // ESC to close (only when not submitting)
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && !submitting) onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, submitting, onClose]);

  // Per-step validation gates the Next button
  const canAdvance = useMemo(() => {
    switch (step) {
      case 0:
        return state.pageId !== "";
      case 1:
        return true; // objective is locked from the campaign
      case 2:
        return state.ageMin < state.ageMax && state.ageMin >= 13;
      case 3:
        return true; // schedule is locked from the campaign
      case 4: {
        if (!state.message.trim()) return false;
        // A malformed URL is rejected by Meta with a generic error, so gate on
        // it here rather than letting the user reach Publish and fail.
        if (!isValidDestinationUrl(state.linkUrl)) return false;
        // Need a real asset. A library creative with no media resolves to
        // nothing at publish time, so `libraryCreativeId` alone is NOT enough
        // — that let users through to a publish that always failed.
        return Boolean(
          state.imageHash ||
            state.imageUrl ||
            state.videoId ||
            state.videoUrl ||
            state.carouselCards.length >= 2
        );
      }
      case 5:
        return true;
      default:
        return false;
    }
  }, [step, state]);

  if (!open) return null;

  function patch(updates: Partial<WizardState>) {
    setState((prev) => ({ ...prev, ...updates }));
  }

  async function handleSubmit() {
    setSubmitError(null);
    setSubmitting(true);

    const targeting: MetaTargetingSpec = {
      age_min: state.ageMin,
      age_max: state.ageMax,
      ...(state.genders.length > 0 ? { genders: state.genders } : {}),
      ...(state.countries.length > 0 ||
      state.cities.length > 0 ||
      state.excludedCities.length > 0
        ? {
            geo_locations: {
              ...(state.countries.length > 0
                ? { countries: state.countries }
                : {}),
              ...(state.cities.length > 0
                ? {
                    cities: state.cities.map((c) => ({
                      key: c.key,
                      radius: 25,
                      distance_unit: "mile" as const,
                    })),
                  }
                : {}),
            },
          }
        : {}),
      ...(state.excludedCities.length > 0
        ? {
            excluded_geo_locations: {
              cities: state.excludedCities.map((c) => ({
                key: c.key,
                radius: 25,
                distance_unit: "mile" as const,
              })),
            },
          }
        : {}),
      ...(state.interests.length > 0
        ? { interests: state.interests.map((i) => ({ id: i.id, name: i.name })) }
        : {}),
      ...(state.customAudiences.length > 0
        ? {
            custom_audiences: state.customAudiences.map((a) => ({ id: a.id })),
          }
        : {}),
      ...(state.excludedCustomAudiences.length > 0
        ? {
            excluded_custom_audiences: state.excludedCustomAudiences.map(
              (a) => ({ id: a.id })
            ),
          }
        : {}),
      ...(state.savedAudiences.length > 0
        ? {
            saved_audiences: state.savedAudiences.map((a) => ({ id: a.id })),
          }
        : {}),
      // Placement preset → publisher_platforms + positions. Spread last
      // so it overrides anything earlier (nothing should conflict today,
      // but defensive). For "all" this is a no-op.
      ...placementToTargeting(state.placement),
    };

    // Build the asset half of the payload. Priority order (most specific
    // → least): carousel cards > pre-resolved Meta handle (imageHash /
    // videoId) > raw URL > library reference. Backend handles the
    // resolution chain.
    const assetFields: Partial<PublishCampaignPayload["creative"]> = (() => {
      if (state.creativeType === "CAROUSEL" && state.carouselCards.length >= 2) {
        return {
          cards: state.carouselCards.map((c) => ({
            ...(c.imageHash ? { imageHash: c.imageHash } : {}),
            ...(c.imageUrl ? { imageUrl: c.imageUrl } : {}),
            ...(c.headline.trim() ? { headline: c.headline.trim() } : {}),
            ...(c.description.trim()
              ? { description: c.description.trim() }
              : {}),
            ...(c.link.trim() ? { link: c.link.trim() } : {}),
          })),
        };
      }
      if (state.videoId) {
        return {
          videoId: state.videoId,
          ...(state.thumbnailUrl ? { thumbnailUrl: state.thumbnailUrl } : {}),
        };
      }
      if (state.imageHash) return { imageHash: state.imageHash };
      if (state.videoUrl) return { videoUrl: state.videoUrl };
      if (state.imageUrl) return { imageUrl: state.imageUrl };
      if (state.libraryCreativeId)
        return { libraryCreativeId: state.libraryCreativeId };
      return {};
    })();

    const creative: PublishCampaignPayload["creative"] = {
      message: state.message,
      headline: state.headline || undefined,
      description: state.description || undefined,
      linkUrl: state.linkUrl,
      callToAction: state.callToAction,
      ...assetFields,
    };

    try {
      const result = await api.publishCampaignToMeta(campaign.id, {
        pageId: state.pageId,
        targeting,
        creative,
      });
      toast.success("Published to Meta — paused until you start it");
      // Show the success screen rather than closing. `onPublished` refreshes
      // the page behind the modal so the campaign shows its new state the
      // moment the user dismisses it.
      setPublished(result);
      onPublished(result);
    } catch (err) {
      setSubmitError({
        message:
          err instanceof Error
            ? err.message
            : "Publishing failed. Nothing was created on Meta — try again.",
        // Carried through from the API so the card can show Meta's own words
        // and the exact step that failed, not just our interpretation.
        detail: err instanceof ApiError ? err.detail : undefined,
        step: err instanceof ApiError ? err.step : undefined,
      });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-in"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !submitting) onClose();
      }}
    >
      <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" />
      {published ? (
        <PublishSuccess
          campaign={campaign}
          result={published}
          onClose={onClose}
        />
      ) : (
      <div className="relative z-10 flex max-h-[92vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 px-7 py-4">
          <div>
            <div className="text-[10px] font-bold uppercase tracking-[0.14em] text-primary">
              Publish to Meta — Step {step + 1} of {STEP_LABELS.length}
            </div>
            <h2 className="text-base font-bold text-slate-900">
              {STEP_LABELS[step].label}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            aria-label="Close"
            className="flex h-9 w-9 items-center justify-center rounded-xl text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 disabled:opacity-40"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Step indicator */}
        <div className="px-7 pt-4">
          <div className="flex items-center gap-1.5">
            {STEP_LABELS.map((s, i) => {
              const done = i < step;
              const current = i === step;
              const Icon = s.icon;
              return (
                <div key={s.key} className="flex flex-1 items-center gap-1.5">
                  <div
                    className={clsx(
                      "flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[11px] font-bold transition",
                      done
                        ? "bg-primary text-white"
                        : current
                          ? "bg-primary/15 text-primary ring-2 ring-primary"
                          : "bg-slate-100 text-slate-400"
                    )}
                  >
                    {done ? <Check className="h-3.5 w-3.5" /> : <Icon className="h-3.5 w-3.5" />}
                  </div>
                  {i < STEP_LABELS.length - 1 && (
                    <div
                      className={clsx(
                        "h-px flex-1 transition",
                        done ? "bg-primary" : "bg-slate-200"
                      )}
                    />
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-7 py-5">
          {step === 0 && <Step1Page state={state} patch={patch} />}
          {step === 1 && <Step2Objective campaign={campaign} />}
          {step === 2 && <Step3Audience state={state} patch={patch} />}
          {step === 3 && <Step4Schedule campaign={campaign} />}
          {step === 4 && (
            <Step5Creative
              state={state}
              patch={patch}
              pageName={state.pageName}
            />
          )}
          {step === 5 && (
            <Step6Review campaign={campaign} state={state} />
          )}
        </div>

        {/* Error — friendly Meta error card (message already humanised
            server-side; detail/step expose Meta's verbatim response) */}
        {submitError && (
          <div className="mx-7 mb-3">
            <MetaErrorCard
              message={submitError.message}
              detail={submitError.detail}
              step={submitError.step}
            />
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between gap-3 border-t border-slate-100 bg-slate-50/50 px-7 py-4">
          <button
            type="button"
            disabled={submitting || step === 0}
            onClick={() => setStep((s) => Math.max(0, s - 1))}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <ChevronLeft className="h-4 w-4" />
            Back
          </button>

          {step < STEP_LABELS.length - 1 ? (
            <button
              type="button"
              disabled={!canAdvance}
              onClick={() => setStep((s) => s + 1)}
              className={clsx(
                "btn-brand",
                !canAdvance && "pointer-events-none opacity-50"
              )}
            >
              Continue
              <ChevronRight className="h-4 w-4" />
            </button>
          ) : (
            // The final action of the whole wizard — sized and coloured to be
            // unmistakably the thing to click.
            <button
              type="button"
              disabled={submitting}
              onClick={handleSubmit}
              className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 px-7 py-3.5 text-base font-bold text-white shadow-lg shadow-indigo-500/25 transition hover:-translate-y-0.5 hover:shadow-xl hover:shadow-indigo-500/30 disabled:pointer-events-none disabled:opacity-60"
            >
              {submitting ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin" />
                  Publishing to Meta…
                </>
              ) : (
                <>
                  <Rocket className="h-5 w-5" strokeWidth={2.5} />
                  Publish to Meta
                </>
              )}
            </button>
          )}
        </div>
      </div>
      )}
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────── */
/* Success screen                                                        */
/* ──────────────────────────────────────────────────────────────────── */

/**
 * What the user sees the moment the ad reaches Meta. Three jobs: confirm it
 * worked, make absolutely clear it is NOT spending yet, and give a way to go
 * see it on Meta's side.
 */
function PublishSuccess({
  campaign,
  result,
  onClose,
}: {
  campaign: Campaign;
  result: PublishCampaignResult;
  onClose: () => void;
}) {
  const accountId = campaign.adAccount?.accountId;
  const adsManagerUrl = accountId
    ? `https://business.facebook.com/adsmanager/manage/campaigns?act=${accountId}&selected_campaign_ids=${result.meta.campaignId}`
    : "https://business.facebook.com/adsmanager";

  return (
    <div className="relative z-10 w-full max-w-lg overflow-hidden rounded-2xl bg-white shadow-2xl">
      <div className="px-8 pb-6 pt-9 text-center">
        <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-lg shadow-emerald-500/25">
          <Check className="h-8 w-8" strokeWidth={3} />
        </div>
        <h2 className="text-xl font-bold text-slate-900">
          Your ad is on Meta
        </h2>
        <p className="mx-auto mt-1.5 max-w-sm text-sm leading-relaxed text-slate-500">
          <strong className="text-slate-700">{campaign.name}</strong> was
          created in your ad account, along with its ad set and creative.
        </p>

        <div className="mt-5 rounded-xl border border-amber-200 bg-amber-50/80 p-4 text-left">
          <div className="flex items-start gap-2.5">
            <div className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-amber-400 text-[11px] font-bold text-white">
              !
            </div>
            <div className="text-xs leading-relaxed text-amber-900">
              <strong>It is paused, and it is not spending anything.</strong>{" "}
              Nothing is charged until you start it. Review it here or in Ads
              Manager, then hit <strong>Resume</strong> on the campaign when
              you&apos;re happy with it.
            </div>
          </div>
        </div>

        <div className="mt-5 space-y-2">
          <a
            href={adsManagerUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#1877F2] px-5 py-3 text-sm font-bold text-white shadow-md transition hover:bg-[#1565d8]"
          >
            Open in Facebook Ads Manager
            <ExternalLink className="h-4 w-4" />
          </a>
          <button
            type="button"
            onClick={onClose}
            className="w-full rounded-xl border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
          >
            Back to the campaign
          </button>
        </div>
      </div>
    </div>
  );
}

function initialState(c: Campaign): WizardState {
  return {
    pageId: "",
    pageName: "",
    countries: [],
    cities: [],
    excludedCities: [],
    ageMin: 18,
    ageMax: 65,
    genders: [],
    interests: [],
    customAudiences: [],
    excludedCustomAudiences: [],
    savedAudiences: [],
    creativeSource: "library",
    creativeType: "IMAGE",
    carouselCards: [],
    placement: "all",
    videoWidth: null,
    videoHeight: null,
    imageHash: null,
    imageUrl: null,
    videoId: null,
    videoUrl: null,
    thumbnailUrl: null,
    libraryCreativeId: null,
    libraryCreativeName: null,
    headline: c.name,
    message: "",
    description: "",
    headlineVariants: [],
    messageVariants: [],
    descriptionVariants: [],
    ctaVariants: [],
    linkUrl: "https://",
    callToAction: "LEARN_MORE",
    uploading: false,
    uploadFile: null,
  };
}

/* ──────────────────────────────────────────────────────────────────── */
/* Step 1 — Page picker                                                  */
/* ──────────────────────────────────────────────────────────────────── */

function Step1Page({
  state,
  patch,
}: {
  state: WizardState;
  patch: (u: Partial<WizardState>) => void;
}) {
  const pagesQ = useApi<MetaPage[]>((c) => c.getMetaPages(), []);

  return (
    <div>
      <h3 className="mb-1 text-xl font-bold text-slate-900">
        Which Facebook Page should the ad be from?
      </h3>
      <p className="mb-5 text-sm text-slate-500">
        Every Meta ad has to &ldquo;originate&rdquo; from a Page. This is the
        sender identity people see in their feed.
      </p>

      {pagesQ.loading && (
        <div className="flex items-center justify-center py-12 text-sm text-slate-500">
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          Loading your Pages…
        </div>
      )}

      {pagesQ.error && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
          Couldn&apos;t load Pages — {pagesQ.error}
        </div>
      )}

      {pagesQ.data && pagesQ.data.length === 0 && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          <p className="font-bold">No Pages with Advertise permission</p>
          <p className="mt-1 text-xs">
            Open Business Manager → Pages → assign yourself with the Advertiser
            role on at least one Page, then come back.
          </p>
        </div>
      )}

      {pagesQ.data && pagesQ.data.length > 0 && (
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {pagesQ.data.map((p) => {
            const selected = state.pageId === p.id;
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => patch({ pageId: p.id, pageName: p.name })}
                className={clsx(
                  "flex items-center gap-3 rounded-xl border-2 p-3 text-left transition",
                  selected
                    ? "border-primary bg-primary/5 shadow-glow"
                    : "border-slate-200 bg-white hover:border-slate-300"
                )}
              >
                {p.pictureUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={p.pictureUrl}
                    alt={p.name}
                    className="h-10 w-10 rounded-full object-cover"
                  />
                ) : (
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-200 text-xs font-bold text-slate-500">
                    {p.name.slice(0, 1).toUpperCase()}
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-bold text-slate-900">
                    {p.name}
                  </div>
                  {p.category && (
                    <div className="truncate text-[11px] text-slate-500">
                      {p.category}
                    </div>
                  )}
                </div>
                {selected && (
                  <div className="flex h-5 w-5 items-center justify-center rounded-full bg-primary text-white">
                    <Check className="h-3 w-3" strokeWidth={3} />
                  </div>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────── */
/* Step 2 — Objective confirmation                                       */
/* ──────────────────────────────────────────────────────────────────── */

function Step2Objective({ campaign }: { campaign: Campaign }) {
  const key = (campaign.objective || "").toLowerCase();
  const meta =
    OBJECTIVE_META[key] ??
    OBJECTIVE_META[key.replace(/[^a-z\s]/g, "")] ?? {
      meta: "OUTCOME_TRAFFIC",
      label: "Website Visits",
      description:
        "We'll run this as a Website Visits campaign. To change it, edit the objective in the campaign's Settings tab before publishing.",
    };

  // Conversion objectives are rejected by Meta without a pixel. Checking on
  // THIS step means the user can go fix it (or change objective) before
  // spending five more minutes writing copy.
  const pixelsQ = useApi<MetaPixel[]>(
    (c) => (meta.needsPixel ? c.getMetaPixels() : Promise.resolve([])),
    [meta.needsPixel]
  );
  const pixels = pixelsQ.data ?? [];
  const pixelMissing =
    Boolean(meta.needsPixel) && !pixelsQ.loading && !pixelsQ.error && pixels.length === 0;
  const pixelNeverFired =
    Boolean(meta.needsPixel) &&
    pixels.length > 0 &&
    pixels.every((p) => p.lastFiredTime === null);

  return (
    <div>
      <h3 className="mb-1 text-xl font-bold text-slate-900">
        What this campaign is optimizing for
      </h3>
      <p className="mb-5 text-sm text-slate-500">
        Locked to what you chose when you created the campaign. To change it,
        edit the campaign&apos;s Settings tab.
      </p>

      <div className="rounded-2xl border-2 border-primary/30 bg-primary/[0.04] p-5">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 text-white shadow-md">
            <Target className="h-5 w-5" strokeWidth={2.25} />
          </div>
          <div>
            <div className="text-xs font-bold uppercase tracking-wider text-primary">
              Your objective
            </div>
            <div className="text-lg font-bold text-slate-900">{meta.label}</div>
            <div className="text-[11px] text-slate-500">
              Stored as &ldquo;{campaign.objective}&rdquo;
            </div>
          </div>
        </div>
        <p className="mt-3 text-sm leading-relaxed text-slate-600">
          {meta.description}
        </p>
      </div>

      {meta.needsPixel && pixelsQ.loading && (
        <div className="mt-3 flex items-center gap-2 text-xs text-slate-500">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          Checking your Meta Pixel…
        </div>
      )}

      {pixelMissing && (
        <div className="mt-3 rounded-xl border-l-4 border-l-rose-500 border border-rose-200 bg-rose-50/70 p-4">
          <p className="text-sm font-bold text-rose-900">
            You need a Meta Pixel before this can publish
          </p>
          <p className="mt-1 text-xs leading-relaxed text-rose-800">
            A {meta.label} campaign tells Meta to find people who convert — it
            can only do that if the pixel on your website reports back. We
            couldn&apos;t find one on this ad account, so publishing will be
            blocked.
          </p>
          <p className="mt-2 text-xs leading-relaxed text-rose-800">
            <strong>Two ways forward:</strong> set the pixel up in Meta Events
            Manager and install it on your site, or change this campaign&apos;s
            objective to <strong>Website Visits</strong>, which works right now.
          </p>
          <a
            href="https://business.facebook.com/events_manager2"
            target="_blank"
            rel="noopener noreferrer"
            className="mt-2.5 inline-flex items-center gap-1.5 rounded-lg bg-rose-600 px-3 py-1.5 text-xs font-bold text-white transition hover:bg-rose-700"
          >
            Open Meta Events Manager
          </a>
        </div>
      )}

      {pixelNeverFired && (
        <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50/70 p-4">
          <p className="text-sm font-bold text-amber-900">
            Your pixel hasn&apos;t recorded anything yet
          </p>
          <p className="mt-1 text-xs leading-relaxed text-amber-900">
            The pixel exists so this will publish, but it has never received an
            event — which usually means it isn&apos;t installed on your site
            yet. Until it is, Meta has nothing to learn from and delivery will
            be slow and expensive.
          </p>
        </div>
      )}
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────── */
/* Step 3 — Audience (Full)                                              */
/* ──────────────────────────────────────────────────────────────────── */

/** Prefill the whole targeting step from a reusable audience the user built
 *  on the Audiences page. Hidden when there are none saved. */
function LoadSavedAudience({
  patch,
}: {
  patch: (u: Partial<WizardState>) => void;
}) {
  const q = useApi((c) => c.getAudiences({ limit: "100" }), []);
  const audiences = q.data?.audiences ?? [];
  if (q.loading || audiences.length === 0) return null;
  return (
    <div className="rounded-xl border border-primary/20 bg-primary/[0.05] p-3">
      <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-primary">
        Load a saved audience
      </label>
      <select
        defaultValue=""
        onChange={(e) => {
          const a = audiences.find((x) => x.id === e.target.value);
          e.currentTarget.value = "";
          if (!a) return;
          const t = a.targeting;
          patch({
            ageMin: t.age_min ?? 18,
            ageMax: t.age_max ?? 65,
            genders: t.genders ?? [],
            countries: t.geo_locations?.countries ?? [],
            cities: (t.geo_locations?.cities ?? []).map((c) => ({
              key: c.key,
              name: c.key,
            })),
            interests: (t.interests ?? []).map((i) => ({
              id: i.id,
              name: i.name ?? i.id,
            })),
            customAudiences: (t.custom_audiences ?? []).map((c) => ({
              id: c.id,
              name: c.id,
            })),
          });
          toast.success(`Loaded "${a.name}" — tweak below as needed.`);
        }}
        className="h-10 w-full cursor-pointer rounded-lg border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 transition focus:border-primary focus:outline-none"
      >
        <option value="" disabled>
          Choose a saved audience…
        </option>
        {audiences.map((a) => (
          <option key={a.id} value={a.id}>
            {a.name}
          </option>
        ))}
      </select>
      <p className="mt-1 text-[10px] text-slate-500">
        Fills the fields below from an audience you built on the Audiences page.
      </p>
    </div>
  );
}

function Step3Audience({
  state,
  patch,
}: {
  state: WizardState;
  patch: (u: Partial<WizardState>) => void;
}) {
  return (
    <div className="space-y-5">
      <div>
        <h3 className="mb-1 text-xl font-bold text-slate-900">
          Who should see this ad?
        </h3>
        <p className="text-sm text-slate-500">
          Targeting is granular. Skip what you don&apos;t need — empty fields
          mean &ldquo;Meta defaults&rdquo; (broad).
        </p>
      </div>

      <LoadSavedAudience patch={patch} />

      <Section label="Location" icon={MapPin}>
        <CountryPicker
          values={state.countries}
          onChange={(v) => patch({ countries: v })}
        />
        <CityPicker
          label="Cities to include"
          values={state.cities}
          onChange={(v) => patch({ cities: v })}
        />
        <CityPicker
          label="Cities to exclude"
          values={state.excludedCities}
          onChange={(v) => patch({ excludedCities: v })}
        />
      </Section>

      <Section label="Demographics" icon={Users}>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-slate-500">
              Age range
            </label>
            <div className="flex items-center gap-2">
              <NumberInput
                value={state.ageMin}
                min={13}
                max={state.ageMax - 1}
                onChange={(v) => patch({ ageMin: v })}
              />
              <span className="text-slate-400">to</span>
              <NumberInput
                value={state.ageMax}
                min={state.ageMin + 1}
                max={65}
                onChange={(v) => patch({ ageMax: v })}
              />
            </div>
          </div>
          <div>
            <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-slate-500">
              Gender
            </label>
            <div className="inline-flex rounded-xl border border-slate-200 bg-slate-50 p-0.5">
              {(
                [
                  { label: "All", value: [] as number[] },
                  { label: "Men", value: [1] },
                  { label: "Women", value: [2] },
                ] as const
              ).map((g) => {
                const selected =
                  JSON.stringify(g.value) === JSON.stringify(state.genders);
                return (
                  <button
                    key={g.label}
                    type="button"
                    onClick={() => patch({ genders: [...g.value] })}
                    className={clsx(
                      "rounded-lg px-3 py-1.5 text-xs font-bold transition",
                      selected
                        ? "bg-white text-slate-900 shadow-sm"
                        : "text-slate-500 hover:text-slate-700"
                    )}
                  >
                    {g.label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </Section>

      <Section label="Interests" icon={Sparkles}>
        <InterestPicker
          values={state.interests}
          onChange={(v) => patch({ interests: v })}
        />
      </Section>

      <Section label="Custom audiences" icon={Library}>
        <CustomAudiencePicker
          label="Include"
          values={state.customAudiences}
          onChange={(v) => patch({ customAudiences: v })}
        />
        <CustomAudiencePicker
          label="Exclude"
          values={state.excludedCustomAudiences}
          onChange={(v) => patch({ excludedCustomAudiences: v })}
        />
      </Section>

      <Section label="Saved audiences" icon={Library}>
        <SavedAudiencePicker
          values={state.savedAudiences}
          onChange={(v) => patch({ savedAudiences: v })}
        />
      </Section>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────── */
/* Step 4 — Schedule confirmation                                        */
/* ──────────────────────────────────────────────────────────────────── */

function Step4Schedule({ campaign }: { campaign: Campaign }) {
  const currency = campaign.adAccount?.currency ?? null;
  const budget = Number(campaign.budget) || 0;
  return (
    <div>
      <h3 className="mb-1 text-xl font-bold text-slate-900">
        Schedule &amp; budget
      </h3>
      <p className="mb-5 text-sm text-slate-500">
        Locked from the campaign. To change, edit the campaign before
        publishing.
      </p>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <InfoCard
          label="Budget"
          value={`${fmtMoney(budget, currency)} ${
            campaign.budgetType === "DAILY" ? "/ day" : "lifetime"
          }`}
        />
        <InfoCard
          label="Start date"
          value={
            campaign.startDate
              ? new Date(campaign.startDate).toLocaleDateString()
              : "On publish"
          }
        />
        <InfoCard
          label="End date"
          value={
            campaign.endDate
              ? new Date(campaign.endDate).toLocaleDateString()
              : "Ongoing"
          }
        />
        <InfoCard
          label="Budget type"
          value={campaign.budgetType === "DAILY" ? "Daily" : "Lifetime"}
        />
      </div>

      <p className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
        ⚠ Once published, your campaign starts <strong>PAUSED</strong> on Meta.
        Click &quot;Launch on Meta&quot; on the campaign detail page to begin
        delivery and start spending.
      </p>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────── */
/* Step 5 — Creative                                                     */
/* ──────────────────────────────────────────────────────────────────── */

function Step5Creative({
  state,
  patch,
  pageName,
}: {
  state: WizardState;
  patch: (u: Partial<WizardState>) => void;
  /** For the live preview's sender identity. */
  pageName: string;
}) {
  const api = useApiClient();
  const fileRef = useRef<HTMLInputElement | null>(null);

  // "https://" is the seeded placeholder, so don't flag it as an error before
  // the user has typed anything real — only complain once they've engaged.
  const urlValid = isValidDestinationUrl(state.linkUrl);
  const urlTouched = state.linkUrl.trim() !== "" && state.linkUrl.trim() !== "https://";

  const hasAsset = Boolean(
    state.imageHash ||
      state.imageUrl ||
      state.videoId ||
      state.videoUrl ||
      state.carouselCards.length >= 2
  );
  // Fetch IMAGE, VIDEO, and CAROUSEL creatives. We make three calls and
  // merge — the /creatives endpoint accepts a single `type` filter, so
  // this is the simplest path until we add multi-type filtering on the
  // backend.
  const imagesQ = useApi<CreativesResponse>(
    (c) => c.getCreatives({ type: "IMAGE", limit: "20" }),
    []
  );
  const videosQ = useApi<CreativesResponse>(
    (c) => c.getCreatives({ type: "VIDEO", limit: "20" }),
    []
  );
  const carouselsQ = useApi<CreativesResponse>(
    (c) => c.getCreatives({ type: "CAROUSEL", limit: "20" }),
    []
  );
  const creativesLoading =
    imagesQ.loading || videosQ.loading || carouselsQ.loading;
  const allCreatives = useMemo(() => {
    const imgs = imagesQ.data?.creatives ?? [];
    const vids = videosQ.data?.creatives ?? [];
    const cars = carouselsQ.data?.creatives ?? [];
    // Show most-recent first across all three types. Library creatives
    // carry `createdAt` as ISO strings — string compare works for ISO-8601.
    return [...imgs, ...vids, ...cars].sort((a, b) =>
      (b.createdAt ?? "").localeCompare(a.createdAt ?? "")
    );
  }, [imagesQ.data, videosQ.data, carouselsQ.data]);

  async function handleUpload(file: File) {
    patch({ uploading: true, uploadFile: file });
    try {
      const result = await api.uploadMetaImage(file);
      patch({
        imageHash: result.hash,
        imageUrl: result.url,
        libraryCreativeId: null,
        libraryCreativeName: null,
      });
      toast.success("Image uploaded to Meta");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed");
    } finally {
      patch({ uploading: false });
    }
  }

  return (
    <div className="space-y-5">
      <div>
        <h3 className="mb-1 text-xl font-bold text-slate-900">
          Ad creative
        </h3>
        <p className="text-sm text-slate-500">
          The image, headline, body, and link that make up the actual post
          people see in their feed.
        </p>
      </div>

      {/* Image source toggle */}
      <div>
        <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-slate-500">
          Image source
        </label>
        <div className="inline-flex rounded-xl border border-slate-200 bg-slate-50 p-0.5">
          {(
            [
              { value: "library", label: "Pick from library", icon: Library },
              { value: "upload", label: "Upload new", icon: Upload },
              { value: "url", label: "Paste URL", icon: LinkIcon },
            ] as const
          ).map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() =>
                patch({
                  creativeSource: opt.value,
                  imageHash: null,
                  imageUrl: null,
                  videoId: null,
                  videoUrl: null,
                  thumbnailUrl: null,
                  videoWidth: null,
                  videoHeight: null,
                  carouselCards: [],
                  creativeType: "IMAGE",
                  libraryCreativeId: null,
                  libraryCreativeName: null,
                  // Don't reset the copy fields — the user might want to keep
                  // the AI-generated headline/body while switching the asset
                  // source. We only reset the *variant chips* because they're
                  // tied to a specific library creative.
                  headlineVariants: [],
                  messageVariants: [],
                  descriptionVariants: [],
                  ctaVariants: [],
                })
              }
              className={clsx(
                "inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition",
                state.creativeSource === opt.value
                  ? "bg-white text-slate-900 shadow-sm"
                  : "text-slate-500 hover:text-slate-700"
              )}
            >
              <opt.icon className="h-3.5 w-3.5" />
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Library picker */}
      {state.creativeSource === "library" && (
        <div>
          {creativesLoading && (
            <div className="flex items-center gap-2 py-4 text-sm text-slate-500">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading creatives…
            </div>
          )}
          {!creativesLoading && allCreatives.length === 0 && (
            <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-4 text-center text-sm text-slate-500">
              No image or video creatives in your library yet. Generate one
              in the Creatives tab, or use Upload/URL instead.
            </div>
          )}
          {allCreatives.length > 0 && (
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
              {allCreatives.map((c) => {
                const selected = state.libraryCreativeId === c.id;
                const isVideo = c.type === "VIDEO";
                const isCarousel = c.type === "CAROUSEL";
                const previewUrl = extractImageUrl(c);
                // Auto-populate copy fields from the library creative's AI-
                // generated content. Previously we only pulled the image and
                // left headline/body/CTA whatever the user had typed — making
                // the library effectively useless for any creative that had
                // copy attached. Now picking a library creative behaves like
                // a single-click "fill the form from this preset".
                const copyPatch = extractCopyFields(c);
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => {
                      if (isCarousel) {
                        const cards = extractCarouselCards(c);
                        patch({
                          libraryCreativeId: c.id,
                          libraryCreativeName: c.name,
                          creativeType: "CAROUSEL",
                          carouselCards: cards,
                          // Clear other-asset fields so the submit handler
                          // takes the carousel branch unambiguously.
                          imageHash: null,
                          imageUrl: null,
                          videoId: null,
                          videoUrl: null,
                          thumbnailUrl: null,
                          videoWidth: null,
                          videoHeight: null,
                          ...copyPatch,
                        });
                      } else if (isVideo) {
                        const v = extractVideoFields(c);
                        patch({
                          libraryCreativeId: c.id,
                          libraryCreativeName: c.name,
                          creativeType: "VIDEO",
                          carouselCards: [],
                          videoId: v.videoId,
                          videoUrl: v.videoUrl,
                          thumbnailUrl: v.thumbnailUrl,
                          videoWidth: v.videoWidth,
                          videoHeight: v.videoHeight,
                          imageHash: null,
                          imageUrl: null,
                          ...copyPatch,
                        });
                      } else {
                        patch({
                          libraryCreativeId: c.id,
                          libraryCreativeName: c.name,
                          creativeType: "IMAGE",
                          carouselCards: [],
                          imageUrl: previewUrl,
                          // Carry the stored Meta image_hash through. Without
                          // it we send only the preview URL, and for anything
                          // already on Meta that URL is a signed, expiring
                          // scontent.fbcdn.net link — publish then asks Meta to
                          // re-download its own CDN asset, which it refuses.
                          imageHash: extractImageHash(c),
                          videoId: null,
                          videoUrl: null,
                          thumbnailUrl: null,
                          videoWidth: null,
                          videoHeight: null,
                          ...copyPatch,
                        });
                      }
                    }}
                    className={clsx(
                      "group relative overflow-hidden rounded-xl border-2 text-left transition",
                      selected
                        ? "border-primary shadow-glow"
                        : "border-slate-200 hover:border-slate-300"
                    )}
                  >
                    {previewUrl ? (
                      // For both image AND video creatives the saved
                      // `content.url` is a still image (Meta's thumbnail
                      // for videos). Always render <img>; the type badge +
                      // play overlay below communicate that it's video.
                      <div className="relative">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={previewUrl}
                          alt={c.name}
                          className={clsx(
                            "aspect-square w-full object-cover",
                            isVideo && "bg-slate-900 object-contain"
                          )}
                        />
                        {isVideo && (
                          <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/15">
                            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-white/95 shadow">
                              <svg
                                viewBox="0 0 24 24"
                                fill="currentColor"
                                className="ml-0.5 h-4 w-4 text-slate-900"
                                aria-hidden
                              >
                                <path d="M8 5v14l11-7z" />
                              </svg>
                            </div>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="flex aspect-square w-full items-center justify-center bg-slate-100 text-xs text-slate-400">
                        No preview
                      </div>
                    )}
                    {/* Type badge — so format is unmistakable in the picker. */}
                    <span
                      className={clsx(
                        "absolute left-2 top-2 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider shadow-sm backdrop-blur",
                        isVideo
                          ? "bg-slate-900/85 text-white"
                          : isCarousel
                            ? "bg-amber-500/95 text-white"
                            : "bg-white/90 text-slate-700"
                      )}
                    >
                      {isVideo ? "Video" : isCarousel ? "Carousel" : "Image"}
                    </span>
                    <div className="truncate p-2 text-[11px] font-semibold text-slate-700">
                      {c.name}
                    </div>
                  </button>
                );
              })}
            </div>
          )}

          {/* Library creative is selected but has no asset — guide the user
              to add one. Skipped for video creatives since they always have
              a videoId or videoUrl by the time they reach the library. */}
          {state.libraryCreativeId &&
            state.creativeType === "IMAGE" &&
            !state.imageUrl && (
            <div className="mt-3 flex items-start gap-2.5 rounded-xl border border-amber-200 bg-amber-50/70 p-3">
              <ImageIcon
                className="mt-0.5 h-4 w-4 shrink-0 text-amber-600"
                strokeWidth={2.25}
              />
              <div className="flex-1 text-xs leading-relaxed text-amber-900">
                <strong>This creative has copy but no image.</strong> Switch to{" "}
                <strong>Upload new</strong> or <strong>Paste URL</strong> above
                to add one — your headline, body, and CTA will stay filled in.
              </div>
              <button
                type="button"
                onClick={() =>
                  patch({
                    creativeSource: "upload",
                    imageHash: null,
                    imageUrl: null,
                    libraryCreativeId: null,
                    libraryCreativeName: null,
                    // Keep variants so user can still swap copy after upload.
                  })
                }
                className="shrink-0 rounded-lg bg-amber-900 px-2.5 py-1.5 text-[11px] font-bold text-white shadow-sm transition hover:bg-amber-800"
              >
                Upload now
              </button>
            </div>
          )}
        </div>
      )}

      {/* Upload — image-only at this surface; videos go through the
          Creatives tab → Upload Creative modal (where we run the transcode
          poll properly), then get picked from Library here. */}
      {state.creativeSource === "upload" && (
        <div>
          <div className="mb-2 flex items-start gap-2 rounded-lg bg-slate-50 px-3 py-2 text-[11px] text-slate-600">
            <ImageIcon
              className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-400"
              strokeWidth={2.25}
            />
            <span>
              For <strong>video ads</strong>, upload from{" "}
              <strong>Creatives → Upload Creative</strong> first, then pick the
              video from <strong>Pick from library</strong> here. That flow
              waits for Meta&apos;s transcode to finish.
            </span>
          </div>
          <input
            type="file"
            ref={fileRef}
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void handleUpload(f);
            }}
          />
          {state.imageUrl ? (
            <div className="rounded-xl border border-slate-200 bg-white p-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={state.imageUrl}
                alt="Uploaded"
                className="mx-auto max-h-60 rounded-lg object-contain"
              />
              <p className="mt-2 text-center text-xs text-slate-500">
                Uploaded to Meta — image hash <code>{state.imageHash?.slice(0, 12)}…</code>
              </p>
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="mt-2 w-full text-xs font-semibold text-primary hover:underline"
              >
                Replace image
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={state.uploading}
              className="flex w-full flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-slate-200 bg-slate-50 p-8 transition hover:border-primary/30 hover:bg-primary/[0.04] disabled:cursor-not-allowed"
            >
              {state.uploading ? (
                <>
                  <Loader2 className="h-6 w-6 animate-spin text-primary" />
                  <span className="text-sm font-semibold text-slate-700">
                    Uploading to Meta…
                  </span>
                </>
              ) : (
                <>
                  <Upload className="h-6 w-6 text-slate-400" />
                  <span className="text-sm font-semibold text-slate-700">
                    Click to upload image
                  </span>
                  <span className="text-[11px] text-slate-500">
                    JPG, PNG up to 10MB. Recommended 1200×630.
                  </span>
                </>
              )}
            </button>
          )}
        </div>
      )}

      {/* URL paste — auto-detects image vs video from extension. Falls back
          to image when the URL doesn't end in a known video extension; the
          worst case is the backend image-uploads a video URL and Meta
          rejects it with a clear error. */}
      {state.creativeSource === "url" && (
        <UrlPasteTab state={state} patch={patch} />
      )}

      {/* Per-card edits live in the Creatives tab's detail modal; the
          publish wizard keeps it simple — pick the carousel, see the
          preview in the Review step, hit publish. */}

      {/* Placement picker — controls where the ad runs. Maps to Meta's
          publisher_platforms + positions arrays at submit time. */}
      <PlacementPicker state={state} patch={patch} />

      {/* Copy fields */}
      <div className="space-y-3 border-t border-slate-100 pt-4">
        <div>
          <label
            htmlFor="ad-message"
            className="mb-1 block text-xs font-bold uppercase tracking-wider text-slate-500"
          >
            Body copy (required)
          </label>
          <textarea
            id="ad-message"
            value={state.message}
            onChange={(e) => patch({ message: e.target.value })}
            rows={3}
            maxLength={COPY_LIMITS.message.max}
            aria-invalid={!state.message.trim()}
            placeholder="The main text people see above the image. Speak to your audience's pain or aspiration."
            className={clsx(
              "w-full rounded-xl border px-3 py-2 text-sm transition focus:outline-none",
              !state.message.trim()
                ? "border-slate-200 focus:border-primary"
                : state.message.length > COPY_LIMITS.message.warn
                  ? "border-amber-300 focus:border-amber-400"
                  : "border-slate-200 focus:border-primary"
            )}
          />
          <CharCounter
            value={state.message}
            warn={COPY_LIMITS.message.warn}
            max={COPY_LIMITS.message.max}
            hint={
              state.message.length > COPY_LIMITS.message.warn
                ? "Feed cuts off around 120 characters — the rest hides behind “See more”."
                : "The first line is what most people read. Lead with the benefit."
            }
          />
          <VariantChips
            variants={state.messageVariants}
            currentValue={state.message}
            onPick={(v) => patch({ message: v })}
          />
        </div>

        <div>
          <label
            htmlFor="ad-headline"
            className="mb-1 block text-xs font-bold uppercase tracking-wider text-slate-500"
          >
            Headline
          </label>
          <input
            id="ad-headline"
            type="text"
            value={state.headline}
            onChange={(e) => patch({ headline: e.target.value })}
            maxLength={COPY_LIMITS.headline.max}
            placeholder="Short bold headline (shows below image)"
            className={clsx(
              "h-11 w-full rounded-xl border px-3 text-sm transition focus:outline-none",
              state.headline.length > COPY_LIMITS.headline.warn
                ? "border-amber-300 focus:border-amber-400"
                : "border-slate-200 focus:border-primary"
            )}
          />
          <CharCounter
            value={state.headline}
            warn={COPY_LIMITS.headline.warn}
            max={COPY_LIMITS.headline.max}
            hint={
              state.headline.length > COPY_LIMITS.headline.warn
                ? "Getting long — Meta may trim this on smaller screens."
                : undefined
            }
          />
          <VariantChips
            variants={state.headlineVariants}
            currentValue={state.headline}
            onPick={(v) => patch({ headline: v })}
          />
        </div>

        <div>
          <label
            htmlFor="ad-description"
            className="mb-1 block text-xs font-bold uppercase tracking-wider text-slate-500"
          >
            Link description (optional)
          </label>
          <input
            id="ad-description"
            type="text"
            value={state.description}
            onChange={(e) => patch({ description: e.target.value })}
            maxLength={COPY_LIMITS.description.max}
            placeholder="Subtitle below headline"
            className={clsx(
              "h-11 w-full rounded-xl border px-3 text-sm transition focus:outline-none",
              state.description.length > COPY_LIMITS.description.warn
                ? "border-amber-300 focus:border-amber-400"
                : "border-slate-200 focus:border-primary"
            )}
          />
          <CharCounter
            value={state.description}
            warn={COPY_LIMITS.description.warn}
            max={COPY_LIMITS.description.max}
            hint={
              state.description.length > COPY_LIMITS.description.warn
                ? "Most placements only show the first ~28 characters."
                : undefined
            }
          />
          <VariantChips
            variants={state.descriptionVariants}
            currentValue={state.description}
            onPick={(v) => patch({ description: v })}
          />
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="sm:col-span-2">
            <label
              htmlFor="ad-link"
              className="mb-1 block text-xs font-bold uppercase tracking-wider text-slate-500"
            >
              Destination URL (required)
            </label>
            <input
              id="ad-link"
              type="url"
              value={state.linkUrl}
              onChange={(e) => patch({ linkUrl: e.target.value })}
              aria-invalid={!urlValid}
              placeholder="https://your-site.com/landing"
              className={clsx(
                "h-11 w-full rounded-xl border px-3 text-sm transition focus:outline-none",
                urlTouched && !urlValid
                  ? "border-rose-300 focus:border-rose-400"
                  : "border-slate-200 focus:border-primary"
              )}
            />
            {urlTouched && !urlValid && (
              <p className="mt-1 text-[11px] font-semibold text-rose-600">
                Enter the full web address people should land on, starting with
                https://
              </p>
            )}
          </div>
          <div>
            <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-slate-500">
              Call to action
            </label>
            <select
              value={state.callToAction}
              onChange={(e) =>
                patch({ callToAction: e.target.value as MetaCallToAction })
              }
              className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm transition focus:border-primary focus:outline-none"
            >
              {CTA_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
        </div>
        {state.ctaVariants.length > 1 && (
          <VariantChips
            label="AI suggested CTAs"
            variants={state.ctaVariants.map(
              (v) => CTA_OPTIONS.find((o) => o.value === v)?.label ?? v
            )}
            currentValue={
              CTA_OPTIONS.find((o) => o.value === state.callToAction)?.label ??
              state.callToAction
            }
            onPick={(label) => {
              const opt = CTA_OPTIONS.find((o) => o.label === label);
              if (opt) patch({ callToAction: opt.value });
            }}
          />
        )}
      </div>

      {/* Live preview — updates as they type. Seeing the real thing while
          writing it is what stops a headline getting truncated or an image
          getting cropped badly, so it belongs HERE, not only on Review. */}
      <div className="border-t border-slate-100 pt-4">
        <div className="mb-2 flex items-center gap-1.5">
          <Eye className="h-3.5 w-3.5 text-primary" strokeWidth={2.5} />
          <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
            Live preview
          </span>
        </div>
        {hasAsset ? (
          <MetaAdPreview
            pageName={pageName || "Your Page"}
            imageUrl={state.imageUrl}
            videoUrl={state.creativeType === "VIDEO" ? state.videoUrl : null}
            videoThumbnailUrl={
              state.creativeType === "VIDEO" ? state.thumbnailUrl : null
            }
            videoId={state.creativeType === "VIDEO" ? state.videoId : null}
            carouselCards={
              state.creativeType === "CAROUSEL" ? state.carouselCards : null
            }
            message={state.message}
            headline={state.headline}
            description={state.description}
            linkUrl={state.linkUrl}
            callToAction={
              CTA_OPTIONS.find((c) => c.value === state.callToAction)?.label ??
              state.callToAction
            }
            initialPlacement={
              state.placement === "reels_stories" ? "reels" : "facebook"
            }
          />
        ) : (
          <div className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-200 bg-slate-50/70 px-6 py-10 text-center">
            <ImageIcon className="mb-2 h-6 w-6 text-slate-300" />
            <p className="text-sm font-semibold text-slate-600">
              Add an image or video to see your ad
            </p>
            <p className="mt-0.5 text-xs text-slate-500">
              Pick one from your library, upload a new one, or paste a URL above.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────── */
/* Step 6 — Review                                                       */
/* ──────────────────────────────────────────────────────────────────── */

function Step6Review({
  campaign,
  state,
}: {
  campaign: Campaign;
  state: WizardState;
}) {
  const currency = campaign.adAccount?.currency ?? null;
  const budget = Number(campaign.budget) || 0;
  return (
    <div className="space-y-4">
      <div>
        <h3 className="mb-1 text-xl font-bold text-slate-900">
          Review &amp; publish
        </h3>
        <p className="text-sm text-slate-500">
          One last look before this goes to Meta.
        </p>
      </div>

      {/* The single most important thing to understand before clicking the
          button: publishing does not start spending. */}
      <div className="rounded-xl border-l-4 border-l-emerald-500 border border-emerald-200 bg-emerald-50/70 p-4">
        <p className="text-sm font-bold text-emerald-900">
          Publishing does not start spending
        </p>
        <p className="mt-1 text-xs leading-relaxed text-emerald-800">
          We create the campaign on Meta <strong>paused</strong>. Nothing is
          charged and no one sees the ad until you press <strong>Resume</strong>{" "}
          on the campaign page. You&apos;ll get a link to review it in Facebook
          Ads Manager first.
        </p>
      </div>

      <div className="rounded-2xl p-[1px] bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500">
        <div className="space-y-3 rounded-[15px] bg-white p-5">
          <ReviewRow label="Campaign name" value={campaign.name} />
          <ReviewRow label="Page" value={state.pageName} />
          <ReviewRow label="Objective" value={campaign.objective} />
          <ReviewRow
            label="Budget"
            value={`${fmtMoney(budget, currency)} ${
              campaign.budgetType === "DAILY" ? "/ day" : "lifetime"
            }`}
          />
          <ReviewRow
            label="Age"
            value={`${state.ageMin}–${state.ageMax}`}
          />
          <ReviewRow
            label="Gender"
            value={
              state.genders.length === 0
                ? "All"
                : state.genders.includes(1) && state.genders.includes(2)
                  ? "All"
                  : state.genders.includes(1)
                    ? "Men"
                    : "Women"
            }
          />
          <ReviewRow
            label="Countries"
            value={
              state.countries.length > 0 ? state.countries.join(", ") : "Any"
            }
          />
          <ReviewRow
            label="Cities (include)"
            value={
              state.cities.length > 0
                ? state.cities.map((c) => c.name).join(", ")
                : "—"
            }
          />
          {state.excludedCities.length > 0 && (
            <ReviewRow
              label="Cities (exclude)"
              value={state.excludedCities.map((c) => c.name).join(", ")}
            />
          )}
          <ReviewRow
            label="Interests"
            value={
              state.interests.length > 0
                ? state.interests.map((i) => i.name).join(", ")
                : "—"
            }
          />
          {state.customAudiences.length > 0 && (
            <ReviewRow
              label="Custom audiences"
              value={state.customAudiences.map((a) => a.name).join(", ")}
            />
          )}
          {state.excludedCustomAudiences.length > 0 && (
            <ReviewRow
              label="Excluded audiences"
              value={state.excludedCustomAudiences
                .map((a) => a.name)
                .join(", ")}
            />
          )}
          {state.savedAudiences.length > 0 && (
            <ReviewRow
              label="Saved audiences"
              value={state.savedAudiences.map((a) => a.name).join(", ")}
            />
          )}
          <ReviewRow label="Headline" value={state.headline || "—"} />
          <ReviewRow
            label="Body"
            value={
              state.message.length > 100
                ? state.message.slice(0, 100) + "…"
                : state.message
            }
          />
          <ReviewRow label="Link" value={state.linkUrl} />
          <ReviewRow
            label="CTA"
            value={
              CTA_OPTIONS.find((c) => c.value === state.callToAction)?.label ??
              state.callToAction
            }
          />
        </div>
      </div>

      <MetaAdPreview
        pageName={state.pageName || "Your Page"}
        imageUrl={state.imageUrl}
        videoUrl={state.creativeType === "VIDEO" ? state.videoUrl : null}
        videoThumbnailUrl={
          state.creativeType === "VIDEO" ? state.thumbnailUrl : null
        }
        videoId={state.creativeType === "VIDEO" ? state.videoId : null}
        carouselCards={
          state.creativeType === "CAROUSEL" ? state.carouselCards : null
        }
        message={state.message}
        headline={state.headline}
        description={state.description}
        linkUrl={state.linkUrl}
        callToAction={
          CTA_OPTIONS.find((c) => c.value === state.callToAction)?.label ??
          state.callToAction
        }
        // Default the preview tab to match the Step 5 placement choice.
        // "reels_stories" → Reels tab; everything else → Facebook Feed.
        // User can still flip tabs after — this is just the seed.
        initialPlacement={
          state.placement === "reels_stories" ? "reels" : "facebook"
        }
      />
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────── */
/* Shared sub-components                                                 */
/* ──────────────────────────────────────────────────────────────────── */

function Section({
  label,
  icon: Icon,
  children,
}: {
  label: string;
  icon: typeof MapPin;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <div className="mb-3 flex items-center gap-2">
        <Icon className="h-4 w-4 text-primary" strokeWidth={2.25} />
        <h4 className="text-sm font-bold text-slate-900">{label}</h4>
      </div>
      <div className="space-y-3">{children}</div>
    </div>
  );
}

function NumberInput({
  value,
  onChange,
  min,
  max,
}: {
  value: number;
  onChange: (v: number) => void;
  min: number;
  max: number;
}) {
  return (
    <input
      type="number"
      min={min}
      max={max}
      value={value}
      onChange={(e) => {
        const n = parseInt(e.target.value, 10);
        if (!Number.isNaN(n)) onChange(Math.min(max, Math.max(min, n)));
      }}
      className="h-9 w-20 rounded-lg border border-slate-200 px-2 text-center text-sm font-bold transition focus:border-primary focus:outline-none"
    />
  );
}

function InfoCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3">
      <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
        {label}
      </div>
      <div className="mt-0.5 text-sm font-bold text-slate-900">{value}</div>
    </div>
  );
}

/**
 * Character counter that turns amber as the text approaches the point where
 * Meta starts truncating, and red once past it. A plain "n/max" counter tells
 * the user nothing until they hit a wall they didn't know was there.
 */
function CharCounter({
  value,
  warn,
  max,
  hint,
}: {
  value: string;
  warn: number;
  max: number;
  hint?: string;
}) {
  const len = value.length;
  const over = len > warn;
  const atLimit = len >= max;
  return (
    <div className="mt-1 flex items-start justify-between gap-3">
      <span
        className={clsx(
          "text-[11px] leading-snug",
          over ? "font-semibold text-amber-600" : "text-slate-400"
        )}
      >
        {over && hint ? hint : hint && !over ? hint : ""}
      </span>
      <span
        className={clsx(
          "shrink-0 text-[11px] font-semibold tabular-nums",
          atLimit
            ? "text-rose-600"
            : over
              ? "text-amber-600"
              : "text-slate-400"
        )}
      >
        {len}/{max}
      </span>
    </div>
  );
}

function ReviewRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <span className="shrink-0 text-[11px] font-bold uppercase tracking-wider text-slate-500">
        {label}
      </span>
      <span className="break-words text-right text-sm font-medium text-slate-900">
        {value}
      </span>
    </div>
  );
}

/* ─────────── helpers ─────────── */

/**
 * Where the ad will run. Three preset options instead of the 30+
 * checkbox grid Ads Manager shows — beta users don't need granular per-
 * position toggles, and "all" is the right default for almost everyone.
 *
 * Also surfaces an aspect-ratio warning when the picked placement is
 * incompatible with the picked video's orientation:
 *   - "feed" + vertical 9:16 video → Meta will letterbox the video
 *   - "reels_stories" + horizontal/square video → Reels delivery skipped
 */
function PlacementPicker({
  state,
  patch,
}: {
  state: WizardState;
  patch: (u: Partial<WizardState>) => void;
}) {
  // Compute the aspect-ratio mismatch hint, if any. We only show it when
  // the user explicitly picked a placement that filters by orientation
  // and the video doesn't match — silent on "all".
  const mismatch = (() => {
    if (state.creativeType !== "VIDEO") return null;
    if (!state.videoWidth || !state.videoHeight) return null;
    const ratio = state.videoWidth / state.videoHeight;
    const isVertical = ratio < 0.85;
    if (state.placement === "feed" && isVertical) {
      return "Your video is vertical (9:16). Feed placements expect square or horizontal — Meta will letterbox it.";
    }
    if (state.placement === "reels_stories" && !isVertical) {
      return "Your video isn't 9:16 vertical. Reels & Stories will skip delivery for this ad.";
    }
    return null;
  })();

  return (
    <div className="border-t border-slate-100 pt-4">
      <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-slate-500">
        Where it runs
      </label>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
        {PLACEMENT_OPTIONS.map((opt) => {
          const selected = state.placement === opt.value;
          return (
            <button
              key={opt.value}
              type="button"
              onClick={() => patch({ placement: opt.value })}
              className={clsx(
                "rounded-xl border-2 p-3 text-left transition",
                selected
                  ? "border-primary bg-primary/5 shadow-glow"
                  : "border-slate-200 bg-white hover:border-slate-300"
              )}
            >
              <div
                className={clsx(
                  "text-xs font-bold",
                  selected ? "text-primary" : "text-slate-900"
                )}
              >
                {opt.label}
              </div>
              <div className="mt-1 text-[10px] leading-snug text-slate-500">
                {opt.description}
              </div>
            </button>
          );
        })}
      </div>
      {mismatch && (
        <div className="mt-2 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50/70 p-2.5 text-[11px] leading-relaxed text-amber-900">
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
          <span>{mismatch}</span>
        </div>
      )}
    </div>
  );
}

/**
 * URL paste tab — supports both image + video URLs. We auto-detect the
 * asset type from the file extension so the user doesn't have to flip a
 * toggle. The detected type drives:
 *   - which wizard state field gets populated (imageUrl vs videoUrl)
 *   - whether the preview renders <img> or <video>
 *   - the help text + placeholder
 */
function UrlPasteTab({
  state,
  patch,
}: {
  state: WizardState;
  patch: (u: Partial<WizardState>) => void;
}) {
  const VIDEO_EXT = /\.(mp4|mov|webm|m4v)(\?|#|$)/i;
  // Whichever side currently has a value is the live URL we render.
  const liveUrl = state.videoUrl ?? state.imageUrl ?? "";
  const looksLikeVideo = VIDEO_EXT.test(liveUrl);

  function handleChange(url: string) {
    const trimmed = url.trim();
    if (VIDEO_EXT.test(trimmed)) {
      patch({
        creativeType: "VIDEO",
        videoUrl: trimmed,
        imageUrl: null,
        imageHash: null,
        videoId: null,
        thumbnailUrl: null,
        libraryCreativeId: null,
        libraryCreativeName: null,
      });
    } else {
      patch({
        creativeType: "IMAGE",
        imageUrl: trimmed,
        videoUrl: null,
        videoId: null,
        thumbnailUrl: null,
        imageHash: null,
        libraryCreativeId: null,
        libraryCreativeName: null,
      });
    }
  }

  return (
    <div>
      <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-slate-500">
        Public image or video URL
      </label>
      <input
        type="url"
        value={liveUrl}
        onChange={(e) => handleChange(e.target.value)}
        placeholder="https://example.com/asset.jpg  (or .mp4, .mov, .webm)"
        className="h-11 w-full rounded-xl border border-slate-200 px-3 text-sm transition focus:border-primary focus:outline-none"
      />
      <p className="mt-1 text-[11px] text-slate-500">
        Meta downloads + processes the asset on publish. Video URLs are
        auto-detected by extension; ad publishing will wait for Meta&apos;s
        transcode (usually 10–30 seconds).
      </p>
      {liveUrl.startsWith("http") &&
        (looksLikeVideo ? (
          <video
            src={liveUrl}
            controls
            playsInline
            muted
            preload="metadata"
            className="mt-3 max-h-60 w-full rounded-lg border border-slate-200 bg-slate-900 object-contain"
          />
        ) : (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={liveUrl}
            alt="Preview"
            className="mt-3 max-h-60 rounded-lg border border-slate-200 object-contain"
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = "none";
            }}
          />
        ))}
    </div>
  );
}

function extractImageUrl(c: Creative): string | null {
  if (!c.content || typeof c.content !== "object") return null;
  const obj = c.content as Record<string, unknown>;
  if (typeof obj.imageUrl === "string") return obj.imageUrl;
  if (typeof obj.url === "string") return obj.url;
  if (typeof obj.image === "string") return obj.image;
  return null;
}

/**
 * The Meta `image_hash` stored on a library creative, if it has one.
 *
 * Creatives that were uploaded to (or generated on) Meta save their hash —
 * see the Creatives page, which notes it exists so "the publish wizard can
 * skip re-uploading to Meta". The wizard previously never read it back, so it
 * fell through to the URL path and asked Meta to fetch its own
 * scontent.fbcdn.net URL. Those are signed, referrer-protected and expiring,
 * and Meta rejects the attempt outright.
 *
 * Returns null for creatives that only ever had a plain hosted URL (e.g. a
 * pasted third-party image) — those legitimately need the upload path.
 */
function extractImageHash(c: Creative): string | null {
  if (!c.content || typeof c.content !== "object") return null;
  const obj = c.content as Record<string, unknown>;
  return typeof obj.imageHash === "string" && obj.imageHash.trim() !== ""
    ? obj.imageHash
    : null;
}

/**
 * Pull video-asset fields off a library creative. Returns the Meta video_id
 * if the upload modal already uploaded it (the common path), plus a thumbnail
 * URL if Meta auto-generated one and the preview URL we display in-app.
 *
 * If the library creative was saved via URL paste, only `url` will be set —
 * the publish backend then uploads to Meta + polls transcode at publish time.
 */
/**
 * Pull carousel cards off a library creative. Library carousels store the
 * card list at `content.cards` (set by the Upload Creative modal's carousel
 * flow). Each saved card carries `imageUrl` (Meta-hosted) + `imageHash`
 * (pre-uploaded handle) + optional headline / description / link.
 *
 * Returns an empty array for non-carousel creatives or malformed content.
 */
function extractCarouselCards(c: Creative): Array<{
  imageUrl: string | null;
  imageHash: string | null;
  headline: string;
  description: string;
  link: string;
}> {
  if (!c.content || typeof c.content !== "object") return [];
  const obj = c.content as Record<string, unknown>;
  if (!Array.isArray(obj.cards)) return [];
  return obj.cards
    .map((raw): {
      imageUrl: string | null;
      imageHash: string | null;
      headline: string;
      description: string;
      link: string;
    } | null => {
      if (!raw || typeof raw !== "object") return null;
      const card = raw as Record<string, unknown>;
      return {
        imageUrl:
          typeof card.imageUrl === "string"
            ? card.imageUrl
            : typeof card.url === "string"
              ? card.url
              : null,
        imageHash:
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
    .filter((card): card is NonNullable<typeof card> => card !== null);
}

function extractVideoFields(c: Creative): {
  videoId: string | null;
  videoUrl: string | null;
  thumbnailUrl: string | null;
  videoWidth: number | null;
  videoHeight: number | null;
} {
  if (!c.content || typeof c.content !== "object")
    return {
      videoId: null,
      videoUrl: null,
      thumbnailUrl: null,
      videoWidth: null,
      videoHeight: null,
    };
  const obj = c.content as Record<string, unknown>;
  // `videoUrl` is the ONLY playable-video field. Don't fall back to
  // `content.url` here — for device-uploaded videos, `content.url` is a
  // thumbnail (image) and feeding it into `<video src>` produces a broken
  // player. The wizard's MetaAdPreview falls through to thumbnail-as-img
  // when videoUrl is null but thumbnailUrl is set.
  const thumb =
    typeof obj.thumbnailUrl === "string"
      ? obj.thumbnailUrl
      : typeof obj.url === "string"
        ? obj.url
        : null;
  return {
    videoId: typeof obj.videoId === "string" ? obj.videoId : null,
    videoUrl: typeof obj.videoUrl === "string" ? obj.videoUrl : null,
    thumbnailUrl: thumb,
    videoWidth: typeof obj.videoWidth === "number" ? obj.videoWidth : null,
    videoHeight: typeof obj.videoHeight === "number" ? obj.videoHeight : null,
  };
}

/**
 * When the user picks a library creative whose content includes AI-generated
 * copy (headlines, primary_texts, descriptions, ctas — the shape produced by
 * our /api/ai/generate-copy endpoint), pull out the first variant of each
 * field so the publish wizard form auto-populates. Returns a partial patch
 * for the wizard state.
 *
 * We pick item [0] from each array because the AI is prompted to put the
 * "pick the strongest" variant first. The remaining variants come back via
 * the *Variants arrays so the wizard can render swap chips below each field.
 */
function extractCopyFields(c: Creative): {
  headline?: string;
  message?: string;
  description?: string;
  callToAction?: MetaCallToAction;
  headlineVariants?: string[];
  messageVariants?: string[];
  descriptionVariants?: string[];
  ctaVariants?: MetaCallToAction[];
} {
  if (!c.content || typeof c.content !== "object") return {};
  const obj = c.content as {
    headlines?: unknown;
    primary_texts?: unknown;
    descriptions?: unknown;
    ctas?: unknown;
  };

  const headlines = sanitizeStringArray(obj.headlines).map((s) => s.slice(0, 40));
  const messages = sanitizeStringArray(obj.primary_texts).map((s) => s.slice(0, 125));
  const descs = sanitizeStringArray(obj.descriptions).map((s) => s.slice(0, 30));
  // Map AI's free-text CTAs ("Shop now", "Learn more") onto Meta's enum.
  // De-dupe by enum so we don't show three different chips that all map to
  // LEARN_MORE.
  const ctas = sanitizeStringArray(obj.ctas)
    .map(mapAiCtaToEnum)
    .filter((v, i, arr) => arr.indexOf(v) === i);

  const out: ReturnType<typeof extractCopyFields> = {};
  if (headlines.length) {
    out.headline = headlines[0];
    out.headlineVariants = headlines;
  }
  if (messages.length) {
    out.message = messages[0];
    out.messageVariants = messages;
  }
  if (descs.length) {
    out.description = descs[0];
    out.descriptionVariants = descs;
  }
  if (ctas.length) {
    out.callToAction = ctas[0];
    out.ctaVariants = ctas;
  }
  return out;
}

/**
 * Renders a row of AI-generated variant suggestions under a copy field. The
 * currently-selected variant is highlighted; clicking another swaps it in.
 * Doesn't render anything when there's only one (or zero) variant — no point
 * showing a "swap" UI when there's nothing to swap to.
 */
function VariantChips({
  variants,
  currentValue,
  onPick,
  label = "AI variants",
}: {
  variants: string[];
  currentValue: string;
  onPick: (variant: string) => void;
  label?: string;
}) {
  if (!variants || variants.length < 2) return null;
  return (
    <div className="mt-2 space-y-1">
      <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-primary">
        <Sparkles className="h-3 w-3" strokeWidth={2.5} />
        {label}
      </div>
      <div className="flex flex-wrap gap-1.5">
        {variants.map((v, i) => {
          const isActive = v === currentValue;
          return (
            <button
              key={`${i}-${v}`}
              type="button"
              onClick={() => onPick(v)}
              className={clsx(
                "max-w-full truncate rounded-full border px-2.5 py-1 text-[11px] font-medium transition",
                isActive
                  ? "border-primary bg-primary text-white shadow-sm"
                  : "border-slate-200 bg-white text-slate-700 hover:border-primary/40 hover:bg-primary/5 hover:text-primary"
              )}
              title={v}
            >
              {v}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function sanitizeStringArray(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v.filter((s): s is string => typeof s === "string" && s.trim().length > 0);
}

/**
 * Fuzzy-map an AI-generated CTA string to the closest Meta enum value.
 * Falls back to LEARN_MORE because it's the safest default — works for
 * almost any campaign type and never flags Meta's review.
 */
function mapAiCtaToEnum(text: string): MetaCallToAction {
  const t = text.toLowerCase().trim();
  if (/shop|buy|cart/.test(t)) return "SHOP_NOW";
  if (/sign[- ]?up|join|register/.test(t)) return "SIGN_UP";
  if (/download|install/.test(t)) return "DOWNLOAD";
  if (/quote|estimate|pricing/.test(t)) return "GET_QUOTE";
  if (/subscribe/.test(t)) return "SUBSCRIBE";
  if (/contact|reach/.test(t)) return "CONTACT_US";
  if (/apply/.test(t)) return "APPLY_NOW";
  if (/book|reserve|schedule/.test(t)) return "BOOK_TRAVEL";
  if (/watch|view/.test(t)) return "WATCH_MORE";
  if (/order/.test(t)) return "ORDER_NOW";
  return "LEARN_MORE";
}
