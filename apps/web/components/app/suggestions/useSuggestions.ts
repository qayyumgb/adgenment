"use client";

import { useState } from "react";
import toast from "react-hot-toast";
import { useApi } from "@/hooks/useApi";
import { useApiClient, type Suggestion } from "@/lib/api";
import type { SuggestionState } from "@/components/app/ui";

export const suggestionState = (s: Suggestion): SuggestionState =>
  s.status === "APPLIED" ? "applied" : s.status === "SNOOZED" ? "snoozed" : "open";

const errorText = (err: unknown) => (err instanceof Error && err.message ? err.message : "Something went wrong. Try again.");

/**
 * Open suggestions for the current scope plus Apply / Not now / Undo (plan
 * B2). Suggestions acted on in this visit stay in the list with their new
 * state until the next load, so Applied / Snoozed + Undo remain visible
 * (guide §6). `onChanged` runs after an apply or undo succeeds — the
 * underlying campaign changed, so callers refetch it.
 */
export function useSuggestions({
  clientId,
  campaignId,
  onChanged,
}: {
  clientId: string | null;
  /** Only this campaign's suggestions (Campaign detail). */
  campaignId?: string;
  onChanged?: () => void;
}) {
  const api = useApiClient();
  const q = useApi((c) => c.getSuggestions({ clientId, campaignId }), [clientId, campaignId], { key: "suggestions" });
  const [touched, setTouched] = useState<Record<string, Suggestion>>({});
  const [busy, setBusy] = useState<string | null>(null);

  const fromServer = q.data?.suggestions ?? [];
  const list = [...fromServer, ...Object.values(touched).filter((t) => !fromServer.some((s) => s.id === t.id))]
    .map((s) => touched[s.id] ?? s)
    .filter((s) => (!clientId || s.clientId === clientId) && (!campaignId || s.campaignId === campaignId))
    .sort((a, b) => a.priority - b.priority || b.createdAt.localeCompare(a.createdAt));

  const act = async (s: Suggestion, run: () => Promise<Suggestion>, changesCampaign: boolean) => {
    setBusy(s.id);
    try {
      const next = await run();
      setTouched((t) => ({ ...t, [s.id]: { ...s, ...next } }));
      if (changesCampaign) onChanged?.();
    } catch (err) {
      toast.error(errorText(err));
    } finally {
      setBusy(null);
    }
  };

  return {
    list,
    loading: q.loading,
    error: q.error,
    lastCheckedAt: q.data?.lastCheckedAt ?? null,
    busy,
    apply: (s: Suggestion) => act(s, () => api.applySuggestion(s.id), true),
    snooze: (s: Suggestion) => act(s, () => api.snoozeSuggestion(s.id), false),
    undo: (s: Suggestion) => act(s, () => api.undoSuggestion(s.id), s.status === "APPLIED"),
    /** Undo is offered for snoozes and for applies still inside the undo window. */
    canUndo: (s: Suggestion) => s.status === "SNOOZED" || (s.status === "APPLIED" && s.canUndo),
    refetch: async () => {
      setTouched({});
      await q.refetch();
    },
    /** Re-run the account check (1-hour gate). */
    refresh: async () => {
      try {
        const res = await api.refreshSuggestions();
        if (!res.generated) toast("Advertix checked your accounts within the last hour. Try again later.");
        setTouched({});
        await q.refetch();
      } catch (err) {
        toast.error(errorText(err));
      }
    },
  };
}
