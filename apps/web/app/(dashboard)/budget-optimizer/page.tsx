"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import clsx from "clsx";
import toast from "react-hot-toast";
import {
  Sparkles,
  TrendingUp,
  TrendingDown,
  Rocket,
  Download,
  X,
  Check,
  Loader2,
  ChevronDown,
  Pause,
  Minus,
  ArrowRight,
  Zap,
  AlertTriangle,
  Info,
} from "lucide-react";
import { useApiClient } from "@/lib/api";
import { fmtMoney } from "@/lib/money";
import EmptyState from "@/components/ui/EmptyState";
import type {
  OptimizationAnalysis,
  BudgetRecommendationItem,
  BudgetRecommendationRow,
} from "@/lib/api";

/* ───────────────────────── action metadata ───────────────────────── */

const ACTION_META: Record<
  BudgetRecommendationItem["action"],
  { label: string; color: string; bg: string; text: string; icon: typeof TrendingUp }
> = {
  INCREASE: { label: "Increase", color: "#10B981", bg: "bg-emerald-50", text: "text-emerald-700", icon: TrendingUp },
  DECREASE: { label: "Decrease", color: "#F59E0B", bg: "bg-amber-50", text: "text-amber-700", icon: TrendingDown },
  PAUSE: { label: "Pause", color: "#EF4444", bg: "bg-rose-50", text: "text-rose-700", icon: Pause },
  MAINTAIN: { label: "Maintain", color: "#64748B", bg: "bg-slate-100", text: "text-slate-600", icon: Minus },
};

const CONFIDENCE_META: Record<
  BudgetRecommendationItem["confidence"],
  { bg: string; text: string }
> = {
  HIGH: { bg: "bg-emerald-50", text: "text-emerald-700" },
  MEDIUM: { bg: "bg-amber-50", text: "text-amber-700" },
  LOW: { bg: "bg-slate-100", text: "text-slate-500" },
};

/* ───────────────────────────── page ───────────────────────────── */

