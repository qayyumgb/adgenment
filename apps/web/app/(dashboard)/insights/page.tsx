"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import clsx from "clsx";
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
  type LucideIcon,
} from "lucide-react";

type InsightType = "OPPORTUNITY" | "WARNING" | "OPTIMIZATION" | "ALERT";

type Insight = {
  id: string;
  type: InsightType;
  title: string;
  description: string;
  campaigns: string[];
  impact: string;
  hoursAgo: number;
};

const INSIGHTS: Insight[] = [
  {
    id: "i1",
    type: "OPPORTUNITY",
    title: "Shift $300/day from LinkedIn to Meta",
    description:
      "Meta is generating 2.3× better ROAS than LinkedIn this month. Reallocating budget could capture an extra $4,200/mo in revenue without raising overall spend.",
    campaigns: ["Brand Campaign", "Lead Gen Q2"],
    impact: "+$4,200/mo estimated monthly revenue",
    hoursAgo: 2,
  },
  {
    id: "i2",
    type: "WARNING",
    title: "Summer Sale budget depletes in 3 days",
    description:
      "At current pace, the Summer Sale 2026 daily spend will exhaust the campaign budget by May 28. Top up to keep delivery uninterrupted.",
    campaigns: ["Summer Sale 2026"],
    impact: "Campaign will auto-pause if not addressed",
    hoursAgo: 5,
  },
  {
    id: "i3",
    type: "OPTIMIZATION",
    title: "Enable Advantage+ on Meta campaigns",
    description:
      "AI-driven placement and audience expansion is currently disabled on 3 of your Meta campaigns. Turning it on should lift ROAS by an estimated 23% based on benchmark data.",
    campaigns: ["Product Launch"],
    impact: "+23% better ROAS estimated",
    hoursAgo: 6,
  },
  {
    id: "i4",
    type: "ALERT",
    title: "TikTok CTR dropped 41% in last 24 hours",
    description:
      "Engagement on your TikTok Brand campaign collapsed yesterday — likely creative fatigue on the top-performing variant. Refresh creatives ASAP.",
    campaigns: ["TikTok Brand"],
    impact: "Immediate attention needed",
    hoursAgo: 1,
  },
  {
    id: "i5",
    type: "OPPORTUNITY",
    title: "Add retargeting to your Google campaigns",
    description:
      "Your Google Search campaigns drive 4,300 monthly clicks but no retargeting layer is configured. A simple display retargeting addition could recover ~$2,800/mo in lost conversions.",
    campaigns: ["Google Search Main"],
    impact: "+$2,800/mo",
    hoursAgo: 12,
  },
  {
    id: "i6",
    type: "OPTIMIZATION",
    title: "Video creatives outperforming static 3.2×",
    description:
      "Across all platforms, your video creatives produce 3.2× the CTR of static images. Reallocating production budget toward video would compound returns.",
    campaigns: ["Multiple"],
    impact: "Reallocate creative budget",
    hoursAgo: 18,
  },
  {
    id: "i7",
    type: "WARNING",
    title: "LinkedIn CPL increased 58% this week",
    description:
      "Cost per lead on LinkedIn jumped from $42 to $66 over the last 7 days. Likely caused by audience saturation — consider refreshing targeting.",
    campaigns: ["LinkedIn B2B"],
    impact: "Review targeting",
    hoursAgo: 24,
  },
  {
    id: "i8",
    type: "OPPORTUNITY",
    title: "Tuesday–Thursday campaigns get 41% better ROAS",
    description:
      "Mid-week campaigns are outperforming weekends across all platforms. Front-loading more budget Mon–Thu could materially lift overall efficiency.",
    campaigns: ["All Active"],
    impact: "Adjust campaign scheduling",
    hoursAgo: 36,
  },
];

const TYPE_META: Record<
  InsightType,
  {
    label: string;
    color: string;
    stripBg: string;
    iconBg: string;
    iconColor: string;
    pillBg: string;
    pillText: string;
    icon: LucideIcon;
  }
> = {
  OPPORTUNITY: {
    label: "Opportunity",
    color: "#10b981",
    stripBg: "bg-emerald-500",
    iconBg: "bg-emerald-100",
    iconColor: "text-emerald-700",
    pillBg: "bg-emerald-100",
    pillText: "text-emerald-700",
    icon: TrendingUp,
  },
  WARNING: {
    label: "Warning",
    color: "#f59e0b",
    stripBg: "bg-amber-500",
    iconBg: "bg-amber-100",
    iconColor: "text-amber-700",
    pillBg: "bg-amber-100",
    pillText: "text-amber-700",
    icon: AlertTriangle,
  },
  OPTIMIZATION: {
    label: "Optimization",
    color: "#6366f1",
    stripBg: "bg-primary",
    iconBg: "bg-primary/10",
    iconColor: "text-primary",
    pillBg: "bg-primary/10",
    pillText: "text-primary",
    icon: Lightbulb,
  },
  ALERT: {
    label: "Alert",
    color: "#ef4444",
    stripBg: "bg-rose-500",
    iconBg: "bg-rose-100",
    iconColor: "text-rose-700",
    pillBg: "bg-rose-100",
    pillText: "text-rose-700",
    icon: AlertCircle,
  },
};

