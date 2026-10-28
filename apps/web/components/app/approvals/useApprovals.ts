"use client";

import { useEffect } from "react";
import { useSWRConfig } from "swr";
import { useApi } from "@/hooks/useApi";
import { useRefreshOnNavigate } from "@/hooks/useRefreshOnNavigate";
import { APPROVALS_CHANGED_EVENT } from "@/lib/api";

/**
 * Approvals summary (plan C1) for the sidebar badge and the Overview banner.
 * Refreshes on every page change and whenever a change is sent for approval
 * here; owners get the workspace's waiting requests, others their own.
 */
export function useApprovalSummary() {
  const summary = useApi((c) => c.getApprovalSummary(), [], { key: "approval-summary" });
  const { refetch } = summary;
  // Shown in several places at once: one refresh per page change, at most every 20 s.
  useRefreshOnNavigate("approval-summary", refetch);
  useEffect(() => {
    const on = () => void refetch();
    window.addEventListener(APPROVALS_CHANGED_EVENT, on);
    return () => window.removeEventListener(APPROVALS_CHANGED_EVENT, on);
  }, [refetch]);
  return summary;
}

/** Refresh everything keyed "approval…" (summary, lists, settings) after approve / reject / withdraw. */
export function useRefreshApprovals() {
  const { mutate } = useSWRConfig();
  return () => mutate((key) => Array.isArray(key) && String(key[0]).startsWith("approval"));
}

/** "26 h" / "3 d" / "40 min": how long a request has waited. */
export function waited(iso: string) {
  const min = Math.max(1, Math.round((Date.now() - new Date(iso).getTime()) / 60_000));
  if (min < 60) return `${min} min`;
  const h = Math.round(min / 60);
  return h < 48 ? `${h} h` : `${Math.round(h / 24)} d`;
}

export const OVERDUE_MS = 24 * 60 * 60 * 1000;
