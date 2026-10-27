"use client";

import { useState } from "react";
import Link from "next/link";
import toast from "react-hot-toast";
import { AlertTriangle, Clock } from "lucide-react";
import { useApi } from "@/hooks/useApi";
import { useApiClient, type Approval, type ApprovalStatus, type ChangeLogEntry } from "@/lib/api";
import { cn } from "@/lib/cn";
import { timeAgo } from "@/lib/time";
import { PageBody, PageHeader } from "@/components/app/shell/PageHeader";
import { useClientScope } from "@/components/app/shell/ClientContext";
import { Button, Card, Dialog, EmptyState, Pill, Segmented, Skeleton, useConfirm, type PillTone } from "@/components/app/ui";
import { OVERDUE_MS, useApprovalSummary, useRefreshApprovals, waited } from "@/components/app/approvals/useApprovals";

/**
 * Activity (plan C1): changes waiting for an owner's approval, recent
 * decisions, and the full change history with Undo. Owners approve or
 * reject; Media buyers see and can withdraw their own requests.
 */

type Tab = "waiting" | "decided" | "history";

const STATUS: Record<Exclude<ApprovalStatus, "PENDING">, { label: string; tone: PillTone }> = {
  APPROVED: { label: "Approved", tone: "pos" },
  REJECTED: { label: "Rejected", tone: "neg" },
  FAILED: { label: "Approved · failed", tone: "warn" },
  CANCELLED: { label: "Withdrawn", tone: "neutral" },
};

function Row({ a, children }: { a: Approval; children?: React.ReactNode }) {
  const overdue = a.status === "PENDING" && Date.now() - new Date(a.createdAt).getTime() > OVERDUE_MS;
  return (
    <li className={cn("flex flex-col gap-3 rounded-card border bg-surface p-4 min-[720px]:flex-row min-[720px]:items-center", overdue ? "border-warn/40" : "border-line")}>
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <span className="flex flex-wrap items-center gap-2">
          {a.campaignId ? (
            <Link href={`/campaigns/${a.campaignId}`} className="truncate font-semibold text-ink no-underline hover:text-brand">
              {a.campaignName}
            </Link>
          ) : (
            <span className="truncate font-semibold">{a.campaignName}</span>
          )}
          {a.clientName && <span className="text-xs text-ink-2">{a.clientName}</span>}
          {a.status !== "PENDING" && <Pill tone={STATUS[a.status].tone}>{STATUS[a.status].label}</Pill>}
          {overdue && (
            <Pill tone="warn">
              <Clock size={12} aria-hidden="true" /> Waiting {waited(a.createdAt)}
            </Pill>
          )}
        </span>
        <span className="text-sm">{a.summary}</span>
        <span className="text-[13px] text-ink-2">{a.reason}.</span>
        <span className="text-xs text-ink-3">
          Asked by {a.requestedBy ?? "a teammate"} · {timeAgo(a.createdAt)}
          {a.status !== "PENDING" && a.status !== "CANCELLED" && (
            <> · {a.decidedVia === "timeout" ? "decided automatically after 24 hours" : `decided by ${a.decidedBy ?? "an owner"}`}</>
          )}
        </span>
        {a.note && <span className="text-[13px] text-ink-2">Note: “{a.note}”</span>}
        {a.error && <span className="text-[13px] text-neg">It didn’t go through: {a.error}</span>}
      </div>
      {children && <div className="flex flex-none flex-wrap gap-2">{children}</div>}
    </li>
  );
}

