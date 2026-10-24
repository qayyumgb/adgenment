"use client";

import { useEffect, useState } from "react";
import { useApiClient, type ChangeLogEntry } from "@/lib/api";
import { timeAgo } from "@/lib/time";
import { Button, Drawer, Pill, Skeleton } from "@/components/app/ui";
import { useClientScope } from "@/components/app/shell/ClientContext";

/**
 * Audit log (plan A14; open question 7): every change made in the workspace,
 * newest first, from the change log (B3). Undo lives on each campaign's
 * History tab, where the context is.
 */

const ACTOR: Record<ChangeLogEntry["actorType"], string> = { USER: "Person", AI: "Applied suggestion", RULE: "Automation", SYNC: "Outside Advertix" };

export function AuditLogDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const api = useApiClient();
  const { clientId, client } = useClientScope();
  const [entries, setEntries] = useState<ChangeLogEntry[] | null>(null);
  const [more, setMore] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = async (before?: string) => {
    setBusy(true);
    try {
      const r = await api.getChangeLog({ clientId, limit: 50, before });
      setEntries((e) => (before && e ? [...e, ...r.entries] : r.entries));
      setMore(r.entries.length === 50);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't load the audit log.");
    } finally {
      setBusy(false);
    }
  };
  useEffect(() => {
    if (open) void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, clientId]);

  return (
    <Drawer open={open} onClose={onClose} title="Audit log" sub={`${client ? client.name : "Whole workspace"} · newest first`} width={520}>
      {error ? (
        <p className="rounded-xl bg-neg-soft px-3.5 py-3 text-[13px] text-neg">{error}</p>
      ) : !entries ? (
        <div className="flex flex-col gap-2">
          <Skeleton className="h-14" />
          <Skeleton className="h-14" />
          <Skeleton className="h-14" />
        </div>
      ) : entries.length === 0 ? (
        <p className="rounded-xl bg-surface-2 p-4 text-sm text-ink-2">No changes recorded yet. Changes to campaigns, budgets and statuses appear here, with who made them.</p>
      ) : (
        <div className="flex flex-col">
          <ul className="flex flex-col divide-y divide-line">
            {entries.map((e) => (
              <li key={e.id} className="flex flex-col gap-1 py-3 text-[13px]">
                <span className="flex flex-wrap items-center gap-2">
                  <span className="font-semibold">{e.campaignName}</span>
                  {e.platformPushed && <Pill tone="brand">On the platform</Pill>}
                  {e.undoneAt && <Pill tone="neutral">Undone</Pill>}
                </span>
                <span className="text-ink">{e.summary}</span>
                <span className="text-xs text-ink-3">
                  {e.actorName ?? ACTOR[e.actorType]}
                  {e.actorType === "AI" ? " · applied suggestion" : e.actorType === "SYNC" ? " · seen on sync" : ""} · {timeAgo(e.createdAt)}
                  {e.undoneByName ? ` · undone by ${e.undoneByName}` : ""}
                </span>
              </li>
            ))}
          </ul>
          {more && (
            <Button variant="secondary" size="sm" className="mt-3 self-center" loading={busy} onClick={() => void load(entries[entries.length - 1].createdAt)}>
              Show older
            </Button>
          )}
        </div>
      )}
    </Drawer>
  );
}
