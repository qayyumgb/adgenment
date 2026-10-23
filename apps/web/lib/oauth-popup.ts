/**
 * Open an ad-platform OAuth flow in a popup window and resolve once the
 * popup posts back its result via `window.postMessage`. The popup is loaded
 * from our backend (which redirects to the platform); the platform then
 * redirects back to our `/connect/done` page which closes itself + messages
 * the parent.
 */

const CHANNEL_NAME = "platform-oauth";
const MESSAGE_TYPE = "platform-connect-done";

export type OAuthPopupResult = {
  success: boolean;
  platform?: string | null;
  error?: string | null;
  /** New accounts waiting to be picked in the Connect dialog (A13). */
  pending?: string | null;
  /** Accounts already in Advertix that got the new token. */
  renewed?: number;
};

type Options = {
  /** Window name passed to window.open — pick something stable per platform. */
  windowName: string;
  /** URL fetcher — returns the OAuth dialog URL to open. */
  getUrl: () => Promise<string>;
  width?: number;
  height?: number;
  /** Expected platform string in the postMessage payload. */
  expectedPlatform?: string;
};

export function openOAuthPopup({
  windowName,
  getUrl,
  width = 600,
  height = 720,
  expectedPlatform,
}: Options): Promise<OAuthPopupResult> {
  return new Promise(async (resolve) => {
    let url: string;
    try {
      url = await getUrl();
    } catch (err) {
      resolve({
        success: false,
        error: err instanceof Error ? err.message : "Could not start connect",
      });
      return;
    }

    const dualScreenLeft = window.screenLeft ?? window.screenX ?? 0;
    const dualScreenTop = window.screenTop ?? window.screenY ?? 0;
    const screenWidth = window.innerWidth ?? document.documentElement.clientWidth;
    const screenHeight =
      window.innerHeight ?? document.documentElement.clientHeight;
    const left = dualScreenLeft + (screenWidth - width) / 2;
    const top = dualScreenTop + (screenHeight - height) / 2;

    const popup = window.open(
      url,
      windowName,
      `popup=yes,width=${width},height=${height},left=${left},top=${top},scrollbars=yes,resizable=yes`
    );

    if (!popup || popup.closed) {
      resolve({ success: false, error: "popup_blocked" });
      return;
    }

    let settled = false;
    let channel: BroadcastChannel | null = null;
    try {
      channel = new BroadcastChannel(CHANNEL_NAME);
    } catch {
      // BroadcastChannel unavailable — postMessage path still works in
      // browsers where opener is preserved.
    }

    function cleanup() {
      window.removeEventListener("message", onMessage);
      window.clearInterval(closedPoller);
      window.clearTimeout(hardTimeout);
      try {
        channel?.close();
      } catch {
        // ignore
      }
    }

    function settle(result: OAuthPopupResult) {
      if (settled) return;
      settled = true;
      cleanup();
      try {
        popup?.close();
      } catch {
        // ignore
      }
      resolve(result);
    }

    function isMatch(data: unknown): data is {
      type: string;
      platform: string | null;
      success: boolean;
      error: string | null;
      pending?: string | null;
      renewed?: number;
    } {
      if (!data || typeof data !== "object") return false;
      const obj = data as { type?: unknown; platform?: unknown };
      if (obj.type !== MESSAGE_TYPE) return false;
      if (
        expectedPlatform &&
        obj.platform &&
        obj.platform !== expectedPlatform
      ) {
        return false;
      }
      return true;
    }

    function handlePayload(data: unknown) {
      if (!isMatch(data)) return;
      settle({
        success: !!data.success,
        platform: data.platform ?? null,
        error: data.error ?? null,
        pending: data.pending ?? null,
        renewed: Number(data.renewed) || 0,
      });
    }

    function onMessage(event: MessageEvent) {
      if (event.origin !== window.location.origin) return;
      handlePayload(event.data);
    }

    window.addEventListener("message", onMessage);
    if (channel) {
      channel.onmessage = (event) => handlePayload(event.data);
    }

    // We cannot trust `popup.closed` while the popup is on the OAuth
    // provider's origin — providers like accounts.google.com set
    // `Cross-Origin-Opener-Policy: same-origin`, which makes the browser
    // block the read and return `true` (with a noisy console warning).
    // Polling would resolve as `popup_closed` before OAuth even starts.
    //
    // Strategy: poll slowly (2s), guard with try/catch, and only resolve
    // after seeing `closed === true` 3 times in a row. By that point any
    // in-flight postMessage / BroadcastChannel signal will have settled
    // the promise first.
    let closedReadings = 0;
    const closedPoller = window.setInterval(() => {
      let isClosed = false;
      try {
        isClosed = popup.closed;
      } catch {
        return;
      }
      if (!isClosed) {
        closedReadings = 0;
        return;
      }
      closedReadings += 1;
      if (closedReadings >= 3) {
        settle({ success: false, error: "popup_closed" });
      }
    }, 2000);

    // Hard ceiling — if neither message nor close fires, give up after
    // 5 minutes so the promise doesn't leak.
    const hardTimeout = window.setTimeout(
      () => settle({ success: false, error: "popup_timeout" }),
      5 * 60 * 1000
    );
  });
}

export type OAuthPlatform = "meta" | "google" | "tiktok" | "linkedin";
const LABEL: Record<OAuthPlatform, string> = { meta: "Meta", google: "Google", tiktok: "TikTok", linkedin: "LinkedIn" };

/**
 * Open a platform's OAuth dialog in a popup (via our same-origin
 * `/api/<platform>/connect` proxy, which returns the dialog URL).
 */
export function openPlatformOAuthPopup(platform: OAuthPlatform): Promise<OAuthPopupResult> {
  return openOAuthPopup({
    windowName: `advertix_${platform}_connect`,
    expectedPlatform: platform,
    async getUrl() {
      const res = await fetch(`/api/${platform}/connect`);
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.url) throw new Error(data?.error ?? `Could not start ${LABEL[platform]} connect`);
      return data.url as string;
    },
  });
}
