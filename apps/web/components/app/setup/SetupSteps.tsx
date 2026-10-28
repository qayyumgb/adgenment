"use client";

import Link from "next/link";
import { useState } from "react";
import toast from "react-hot-toast";
import { Check } from "lucide-react";
import { useApi } from "@/hooks/useApi";
import { useApiClient, type SetupChecklist, type SetupStepId } from "@/lib/api";
import { cn } from "@/lib/cn";
import { ButtonLink, Card, Skeleton } from "@/components/app/ui";
import { useAccess } from "@/components/app/team/access";
import { useClientScope } from "@/components/app/shell/ClientContext";

/**
 * Getting started (plan C11): the steps for the selected client (or the
 * workspace), each ticking itself off from real data. The next one is open
 * with its button; optional ones can be skipped. On phones only the next
 * step shows its buttons, the other titles are links.
 */

/** The checklist for the client in scope (owners only; null while loading or for others). */
export function useSetupChecklist() {
  const owner = useAccess().can("workspace");
  const { clientId } = useClientScope();
  return useApi((c) => (owner ? c.getSetup(clientId) : new Promise<never>(() => {})), [owner, clientId], { key: "setup" });
}

/** The progress ring ("6/7"). */
export function SetupRing({ complete, total, size = 44 }: { complete: number; total: number; size?: number }) {
  const pct = total ? complete / total : 0;
  return (
    <span className="relative flex-none" style={{ width: size, height: size }} aria-hidden="true">
      <svg viewBox="0 0 36 36" className="-rotate-90" style={{ width: size, height: size }}>
        <circle cx="18" cy="18" r="15.5" fill="none" strokeWidth="3.5" className="stroke-surface-3" />
        <circle cx="18" cy="18" r="15.5" fill="none" strokeWidth="3.5" strokeLinecap="round" className="stroke-brand transition-[stroke-dasharray] duration-500" strokeDasharray={`${pct * 97.4} 97.4`} />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center text-[11px] font-semibold tabular-nums">
        {complete}/{total}
      </span>
    </span>
  );
}

export function SetupSteps({ q }: { q: ReturnType<typeof useSetupChecklist> }) {
  const api = useApiClient();
  const { clientId } = useClientScope();
  const [busy, setBusy] = useState<string | null>(null);
  const s = q.data;

  const act = async (key: string, fn: () => Promise<SetupChecklist>) => {
    setBusy(key);
    try {
      await fn();
      await q.refetch();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "That didn't work. Try again.");
    } finally {
      setBusy(null);
    }
  };

  if (!s) return <Skeleton className="h-[420px] rounded-card" />;
  const next = s.steps.find((x) => !x.done && !x.skipped);

  return (
    <Card padded={false} className="overflow-hidden">
      <ol className="m-0 flex list-none flex-col p-0">
        {s.steps.map((step, i) => {
          const isNext = step.id === next?.id;
          const finished = step.done || step.skipped;
          return (
            <li key={step.id} className={cn("flex flex-wrap items-start gap-x-3 gap-y-2 border-b border-line px-5 py-3.5 last:border-b-0", isNext && "bg-brand-soft/50")}>
              <span
                className={cn(
                  "mt-0.5 flex h-6 w-6 flex-none items-center justify-center rounded-full text-xs font-semibold",
                  step.done ? "bg-pos text-white" : step.skipped ? "bg-surface-3 text-ink-3" : isNext ? "bg-brand text-white" : "border border-line-2 text-ink-3"
                )}
                aria-label={step.done ? "Done" : step.skipped ? "Skipped" : `Step ${i + 1}`}
              >
                {step.done ? <Check size={13} strokeWidth={3} /> : step.skipped ? "–" : i + 1}
              </span>
              <span className="flex min-w-0 flex-[1_1_200px] flex-col gap-0.5">
                <span className={cn("text-sm font-medium", finished && "text-ink-2", step.done && "line-through decoration-ink-3/50")}>
                  {finished ? step.title : <Link href={step.href} className="text-ink no-underline hover:text-brand">{step.title}</Link>}
                  {step.optional && !finished && <span className="ml-1.5 text-xs font-normal text-ink-3">optional</span>}
                </span>
                {(isNext || (!finished && !next)) && <span className="text-[13px] text-ink-2">{step.body}</span>}
                {step.skipped && (
                  <button type="button" disabled={busy !== null} onClick={() => void act(`skip-${step.id}`, () => api.skipSetupStep(step.id as SetupStepId, false, clientId))} className="self-start text-xs font-medium text-brand hover:text-brand-hover">
                    Undo skip
                  </button>
                )}
              </span>
              {!finished && (
                // Phones: only the next step shows its buttons, under the text; the other titles are links.
                <span className={cn("ml-9 flex-none basis-full items-center gap-2 min-[560px]:ml-0 min-[560px]:flex min-[560px]:basis-auto", isNext ? "flex" : "hidden")}>
                  {step.optional && (
                    <button type="button" disabled={busy !== null} onClick={() => void act(`skip-${step.id}`, () => api.skipSetupStep(step.id as SetupStepId, true, clientId))} className="text-[13px] font-medium text-ink-2 hover:text-ink">
                      Skip
                    </button>
                  )}
                  <ButtonLink href={step.href} variant={isNext ? "primary" : "secondary"} size="sm">
                    {step.cta}
                  </ButtonLink>
                </span>
              )}
            </li>
          );
        })}
      </ol>
      <p className="m-0 border-t border-line px-5 py-2.5 text-xs text-ink-3">
        Steps tick off on their own as you go{s.client ? `, for ${s.client.name}` : ""}. Questions?{" "}
        <Link href="mailto:support@advertix.io" className="text-brand no-underline hover:text-brand-hover">
          support@advertix.io
        </Link>
      </p>
    </Card>
  );
}
