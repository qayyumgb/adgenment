"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { ArrowRight, Check, ChevronDown, RotateCcw, Sparkles } from "lucide-react";
import type { PlannerContextData, PlannerStarter } from "@/lib/api";
import { cn } from "@/lib/cn";
import { Button, Menu, MenuItem, Skeleton } from "@/components/app/ui";
import { STEP_LABELS, type Refinement } from "./format";
import type { ChatMsg } from "./usePlanner";

/**
 * The planner chat (guide §5 row 9, plan A12): greeting with starters from
 * real data, bubbles, the reasoning steps under the newest answer, and a
 * composer with refinement chips (or the clarify suggestions).
 */

function Steps({ steps }: { steps: NonNullable<ChatMsg["steps"]> }) {
  const details = steps.details ? [steps.details.performance, steps.details.compare, steps.details.checks, steps.clarify ? "Needs a few answers first" : null] : [];
  return (
    <ol className="flex flex-col gap-1.5 rounded-[10px] bg-surface px-3 py-2.5" aria-label="What Advertix did">
      {STEP_LABELS.map((label, i) => {
        const done = steps.done > i;
        const current = steps.done === i;
        return (
          <li key={label} className="flex items-start gap-2 text-[13px] leading-[1.4]">
            <span
              className={cn(
                "mt-[1px] inline-flex h-4 w-4 flex-none items-center justify-center rounded-full",
                done ? "bg-pos text-white" : current ? "border-2 border-brand border-t-transparent animate-spin motion-reduce:animate-none" : "bg-line-2"
              )}
              aria-hidden="true"
            >
              {done && <Check size={10} strokeWidth={4} />}
            </span>
            <span className="flex min-w-0 flex-col">
              <span className={done ? "text-ink" : "text-ink-3"}>{i === 3 && steps.clarify && done ? "Asked what's missing" : label}</span>
              {done && details[i] && <span className="text-xs text-ink-3">{details[i]}</span>}
            </span>
            <span className="sr-only">{done ? "done" : current ? "in progress" : "waiting"}</span>
          </li>
        );
      })}
    </ol>
  );
}

function Bubble({ m, onRetry }: { m: ChatMsg; onRetry: () => void }) {
  if (m.role === "user") {
    return (
      <div className="flex justify-end">
        <div className="max-w-[86%] whitespace-pre-wrap rounded-[14px_4px_14px_14px] bg-brand-soft px-3.5 py-3 text-sm text-ink [text-wrap:pretty]">{m.text}</div>
      </div>
    );
  }
  return (
    <div className="flex gap-2.5">
      <span className="inline-flex h-[30px] w-[30px] flex-none items-center justify-center rounded-[10px] bg-[image:var(--grad)] text-white" aria-hidden="true">
        <Sparkles size={14} strokeWidth={2.5} />
      </span>
      <div className={cn("flex max-w-[86%] flex-col gap-2.5 rounded-[4px_14px_14px_14px] px-3.5 py-3 text-sm [text-wrap:pretty]", m.error ? "bg-neg-soft text-neg" : "bg-surface-2 text-ink")}>
        <span className="whitespace-pre-wrap" aria-live={m.steps && m.steps.done < 4 ? "polite" : undefined}>
          {m.text}
        </span>
        {m.questions && m.questions.length > 0 && (
          <ol className="flex list-decimal flex-col gap-1 pl-5">
            {m.questions.map((q) => (
              <li key={q}>{q}</li>
            ))}
          </ol>
        )}
        {m.steps && <Steps steps={m.steps} />}
        {m.error && m.retry && (
          <Button variant="secondary" size="sm" icon={<RotateCcw size={14} />} onClick={onRetry} className="self-start">
            Try again
          </Button>
        )}
      </div>
    </div>
  );
}

