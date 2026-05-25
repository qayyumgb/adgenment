"use client";

import { useCallback, useEffect, useState } from "react";
import clsx from "clsx";
import toast from "react-hot-toast";
import {
  X,
  Check,
  Loader2,
  Sparkles,
  ExternalLink,
  Plug,
} from "lucide-react";
import { useApiClient, type AdAccount, type Platform } from "@/lib/api";
import {
  openMetaOAuthPopup,
  openGoogleOAuthPopup,
} from "@/lib/oauth-popup";

interface ConnectModalProps {
  open: boolean;
  onClose: () => void;
}

type PlatformRow = {
  id: Platform;
  name: string;
  sub: string;
  color: string;
  textOnColor: "white" | "black";
  initial: string;
  available: boolean;
};

const PLATFORMS: PlatformRow[] = [
  {
    id: "META",
    name: "Meta",
    sub: "Facebook + Instagram + Audience Network",
    color: "#1877F2",
    textOnColor: "white",
    initial: "f",
    available: true,
  },
  {
    id: "GOOGLE",
    name: "Google Ads",
    sub: "Search · YouTube · Display · Shopping",
    color: "#EA4335",
    textOnColor: "white",
    initial: "G",
    available: true,
  },
  {
    id: "TIKTOK",
    name: "TikTok Ads",
    sub: "For You feed · Spark Ads",
    color: "#0f172a",
    textOnColor: "white",
    initial: "T",
    available: false,
  },
  {
    id: "LINKEDIN",
    name: "LinkedIn Ads",
    sub: "Sponsored content · InMail",
    color: "#0A66C2",
    textOnColor: "white",
    initial: "in",
    available: false,
  },
  {
    id: "YOUTUBE",
    name: "YouTube Ads",
    sub: "TrueView · Bumper · Shorts",
    color: "#FF0000",
    textOnColor: "white",
    initial: "Y",
    available: false,
  },
  {
    id: "SNAPCHAT",
    name: "Snapchat Ads",
    sub: "Stories · AR Lenses",
    color: "#FFFC00",
    textOnColor: "black",
    initial: "S",
    available: false,
  },
];

export default function ConnectModal({ open, onClose }: ConnectModalProps) {
  const api = useApiClient();
  const [accounts, setAccounts] = useState<AdAccount[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [connectingPlatform, setConnectingPlatform] = useState<Platform | null>(
    null
  );

  const refresh = useCallback(async () => {
    try {
      const list = await api.getAdAccounts();
      setAccounts(list);
    } catch (err) {
      console.error("[connect-modal] load failed", err);
      setAccounts([]);
    } finally {
      setLoading(false);
    }
  }, [api]);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    void refresh();
  }, [open, refresh]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  async function startConnect(platform: Platform) {
    if (connectingPlatform) return;
    setConnectingPlatform(platform);
    try {
      const result =
        platform === "META"
          ? await openMetaOAuthPopup()
          : platform === "GOOGLE"
            ? await openGoogleOAuthPopup()
            : null;
      if (!result) return;
      if (result.success) {
        toast.success(`${platformLabel(platform)} connected`);
        await refresh();
      } else if (result.error === "popup_blocked") {
        toast.error("Popup blocked — please allow popups and try again");
      } else if (
        result.error === "meta_cancelled" ||
        result.error === "google_cancelled"
      ) {
        toast("Cancelled — you can try again any time");
      } else if (result.error === "popup_closed") {
        // user dismissed; silent
      } else if (result.error) {
        toast.error(result.error.replace(/_/g, " "));
      }
    } finally {
      setConnectingPlatform(null);
    }
  }

  function platformLabel(p: Platform): string {
    return PLATFORMS.find((x) => x.id === p)?.name ?? p;
  }

  async function disconnect(account: AdAccount) {
    try {
      await api.disconnectAdAccount(account.id);
      toast.success(`${account.platform} disconnected`);
      await refresh();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Disconnect failed";
      toast.error(msg);
    }
  }

  function findAccount(platform: Platform): AdAccount | undefined {
    return (accounts ?? []).find((a) => a.platform === platform);
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-in"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" />
      <div className="relative z-10 flex max-h-[88vh] w-full max-w-xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 shadow-glow">
              <Plug className="h-5 w-5 text-white" strokeWidth={2.25} />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">
                Connect Ad Platforms
              </h2>
              <p className="text-[11px] font-medium text-slate-500">
                Authorize once — campaigns sync automatically
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="flex h-9 w-9 items-center justify-center rounded-xl text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 space-y-2 overflow-y-auto p-4">
          {loading ? (
            <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-6 text-center text-xs font-medium text-slate-500">
              Loading connections…
            </div>
          ) : (
            PLATFORMS.map((p) => {
              const account = findAccount(p.id);
              const isConnected = !!account;
              return (
                <div
                  key={p.id}
                  className={clsx(
                    "flex items-center gap-3 rounded-xl border bg-white p-3 transition",
                    isConnected
                      ? "border-emerald-200 bg-emerald-50/40"
                      : "border-slate-200 hover:border-slate-300"
                  )}
                >
                  <div
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-base font-extrabold shadow-sm"
                    style={{
                      backgroundColor: p.color,
                      color: p.textOnColor === "black" ? "#0f172a" : "#ffffff",
                    }}
                  >
                    {p.initial}
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="truncate text-sm font-bold text-slate-900">
                        {p.name}
                      </p>
                      {isConnected ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-emerald-700">
                          <Check className="h-2.5 w-2.5" strokeWidth={3} />
                          Connected
                        </span>
                      ) : !p.available ? (
                        <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-amber-700">
                          Coming Soon
                        </span>
                      ) : null}
                    </div>
                    <p className="truncate text-[11px] text-slate-500">
                      {isConnected
                        ? account!.accountName
                        : p.sub}
                    </p>
                  </div>

                  {isConnected ? (
                    <button
                      type="button"
                      onClick={() => disconnect(account!)}
                      className="inline-flex items-center gap-1 rounded-lg border border-rose-200 bg-white px-3 py-1.5 text-[11px] font-bold text-rose-600 transition hover:bg-rose-50"
                    >
                      Disconnect
                    </button>
                  ) : p.available ? (
                    <button
                      type="button"
                      onClick={() => startConnect(p.id)}
                      disabled={connectingPlatform === p.id}
                      className={clsx(
                        "inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-[11px] font-bold text-white shadow-sm transition",
                        connectingPlatform === p.id
                          ? "bg-slate-400"
                          : "bg-primary hover:-translate-y-0.5 hover:shadow-md"
                      )}
                    >
                      {connectingPlatform === p.id ? (
                        <>
                          <Loader2 className="h-3 w-3 animate-spin" />
                          Connecting…
                        </>
                      ) : (
                        <>
                          Connect
                          <ExternalLink className="h-3 w-3" />
                        </>
                      )}
                    </button>
                  ) : (
                    <button
                      type="button"
                      disabled
                      className="inline-flex items-center rounded-lg bg-slate-100 px-3 py-1.5 text-[11px] font-bold text-slate-400"
                    >
                      Soon
                    </button>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-slate-100 bg-slate-50/50 px-6 py-3">
          <p className="flex items-center gap-1.5 text-[11px] font-medium text-slate-500">
            <Sparkles className="h-3 w-3 text-primary" />
            Connections are encrypted at rest and synced every 24 hours.
          </p>
        </div>
      </div>
    </div>
  );
}
