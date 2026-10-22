"use client";

import { useState } from "react";
import toast from "react-hot-toast";
import { Check, RefreshCw, RotateCcw, X } from "lucide-react";
import { useApi } from "@/hooks/useApi";
import { useApiClient, type Insight } from "@/lib/api";
import { cn } from "@/lib/cn";
import { timeAgo } from "@/lib/time";
import { AiMark, Button, Card, Skeleton } from "@/components/app/ui";

const KIND: Record<Insight["type"], { label: string; tone: string }> = {
  OPPORTUNITY: { label: "Opportunity", tone: "bg-pos-soft text-pos" },
  OPTIMIZATION: { label: "Optimization", tone: "bg-brand-soft text-brand-ink" },
  WARNING: { label: "Warning", tone: "bg-warn-soft text-warn" },
  ALERT: { label: "Alert", tone: "bg-neg-soft text-neg" },
};
const COLLAPSED = 3;

/**
 * "Advertix read" (Analytics absorbs the old Insights page, plan A10):
 * observations from the last 30 days with Check again (1-hour gate), Mark
 * done, Dismiss, and the dismissed list with Restore. Insights don't change
 * anything themselves — executable changes live in Advertix suggests.
 */
export function AdvertixRead() {
  const api = useApiClient();
  const q = useApi((c) => c.getInsights(), [], { key: "insights" });
  const [showDismissed, setShowDismissed] = useState(false);
  const dismissed = useApi((c) => (showDismissed ? c.getDismissedInsights() : Promise.resolve({ insights: [] as Insight[] })), [showDismissed], {
    key: "insights-dismissed",
  });
  const [busy, setBusy] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);
  const [expanded, setExpanded] = useState(false);

  const list = q.data?.insights ?? [];
  const shown = expanded ? list : list.slice(0, COLLAPSED);

  const act = async (id: string, run: () => Promise<unknown>, done: string) => {
    setBusy(id);
    try {
      await run();
      toast.success(done);
      await q.refetch();
      if (showDismissed) await dismissed.refetch();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "That didn't work. Try again.");
    } finally {
      setBusy(null);
    }
  };

  const check = async () => {
    setChecking(true);
    try {
      const res = await api.generateInsights();
      if (res.generated === false) toast("Advertix checked within the last hour. Try again later.");
      await q.refetch();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "The check didn’t finish. Try again.");
    } finally {
      setChecking(false);
    }
  };

  return (
    <Card className="flex flex-col gap-3 px-5 py-5">
      <div className="flex flex-wrap items-center gap-2.5">
        <AiMark size={32} />
        <span className="flex min-w-[180px] flex-1 flex-col leading-tight">
          <span className="text-base font-semibold">Advertix read</span>
          <span className="text-xs text-ink-2">
            {q.loading ? "Loading…" : `${list.length} observation${list.length === 1 ? "" : "s"}${q.data?.lastGeneratedAt ? ` · checked ${timeAgo(q.data.lastGeneratedAt)}` : ""}`}
          </span>
        </span>
        <span className="ml-auto flex flex-none items-center gap-1.5">
          <Button variant="ghost" size="sm" onClick={() => setShowDismissed((s) => !s)}>
            {showDismissed ? "Hide dismissed" : "Dismissed"}
          </Button>
          <Button variant="secondary" size="sm" icon={<RefreshCw size={14} />} loading={checking} onClick={() => void check()}>
            Check again
          </Button>
        </span>
      </div>

      {q.loading ? (
        <Skeleton className="h-20" />
      ) : list.length === 0 ? (
        <p className="rounded-ctl bg-surface-2 p-3.5 text-sm text-ink-2">No observations right now. Use Check again after your accounts sync.</p>
      ) : (
        <ul className="grid gap-3 min-[900px]:grid-cols-3">
          {shown.map((i) => (
            <li key={i.id} className="flex flex-col gap-1.5 rounded-menu border border-line p-4">
              <span className={cn("self-start rounded-full px-2 py-px text-xs font-semibold", KIND[i.type].tone)}>{KIND[i.type].label}</span>
              <span className="font-semibold leading-snug [text-wrap:pretty]">{i.title}</span>
              <span className="text-[13px] text-ink-2 [text-wrap:pretty]">{i.message}</span>
              {i.impact && <span className="text-[13px] font-semibold text-pos">{i.impact}</span>}
              <span className="mt-auto flex gap-1.5 pt-1.5">
                <Button variant="soft" icon={<Check size={14} />} loading={busy === i.id} onClick={() => void act(i.id, () => api.applyInsight(i.id), "Marked as done")}>
                  Mark done
                </Button>
                <Button variant="ghost" icon={<X size={14} />} disabled={busy === i.id} onClick={() => void act(i.id, () => api.dismissInsight(i.id), "Dismissed")}>
                  Dismiss
                </Button>
              </span>
            </li>
          ))}
        </ul>
      )}
      {list.length > COLLAPSED && (
        <button type="button" onClick={() => setExpanded((e) => !e)} className="self-start rounded px-1 text-[13px] font-semibold text-brand hover:text-brand-hover focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-brand-soft">
          {expanded ? "Show fewer" : `Show all ${list.length}`}
        </button>
      )}

      {showDismissed && (
        <div className="flex flex-col gap-2 border-t border-line pt-3">
          <span className="text-xs font-semibold uppercase tracking-[.06em] text-ink-3">Dismissed</span>
          {dismissed.loading ? (
            <Skeleton className="h-10" />
          ) : (dismissed.data?.insights ?? []).length === 0 ? (
            <p className="text-sm text-ink-2">Nothing dismissed.</p>
          ) : (
            (dismissed.data?.insights ?? []).map((i) => (
              <div key={i.id} className="flex items-center gap-3 text-sm">
                <span className="min-w-0 flex-1 truncate text-ink-2">{i.title}</span>
                <Button variant="ghost" size="sm" icon={<RotateCcw size={14} />} loading={busy === i.id} onClick={() => void act(i.id, () => api.restoreInsight(i.id), "Restored")}>
                  Restore
                </Button>
              </div>
            ))
          )}
        </div>
      )}
    </Card>
  );
}