function Starters({ starters, onPick, disabled }: { starters: PlannerStarter[]; onPick: (s: PlannerStarter) => void; disabled: boolean }) {
  return (
    <div className="grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-2.5">
      {starters.map((s) => (
        <button
          key={`${s.clientId}-${s.title}`}
          type="button"
          disabled={disabled}
          onClick={() => onPick(s)}
          className="flex flex-col gap-1.5 rounded-[14px] border border-line bg-surface-2 p-3.5 text-left transition-colors hover:border-brand-mid hover:bg-brand-soft focus-visible:border-brand disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:border-line disabled:hover:bg-surface-2"
        >
          <span className="flex items-center gap-2">
            <span className="inline-flex h-[22px] w-[22px] flex-none items-center justify-center rounded-md bg-surface-3 text-[10px] font-bold">{s.short}</span>
            <span className="truncate text-xs text-ink-2">{s.clientName}</span>
          </span>
          <span className="font-semibold">{s.title}</span>
          <span className="text-[13px] text-ink-2">{s.meta}</span>
        </button>
      ))}
    </div>
  );
}

export function ChatPanel({
  firstName,
  context,
  contextLoading,
  messages,
  thinking,
  chips,
  usedChips,
  suggestions,
  canEdit,
  cannotReason,
  draft,
  setDraft,
  onSend,
  onChip,
  onRetry,
  onStarter,
  pickClient,
}: {
  firstName: string | null;
  context: PlannerContextData | null;
  contextLoading: boolean;
  messages: ChatMsg[];
  thinking: boolean;
  chips: Refinement[];
  usedChips: Set<string>;
  suggestions: string[];
  canEdit: boolean;
  cannotReason: string;
  draft: string;
  setDraft: (v: string) => void;
  onSend: (text: string) => void;
  onChip: (r: Refinement) => void;
  onRetry: (m: ChatMsg) => void;
  onStarter: (s: PlannerStarter) => void;
  /** Under "All clients": choose who the plan is for (null hides the picker). */
  pickClient: { value: string | null; onChange: (id: string) => void } | null;
}) {
  const scroller = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const [focusOnDraft, setFocusOnDraft] = useState(false);

  useEffect(() => {
    scroller.current?.scrollTo({ top: scroller.current.scrollHeight, behavior: "smooth" });
  }, [messages]);
  useEffect(() => {
    if (focusOnDraft) {
      input.current?.focus();
      setFocusOnDraft(false);
    }
  }, [focusOnDraft]);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!draft.trim() || thinking || !canEdit) return;
    onSend(draft);
    setDraft("");
  };

  const clients = context?.clients ?? [];
  const current = clients.find((c) => c.id === (pickClient?.value ?? context?.client?.id));

  return (
    <section
      aria-label="Chat with Advertix"
      className="flex h-[calc(100vh-210px)] min-h-[520px] min-w-0 flex-[1_1_420px] flex-col overflow-hidden rounded-card border border-line bg-surface shadow-card min-[900px]:sticky min-[900px]:top-[180px]"
    >
      {pickClient && clients.length > 1 && (
        <div className="flex items-center gap-2 whitespace-nowrap border-b border-line px-4 py-2.5 text-[13px] text-ink-2">
          Planning for
          <Menu
            width={260}
            trigger={(p) => (
              <button
                type="button"
                {...p}
                disabled={thinking}
                className={cn("inline-flex h-8 min-w-0 max-w-[60vw] items-center gap-1.5 whitespace-nowrap rounded-ctl border border-line-2 bg-surface px-2.5 font-semibold text-ink hover:bg-surface-2 disabled:opacity-60", p.className)}
              >
                <span className="truncate">{current?.name ?? "Pick a client"}</span>
                <ChevronDown size={14} className="flex-none" aria-hidden="true" />
              </button>
            )}
          >
            {(close) =>
              clients.map((c) => (
                <MenuItem key={c.id} selected={c.id === current?.id} onSelect={() => (close(), pickClient.onChange(c.id))}>
                  {c.name}
                </MenuItem>
              ))
            }
          </Menu>
          {messages.length > 0 && <span className="hidden text-xs text-ink-3 sm:inline">Switching starts a new plan.</span>}
        </div>
      )}

      <div ref={scroller} className="flex flex-1 flex-col gap-4 overflow-auto p-5">
        {messages.length === 0 ? (
          <div className="flex flex-col gap-4">
            <span className="inline-flex h-11 w-11 items-center justify-center rounded-[14px] bg-[image:var(--grad)] text-white" aria-hidden="true">
              <Sparkles size={22} strokeWidth={2.25} />
            </span>
            <div className="flex flex-col gap-1">
              <h2 className="text-[22px] font-semibold tracking-[-0.02em]">What should we plan{firstName ? `, ${firstName}` : ""}?</h2>
              <p className="text-sm text-ink-2">Pick a starting point or write your own brief. Advertix reads each client’s last 30 days before it plans.</p>
            </div>
            {contextLoading && !context ? (
              <div className="grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-2.5">
                <Skeleton className="h-[96px] rounded-[14px]" />
                <Skeleton className="h-[96px] rounded-[14px]" />
              </div>
            ) : context && context.starters.length > 0 ? (
              <Starters
                starters={context.starters}
                disabled={!canEdit}
                onPick={(s) => {
                  onStarter(s);
                  if (!s.send) setFocusOnDraft(true);
                }}
              />
            ) : (
              <p className="rounded-xl bg-surface-2 p-4 text-sm text-ink-2">Connect an ad account and assign it to a client, and Advertix will suggest briefs from its results.</p>
            )}
            {!canEdit && <p className="rounded-xl bg-surface-2 px-4 py-3 text-[13px] text-ink-2">{cannotReason} You can still open saved plans.</p>}
          </div>
        ) : (
          messages.map((m) => <Bubble key={m.id} m={m} onRetry={() => onRetry(m)} />)
        )}
      </div>

      <div className="flex flex-col gap-2.5 border-t border-line px-4 pb-4 pt-3">
        {!thinking && canEdit && (suggestions.length > 0 || chips.length > 0) && (
          <div className="flex flex-wrap gap-2" aria-label={suggestions.length ? "Suggested answers" : "Refine the plan"}>
            {suggestions.length
              ? suggestions.map((s) => (
                  <button key={s} type="button" onClick={() => onSend(s)} className="h-8 rounded-full border border-line-2 bg-surface px-3 text-[13px] font-medium hover:border-brand hover:text-brand-ink">
                    {s}
                  </button>
                ))
              : chips.map((c) => (
                  <button
                    key={c.label}
                    type="button"
                    disabled={usedChips.has(c.label)}
                    onClick={() => onChip(c)}
                    className="h-8 rounded-full border border-line-2 bg-surface px-3 text-[13px] font-medium hover:border-brand hover:text-brand-ink disabled:cursor-default disabled:opacity-45 disabled:hover:border-line-2 disabled:hover:text-ink"
                  >
                    {c.label}
                  </button>
                ))}
          </div>
        )}
        <form onSubmit={submit} className="flex items-center gap-2 rounded-[14px] border border-line-2 bg-surface-2 py-1 pl-3.5 pr-1 focus-within:border-brand focus-within:ring-[3px] focus-within:ring-brand-soft" title={canEdit ? undefined : cannotReason}>
          <input
            ref={input}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder={canEdit ? "Describe the goal, budget and timing" : "Planning needs Media buyer access"}
            aria-label="Message Advertix"
            maxLength={4000}
            disabled={!canEdit}
            className="h-[38px] min-w-0 flex-1 border-0 bg-transparent text-sm outline-none placeholder:text-ink-3 disabled:cursor-not-allowed"
          />
          <button
            type="submit"
            title="Send"
            aria-label="Send"
            disabled={!draft.trim() || thinking || !canEdit}
            className="inline-flex h-[38px] w-[38px] flex-none items-center justify-center rounded-[10px] bg-brand text-white hover:bg-brand-hover disabled:opacity-50 disabled:hover:bg-brand"
          >
            <ArrowRight size={18} strokeWidth={2.25} />
          </button>
        </form>
      </div>
    </section>
  );
}
