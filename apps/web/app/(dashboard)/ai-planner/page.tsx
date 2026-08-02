"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import clsx from "clsx";
import toast from "react-hot-toast";
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
  AlertTriangle,
  CalendarClock,
  ShieldCheck,
  RotateCcw,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { useApiClient } from "@/lib/api";
import type {
  CampaignPlan,
  PlannerContext,
  PlannerTurn,
  PlanScenario,
} from "@/lib/api";

type Message = {
  id: string;
  role: "user" | "ai";
  content: string;
  /** Rendered as clickable chips under a clarifying message. */
  questions?: string[];
};

const EXAMPLE_PROMPTS = [
  "I sell handmade leather bags online and want more sales",
  "I run a dental practice and need more new-patient bookings",
  "I have a B2B SaaS for accountants, want demo requests",
  "Local gym, want sign-ups for a 6-week challenge",
];

const WELCOME: Message = {
  id: "welcome",
  role: "ai",
  content:
    "I'm Alex — I've spent ten years running Meta ads for e-commerce, SaaS and service businesses. Tell me what you sell and what you're trying to get out of this, and I'll ask a couple of questions before I put numbers on anything.",
};

const ALLOCATION_COLORS = [
  "#6366f1",
  "#8b5cf6",
  "#ec4899",
  "#06b6d4",
  "#10b981",
  "#f59e0b",
];

/** Format a plain number in the plan's currency, without pretending it's USD. */
function planMoney(n: number, currency: string | undefined | null): string {
  const code = (currency || "USD").toUpperCase();
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: code,
      maximumFractionDigits: n % 1 === 0 ? 0 : 2,
    }).format(n);
  } catch {
    return `${code} ${n.toLocaleString()}`;
  }
}