function timeAgo(hours: number): string {
  if (hours < 1) return "just now";
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  return `${days}d ago`;
}

export default function InsightsPage() {
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const [showDismissed, setShowDismissed] = useState(false);

  const active = useMemo(
    () => INSIGHTS.filter((i) => !dismissed.has(i.id)),
    [dismissed]
  );
  const dismissedList = useMemo(
    () => INSIGHTS.filter((i) => dismissed.has(i.id)),
    [dismissed]
  );

  function dismiss(id: string) {
    setDismissed((prev) => new Set(prev).add(id));
  }
  function restore(id: string) {
    setDismissed((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  }

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
              Powered by Claude AI
            </span>
          </div>
          <p className="mt-1 text-sm text-slate-500">
            Auto-generated observations across your campaigns, refreshed hourly.
          </p>
        </div>
        <button
          type="button"
          className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
        >
          <RefreshCw className="h-4 w-4" />
          Refresh All
        </button>
      </header>

      {/* ── Insight cards ── */}
      {active.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-12 text-center animate-in">
          <p className="text-sm font-semibold text-slate-700">
            You&apos;re all caught up — no active insights right now.
          </p>
        </div>
      ) : (
        <div className="space-y-3 animate-in stagger-2">
          {active.map((i) => (
            <InsightCard
              key={i.id}
              insight={i}
              onDismiss={() => dismiss(i.id)}
            />
          ))}
        </div>
      )}

      {/* ── Dismissed section ── */}
      {dismissedList.length > 0 && (
        <div className="rounded-2xl border border-slate-200/70 bg-white shadow-card animate-in stagger-3">
          <button
            type="button"
            onClick={() => setShowDismissed((v) => !v)}
            className="flex w-full items-center justify-between px-5 py-3 text-left transition hover:bg-slate-50/50"
          >
            <span className="text-sm font-bold text-slate-700">
              Show {dismissedList.length} dismissed insight
              {dismissedList.length === 1 ? "" : "s"}
            </span>
            <ChevronDown
              className={clsx(
                "h-4 w-4 text-slate-400 transition-transform",
                showDismissed && "rotate-180"
              )}
            />
          </button>
          {showDismissed && (
            <div className="space-y-2 border-t border-slate-100 p-3">
              {dismissedList.map((i) => {
                const tm = TYPE_META[i.type];
                return (
                  <div
                    key={i.id}
                    className="flex items-center gap-3 rounded-xl border border-slate-100 bg-slate-50/40 px-3 py-2"
                  >
                    <div
                      className={clsx(
                        "flex h-7 w-7 shrink-0 items-center justify-center rounded-lg",
                        tm.iconBg,
                        tm.iconColor
                      )}
                    >
                      <tm.icon className="h-3.5 w-3.5" />
                    </div>
                    <p className="flex-1 truncate text-xs font-semibold text-slate-600">
                      {i.title}
                    </p>
                    <button
                      type="button"
                      onClick={() => restore(i.id)}
                      className="text-xs font-semibold text-primary transition hover:underline"
                    >
                      Restore
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── Floating chat widget ── */}
      <ChatWidget />
    </div>
  );
}

/* ───────────────────────────────────────── */
function InsightCard({
  insight,
  onDismiss,
}: {
  insight: Insight;
  onDismiss: () => void;
}) {
  const tm = TYPE_META[insight.type];

  return (
    <div className="relative overflow-hidden rounded-2xl border border-slate-200/70 bg-white shadow-card transition hover:-translate-y-0.5 hover:shadow-card-hover">
      <span className={clsx("absolute inset-y-0 left-0 w-1.5", tm.stripBg)} />
      <div className="flex flex-col gap-4 p-5 pl-7 lg:flex-row lg:items-start">
        <div className="flex flex-1 items-start gap-3">
          <div
            className={clsx(
              "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl",
              tm.iconBg,
              tm.iconColor
            )}
          >
            <tm.icon className="h-5 w-5" strokeWidth={2.25} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span
                className={clsx(
                  "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider",
                  tm.pillBg,
                  tm.pillText
                )}
              >
                {tm.label}
              </span>
              <span className="text-[10px] font-medium text-slate-400">
                Generated {timeAgo(insight.hoursAgo)}
              </span>
            </div>
            <h3 className="mt-1.5 text-base font-bold text-slate-900">
              {insight.title}
            </h3>
            <p className="mt-1 text-sm leading-relaxed text-slate-600">
              {insight.description}
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Affected campaigns:
              </span>
              {insight.campaigns.map((c) => (
                <span
                  key={c}
                  className="rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-700"
                >
                  {c}
                </span>
              ))}
            </div>
            <p
              className={clsx(
                "mt-3 inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-bold",
                tm.pillBg,
                tm.pillText
              )}
            >
              <TrendingUp className="h-3 w-3" />
              {insight.impact}
            </p>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2 lg:flex-col lg:items-stretch">
          <button type="button" className="btn-brand">
            Apply Now
            <ArrowRight className="h-4 w-4" strokeWidth={2.5} />
          </button>
          <button
            type="button"
            onClick={onDismiss}
            className="text-xs font-semibold text-slate-500 transition hover:text-slate-700"
          >
            Dismiss
          </button>
        </div>
      </div>
    </div>
  );
}

/* ───────────────────────────────────────── */
/* Floating chat widget                       */
/* ───────────────────────────────────────── */

type ChatMessage = { id: string; role: "user" | "ai"; content: string };

function ChatWidget() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: "welcome",
      role: "ai",
      content:
        "Hi! Ask me anything about your campaigns — performance, optimizations, or what to do next.",
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, loading, open]);

  function send() {
    const text = input.trim();
    if (!text || loading) return;
    setMessages((prev) => [
      ...prev,
      { id: `u-${Date.now()}`, role: "user", content: text },
    ]);
    setInput("");
    setLoading(true);
    // Mock response — could be wired to /api/ai/chat later
    setTimeout(() => {
      setMessages((prev) => [
        ...prev,
        {
          id: `a-${Date.now()}`,
          role: "ai",
          content:
            "Based on your current data, your Meta campaigns are performing 34% better than last week. The top contributor is your retargeting ad set — consider scaling its budget by $80/day.",
        },
      ]);
      setLoading(false);
    }, 1200);
  }

  return (
    <>
      {/* Floating button */}
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

      {/* Popup */}
      {open && (
        <div className="fixed bottom-6 right-6 z-40 flex h-[400px] w-[320px] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl animate-in">
          <div className="flex items-center justify-between border-b border-slate-100 bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 px-4 py-3 text-white">
            <div className="flex items-center gap-2">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-white/15 backdrop-blur">
                <Bot className="h-4 w-4" strokeWidth={2.5} />
              </div>
              <div>
                <p className="text-sm font-bold">Ask AI</p>
                <p className="text-[10px] font-medium opacity-80">
                  Claude · always-on
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Close"
              className="flex h-7 w-7 items-center justify-center rounded-lg text-white/80 transition hover:bg-white/10 hover:text-white"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div
            ref={scrollRef}
            className="flex-1 space-y-2.5 overflow-y-auto bg-slate-50/40 p-3"
          >
            {messages.map((m) =>
              m.role === "user" ? (
                <div key={m.id} className="flex justify-end">
                  <div className="max-w-[85%] rounded-2xl rounded-br-md bg-primary px-3 py-2 text-xs leading-relaxed text-white shadow-sm">
                    {m.content}
                  </div>
                </div>
              ) : (
                <div key={m.id} className="flex items-start gap-1.5">
                  <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-gradient-to-br from-indigo-500 to-purple-600">
                    <Bot
                      className="h-2.5 w-2.5 text-white"
                      strokeWidth={2.5}
                    />
                  </div>
                  <div className="max-w-[85%] rounded-2xl rounded-tl-md border-l-2 border-primary bg-white px-3 py-2 text-xs leading-relaxed text-slate-700 shadow-sm">
                    {m.content}
                  </div>
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
                    0%,
                    80%,
                    100% {
                      transform: translateY(0);
                      opacity: 0.4;
                    }
                    40% {
                      transform: translateY(-3px);
                      opacity: 1;
                    }
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
                className={clsx(
                  "flex h-7 w-7 items-center justify-center rounded-lg transition",
                  input.trim() && !loading
                    ? "bg-primary text-white hover:-translate-y-0.5"
                    : "bg-slate-100 text-slate-400"
                )}
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
      style={{
        animation: "bounce-dot 1.2s ease-in-out infinite",
        animationDelay: delay,
      }}
    />
  );
}
