"use client";

import { useState } from "react";
import toast from "react-hot-toast";
import { RefreshCw, Sparkles, Undo2 } from "lucide-react";
import { useApi } from "@/hooks/useApi";
import { useApiClient, type Campaign, type ChangeLogEntry } from "@/lib/api";
import { cn } from "@/lib/cn";
import { Button, Card, CardHeader, Skeleton } from "@/components/app/ui";
import { dayLabel } from "./metrics";

const PAGE = 30;

const when = (iso: string) => {
  const d = new Date(iso);
  const time = d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
  return `${dayLabel(iso.slice(0, 10))} ${d.getFullYear()}, ${time}`;
};

const initials = (name: string | null) =>
  (name ?? "?")
    .split(/[\s@]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join("");

function Avatar({ e }: { e: ChangeLogEntry }) {
  const base = "mt-0.5 flex h-8 w-8 flex-none items-center justify-center rounded-full text-xs font-semibold";
  if (e.actorType === "AI") {
    return (
      <span className={cn(base, "bg-[image:var(--grad)] text-white")} aria-hidden="true">
        <Sparkles size={14} />
      </span>
    );
  }
  if (e.actorType === "SYNC") {
    return (
      <span className={cn(base, "bg-surface-3 text-ink-2")} aria-hidden="true">
        <RefreshCw size={14} />
      </span>
    );
  }
  return (
    <span className={cn(base, "bg-surface-3 text-ink-2")} aria-hidden="true">
      {initials(e.actorName)}
    </span>
  );
}

function who(e: ChangeLogEntry) {
  if (e.actorType === "AI") return `Advertix suggestion · applied by ${e.actorName ?? "a teammate"}`;
  if (e.actorType === "SYNC") return "Detected on sync";
  if (e.actorType === "RULE") return "Automation rule";
  return e.actorName ?? "A teammate";
}

/**
 * Change log (guide §5.3, plan B3): every change to this campaign, who made
 * it, whether it reached the platform, and Undo for budget / status / name
 * changes within 7 days.
 */
export function HistoryTab({ campaign: c, onChanged }: { campaign: Campaign; onChanged: () => void }) {
  const api = useApiClient();
  const q = useApi((a) => a.getChangeLog({ campaignId: c.id, limit: PAGE }), [c.id], { key: "change-log" });
  const [older, setOlder] = useState<ChangeLogEntry[]>([]);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

  const entries = [...(q.data?.entries ?? []), ...older];
  const more = (q.data?.entries.length ?? 0) >= PAGE && hasMore;

  const loadOlder = async () => {
    const last = entries[entries.length - 1];
    if (!last) return;
    setLoadingMore(true);
    try {
      const res = await api.getChangeLog({ campaignId: c.id, limit: PAGE, before: last.createdAt });
      setOlder((o) => [...o, ...res.entries]);
      if (res.entries.length < PAGE) setHasMore(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't load older changes.");
    } finally {
      setLoadingMore(false);
    }
  };

  const undo = async (e: ChangeLogEntry) => {
    setBusy(e.id);
    try {
      await api.undoChange(e.id);
      toast.success(e.platformPushed ? "Undone here and on the platform" : "Undone");
      setOlder([]);
      setHasMore(true);
      await q.refetch();
      onChanged();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't undo that change.");
    } finally {
      setBusy(null);
    }
  };

  return (
    <Card className="flex max-w-3xl flex-col gap-3">
      <CardHeader title="Change log" sub="Every change to this campaign. Budget, status and name changes can be undone for 7 days." />
      {q.loading ? (
        <div className="flex flex-col gap-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-12" />
          ))}
        </div>
      ) : q.error ? (
        <div className="flex items-center gap-3 rounded-ctl bg-surface-2 p-3.5 text-sm text-ink-2">
          Couldn’t load the change log.
          <Button variant="ghost" className="font-semibold text-brand" onClick={() => void q.refetch()}>
            Try again
          </Button>
        </div>
      ) : entries.length === 0 ? (
        <p className="rounded-ctl bg-surface-2 p-3.5 text-sm text-ink-2">No changes recorded yet.</p>
      ) : (
        <ol className="flex flex-col">
          {entries.map((e) => (
            <li key={e.id} className={cn("flex gap-3 border-t border-line py-3 first:border-t-0", e.undoneAt && "opacity-60")}>
              <Avatar e={e} />
              <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className={cn("font-medium [text-wrap:pretty]", e.undoneAt && "line-through decoration-ink-3")}>{e.summary}</span>
                <span className="text-xs text-ink-2">
                  {who(e)} · {when(e.createdAt)}
                  {e.actorType !== "SYNC" && ["campaign.budget", "campaign.status", "campaign.rename"].includes(e.action) && (
                    <> · {e.platformPushed ? "on the platform" : "in Advertix only"}</>
                  )}
                </span>
                {e.undoneAt && (
                  <span className="text-xs text-ink-3">
                    Undone{e.undoneByName ? ` by ${e.undoneByName}` : ""} · {when(e.undoneAt)}
                  </span>
                )}
              </span>
              {e.canUndo && (
                <Button
                  variant="ghost"
                  icon={<Undo2 size={14} />}
                  loading={busy === e.id}
                  disabled={!!busy}
                  onClick={() => void undo(e)}
                  className="flex-none self-center font-semibold text-brand hover:bg-brand-soft hover:text-brand"
                >
                  Undo
                </Button>
              )}
            </li>
          ))}
        </ol>
      )}
      {more && !q.loading && (
        <div>
          <Button variant="secondary" size="sm" loading={loadingMore} onClick={() => void loadOlder()}>
            Load older changes
          </Button>
        </div>
      )}
    </Card>
  );
}
