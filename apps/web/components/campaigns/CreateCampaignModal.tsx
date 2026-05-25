"use client";

import { useEffect, useMemo, useState } from "react";
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
  type LucideIcon,
} from "lucide-react";

type Platform = {
  id: "meta" | "google" | "tiktok" | "linkedin" | "youtube" | "snapchat";
  name: string;
  sub: string;
  color: string;
  textOnColor: "white" | "black";
  connected: boolean;
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
  name: string;
  desc: string;
  emoji: string;
};

const PLATFORMS: Platform[] = [
  {
    id: "meta",
    name: "Meta",
    sub: "Facebook + Instagram",
    color: "#1877F2",
    textOnColor: "white",
    connected: true,
    initial: "M",
  },
  {
    id: "google",
    name: "Google Ads",
    sub: "Search · YouTube · Display",
    color: "#EA4335",
    textOnColor: "white",
    connected: true,
    initial: "G",
  },
  {
    id: "tiktok",
    name: "TikTok Ads",
    sub: "For You feed · Spark Ads",
    color: "#010101",
    textOnColor: "white",
    connected: true,
    initial: "T",
  },
  {
    id: "linkedin",
    name: "LinkedIn Ads",
    sub: "Sponsored content · InMail",
    color: "#0A66C2",
    textOnColor: "white",
    connected: false,
    initial: "in",
  },
  {
    id: "youtube",
    name: "YouTube Ads",
    sub: "TrueView · Bumper · Shorts",
    color: "#FF0000",
    textOnColor: "white",
    connected: true,
    initial: "Y",
  },
  {
    id: "snapchat",
    name: "Snapchat Ads",
    sub: "Stories · AR Lenses",
    color: "#FFFC00",
    textOnColor: "black",
    connected: false,
    initial: "S",
  },
];

const OBJECTIVES: Objective[] = [
  {
    id: "conversions",
    name: "Conversions",
    desc: "Drive purchases or sign-ups",
    emoji: "🎯",
  },
  {
    id: "awareness",
    name: "Awareness",
    desc: "Reach more people",
    emoji: "👁",
  },
  {
    id: "traffic",
    name: "Traffic",
    desc: "Send people to your website",
    emoji: "🖱",
  },
  {
    id: "video",
    name: "Video Views",
    desc: "Get more video plays",
    emoji: "🎬",
  },
  {
    id: "leads",
    name: "Lead Generation",
    desc: "Collect contact info",
    emoji: "🤝",
  },
  {
    id: "catalog",
    name: "Catalog Sales",
    desc: "Promote product catalog",
    emoji: "🛍",
  },
];

interface CreateCampaignModalProps {
  open: boolean;
  onClose: () => void;
}

const STEP_LABELS = ["Platform", "Objective", "Budget & Schedule", "Review"];

export default function CreateCampaignModal({
  open,
  onClose,
}: CreateCampaignModalProps) {
  const [step, setStep] = useState(1);
  const [selectedPlatforms, setSelectedPlatforms] = useState<Platform["id"][]>(
    []
  );
  const [objective, setObjective] = useState<Objective["id"] | null>(null);
  const [budgetType, setBudgetType] = useState<"daily" | "lifetime">("daily");
  const [budgetAmount, setBudgetAmount] = useState<number>(75);
  const [startDate, setStartDate] = useState<string>(
    new Date().toISOString().slice(0, 10)
  );
  const [endDate, setEndDate] = useState<string>("");
  const [runContinuously, setRunContinuously] = useState(true);
  const [campaignName, setCampaignName] = useState<string>("");

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
      }, 250);
      return () => clearTimeout(t);
    }
  }, [open]);

  // ESC to close
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  // Auto-generated name
  useEffect(() => {
    if (!campaignName && selectedPlatforms.length > 0 && objective) {
      const platformLabel =
        selectedPlatforms.length === 1
          ? PLATFORMS.find((p) => p.id === selectedPlatforms[0])?.name
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

  const togglePlatform = (id: Platform["id"]) => {
    setSelectedPlatforms((prev) =>
      prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id]
    );
  };

  const reachLow = Math.max(2000, budgetAmount * 160);
  const reachHigh = Math.max(8000, budgetAmount * 600);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-in"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
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
            aria-label="Close"
            className="flex h-9 w-9 items-center justify-center rounded-xl text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
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
              platforms={PLATFORMS}
              selected={selectedPlatforms}
              onToggle={togglePlatform}
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
            />
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between gap-3 border-t border-slate-100 bg-slate-50/50 px-8 py-4">
          <button
            type="button"
            onClick={() => (step === 1 ? onClose() : setStep((s) => s - 1))}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
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
              <button type="button" className="btn-brand" onClick={onClose}>
                <Rocket className="h-4 w-4" strokeWidth={2.5} />
                Launch Campaign
              </button>
              <button
                type="button"
                onClick={onClose}
                className="text-xs font-semibold text-slate-500 hover:text-primary"
              >
                Save as Draft
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
  selected,
  onToggle,
}: {
  platforms: Platform[];
  selected: Platform["id"][];
  onToggle: (id: Platform["id"]) => void;
}) {
  return (
    <div>
      <h3 className="mb-1 text-xl font-bold text-slate-900">
        Where do you want to advertise?
      </h3>
      <p className="mb-5 text-sm text-slate-500">
        Pick one or more platforms. You can add more later.
      </p>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {platforms.map((p) => {
          const isSelected = selected.includes(p.id);
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
                    {p.sub}
                  </div>
                </div>
              </div>
              <div className="mt-3 flex items-center justify-between">
                {p.connected ? (
                  <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-emerald-600">
                    <span className="status-dot active" />
                    Connected
                  </span>
                ) : (
                  <span className="text-[10px] font-semibold text-slate-500 hover:text-primary">
                    Connect account →
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

      {/* Budget type toggle */}
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

      {/* Budget input */}
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

      {/* Schedule */}
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

      {/* AI recommendation */}
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
}: {
  selectedPlatforms: Platform["id"][];
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
}) {
  const platforms = PLATFORMS.filter((p) => selectedPlatforms.includes(p.id));
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

      {/* Summary card */}
      <div className="rounded-2xl p-[1px] bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500">
        <div className="space-y-4 rounded-[15px] bg-white p-5">
          <Row label="Platforms">
            <div className="flex flex-wrap gap-1.5">
              {platforms.map((p) => (
                <span
                  key={p.id}
                  className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold text-white"
                  style={{
                    backgroundColor: p.color,
                    color: p.textOnColor === "black" ? "#0f172a" : "#ffffff",
                  }}
                >
                  {p.name}
                </span>
              ))}
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

// Unused but exported for potential future Lucide icon props pattern
export type ModalIcon = LucideIcon;
