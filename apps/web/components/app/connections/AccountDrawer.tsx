"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import toast from "react-hot-toast";
import { ExternalLink, RefreshCw } from "lucide-react";
import { useApiClient, type ConnectionAccount, type MetaHealthReport, type Platform } from "@/lib/api";
import { cn } from "@/lib/cn";
import { fmtMoney } from "@/lib/money";
import { timeAgo } from "@/lib/time";
import { Button, Drawer, Pill, Skeleton } from "@/components/app/ui";
import { PLATFORM_NAME, STATUS_LABEL, STATUS_TONE } from "./useConnectPlatform";

/**
 * Account drawer (plan A13): details, client, the full Meta health report
 * (with what to do for each problem), sync, renew access, archive / restore
 * and disconnect (with exactly what it removes).
 */

function HealthReport({ accountId, focusPixel }: { accountId: string; focusPixel: boolean }) {
  const api = useApiClient();
  const [report, setReport] = useState<MetaHealthReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    let live = true;
    setReport(null);
    setError(null);
    api
      .getMetaHealth(accountId)
      .then((r) => live && setReport(r))
      .catch((e) => live && setError(e instanceof Error ? e.message : "Couldn't check this account."));
    return () => {
      live = false;
    };
  }, [api, accountId]);
  const refresh = async () => {
    setBusy(true);
    try {
      setReport(await api.refreshMetaHealth(accountId));
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't check this account.");
    } finally {
      setBusy(false);
    }
  };
  const problems = (report?.checks ?? []).filter((c) => c.status !== "ok").sort((a, b) => Number(focusPixel && /PIXEL/.test(b.code)) - Number(focusPixel && /PIXEL/.test(a.code)));
  return (
    <section className="flex flex-col gap-2.5" aria-label="Meta health">
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-semibold">Meta health</span>
        <Button variant="ghost" size="sm" icon={<RefreshCw size={14} className={busy ? "animate-spin motion-reduce:animate-none" : undefined} />} onClick={() => void refresh()} disabled={busy}>
          Check again
        </Button>
      </div>
      {error ? (
        <p className="rounded-xl bg-neg-soft px-3.5 py-3 text-[13px] text-neg">{error}</p>
      ) : !report ? (
        <Skeleton className="h-24" />
      ) : problems.length === 0 ? (
        <p className="rounded-xl bg-pos-soft px-3.5 py-3 text-[13px] text-pos">Everything checks out: permissions, account status, payment method and pixel.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {problems.map((c) => (
            <li key={c.code} className={cn("flex flex-col gap-1 rounded-xl px-3.5 py-3 text-[13px]", c.status === "error" ? "bg-neg-soft" : "bg-warn-soft")}>
              <span className={cn("font-semibold", c.status === "error" ? "text-neg" : "text-warn")}>{c.title}</span>
              <span className="text-ink-2">{c.message}</span>
              {c.action &&
                (c.actionUrl?.startsWith("/") ? (
                  <Link href={c.actionUrl} className="self-start font-semibold text-brand no-underline hover:text-brand-hover">
                    {c.action}
                  </Link>
                ) : c.actionUrl ? (
                  <a href={c.actionUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 self-start font-semibold text-brand no-underline hover:text-brand-hover">
                    {c.action}
                    <ExternalLink size={12} aria-hidden="true" />
                  </a>
                ) : (
                  <span className="text-ink-2">{c.action}</span>
                ))}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export function AccountDrawer({
  account,
  onClose,
  onRenew,
  onChanged,
  canConnect,
  connectReason,
  canAssign,
  hasClients,
  clients,
  focusPixel,
}: {
  account: ConnectionAccount | null;
  onClose: () => void;
  onRenew: (p: Platform) => void;
  onChanged: () => void;
  canConnect: boolean;
  connectReason: string;
  canAssign: boolean;
  hasClients: boolean;
  clients: { id: string; name: string }[];
  focusPixel: boolean;
}) {
  const api = useApiClient();
  const [busy, setBusy] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  useEffect(() => setConfirming(false), [account?.id]);
  const a = account;
  const name = a ? (PLATFORM_NAME[a.platform] ?? a.platform) : "";

  const act = async (key: string, fn: () => Promise<unknown>, done: string) => {
    setBusy(key);
    try {
      await fn();
      toast.success(done);
      onChanged();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "That didn't work. Try again.");
    } finally {
      setBusy(null);
    }
  };

  const facts: [string, string][] = a
    ? [
        ["Currency", a.currency ?? "—"],
        ["Time zone", a.timezone ?? "—"],
        ...(a.platform === "META" ? ([["Minimum daily budget", a.minDailyBudget != null ? fmtMoney(a.minDailyBudget, a.currency) : "Set on first sync"]] as [string, string][]) : []),
        ["Access expires", a.tokenExpiresAt ? new Date(a.tokenExpiresAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : a.platform === "GOOGLE" ? "Refreshes automatically" : "No expiry reported"],
        ["Last sync", a.lastSyncedAt ? timeAgo(a.lastSyncedAt) : "Not synced yet"],
        ["Spend · 30 days", fmtMoney(a.spend30d, a.currency, { whole: true })],
        ["Campaigns in Advertix", String(a.campaigns)],
        ["Connected", timeAgo(a.createdAt)],
      ]
    : [];

  return (
    <Drawer open={a !== null} onClose={onClose} title={a?.accountName ?? ""} sub={a ? `${name} · ${a.accountId}` : undefined} width={480}>
      {a && (
        <div className="flex flex-col gap-5">
          <div className="flex flex-wrap items-center gap-2">
            <Pill tone={STATUS_TONE[a.status] ?? "neutral"}>{STATUS_LABEL[a.status] ?? "Updating…"}</Pill>
            {a.statusDetail && <span className="text-[13px] text-ink-2">{a.statusDetail}</span>}
          </div>

          {hasClients && (
            <label className="flex flex-col gap-1.5 text-sm font-medium">
              Client
              <select
                value={a.clientId ?? ""}
                disabled={!canAssign || busy !== null}
                title={canAssign ? undefined : "Only owners can assign ad accounts to clients."}
                onChange={(e) => void act("client", () => api.assignAdAccountClient(a.id, e.target.value || null), "Client updated")}
                className="h-10 rounded-ctl border border-line-2 bg-surface px-3 text-sm font-normal disabled:opacity-60"
              >
                <option value="">Not assigned</option>
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>
          )}

          <dl className="grid grid-cols-2 gap-2">
            {facts.map(([k, v]) => (
              <div key={k} className="flex flex-col gap-0.5 rounded-xl bg-surface-2 px-3 py-2.5">
                <dt className="text-xs text-ink-2">{k}</dt>
                <dd className="truncate text-sm font-semibold tabular-nums">{v}</dd>
              </div>
            ))}
          </dl>

          {a.platform === "META" && a.status !== "ARCHIVED" && <HealthReport accountId={a.id} focusPixel={focusPixel} />}

          <div className="flex flex-wrap gap-2 border-t border-line pt-4" title={canConnect ? undefined : connectReason}>
            {a.status !== "ARCHIVED" && (
              <>
                <Button variant="secondary" size="sm" icon={<RefreshCw size={14} />} loading={busy === "sync"} disabled={!canConnect || !a.isActive || busy !== null} onClick={() => void act("sync", () => api.syncAdAccount(a.id), `${a.accountName} synced`)}>
                  Sync now
                </Button>
                <Button variant="secondary" size="sm" disabled={!canConnect || busy !== null} onClick={() => onRenew(a.platform)}>
                  Renew access
                </Button>
                <Button variant="secondary" size="sm" loading={busy === "archive"} disabled={!canConnect || busy !== null} onClick={() => void act("archive", () => api.archiveAdAccount(a.id), `${a.accountName} archived`)}>
                  Archive
                </Button>
              </>
            )}
            {a.status === "ARCHIVED" && (
              <Button variant="secondary" size="sm" loading={busy === "restore"} disabled={!canConnect || busy !== null} onClick={() => void act("restore", () => api.restoreAdAccount(a.id), `${a.accountName} restored`)}>
                Restore
              </Button>
            )}
            <Button variant="ghost" size="sm" className="ml-auto text-neg hover:bg-neg-soft hover:text-neg" disabled={!canConnect || busy !== null} onClick={() => setConfirming(true)}>
              Disconnect
            </Button>
          </div>
          {confirming && (
            <div className="flex flex-col gap-3 rounded-xl border border-neg/30 bg-neg-soft p-4 text-[13px]">
              <span className="font-semibold text-neg">Disconnect {a.accountName}?</span>
              <span className="text-ink-2">
                This removes the account from Advertix with {a.campaigns === 1 ? "its 1 campaign" : `its ${a.campaigns} campaigns`} and their synced results, ad sets and ads. Change-log history stays. Nothing changes on {name}, and you can connect it again later. To keep the data, archive it instead.
              </span>
              <span className="flex gap-2">
                <Button variant="danger" size="sm" loading={busy === "disconnect"} onClick={() => void act("disconnect", async () => { await api.disconnectAdAccount(a.id); onClose(); }, `${a.accountName} disconnected`)}>
                  Disconnect
                </Button>
                <Button variant="secondary" size="sm" onClick={() => setConfirming(false)} disabled={busy !== null}>
                  Keep it
                </Button>
              </span>
            </div>
          )}
        </div>
      )}
    </Drawer>
  );
}
