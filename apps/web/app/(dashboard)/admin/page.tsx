"use client";

import { useState } from "react";
import toast from "react-hot-toast";
import { ShieldAlert, Trash2, Undo2 } from "lucide-react";
import { useApi } from "@/hooks/useApi";
import { useApiClient, type AdminWorkspace, type WorkspaceDeletionRecord } from "@/lib/api";
import { PageBody, PageHeader } from "@/components/app/shell/PageHeader";
import { Button, Card, Dialog, EmptyState, Pill, Segmented, Skeleton, useConfirm, type PillTone } from "@/components/app/ui";
import { UsersPanel } from "@/components/app/admin/UsersPanel";

/**
 * Superadmin: Users (everyone who signed up: leads, how far they got, what
 * they did) and Workspaces (plan C15b: locked workspaces and their deletion).
 * Only users listed in SUPERADMIN_EMAILS / SUPERADMIN_CLERK_IDS on the server
 * see it (the API answers 404 to everyone else). The retention rules are the
 * API's (services/retention.service.ts): access removed at 30 days locked,
 * deletion from 30 days with 7 days' notice, automatic at 6 months; choosing
 * a plan cancels any deletion.
 */

const date = (iso: string) => new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
const TIER: Record<string, string> = { FOUNDER: "Founder", TEAM: "Team", AGENCY: "Agency", ENTERPRISE: "Enterprise" };

function stateOf(w: AdminWorkspace): { tone: PillTone; label: string } {
  if (w.locked) return { tone: "warn", label: w.lockedDays !== null ? `Locked ${w.lockedDays} day${w.lockedDays === 1 ? "" : "s"}` : "Locked" };
  if (w.state === "TRIAL") return { tone: "brand", label: w.trialEndsAt ? `Trial until ${date(w.trialEndsAt)}` : "Trial" };
  if (w.state === "PAST_DUE") return { tone: "warn", label: `${w.tier ? TIER[w.tier] : "Paid"} · payment failed` };
  return { tone: "pos", label: w.tier ? TIER[w.tier] : "Active" };
}

function DeleteDialog({ w, onClose, onDone }: { w: AdminWorkspace | null; onClose: () => void; onDone: () => void }) {
  const api = useApiClient();
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const close = () => {
    setName("");
    onClose();
  };
  const when = new Date(Date.now() + 7 * 86_400_000);
  const go = async () => {
    if (!w) return;
    setBusy(true);
    try {
      const r = await api.adminDeleteWorkspace(w.id, name);
      toast.success(`${w.name} will be deleted on ${date(r.deletionScheduledAt)}. The owners were emailed.`);
      setName("");
      onDone();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't schedule the deletion.");
    } finally {
      setBusy(false);
    }
  };
  return (
    <Dialog
      open={Boolean(w)}
      onClose={close}
      title="Delete this workspace?"
      sub={w ? `${w.name}${w.ownerEmail ? ` · ${w.ownerEmail}` : ""}` : undefined}
      width={520}
      footer={
        <>
          <Button variant="secondary" onClick={close}>
            Cancel
          </Button>
          <Button variant="danger" icon={<Trash2 size={15} />} loading={busy} disabled={!w || name.trim() !== w.name.trim()} onClick={() => void go()}>
            Schedule deletion
          </Button>
        </>
      }
    >
      {w && (
        <div className="flex flex-col gap-3 text-sm">
          <p className="m-0 text-ink-2">
            The owners get an email now. On <strong className="text-ink">{date(when.toISOString())}</strong> the workspace and everything in it is deleted (clients, synced data, campaigns, creatives, reports, settings), unless they choose a plan before then. Logins, Stripe invoices and the ads on the platforms stay. After that date it can&apos;t be undone.
          </p>
          <label className="flex flex-col gap-1.5">
            <span className="text-[13px] font-medium">
              Type <strong>{w.name}</strong> to confirm
            </span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoComplete="off"
              className="h-10 rounded-ctl border border-line-2 bg-surface px-3 text-sm text-ink outline-none focus:border-brand focus:ring-[3px] focus:ring-brand-soft"
            />
          </label>
        </div>
      )}
    </Dialog>
  );
}