export default function BudgetOptimizerPage() {
  const api = useApiClient();
  const [analysis, setAnalysis] = useState<OptimizationAnalysis | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [noCampaigns, setNoCampaigns] = useState(false);
  const [loadingLatest, setLoadingLatest] = useState(true);

  // Per-card state
  const [appliedIds, setAppliedIds] = useState<Set<string>>(new Set());
  const [skippedIds, setSkippedIds] = useState<Set<string>>(new Set());
  const [applyingId, setApplyingId] = useState<string | null>(null);
  const [applyingAll, setApplyingAll] = useState(false);

  // Load the most recent pending recommendation so the page survives reloads.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const latest = await api.getLatestRecommendation();
        if (cancelled || !latest) return;
        const data = latest.analysisData as OptimizationAnalysis | null;
        if (data && Array.isArray(data.recommendations)) {
          setAnalysis({ ...data, recommendationId: latest.id });
        }
      } catch {
        // ignore — page still works via Analyze Now
      } finally {
        if (!cancelled) setLoadingLatest(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [api]);

  const runAnalysis = useCallback(async () => {
    setAnalyzing(true);
    setNoCampaigns(false);
    setAppliedIds(new Set());
    setSkippedIds(new Set());
    try {
      const result = await api.analyzeBudget();
      setAnalysis(result);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Analysis failed";
      if (/no campaigns/i.test(msg)) {
        setNoCampaigns(true);
        setAnalysis(null);
      } else {
        toast.error(msg);
      }
    } finally {
      setAnalyzing(false);
    }
  }, [api]);

  const actionable = useMemo(
    () => (analysis?.recommendations ?? []).filter((r) => r.action !== "MAINTAIN"),
    [analysis]
  );
  const pendingCount = useMemo(
    () => actionable.filter((r) => !appliedIds.has(r.campaignId) && !skippedIds.has(r.campaignId)).length,
    [actionable, appliedIds, skippedIds]
  );

  async function applyOne(r: BudgetRecommendationItem) {
    if (!analysis?.recommendationId) return;
    setApplyingId(r.campaignId);
    try {
      await api.applyBudgetRecommendations(analysis.recommendationId, [r.campaignId]);
      setAppliedIds((s) => new Set(s).add(r.campaignId));
      toast.success(`${r.campaignName} updated in your plan`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Apply failed");
    } finally {
      setApplyingId(null);
    }
  }

  function skipOne(r: BudgetRecommendationItem) {
    setSkippedIds((s) => new Set(s).add(r.campaignId));
  }

  async function applyAll() {
    if (!analysis?.recommendationId) return;
    setApplyingAll(true);
    try {
      const res = await api.applyBudgetRecommendations(analysis.recommendationId);
      setAppliedIds(new Set(actionable.map((r) => r.campaignId)));
      toast.success(`Applied ${res.applied} change${res.applied === 1 ? "" : "s"} to your plan`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Apply failed");
    } finally {
      setApplyingAll(false);
    }
  }

  async function dismiss() {
    if (!analysis?.recommendationId) {
      setAnalysis(null);
      return;
    }
    try {
      await api.dismissBudgetRecommendation(analysis.recommendationId);
    } catch {
      // best-effort
    }
    setAnalysis(null);
  }

  function exportReport() {
    if (!analysis) return;
    const blob = new Blob([JSON.stringify(analysis, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `budget-analysis-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const currency = analysis?.currency ?? null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <header className="flex flex-wrap items-end justify-between gap-3 animate-in stagger-1">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 lg:text-3xl">
              AI Budget Optimizer
            </h1>
            <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-primary">
              <Sparkles className="h-2.5 w-2.5" />
              Advertix AI
            </span>
          </div>
          <p className="mt-1 text-sm text-slate-500">
            Analyzes your campaigns and recommends optimal budget allocation.
          </p>
        </div>
        <button
          type="button"
          onClick={runAnalysis}
          disabled={analyzing}
          className={clsx(
            "inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 px-4 py-2.5 text-sm font-bold text-white shadow-glow transition",
            analyzing ? "opacity-70" : "hover:-translate-y-0.5 hover:shadow-xl"
          )}
        >
          {analyzing ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Sparkles className="h-4 w-4" strokeWidth={2.5} />
          )}
          {analyzing ? "Analyzing…" : "Analyze Now"}
        </button>
      </header>

      {/* Planning-mode note */}
      <div className="flex items-start gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-xs text-slate-600 animate-in stagger-2">
        <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-400" />
        <span>
          <span className="font-semibold text-slate-700">Planning mode.</span>{" "}
          Applying a recommendation updates the budget in Advertix only — it is
          not pushed to Meta yet. Live budget changes arrive once Meta Standard
          Access is approved.
        </span>
      </div>

      {/* Body */}
      {analyzing ? (
        <AnalyzingState />
      ) : noCampaigns ? (
        <EmptyState
          icon={TrendingUp}
          title="No campaigns to optimize"
          description="Connect your ad accounts and run some campaigns to get AI budget recommendations."
          secondaryAction={{ label: "Connect Ad Account", href: "/settings" }}
        />
      ) : analysis?.insufficientData ? (
        <InsufficientData analysis={analysis} />
      ) : analysis ? (
        <>
          <SummaryCard analysis={analysis} />

          {/* Action row */}
          <div className="flex flex-wrap items-center gap-2 animate-in stagger-3">
            <button
              type="button"
              onClick={applyAll}
              disabled={applyingAll || pendingCount === 0}
              className={clsx(
                "inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 px-4 py-2.5 text-sm font-bold text-white shadow-glow transition",
                applyingAll || pendingCount === 0 ? "opacity-60" : "hover:-translate-y-0.5 hover:shadow-xl"
              )}
            >
              {applyingAll ? <Loader2 className="h-4 w-4 animate-spin" /> : <Rocket className="h-4 w-4" strokeWidth={2.5} />}
              {pendingCount > 0 ? `Apply ${pendingCount} change${pendingCount === 1 ? "" : "s"}` : "All applied"}
            </button>
            <button
              type="button"
              onClick={exportReport}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
            >
              <Download className="h-4 w-4" />
              Export
            </button>
            <button
              type="button"
              onClick={dismiss}
              className="inline-flex items-center gap-1.5 rounded-xl px-3 py-2.5 text-sm font-semibold text-slate-500 transition hover:bg-slate-100 hover:text-slate-700"
            >
              <X className="h-4 w-4" />
              Dismiss
            </button>
          </div>

          {/* Recommendations */}
          <div className="space-y-3">
            {[...analysis.recommendations]
              .sort((a, b) => a.priority - b.priority)
              .map((r) => (
                <RecommendationCard
                  key={r.campaignId}
                  r={r}
                  currency={currency}
                  applied={appliedIds.has(r.campaignId)}
                  skipped={skippedIds.has(r.campaignId)}
                  applying={applyingId === r.campaignId}
                  onApply={() => applyOne(r)}
                  onSkip={() => skipOne(r)}
                />
              ))}
          </div>

          <HistorySection />
        </>
      ) : (
        !loadingLatest && <InitialState onAnalyze={runAnalysis} />
      )}
    </div>
  );
}

/* ───────────────────────── sub-views ───────────────────────── */

function AnalyzingState() {
  const steps = [
    "Fetching campaign performance data",
    "Analyzing ROAS trends (last 14 days)",
    "Comparing platform performance",
    "Generating recommendations…",
  ];
  return (
    <div className="rounded-2xl border border-slate-200/70 bg-white p-10 text-center shadow-card animate-in">
      <div className="relative mx-auto mb-5 h-16 w-16">
        <div className="absolute inset-0 animate-pulse rounded-full bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 opacity-30 blur-2xl" />
        <div className="relative flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 shadow-glow">
          <Sparkles className="h-7 w-7 animate-pulse text-white" strokeWidth={2.5} />
        </div>
      </div>
      <p className="text-sm font-bold text-slate-800">Advertix AI is analyzing your campaigns…</p>
      <ul className="mx-auto mt-4 max-w-xs space-y-1.5 text-left">
        {steps.map((s, i) => (
          <li key={s} className="flex items-center gap-2 text-xs text-slate-600">
            {i < steps.length - 1 ? (
              <Check className="h-3.5 w-3.5 text-emerald-500" strokeWidth={3} />
            ) : (
              <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
            )}
            {s}
          </li>
        ))}
      </ul>
      <p className="mt-4 text-[11px] text-slate-400">This usually takes 5–10 seconds.</p>
    </div>
  );
}

function InitialState({ onAnalyze }: { onAnalyze: () => void }) {
  return (
    <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-12 text-center animate-in">
      <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10">
        <Sparkles className="h-7 w-7 text-primary" strokeWidth={2} />
      </div>
      <h3 className="text-lg font-bold text-slate-900">Optimize your ad budgets with AI</h3>
      <p className="mx-auto mt-1 max-w-md text-sm text-slate-500">
        Advertix AI reviews ROAS across your campaigns and recommends where to shift
        spend for better returns.
      </p>
      <button
        type="button"
        onClick={onAnalyze}
        className="mt-4 inline-flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2 text-sm font-bold text-white transition hover:bg-primary/90"
      >
        <Sparkles className="h-4 w-4" strokeWidth={2.5} />
        Run AI Budget Analysis
      </button>
    </div>
  );
}

function InsufficientData({ analysis }: { analysis: OptimizationAnalysis }) {
  return (
    <div className="rounded-2xl border border-amber-200 bg-amber-50/50 p-8 animate-in">
      <div className="flex items-start gap-3">
        <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-500" />
        <div>
          <h3 className="text-base font-bold text-slate-900">Not enough data to optimize yet</h3>
          <p className="mt-1 text-sm text-slate-600">{analysis.summary}</p>
          <ul className="mt-3 space-y-1.5">
            {analysis.insights.map((i) => (
              <li key={i} className="flex items-start gap-2 text-xs text-slate-600">
                <span className="mt-1 h-1 w-1 shrink-0 rounded-full bg-amber-400" />
                {i}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

function SummaryCard({ analysis }: { analysis: OptimizationAnalysis }) {
  return (
    <div className="overflow-hidden rounded-2xl border-2 border-primary/20 bg-white shadow-card animate-in stagger-2">
      <div className="grid gap-6 p-6 lg:grid-cols-[1fr_280px]">
        <div>
          <div className="flex items-center gap-2">
            <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 text-white">
              <Sparkles className="h-3.5 w-3.5" strokeWidth={2.5} />
            </span>
            <h2 className="text-base font-bold text-slate-900">AI Analysis Complete</h2>
          </div>
          <p className="mt-3 text-sm leading-relaxed text-slate-700">{analysis.summary}</p>
          <ul className="mt-4 space-y-1.5">
            {analysis.insights.map((i) => (
              <li key={i} className="flex items-start gap-2 text-xs text-slate-600">
                <Zap className="mt-0.5 h-3 w-3 shrink-0 text-primary" />
                {i}
              </li>
            ))}
          </ul>
          {(analysis.topOpportunity || analysis.biggestRisk) && (
            <div className="mt-4 grid gap-2 sm:grid-cols-2">
              {analysis.topOpportunity && (
                <div className="rounded-xl bg-emerald-50 p-3">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-600">Top opportunity</p>
                  <p className="mt-0.5 text-xs font-medium text-slate-700">{analysis.topOpportunity}</p>
                </div>
              )}
              {analysis.biggestRisk && (
                <div className="rounded-xl bg-rose-50 p-3">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-rose-600">Biggest risk</p>
                  <p className="mt-0.5 text-xs font-medium text-slate-700">{analysis.biggestRisk}</p>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="grid grid-cols-3 gap-3 lg:grid-cols-1">
          <StatBox label="Est. ROAS improvement" value={`+${(analysis.estimatedRoasImprovement ?? 0).toFixed(0)}%`} tone="emerald" />
          <StatBox
            label="Est. revenue increase"
            value={`+${fmtMoney(analysis.estimatedRevenueIncrease ?? 0, analysis.currency)}/mo`}
            tone="brand"
          />
          <StatBox
            label="Recommended budget"
            value={`${fmtMoney(analysis.totalRecommendedBudget ?? 0, analysis.currency)}/day`}
          />
        </div>
      </div>
    </div>
  );
}

function StatBox({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "emerald" | "brand";
}) {
  return (
    <div
      className={clsx(
        "rounded-xl border p-3",
        tone === "emerald"
          ? "border-emerald-200 bg-emerald-50/50"
          : tone === "brand"
            ? "border-primary/20 bg-primary/[0.05]"
            : "border-slate-200 bg-slate-50"
      )}
    >
      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{label}</p>
      <p
        className={clsx(
          "mt-0.5 text-lg font-bold",
          tone === "emerald" ? "text-emerald-700" : tone === "brand" ? "text-primary" : "text-slate-900"
        )}
      >
        {value}
      </p>
    </div>
  );
}

function RecommendationCard({
  r,
  currency,
  applied,
  skipped,
  applying,
  onApply,
  onSkip,
}: {
  r: BudgetRecommendationItem;
  currency: string | null;
  applied: boolean;
  skipped: boolean;
  applying: boolean;
  onApply: () => void;
  onSkip: () => void;
}) {
  const am = ACTION_META[r.action];
  const cm = CONFIDENCE_META[r.confidence];
  const Icon = am.icon;
  const positive = r.budgetChange > 0;

  return (
    <div
      className={clsx(
        "relative overflow-hidden rounded-2xl border bg-white p-5 shadow-card transition animate-in",
        skipped ? "border-slate-200 opacity-50" : "border-slate-200/70"
      )}
    >
      <span className="absolute inset-y-0 left-0 w-1 rounded-l-2xl" style={{ backgroundColor: am.color }} />
      {applied && (
        <span className="absolute right-4 top-4 inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-emerald-700">
          <Check className="h-2.5 w-2.5" strokeWidth={3} /> Applied
        </span>
      )}

      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <h3 className="truncate text-base font-bold text-slate-900">{r.campaignName}</h3>
          <span className="shrink-0 rounded-md bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-600">
            {r.platform}
          </span>
        </div>
        {!applied && (
          <span className={clsx("inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-bold", am.bg, am.text)}>
            <Icon className="h-3 w-3" strokeWidth={2.5} />
            {am.label}
          </span>
        )}
      </div>

      {/* Budget row */}
      <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
        <span className="font-semibold text-slate-500">{fmtMoney(r.currentBudget, currency)}/day</span>
        <ArrowRight className="h-4 w-4 text-slate-400" />
        <span className="font-bold text-slate-900">
          {r.action === "PAUSE" ? "Paused" : `${fmtMoney(r.recommendedBudget, currency)}/day`}
        </span>
        {r.action !== "PAUSE" && r.action !== "MAINTAIN" && (
          <span className={clsx("rounded-md px-1.5 py-0.5 text-xs font-bold", positive ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700")}>
            {positive ? "+" : ""}
            {fmtMoney(r.budgetChange, currency)} ({positive ? "+" : ""}
            {(r.budgetChangePercent ?? 0).toFixed(0)}%)
          </span>
        )}
      </div>

      <p className="mt-2 text-xs italic text-slate-500">{r.reason}</p>
      {r.expectedImpact && (
        <p className="mt-1 flex items-center gap-1 text-xs font-medium text-emerald-600">
          <TrendingUp className="h-3 w-3" /> {r.expectedImpact}
        </p>
      )}

      <div className="mt-3 flex items-center justify-between gap-2 border-t border-slate-100 pt-3">
        <div className="flex items-center gap-2">
          <span className={clsx("rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider", cm.bg, cm.text)}>
            {r.confidence}
          </span>
          <span className="text-[10px] font-medium text-slate-400">Priority #{r.priority}</span>
        </div>
        {!applied && !skipped && r.action !== "MAINTAIN" && (
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={onSkip}
              className="rounded-lg px-3 py-1.5 text-xs font-semibold text-slate-500 transition hover:bg-slate-100"
            >
              Skip
            </button>
            <button
              type="button"
              onClick={onApply}
              disabled={applying}
              className={clsx(
                "inline-flex items-center gap-1 rounded-lg bg-primary px-3 py-1.5 text-xs font-bold text-white transition",
                applying ? "opacity-60" : "hover:bg-primary/90"
              )}
            >
              {applying ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" strokeWidth={3} />}
              Apply
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

/* ───────────────────────── history ───────────────────────── */

function HistorySection() {
  const api = useApiClient();
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState<BudgetRecommendationRow[] | null>(null);

  async function toggle() {
    const next = !open;
    setOpen(next);
    if (next && rows === null) {
      try {
        setRows(await api.getBudgetHistory());
      } catch {
        setRows([]);
      }
    }
  }

  return (
    <div className="rounded-2xl border border-slate-200/70 bg-white shadow-card">
      <button
        type="button"
        onClick={toggle}
        className="flex w-full items-center justify-between px-5 py-4 text-sm font-bold text-slate-900"
      >
        Previous analyses
        <ChevronDown className={clsx("h-4 w-4 text-slate-400 transition", open && "rotate-180")} />
      </button>
      {open && (
        <div className="border-t border-slate-100 px-5 py-3">
          {rows === null ? (
            <p className="py-3 text-xs text-slate-400">Loading…</p>
          ) : rows.length === 0 ? (
            <p className="py-3 text-xs text-slate-400">No previous analyses yet.</p>
          ) : (
            <ul className="divide-y divide-slate-50">
              {rows.map((row) => (
                <li key={row.id} className="flex items-center justify-between gap-2 py-2.5 text-xs">
                  <span className="text-slate-600">{new Date(row.createdAt).toLocaleDateString()}</span>
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 font-semibold text-slate-600">{row.status}</span>
                  <span className="text-slate-500">{row.recommendations?.length ?? 0} campaigns</span>
                  <span className="font-semibold text-slate-700">{fmtMoney(Number(row.totalBudget), row.currency)}/day</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
