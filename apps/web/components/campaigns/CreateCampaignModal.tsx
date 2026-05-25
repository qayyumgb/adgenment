"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import clsx from "clsx";
import {
  X,
  Check,
  ChevronLeft,
  ChevronRight,
  Rocket,
  Sparkles,
  Calendar,
  DollarSign,
  AlertCircle,
  Loader2,
  type LucideIcon,
} from "lucide-react";
import { useApi } from "@/hooks/useApi";
import { useApiClient } from "@/lib/api";
import type { AdAccount, Platform as ApiPlatform } from "@/lib/api";

type PlatformUI = {
  id: ApiPlatform;
  name: string;
  sub: string;
  color: string;
  textOnColor: "white" | "black";
  initial: string;
};

type Objective = {
  id:
    | "conversions"
    | "awareness"
    | "traffic"
    | "video"
    | "leads"
    | "catalog";
  /** Backend-facing string stored on the Campaign row. */
  value: string;
  name: string;
  desc: string;
  emoji: string;
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

const OBJECTIVES: Objective[] = [
  { id: "conversions", value: "Conversions", name: "Conversions", desc: "Drive purchases or sign-ups", emoji: "🎯" },
  { id: "awareness", value: "Awareness", name: "Awareness", desc: "Reach more people", emoji: "👁" },
  { id: "traffic", value: "Traffic", name: "Traffic", desc: "Send people to your website", emoji: "🖱" },
  { id: "video", value: "Video Views", name: "Video Views", desc: "Get more video plays", emoji: "🎬" },
  { id: "leads", value: "Lead Generation", name: "Lead Generation", desc: "Collect contact info", emoji: "🤝" },
  { id: "catalog", value: "Catalog Sales", name: "Catalog Sales", desc: "Promote product catalog", emoji: "🛍" },
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
  // Only fetch the ad-accounts list while the modal is open.
  const accounts = useApi<AdAccount[]>(
    (c) => (open ? c.getAdAccounts() : Promise.resolve([])),
    [open]
  );

  const [step, setStep] = useState(1);
  const [selectedPlatforms, setSelectedPlatforms] = useState<ApiPlatform[]>([]);
  const [objective, setObjective] = useState<Objective["id"] | null>(null);
  const [budgetType, setBudgetType] = useState<"daily" | "lifetime">("daily");
  const [budgetAmount, setBudgetAmount] = useState<number>(75);
  const [startDate, setStartDate] = useState<string>(
    new Date().toISOString().slice(0, 10)
  );
  const [endDate, setEndDate] = useState<string>("");
  const [runContinuously, setRunContinuously] = useState(true);
  const [campaignName, setCampaignName] = useState<string>("");
  const [submitting, setSubmitting] = useState<null | "launch" | "draft">(null);
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

  // Reset on close
  useEffect(() => {
    if (!open) {
      const t = setTimeout(() => {
        setStep(1);
        setSelectedPlatforms([]);
        setObjective(null);
        setBudgetType("daily");
        setBudgetAmount(75);
        setEndDate("");
        setRunContinuously(true);
        setCampaignName("");
        setSubmitError(null);
        setSubmitting(null);
      }, 250);
      return () => clearTimeout(t);
    }
  }, [open]);

  // Apply pre-fill on open. Platform pre-fill is filtered against the user's
  // actually-connected ad accounts so we never auto-select something the
  // backend would reject.
  useEffect(() => {
    if (!open || !prefill) return;
    if (prefill.platforms && prefill.platforms.length > 0) {
      const allowed = prefill.platforms
        .map((p) => p.toUpperCase() as ApiPlatform)
        .filter((p) => accountsByPlatform.has(p));
      if (allowed.length > 0) setSelectedPlatforms(allowed);
    }
    if (prefill.objective) {
      const lower = prefill.objective.toLowerCase();
      // Match either the modal id OR the backend-facing label.
      const obj = OBJECTIVES.find(
        (o) =>
          o.id === lower ||
          o.value.toLowerCase() === lower ||
          o.name.toLowerCase() === lower
      );
      if (obj) setObjective(obj.id);
    }
    if (typeof prefill.budget === "number" && prefill.budget > 0) {
      setBudgetAmount(Math.round(prefill.budget));
    }
    if (prefill.name) setCampaignName(prefill.name);
    // The accountsByPlatform map can arrive after the first render; rerun
    // when it's populated so we don't silently drop platform pre-selection.
  }, [open, prefill, accountsByPlatform]);

  // ESC to close (but not while a submit is in flight)
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && !submitting) onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose, submitting]);

  // Auto-generated default name
  useEffect(() => {
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
  }, [step, selectedPlatforms, objective, campaignName]);

  const canAdvance = useMemo(() => {
    if (step === 1) return selectedPlatforms.length > 0;
    if (step === 2) return objective !== null;
    if (step === 3) return budgetAmount > 0 && startDate !== "";
    return true;
  }, [step, selectedPlatforms, objective, budgetAmount, startDate]);

  if (!open) return null;

  const togglePlatform = (id: ApiPlatform) => {
    if (!accountsByPlatform.has(id)) return; // disabled
    setSelectedPlatforms((prev) =>
      prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id]
    );
  };

  const reachLow = Math.max(2000, budgetAmount * 160);
  const reachHigh = Math.max(8000, budgetAmount * 600);

  async function handleSubmit(mode: "launch" | "draft") {
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
            throw new Error(`No connected ${platform} ad account`);
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

      if (mode === "launch") {
        // Flip each newly-created campaign to ACTIVE.
        await Promise.all(
          created.map((c) =>
            client.updateCampaign(c.id, { status: "ACTIVE" })
          )
        );
      }

      onCreated?.();
      onClose();
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "Failed to create campaign");
    } finally {
      setSubmitting(null);
    }
  }

  const noAccounts =
    !accounts.loading && (accounts.data?.filter((a) => a.isActive).length ?? 0) === 0;

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
            <StepObjective selected={objective} onSelect={setObjective} />
          )}
          {step === 3 && (
            <StepBudget
              budgetType={budgetType}
              setBudgetType={setBudgetType}
              budgetAmount={budgetAmount}
              setBudgetAmount={setBudgetAmount}
              startDate={startDate}
              setStartDate={setStartDate}
              endDate={endDate}
              setEndDate={setEndDate}
              runContinuously={runContinuously}
              setRunContinuously={setRunContinuously}
              reachLow={reachLow}
              reachHigh={reachHigh}
              objective={objective}
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
                disabled={!!submitting}
                className="btn-brand disabled:pointer-events-none disabled:opacity-60"
                onClick={() => handleSubmit("launch")}
              >
                {submitting === "launch" ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Launching…
                  </>
                ) : (
                  <>
                    <Rocket className="h-4 w-4" strokeWidth={2.5} />
                    Launch Campaign
                  </>
                )}
              </button>
              <button
                type="button"
                disabled={!!submitting}
                onClick={() => handleSubmit("draft")}
                className="text-xs font-semibold text-slate-500 hover:text-primary disabled:opacity-50"
              >
                {submitting === "draft" ? "Saving…" : "Save as Draft"}
              </button>
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

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {platforms.map((p) => {
          const accountsForPlat = accountsByPlatform.get(p.id) ?? [];
          const connected = accountsForPlat.length > 0;
          const isSelected = selected.includes(p.id);
          return (
            <button
              key={p.id}
              type="button"
              onClick={() => onToggle(p.id)}
              disabled={!connected}
              className={clsx(
                "group relative rounded-xl border-2 p-4 text-left transition",
                isSelected
                  ? "border-primary bg-primary/5 shadow-glow"
                  : connected
                    ? "border-slate-200 bg-white hover:border-slate-300"
                    : "cursor-not-allowed border-dashed border-slate-200 bg-slate-50 opacity-70"
              )}
            >
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
                  <span className="text-[10px] font-semibold text-slate-400">
                    Not connected
                  </span>
                )}
              </div>
              {isSelected && (
                <div className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-white shadow-md">
                  <Check className="h-3 w-3" strokeWidth={3} />
                </div>
              )}
            </button>
          );
        })}
      </div>

      {loading && (
        <p className="mt-3 text-xs text-slate-400">Loading connected platforms…</p>
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
}: {
  selected: Objective["id"] | null;
  onSelect: (id: Objective["id"]) => void;
}) {
  return (
    <div>
      <h3 className="mb-1 text-xl font-bold text-slate-900">
        What&apos;s your goal?
      </h3>
      <p className="mb-5 text-sm text-slate-500">
        We&apos;ll optimize delivery to match this outcome.
      </p>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {OBJECTIVES.map((o) => {
          const isSelected = selected === o.id;
          return (
            <button
              key={o.id}
              type="button"
              onClick={() => onSelect(o.id)}
              className={clsx(
                "group rounded-xl border-2 p-4 text-left transition",
                isSelected
                  ? "border-primary bg-primary/[0.06] shadow-glow"
                  : "border-slate-200 bg-white hover:border-slate-300"
              )}
            >
              <div className="text-2xl">{o.emoji}</div>
              <div className="mt-2 text-sm font-bold text-slate-900">
                {o.name}
              </div>
              <div className="text-[11px] text-slate-500">{o.desc}</div>
            </button>
          );
        })}
      </div>
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
  setBudgetAmount,
  startDate,
  setStartDate,
  endDate,
  setEndDate,
  runContinuously,
  setRunContinuously,
  reachLow,
  reachHigh,
  objective,
}: {
  budgetType: "daily" | "lifetime";
  setBudgetType: (v: "daily" | "lifetime") => void;
  budgetAmount: number;
  setBudgetAmount: (n: number) => void;
  startDate: string;
  setStartDate: (s: string) => void;
  endDate: string;
  setEndDate: (s: string) => void;
  runContinuously: boolean;
  setRunContinuously: (b: boolean) => void;
  reachLow: number;
  reachHigh: number;
  objective: Objective["id"] | null;
}) {
  const recommendation =
    objective === "leads"
      ? "$80–$150/day"
      : objective === "awareness"
        ? "$30–$80/day"
        : "$50–$150/day";

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
        <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-slate-500">
          {budgetType === "daily" ? "Daily budget" : "Total budget"}
        </label>
        <div className="relative">
          <DollarSign className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
          <input
            type="number"
            min={1}
            value={budgetAmount}
            onChange={(e) => setBudgetAmount(Number(e.target.value) || 0)}
            className="h-14 w-full rounded-xl border-2 border-slate-200 pl-11 pr-4 text-2xl font-bold tracking-tight text-slate-900 transition focus:border-primary focus:outline-none"
          />
        </div>
        <p className="mt-2 text-xs text-slate-500">
          Estimated daily reach:{" "}
          <span className="font-bold text-slate-900">
            {reachLow.toLocaleString()}–{reachHigh.toLocaleString()}
          </span>{" "}
          people
        </p>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-slate-500">
            Start date
          </label>
          <div className="relative">
            <Calendar className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="date"
              value={startDate}
              min={new Date().toISOString().slice(0, 10)}
              onChange={(e) => setStartDate(e.target.value)}
              className="h-11 w-full rounded-xl border border-slate-200 pl-10 pr-3 text-sm font-medium text-slate-900 transition focus:border-primary focus:outline-none"
            />
          </div>
        </div>
        <div>
          <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-slate-500">
            End date
          </label>
          <div className="relative">
            <Calendar className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="date"
              value={endDate}
              disabled={runContinuously}
              min={startDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="h-11 w-full rounded-xl border border-slate-200 pl-10 pr-3 text-sm font-medium text-slate-900 transition focus:border-primary focus:outline-none disabled:bg-slate-50 disabled:text-slate-400"
            />
          </div>
        </div>
      </div>

      <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
        <input
          type="checkbox"
          checked={runContinuously}
          onChange={(e) => setRunContinuously(e.target.checked)}
          className="h-4 w-4 rounded border-slate-300 text-primary focus:ring-primary"
        />
        Run continuously
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
              Based on your objective and platform, we suggest{" "}
              <span className="font-bold text-slate-900">{recommendation}</span>{" "}
              for optimal results.
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
}) {
  const platforms = PLATFORMS_UI.filter((p) =>
    selectedPlatforms.includes(p.id)
  );
  const objMeta = OBJECTIVES.find((o) => o.id === objective);

  const impressionsLow = reachLow * 4;
  const impressionsHigh = reachHigh * 5;

  return (
    <div className="space-y-5">
      <div>
        <h3 className="mb-1 text-xl font-bold text-slate-900">
          Review your campaign
        </h3>
        <p className="text-sm text-slate-500">
          Looks good? Launch it, or save as a draft to come back later.
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
              ${budgetAmount.toLocaleString()}
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
