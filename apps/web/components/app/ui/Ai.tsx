"use client";

import type { ReactNode } from "react";
import { Check, Sparkles } from "lucide-react";
import { cn } from "@/lib/cn";
import { Button } from "./Button";

/** Gradient sparkle tile — the sparkle always means "Advertix AI" (guide §2.4). */
export function AiMark({ size = 32, className }: { size?: 24 | 30 | 32 | 36; className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn("inline-flex flex-none items-center justify-center bg-[image:var(--grad)] text-white", className)}
      style={{ width: size, height: size, borderRadius: size >= 30 ? 10 : 8 }}
    >
      <Sparkles size={Math.round(size / 2)} strokeWidth={2.25} />
    </span>
  );
}

/** AI note (guide §4): brand-soft box, sparkle + "Advertix read" heading. */
export function AiNote({ title = "Advertix read", children, className }: { title?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <div className={cn("rounded-xl bg-brand-soft px-4 py-3 text-sm text-ink", className)}>
      <div className="mb-1 flex items-center gap-1.5 text-[13px] font-semibold text-brand-ink">
        <Sparkles size={14} strokeWidth={2.25} aria-hidden="true" />
        {title}
      </div>
      <div className="text-ink-2 [text-wrap:pretty]">{children}</div>
    </div>
  );
}

export type SuggestionKind = "Budget shift" | "Creative fatigue" | "Targeting" | "Pacing" | string;
export type SuggestionState = "open" | "applied" | "snoozed";

const KIND_TONE: Record<string, string> = {
  "Budget shift": "bg-brand-soft text-brand-ink",
  Targeting: "bg-brand-soft text-brand-ink",
  "Creative fatigue": "bg-warn-soft text-warn",
  Pacing: "bg-neg-soft text-neg",
  // Insight types until B2 replaces Insights with Suggestions.
  Opportunity: "bg-pos-soft text-pos",
  Optimization: "bg-brand-soft text-brand-ink",
  Warning: "bg-warn-soft text-warn",
  Alert: "bg-neg-soft text-neg",
};

/**
 * AI suggestion (guide §4, §6). Flow: Apply → Applied (past-tense label) +
 * Undo; Not now → "Snoozed 7 days" faded to 55% + Undo.
 *
 * Per the plan (decision #4), Apply is only offered when the action really
 * executes and can be undone. Otherwise pass `mode="review"`: the button
 * opens the related item instead (`onReview`) and there is no Applied state.
 */
export function AiSuggestion({
  kind,
  client,
  title,
  reason,
  impact,
  actionLabel,
  doneLabel,
  snoozedLabel = "Snoozed 7 days",
  state = "open",
  mode = "apply",
  busy = false,
  onApply,
  onReview,
  onSnooze,
  onUndo,
  className,
}: {
  kind: SuggestionKind;
  client?: string;
  title: ReactNode;
  /** One line with the real numbers behind it. */
  reason: ReactNode;
  /** Right-aligned impact in pos, e.g. "+$3,100 / week". */
  impact?: ReactNode;
  /** Action verb, e.g. "Shift budget". */
  actionLabel: string;
  /** Past tense, e.g. "Budget shifted". */
  doneLabel?: string;
  /** Label for the snoozed state (e.g. "Dismissed" for Insights, which have no 7-day snooze). */
  snoozedLabel?: string;
  state?: SuggestionState;
  mode?: "apply" | "review";
  busy?: boolean;
  onApply?: () => void;
  onReview?: () => void;
  onSnooze?: () => void;
  onUndo?: () => void;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col gap-1.5 border-t border-line py-3.5 transition-opacity", state === "snoozed" && "opacity-55", className)}>
      <div className="flex items-center gap-2 text-xs">
        <span className={cn("rounded-full px-2 py-px font-semibold", KIND_TONE[kind] ?? "bg-brand-soft text-brand-ink")}>{kind}</span>
        {client && <span className="text-ink-2">{client}</span>}
      </div>
      <div className="font-semibold leading-snug [text-wrap:pretty]">{title}</div>
      <div className="text-[13px] text-ink-2 [text-wrap:pretty]">{reason}</div>
      <div className="mt-1.5 flex items-center gap-1.5" aria-live="polite">
        {state === "open" ? (
          <>
            {mode === "apply" ? (
              <Button variant="soft" onClick={onApply} loading={busy}>
                {actionLabel}
              </Button>
            ) : (
              <Button variant="soft" onClick={onReview}>
                Review
              </Button>
            )}
            {onSnooze && (
              <Button variant="ghost" onClick={onSnooze} disabled={busy}>
                Not now
              </Button>
            )}
            <span className="flex-1" />
            {impact && <span className="text-right text-[13px] font-semibold tabular-nums text-pos">{impact}</span>}
          </>
        ) : (
          <>
            <span
              className={cn(
                "inline-flex h-7 items-center gap-1.5 rounded-full px-2.5 text-[13px] font-semibold",
                state === "applied" ? "bg-pos-soft text-pos" : "bg-surface-3 text-ink-2"
              )}
            >
              {state === "applied" && <Check size={14} strokeWidth={2.5} aria-hidden="true" />}
              {state === "applied" ? doneLabel ?? "Applied" : snoozedLabel}
            </span>
            {onUndo && (
              <button
                type="button"
                onClick={onUndo}
                disabled={busy}
                className="h-7 rounded-lg px-2 text-[13px] font-semibold text-brand hover:bg-brand-soft focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-brand-soft disabled:opacity-50"
              >
                Undo
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}
