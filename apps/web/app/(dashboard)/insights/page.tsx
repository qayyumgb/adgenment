"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import clsx from "clsx";
import toast from "react-hot-toast";
import {
  Sparkles,
  RefreshCw,
  ArrowRight,
  TrendingUp,
  AlertTriangle,
  Lightbulb,
  AlertCircle,
  Bot,
  Send,
  X,
  ChevronDown,
  Check,
  Loader2,
  BarChart3,
  type LucideIcon,
} from "lucide-react";
import { useApi } from "@/hooks/useApi";
import { useApiClient } from "@/lib/api";
import EmptyState from "@/components/ui/EmptyState";
import type { Insight, InsightsResponse, CampaignsResponse } from "@/lib/api";

type InsightType = Insight["type"];

const TYPE_META: Record<
  InsightType,
  {
    label: string;
    stripBg: string;
    iconBg: string;
    iconColor: string;
    pillBg: string;
    pillText: string;
    icon: LucideIcon;
  }
> = {
  OPPORTUNITY: { label: "Opportunity", stripBg: "bg-emerald-500", iconBg: "bg-emerald-100", iconColor: "text-emerald-700", pillBg: "bg-emerald-100", pillText: "text-emerald-700", icon: TrendingUp },
  WARNING: { label: "Warning", stripBg: "bg-amber-500", iconBg: "bg-amber-100", iconColor: "text-amber-700", pillBg: "bg-amber-100", pillText: "text-amber-700", icon: AlertTriangle },
  OPTIMIZATION: { label: "Optimization", stripBg: "bg-primary", iconBg: "bg-primary/10", iconColor: "text-primary", pillBg: "bg-primary/10", pillText: "text-primary", icon: Lightbulb },
  ALERT: { label: "Alert", stripBg: "bg-rose-500", iconBg: "bg-rose-100", iconColor: "text-rose-700", pillBg: "bg-rose-100", pillText: "text-rose-700", icon: AlertCircle },
};

const CONFIDENCE_DOT: Record<Insight["confidence"], string> = {
  HIGH: "bg-emerald-500",
  MEDIUM: "bg-amber-500",
  LOW: "bg-slate-400",
};

function timeAgo(iso: string): string {
  const h = Math.floor((Date.now() - new Date(iso).getTime()) / 3_600_000);
  if (h < 1) return "just now";
  if (h < 24) return `${h}h ago`;
  return `${Math.round(h / 24)}d ago`;
}

