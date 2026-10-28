"use client";

import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { Copy, ExternalLink } from "lucide-react";
import { useApi } from "@/hooks/useApi";
import { useApiClient, type ClientShare } from "@/lib/api";
import { timeAgo } from "@/lib/time";
import { Button, Dialog, Segmented, Skeleton, Toggle, useConfirm } from "@/components/app/ui";
import { useClientScope } from "@/components/app/shell/ClientContext";
import { useAccess } from "@/components/app/team/access";

/**
 * Share report (plan C4): one read-only portal link per client. Anyone with
 * the link sees that client's performance without a login, with only the
 * numbers chosen here. A new link stops the old one; turning it off stops it.
 */

type Shows = { showSpend: boolean; showRevenue: boolean; showCampaigns: boolean };
const DEFAULTS: Shows = { showSpend: true, showRevenue: true, showCampaigns: true };
const EXPIRY = [
  { value: 0, label: "Never" },
  { value: 30, label: "30 days" },
  { value: 90, label: "90 days" },
];

function Switches({ value, onChange, disabled }: { value: Shows; onChange: (v: Shows) => void; disabled: boolean }) {
  const rows: { key: keyof Shows; label: string; sub: string }[] = [
    { key: "showSpend", label: "Spend", sub: "Spend, cost per result and this month's budget" },
    { key: "showRevenue", label: "Revenue", sub: "Revenue, and ROAS when spend is shown too" },
    { key: "showCampaigns", label: "Campaign list", sub: "Each campaign's results" },
  ];
  return (
    <div className="flex flex-col divide-y divide-line rounded-ctl border border-line">
      {rows.map((r) => (
        <div key={r.key} className="flex items-center gap-3 px-3.5 py-3">
          <span className="flex min-w-0 flex-1 flex-col">
            <span className="text-sm font-medium">{r.label}</span>
            <span className="text-xs text-ink-2">{r.sub}</span>
          </span>
          <Toggle checked={value[r.key]} onChange={(v) => onChange({ ...value, [r.key]: v })} label={`Show ${r.label.toLowerCase()}`} disabled={disabled} />
        </div>
      ))}
      <p className="m-0 px-3.5 py-2.5 text-xs text-ink-3">Results, clicks and click-through rate are always shown.</p>
    </div>
  );
}