function Row({ w, onDelete, onCancel, busy }: { w: AdminWorkspace; onDelete: () => void; onCancel: () => void; busy: boolean }) {
  const s = stateOf(w);
  return (
    <li className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-line px-5 py-3.5 last:border-b-0">
      <span className="flex min-w-0 flex-[1_1_260px] flex-col">
        <span className="truncate font-semibold">{w.name}</span>
        <span className="truncate text-xs text-ink-3">
          {w.ownerEmail ?? "No owner"} · {w.clients} client{w.clients === 1 ? "" : "s"} · {w.adAccounts} ad account{w.adAccounts === 1 ? "" : "s"} · {w.members} member{w.members === 1 ? "" : "s"} · since {date(w.createdAt)}
        </span>
      </span>
      <span className="flex flex-wrap items-center gap-1.5">
        <Pill tone={s.tone}>{s.label}</Pill>
        {w.accessRemovedAt && <Pill tone="muted">Ad access removed {date(w.accessRemovedAt)}</Pill>}
        {w.deletionScheduledAt && (
          <Pill tone="neg">
            Deletes {date(w.deletionScheduledAt)}
            {w.deletionReason === "auto" ? " · automatic" : ""}
          </Pill>
        )}
      </span>
      <span className="flex flex-none items-center gap-2">
        {w.deletionScheduledAt ? (
          <Button variant="secondary" size="sm" icon={<Undo2 size={14} />} loading={busy} onClick={onCancel}>
            Cancel deletion
          </Button>
        ) : (
          <span title={w.canDelete ? undefined : w.locked ? "Available once it has been locked for 30 days." : "Only locked workspaces can be deleted."}>
            <Button variant="ghost" size="sm" icon={<Trash2 size={14} />} disabled={!w.canDelete} onClick={onDelete}>
              Delete
            </Button>
          </span>
        )}
      </span>
    </li>
  );
}