export default function InsightsPage() {
  const api = useApiClient();
  const insightsQ = useApi<InsightsResponse>((c) => c.getInsights(), []);
  const campaignsQ = useApi<CampaignsResponse>(
    (c) => c.getCampaigns({ limit: "1" }),
    []
  );

  const [generating, setGenerating] = useState(false);
  const [appliedIds, setAppliedIds] = useState<Set<string>>(new Set());
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set());
  const [busyId, setBusyId] = useState<string | null>(null);

  // Dismissed section
  const [showDismissed, setShowDismissed] = useState(false);
  const [dismissed, setDismissed] = useState<Insight[] | null>(null);

  const insights = insightsQ.data?.insights ?? [];
  const active = useMemo(
    () => insights.filter((i) => !dismissedIds.has(i.id)),
    [insights, dismissedIds]
  );
  const campaignsTotal = campaignsQ.data?.total ?? 0;
  const lastGeneratedAt = insightsQ.data?.lastGeneratedAt ?? null;

  const generate = useCallback(async () => {
    setGenerating(true);
    try {
      const res = await api.generateInsights();
      await insightsQ.refetch();
      setAppliedIds(new Set());
      setDismissedIds(new Set());
      toast.success(
        res.generated
          ? `Insights updated — ${res.total} insight${res.total === 1 ? "" : "s"}`
          : "Already up to date (refreshed under an hour ago)"
      );
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't generate insights");
    } finally {
      setGenerating(false);
    }
  }, [api, insightsQ]);

  async function applyOne(i: Insight) {
    setBusyId(i.id);
    try {
      await api.applyInsight(i.id);
      setAppliedIds((s) => new Set(s).add(i.id));
      toast.success("Recommendation marked as applied");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusyId(null);
    }
  }

  async function dismissOne(i: Insight) {
    setBusyId(i.id);
    try {
      await api.dismissInsight(i.id);
      setDismissedIds((s) => new Set(s).add(i.id));
      setDismissed(null); // refetch on next open
      toast.success("Insight dismissed");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusyId(null);
    }
  }

  async function toggleDismissed() {
    const next = !showDismissed;
    setShowDismissed(next);
    if (next && dismissed === null) {
      try {
        const res = await api.getDismissedInsights();
        setDismissed(res.insights);
      } catch {
        setDismissed([]);
      }
    }
  }

  async function restore(id: string) {
    try {
      await api.restoreInsight(id);
      setDismissed((d) => (d ? d.filter((x) => x.id !== id) : d));
      setDismissedIds((s) => {
        const n = new Set(s);
        n.delete(id);
        return n;
      });
      await insightsQ.refetch();
      toast.success("Insight restored");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    }
  }

  const loading = insightsQ.loading || campaignsQ.loading;

  return (
    <div className="space-y-6">
      {/* ── Top bar ── */}
      <header className="flex flex-wrap items-end justify-between gap-3 animate-in stagger-1">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 lg:text-3xl">
              AI Insights
            </h1>
            <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-primary">
              <Sparkles className="h-2.5 w-2.5" />
              Powered by Advertix AI
            </span>
          </div>
          <p className="mt-1 text-sm text-slate-500">
            {lastGeneratedAt
              ? `AI-generated from your campaign data · updated ${timeAgo(lastGeneratedAt)}`
              : "AI-generated observations across your campaigns."}
          </p>
        </div>
        <button
          type="button"
          onClick={generate}
          disabled={generating}
          className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50 disabled:opacity-60"
        >
          {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          {generating ? "Analyzing…" : "Refresh All"}
        </button>
      </header>

      {/* ── Body ── */}
      {loading ? (
        <div className="space-y-3">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="h-32 animate-pulse rounded-2xl border border-slate-200/70 bg-slate-100" />
          ))}
        </div>
      ) : active.length === 0 ? (
        campaignsTotal === 0 ? (
          <EmptyState
            icon={Lightbulb}
            title="No insights yet"
            description="Connect your ad accounts and sync campaigns to get AI-powered insights."
            secondaryAction={{ label: "Connect Ad Account", href: "/settings" }}
          />
        ) : (
          <EmptyState
            icon={BarChart3}
            title="Not enough data yet"
            description="Run your campaigns for a few days, then generate AI insights from the results."
            action={{ label: generating ? "Analyzing…" : "Generate Insights", onClick: generate, icon: Sparkles }}
          />
        )
      ) : (
        <div className="space-y-3 animate-in stagger-2">
          {active.map((i) => (
            <InsightCard
              key={i.id}
              insight={i}
              applied={appliedIds.has(i.id)}
              busy={busyId === i.id}
              onApply={() => applyOne(i)}
              onDismiss={() => dismissOne(i)}
            />
          ))}
        </div>
      )}

      {/* ── Dismissed section ── */}
      <div className="rounded-2xl border border-slate-200/70 bg-white shadow-card animate-in stagger-3">
        <button
          type="button"
          onClick={toggleDismissed}
          className="flex w-full items-center justify-between px-5 py-3 text-left transition hover:bg-slate-50/50"
        >
          <span className="text-sm font-bold text-slate-700">Dismissed insights</span>
          <ChevronDown className={clsx("h-4 w-4 text-slate-400 transition-transform", showDismissed && "rotate-180")} />
        </button>
        {showDismissed && (
          <div className="space-y-2 border-t border-slate-100 p-3">
            {dismissed === null ? (
              <p className="px-2 py-1 text-xs text-slate-400">Loading…</p>
            ) : dismissed.length === 0 ? (
              <p className="px-2 py-1 text-xs text-slate-400">No dismissed insights.</p>
            ) : (
              dismissed.map((i) => {
                const tm = TYPE_META[i.type];
                return (
                  <div key={i.id} className="flex items-center gap-3 rounded-xl border border-slate-100 bg-slate-50/40 px-3 py-2">
                    <div className={clsx("flex h-7 w-7 shrink-0 items-center justify-center rounded-lg", tm.iconBg, tm.iconColor)}>
                      <tm.icon className="h-3.5 w-3.5" />
                    </div>
                    <p className="flex-1 truncate text-xs font-semibold text-slate-600">{i.title}</p>
                    <button
                      type="button"
                      onClick={() => restore(i.id)}
                      className="text-xs font-semibold text-primary transition hover:underline"
                    >
                      Restore
                    </button>
                  </div>
                );
              })
            )}
          </div>
        )}
      </div>

      <ChatWidget topInsight={active[0]?.title} hasInsights={active.length > 0} />
    </div>
  );
}

