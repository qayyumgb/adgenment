"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import clsx from "clsx";
import {
  X,
  Check,
  ChevronLeft,
  ChevronRight,
  Rocket,
  Sparkles,
  Calendar,
  AlertCircle,
  Loader2,
  type LucideIcon,
} from "lucide-react";
import { useApi } from "@/hooks/useApi";
import { useApiClient } from "@/lib/api";
import { currencySymbol } from "@/lib/money";
import MetaHealthStatus from "@/components/settings/MetaHealthStatus";
import type { AdAccount, MetaPixel, Platform as ApiPlatform } from "@/lib/api";

type PlatformUI = {
  id: ApiPlatform;
  name: string;
  sub: string;
  color: string;
  textOnColor: "white" | "black";
  initial: string;
};

type Objective = {
  id: "conversions" | "awareness" | "traffic" | "video" | "leads";
  /** Backend-facing string stored on the Campaign row. */
  value: string;
  name: string;
  desc: string;
  emoji: string;
  /** Plain-English tooltip — what Meta actually does with this objective and
   *  who it suits. Deliberately jargon-free: the person reading it has never
   *  heard of "the learning phase". */
  explainer: string;
  /** Conversion objectives optimize against the Meta Pixel. Without one Meta
   *  rejects the ad set, so we warn on this step rather than at publish. */
  needsPixel?: boolean;
};

// Platforms supported by both UI and backend. The modal only ENABLES the ones
// that have a connected ad account; the rest are disabled with a "connect"
// link.
const PLATFORMS_UI: PlatformUI[] = [
  { id: "META", name: "Meta", sub: "Facebook + Instagram", color: "#1877F2", textOnColor: "white", initial: "M" },
  { id: "GOOGLE", name: "Google Ads", sub: "Search · YouTube · Display", color: "#EA4335", textOnColor: "white", initial: "G" },
  { id: "TIKTOK", name: "TikTok Ads", sub: "For You feed · Spark Ads", color: "#010101", textOnColor: "white", initial: "T" },
  { id: "LINKEDIN", name: "LinkedIn Ads", sub: "Sponsored content · InMail", color: "#0A66C2", textOnColor: "white", initial: "in" },
  { id: "YOUTUBE", name: "YouTube Ads", sub: "TrueView · Bumper · Shorts", color: "#FF0000", textOnColor: "white", initial: "Y" },
  { id: "SNAPCHAT", name: "Snapchat Ads", sub: "Stories · AR Lenses", color: "#FFFC00", textOnColor: "black", initial: "S" },
];

/**
 * Objectives we can actually publish to Meta today.
 *
 * Removed deliberately:
 *  - "Catalog Sales" needs a product catalog + feed connected to the ad
 *    account, which this wizard has no way to set up. Offering it meant users
 *    could reach the final step and fail.
 *  - "App Promotion" needs a registered app object we never collect.
 */
const OBJECTIVES: Objective[] = [
  {
    id: "traffic",
    value: "Traffic",
    name: "Website Visits",
    desc: "Send people to your site",
    emoji: "🖱",
    explainer:
      "Meta shows your ad to the people most likely to click through to your website. The cheapest way to start, and the one that works without any tracking set up. Good when you want eyes on a page — a product, a booking form, an article.",
  },
  {
    id: "leads",
    value: "Lead Generation",
    name: "Leads",
    desc: "Collect enquiries and contact details",
    emoji: "🤝",
    explainer:
      "Meta looks for people likely to fill in your form, not just click. Needs the Meta Pixel installed on your site so Meta can see which visits turned into enquiries. Best for services, consultations, quotes and demos.",
    needsPixel: true,
  },
  {
    id: "conversions",
    value: "Conversions",
    name: "Sales",
    desc: "Drive purchases and sign-ups",
    emoji: "🎯",
    explainer:
      "Meta finds people likely to actually buy, using what your Pixel tells it about past purchasers. The most powerful objective and the most demanding: the Pixel must be installed and recording purchases before it can work.",
    needsPixel: true,
  },
  {
    id: "awareness",
    value: "Awareness",
    name: "Awareness",
    desc: "Get in front of as many people as possible",
    emoji: "👁",
    explainer:
      "Meta shows your ad to the largest number of different people for your money. Cheapest per person reached — but judge it on reach, not sales. Use it for launches, local presence and brand-building, not to sell something today.",
  },
  {
    id: "video",
    value: "Video Views",
    name: "Engagement",
    desc: "Video plays, likes, comments and shares",
    emoji: "🎬",
    explainer:
      "Meta optimizes for people who watch, react and comment. Builds social proof on a post and warms up an audience you can retarget later. Not a direct-response objective — don't expect it to drive sales on its own.",
  },
];

/**
 * Optional pre-fill data. Used by AI Planner ("Apply to Campaign") which
 * stores its generated plan in sessionStorage and routes the user here
 * with `?new=1`.
 */
export interface CampaignPrefill {
  /** Backend platform enum names (uppercase) — only those with a
   *  connected ad account will end up selected. */
  platforms?: string[];
  /** Backend objective string ("Conversions", "Awareness", …) OR the
   *  internal modal id ("conversions", "awareness", …). */
  objective?: string;
  /** Daily budget in workspace currency. */
  budget?: number;
  /** Suggested campaign name. */
  name?: string;
  /** ISO yyyy-mm-dd. From the AI plan's duration. */
  startDate?: string;
  endDate?: string;
  /** Audience the plan proposed. Carried through to the publish wizard via
   *  sessionStorage so the user doesn't retype targeting the AI already
   *  worked out. Display-only in this modal. */
  audience?: {
    ageRange?: string;
    genders?: string[];
    interests?: string[];
    locations?: string[];
  };
}

