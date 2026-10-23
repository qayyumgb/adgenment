"use client";

import { useRef, useState } from "react";
import toast from "react-hot-toast";
import { RefreshCw } from "lucide-react";
import { useApi } from "@/hooks/useApi";
import { useAppRouter } from "@/hooks/useAppRouter";
import { useApiClient } from "@/lib/api";
import { fmtMoney } from "@/lib/money";
import { timeAgo } from "@/lib/time";
import { PageBody, PageHeader } from "@/components/app/shell/PageHeader";
import { useClientScope } from "@/components/app/shell/ClientContext";
import { AiMark, AiSuggestion, Button, Card, Skeleton } from "@/components/app/ui";
import { useAccess } from "@/components/app/team/access";
import { suggestionState, useSuggestions } from "@/components/app/suggestions/useSuggestions";
import { Allocator, type AllocatorHandle } from "@/components/app/budgets/Allocator";
import { PacingGrid } from "@/components/app/budgets/Pacing";

/**
 * Budgets (guide §5.6, plan A11): the cross-platform allocator (response
 * curves from real daily results; applying sends live Meta changes with
 * Undo), monthly pacing per client, and Advertix's per-campaign budget review
 * (the old Budget optimizer's analysis; Apply runs through the suggestion
 * executors, so it really changes Meta and can be undone).
 */
export default function BudgetsPage() {
  const api = useApiClient();
  const router = useAppRouter();
  const access = useAccess();
  const { clientId, client, hasMultiple } = useClientScope();
  const pacing = useApi((c) => c.getPacing({ clientId }), [clientId], { key: "pacing" });
  const sg = useSuggestions({ clientId });
  const allocator = useRef<AllocatorHandle>(null);
  const allocBox = useRef<HTMLDivElement>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  const p = pacing.data;
  const scopeName = client?.name ?? (hasMultiple ? "All clients" : "Workspace");
  const monthName = p ? new Date(`${p.month}-01T00:00:00Z`).toLocaleDateString("en-GB", { month: "long", year: "numeric", timeZone: "UTC" }) : "";
  const currencies = new Set((p?.clients ?? []).map((c) => c.currency));
  const oneCurrency = currencies.size <= 1 ? [...currencies][0] ?? null : undefined;
  const planned = (p?.clients ?? []).reduce((a, c) => a + (c.monthlyBudget ?? 0), 0);
  const spent = (p?.clients ?? []).reduce((a, c) => a + c.spent, 0);
  const summary = !p
    ? "Loading…"
    : oneCurrency !== undefined
      ? `${planned ? `${fmtMoney(planned, oneCurrency, { whole: true })} planned for ${monthName.split(" ")[0]} · ` : ""}${fmtMoney(spent, oneCurrency, { whole: true })} spent · day ${p.dayOfMonth} of ${p.daysInMonth}`
      : `Day ${p.dayOfMonth} of ${p.daysInMonth} · clients spend in different currencies`;

  const budgetSuggestions = sg.list.filter((s) => s.kind === "Budget shift");
  const canEdit = access.can("edit");

  const analyze = async () => {
    setAnalyzing(true);
    setNote(null);
    try {
      const r = await api.analyzeBudget();
      if (r.insufficientData) setNote(r.summary);
      else toast.success("Budget review updated");
      await sg.refetch();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "The review didn't run. Try again.");
    } finally {
      setAnalyzing(false);
    }
  };

  const plan = (id: string, fit: boolean) => {
    allocator.current?.focusClient(id, fit);
    allocBox.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <>
      <PageHeader kicker={`${scopeName} · ${monthName || "budgets"}`} title="Budgets" summary={summary} />
      <PageBody className="gap-5">
        <div ref={allocBox} className="scroll-mt-[150px]">
          <Allocator ref={allocator} scopeClientId={clientId} />
        </div>

        <PacingGrid data={p ?? null} loading={pacing.loading} onPlan={plan} onChanged={() => void pacing.refetch()} />

        <Card padded={false} className="flex flex-col gap-2.5 px-5 pb-2 pt-5">
          <div className="flex flex-wrap items-center gap-2.5">
            <AiMark size={32} />
            <span className="flex min-w-0 flex-[1_1_240px] flex-col leading-tight">
              <span className="text-base font-semibold">Per-campaign budget review</span>
              <span className="text-xs text-ink-2">
                Compares each campaign’s last 14 days with the 14 before.{sg.lastCheckedAt ? ` Checked ${timeAgo(sg.lastCheckedAt)}.` : ""} The same suggestions appear in the Campaigns grid.
              </span>
            </span>
            <span title={canEdit ? undefined : access.why("edit")}>
              <Button variant="secondary" size="sm" icon={<RefreshCw size={14} className={analyzing ? "animate-spin motion-reduce:animate-none" : undefined} />} onClick={() => void analyze()} disabled={analyzing || !canEdit}>
                {analyzing ? "Reviewing…" : "Review budgets"}
              </Button>
            </span>
          </div>
          {note && <div className="rounded-xl bg-warn-soft px-4 py-3 text-sm text-warn">{note}</div>}
          {sg.loading ? (
            <Skeleton className="mb-3 h-24" />
          ) : budgetSuggestions.length === 0 ? (
            <div className="mb-3 rounded-xl bg-surface-2 p-4 text-sm text-ink-2">No budget changes suggested right now. Run a review after campaigns have a couple of weeks of results.</div>
          ) : (
            <div className="pb-1">
              {budgetSuggestions.map((s) => (
                <AiSuggestion
                  key={s.id}
                  kind={s.kind}
                  client={!clientId && hasMultiple ? s.clientName ?? undefined : undefined}
                  title={s.title}
                  reason={s.reason}
                  impact={s.impact ?? undefined}
                  actionLabel={s.actionLabel}
                  doneLabel={s.doneLabel ?? undefined}
                  mode={s.executable && canEdit ? "apply" : "review"}
                  state={suggestionState(s)}
                  busy={sg.busy === s.id}
                  onApply={() => void sg.apply(s)}
                  onReview={() => router.push(s.reviewHref ?? (s.campaignId ? `/campaigns/${s.campaignId}?tab=settings` : "/campaigns"))}
                  onSnooze={() => void sg.snooze(s)}
                  onUndo={sg.canUndo(s) ? () => void sg.undo(s) : undefined}
                />
              ))}
            </div>
          )}
        </Card>
      </PageBody>
    </>
  );
}