/* ───────────────────────────────────────── */
function InsightCard({
  insight,
  applied,
  busy,
  onApply,
  onDismiss,
}: {
  insight: Insight;
  applied: boolean;
  busy: boolean;
  onApply: () => void;
  onDismiss: () => void;
}) {
  const tm = TYPE_META[insight.type];
  const campaigns = insight.affectedCampaigns ?? [];
  const impactCls =
    insight.impactType === "revenue"
      ? "bg-emerald-100 text-emerald-700"
      : insight.impactType === "cost"
        ? "bg-amber-100 text-amber-700"
        : clsx(tm.pillBg, tm.pillText);

  return (
    <div className={clsx("relative overflow-hidden rounded-2xl border border-slate-200/70 bg-white shadow-card transition", !applied && "hover:-translate-y-0.5 hover:shadow-card-hover", applied && "opacity-80")}>
      <span className={clsx("absolute inset-y-0 left-0 w-1.5", tm.stripBg)} />
      <div className="flex flex-col gap-4 p-5 pl-7 lg:flex-row lg:items-start">
        <div className="flex flex-1 items-start gap-3">
          <div className={clsx("flex h-10 w-10 shrink-0 items-center justify-center rounded-xl", tm.iconBg, tm.iconColor)}>
            <tm.icon className="h-5 w-5" strokeWidth={2.25} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className={clsx("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider", tm.pillBg, tm.pillText)}>
                {tm.label}
              </span>
              <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-slate-400">
                <span className={clsx("h-1.5 w-1.5 rounded-full", CONFIDENCE_DOT[insight.confidence])} />
                {insight.confidence}
              </span>
              <span className="text-[10px] font-medium text-slate-400">Generated {timeAgo(insight.createdAt)}</span>
            </div>
            <h3 className="mt-1.5 text-base font-bold text-slate-900">{insight.title}</h3>
            <p className="mt-1 text-sm leading-relaxed text-slate-600">{insight.message}</p>
            {campaigns.length > 0 && (
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Affected campaigns:</span>
                {campaigns.map((c) => (
                  <span key={c} className="rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-700">{c}</span>
                ))}
              </div>
            )}
            {insight.impact && (
              <p className={clsx("mt-3 inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-bold", impactCls)}>
                <TrendingUp className="h-3 w-3" />
                {insight.impact}
              </p>
            )}
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2 lg:flex-col lg:items-stretch">
          {applied ? (
            <span className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-emerald-100 px-3 py-2 text-sm font-bold text-emerald-700">
              <Check className="h-4 w-4" strokeWidth={2.5} /> Applied
            </span>
          ) : (
            <>
              <button type="button" onClick={onApply} disabled={busy} className="btn-brand disabled:opacity-60">
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <>Apply Now <ArrowRight className="h-4 w-4" strokeWidth={2.5} /></>}
              </button>
              <button type="button" onClick={onDismiss} disabled={busy} className="text-xs font-semibold text-slate-500 transition hover:text-slate-700 disabled:opacity-60">
                Dismiss
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

/* ───────────────────────────────────────── */
/* Floating chat widget (still mock — wired to /ai/chat later) */
/* ───────────────────────────────────────── */

type ChatMessage = { id: string; role: "user" | "ai"; content: string };

function ChatWidget({ topInsight, hasInsights }: { topInsight?: string; hasInsights: boolean }) {
  const [open, setOpen] = useState(false);
  const welcome = hasInsights
    ? `Based on your campaigns, my top insight right now is: "${topInsight}". Ask me for details or what to do next.`
    : "Connect your ad accounts and run campaigns to get personalized AI recommendations.";
  const [messages, setMessages] = useState<ChatMessage[]>([
    { id: "welcome", role: "ai", content: welcome },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, loading, open]);

  function send() {
    const text = input.trim();
    if (!text || loading) return;
    setMessages((prev) => [...prev, { id: `u-${Date.now()}`, role: "user", content: text }]);
    setInput("");
    setLoading(true);
    // Mock response — wire to /ai/chat later.
    setTimeout(() => {
      setMessages((prev) => [
        ...prev,
        {
          id: `a-${Date.now()}`,
          role: "ai",
          content: hasInsights
            ? "Open the Insights list above for the full, data-backed breakdown — each card has the specific numbers and a recommended action."
            : "Once you've connected an ad account and your campaigns have a few days of data, I'll surface specific recommendations here.",
        },
      ]);
      setLoading(false);
    }, 1000);
  }

  return (
    <>
      {!open && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Ask AI"
          className="fixed bottom-6 right-6 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 text-white shadow-2xl ring-4 ring-white transition hover:-translate-y-0.5 hover:shadow-glow"
        >
          <Bot className="h-6 w-6" strokeWidth={2.25} />
          <span className="absolute -right-1 -top-1 flex h-3 w-3 items-center justify-center">
            <span className="absolute h-3 w-3 animate-ping rounded-full bg-emerald-400 opacity-75" />
            <span className="relative h-2 w-2 rounded-full bg-emerald-500" />
          </span>
        </button>
      )}

      {open && (
        <div className="fixed bottom-6 right-6 z-40 flex h-[400px] w-[320px] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl animate-in">
          <div className="flex items-center justify-between border-b border-slate-100 bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 px-4 py-3 text-white">
            <div className="flex items-center gap-2">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-white/15 backdrop-blur">
                <Bot className="h-4 w-4" strokeWidth={2.5} />
              </div>
              <div>
                <p className="text-sm font-bold">Ask AI</p>
                <p className="text-[10px] font-medium opacity-80">Advertix AI</p>
              </div>
            </div>
            <button type="button" onClick={() => setOpen(false)} aria-label="Close" className="flex h-7 w-7 items-center justify-center rounded-lg text-white/80 transition hover:bg-white/10 hover:text-white">
              <X className="h-4 w-4" />
            </button>
          </div>

          <div ref={scrollRef} className="flex-1 space-y-2.5 overflow-y-auto bg-slate-50/40 p-3">
            {messages.map((m) =>
              m.role === "user" ? (
                <div key={m.id} className="flex justify-end">
                  <div className="max-w-[85%] rounded-2xl rounded-br-md bg-primary px-3 py-2 text-xs leading-relaxed text-white shadow-sm">{m.content}</div>
                </div>
              ) : (
                <div key={m.id} className="flex items-start gap-1.5">
                  <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-gradient-to-br from-indigo-500 to-purple-600">
                    <Bot className="h-2.5 w-2.5 text-white" strokeWidth={2.5} />
                  </div>
                  <div className="max-w-[85%] rounded-2xl rounded-tl-md border-l-2 border-primary bg-white px-3 py-2 text-xs leading-relaxed text-slate-700 shadow-sm">{m.content}</div>
                </div>
              )
            )}
            {loading && (
              <div className="flex items-start gap-1.5">
                <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-gradient-to-br from-indigo-500 to-purple-600">
                  <Bot className="h-2.5 w-2.5 text-white" strokeWidth={2.5} />
                </div>
                <div className="flex items-center gap-1 rounded-2xl rounded-tl-md border-l-2 border-primary bg-white px-3 py-2 shadow-sm">
                  <Dot delay="0s" />
                  <Dot delay="0.15s" />
                  <Dot delay="0.3s" />
                </div>
                <style jsx>{`
                  @keyframes bounce-dot {
                    0%, 80%, 100% { transform: translateY(0); opacity: 0.4; }
                    40% { transform: translateY(-3px); opacity: 1; }
                  }
                `}</style>
              </div>
            )}
          </div>

          <div className="border-t border-slate-100 bg-white p-2">
            <div className="flex items-center gap-1.5 rounded-xl border border-slate-200 px-2 transition focus-within:border-primary">
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    send();
                  }
                }}
                placeholder="Ask about your campaign performance…"
                className="h-8 flex-1 border-0 bg-transparent text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none"
              />
              <button
                type="button"
                onClick={send}
                disabled={!input.trim() || loading}
                aria-label="Send"
                className={clsx("flex h-7 w-7 items-center justify-center rounded-lg transition", input.trim() && !loading ? "bg-primary text-white hover:-translate-y-0.5" : "bg-slate-100 text-slate-400")}
              >
                <Send className="h-3.5 w-3.5" strokeWidth={2.5} />
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function Dot({ delay }: { delay: string }) {
  return (
    <span
      className="inline-block h-1 w-1 rounded-full bg-primary"
      style={{ animation: "bounce-dot 1.2s ease-in-out infinite", animationDelay: delay }}
    />
  );
}
