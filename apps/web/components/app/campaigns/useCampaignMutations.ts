"use client";

import { useState } from "react";
import toast from "react-hot-toast";
import { useApiClient, type Campaign, type CampaignStatus } from "@/lib/api";
import { useConfirm } from "@/components/app/ui";

const errorText = (err: unknown) => (err instanceof Error && err.message ? err.message : "That didn't work. Try again.");

/** Live on Meta → changes must go to Meta (via /launch or PUT), not just our row. */
export const isLiveOnMeta = (c: Campaign) => c.platform === "META" && Boolean(c.externalId);

/**
 * A Meta campaign that was never published has nothing on Meta to start, so
 * it gets "Publish" instead of a resume toggle that would do nothing.
 */
export const needsPublish = (c: Campaign) => c.platform === "META" && !c.externalId;

/**
 * Google, TikTok and LinkedIn are read-only syncs: changing a synced campaign
 * there from Advertix would only change our copy (and the next sync would put
 * it back), so status and budget edits are offered for Meta and local drafts only.
 */
export const isReadOnlySync = (c: Campaign) => c.platform !== "META" && Boolean(c.externalId);

/** Status toggles only make sense for running / paused campaigns that can actually change. */
export const canToggle = (c: Campaign) =>
  (c.status === "ACTIVE" || c.status === "PAUSED") && !needsPublish(c) && !isReadOnlySync(c);

/**
 * Campaign row and bulk actions for the Campaigns grid. Same rules as the
 * old page: a campaign live on Meta is paused / resumed ON Meta
 * (`launchCampaign` flips campaign + ad set + ad together); local drafts only
 * change here. `onMutate` refetches after any change.
 */
export function useCampaignMutations(onMutate: () => void) {
  const api = useApiClient();
  const { confirm, dialog: confirmDialog } = useConfirm();
  const [busy, setBusy] = useState<Record<string, true>>({});
  const mark = (id: string, on: boolean) =>
    setBusy((b) => {
      const next = { ...b };
      if (on) next[id] = true;
      else delete next[id];
      return next;
    });

  const setStatus = (c: Campaign, next: "ACTIVE" | "PAUSED") =>
    isLiveOnMeta(c) ? api.launchCampaign(c.id, next) : api.updateCampaign(c.id, { status: next as CampaignStatus });

  // Server-side copy (B5): a local draft; schedule dates already past are dropped.
  const duplicateOne = (c: Campaign) => api.duplicateCampaign(c.id);

  /** Run one action per campaign in sequence; report successes and the first failure. */
  const runMany = async (
    rows: Campaign[],
    run: (c: Campaign) => Promise<unknown>,
    done: (n: number) => string
  ): Promise<number> => {
    let ok = 0;
    const failures: string[] = [];
    for (const c of rows) {
      mark(c.id, true);
      try {
        await run(c);
        ok++;
      } catch (err) {
        failures.push(`${c.name}: ${errorText(err)}`);
      } finally {
        mark(c.id, false);
      }
    }
    if (ok) toast.success(done(ok) + (failures.length ? ` · ${failures.length} failed` : ""));
    if (failures.length) toast.error(failures[0], { duration: 6000 });
    if (ok) onMutate();
    return ok;
  };

  return {
    busy: (id: string) => Boolean(busy[id]),
    /** The delete confirm; render it once where `remove` can be called. */
    confirmDialog,

    toggle: async (c: Campaign) => {
      if (busy[c.id] || !canToggle(c)) return;
      const next = c.status === "ACTIVE" ? "PAUSED" : "ACTIVE";
      mark(c.id, true);
      try {
        await setStatus(c, next);
        toast.success(`Campaign ${next === "ACTIVE" ? "resumed" : "paused"}${isLiveOnMeta(c) ? " on Meta" : ""}`);
        onMutate();
      } catch (err) {
        toast.error(errorText(err));
      } finally {
        mark(c.id, false);
      }
    },

    pauseMany: (rows: Campaign[]) =>
      runMany(rows.filter((c) => canToggle(c) && c.status === "ACTIVE"), (c) => setStatus(c, "PAUSED"), (n) => `${n} campaign${n === 1 ? "" : "s"} paused`),

    resumeMany: (rows: Campaign[]) =>
      runMany(rows.filter((c) => canToggle(c) && c.status === "PAUSED"), (c) => setStatus(c, "ACTIVE"), (n) => `${n} campaign${n === 1 ? "" : "s"} resumed`),

    duplicateMany: (rows: Campaign[]) =>
      runMany(rows, duplicateOne, (n) => (n === 1 ? "Copied — the duplicate is a draft, publish it when you're ready" : `${n} campaigns copied as drafts`)),

    /** PUT /campaigns/:id pushes budgets to Meta first and refuses what it can't reach. */
    setBudgets: (changes: { campaign: Campaign; budget: number }[]) => {
      const byId = new Map(changes.map((x) => [x.campaign.id, x.budget]));
      return runMany(
        changes.map((x) => x.campaign),
        (c) => api.updateCampaign(c.id, { budget: byId.get(c.id)! }),
        (n) => `${n} budget${n === 1 ? "" : "s"} updated`
      );
    },

    remove: async (c: Campaign) => {
      // Say plainly that this reaches Meta: deleting a live campaign stops real spend.
      const ok = await confirm({
        title: `Delete “${c.name}”?`,
        body: isLiveOnMeta(c)
          ? "This deletes the campaign on Meta too: its ad sets and ads stop delivering straight away. Its results here are removed as well. This can't be undone."
          : "This removes the campaign with its results and creative links. This can't be undone.",
        confirmLabel: isLiveOnMeta(c) ? "Delete here and on Meta" : "Delete",
        danger: true,
      });
      if (!ok) return;
      mark(c.id, true);
      try {
        await api.deleteCampaign(c.id);
        toast.success(isLiveOnMeta(c) ? "Campaign deleted here and on Meta" : "Campaign deleted");
        onMutate();
      } catch (err) {
        toast.error(errorText(err));
      } finally {
        mark(c.id, false);
      }
    },
  };
}
