"use client";

import { useEffect, useState } from "react";
import { Check, AlertTriangle, X } from "lucide-react";

/**
 * Popup-close page. Reached by the backend OAuth callback redirecting here
 * with ?connected=<platform> or ?error=<reason>.
 *
 * Notifies the opener via:
 *   1. `window.opener.postMessage(...)` — works when opener relationship is
 *      preserved (i.e. backend uses COOP `same-origin-allow-popups`).
 *   2. `BroadcastChannel("platform-oauth")` — works regardless of opener,
 *      as long as parent and popup share an origin.
 *
 * Then tries `window.close()`. If the browser refuses (e.g. user landed
 * here outside a popup), shows a manual "you can close this window" UI.
 */

const CHANNEL_NAME = "platform-oauth";
const MESSAGE_TYPE = "platform-connect-done";

export default function ConnectDonePage() {
  const [params, setParams] = useState<{
    platform: string | null;
    error: string | null;
  } | null>(null);
  const [needsManualClose, setNeedsManualClose] = useState(false);

  useEffect(() => {
    const sp = new URLSearchParams(window.location.search);
    const platform = sp.get("connected") ?? sp.get("platform") ?? null;
    const error = sp.get("error") ?? null;
    setParams({ platform, error });

    const payload = {
      type: MESSAGE_TYPE,
      platform,
      success: !error,
      error,
    };

    // 1. postMessage to opener (when COOP allows it)
    try {
      if (window.opener && window.opener !== window) {
        window.opener.postMessage(payload, window.location.origin);
      }
    } catch {
      // ignore cross-origin or opener-gone errors
    }

    // 2. BroadcastChannel — same-origin, opener-independent
    let channel: BroadcastChannel | null = null;
    try {
      channel = new BroadcastChannel(CHANNEL_NAME);
      channel.postMessage(payload);
    } catch {
      // older browsers without BroadcastChannel
    }

    // 3. Attempt to close
    const closeTimer = window.setTimeout(() => {
      try {
        window.close();
      } catch {
        // ignore
      }
    }, 250);

    // If we're still alive 800ms later, the browser blocked window.close
    // (e.g. user navigated here directly). Show the manual close UI.
    const fallbackTimer = window.setTimeout(() => {
      setNeedsManualClose(true);
    }, 800);

    return () => {
      window.clearTimeout(closeTimer);
      window.clearTimeout(fallbackTimer);
      try {
        channel?.close();
      } catch {
        // ignore
      }
    };
  }, []);

  const error = params?.error ?? null;

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 p-6">
      <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-6 text-center shadow-xl">
        {error ? (
          <>
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-rose-100 text-rose-600">
              <AlertTriangle className="h-6 w-6" />
            </div>
            <p className="text-sm font-bold text-slate-900">
              Connection failed
            </p>
            <p className="mt-1 text-xs text-slate-500">
              {error.replace(/_/g, " ")}
            </p>
          </>
        ) : (
          <>
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
              <Check className="h-6 w-6" strokeWidth={3} />
            </div>
            <p className="text-sm font-bold text-slate-900">Connected</p>
            <p className="mt-1 text-xs text-slate-500">
              {needsManualClose
                ? "You can close this window now."
                : "Closing this window…"}
            </p>
          </>
        )}

        {needsManualClose && (
          <button
            type="button"
            onClick={() => {
              try {
                window.close();
              } catch {
                // ignore
              }
            }}
            className="mt-4 inline-flex items-center gap-1.5 rounded-xl bg-slate-900 px-3.5 py-2 text-xs font-bold text-white shadow-sm transition hover:bg-slate-800"
          >
            <X className="h-3.5 w-3.5" />
            Close window
          </button>
        )}
      </div>
    </div>
  );
}
