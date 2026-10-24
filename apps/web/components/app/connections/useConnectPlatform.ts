"use client";

import { useCallback, useState } from "react";
import { useSWRConfig } from "swr";
import type { ConnectionStatus, Platform } from "@/lib/api";
import { openPlatformOAuthPopup, type OAuthPlatform } from "@/lib/oauth-popup";

/**
 * One connect flow for every platform (plan A13; replaces the four Connect
 * components). Opens the platform's OAuth popup and reads the result:
 * `pending` = new accounts to pick in the Connect dialog, `renewed` =
 * accounts already in Advertix that got the new token.
 */

export const PLATFORM_NAME: Record<string, string> = { META: "Meta", GOOGLE: "Google Ads", TIKTOK: "TikTok", LINKEDIN: "LinkedIn", SNAPCHAT: "Snapchat" };
export const CONNECTABLE: Platform[] = ["META", "GOOGLE", "TIKTOK", "LINKEDIN"];

export type ConnectOutcome =
  | { ok: true; platform: Platform; pending: string | null; renewed: number }
  | { ok: false; platform: Platform; message: string | null; tone: "error" | "neutral" };

/** Plain words for the callback and popup error codes. */
function explain(platform: Platform, code: string): { message: string | null; tone: "error" | "neutral" } {
  const name = PLATFORM_NAME[platform] ?? platform;
  if (code === "popup_closed") return { message: null, tone: "neutral" };
  if (code === "popup_blocked") return { message: "Your browser blocked the sign-in window. Allow pop-ups for Advertix and try again.", tone: "error" };
  if (code === "popup_timeout") return { message: `The ${name} sign-in window timed out. Try again.`, tone: "error" };
  if (code.endsWith("_cancelled")) return { message: `${name} connection cancelled.`, tone: "neutral" };
  if (code.endsWith("_no_workspace")) return { message: "Your workspace isn't ready yet. Refresh the page and try again.", tone: "error" };
  if (code === "google_no_customers") return { message: "That Google account can't access any Google Ads accounts.", tone: "error" };
  if (code === "tiktok_no_advertisers") return { message: "TikTok didn't share any advertiser accounts. Tick at least one advertiser when you approve.", tone: "error" };
  if (code === "linkedin_no_accounts") return { message: "That LinkedIn member has no ad accounts.", tone: "error" };
  if (code.endsWith("_failed")) return { message: `${name} didn't finish connecting. Try again.`, tone: "error" };
  return { message: code, tone: "error" };
}

export function useConnectPlatform() {
  const [busy, setBusy] = useState<Platform | null>(null);
  const connect = useCallback(async (platform: Platform): Promise<ConnectOutcome> => {
    setBusy(platform);
    try {
      const r = await openPlatformOAuthPopup(platform.toLowerCase() as OAuthPlatform);
      if (r.success) return { ok: true, platform, pending: r.pending ?? null, renewed: r.renewed ?? 0 };
      return { ok: false, platform, ...explain(platform, r.error ?? `${platform.toLowerCase()}_failed`) };
    } finally {
      setBusy(null);
    }
  }, []);
  return { connect, busy };
}

/** Refresh every list that shows ad accounts (Connections, sidebar box, client counts, wizard). */
export function useRefreshAccounts() {
  const { mutate } = useSWRConfig();
  return useCallback(() => mutate((key) => Array.isArray(key) && ["connections", "ad-accounts", "clients", "campaign-count"].includes(String(key[0]))), [mutate]);
}

export const STATUS_LABEL: Record<ConnectionStatus, string> = {
  CHECKING: "Checking…",
  HEALTHY: "Healthy",
  TOKEN_EXPIRING: "Token expiring",
  TOKEN_EXPIRED: "Access expired",
  PIXEL_ISSUE: "Pixel issue",
  BLOCKED: "Needs attention",
  UNASSIGNED: "Unassigned",
  INACTIVE: "Inactive",
  ARCHIVED: "Archived",
};
export const STATUS_TONE: Record<ConnectionStatus, "pos" | "warn" | "neg" | "brand" | "neutral"> = {
  CHECKING: "neutral",
  HEALTHY: "pos",
  TOKEN_EXPIRING: "warn",
  TOKEN_EXPIRED: "neg",
  PIXEL_ISSUE: "neg",
  BLOCKED: "neg",
  UNASSIGNED: "brand",
  INACTIVE: "neutral",
  ARCHIVED: "neutral",
};
export const NEEDS_ATTENTION: ConnectionStatus[] = ["TOKEN_EXPIRING", "TOKEN_EXPIRED", "PIXEL_ISSUE", "BLOCKED"];
