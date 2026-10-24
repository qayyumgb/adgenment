"use client";

import { RefreshCw } from "lucide-react";
import type { ConnectionPlatform, Platform } from "@/lib/api";
import { fmtMoney } from "@/lib/money";
import { timeAgo } from "@/lib/time";
import { Button, Pill, PlatformBadge, Toggle, type PlatformKey } from "@/components/app/ui";

/**
 * Platform cards (guide §5 Connections, plan A13): status, accounts, 30-day
 * spend, auto-sync (the background sync, every few hours), and Connect (straight
 * to the platform's sign-in) or Sync + Disconnect. Snapchat shows as coming
 * soon (decision 8).
 */
export function PlatformCards({
  platforms,
  syncIntervalHours,
  canConnect,
  connectReason,
  syncing,
  connecting,
  onSync,
  onConnect,
  onDisconnect,
  onAutoSync,
}: {
  platforms: ConnectionPlatform[];
  syncIntervalHours: number;
  canConnect: boolean;
  connectReason: string;
  syncing: Platform | "ALL" | null;
  /** The platform whose sign-in window is open. */
  connecting: Platform | null;
  onSync: (p: Platform) => void;
  onConnect: (p: Platform) => void;
  onDisconnect: (p: ConnectionPlatform) => void;
  onAutoSync: (p: Platform, enabled: boolean) => void;
}) {
  return (
    <div className="grid grid-cols-[repeat(auto-fill,minmax(230px,1fr))] gap-4">
      {platforms.map((p) => {
        const connected = p.status === "CONNECTED" || p.status === "ATTENTION";
        const pill =
          p.status === "CONNECTED" ? <Pill tone="pos">Connected</Pill> : p.status === "ATTENTION" ? <Pill tone="warn">Needs attention</Pill> : p.status === "COMING_SOON" ? <Pill tone="neutral">Coming soon</Pill> : <Pill tone="muted">Not connected</Pill>;
        const footer = !connected
          ? p.available
            ? connecting === p.platform
              ? `Waiting for ${p.name} sign-in…`
              : "Connect to start syncing"
            : "Not available in Advertix yet"
          : syncing === p.platform || syncing === "ALL"
            ? "Syncing…"
            : !p.autoSync
              ? `Auto-sync off · ${p.lastSyncedAt ? `last sync ${timeAgo(p.lastSyncedAt)}` : "manual only"}`
              : p.lastSyncedAt
                ? `Last sync ${timeAgo(p.lastSyncedAt)} · every ${syncIntervalHours} h`
                : "First sync pending";
        return (
          <div key={p.platform} className="flex flex-col gap-3.5 rounded-card border border-line bg-surface p-[18px] shadow-card">
            <div className="flex items-center gap-3">
              <PlatformBadge platform={p.platform as PlatformKey} size={34} className={p.available ? undefined : "opacity-60"} />
              <span className="flex min-w-0 flex-1 flex-col gap-1 leading-tight">
                <span className="text-[15px] font-semibold">{p.name}</span>
                <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <span className="text-xs text-ink-2">{p.api}</span>
                  {pill}
                </span>
              </span>
            </div>
            <div className="grid grid-cols-2 gap-2 tabular-nums">
              <div className="flex flex-col rounded-[10px] bg-surface-2 px-3 py-2.5">
                <span className="text-xs text-ink-2">Ad accounts</span>
                <span className="text-[17px] font-semibold">{p.accounts}</span>
              </div>
              <div className="flex flex-col rounded-[10px] bg-surface-2 px-3 py-2.5">
                <span className="text-xs text-ink-2">Spend · 30d</span>
                <span className="text-[17px] font-semibold" title={connected && p.spend30d === null ? "These accounts use different currencies" : undefined}>
                  {!connected ? "—" : p.spend30d === null ? "Mixed" : p.spend30d >= 10_000 ? fmtMoney(p.spend30d, p.currency, { compact: true }) : fmtMoney(p.spend30d, p.currency, { whole: true })}
                </span>
              </div>
            </div>
            {p.available && connected && (
              <span className="flex items-center gap-2 text-[13px] text-ink-2" title={canConnect ? undefined : connectReason}>
                <Toggle checked={p.autoSync} disabled={!canConnect} onChange={(v) => onAutoSync(p.platform, v)} label={`Auto-sync ${p.name}`} />
                Auto-sync
              </span>
            )}
            {p.available && (
              <div className="flex flex-wrap gap-2" title={canConnect ? undefined : connectReason}>
                {connected ? (
                  <>
                    <Button variant="secondary" size="sm" className="flex-1" icon={<RefreshCw size={13} className={syncing === p.platform ? "animate-spin motion-reduce:animate-none" : undefined} />} disabled={!canConnect || syncing !== null} onClick={() => onSync(p.platform)}>
                      Sync
                    </Button>
                    <Button variant="ghost" size="sm" className="flex-1 text-neg hover:bg-neg-soft hover:text-neg" disabled={!canConnect || syncing !== null} onClick={() => onDisconnect(p)}>
                      Disconnect
                    </Button>
                  </>
                ) : (
                  <Button variant="soft" size="sm" className="flex-1" loading={connecting === p.platform} disabled={!canConnect || (connecting !== null && connecting !== p.platform)} onClick={() => onConnect(p.platform)}>
                    Connect {p.name}
                  </Button>
                )}
              </div>
            )}
            <span className="text-xs text-ink-3">{footer}</span>
          </div>
        );
      })}
    </div>
  );
}