export default function AIPlannerPage() {
  const api = useApiClient();
  const [messages, setMessages] = useState<Message[]>([WELCOME]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [plan, setPlan] = useState<CampaignPlan | null>(null);
  const [context, setContext] = useState<PlannerContext | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  /**
   * The transcript we replay to the model on every turn. Kept separate from
   * `messages` because that one carries UI-only entries (the welcome line,
   * error notices) which would poison the model's context — Alex should never
   * see "Sorry, something went wrong" as one of his own turns.
   */
  const transcriptRef = useRef<PlannerTurn[]>([]);

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

  function addMessage(
    role: "user" | "ai",
    content: string,
    questions?: string[]
  ) {
    setMessages((prev) => [
      ...prev,
      {
        id: `${role}-${Date.now()}-${Math.random().toString(36).slice(2)}`,
        role,
        content,
        questions,
      },
    ]);
  }

  const send = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || isLoading) return;

      addMessage("user", trimmed);
      setInput("");
      transcriptRef.current = [
        ...transcriptRef.current,
        { role: "user", content: trimmed },
      ];
      setIsLoading(true);

      try {
        const res = await api.planCampaign(transcriptRef.current);
        setContext(res.context);

        // Only the model's real reply goes back into the transcript, so the
        // next turn sees exactly what it said last time.
        transcriptRef.current = [
          ...transcriptRef.current,
          { role: "assistant", content: res.reply },
        ];

        if (res.mode === "plan") {
          setPlan(res.plan);
          addMessage("ai", res.reply);
        } else {
          addMessage("ai", res.reply, res.questions);
        }
      } catch (err) {
        const reason =
          err instanceof Error && err.message
            ? err.message
            : "Something went wrong on my end.";
        // Drop the failed user turn so a retry doesn't send it twice.
        transcriptRef.current = transcriptRef.current.slice(0, -1);
        addMessage(
          "ai",
          `${reason}\n\nSend that again and I'll pick up where we left off.`
        );
      } finally {
        setIsLoading(false);
      }
    },
    [api, isLoading]
  );

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void send(input);
    }
  }

  function resetConversation() {
    transcriptRef.current = [];
    setMessages([WELCOME]);
    setPlan(null);
    setInput("");
  }

  return (
    <div className="grid h-[calc(100vh-9rem)] grid-cols-1 gap-5 lg:grid-cols-5">
      {/* ── LEFT: Chat ── */}
      <section className="flex h-full flex-col overflow-hidden rounded-2xl border border-slate-200/70 bg-white shadow-card animate-in stagger-1 lg:col-span-3">
        <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-5 py-4">
          <div className="flex items-center gap-3">
            <div className="relative">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 shadow-glow">
                <Bot className="h-5 w-5 text-white" strokeWidth={2.25} />
              </div>
              <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-white bg-emerald-400" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">
                Alex · AI media buyer
              </h2>
              <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                <Sparkles className="h-2.5 w-2.5 text-primary" />
                10 years · $50M+ in Meta spend
              </span>
            </div>
          </div>
          {userMessageCount > 0 && (
            <button
              type="button"
              onClick={resetConversation}
              disabled={isLoading}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-2.5 py-1.5 text-[11px] font-semibold text-slate-500 transition hover:bg-slate-50 hover:text-slate-700 disabled:opacity-40"
            >
              <RotateCcw className="h-3 w-3" />
              Start over
            </button>
          )}
        </div>

        {/* What Alex actually knows about this account. Says out loud that the
            numbers below are grounded in the user's own currency and floor. */}
        {context && (
          <div className="flex flex-wrap items-center gap-1.5 border-b border-slate-100 bg-slate-50/60 px-5 py-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              Using your account
            </span>
            {context.currency && <ContextChip>{context.currency}</ContextChip>}
            {context.connectedPlatforms.length > 0 ? (
              <ContextChip>
                {context.connectedPlatforms.join(", ")}
              </ContextChip>
            ) : (
              <ContextChip tone="warn">No ad account connected</ContextChip>
            )}
            {context.hasPixel === false && (
              <ContextChip tone="warn">No Meta Pixel</ContextChip>
            )}
          </div>
        )}

        <div
          ref={scrollRef}
          className="flex-1 space-y-4 overflow-y-auto px-5 py-5"
        >
          {messages.map((m) => (
            <MessageBubble key={m.id} message={m} onPick={send} />
          ))}
          {isLoading && <LoadingDots />}

          {showExamples && !isLoading && (
            <div className="pt-2">
              <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Or start with one of these
              </p>
              <div className="flex flex-wrap gap-2">
                {EXAMPLE_PROMPTS.map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => void send(p)}
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
              disabled={isLoading}
              placeholder={
                plan
                  ? "Ask a follow-up — “what if I double the budget?”"
                  : "Tell me what you sell and who buys it…"
              }
              className="max-h-28 flex-1 resize-none border-0 bg-transparent px-2 py-1.5 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none disabled:opacity-60"
            />
            <button
              type="button"
              onClick={() => void send(input)}
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
            Estimates, not guarantees — review everything before you spend.
          </p>
        </div>
      </section>

      {/* ── RIGHT: Plan ── */}
      <section className="h-full overflow-hidden rounded-2xl animate-in stagger-2 lg:col-span-2">
        {plan ? (
          <GeneratedPlan plan={plan} context={context} />
        ) : (
          <PlanEmptyState thinking={isLoading} />
        )}
      </section>
    </div>
  );
}

/* ───────────────────────────────────────── */

function ContextChip({
  children,
  tone = "default",
}: {
  children: React.ReactNode;
  tone?: "default" | "warn";
}) {
  return (
    <span
      className={clsx(
        "rounded-md px-1.5 py-0.5 text-[10px] font-bold",
        tone === "warn"
          ? "bg-amber-100 text-amber-700"
          : "bg-white text-slate-600 ring-1 ring-inset ring-slate-200"
      )}
    >
      {children}
    </span>
  );
}

function MessageBubble({
  message,
  onPick,
}: {
  message: Message;
  onPick: (text: string) => void;
}) {
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
      <div className="max-w-[85%] space-y-2">
        <div className="whitespace-pre-wrap rounded-2xl rounded-tl-md border-l-2 border-primary bg-white px-4 py-2.5 text-sm leading-relaxed text-slate-700 shadow-sm ring-1 ring-slate-100">
          {message.content}
        </div>
        {/* Clarifying questions render as chips so the user can answer one at
            a time instead of composing a paragraph that covers all three. */}
        {message.questions && message.questions.length > 0 && (
          <div className="flex flex-col items-start gap-1.5">
            {message.questions.map((q, i) => (
              <button
                key={`${i}-${q}`}
                type="button"
                onClick={() => onPick(q)}
                className="max-w-full rounded-xl border border-primary/20 bg-primary/[0.04] px-3 py-2 text-left text-xs font-medium text-slate-700 transition hover:border-primary/40 hover:bg-primary/[0.08]"
              >
                <span className="mr-1.5 font-bold text-primary">{i + 1}.</span>
                {q}
              </button>
            ))}
            <p className="pl-1 text-[10px] text-slate-400">
              Answer in your own words below, or tap a question to quote it.
            </p>
          </div>
        )}
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

function PlanEmptyState({ thinking }: { thinking: boolean }) {
  return (
    <div className="flex h-full flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-300 bg-white px-6 py-12 text-center">
      <div className="relative mb-4">
        <div className="absolute inset-0 rounded-3xl bg-primary/10 blur-2xl" />
        <div className="relative flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-100">
          <Bot
            className={clsx(
              "h-8 w-8 text-slate-400",
              thinking && "animate-pulse"
            )}
            strokeWidth={1.75}
          />
        </div>
      </div>
      <h4 className="text-base font-bold text-slate-900">
        {thinking ? "Alex is working on it…" : "Your plan will appear here"}
      </h4>
      <p className="mt-1.5 max-w-xs text-sm text-slate-500">
        {thinking
          ? "Budget, audience, what to expect and what to watch in the first week."
          : "Alex will ask two or three questions first — a plan built on guesses is worse than no plan."}
      </p>
    </div>
  );
}

/* ───────────────────────────────────────── */

function GeneratedPlan({
  plan,
  context,
}: {
  plan: CampaignPlan;
  context: PlannerContext | null;
}) {
  const router = useRouter();
  const currency = plan.strategy?.currency || context?.currency || "USD";

  /**
   * Hand the whole plan to the campaign wizard.
   *
   * Previously this only carried platform/objective/budget/name and dropped
   * everything else, so the user re-entered the targeting by hand. Now the
   * schedule and audience travel with it too, and the wizard opens on its
   * review step with the fields already filled.
   */
  function applyToCampaign() {
    const days = Math.max(1, plan.strategy?.duration_days || 7);
    const dailyBudget = Math.max(
      1,
      Math.round(
        plan.budget_recommendation?.amount ??
          plan.strategy?.daily_budget ??
          (plan.strategy?.total_budget || 0) / days
      )
    );

    const start = new Date();
    const end = new Date(start.getTime() + days * 86_400_000);

    const platforms = (plan.strategy?.platform ?? [])
      .map((p) => p.toUpperCase())
      .filter(Boolean);

    try {
      sessionStorage.setItem(
        "aiPlanPrefill",
        JSON.stringify({
          platforms: platforms.length > 0 ? platforms : ["META"],
          objective: plan.strategy?.objective,
          budget: dailyBudget,
          name: plan.recommended_campaign_name,
          startDate: start.toISOString().slice(0, 10),
          endDate: end.toISOString().slice(0, 10),
          durationDays: days,
          audience: {
            ageRange: plan.target_audience?.age_range,
            genders: plan.target_audience?.genders,
            interests: plan.target_audience?.interests,
            locations: plan.target_audience?.locations,
          },
        })
      );
      toast.success("Plan applied — check it over and add your creative");
    } catch {
      // sessionStorage throws in some private-mode browsers. Still navigate:
      // an empty wizard beats a dead button.
      toast("Opening the campaign wizard");
    }
    router.push("/campaigns?new=1");
  }

  const allocation = (plan.budget_allocation ?? []).map((a, i) => ({
    ...a,
    color: ALLOCATION_COLORS[i % ALLOCATION_COLORS.length],
  }));
  const totalBudget = plan.strategy?.total_budget ?? 0;

  return (
    <div className="flex h-full flex-col overflow-hidden rounded-2xl border border-slate-200/70 bg-white shadow-card">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-5 py-4">
        <div className="min-w-0">
          <div className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-primary">
            <Sparkles className="h-2.5 w-2.5" />
            Alex&apos;s plan
          </div>
          <h3 className="truncate text-base font-bold text-slate-900">
            {plan.recommended_campaign_name || "Generated campaign plan"}
          </h3>
        </div>
        <button type="button" className="btn-brand" onClick={applyToCampaign}>
          Apply to Campaign
          <ArrowRight className="h-4 w-4" strokeWidth={2.5} />
        </button>
      </div>

      <div className="flex-1 space-y-4 overflow-y-auto p-5">
        {/* 1. The budget call — the number the user actually needs. */}
        {plan.budget_recommendation && (
          <div className="rounded-xl border-2 border-primary/25 bg-gradient-to-br from-primary/[0.06] to-purple-500/[0.04] p-4">
            <div className="flex items-start gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 text-white shadow-md">
                <Wallet className="h-4 w-4" strokeWidth={2.5} />
              </div>
              <div className="min-w-0">
                <p className="text-[10px] font-bold uppercase tracking-wider text-primary">
                  Recommended budget
                </p>
                <p className="text-xl font-bold text-slate-900">
                  {planMoney(plan.budget_recommendation.amount, currency)}
                  <span className="text-sm font-semibold text-slate-500">
                    {" "}
                    / {plan.budget_recommendation.period || "day"}
                  </span>
                </p>
                <p className="mt-1 text-xs leading-relaxed text-slate-600">
                  {plan.budget_recommendation.rationale}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* 2. Strategy Overview */}
        <PlanCard title="Strategy">
          <div className="grid grid-cols-2 gap-3">
            <OverviewRow
              label="Platform"
              value={(plan.strategy?.platform ?? []).join(", ") || "Meta"}
            />
            <OverviewRow
              label="Objective"
              value={plan.strategy?.objective ?? "—"}
            />
            <OverviewRow
              label="Duration"
              value={`${plan.strategy?.duration_days ?? 0} days`}
            />
            <OverviewRow
              label="Total budget"
              value={planMoney(totalBudget, currency)}
            />
          </div>
          {plan.strategy?.summary && (
            <p className="mt-3 rounded-lg bg-slate-50 p-2.5 text-xs leading-relaxed text-slate-600">
              {plan.strategy.summary}
            </p>
          )}
        </PlanCard>

        {/* 3. What to actually expect — the trust-builder. */}
        {plan.realistic_expectations && (
          <PlanCard title="What to realistically expect" icon={TrendingUp}>
            {plan.realistic_expectations.assumption && (
              <p className="mb-3 rounded-lg bg-slate-50 p-2.5 text-[11px] leading-relaxed text-slate-600">
                <span className="font-bold text-slate-700">Assuming:</span>{" "}
                {plan.realistic_expectations.assumption}
              </p>
            )}
            <div className="space-y-2">
              <ScenarioRow
                scenario={plan.realistic_expectations.best_case}
                tone="emerald"
              />
              <ScenarioRow
                scenario={plan.realistic_expectations.realistic_case}
                tone="indigo"
                emphasis
              />
              <ScenarioRow
                scenario={plan.realistic_expectations.worst_case}
                tone="slate"
              />
            </div>
          </PlanCard>
        )}

        {/* 4. Budget Allocation */}
        {allocation.length > 0 && (
          <PlanCard title="Where the money goes">
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
              </div>
              <ul className="flex-1 space-y-1.5">
                {allocation.map((a) => (
                  <li
                    key={a.channel}
                    className="flex items-center justify-between gap-2 text-xs"
                  >
                    <div className="flex min-w-0 items-center gap-2">
                      <span
                        className="h-2 w-2 shrink-0 rounded-full"
                        style={{ backgroundColor: a.color }}
                      />
                      <span className="truncate font-medium text-slate-700">
                        {a.channel}
                      </span>
                    </div>
                    <span className="shrink-0 font-bold text-slate-900">
                      {planMoney(a.amount, currency)} · {a.percentage}%
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </PlanCard>
        )}

        {/* 5. Target Audience */}
        <PlanCard title="Who sees it" icon={Target}>
          {plan.target_audience?.persona && (
            <p className="mb-3 rounded-lg border-l-2 border-primary bg-primary/[0.04] p-2.5 text-xs italic leading-relaxed text-slate-700">
              {plan.target_audience.persona}
            </p>
          )}
          <div className="space-y-2">
            {plan.target_audience?.age_range && (
              <AudienceLine label="Age">
                {plan.target_audience.age_range}
              </AudienceLine>
            )}
            {(plan.target_audience?.genders?.length ?? 0) > 0 && (
              <AudienceLine label="Gender">
                {plan.target_audience.genders.join(", ")}
              </AudienceLine>
            )}
            {(plan.target_audience?.interests?.length ?? 0) > 0 && (
              <AudienceLine label="Interests">
                <Chips items={plan.target_audience.interests} />
              </AudienceLine>
            )}
            {(plan.target_audience?.locations?.length ?? 0) > 0 && (
              <AudienceLine label="Locations">
                <Chips items={plan.target_audience.locations} />
              </AudienceLine>
            )}
            {(plan.target_audience?.behaviors?.length ?? 0) > 0 && (
              <AudienceLine label="Behaviors">
                <Chips items={plan.target_audience.behaviors} />
              </AudienceLine>
            )}
            {plan.target_audience?.estimated_reach && (
              <AudienceLine label="Est. reach">
                {plan.target_audience.estimated_reach}
              </AudienceLine>
            )}
          </div>
        </PlanCard>

        {/* 6. Mistakes to avoid — objective-specific, the part that saves money */}
        {(plan.common_mistakes?.length ?? 0) > 0 && (
          <PlanCard title="Mistakes to avoid" icon={AlertTriangle}>
            <ul className="space-y-2.5">
              {plan.common_mistakes!.map((m, i) => (
                <li
                  key={`${i}-${m.title}`}
                  className="rounded-lg border border-amber-200 bg-amber-50/60 p-3"
                >
                  <p className="text-xs font-bold text-amber-900">{m.title}</p>
                  <p className="mt-0.5 text-[11px] leading-relaxed text-amber-800">
                    {m.detail}
                  </p>
                  {m.fix && (
                    <p className="mt-1.5 flex items-start gap-1.5 text-[11px] leading-relaxed text-slate-700">
                      <ShieldCheck className="mt-px h-3 w-3 shrink-0 text-emerald-600" />
                      <span>
                        <span className="font-bold">Do this instead: </span>
                        {m.fix}
                      </span>
                    </p>
                  )}
                </li>
              ))}
            </ul>
          </PlanCard>
        )}

        {/* 7. What happens next */}
        {plan.next_steps && (
          <PlanCard title="What happens next" icon={CalendarClock}>
            <div className="space-y-3">
              <NextStepGroup
                label="First 24 hours"
                items={plan.next_steps.first_24h}
              />
              <NextStepGroup
                label="First 48 hours"
                items={plan.next_steps.first_48h}
              />
              <NextStepGroup label="First 7 days" items={plan.next_steps.first_7d} />
            </div>
          </PlanCard>
        )}

        {/* 8. Recommended Creatives */}
        {(plan.ad_formats?.length ?? 0) > 0 && (
          <PlanCard title="Creative to make">
            <ul className="space-y-2">
              {plan.ad_formats.map((f, i) => (
                <CreativeLine key={`${f.format}-${i}`} format={f} />
              ))}
            </ul>
          </PlanCard>
        )}

        {/* 9. Expected Results */}
        {plan.expected_results && (
          <PlanCard title="Projected numbers" icon={TrendingUp}>
            <div className="grid grid-cols-3 gap-2">
              <ResultStat
                label={`Est. ${plan.expected_results.primary_metric}`}
                value={`${(plan.expected_results.estimated_min ?? 0).toLocaleString()}–${(plan.expected_results.estimated_max ?? 0).toLocaleString()}`}
                tone="emerald"
              />
              <ResultStat
                label="Cost each"
                value={`${planMoney(plan.expected_results.estimated_cpl_min ?? 0, currency)}–${planMoney(plan.expected_results.estimated_cpl_max ?? 0, currency)}`}
                tone="indigo"
              />
              <ResultStat
                label="Est. reach"
                value={`${formatCompact(plan.expected_results.estimated_reach_min ?? 0)}–${formatCompact(plan.expected_results.estimated_reach_max ?? 0)}`}
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
        )}

        {/* 10. Insights */}
        {(plan.ai_insights?.length ?? 0) > 0 && (
          <PlanCard title="Worth knowing" icon={Sparkles}>
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

        <p className="pb-1 text-center text-[10px] leading-relaxed text-slate-400">
          Every figure here is an estimate based on typical performance, not a
          guarantee. Your creative and your offer move these numbers more than
          anything else in this plan.
        </p>
      </div>
    </div>
  );
}

/* ───────────────────────────────────────── */

function ScenarioRow({
  scenario,
  tone,
  emphasis,
}: {
  scenario: PlanScenario | undefined;
  tone: "emerald" | "indigo" | "slate";
  emphasis?: boolean;
}) {
  if (!scenario) return null;
  const toneCls = {
    emerald: "border-emerald-200 bg-emerald-50/60",
    indigo: "border-indigo-200 bg-indigo-50/60",
    slate: "border-slate-200 bg-slate-50/60",
  }[tone];
  const labelCls = {
    emerald: "text-emerald-700",
    indigo: "text-indigo-700",
    slate: "text-slate-600",
  }[tone];
  return (
    <div
      className={clsx(
        "rounded-lg border p-2.5",
        toneCls,
        emphasis && "ring-1 ring-inset ring-indigo-300"
      )}
    >
      <div className="flex items-baseline justify-between gap-2">
        <span className={clsx("text-[10px] font-bold uppercase tracking-wider", labelCls)}>
          {scenario.label}
        </span>
        <span className="shrink-0 text-xs font-bold text-slate-900">
          {scenario.metric}
        </span>
      </div>
      <p className="mt-1 text-[11px] leading-relaxed text-slate-600">
        {scenario.detail}
      </p>
    </div>
  );
}

function NextStepGroup({ label, items }: { label: string; items?: string[] }) {
  if (!items || items.length === 0) return null;
  return (
    <div>
      <p className="mb-1 text-[10px] font-bold uppercase tracking-wider text-primary">
        {label}
      </p>
      <ul className="space-y-1">
        {items.map((s, i) => (
          <li
            key={`${i}-${s}`}
            className="flex items-start gap-2 text-xs leading-relaxed text-slate-700"
          >
            <span className="mt-1.5 inline-block h-1 w-1 shrink-0 rounded-full bg-slate-400" />
            {s}
          </li>
        ))}
      </ul>
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

const FORMAT_GRADIENTS: Array<{
  match: RegExp;
  gradient: string;
  icon: LucideIcon;
}> = [
  { match: /image/i, gradient: "from-indigo-500 to-purple-600", icon: ImageIcon },
  { match: /video/i, gradient: "from-emerald-500 to-teal-600", icon: Film },
  {
    match: /carousel|collection/i,
    gradient: "from-amber-500 to-rose-500",
    icon: Layers,
  },
  {
    match: /story|stories/i,
    gradient: "from-pink-500 to-fuchsia-600",
    icon: ImageIcon,
  },
  { match: /reel/i, gradient: "from-rose-500 to-orange-500", icon: Film },
];

function CreativeLine({
  format,
}: {
  format: { format: string; count: number; placement: string; rationale?: string };
}) {
  const fg =
    FORMAT_GRADIENTS.find((g) => g.match.test(format.format)) ??
    FORMAT_GRADIENTS[0];
  const Icon = fg.icon;
  return (
    <li className="flex items-start gap-3 rounded-lg bg-slate-50 px-3 py-2">
      <div
        className={clsx(
          "mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br text-white shadow-sm",
          fg.gradient
        )}
      >
        <Icon className="h-4 w-4" strokeWidth={2.25} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-xs font-bold text-slate-900">
          {format.count}× {format.format}
        </p>
        <p className="text-[10px] text-slate-500">{format.placement}</p>
        {format.rationale && (
          <p className="mt-0.5 text-[11px] leading-relaxed text-slate-600">
            {format.rationale}
          </p>
        )}
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