export function ShareDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const api = useApiClient();
  const access = useAccess();
  const canEdit = access.can("edit");
  const scope = useClientScope();
  const [clientId, setClientId] = useState<string | null>(null);
  const [shows, setShows] = useState<Shows>(DEFAULTS);
  const [expiry, setExpiry] = useState(0);
  const [busy, setBusy] = useState(false);
  const { confirm, dialog } = useConfirm();

  // The client in scope, or the only one; with "All clients", pick below.
  useEffect(() => {
    if (open) setClientId(scope.clientId ?? (scope.clients.length === 1 ? scope.clients[0].id : null));
  }, [open, scope.clientId, scope.clients]);
  const q = useApi((c) => (open && clientId ? c.getShare(clientId) : new Promise<never>(() => {})), [open, clientId], { key: "client-share" });
  const share = q.data?.share ?? null;
  useEffect(() => {
    if (share) setShows({ showSpend: share.showSpend, showRevenue: share.showRevenue, showCampaigns: share.showCampaigns });
  }, [share]);
  const name = scope.clients.find((c) => c.id === clientId)?.name ?? "this client";

  const create = async () => {
    if (!clientId) return;
    setBusy(true);
    try {
      const { share: s } = await api.createShare({ clientId, ...shows, expiresInDays: expiry || null });
      await q.refetch();
      void copy(s);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't create the link.");
    } finally {
      setBusy(false);
    }
  };
  const regenerate = async () => {
    if (!(await confirm({ title: "Make a new link?", body: "The current link stops working straight away. Send the new one to anyone who should still see the report.", confirmLabel: "Make a new link" }))) return;
    await create();
  };
  const turnOff = async () => {
    if (!share || !(await confirm({ title: "Turn off this link?", body: `Anyone who opens it will see that the report isn't available. You can make a new link for ${name} later.`, confirmLabel: "Turn off", danger: true }))) return;
    setBusy(true);
    try {
      await api.revokeShare(share.id);
      await q.refetch();
      toast.success("Link turned off");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't turn it off.");
    } finally {
      setBusy(false);
    }
  };
  const save = async (next: Shows) => {
    setShows(next);
    if (!share) return;
    try {
      await api.updateShare(share.id, next);
      await q.refetch();
      toast.success("Updated. The link shows this now.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't update the link.");
    }
  };
  const copy = async (s: ClientShare | null = share) => {
    if (!s) return;
    try {
      await navigator.clipboard.writeText(s.url);
      toast.success("Link copied");
    } catch {
      toast.error("Couldn't copy. Select the link and copy it instead.");
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Share report"
      sub={clientId ? `A read-only link to ${name}'s performance. No login needed.` : "Pick the client to share."}
      width={520}
      footer={
        share ? (
          <>
            {canEdit && (
              <>
                <Button variant="ghost" onClick={() => void turnOff()} disabled={busy}>
                  Turn off link
                </Button>
                <Button variant="secondary" onClick={() => void regenerate()} disabled={busy}>
                  New link
                </Button>
              </>
            )}
            <Button variant="primary" onClick={onClose}>
              Done
            </Button>
          </>
        ) : (
          <>
            <Button variant="secondary" onClick={onClose}>
              Cancel
            </Button>
            <Button variant="primary" loading={busy} disabled={!canEdit || !clientId} onClick={() => void create()} title={!canEdit ? access.why("edit") ?? undefined : undefined}>
              Create link
            </Button>
          </>
        )
      }
    >
      <div className="flex flex-col gap-4">
        {!scope.clientId && scope.clients.length > 1 && (
          <label className="flex flex-col gap-1.5 text-[13px] font-medium text-ink-2">
            Client
            <select
              value={clientId ?? ""}
              onChange={(e) => setClientId(e.target.value || null)}
              className="h-10 rounded-ctl border border-line-2 bg-surface px-3 text-sm text-ink outline-none focus:border-brand focus:ring-[3px] focus:ring-brand-soft"
            >
              <option value="">Choose a client…</option>
              {scope.clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
        )}

        {clientId &&
          (q.loading ? (
            <Skeleton className="h-40" />
          ) : share ? (
            <>
              <div className="flex gap-2">
                <input readOnly value={share.url} aria-label="Report link" onFocus={(e) => e.currentTarget.select()} className="h-10 min-w-0 flex-1 rounded-ctl border border-line-2 bg-surface-2 px-3 text-sm text-ink outline-none" />
                <Button variant="secondary" icon={<Copy size={15} />} onClick={() => void copy()}>
                  Copy
                </Button>
                <a href={share.url} target="_blank" rel="noreferrer" aria-label="Open the report" title="Open the report" className="inline-flex h-10 w-10 flex-none items-center justify-center rounded-ctl border border-line-2 text-ink-2 hover:bg-surface-2 hover:text-ink">
                  <ExternalLink size={16} />
                </a>
              </div>
              <span className="text-xs text-ink-3">
                {share.viewCount ? `Opened ${share.viewCount} time${share.viewCount === 1 ? "" : "s"}, last ${timeAgo(share.lastViewedAt!)}` : "Not opened yet"} · made {timeAgo(share.createdAt)}
                {share.expiresAt ? ` · stops working ${new Date(share.expiresAt).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" })}` : ""}
              </span>
              <Switches value={shows} onChange={(v) => void save(v)} disabled={!canEdit} />
            </>
          ) : (
            <>
              <Switches value={shows} onChange={setShows} disabled={!canEdit} />
              <div className="flex flex-wrap items-center gap-3 text-sm text-ink-2">
                Link stops working after
                <Segmented label="Link expiry" size="sm" value={expiry} onChange={setExpiry} options={EXPIRY} />
              </div>
              {!canEdit && <span className="text-[13px] text-ink-2">{access.why("edit")}</span>}
            </>
          ))}
      </div>
      {dialog}
    </Dialog>
  );
}