export default function ActivityPage() {
  const api = useApiClient();
  const { clientId } = useClientScope();
  const [tab, setTab] = useState<Tab>("waiting");
  const [rejecting, setRejecting] = useState<Approval | null>(null);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const { confirm, dialog: confirmDialog } = useConfirm();
  const refresh = useRefreshApprovals();

  const summary = useApprovalSummary();
  const decides = summary.data?.decides ?? false;
  const waiting = useApi((c) => c.getApprovals("pending"), [], { key: "approvals-pending" });
  const decided = useApi((c) => (tab === "decided" ? c.getApprovals("decided") : new Promise<never>(() => {})), [tab], { key: "approvals-decided" });
  const history = useApi((c) => (tab === "history" ? c.getChangeLog({ clientId, limit: 50 }) : new Promise<never>(() => {})), [tab, clientId], { key: "activity-history" });

  // Activity follows the client switcher; the server already narrows by role.
  const inScope = (a: Approval) => !clientId || a.clientId === clientId;
  const pending = (waiting.data?.approvals ?? []).filter(inScope);

  const reload = () => void refresh();
  const run = async (key: string, fn: () => Promise<Approval>, done: (a: Approval) => string) => {
    setBusy(key);
    try {
      const a = await fn();
      a.status === "FAILED" ? toast.error(`Approved, but it didn’t go through: ${a.error ?? "the platform refused it"}`) : toast.success(done(a));
      reload();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "That didn't work. Try again.");
    } finally {
      setBusy(null);
    }
  };

  const approve = async (a: Approval) => {
    const ok = await confirm({ title: "Approve this change?", body: `${a.summary} on “${a.campaignName}”. It runs now, as ${a.requestedBy ?? "the person who asked"}, and can be undone for 7 days.`, confirmLabel: "Approve and apply" });
    if (ok) await run(a.id, () => api.approve(a.id), () => "Approved and applied");
  };
  const undo = async (e: ChangeLogEntry) => {
    if (!(await confirm({ title: "Undo this change?", body: e.summary, confirmLabel: "Undo" }))) return;
    setBusy(e.id);
    try {
      await api.undoChange(e.id);
      toast.success("Undone");
      void history.refetch();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't undo it.");
    } finally {
      setBusy(null);
    }
  };

  const s = summary.data;
  const headline = !s
    ? undefined
    : s.pending
      ? `${s.pending} ${decides ? "waiting for your approval" : `request${s.pending === 1 ? "" : "s"} waiting for an owner`}${s.oldestAt ? ` · oldest ${waited(s.oldestAt)}` : ""}`
      : decides
        ? "Nothing waiting for your approval"
        : "No requests waiting";

  return (
    <>
      <PageHeader
        kicker="Approvals and history"
        title="Activity"
        summary={headline}
        actions={
          decides ? (
            <Link href="/settings?tab=ai" className="text-sm font-semibold text-brand no-underline hover:text-brand-hover">
              Approval rules
            </Link>
          ) : undefined
        }
      />
      <PageBody className="gap-5">
        {decides && s && s.overdue > 0 && (
          <div role="status" className="flex items-start gap-3 rounded-card border border-warn/40 bg-warn-soft px-4 py-3 text-sm">
            <AlertTriangle size={18} className="mt-px flex-none text-warn" aria-hidden="true" />
            <span>
              <strong>
                {s.overdue} request{s.overdue === 1 ? " has" : "s have"} waited more than 24 hours.
              </strong>{" "}
              {s.timeout === "KEEP"
                ? "They stay pending until you decide."
                : s.timeout === "APPROVE"
                  ? "They're approved automatically within the next few minutes."
                  : "They're rejected automatically within the next few minutes."}{" "}
              <Link href="/settings?tab=ai" className="font-semibold text-ink underline underline-offset-2">
                Change the 24-hour rule
              </Link>
            </span>
          </div>
        )}

        <Segmented
          label="Activity"
          value={tab}
          onChange={setTab}
          options={[
            { value: "waiting", label: "Waiting", count: pending.length },
            { value: "decided", label: "Decided" },
            { value: "history", label: "Change history" },
          ]}
        />

        {tab === "waiting" &&
          (waiting.loading ? (
            <Skeleton className="h-32" />
          ) : pending.length === 0 ? (
            <Card>
              <EmptyState
                title={decides ? "Nothing waiting for your approval" : "No requests waiting"}
                body={
                  decides
                    ? "When a media buyer raises a budget past your limit, or changes an “Ask first” client, it waits here for you."
                    : "Big budget increases and changes to “Ask first” clients wait here for an owner."
                }
              />
            </Card>
          ) : (
            <ul className="m-0 flex list-none flex-col gap-3 p-0">
              {pending.map((a) => (
                <Row key={a.id} a={a}>
                  {decides ? (
                    <>
                      <Button variant="secondary" size="sm" disabled={busy !== null} onClick={() => (setNote(""), setRejecting(a))}>
                        Reject
                      </Button>
                      <Button variant="primary" size="sm" loading={busy === a.id} disabled={busy !== null && busy !== a.id} onClick={() => void approve(a)}>
                        Approve
                      </Button>
                    </>
                  ) : (
                    <Button variant="secondary" size="sm" loading={busy === a.id} disabled={busy !== null} onClick={() => void run(a.id, () => api.cancelApproval(a.id), () => "Request withdrawn")}>
                      Withdraw
                    </Button>
                  )}
                </Row>
              ))}
            </ul>
          ))}

        {tab === "decided" &&
          (decided.loading ? (
            <Skeleton className="h-32" />
          ) : (decided.data?.approvals ?? []).filter(inScope).length === 0 ? (
            <Card>
              <EmptyState title="No decisions yet" body="Approved, rejected and withdrawn requests show here." />
            </Card>
          ) : (
            <ul className="m-0 flex list-none flex-col gap-3 p-0">
              {(decided.data?.approvals ?? []).filter(inScope).map((a) => (
                <Row key={a.id} a={a} />
              ))}
            </ul>
          ))}

        {tab === "history" &&
          (history.loading ? (
            <Skeleton className="h-48" />
          ) : (history.data?.entries ?? []).length === 0 ? (
            <Card>
              <EmptyState title="No changes yet" body="Every change to a campaign, by a person, a suggestion or the platform, is recorded here." />
            </Card>
          ) : (
            <Card padded={false}>
              <ul className="m-0 list-none divide-y divide-line p-0">
                {(history.data?.entries ?? []).map((e) => (
                  <li key={e.id} className="flex items-center gap-3 px-4 py-3">
                    <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                      <span className="truncate text-sm">
                        <span className="font-semibold">{e.campaignName}</span> · {e.summary}
                      </span>
                      <span className="text-xs text-ink-3">
                        {e.actorType === "SYNC" ? "Changed outside Advertix" : e.actorName ?? "Someone"}
                        {e.approvalId && <> · approved {e.approvedByName ? `by ${e.approvedByName}` : "after 24 hours"}</>} · {timeAgo(e.createdAt)}
                        {e.undoneAt && <> · undone{e.undoneByName ? ` by ${e.undoneByName}` : ""}</>}
                      </span>
                    </span>
                    {e.canUndo && !e.undoneAt && (
                      <Button variant="ghost" size="sm" loading={busy === e.id} disabled={busy !== null} onClick={() => void undo(e)}>
                        Undo
                      </Button>
                    )}
                  </li>
                ))}
              </ul>
            </Card>
          ))}
      </PageBody>

      <Dialog
        open={rejecting !== null}
        onClose={() => setRejecting(null)}
        title="Reject this change?"
        sub={rejecting ? `${rejecting.summary} on “${rejecting.campaignName}”` : undefined}
        width={460}
        footer={
          <>
            <Button variant="secondary" onClick={() => setRejecting(null)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              loading={busy === rejecting?.id}
              onClick={() => {
                const a = rejecting!;
                setRejecting(null);
                void run(a.id, () => api.reject(a.id, note.trim() || undefined), () => "Rejected");
              }}
            >
              Reject
            </Button>
          </>
        }
      >
        <label className="flex flex-col gap-1.5 text-sm font-medium">
          Note for {rejecting?.requestedBy ?? "them"} <span className="font-normal text-ink-3">(optional)</span>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={3}
            maxLength={500}
            placeholder="e.g. The client wants to hold spend until the launch."
            className="rounded-ctl border border-line-2 bg-surface px-3 py-2 text-sm font-normal text-ink outline-none focus:border-brand focus:ring-[3px] focus:ring-brand-soft"
          />
        </label>
      </Dialog>
      {confirmDialog}
    </>
  );
}
