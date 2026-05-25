"use client";

import { useState } from "react";
import clsx from "clsx";
import toast from "react-hot-toast";
import {
  ExternalLink,
  RefreshCw,
  Check,
  Loader2,
  AlertTriangle,
} from "lucide-react";
import { useApiClient } from "@/lib/api";
import { openMetaOAuthPopup } from "@/lib/oauth-popup";

interface MetaConnectProps {
  connected: boolean;
  adAccountId?: string;
  accountName?: string;
  lastSynced?: string;
  onChange?: () => void;
}

export default function MetaConnect({
  connected,
  adAccountId,
  accountName,
  lastSynced,
  onChange,
}: MetaConnectProps) {
  const api = useApiClient();
  const [connecting, setConnecting] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [confirmDisconnect, setConfirmDisconnect] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);

  async function startConnect() {
    if (connecting) return;
    setConnecting(true);
    try {
      const result = await openMetaOAuthPopup();
      if (result.success) {
        toast.success("Meta account connected");
        onChange?.();
      } else if (result.error === "popup_blocked") {
        toast.error("Popup blocked — please allow popups and try again");
      } else if (result.error === "meta_cancelled") {
        toast("Cancelled — connect again when you're ready");
      } else if (result.error === "popup_closed") {
        // User closed the popup before completing — silent.
      } else if (result.error) {
        toast.error(result.error.replace(/_/g, " "));
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Connection failed";
      toast.error(msg);
    } finally {
      setConnecting(false);
    }
  }

  async function syncNow() {
    if (!adAccountId) return;
    setSyncing(true);
    const t = toast.loading("Syncing Meta campaigns…");
    try {
      const res = await fetch(`${apiBase()}/api/meta/sync/${adAccountId}`, {
        method: "POST",
        headers: await authHeader(),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error ?? `HTTP ${res.status}`);
      }
      toast.success(
        `Synced ${data.campaignsSynced} campaigns · ${data.metricsSynced} metric rows`,
        { id: t }
      );
      onChange?.();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Sync failed";
      toast.error(msg, { id: t });
    } finally {
      setSyncing(false);
    }
  }

  async function disconnect() {
    if (!adAccountId) return;
    setDisconnecting(true);
    try {
      await api.disconnectAdAccount(adAccountId);
      toast.success("Meta account disconnected");
      setConfirmDisconnect(false);
      onChange?.();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Disconnect failed";
      toast.error(msg);
    } finally {
      setDisconnecting(false);
    }
  }

  /* ── Connected card ── */
  if (connected) {
    return (
      <div className="rounded-xl border border-emerald-200 bg-emerald-50/40 p-4 transition hover:border-emerald-300">
        <div className="flex items-center gap-3">
          <MetaLogo />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <p className="text-sm font-bold text-slate-900">Meta</p>
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-emerald-700">
                <span className="status-dot active" />
                Connected
              </span>
            </div>
            <p className="truncate text-[11px] text-slate-500">
              {accountName ?? "—"}
            </p>
          </div>
        </div>

        <div className="mt-3 flex items-center justify-between gap-2">
          <span className="text-[10px] font-medium text-slate-400">
            {lastSynced ? `Last synced: ${lastSynced}` : "Never synced"}
          </span>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={syncNow}
              disabled={syncing}
              className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-bold text-slate-700 transition hover:border-primary/40 hover:bg-primary/5 hover:text-primary disabled:opacity-60"
            >
              {syncing ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <RefreshCw className="h-3 w-3" />
              )}
              {syncing ? "Syncing…" : "Sync Now"}
            </button>
            <button
              type="button"
              onClick={() => setConfirmDisconnect(true)}
              className="inline-flex items-center gap-1 rounded-lg border border-rose-200 bg-white px-2.5 py-1 text-[11px] font-bold text-rose-600 transition hover:bg-rose-50"
            >
              Disconnect
            </button>
          </div>
        </div>

        {confirmDisconnect && (
          <div className="mt-3 rounded-xl border border-rose-200 bg-rose-50 p-3 animate-in">
            <div className="flex items-start gap-2">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-rose-600" />
              <div className="flex-1 text-xs text-rose-800">
                <p className="font-bold">Disconnect Meta?</p>
                <p className="mt-0.5 text-rose-700">
                  This will remove all synced Meta campaign data from AdGenius.
                  You can reconnect anytime.
                </p>
              </div>
            </div>
            <div className="mt-3 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setConfirmDisconnect(false)}
                className="text-xs font-semibold text-slate-600 transition hover:text-slate-900"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={disconnect}
                disabled={disconnecting}
                className="inline-flex items-center gap-1.5 rounded-lg bg-rose-600 px-3 py-1.5 text-xs font-bold text-white shadow-sm transition hover:bg-rose-700 disabled:opacity-60"
              >
                {disconnecting && (
                  <Loader2 className="h-3 w-3 animate-spin" />
                )}
                Yes, disconnect
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  /* ── Not-connected card ── */
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 transition hover:border-slate-300">
      <div className="flex items-center gap-3">
        <MetaLogo />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold text-slate-900">
            Meta (Facebook + Instagram)
          </p>
          <p className="text-[11px] text-slate-500">
            Connect your Meta Ads account to manage Facebook and Instagram
            campaigns.
          </p>
        </div>
      </div>

      <ul className="mt-3 space-y-1">
        <Permission>View and manage ad campaigns</Permission>
        <Permission>Access campaign performance data</Permission>
        <Permission>Create and edit ad creatives</Permission>
      </ul>

      <button
        type="button"
        onClick={startConnect}
        disabled={connecting}
        className={clsx(
          "mt-4 inline-flex w-full items-center justify-center gap-1.5 rounded-xl px-3.5 py-2.5 text-sm font-bold text-white shadow-sm transition",
          connecting
            ? "bg-slate-400"
            : "bg-primary hover:-translate-y-0.5 hover:bg-[#1877F2] hover:shadow-glow"
        )}
      >
        {connecting ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            Opening Meta…
          </>
        ) : (
          <>
            Connect Meta Ads
            <ExternalLink className="h-4 w-4" />
          </>
        )}
      </button>
    </div>
  );
}

function MetaLogo() {
  return (
    <div
      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-base font-extrabold text-white shadow-sm"
      style={{ backgroundColor: "#1877F2" }}
    >
      f
    </div>
  );
}

function Permission({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-1.5 text-[11px] text-slate-500">
      <Check className="mt-0.5 h-3 w-3 shrink-0 text-emerald-500" strokeWidth={3} />
      <span>{children}</span>
    </li>
  );
}

/* ── Helpers — minimal direct fetches (auth header from Clerk) ── */

function apiBase(): string {
  return process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";
}

async function authHeader(): Promise<HeadersInit> {
  // useApiClient already does this, but Meta sync uses a non-standard path so
  // we re-pull the token here for a single direct fetch.
  const w = window as unknown as {
    Clerk?: { session?: { getToken: () => Promise<string | null> } };
  };
  const token = await w.Clerk?.session?.getToken();
  return {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}
