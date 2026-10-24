"use client";

import { useEffect, useRef, useState } from "react";
import toast from "react-hot-toast";
import { Check } from "lucide-react";
import { useApi } from "@/hooks/useApi";
import { useApiClient, type PendingConnectionData, type Platform } from "@/lib/api";
import { cn } from "@/lib/cn";
import { Button, Checkbox, Dialog, PlatformBadge, type PlatformKey } from "@/components/app/ui";
import { useClientScope } from "@/components/app/shell/ClientContext";
import { useAccess } from "@/components/app/team/access";
import { CONNECTABLE, NEEDS_ATTENTION, PLATFORM_NAME, useConnectPlatform, useRefreshAccounts } from "./useConnectPlatform";

/**
 * D1 Connect ad account (guide D1, plan A13): pick a platform (OAuth popup),
 * then pick which of the accounts it found to add, each with a client, then
 * done. Accounts already in Advertix just get the new token ("Reconnect").
 * Opened from Connections, the sidebar ad-accounts box and empty states.
 */

type Step = { kind: "pick" } | { kind: "choose"; pending: PendingConnectionData; renewed: number } | { kind: "done"; platform: Platform; added: number; renewed: number; addedActive: number };
type Row = { checked: boolean; clientId: string | null; touched?: boolean };