function History({ rows }: { rows: WorkspaceDeletionRecord[] }) {
  if (!rows.length) return null;
  return (
    <Card padded={false} className="flex flex-col">
      <div className="border-b border-line px-5 py-4">
        <span className="text-base font-semibold">Deletion history</span>
        <span className="block text-[13px] text-ink-2">Every deletion scheduled here or by the 6-month rule. Kept after the workspace is gone.</span>
      </div>
      <ul className="m-0 list-none p-0">
        {rows.map((d) => (
          <li key={d.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 border-b border-line px-5 py-3 text-[13px] last:border-b-0">
            <span className="min-w-0 flex-[1_1_240px]">
              <span className="font-semibold">{d.workspaceName}</span>
              <span className="text-ink-3"> · {d.ownerEmail ?? "no owner"}</span>
            </span>
            <span className="text-ink-2">{d.reason === "auto" ? "6 months locked" : `By ${d.requestedBy ?? "superadmin"}`} · set {date(d.createdAt)} for {date(d.scheduledFor)}</span>
            <Pill tone={d.deletedAt ? "neg" : d.cancelledAt ? "muted" : "warn"}>
              {d.deletedAt ? `Deleted ${date(d.deletedAt)}` : d.cancelledAt ? (d.cancelledBy === "paid" ? "Cancelled · chose a plan" : `Cancelled by ${d.cancelledBy}`) : "Scheduled"}
            </Pill>
          </li>
        ))}
      </ul>
    </Card>
  );
}

export default function AdminPage() {
  const api = useApiClient();
  const me = useApi((c) => c.getMe(), [], { key: "me" });
  const allowed = me.data?.superadmin === true;
  const [view, setView] = useState<"users" | "workspaces">("users");
  const [filter, setFilter] = useState<"locked" | "all">("locked");
  const wsOn = allowed && view === "workspaces";
  const q = useApi((c) => (wsOn ? c.getAdminWorkspaces(filter) : new Promise<never>(() => {})), [wsOn, filter], { key: "admin-workspaces", keepPrevious: true });
  const h = useApi((c) => (wsOn ? c.getAdminDeletions() : new Promise<never>(() => {})), [wsOn], { key: "admin-deletions" });
  const [deleting, setDeleting] = useState<AdminWorkspace | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const { confirm, dialog } = useConfirm();
  const refresh = () => Promise.all([q.refetch(), h.refetch()]);

  if (me.loading) return <PageBody><Skeleton className="h-64 rounded-card" /></PageBody>;
  if (!allowed) {
    return (
      <PageBody>
        <EmptyState title="Page not found" body="This page doesn't exist, or you don't have access to it." />
      </PageBody>
    );
  }

  const list = q.data?.workspaces ?? [];
  const scheduled = list.filter((w) => w.deletionScheduledAt).length;
  const cancelDeletion = async (w: AdminWorkspace) => {
    if (!(await confirm({ title: `Keep ${w.name}?`, body: w.deletionReason === "auto" ? "The deletion is cancelled and the 6-month clock starts again from today." : "The deletion is cancelled. You can schedule it again later.", confirmLabel: "Cancel deletion" }))) return;
    setBusy(w.id);
    try {
      await api.adminCancelDeletion(w.id);
      toast.success(`${w.name} won't be deleted`);
      await refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't cancel it.");
    } finally {
      setBusy(null);
    }
  };

  const tabs = <Segmented<"users" | "workspaces"> label="View" value={view} onChange={setView} options={[{ value: "users", label: "Users" }, { value: "workspaces", label: "Workspaces" }]} />;

  if (view === "users") {
    return (
      <>
        <PageHeader kicker="Superadmin" title="Users" summary="Everyone who signed up, how far they got and what they did." actions={tabs} />
        <PageBody className="max-w-[1280px] gap-4">
          <UsersPanel />
        </PageBody>
      </>
    );
  }

  return (
    <>
      <PageHeader
        kicker="Superadmin"
        title="Workspaces"
        summary={filter === "locked" ? `${list.length} locked${scheduled ? ` · ${scheduled} set to be deleted` : ""}` : `${list.length} workspaces`}
        actions={
          <span className="flex flex-wrap items-center gap-2">
            {tabs}
            <Segmented<"locked" | "all"> label="Show" value={filter} onChange={setFilter} options={[{ value: "locked", label: "Locked" }, { value: "all", label: "All" }]} />
          </span>
        }
      />
      <PageBody className="max-w-[1080px] gap-4">
        <div className="flex items-start gap-3 rounded-card border border-line bg-surface-2 px-4 py-3 text-[13px] text-ink-2">
          <ShieldAlert size={16} className="mt-0.5 flex-none text-ink-3" aria-hidden="true" />
          <span>
            Locked = the trial ended without a plan. After <strong className="text-ink">30 days</strong> locked, the stored ad access is removed and you can delete a workspace (owners get <strong className="text-ink">7 days&apos;</strong> notice). After <strong className="text-ink">6 months</strong> it&apos;s deleted automatically, with emails 10, 5 and 2 days before. Choosing a plan cancels any deletion.
          </span>
        </div>
        {q.loading && !q.data ? (
          <Skeleton className="h-64 rounded-card" />
        ) : q.error && !q.data ? (
          <Card>
            <EmptyState title="Workspaces didn't load" body={q.error} />
          </Card>
        ) : list.length === 0 ? (
          <Card>
            <EmptyState title={filter === "locked" ? "No locked workspaces" : "No workspaces"} body={filter === "locked" ? "Every workspace is on a trial or a plan." : undefined} />
          </Card>
        ) : (
          <Card padded={false}>
            <ul className="m-0 list-none p-0">
              {list.map((w) => (
                <Row key={w.id} w={w} busy={busy === w.id} onDelete={() => setDeleting(w)} onCancel={() => void cancelDeletion(w)} />
              ))}
            </ul>
          </Card>
        )}
        <History rows={h.data?.deletions ?? []} />
      </PageBody>
      <DeleteDialog
        w={deleting}
        onClose={() => setDeleting(null)}
        onDone={() => {
          setDeleting(null);
          void refresh();
        }}
      />
      {dialog}
    </>
  );
}
