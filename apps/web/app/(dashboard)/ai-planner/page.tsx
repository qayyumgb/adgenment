"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import clsx from "clsx";
import {
  Bot,
  Send,
  Sparkles,
  ArrowRight,
  Target,
  Image as ImageIcon,
  Film,
  Layers,
  TrendingUp,
  type LucideIcon,
} from "lucide-react";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";

type Message = {
  id: string;
  role: "user" | "ai";
  content: string;
};

export type CampaignPlan = {
  strategy: {
    platform: string[];
    objective: string;
    duration_days: number;
    total_budget: number;
    currency: string;
    summary: string;
  };
  budget_allocation: Array<{
    channel: string;
    percentage: number;
    amount: number;
    rationale: string;
  }>;
  target_audience: {
    age_range: string;
    genders: string[];
    interests: string[];
    locations: string[];
    behaviors: string[];
    estimated_reach: string;
  };
  ad_formats: Array<{
    format: string;
    count: number;
    placement: string;
    rationale: string;
  }>;
  expected_results: {
    primary_metric: string;
    estimated_min: number;
    estimated_max: number;
    estimated_reach_min: number;
    estimated_reach_max: number;
    estimated_cpl_min: number;
    estimated_cpl_max: number;
    confidence: "low" | "medium" | "high";
  };
  ai_insights: string[];
  recommended_campaign_name: string;
};

const EXAMPLE_PROMPTS = [
  "Run a campaign to get 100 leads for my SaaS product, budget $500",
  "Promote my e-commerce store on TikTok, $50/day",
  "Build brand awareness for my restaurant in New York",
  "Retarget website visitors with $1000 budget",
];

const WELCOME: Message = {
  id: "welcome",
  role: "ai",
  content:
    "Hi! I'm your AI Campaign Planner. Tell me about your advertising goal and I'll create a complete campaign strategy for you. What would you like to achieve?",
};

const ALLOCATION_COLORS = [
  "#6366f1",
  "#8b5cf6",
  "#ec4899",
  "#06b6d4",
  "#10b981",
  "#f59e0b",
];