export function ConnectDialog({
  open,
  onClose,
  start,
}: {
  open: boolean;
  onClose: () => void;
  /** Open on a platform's connect (Renew) or on accounts already found (`?pending=` after a redirect). */
  start?: { platform?: Platform; pending?: string; renewed?: number } | null;
}) {
  const api = useApiClient();
  const access = useAccess();
  const { clientId: scopeId, clients, hasMultiple } = useClientScope();
  // Only while open: the dialog is also mounted (closed) in the sidebar and empty states.
  const conns = useApi((c) => (open ? c.getConnections() : Promise.resolve(null)), [open], { key: "connections" });
  const { connect, busy } = useConnectPlatform();
  const refresh = useRefreshAccounts();
  const [step, setStep] = useState<Step>({ kind: "pick" });
  const [rows, setRows] = useState<Record<string, Row>>({});
  const [saving, setSaving] = useState(false);
  const started = useRef<string | null>(null);
  const canConnect = access.can("connect");

  const defaultClient = scopeId ?? (clients.length === 1 ? clients[0].id : access.clientIds?.[0] ?? null);

  const showPending = async (id: string, renewed: number) => {
    try {
      const pending = await api.getPendingConnection(id);
      setRows(Object.fromEntries(pending.accounts.map((a) => [a.accountId, { checked: a.isActive, clientId: defaultClient }])));
      setStep({ kind: "choose", pending, renewed });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Those accounts aren't available any more. Connect again.");
      setStep({ kind: "pick" });
    }
  };

  const run = async (platform: Platform) => {
    const r = await connect(platform);
    if (!r.ok) {
      if (r.message) (r.tone === "error" ? toast.error : toast)(r.message);
      return;
    }
    void refresh();
    if (r.pending) await showPending(r.pending, r.renewed);
    else setStep({ kind: "done", platform, added: 0, renewed: r.renewed, addedActive: 0 });
  };

  // Suggest a client when an account is named after one ("Lumen Skincare · EU"). Runs again when the
  // client list arrives; never overrides a choice the user made.
  const pendingId = step.kind === "choose" ? step.pending.id : null;
  useEffect(() => {
    if (step.kind !== "choose" || !clients.length) return;
    const named = (name: string) => clients.find((c) => name.toLowerCase().startsWith(c.name.toLowerCase().split(/\s+/)[0]))?.id ?? null;
    setRows((rs) => Object.fromEntries(Object.entries(rs).map(([id, r]) => [id, r.touched || r.clientId ? r : { ...r, clientId: named(step.pending.accounts.find((a) => a.accountId === id)?.accountName ?? "") }])));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingId, clients]);

  // Open straight into a flow (Renew from a row or banner, or ?pending= after a redirect).
  useEffect(() => {
    if (!open) {
      started.current = null;
      return;
    }
    const key = start ? `${start.platform ?? ""}:${start.pending ?? ""}` : "";
    if (!start || started.current === key) return;
    started.current = key;
    if (start.pending) void showPending(start.pending, start.renewed ?? 0);
    else if (start.platform) void run(start.platform);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, start]);

  const close = () => {
    if (step.kind === "choose") void api.discardPendingConnection(step.pending.id).catch(() => undefined);
    setStep({ kind: "pick" });
    onClose();
  };

  const accept = async () => {
    if (step.kind !== "choose") return;
    const picks = Object.entries(rows)
      .filter(([, r]) => r.checked)
      .map(([accountId, r]) => ({ accountId, clientId: r.clientId }));
    setSaving(true);
    try {
      const res = await api.acceptPendingConnection(step.pending.id, picks);
      void refresh();
      setStep({ kind: "done", platform: step.pending.platform, added: res.added.length, renewed: step.renewed, addedActive: res.added.filter((a) => a.isActive).length });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "The accounts weren't added. Try again.");
    } finally {
      setSaving(false);
    }
  };

  const accounts = conns.data?.accounts ?? [];
  const selected = step.kind === "choose" ? Object.values(rows).filter((r) => r.checked).length : 0;
  const plural = (n: number) => `${n} account${n === 1 ? "" : "s"}`;

  const title = step.kind === "pick" ? "Connect an ad account" : step.kind === "choose" ? `Choose ${PLATFORM_NAME[step.pending.platform]} accounts` : step.added ? "Connected" : "Access renewed";
  const sub =
    step.kind === "pick"
      ? "Advertix only asks for read and manage permissions. You can disconnect any time."
      : step.kind === "choose"
        ? `We found ${plural(step.pending.accounts.length)} you can access${hasMultiple ? ". Assign each to a client." : "."}${step.renewed ? ` ${plural(step.renewed)} already in Advertix got the new access.` : ""}`
        : step.added
          ? `${PLATFORM_NAME[step.platform]} is syncing`
          : `${PLATFORM_NAME[step.platform]} is up to date`;

  return (
    <Dialog
      open={open}
      onClose={close}
      title={title}
      sub={sub}
      width={640}
      footer={
        step.kind === "pick" ? (
          <Button variant="secondary" onClick={close}>
            Cancel
          </Button>
        ) : step.kind === "choose" ? (
          <>
            <Button
              variant="secondary"
              onClick={() => {
                void api.discardPendingConnection(step.pending.id).catch(() => undefined);
                setStep({ kind: "pick" });
              }}
              disabled={saving}
            >
              Back
            </Button>
            <Button variant="primary" loading={saving} disabled={selected === 0} onClick={() => void accept()}>
              Connect {plural(selected)}
            </Button>
          </>
        ) : (
          <Button variant="secondary" onClick={close}>
            Done
          </Button>
        )
      }
    >
      {step.kind === "pick" && (
        <div className="flex flex-col gap-2">
          {[...CONNECTABLE, "SNAPCHAT" as Platform].map((p) => {
            const mine = accounts.filter((a) => a.platform === p && a.status !== "ARCHIVED");
            const expiring = mine.find((a) => a.status === "TOKEN_EXPIRING" || a.status === "TOKEN_EXPIRED");
            const available = CONNECTABLE.includes(p);
            const line = !available ? "Coming soon" : expiring ? (expiring.statusDetail ?? "Access expired") : mine.length ? `${plural(mine.length)} connected` : "Not connected";
            return (
              <div key={p} className={cn("flex items-center gap-3 rounded-xl border border-line px-3.5 py-3", !available && "opacity-60")}>
                <PlatformBadge platform={p as PlatformKey} size={34} />
                <span className="flex min-w-0 flex-1 flex-col leading-tight">
                  <span className="font-semibold">{PLATFORM_NAME[p]}</span>
                  <span className={cn("text-xs", expiring ? "text-warn" : "text-ink-2")}>{line}</span>
                </span>
                {available && (
                  <span title={canConnect ? undefined : access.why("connect")}>
                    <Button variant="soft" size="sm" loading={busy === p} disabled={!canConnect || (busy !== null && busy !== p)} onClick={() => void run(p)}>
                      {busy === p ? "Waiting for sign-in…" : expiring ? "Reconnect" : mine.length ? "Add account" : "Connect"}
                    </Button>
                  </span>
                )}
              </div>
            );
          })}
          {accounts.some((a) => NEEDS_ATTENTION.includes(a.status)) && <p className="pt-1 text-xs text-ink-3">Reconnecting signs in again and refreshes access for every account on that platform.</p>}
        </div>
      )}

      {step.kind === "choose" && (
        <div className="flex flex-col gap-2">
          {step.pending.accounts.map((a) => {
            const r = rows[a.accountId] ?? { checked: false, clientId: null };
            return (
              <div key={a.accountId} className={cn("grid items-center gap-3 rounded-xl px-3.5 py-3", hasMultiple ? "grid-cols-[22px_minmax(0,1fr)] sm:grid-cols-[22px_minmax(0,1fr)_190px]" : "grid-cols-[22px_minmax(0,1fr)]", r.checked ? "border-[1.5px] border-brand bg-brand-soft" : "border border-line bg-surface")}>
                <Checkbox checked={r.checked} hideLabel label={`Add ${a.accountName}`} onChange={(v) => setRows((x) => ({ ...x, [a.accountId]: { ...r, checked: v } }))} />
                <span className="flex min-w-0 flex-col leading-tight">
                  <span className="truncate font-semibold">{a.accountName}</span>
                  <span className="font-mono text-xs text-ink-3">
                    {a.accountId}
                    {a.currency ? ` · ${a.currency}` : ""}
                    {!a.isActive && <span className="font-sans text-warn"> · Disabled on {PLATFORM_NAME[step.pending.platform]}</span>}
                  </span>
                </span>
                {hasMultiple && (
                  <select
                    aria-label={`Client for ${a.accountName}`}
                    value={r.clientId ?? ""}
                    onChange={(e) => setRows((x) => ({ ...x, [a.accountId]: { ...r, clientId: e.target.value || null, touched: true } }))}
                    className="col-span-2 h-[34px] min-w-0 rounded-[9px] border border-line-2 bg-surface px-2.5 text-[13px] text-ink sm:col-span-1"
                  >
                    {!access.limited && <option value="">Not assigned</option>}
                    {clients.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                )}
              </div>
            );
          })}
        </div>
      )}

      {step.kind === "done" && (
        <div className="flex flex-col gap-2.5 rounded-[14px] bg-pos-soft p-4">
          <span className="flex items-center gap-1.5 font-semibold text-pos">
            <Check size={16} strokeWidth={3} aria-hidden="true" />
            {step.added ? `${plural(step.added)} connected` : step.renewed ? `Access renewed for ${plural(step.renewed)}` : "Nothing new to add"}
          </span>
          <span className="text-[13px] text-ink-2">
            {step.added
              ? step.addedActive
                ? "First sync is running. Spend and results appear when it finishes, usually within a few minutes."
                : "These accounts are disabled on the platform, so there's nothing to sync yet."
              : step.renewed
                ? "Every account already in Advertix on this platform has the new access. No new accounts were found."
                : `${PLATFORM_NAME[step.platform]} didn't share any ad accounts with Advertix.`}
          </span>
        </div>
      )}
    </Dialog>
  );
}
