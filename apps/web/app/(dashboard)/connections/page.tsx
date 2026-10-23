"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import toast from "react-hot-toast";
import { Clock, Plus, RefreshCw } from "lucide-react";
import { useApi } from "@/hooks/useApi";
import { useAppRouter } from "@/hooks/useAppRouter";
import { useApiClient, type ConnectionAccount, type Platform } from "@/lib/api";
import { timeAgo } from "@/lib/time";
import { PageBody, PageHeader } from "@/components/app/shell/PageHeader";
import { useClientScope } from "@/components/app/shell/ClientContext";
import { Button, Card } from "@/components/app/ui";
import { useAccess } from "@/components/app/team/access";
import { ConnectDialog } from "@/components/app/connections/ConnectDialog";
import { AccountDrawer } from "@/components/app/connections/AccountDrawer";
import { PlatformCards } from "@/components/app/connections/PlatformCards";
import { AccountsGrid, type GridFilter } from "@/components/app/connections/AccountsGrid";
import { PLATFORM_NAME, useRefreshAccounts } from "@/components/app/connections/useConnectPlatform";

/**
 * Connections (guide §5, plan A13): token warnings, a card per platform
 * (status, accounts, spend, auto-sync), every ad account with its status and
 * the action it needs, the account drawer (details, client, Meta health,
 * sync, renew, archive, disconnect) and D1 Connect. OAuth stages the
 * accounts it finds; the dialog adds only the picked ones.
 */