interface CreateCampaignModalProps {
  open: boolean;
  onClose: () => void;
  /** Called after one or more campaigns have been successfully created. */
  onCreated?: () => void;
  /** When provided, the wizard opens with these fields pre-filled. */
  prefill?: CampaignPrefill | null;
}

const STEP_LABELS = ["Platform", "Objective", "Budget & Schedule", "Review"];

export default function CreateCampaignModal({
  open,
  onClose,
  onCreated,
  prefill,
}: CreateCampaignModalProps) {
  const client = useApiClient();
  const router = useRouter();
  // Only fetch the ad-accounts list while the modal is open.
  const accounts = useApi<AdAccount[]>(
    (c) => (open ? c.getAdAccounts() : Promise.resolve([])),
    [open]
  );

  const [step, setStep] = useState(1);
  const [selectedPlatforms, setSelectedPlatforms] = useState<ApiPlatform[]>([]);
  const [objective, setObjective] = useState<Objective["id"] | null>(null);
  const [budgetType, setBudgetType] = useState<"daily" | "lifetime">("daily");
  /**
   * The budget field holds RAW TEXT, not a number.
   *
   * A number-typed state can't represent "the user has cleared the box": the
   * input reports `""`, `Number("") || 0` collapses it to 0, and the 0 renders
   * straight back — so the last character is impossible to delete. Keeping the
   * string and deriving the number fixes that and costs nothing.
   */
  const [budgetInput, setBudgetInput] = useState<string>("");
  const budgetAmount = (() => {
    const n = Number(budgetInput);
    return budgetInput.trim() !== "" && Number.isFinite(n) ? n : 0;
  })();
  /** Set once the user edits the field, so we stop auto-seeding it. */
  const budgetTouched = useRef(false);
  const [startDate, setStartDate] = useState<string>(
    new Date().toISOString().slice(0, 10)
  );
  const [endDate, setEndDate] = useState<string>("");
  const [runContinuously, setRunContinuously] = useState(true);
  const [campaignName, setCampaignName] = useState<string>("");
  const [submitting, setSubmitting] = useState<null | "publish" | "draft">(null);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Build a lookup of active ad accounts grouped by platform.
  const accountsByPlatform = useMemo(() => {
    const map = new Map<ApiPlatform, AdAccount[]>();
    for (const a of accounts.data ?? []) {
      if (!a.isActive) continue;
      const arr = map.get(a.platform) ?? [];
      arr.push(a);
      map.set(a.platform, arr);
    }
    return map;
  }, [accounts.data]);

  // The ad account the budget applies to — the first selected platform's
  // account (the budget number is in THIS account's currency, sent to Meta
  // as-is). Falls back to the first connected active account.
  const budgetAccount = useMemo(() => {
    for (const p of selectedPlatforms) {
      const a = accountsByPlatform.get(p)?.[0];
      if (a) return a;
    }
    return (accounts.data ?? []).find((a) => a.isActive) ?? null;
  }, [selectedPlatforms, accountsByPlatform, accounts.data]);
  const budgetCurrency = budgetAccount?.currency ?? null;
  const minDailyBudget = budgetAccount?.minDailyBudget ?? null;

  // Reset on close
  useEffect(() => {
    if (!open) {
      const t = setTimeout(() => {
        setStep(1);
        setSelectedPlatforms([]);
        setObjective(null);
        setBudgetType("daily");
        setBudgetInput("");
        budgetTouched.current = false;
        setEndDate("");
        setRunContinuously(true);
        setCampaignName("");
        setSubmitError(null);
        setSubmitting(null);
      }, 250);
      return () => clearTimeout(t);
    }
  }, [open]);

  /**
   * Apply an AI-planner pre-fill.
   *
   * Platform pre-fill is filtered against the user's actually-connected ad
   * accounts so we never auto-select something the backend would reject. When
   * every field the plan supplies lands cleanly we jump straight to Review —
   * the point of "Apply to Campaign" is that the user shouldn't have to walk
   * back through decisions the AI already made for them.
   */
  const prefillApplied = useRef(false);
  useEffect(() => {
    if (!open) {
      prefillApplied.current = false;
      return;
    }
    if (!prefill || prefillApplied.current) return;
    // Wait for the accounts list before deciding — otherwise the platform
    // filter runs against an empty map and drops the selection.
    if (accounts.loading) return;

    let matchedPlatform = false;
    let matchedObjective = false;

    if (prefill.platforms && prefill.platforms.length > 0) {
      const allowed = prefill.platforms
        .map((p) => p.toUpperCase() as ApiPlatform)
        .filter((p) => accountsByPlatform.has(p));
      if (allowed.length > 0) {
        setSelectedPlatforms(allowed);
        matchedPlatform = true;
      }
    }

    if (prefill.objective) {
      const lower = prefill.objective.toLowerCase();
      // Match the modal id, the backend-facing value, or the display label —
      // the AI may return any of the three.
      const obj = OBJECTIVES.find(
        (o) =>
          o.id === lower ||
          o.value.toLowerCase() === lower ||
          o.name.toLowerCase() === lower
      );
      if (obj) {
        setObjective(obj.id);
        matchedObjective = true;
      }
    }

    if (typeof prefill.budget === "number" && prefill.budget > 0) {
      setBudgetInput(String(Math.round(prefill.budget)));
      budgetTouched.current = true; // the plan's number wins over auto-seeding
    }
    if (prefill.name) setCampaignName(prefill.name);
    if (prefill.startDate) setStartDate(prefill.startDate);
    if (prefill.endDate) {
      setEndDate(prefill.endDate);
      setRunContinuously(false);
    }

    prefillApplied.current = true;

    // Only skip ahead when the two gating choices actually resolved. Landing
    // on Review with no platform selected would be worse than starting at
    // step 1, because the user can't see what's missing from there.
    if (matchedPlatform && matchedObjective) {
      setStep(4);
    }
  }, [open, prefill, accountsByPlatform, accounts.loading]);

  // A total budget can't run forever — Meta needs the end date to pace it.
  // Switching budget type has to clear the flag, or step 3 would be stuck in a
  // state the user can see is checked but can't uncheck.
  useEffect(() => {
    if (budgetType === "lifetime" && runContinuously) {
      setRunContinuously(false);
    }
  }, [budgetType, runContinuously]);

  // ESC to close (but not while a submit is in flight)
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && !submitting) onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose, submitting]);

  // Auto-generated default name. Skipped when the AI planner supplied one —
  // this effect runs after the prefill effect in the same commit, so without
  // the guard it would queue a second setState and clobber the plan's name.
  useEffect(() => {
    if (prefill?.name) return;
    if (!campaignName && selectedPlatforms.length > 0 && objective) {
      const platformLabel =
        selectedPlatforms.length === 1
          ? PLATFORMS_UI.find((p) => p.id === selectedPlatforms[0])?.name
          : `Multi-platform`;
      const objLabel = OBJECTIVES.find((o) => o.id === objective)?.name;
      const month = new Date().toLocaleString("en-US", {
        month: "long",
        year: "numeric",
      });
      setCampaignName(`${platformLabel} – ${objLabel} – ${month}`);
    }
  }, [step, selectedPlatforms, objective, campaignName, prefill?.name]);

  /**
   * Everything Meta would reject about the budget and schedule, checked here
   * so the user is corrected on this step instead of at publish. Returns the
   * first blocking problem per field, or null when the field is fine.
   */
  const scheduleValidation = useMemo(() => {
    const todayStr = new Date().toISOString().slice(0, 10);

    // Meta's floor is $1/day (or the account's own minimum, which is higher in
    // some currencies). A lifetime budget has to cover $1 for every day it
    // runs, otherwise Meta can't pace it.
    const dailyFloor = Math.max(1, minDailyBudget && minDailyBudget > 0 ? minDailyBudget : 1);
    const days =
      !runContinuously && endDate && startDate
        ? Math.max(
            1,
            Math.round(
              (new Date(endDate).getTime() - new Date(startDate).getTime()) /
                86_400_000
            ) + 1
          )
        : null;
    const lifetimeFloor = days ? dailyFloor * days : dailyFloor;
    const floor = budgetType === "daily" ? dailyFloor : lifetimeFloor;

    let budget: string | null = null;
    if (!Number.isFinite(budgetAmount) || budgetAmount <= 0) {
      budget = "Enter a budget above zero.";
    } else if (budgetAmount < floor) {
      budget =
        budgetType === "daily"
          ? `Meta's minimum for this account is ${currencySymbol(budgetCurrency)}${dailyFloor.toLocaleString()} per day.`
          : `A ${days ?? 1}-day campaign needs at least ${currencySymbol(budgetCurrency)}${lifetimeFloor.toLocaleString()} total — Meta needs ${currencySymbol(budgetCurrency)}${dailyFloor.toLocaleString()} a day to deliver.`;
    }

    let start: string | null = null;
    if (!startDate) start = "Pick a start date.";
    else if (startDate < todayStr) start = "The start date can't be in the past.";

    let end: string | null = null;
    if (!runContinuously) {
      if (!endDate) end = "Pick an end date, or switch on “Run continuously”.";
      else if (endDate <= startDate) end = "The end date has to be after the start date.";
    }
    // A lifetime budget with no end date can't be paced by Meta at all.
    if (budgetType === "lifetime" && runContinuously) {
      end = "A total budget needs an end date so Meta knows how to spread it.";
    }

    return { budget, start, end, days, floor, ok: !budget && !start && !end };
  }, [
    budgetAmount,
    budgetType,
    startDate,
    endDate,
    runContinuously,
    minDailyBudget,
    budgetCurrency,
  ]);

  /**
   * Seed the budget from this account's REAL minimum.
   *
   * The old hardcoded 75 was a USD-shaped guess: on a PKR account whose Meta
   * floor is 279.11/day it opened the step already invalid, with an error the
   * user hadn't done anything to deserve. `scheduleValidation.floor` is the
   * live floor for the current budget type, so switching Daily↔Lifetime
   * re-seeds correctly too. Stops as soon as the user types.
   */
  useEffect(() => {
    if (!open || budgetTouched.current) return;
    setBudgetInput(String(Math.ceil(scheduleValidation.floor)));
  }, [open, scheduleValidation.floor]);

  const canAdvance = useMemo(() => {
    if (step === 1) return selectedPlatforms.length > 0;
    if (step === 2) return objective !== null;
    if (step === 3) return scheduleValidation.ok;
    return campaignName.trim().length > 0;
  }, [step, selectedPlatforms, objective, scheduleValidation.ok, campaignName]);

  if (!open) return null;

  const togglePlatform = (id: ApiPlatform) => {
    if (!accountsByPlatform.has(id)) return; // disabled
    setSelectedPlatforms((prev) =>
      prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id]
    );
  };

  // Estimated DAILY reach, so it has to be driven by the daily-equivalent
  // spend — a 30-day lifetime budget doesn't reach 30x as many people per day.
  // Static multipliers on purpose: a real Meta reach estimate needs a full
  // targeting spec we don't have yet, and a fake API call would be worse than
  // an honest range.
  const dailyEquivalent =
    budgetType === "lifetime" && scheduleValidation.days
      ? budgetAmount / scheduleValidation.days
      : budgetAmount;
  const reachLow = Math.round(Math.max(500, dailyEquivalent * 160));
  const reachHigh = Math.round(Math.max(2000, dailyEquivalent * 600));

  /**
   * Creates the campaign(s) as drafts.
   *
   * There is deliberately no "launch now" here any more. The old flow flipped
   * the new row to ACTIVE in our database, which showed a green Active badge
   * over a campaign that existed nowhere on Meta and was spending nothing. A
   * Meta campaign only becomes real once it's been published with a creative,
   * so `continueToPublish` hands the user straight to that step instead.
   */
  async function handleSubmit(mode: "publish" | "draft") {
    if (selectedPlatforms.length === 0 || !objective) return;
    setSubmitting(mode);
    setSubmitError(null);
    const objMeta = OBJECTIVES.find((o) => o.id === objective)!;
    const name = campaignName.trim() || "Untitled campaign";

    try {
      // Create one campaign per selected platform, using that platform's first
      // active ad account.
      const created = await Promise.all(
        selectedPlatforms.map((platform) => {
          const acct = accountsByPlatform.get(platform)?.[0];
          if (!acct) {
            throw new Error(
              `No connected ${platform} ad account. Connect one in Settings → Integrations.`
            );
          }
          const finalName =
            selectedPlatforms.length > 1
              ? `${name} (${platform.charAt(0) + platform.slice(1).toLowerCase()})`
              : name;
          return client.createCampaign({
            name: finalName,
            platform,
            objective: objMeta.value,
            budget: budgetAmount,
            budgetType: budgetType === "daily" ? "DAILY" : "LIFETIME",
            startDate: startDate || null,
            endDate: runContinuously ? null : endDate || null,
            adAccountId: acct.id,
            targeting: null,
          });
        })
      );

      onCreated?.();
      onClose();

      // Straight into the publish step for a single Meta campaign — that's the
      // only place an ad actually gets built and sent to Meta.
      const metaCampaign = created.find((c) => c.platform === "META");
      if (mode === "publish" && metaCampaign) {
        router.push(`/campaigns/${metaCampaign.id}?publish=1`);
      }
    } catch (err) {
      setSubmitError(
        err instanceof Error ? err.message : "Couldn't create the campaign. Try again."
      );
    } finally {
      setSubmitting(null);
    }
  }

  const noAccounts =
    !accounts.loading && (accounts.data?.filter((a) => a.isActive).length ?? 0) === 0;
  const hasMetaSelected = selectedPlatforms.includes("META");

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-in"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !submitting) onClose();
      }}
    >
      <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" />
      <div className="relative z-10 w-full max-w-2xl overflow-hidden rounded-2xl bg-white shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 px-8 py-5">
          <div>
            <div className="text-[10px] font-bold uppercase tracking-[0.14em] text-primary">
              Step {step} of 4
            </div>
            <h2 className="text-lg font-bold text-slate-900">
              {STEP_LABELS[step - 1]}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={!!submitting}
            aria-label="Close"
            className="flex h-9 w-9 items-center justify-center rounded-xl text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 disabled:opacity-40"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Step indicator */}
        <div className="px-8 pt-5">
          <div className="flex items-center gap-2">
            {STEP_LABELS.map((label, i) => {
              const n = i + 1;
              const done = step > n;
              const current = step === n;
              return (
                <div key={label} className="flex flex-1 items-center gap-2">
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
                    {done ? <Check className="h-3.5 w-3.5" /> : n}
                  </div>
                  <div
                    className={clsx(
                      "hidden truncate text-xs font-semibold sm:block",
                      current
                        ? "text-slate-900"
                        : done
                          ? "text-slate-600"
                          : "text-slate-400"
                    )}
                  >
                    {label}
                  </div>
                  {n < STEP_LABELS.length && (
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
        <div className="max-h-[60vh] overflow-y-auto px-8 py-6">
          {/* Heads-up if the Meta account isn't publish-ready (hidden when OK). */}
          {accountsByPlatform.get("META")?.[0]?.id && (
            <div className="mb-5">
              <MetaHealthStatus
                adAccountId={accountsByPlatform.get("META")![0].id}
                hideWhenHealthy
              />
            </div>
          )}
          {step === 1 && (
            <StepPlatform
              platforms={PLATFORMS_UI}
              accountsByPlatform={accountsByPlatform}
              selected={selectedPlatforms}
              onToggle={togglePlatform}
              loading={accounts.loading}
              noAccounts={noAccounts}
              error={accounts.error}
            />
          )}
          {step === 2 && (
            <StepObjective
              selected={objective}
              onSelect={setObjective}
              metaSelected={hasMetaSelected}
            />
          )}
          {step === 3 && (
            <StepBudget
              budgetType={budgetType}
              setBudgetType={setBudgetType}
              budgetAmount={budgetAmount}
              budgetInput={budgetInput}
              onBudgetInput={(v) => {
                budgetTouched.current = true;
                setBudgetInput(v);
              }}
              startDate={startDate}
              setStartDate={setStartDate}
              endDate={endDate}
              setEndDate={setEndDate}
              runContinuously={runContinuously}
              setRunContinuously={setRunContinuously}
              reachLow={reachLow}
              reachHigh={reachHigh}
              objective={objective}
              currency={budgetCurrency}
              minDailyBudget={minDailyBudget}
              validation={scheduleValidation}
            />
          )}
          {step === 4 && (
            <StepReview
              selectedPlatforms={selectedPlatforms}
              objective={objective}
              budgetType={budgetType}
              budgetAmount={budgetAmount}
              startDate={startDate}
              endDate={endDate}
              runContinuously={runContinuously}
              campaignName={campaignName}
              setCampaignName={setCampaignName}
              reachLow={reachLow}
              reachHigh={reachHigh}
              accountsByPlatform={accountsByPlatform}
              currency={budgetCurrency}
            />
          )}
        </div>

        {submitError && (
          <div className="mx-8 mb-3 flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm font-medium text-rose-700">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{submitError}</span>
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between gap-3 border-t border-slate-100 bg-slate-50/50 px-8 py-4">
          <button
            type="button"
            disabled={!!submitting}
            onClick={() => (step === 1 ? onClose() : setStep((s) => s - 1))}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-40"
          >
            <ChevronLeft className="h-4 w-4" />
            {step === 1 ? "Cancel" : "Back"}
          </button>

          {step < 4 ? (
            <button
              type="button"
              disabled={!canAdvance}
              onClick={() => setStep((s) => s + 1)}
              className={clsx(
                "btn-brand",
                !canAdvance && "pointer-events-none opacity-50"
              )}
            >
              Next
              <ChevronRight className="h-4 w-4" />
            </button>
          ) : (
            <div className="flex flex-col items-end gap-2">
              <button
                type="button"
                disabled={!!submitting || !canAdvance}
                className="btn-brand disabled:pointer-events-none disabled:opacity-60"
                onClick={() => handleSubmit(hasMetaSelected ? "publish" : "draft")}
              >
                {submitting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Creating…
                  </>
                ) : hasMetaSelected ? (
                  <>
                    <Rocket className="h-4 w-4" strokeWidth={2.5} />
                    Create &amp; Add Creative
                  </>
                ) : (
                  <>
                    <Rocket className="h-4 w-4" strokeWidth={2.5} />
                    Create Campaign
                  </>
                )}
              </button>
              {hasMetaSelected && (
                <button
                  type="button"
                  disabled={!!submitting || !canAdvance}
                  onClick={() => handleSubmit("draft")}
                  className="text-xs font-semibold text-slate-500 transition hover:text-primary disabled:opacity-50"
                >
                  {submitting === "draft" ? "Saving…" : "Just save as a draft"}
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ───────────────────────────────────────── */
/* Step 1: Platform                          */
/* ───────────────────────────────────────── */
function StepPlatform({
  platforms,
  accountsByPlatform,
  selected,
  onToggle,
  loading,
  noAccounts,
  error,
}: {
  platforms: PlatformUI[];
  accountsByPlatform: Map<ApiPlatform, AdAccount[]>;
  selected: ApiPlatform[];
  onToggle: (id: ApiPlatform) => void;
  loading: boolean;
  noAccounts: boolean;
  error: string | null;
}) {
  return (
    <div>
      <h3 className="mb-1 text-xl font-bold text-slate-900">
        Where do you want to advertise?
      </h3>
      <p className="mb-5 text-sm text-slate-500">
        Only platforms with a connected ad account can be selected.
      </p>

      {error && (
        <div className="mb-3 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm font-medium text-rose-700">
          Couldn&apos;t load your ad accounts — {error}
        </div>
      )}

      {noAccounts && !loading && (
        <div className="mb-4 flex items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4">
          <div>
            <p className="text-sm font-bold text-amber-900">No ad accounts connected yet</p>
            <p className="mt-0.5 text-xs text-amber-800">
              Connect Meta, Google, TikTok or LinkedIn before creating a campaign.
            </p>
          </div>
          <Link
            href="/settings?tab=integrations"
            className="shrink-0 rounded-lg bg-amber-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-amber-800"
          >
            Connect →
          </Link>
        </div>
      )}

      {loading && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <div
              key={i}
              className="h-[104px] animate-pulse rounded-xl bg-slate-100"
            />
          ))}
        </div>
      )}

      {!loading && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {platforms.map((p) => {
            const accountsForPlat = accountsByPlatform.get(p.id) ?? [];
            const connected = accountsForPlat.length > 0;
            const isSelected = selected.includes(p.id);

            const inner = (
              <>
                <div className="flex items-center gap-3">
                  <div
                    className="flex h-10 w-10 items-center justify-center rounded-xl text-sm font-bold shadow-sm"
                    style={{
                      backgroundColor: p.color,
                      color: p.textOnColor === "black" ? "#0f172a" : "#ffffff",
                    }}
                  >
                    {p.initial}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-bold text-slate-900">
                      {p.name}
                    </div>
                    <div className="truncate text-[11px] text-slate-500">
                      {connected ? accountsForPlat[0].accountName : p.sub}
                    </div>
                  </div>
                </div>
                <div className="mt-3 flex items-center justify-between">
                  {connected ? (
                    <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-emerald-600">
                      <span className="status-dot active" />
                      Connected
                    </span>
                  ) : (
                    <span className="text-[10px] font-bold uppercase tracking-wider text-primary">
                      Connect {p.name} →
                    </span>
                  )}
                </div>
              </>
            );

            // An unconnected platform renders as a LINK to the integrations
            // page, not a disabled tile. A dead tile tells the user "no" and
            // stops there; this tells them what to do about it. (It can't be a
            // disabled <button> wrapping a link — disabled buttons swallow
            // clicks on their children.)
            if (!connected) {
              return (
                <Link
                  key={p.id}
                  href="/settings?tab=integrations"
                  title={`Connect ${p.name} to advertise on it`}
                  className="group relative rounded-xl border-2 border-dashed border-slate-200 bg-slate-50/70 p-4 text-left transition hover:border-primary/40 hover:bg-primary/[0.03]"
                >
                  {inner}
                </Link>
              );
            }

            return (
              <button
                key={p.id}
                type="button"
                onClick={() => onToggle(p.id)}
                className={clsx(
                  "group relative rounded-xl border-2 p-4 text-left transition",
                  isSelected
                    ? "border-primary bg-primary/5 shadow-glow"
                    : "border-slate-200 bg-white hover:border-slate-300"
                )}
              >
                {inner}
                {isSelected && (
                  <div className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-white shadow-md">
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

/* ───────────────────────────────────────── */
/* Step 2: Objective                         */
/* ───────────────────────────────────────── */
function StepObjective({
  selected,
  onSelect,
  metaSelected,
}: {
  selected: Objective["id"] | null;
  onSelect: (id: Objective["id"]) => void;
  /** Only check for a pixel when Meta is actually one of the targets. */
  metaSelected: boolean;
}) {
  // Which objectives are publishable depends on whether a pixel exists. Told
  // here, on the step where the choice is made — not at the publish step where
  // it's five clicks too late to matter.
  const pixelsQ = useApi<MetaPixel[]>(
    (c) => (metaSelected ? c.getMetaPixels() : Promise.resolve([])),
    [metaSelected]
  );
  const hasPixel = (pixelsQ.data?.length ?? 0) > 0;
  const pixelKnown = metaSelected && !pixelsQ.loading && !pixelsQ.error;

  const chosen = OBJECTIVES.find((o) => o.id === selected) ?? null;
  const pixelBlocked = Boolean(
    chosen?.needsPixel && pixelKnown && !hasPixel
  );

  return (
    <div>
      <h3 className="mb-1 text-xl font-bold text-slate-900">
        What do you want this ad to do?
      </h3>
      <p className="mb-5 text-sm text-slate-500">
        Meta uses this to decide who sees your ad. Hover any option for what it
        actually means.
      </p>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {OBJECTIVES.map((o) => {
          const isSelected = selected === o.id;
          const needsMissingPixel = o.needsPixel && pixelKnown && !hasPixel;
          return (
            <button
              key={o.id}
              type="button"
              onClick={() => onSelect(o.id)}
              title={o.explainer}
              className={clsx(
                "group relative rounded-xl border-2 p-4 text-left transition",
                isSelected
                  ? "border-primary bg-primary/[0.06] shadow-glow"
                  : "border-slate-200 bg-white hover:border-slate-300"
              )}
            >
              <div className="text-2xl">{o.emoji}</div>
              <div className="mt-2 flex items-center gap-1.5">
                <span className="text-sm font-bold text-slate-900">{o.name}</span>
                {needsMissingPixel && (
                  <AlertCircle className="h-3.5 w-3.5 shrink-0 text-amber-500" />
                )}
              </div>
              <div className="text-[11px] text-slate-500">{o.desc}</div>
            </button>
          );
        })}
      </div>

      {/* Full explainer for the current pick — a tooltip alone isn't reachable
          on touch, and this is the sentence that decides the campaign. */}
      {chosen && (
        <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50/70 p-4">
          <div className="flex items-start gap-2.5">
            <span className="text-lg leading-none">{chosen.emoji}</span>
            <div className="min-w-0">
              <p className="text-xs font-bold uppercase tracking-wider text-slate-500">
                What {chosen.name} does
              </p>
              <p className="mt-1 text-sm leading-relaxed text-slate-700">
                {chosen.explainer}
              </p>
            </div>
          </div>
        </div>
      )}

      {pixelBlocked && (
        <div className="mt-3 flex items-start gap-2.5 rounded-xl border border-amber-200 bg-amber-50 p-3.5">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
          <div className="min-w-0 flex-1 text-xs leading-relaxed text-amber-900">
            <strong>
              We couldn&apos;t find a Meta Pixel on your ad account.
            </strong>{" "}
            {chosen?.name} campaigns need one — it&apos;s the snippet on your
            website that tells Meta who converted. Create it in Meta Events
            Manager and install it on your site, or pick{" "}
            <strong>Website Visits</strong> instead, which works today.
            <a
              href="https://business.facebook.com/events_manager2"
              target="_blank"
              rel="noopener noreferrer"
              className="mt-1.5 block font-bold text-amber-900 underline"
            >
              Open Meta Events Manager →
            </a>
          </div>
        </div>
      )}
    </div>
  );
}

/* ───────────────────────────────────────── */
/* Step 3: Budget & Schedule                 */
/* ───────────────────────────────────────── */
function StepBudget({
  budgetType,
  setBudgetType,
  budgetAmount,
  budgetInput,
  onBudgetInput,
  startDate,
  setStartDate,
  endDate,
  setEndDate,
  runContinuously,
  setRunContinuously,
  reachLow,
  reachHigh,
  objective,
  currency,
  minDailyBudget,
  validation,
}: {
  budgetType: "daily" | "lifetime";
  setBudgetType: (v: "daily" | "lifetime") => void;
  /** Parsed value, for display maths and validation. */
  budgetAmount: number;
  /** Raw field text — lets the box actually be empty while typing. */
  budgetInput: string;
  onBudgetInput: (v: string) => void;
  startDate: string;
  setStartDate: (s: string) => void;
  endDate: string;
  setEndDate: (s: string) => void;
  runContinuously: boolean;
  setRunContinuously: (b: boolean) => void;
  reachLow: number;
  reachHigh: number;
  objective: Objective["id"] | null;
  currency: string | null;
  minDailyBudget: number | null;
  validation: {
    budget: string | null;
    start: string | null;
    end: string | null;
    days: number | null;
    floor: number;
    ok: boolean;
  };
}) {
  const sym = currencySymbol(currency);
  const todayStr = new Date().toISOString().slice(0, 10);
  // Recommendation is anchored on Meta's REAL minimum daily budget for this
  // account (already in the account currency, kept current by Meta — no FX).
  // We suggest a sensible multiple of that floor, varied by objective. When the
  // minimum isn't known yet (account not synced), fall back to plain guidance.
  const [loMul, hiMul] =
    objective === "leads" ? [10, 30] : objective === "awareness" ? [5, 15] : [8, 20];
  const recommendation =
    minDailyBudget && minDailyBudget > 0
      ? `${sym}${Math.round(minDailyBudget * loMul).toLocaleString()}–${sym}${Math.round(minDailyBudget * hiMul).toLocaleString()}/day`
      : null;

  return (
    <div className="space-y-5">
      <div>
        <h3 className="mb-1 text-xl font-bold text-slate-900">
          Set your budget and schedule
        </h3>
        <p className="text-sm text-slate-500">
          You can adjust these any time after launch.
        </p>
      </div>

      <div className="inline-flex rounded-xl border border-slate-200 bg-slate-50 p-0.5">
        {(["daily", "lifetime"] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setBudgetType(t)}
            className={clsx(
              "rounded-lg px-4 py-1.5 text-xs font-bold capitalize transition",
              budgetType === t
                ? "bg-white text-slate-900 shadow-sm"
                : "text-slate-500 hover:text-slate-700"
            )}
          >
            {t} Budget
          </button>
        ))}
      </div>

      <div>
        <label
          htmlFor="campaign-budget"
          className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-slate-500"
        >
          {budgetType === "daily" ? "Daily budget" : "Total budget"}
        </label>
        <div className="relative">
          <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-base font-bold text-slate-400">
            {sym}
          </span>
          <input
            id="campaign-budget"
            type="number"
            min={validation.floor}
            step="1"
            inputMode="decimal"
            value={budgetInput}
            aria-invalid={validation.budget !== null}
            // Pass the raw string straight through — no Number() coercion
            // here, or clearing the field snaps it back to 0.
            onChange={(e) => onBudgetInput(e.target.value)}
            // Empty on blur is a dead end (Next stays disabled with no value
            // to fix), so fall back to the minimum that would be valid.
            onBlur={() => {
              if (budgetInput.trim() === "") {
                onBudgetInput(String(Math.ceil(validation.floor)));
              }
            }}
            className={clsx(
              "h-14 w-full rounded-xl border-2 pl-14 pr-4 text-2xl font-bold tracking-tight text-slate-900 transition focus:outline-none",
              validation.budget
                ? "border-rose-300 focus:border-rose-400"
                : "border-slate-200 focus:border-primary"
            )}
          />
        </div>
        {validation.budget ? (
          <p className="mt-2 flex items-start gap-1.5 text-xs font-semibold text-rose-600">
            <AlertCircle className="mt-px h-3.5 w-3.5 shrink-0" />
            {validation.budget}
          </p>
        ) : (
          <p className="mt-2 text-xs text-slate-500">
            Estimated daily reach:{" "}
            <span className="font-bold text-slate-900">
              {reachLow.toLocaleString()}–{reachHigh.toLocaleString()}
            </span>{" "}
            people
            {budgetType === "lifetime" && validation.days ? (
              <>
                {" "}
                · {sym}
                {Math.round(budgetAmount / validation.days).toLocaleString()}/day
                across {validation.days} days
              </>
            ) : null}
          </p>
        )}
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <label
            htmlFor="campaign-start"
            className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-slate-500"
          >
            Start date
          </label>
          <div className="relative">
            <Calendar className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              id="campaign-start"
              type="date"
              value={startDate}
              min={todayStr}
              aria-invalid={validation.start !== null}
              onChange={(e) => setStartDate(e.target.value)}
              className={clsx(
                "h-11 w-full rounded-xl border pl-10 pr-3 text-sm font-medium text-slate-900 transition focus:outline-none",
                validation.start
                  ? "border-rose-300 focus:border-rose-400"
                  : "border-slate-200 focus:border-primary"
              )}
            />
          </div>
          {validation.start && (
            <p className="mt-1.5 text-[11px] font-semibold text-rose-600">
              {validation.start}
            </p>
          )}
        </div>
        <div>
          <label
            htmlFor="campaign-end"
            className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-slate-500"
          >
            End date
          </label>
          <div className="relative">
            <Calendar className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              id="campaign-end"
              type="date"
              value={endDate}
              disabled={runContinuously}
              min={startDate || todayStr}
              aria-invalid={validation.end !== null}
              onChange={(e) => setEndDate(e.target.value)}
              className={clsx(
                "h-11 w-full rounded-xl border pl-10 pr-3 text-sm font-medium text-slate-900 transition focus:outline-none disabled:bg-slate-50 disabled:text-slate-400",
                validation.end && !runContinuously
                  ? "border-rose-300 focus:border-rose-400"
                  : "border-slate-200 focus:border-primary"
              )}
            />
          </div>
          {validation.end && (
            <p className="mt-1.5 text-[11px] font-semibold text-rose-600">
              {validation.end}
            </p>
          )}
        </div>
      </div>

      <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
        <input
          type="checkbox"
          checked={runContinuously}
          // A total budget has to have an end date for Meta to pace it, so
          // "run continuously" simply isn't a valid combination here.
          disabled={budgetType === "lifetime"}
          onChange={(e) => setRunContinuously(e.target.checked)}
          className="h-4 w-4 rounded border-slate-300 text-primary focus:ring-primary disabled:opacity-40"
        />
        Run continuously
        {budgetType === "lifetime" && (
          <span className="text-xs font-normal text-slate-400">
            (not available with a total budget)
          </span>
        )}
      </label>

      <div className="relative overflow-hidden rounded-xl bg-gradient-to-br from-primary/[0.06] via-purple-500/[0.04] to-pink-500/[0.04] p-4 ring-1 ring-inset ring-primary/15">
        <div className="flex items-start gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 text-white shadow-md">
            <Sparkles className="h-4 w-4" strokeWidth={2.5} />
          </div>
          <div>
            <div className="text-[10px] font-bold uppercase tracking-wider text-primary">
              AI Recommendation
            </div>
            <p className="mt-0.5 text-sm font-medium text-slate-700">
              {recommendation ? (
                <>
                  Based on your objective, we suggest{" "}
                  <span className="font-bold text-slate-900">{recommendation}</span>{" "}
                  for meaningful results
                  {minDailyBudget && minDailyBudget > 0 ? (
                    <>
                      {" "}
                      (this account&apos;s minimum is{" "}
                      <span className="font-semibold">
                        {sym}
                        {minDailyBudget.toLocaleString()}/day
                      </span>
                      ).
                    </>
                  ) : (
                    "."
                  )}
                </>
              ) : (
                <>
                  Start with a daily budget that fits your goal and scale what
                  works. (Connect &amp; sync your ad account to see Meta&apos;s
                  minimum for it.)
                </>
              )}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ───────────────────────────────────────── */
/* Step 4: Review                            */
/* ───────────────────────────────────────── */
function StepReview({
  selectedPlatforms,
  objective,
  budgetType,
  budgetAmount,
  startDate,
  endDate,
  runContinuously,
  campaignName,
  setCampaignName,
  reachLow,
  reachHigh,
  accountsByPlatform,
  currency,
}: {
  selectedPlatforms: ApiPlatform[];
  objective: Objective["id"] | null;
  budgetType: "daily" | "lifetime";
  budgetAmount: number;
  startDate: string;
  endDate: string;
  runContinuously: boolean;
  campaignName: string;
  setCampaignName: (s: string) => void;
  reachLow: number;
  reachHigh: number;
  accountsByPlatform: Map<ApiPlatform, AdAccount[]>;
  currency: string | null;
}) {
  const platforms = PLATFORMS_UI.filter((p) =>
    selectedPlatforms.includes(p.id)
  );
  const objMeta = OBJECTIVES.find((o) => o.id === objective);
  const hasMeta = selectedPlatforms.includes("META");

  const impressionsLow = reachLow * 4;
  const impressionsHigh = reachHigh * 5;

  return (
    <div className="space-y-5">
      <div>
        <h3 className="mb-1 text-xl font-bold text-slate-900">
          Review your campaign
        </h3>
        <p className="text-sm text-slate-500">
          {hasMeta
            ? "Next you'll add the image and wording, then publish. Nothing goes live and nothing is charged until you do."
            : "This saves as a draft you can edit any time."}
        </p>
      </div>

      <div className="rounded-2xl p-[1px] bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500">
        <div className="space-y-4 rounded-[15px] bg-white p-5">
          <Row label="Platforms">
            <div className="flex flex-wrap gap-1.5">
              {platforms.map((p) => {
                const acct = accountsByPlatform.get(p.id)?.[0];
                return (
                  <span
                    key={p.id}
                    className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold"
                    style={{
                      backgroundColor: p.color,
                      color: p.textOnColor === "black" ? "#0f172a" : "#ffffff",
                    }}
                    title={acct?.accountName}
                  >
                    {p.name}
                  </span>
                );
              })}
            </div>
          </Row>

          <Row label="Objective">
            <div className="flex items-center gap-2">
              <span className="text-lg">{objMeta?.emoji}</span>
              <span className="text-sm font-semibold text-slate-900">
                {objMeta?.name}
              </span>
            </div>
          </Row>

          <Row label="Budget">
            <span className="text-sm font-bold text-slate-900">
              {currencySymbol(currency)}
              {budgetAmount.toLocaleString()}
              <span className="font-medium text-slate-500">
                {" "}
                / {budgetType === "daily" ? "day" : "total"}
              </span>
            </span>
          </Row>

          <Row label="Schedule">
            <span className="text-sm font-medium text-slate-900">
              {startDate}
              {" → "}
              {runContinuously ? (
                <span className="text-slate-500">Ongoing</span>
              ) : (
                endDate || (
                  <span className="text-slate-400">No end date</span>
                )
              )}
            </span>
          </Row>

          <Row label="Est. reach">
            <span className="text-sm font-semibold text-emerald-700">
              {reachLow.toLocaleString()}–{reachHigh.toLocaleString()} people
            </span>
          </Row>

          <Row label="Est. impressions">
            <span className="text-sm font-semibold text-slate-700">
              {impressionsLow.toLocaleString()}–
              {impressionsHigh.toLocaleString()}
            </span>
          </Row>
        </div>
      </div>

      <div>
        <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-slate-500">
          Campaign name
        </label>
        <input
          type="text"
          value={campaignName}
          onChange={(e) => setCampaignName(e.target.value)}
          placeholder="My new campaign"
          className="h-11 w-full rounded-xl border border-slate-200 px-3 text-sm font-medium text-slate-900 transition focus:border-primary focus:outline-none"
        />
        {selectedPlatforms.length > 1 && (
          <p className="mt-1.5 text-[11px] text-slate-500">
            One campaign will be created per platform — the platform name will be appended to each.
          </p>
        )}
      </div>
    </div>
  );
}

function Row({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-3">
      <span className="shrink-0 text-[11px] font-bold uppercase tracking-wider text-slate-500">
        {label}
      </span>
      <div className="text-right">{children}</div>
    </div>
  );
}

export type ModalIcon = LucideIcon;