export default function AIPlannerPage() {
  const [messages, setMessages] = useState<Message[]>([WELCOME]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [plan, setPlan] = useState<CampaignPlan | null>(null);
  const [showPlan, setShowPlan] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isLoading]);

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 112) + "px";
  }, [input]);

  const userMessageCount = messages.filter((m) => m.role === "user").length;
  const showExamples = userMessageCount === 0;

  function addMessage(role: "user" | "ai", content: string) {
    setMessages((prev) => [
      ...prev,
      { id: `${role}-${Date.now()}-${Math.random()}`, role, content },
    ]);
  }

  async function callAI(userMessage: string) {
    setIsLoading(true);
    try {
      const res = await fetch("/api/ai/plan-campaign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: userMessage }),
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        throw new Error(data.error ?? "Failed to generate plan");
      }
      const newPlan = data.plan as CampaignPlan;
      setPlan(newPlan);
      setShowPlan(true);

      const summary = `I've created a campaign plan for you! Here's what I recommend:

📍 **Platform:** ${newPlan.strategy.platform.join(", ")}
🎯 **Objective:** ${newPlan.strategy.objective}
💰 **Budget:** $${newPlan.strategy.total_budget.toLocaleString()} over ${newPlan.strategy.duration_days} days
📈 **Expected Results:** ${newPlan.expected_results.estimated_min.toLocaleString()}–${newPlan.expected_results.estimated_max.toLocaleString()} ${newPlan.expected_results.primary_metric}

Check the plan details on the right →`;

      addMessage("ai", summary);
    } catch (err) {
      console.error("[ai-planner] error", err);
      const reason =
        err instanceof Error && err.message
          ? err.message
          : "Something went wrong.";
      addMessage(
        "ai",
        `I couldn't generate that plan — **${reason}**\n\nTry describing your goal in more detail, for example:\n• "Run a 14-day Meta campaign to get 100 SaaS leads, $500 budget"\n• "Promote my e-commerce store on TikTok, $50/day"`
      );
    } finally {
      setIsLoading(false);
    }
  }

  function send(text: string) {
    const trimmed = text.trim();
    if (!trimmed || isLoading) return;
    addMessage("user", trimmed);
    setInput("");
    void callAI(trimmed);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send(input);
    }
  }

  return (
    <div className="grid h-[calc(100vh-9rem)] grid-cols-1 gap-5 lg:grid-cols-5">
      {/* ── LEFT: Chat ── */}
      <section className="flex h-full flex-col overflow-hidden rounded-2xl border border-slate-200/70 bg-white shadow-card animate-in stagger-1 lg:col-span-3">
        <div className="flex items-center gap-3 border-b border-slate-100 px-5 py-4">
          <div className="relative">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 shadow-glow">
              <Bot className="h-5 w-5 text-white" strokeWidth={2.25} />
            </div>
            <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-white bg-emerald-400" />
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-900">
              AI Campaign Planner
            </h2>
            <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-slate-500">
              <Sparkles className="h-2.5 w-2.5 text-primary" />
              Powered by Claude AI
            </span>
          </div>
        </div>

        <div
          ref={scrollRef}
          className="flex-1 space-y-4 overflow-y-auto px-5 py-5"
        >
          {messages.map((m) => (
            <MessageBubble key={m.id} message={m} />
          ))}
          {isLoading && <LoadingDots />}

          {showExamples && !isLoading && (
            <div className="pt-2">
              <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Try one of these
              </p>
              <div className="flex flex-wrap gap-2">
                {EXAMPLE_PROMPTS.map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => send(p)}
                    className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:-translate-y-0.5 hover:border-primary/40 hover:bg-primary/5 hover:text-primary hover:shadow-sm"
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="border-t border-slate-100 bg-slate-50/40 px-5 py-4">
          <div className="flex items-end gap-2 rounded-xl border border-slate-200 bg-white p-2 shadow-sm transition focus-within:border-primary focus-within:shadow-md">
            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              rows={1}
              placeholder="Describe your campaign goal in plain English…"
              className="max-h-28 flex-1 resize-none border-0 bg-transparent px-2 py-1.5 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none"
            />
            <button
              type="button"
              onClick={() => send(input)}
              disabled={!input.trim() || isLoading}
              aria-label="Send message"
              className={clsx(
                "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg transition",
                input.trim() && !isLoading
                  ? "bg-primary text-white shadow-md hover:-translate-y-0.5 hover:shadow-glow"
                  : "bg-slate-100 text-slate-400"
              )}
            >
              <Send className="h-4 w-4" strokeWidth={2.25} />
            </button>
          </div>
          <p className="mt-2 flex items-center gap-1 text-[10px] font-medium text-slate-400">
            <Sparkles className="h-2.5 w-2.5 text-primary" />
            Powered by Claude Sonnet · responses are generated drafts you should
            review
          </p>
        </div>
      </section>

      {/* ── RIGHT: Plan preview ── */}
      <section className="h-full overflow-hidden rounded-2xl animate-in stagger-2 lg:col-span-2">
        {showPlan && plan ? (
          <GeneratedPlan plan={plan} />
        ) : (
          <PlanEmptyState />
        )}
      </section>
    </div>
  );
}

/* ───────────────────────────────────────── */
function MessageBubble({ message }: { message: Message }) {
  if (message.role === "user") {
    return (
      <div className="flex justify-end animate-in">
        <div className="max-w-[80%] whitespace-pre-wrap rounded-2xl rounded-br-md bg-primary px-4 py-2.5 text-sm leading-relaxed text-white shadow-md">
          {message.content}
        </div>
      </div>
    );
  }
  return (
    <div className="flex items-start gap-2.5 animate-in">
      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 shadow-sm">
        <Bot className="h-3.5 w-3.5 text-white" strokeWidth={2.5} />
      </div>
      <div className="max-w-[80%] whitespace-pre-wrap rounded-2xl rounded-tl-md border-l-2 border-primary bg-white px-4 py-2.5 text-sm leading-relaxed text-slate-700 shadow-sm ring-1 ring-slate-100">
        {message.content}
      </div>
    </div>
  );
}

function LoadingDots() {
  return (
    <div className="flex items-start gap-2.5 animate-in">
      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 shadow-sm">
        <Bot className="h-3.5 w-3.5 text-white" strokeWidth={2.5} />
      </div>
      <div className="flex items-center gap-1.5 rounded-2xl rounded-tl-md border-l-2 border-primary bg-white px-4 py-3 shadow-sm ring-1 ring-slate-100">
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
            transform: translateY(-4px);
            opacity: 1;
          }
        }
      `}</style>
    </div>
  );
}

function Dot({ delay }: { delay: string }) {
  return (
    <span
      className="inline-block h-1.5 w-1.5 rounded-full bg-primary"
      style={{
        animation: "bounce-dot 1.2s ease-in-out infinite",
        animationDelay: delay,
      }}
    />
  );
}

/* ───────────────────────────────────────── */
function PlanEmptyState() {
  return (
    <div className="flex h-full flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-300 bg-white px-6 py-12 text-center">
      <div className="relative mb-4">
        <div className="absolute inset-0 rounded-3xl bg-primary/10 blur-2xl" />
        <div className="relative flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-100">
          <Bot className="h-8 w-8 text-slate-400" strokeWidth={1.75} />
        </div>
      </div>
      <h4 className="text-base font-bold text-slate-900">
        Your campaign plan will appear here
      </h4>
      <p className="mt-1.5 max-w-xs text-sm text-slate-500">
        Describe your goal to get started. I&apos;ll draft a full strategy
        including platform, budget split, audience, and creative
        recommendations.
      </p>
    </div>
  );
}

/* ───────────────────────────────────────── */
function GeneratedPlan({ plan }: { plan: CampaignPlan }) {
  const router = useRouter();

  function applyToCampaign() {
    const days = Math.max(1, plan.strategy.duration_days || 1);
    const dailyBudget = Math.round((plan.strategy.total_budget || 0) / days);
    // Backend Platform enum is uppercase; AI may return mixed-case strings.
    const platforms = (plan.strategy.platform ?? [])
      .map((p) => p.toUpperCase())
      .filter(Boolean);
    try {
      sessionStorage.setItem(
        "aiPlanPrefill",
        JSON.stringify({
          platforms,
          objective: plan.strategy.objective,
          budget: dailyBudget,
          name: plan.recommended_campaign_name,
        })
      );
    } catch {
      // sessionStorage can throw in private-mode browsers — fall back to
      // just navigating without prefill.
    }
    router.push("/campaigns?new=1");
  }

  const allocation = plan.budget_allocation.map((a, i) => ({
    ...a,
    color: ALLOCATION_COLORS[i % ALLOCATION_COLORS.length],
  }));
  const totalBudget = plan.strategy.total_budget;
  const currency = plan.strategy.currency === "USD" ? "$" : "";

  return (
    <div className="flex h-full flex-col overflow-hidden rounded-2xl border border-slate-200/70 bg-white shadow-card">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-5 py-4">
        <div>
          <div className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-primary">
            <Sparkles className="h-2.5 w-2.5" />
            AI Generated
          </div>
          <h3 className="text-base font-bold text-slate-900">
            Generated Campaign Plan
          </h3>
          {plan.recommended_campaign_name && (
            <p className="mt-0.5 text-xs font-medium text-slate-500">
              Suggested name: {plan.recommended_campaign_name}
            </p>
          )}
        </div>
        <button type="button" className="btn-brand" onClick={applyToCampaign}>
          Apply to Campaign
          <ArrowRight className="h-4 w-4" strokeWidth={2.5} />
        </button>
      </div>

      <div className="flex-1 space-y-4 overflow-y-auto p-5">
        {/* 1. Strategy Overview */}
        <PlanCard title="Strategy Overview">
          <div className="grid grid-cols-2 gap-3">
            <OverviewRow
              label="Platform"
              value={plan.strategy.platform.join(", ")}
            />
            <OverviewRow label="Objective" value={plan.strategy.objective} />
            <OverviewRow
              label="Duration"
              value={`${plan.strategy.duration_days} days`}
            />
            <OverviewRow
              label="Total Budget"
              value={`${currency}${totalBudget.toLocaleString()}`}
            />
          </div>
          {plan.strategy.summary && (
            <p className="mt-3 rounded-lg bg-slate-50 p-2.5 text-xs leading-relaxed text-slate-600">
              {plan.strategy.summary}
            </p>
          )}
        </PlanCard>

        {/* 2. Budget Allocation */}
        {allocation.length > 0 && (
          <PlanCard title="Budget Allocation">
            <div className="flex items-center gap-4">
              <div className="relative h-24 w-24 shrink-0">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={allocation}
                      dataKey="percentage"
                      nameKey="channel"
                      innerRadius={28}
                      outerRadius={42}
                      paddingAngle={3}
                      stroke="none"
                      isAnimationActive
                    >
                      {allocation.map((a) => (
                        <Cell key={a.channel} fill={a.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      cursor={false}
                      contentStyle={{
                        borderRadius: 10,
                        border: "1px solid #e2e8f0",
                        fontSize: 11,
                        padding: "6px 10px",
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
                <div className="pointer-events-none absolute inset-0 flex items-center justify-center text-[10px] font-bold text-slate-700">
                  {currency}
                  {totalBudget.toLocaleString()}
                </div>
              </div>
              <ul className="flex-1 space-y-1.5">
                {allocation.map((a) => (
                  <li
                    key={a.channel}
                    className="flex items-center justify-between text-xs"
                  >
                    <div className="flex items-center gap-2">
                      <span
                        className="h-2 w-2 rounded-full"
                        style={{ backgroundColor: a.color }}
                      />
                      <span className="font-medium text-slate-700">
                        {a.channel}
                      </span>
                    </div>
                    <span className="font-bold text-slate-900">
                      {currency}
                      {a.amount.toLocaleString()} · {a.percentage}%
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </PlanCard>
        )}

        {/* 3. Target Audience */}
        <PlanCard title="Target Audience" icon={Target}>
          <div className="space-y-2">
            {plan.target_audience.age_range && (
              <AudienceLine label="Age">
                {plan.target_audience.age_range}
              </AudienceLine>
            )}
            {plan.target_audience.genders?.length > 0 && (
              <AudienceLine label="Genders">
                {plan.target_audience.genders.join(", ")}
              </AudienceLine>
            )}
            {plan.target_audience.interests?.length > 0 && (
              <AudienceLine label="Interests">
                <Chips items={plan.target_audience.interests} />
              </AudienceLine>
            )}
            {plan.target_audience.locations?.length > 0 && (
              <AudienceLine label="Locations">
                <Chips items={plan.target_audience.locations} />
              </AudienceLine>
            )}
            {plan.target_audience.behaviors?.length > 0 && (
              <AudienceLine label="Behaviors">
                <Chips items={plan.target_audience.behaviors} />
              </AudienceLine>
            )}
            {plan.target_audience.estimated_reach && (
              <AudienceLine label="Est. reach">
                {plan.target_audience.estimated_reach}
              </AudienceLine>
            )}
          </div>
        </PlanCard>

        {/* 4. Recommended Creatives */}
        {plan.ad_formats.length > 0 && (
          <PlanCard title="Recommended Creatives">
            <ul className="space-y-2">
              {plan.ad_formats.map((f, i) => (
                <CreativeLine key={`${f.format}-${i}`} format={f} />
              ))}
            </ul>
            <button
              type="button"
              className="mt-3 inline-flex items-center gap-1 text-xs font-bold text-primary hover:underline"
            >
              <Sparkles className="h-3 w-3" />
              Generate these with AI →
            </button>
          </PlanCard>
        )}

        {/* 5. Expected Results */}
        <PlanCard title="Expected Results" icon={TrendingUp}>
          <div className="grid grid-cols-3 gap-2">
            <ResultStat
              label={`Est. ${plan.expected_results.primary_metric}`}
              value={`${plan.expected_results.estimated_min.toLocaleString()}–${plan.expected_results.estimated_max.toLocaleString()}`}
              tone="emerald"
            />
            <ResultStat
              label="Est. CPL"
              value={`$${plan.expected_results.estimated_cpl_min.toFixed(2)}–$${plan.expected_results.estimated_cpl_max.toFixed(2)}`}
              tone="indigo"
            />
            <ResultStat
              label="Est. Reach"
              value={`${formatCompact(plan.expected_results.estimated_reach_min)}–${formatCompact(plan.expected_results.estimated_reach_max)}`}
              tone="purple"
            />
          </div>
          <div className="mt-3 flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
              Confidence
            </span>
            <span
              className={clsx(
                "rounded-full px-2 py-0.5 text-[10px] font-bold uppercase",
                plan.expected_results.confidence === "high"
                  ? "bg-emerald-100 text-emerald-700"
                  : plan.expected_results.confidence === "medium"
                    ? "bg-amber-100 text-amber-700"
                    : "bg-slate-100 text-slate-600"
              )}
            >
              {plan.expected_results.confidence}
            </span>
          </div>
        </PlanCard>

        {/* 6. AI Insights */}
        {plan.ai_insights.length > 0 && (
          <PlanCard title="AI Insights" icon={Sparkles}>
            <ul className="space-y-2">
              {plan.ai_insights.map((insight, i) => (
                <li
                  key={i}
                  className="flex items-start gap-2 text-xs leading-relaxed text-slate-700"
                >
                  <span className="mt-1 inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                  {insight}
                </li>
              ))}
            </ul>
          </PlanCard>
        )}
      </div>
    </div>
  );
}

function PlanCard({
  title,
  icon: Icon,
  children,
}: {
  title: string;
  icon?: LucideIcon;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 transition hover:border-slate-300">
      <div className="mb-3 flex items-center gap-2">
        {Icon && (
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Icon className="h-3.5 w-3.5" strokeWidth={2.5} />
          </div>
        )}
        <h4 className="text-sm font-bold text-slate-900">{title}</h4>
      </div>
      <div>{children}</div>
    </div>
  );
}

function OverviewRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
        {label}
      </p>
      <p className="text-sm font-bold text-slate-900">{value}</p>
    </div>
  );
}

function AudienceLine({
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
      <div className="text-right text-xs font-semibold text-slate-700">
        {children}
      </div>
    </div>
  );
}

function Chips({ items }: { items: string[] }) {
  return (
    <div className="flex flex-wrap justify-end gap-1.5">
      {items.map((i) => (
        <span
          key={i}
          className="rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-700"
        >
          {i}
        </span>
      ))}
    </div>
  );
}

const FORMAT_GRADIENTS: Array<{ match: RegExp; gradient: string; icon: LucideIcon }> = [
  { match: /image/i, gradient: "from-indigo-500 to-purple-600", icon: ImageIcon },
  { match: /video/i, gradient: "from-emerald-500 to-teal-600", icon: Film },
  { match: /carousel|collection/i, gradient: "from-amber-500 to-rose-500", icon: Layers },
  { match: /story|stories/i, gradient: "from-pink-500 to-fuchsia-600", icon: ImageIcon },
  { match: /reel/i, gradient: "from-rose-500 to-orange-500", icon: Film },
];

function CreativeLine({
  format,
}: {
  format: { format: string; count: number; placement: string };
}) {
  const fg =
    FORMAT_GRADIENTS.find((g) => g.match.test(format.format)) ??
    FORMAT_GRADIENTS[0];
  const Icon = fg.icon;
  return (
    <li className="flex items-center gap-3 rounded-lg bg-slate-50 px-3 py-2">
      <div
        className={clsx(
          "flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br text-white shadow-sm",
          fg.gradient
        )}
      >
        <Icon className="h-4 w-4" strokeWidth={2.25} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-xs font-bold text-slate-900">
          {format.count}× {format.format}
        </p>
        <p className="truncate text-[10px] text-slate-500">{format.placement}</p>
      </div>
    </li>
  );
}

function ResultStat({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: "emerald" | "indigo" | "purple";
}) {
  const toneCls = {
    emerald: "bg-emerald-50 text-emerald-700 ring-emerald-200/60",
    indigo: "bg-indigo-50 text-indigo-700 ring-indigo-200/60",
    purple: "bg-purple-50 text-purple-700 ring-purple-200/60",
  }[tone];
  return (
    <div className={clsx("rounded-lg p-2 text-center ring-1 ring-inset", toneCls)}>
      <p className="text-[9px] font-bold uppercase tracking-wider opacity-80">
        {label}
      </p>
      <p className="text-xs font-bold">{value}</p>
    </div>
  );
}

function formatCompact(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1).replace(/\.0$/, "") + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(1).replace(/\.0$/, "") + "K";
  return n.toString();
}