export default function ConnectionsPage() {
  const api = useApiClient();
  const router = useAppRouter();
  const params = useSearchParams();
  const pathname = usePathname();
  const access = useAccess();
  const refreshAll = useRefreshAccounts();
  const { clientId, clients } = useClientScope();
  const me = useApi((c) => c.getMe(), [], { key: "me" });
  const q = useApi((c) => c.getConnections(clientId), [clientId], { key: "connections" });
  const [connect, setConnect] = useState<{ open: boolean; start: { platform?: Platform; pending?: string; renewed?: number } | null }>({ open: false, start: null });
  const [openId, setOpenId] = useState<string | null>(null);
  const [focusPixel, setFocusPixel] = useState(false);
  const [filter, setFilter] = useState<GridFilter>("all");
  const [syncing, setSyncing] = useState<Platform | "ALL" | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const canConnect = access.can("connect");
  const canAssign = access.can("clients");

  // Back from an OAuth redirect (no popup) or a deep link: ?connected=&pending=&renewed= / ?error= / ?filter=.
  useEffect(() => {
    const pending = params.get("pending");
    const error = params.get("error");
    const connected = params.get("connected");
    const f = params.get("filter");
    if (f === "unassigned" || f === "attention") setFilter(f);
    if (!pending && !error && !connected) return;
    if (pending) setConnect({ open: true, start: { pending, renewed: Number(params.get("renewed")) || 0 } });
    else if (error) toast.error(error.endsWith("_cancelled") ? "Connection cancelled." : `${PLATFORM_NAME[error.split("_")[0].toUpperCase()] ?? "The platform"} didn't finish connecting. Try again.`);
    else if (connected) toast.success(`${PLATFORM_NAME[connected.toUpperCase()] ?? "Account"} access renewed`);
    router.replace(pathname);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const data = q.data;
  const accounts = useMemo(() => data?.accounts ?? [], [data]);
  const open = accounts.find((a) => a.id === openId) ?? null;
  const live = accounts.filter((a) => a.status !== "ARCHIVED");
  const lastSync = live.map((a) => (a.lastSyncedAt ? new Date(a.lastSyncedAt).getTime() : 0)).reduce((m, t) => Math.max(m, t), 0);
  const platformsOn = (data?.platforms ?? []).filter((p) => p.accounts > 0).length;
  const summary = !data
    ? "Loading…"
    : `${platformsOn} platform${platformsOn === 1 ? "" : "s"} · ${live.length} ad account${live.length === 1 ? "" : "s"}${lastSync ? ` · last sync ${timeAgo(new Date(lastSync))}` : ""}`;

  // One warning per platform with expiring or expired access.
  const tokenIssues = useMemo(() => {
    const by = new Map<Platform, ConnectionAccount[]>();
    for (const a of accounts.filter((x) => x.status === "TOKEN_EXPIRING" || x.status === "TOKEN_EXPIRED")) by.set(a.platform, [...(by.get(a.platform) ?? []), a]);
    return [...by.entries()].slice(0, 3);
  }, [accounts]);

  const refresh = () => void refreshAll();
  const renew = (p: Platform) => setConnect({ open: true, start: { platform: p } });

  const syncNow = async (platform?: Platform) => {
    setSyncing(platform ?? "ALL");
    try {
      const r = await api.syncConnections({ platform, clientId });
      if (r.failed) toast.error(`${r.synced} synced, ${r.failed} failed: ${r.results.filter((x) => !x.ok).map((x) => `${x.accountName} (${x.error})`).join(", ")}`, { duration: 8000 });
      else toast.success(`Synced ${r.synced} account${r.synced === 1 ? "" : "s"}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Sync didn't run. Try again.");
    } finally {
      setSyncing(null);
      refresh();
    }
  };

  const rowAct = async (a: ConnectionAccount, fn: () => Promise<unknown>, done: string) => {
    setBusy(a.id);
    try {
      await fn();
      toast.success(done);
      refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "That didn't work. Try again.");
    } finally {
      setBusy(null);
    }
  };

  const workspaceName = me.data?.workspace?.name ?? "Workspace";

  return (
    <>
      <PageHeader
        kicker={`${workspaceName} · integrations`}
        title="Connections"
        summary={summary}
        actions={
          <>
            <span title={canConnect ? undefined : access.why("connect")}>
              <Button variant="secondary" icon={<RefreshCw size={16} className={syncing === "ALL" ? "animate-spin motion-reduce:animate-none" : undefined} />} disabled={!canConnect || syncing !== null || !live.length} onClick={() => void syncNow()}>
                {syncing === "ALL" ? "Syncing…" : "Sync now"}
              </Button>
            </span>
            <span title={canConnect ? undefined : access.why("connect")}>
              <Button variant="primary" icon={<Plus size={16} strokeWidth={2.5} />} disabled={!canConnect} onClick={() => setConnect({ open: true, start: null })}>
                Connect ad account
              </Button>
            </span>
          </>
        }
      />
      <PageBody className="gap-5">
        {q.error && !data && (
          <Card className="flex flex-wrap items-center justify-between gap-3">
            <span className="text-sm text-neg">Couldn’t load your connections: {q.error}</span>
            <Button variant="secondary" size="sm" onClick={() => void q.refetch()}>
              Try again
            </Button>
          </Card>
        )}

        {tokenIssues.map(([platform, list]) => {
          const expired = list.some((a) => a.status === "TOKEN_EXPIRED");
          const who = [...new Set(list.map((a) => a.clientName ?? a.accountName))];
          const whoText = who.length > 2 ? `${who.slice(0, 2).join(", ")} and ${who.length - 2} more` : who.join(" and ");
          const when = expired ? "has expired" : (list[0].statusDetail ?? "expires soon").replace(/^Access expires/, "expires");
          return (
            <div key={platform} role="status" className="flex flex-wrap items-center gap-3.5 rounded-[14px] bg-warn-soft px-[18px] py-3.5">
              <Clock size={20} className="flex-none text-warn" aria-hidden="true" />
              <span className="min-w-0 flex-[1_1_320px] text-sm">
                <span className="font-semibold">
                  {PLATFORM_NAME[platform]} access for {whoText} {when}.
                </span>{" "}
                <span className="text-ink-2">{expired ? "Spend and results stopped syncing. Reconnect to pick up where it left off." : "Renew it to keep spend and results syncing. It takes about 20 seconds."}</span>
              </span>
              <span title={canConnect ? undefined : access.why("connect")}>
                <Button variant="primary" size="sm" className="bg-ink text-surface hover:bg-ink/90" disabled={!canConnect} onClick={() => renew(platform)}>
                  Renew {PLATFORM_NAME[platform]} access
                </Button>
              </span>
            </div>
          );
        })}

        {data ? (
          <PlatformCards
            platforms={data.platforms}
            syncIntervalHours={data.syncIntervalHours}
            canConnect={canConnect}
            connectReason={access.why("connect")}
            syncing={syncing}
            onSync={(p) => void syncNow(p)}
            onConnect={renew}
            onAutoSync={(p, v) =>
              void api
                .setAutoSync(p, v)
                .then(() => {
                  toast.success(v ? `Auto-sync on for ${PLATFORM_NAME[p]}` : `Auto-sync off for ${PLATFORM_NAME[p]}. Use Sync to update it.`);
                  refresh();
                })
                .catch((err) => toast.error(err instanceof Error ? err.message : "Didn't save."))
            }
          />
        ) : (
          !q.error && (
            <div className="grid grid-cols-[repeat(auto-fill,minmax(230px,1fr))] gap-4">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="h-[196px] animate-pulse rounded-card bg-surface-3 motion-reduce:animate-none" />
              ))}
            </div>
          )
        )}

        <AccountsGrid
          accounts={accounts}
          loading={q.loading && !data}
          hasClients={data?.hasClients ?? false}
          clients={clients}
          filter={filter}
          setFilter={setFilter}
          canConnect={canConnect}
          canAssign={canAssign}
          busy={busy}
          onOpen={(a, pixel) => {
            setFocusPixel(Boolean(pixel));
            setOpenId(a.id);
          }}
          onRenew={(a) => renew(a.platform)}
          onAssign={(a, cid) => void rowAct(a, () => api.assignAdAccountClient(a.id, cid), `${a.accountName} assigned to ${clients.find((c) => c.id === cid)?.name ?? "the client"}`)}
          onArchive={(a) => void rowAct(a, () => api.archiveAdAccount(a.id), `${a.accountName} archived`)}
          onRestore={(a) => void rowAct(a, () => api.restoreAdAccount(a.id), `${a.accountName} restored`)}
        />
      </PageBody>

      <AccountDrawer
        account={open}
        onClose={() => setOpenId(null)}
        onRenew={renew}
        onChanged={refresh}
        canConnect={canConnect}
        connectReason={access.why("connect")}
        canAssign={canAssign}
        hasClients={data?.hasClients ?? false}
        clients={clients}
        focusPixel={focusPixel}
      />
      <ConnectDialog open={connect.open} start={connect.start} onClose={() => setConnect({ open: false, start: null })} />
    </>
  );
}
