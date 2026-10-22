"use client";

import { useState } from "react";
import { useAppRouter } from "@/hooks/useAppRouter";
import { timeAgo } from "@/lib/time";
import { AiMark, AiSuggestion, Button, Card, Skeleton } from "@/components/app/ui";
import { useClientScope } from "@/components/app/shell/ClientContext";
import { suggestionState, useSuggestions } from "@/components/app/suggestions/useSuggestions";

/**
 * "Advertix suggests" (Overview, plan B2). Executable suggestions get a real
 * Apply → Applied → Undo (the change runs on the ad platform); the rest offer
 * Review. Not now snoozes for 7 days.
 */

const COLLAPSED = 4;

export function OverviewSuggestions() {
  const router = useAppRouter();
  const { clientId, hasMultiple } = useClientScope();
  const sg = useSuggestions({ clientId });
  const [checking, setChecking] = useState(false);
  const [expanded, setExpanded] = useState(false);

  const openCount = sg.list.filter((s) => s.status === "OPEN").length;
  const shown = expanded ? sg.list : sg.list.slice(0, COLLAPSED);

  const runCheck = async () => {
    setChecking(true);
    await sg.refresh();
    setChecking(false);
  };

  return (
    <Card padded={false} className="flex flex-col gap-3 px-5 pb-2 pt-5">
      <div className="flex items-center gap-2.5">
        <AiMark size={32} />
        <span className="flex flex-1 flex-col leading-tight">
          <span className="text-base font-semibold">Advertix suggests</span>
          <span className="text-xs text-ink-2">
            {sg.loading ? "Loading…" : `${openCount} open${sg.lastCheckedAt ? ` · checked ${timeAgo(sg.lastCheckedAt)}` : ""}`}
          </span>
        </span>
      </div>

      {sg.loading ? (
        <div className="flex flex-col gap-3 pb-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
      ) : sg.error ? (
        <div className="mb-3 flex flex-col items-start gap-2 rounded-xl bg-surface-2 p-[18px] text-sm text-ink-2">
          Couldn’t load suggestions.
          <Button variant="ghost" className="px-0 font-semibold text-brand hover:bg-transparent hover:text-brand-hover" onClick={() => void sg.refetch()}>
            Try again
          </Button>
        </div>
      ) : sg.list.length === 0 ? (
        <div className="mb-3 flex flex-col items-start gap-3 rounded-xl bg-surface-2 p-[18px] text-sm text-ink-2">
          Nothing waiting for you right now.
          <Button variant="soft" loading={checking} onClick={runCheck}>
            Check my accounts
          </Button>
        </div>
      ) : (
        <div className="pb-1">
          {shown.map((s) => (
            <AiSuggestion
              key={s.id}
              kind={s.kind}
              client={!clientId && hasMultiple ? s.clientName ?? undefined : undefined}
              title={s.title}
              reason={s.reason}
              impact={s.impact ?? undefined}
              actionLabel={s.actionLabel}
              doneLabel={s.doneLabel ?? undefined}
              mode={s.executable ? "apply" : "review"}
              state={suggestionState(s)}
              busy={sg.busy === s.id}
              onApply={() => void sg.apply(s)}
              onReview={() => router.push(s.reviewHref ?? "/analytics")}
              onSnooze={() => void sg.snooze(s)}
              onUndo={sg.canUndo(s) ? () => void sg.undo(s) : undefined}
            />
          ))}
          {sg.list.length > COLLAPSED && (
            <button
              type="button"
              onClick={() => setExpanded((e) => !e)}
              className="mb-2 mt-1 rounded-lg px-1 text-[13px] font-semibold text-brand hover:text-brand-hover focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-brand-soft"
            >
              {expanded ? "Show fewer" : `Show all ${sg.list.length}`}
            </button>
          )}
        </div>
      )}
    </Card>
  );
}
