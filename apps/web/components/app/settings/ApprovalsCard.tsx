"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { AlertTriangle, Check } from "lucide-react";
import { useApi } from "@/hooks/useApi";
import { useApiClient, type ApprovalTimeout } from "@/lib/api";
import { cn } from "@/lib/cn";
import { Button, Card, Segmented, Skeleton, Toggle } from "@/components/app/ui";
import { useAccess } from "@/components/app/team/access";
import { useApprovalSummary, useRefreshApprovals, waited } from "@/components/app/approvals/useApprovals";
import type { SettingsSaver } from "./types";

/**
 * Settings › AI & automation › Approvals (plan C1): which Media buyer changes
 * wait for an owner (budget raises past a limit, anything on an "Ask first"
 * client) and what happens to a request nobody answers within 24 hours.
 * Owners edit; everyone else sees the rules they work under.
 */

type Form = { limitOn: boolean; budgetPct: string; timeout: ApprovalTimeout; askFirst: string[] };

const TIMEOUTS: { value: ApprovalTimeout; label: string; desc: string }[] = [
  { value: "KEEP", label: "Keep pending", desc: "Requests wait until an owner decides. The Activity badge turns amber after 24 hours." },
  { value: "APPROVE", label: "Approve", desc: "After 24 hours the change is applied as the person who asked, and logged as approved automatically." },
  { value: "REJECT", label: "Reject", desc: "After 24 hours the request is turned down and the person who asked is told." },
];

const field = "h-10 w-24 rounded-ctl border border-line-2 bg-surface px-3 text-sm text-ink outline-none focus:border-brand focus:ring-[3px] focus:ring-brand-soft disabled:cursor-not-allowed disabled:bg-surface-2 disabled:text-ink-2";

