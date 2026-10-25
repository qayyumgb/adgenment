"use client";

import { useState } from "react";
import toast from "react-hot-toast";
import { MoreHorizontal } from "lucide-react";
import { useApiClient, type PlanDetail, type PlanSummary } from "@/lib/api";
import { timeAgo } from "@/lib/time";
import { Button, Dialog, IconButton, Menu, MenuItem, Pill, Skeleton, useConfirm } from "@/components/app/ui";

/**
 * Saved plans (plan A12, on the B5 Plan model): every plan the planner made
 * for the clients in scope, newest first. Open continues it; archive hides
 * it; delete removes it (drafts made from it stay).
 */
export function SavedPlansDialog({
  open,
  onClose,
  plans,
  loading,
  canEdit,
  onOpen,
  onChanged,
}: {
  open: boolean;
  onClose: () => void;
  plans: PlanSummary[];
  loading: boolean;
  canEdit: boolean;
  onOpen: (detail: PlanDetail) => void;
  onChanged: () => void;
}) {
  const api = useApiClient();
  const [busy, setBusy] = useState<string | null>(null);
  const { confirm, dialog: confirmDialog } = useConfirm();

  const openPlan = async (id: string) => {
    setBusy(id);
    try {
      onOpen(await api.getPlan(id));
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't open that plan.");
    } finally {
      setBusy(null);
    }
  };
  const archive = async (p: PlanSummary) => {
    try {
      await api.updatePlan(p.id, { status: "ARCHIVED" });
      toast.success("Plan archived");
      onChanged();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Didn't archive.");
    }
  };
  const remove = async (p: PlanSummary) => {
    if (!(await confirm({ title: `Delete “${p.title}”?`, body: "The plan and its versions are deleted. Drafts made from it stay in Campaigns.", confirmLabel: "Delete", danger: true }))) return;
    try {
      await api.deletePlan(p.id);
      toast.success("Plan deleted");
      onChanged();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Didn't delete.");
    }
  };

  return (
    <Dialog open={open} onClose={onClose} title="Saved plans" sub="Every plan Advertix drafted, with each refinement saved as a version." width={620}>
      {loading ? (
        <div className="flex flex-col gap-2">
          <Skeleton className="h-16" />
          <Skeleton className="h-16" />
        </div>
      ) : plans.length === 0 ? (
        <p className="rounded-xl bg-surface-2 p-4 text-sm text-ink-2">No saved plans yet. Plans save automatically as Advertix drafts them.</p>
      ) : (
        <ul className="flex flex-col divide-y divide-line">
          {plans.map((p) => (
            <li key={p.id} className="flex items-center gap-3 py-3">
              <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="truncate font-semibold">{p.title}</span>
                <span className="truncate text-[13px] text-ink-2">
                  {[p.clientName, `v${p.latestVersion}`, `updated ${timeAgo(p.updatedAt)}`].filter(Boolean).join(" · ")}
                </span>
              </div>
              {p.status === "USED" && <Pill tone="pos">Drafts created</Pill>}
              <Button variant="secondary" size="sm" loading={busy === p.id} onClick={() => void openPlan(p.id)}>
                Open
              </Button>
              {canEdit && (
                <Menu
                  align="end"
                  width={180}
                  trigger={(t) => (
                    <IconButton {...t} label={`More for ${p.title}`} size={32}>
                      <MoreHorizontal size={16} />
                    </IconButton>
                  )}
                >
                  {(close) => (
                    <>
                      <MenuItem onSelect={() => (close(), void archive(p))}>Archive</MenuItem>
                      <MenuItem onSelect={() => (close(), void remove(p))}>Delete</MenuItem>
                    </>
                  )}
                </Menu>
              )}
            </li>
          ))}
        </ul>
      )}
      {confirmDialog}
    </Dialog>
  );
}