export function ApprovalsCard({ setSaver }: { setSaver: (s: SettingsSaver | null) => void }) {
  const api = useApiClient();
  const access = useAccess();
  const canEdit = access.can("workspace");
  const q = useApi((c) => c.getApprovalSettings(), [], { key: "approval-settings" });
  const summary = useApprovalSummary();
  const refresh = useRefreshApprovals();
  const s = q.data;
  const initial = useMemo<Form | null>(
    () => (s ? { limitOn: s.budgetPct !== null, budgetPct: String(s.budgetPct ?? 20), timeout: s.timeout, askFirst: s.clients.filter((c) => c.askFirst).map((c) => c.id).sort() } : null),
    [s]
  );
  const [form, setForm] = useState<Form | null>(null);
  useEffect(() => setForm(initial), [initial]);

  const pct = Number(form?.budgetPct);
  const valid = !form?.limitOn || (Number.isInteger(pct) && pct >= 1 && pct <= 1000);
  const dirty = Boolean(form && initial && JSON.stringify(form) !== JSON.stringify(initial));

  useEffect(() => {
    if (!form || !initial) return setSaver(null);
    setSaver({
      dirty,
      disabled: !canEdit || !valid,
      reason: !canEdit ? access.why("workspace") : !valid ? "The budget limit is a whole number from 1 to 1000." : null,
      save: async () => {
        await api.saveApprovalSettings({ budgetPct: form.limitOn ? pct : null, timeout: form.timeout, askFirstClientIds: form.askFirst });
        await q.refetch();
        void refresh();
      },
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form, initial, dirty, canEdit, valid]);
  useEffect(() => () => setSaver(null), [setSaver]);

  if (q.error) {
    return (
      <Card className="flex flex-wrap items-center justify-between gap-3">
        <span className="text-sm text-neg">Couldn’t load the approval rules: {q.error}</span>
        <Button variant="secondary" size="sm" onClick={() => void q.refetch()}>
          Try again
        </Button>
      </Card>
    );
  }
  if (!form || !s) return <Skeleton className="h-[360px] rounded-card" />;
  const set = (p: Partial<Form>) => setForm((f) => (f ? { ...f, ...p } : f));
  const toggleClient = (id: string) => set({ askFirst: form.askFirst.includes(id) ? form.askFirst.filter((x) => x !== id) : [...form.askFirst, id].sort() });
  const sum = summary.data;

  return (
    <Card padded={false} className="flex flex-col gap-[18px] p-[22px]">
      <div className="flex flex-col gap-0.5">
        <span className="text-base font-semibold">Approvals</span>
        <span className="text-[13px] text-ink-2">
          Owners never wait. These Media buyer changes go to an owner first and show in{" "}
          <Link href="/activity" className="font-medium text-brand no-underline hover:text-brand-hover">
            Activity
          </Link>
          .{!canEdit && ` ${access.why("workspace")}`}
        </span>
      </div>

      {canEdit && sum && sum.pending > 0 && (
        <div role="status" className={cn("flex items-start gap-3 rounded-ctl border px-3.5 py-2.5 text-sm", sum.overdue ? "border-warn/40 bg-warn-soft" : "border-line bg-surface-2")}>
          <AlertTriangle size={16} className={cn("mt-0.5 flex-none", sum.overdue ? "text-warn" : "text-ink-3")} aria-hidden="true" />
          <span>
            {sum.pending} waiting for an owner{sum.oldestAt ? `, the oldest for ${waited(sum.oldestAt)}` : ""}.{" "}
            <Link href="/activity" className="font-semibold text-ink underline underline-offset-2">
              Review them
            </Link>
          </span>
        </div>
      )}

      <div className="flex flex-col gap-2.5 border-t border-line pt-4">
        <div className="flex items-center gap-3">
          <Toggle checked={form.limitOn} onChange={(v) => set({ limitOn: v })} label="Ask before big budget increases" disabled={!canEdit} />
          <span className="text-sm font-semibold">Big budget increases</span>
        </div>
        <div className={cn("flex flex-wrap items-center gap-2 pl-[46px] text-sm text-ink-2", !form.limitOn && "opacity-50")}>
          Ask an owner when a live Meta campaign’s budget goes up by more than
          <span className="inline-flex items-center gap-1.5">
            <input
              type="number"
              inputMode="numeric"
              min={1}
              max={1000}
              value={form.budgetPct}
              onChange={(e) => set({ budgetPct: e.target.value })}
              disabled={!canEdit || !form.limitOn}
              aria-label="Budget increase limit, percent"
              aria-invalid={!valid}
              className={cn(field, !valid && "border-neg")}
            />
            %
          </span>
          at once.
        </div>
      </div>

      <div className="flex flex-col gap-2.5 border-t border-line pt-4">
        <span className="text-sm font-semibold">“Ask first” clients</span>
        <span className="text-[13px] text-ink-2">Every change that affects spend on these clients (budget, status, schedule, targeting, launch, delete) waits for an owner. Drafts and renames don’t.</span>
        {s.clients.length === 0 ? (
          <span className="text-[13px] text-ink-3">No clients yet.</span>
        ) : (
          <div className="flex flex-wrap gap-2" role="group" aria-label="Ask first clients">
            {s.clients.map((c) => {
              const on = form.askFirst.includes(c.id);
              return (
                <button
                  key={c.id}
                  type="button"
                  aria-pressed={on}
                  disabled={!canEdit}
                  onClick={() => toggleClient(c.id)}
                  className={cn(
                    "inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-[13px] font-medium transition-colors disabled:cursor-not-allowed",
                    on ? "border-brand bg-brand-soft text-ink" : "border-line-2 bg-surface text-ink-2 enabled:hover:text-ink"
                  )}
                >
                  {on && <Check size={13} strokeWidth={3} className="text-brand" aria-hidden="true" />}
                  {c.name}
                </button>
              );
            })}
          </div>
        )}
      </div>

      <div className="flex flex-col gap-2.5 border-t border-line pt-4">
        <span className="text-sm font-semibold">If a request isn’t answered within 24 hours</span>
        <Segmented label="If a request isn't answered within 24 hours" value={form.timeout} onChange={(v) => canEdit && set({ timeout: v })} options={TIMEOUTS.map((t) => ({ value: t.value, label: t.label, disabled: !canEdit && t.value !== form.timeout }))} className="self-start" />
        <span className="text-[13px] text-ink-2">{TIMEOUTS.find((t) => t.value === form.timeout)?.desc}</span>
      </div>
    </Card>
  );
}
