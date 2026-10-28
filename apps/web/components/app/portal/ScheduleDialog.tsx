"use client";

import { useEffect, useMemo, useState, type KeyboardEvent } from "react";
import toast from "react-hot-toast";
import { Send, X } from "lucide-react";
import { useApi } from "@/hooks/useApi";
import { useApiClient, type ReportFrequency, type ReportScheduleInput } from "@/lib/api";
import { cn } from "@/lib/cn";
import { timeAgo } from "@/lib/time";
import { Button, Dialog, Segmented, Skeleton, Toggle, useConfirm } from "@/components/app/ui";
import { useClientScope } from "@/components/app/shell/ClientContext";
import { useAccess } from "@/components/app/team/access";

/**
 * Schedule report (plan C4b, D5): a weekly or monthly email for one client
 * with the headline numbers, a PDF and the live report link. Recipients are
 * the client's people; replies come back to whoever set it up.
 */

type Form = Omit<ReportScheduleInput, "clientId">;
const DEFAULTS: Form = { frequency: "WEEKLY", recipients: [], showSpend: true, showRevenue: true, showCampaigns: true, attachPdf: true, active: true };
const WEEKDAY = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const EMAIL = /^[^\s@<>()",;]+@[^\s@<>()",;]+\.[^\s@<>()",;]{2,}$/;
const MAX = 10;

const nextLabel = (iso: string | null) => (iso ? new Date(`${iso}T00:00:00Z`).toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" }) : null);

/** Email chips: type or paste, Enter / comma / space to add, Backspace to remove the last. */
function Recipients({ value, onChange, disabled }: { value: string[]; onChange: (v: string[]) => void; disabled: boolean }) {
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const add = (raw: string) => {
    const parts = raw.split(/[\s,;]+/).map((x) => x.trim().toLowerCase()).filter(Boolean);
    if (!parts.length) return true;
    const badOne = parts.find((x) => !EMAIL.test(x));
    if (badOne) {
      setError(`“${badOne}” isn't an email address.`);
      return false;
    }
    const next = [...new Set([...value, ...parts])];
    if (next.length > MAX) {
      setError(`Up to ${MAX} recipients.`);
      return false;
    }
    onChange(next);
    setError(null);
    return true;
  };
  const onKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (["Enter", ",", ";", " ", "Tab"].includes(e.key) && draft.trim()) {
      if (e.key !== "Tab") e.preventDefault();
      if (add(draft)) setDraft("");
    } else if (e.key === "Backspace" && !draft && value.length) {
      onChange(value.slice(0, -1));
    }
  };
  return (
    <div className="flex flex-col gap-1.5">
      <div className={cn("flex min-h-10 flex-wrap items-center gap-1.5 rounded-ctl border bg-surface px-2 py-1.5 focus-within:border-brand focus-within:ring-[3px] focus-within:ring-brand-soft", error ? "border-neg" : "border-line-2", disabled && "bg-surface-2")}>
        {value.map((e) => (
          <span key={e} className="inline-flex h-7 items-center gap-1 rounded-full bg-surface-2 pl-2.5 pr-1 text-[13px]">
            {e}
            {!disabled && (
              <button type="button" aria-label={`Remove ${e}`} onClick={() => onChange(value.filter((x) => x !== e))} className="inline-flex h-5 w-5 items-center justify-center rounded-full text-ink-3 hover:bg-surface-3 hover:text-ink">
                <X size={12} />
              </button>
            )}
          </span>
        ))}
        <input
          value={draft}
          onChange={(e) => (setDraft(e.target.value), setError(null))}
          onKeyDown={onKey}
          onBlur={() => draft.trim() && add(draft) && setDraft("")}
          onPaste={(e) => {
            const text = e.clipboardData.getData("text");
            if (/[\s,;]/.test(text)) {
              e.preventDefault();
              if (add(text)) setDraft("");
            }
          }}
          disabled={disabled}
          aria-label="Recipients"
          aria-invalid={Boolean(error)}
          placeholder={value.length ? "" : "name@client.com"}
          className="h-7 min-w-[160px] flex-1 bg-transparent px-1 text-sm text-ink outline-none placeholder:text-ink-3"
        />
      </div>
      <span className={cn("text-xs", error ? "text-neg" : "text-ink-3")}>{error ?? "Press Enter or comma after each address. Up to 10."}</span>
    </div>
  );
}

export function ScheduleDialog({ open, onClose, onShare }: { open: boolean; onClose: () => void; onShare: () => void }) {
  const api = useApiClient();
  const access = useAccess();
  const canEdit = access.can("edit");
  const scope = useClientScope();
  const agency = useApi((c) => c.getMe(), [], { key: "me" }).data?.workspace?.name ?? "your agency";
  const [clientId, setClientId] = useState<string | null>(null);
  const [form, setForm] = useState<Form>(DEFAULTS);
  const [busy, setBusy] = useState<"save" | "test" | "off" | null>(null);
  const { confirm, dialog } = useConfirm();

  useEffect(() => {
    if (open) setClientId(scope.clientId ?? (scope.clients.length === 1 ? scope.clients[0].id : null));
  }, [open, scope.clientId, scope.clients]);
  const q = useApi((c) => (open && clientId ? c.getReportSchedule(clientId) : new Promise<never>(() => {})), [open, clientId], { key: "report-schedule" });
  const info = q.data;
  const saved = info?.schedule ?? null;
  const initial = useMemo<Form>(() => (saved ? { frequency: saved.frequency, recipients: saved.recipients, showSpend: saved.showSpend, showRevenue: saved.showRevenue, showCampaigns: saved.showCampaigns, attachPdf: saved.attachPdf, active: true } : DEFAULTS), [saved]);
  useEffect(() => setForm(initial), [initial]);
  const dirty = JSON.stringify(form) !== JSON.stringify(initial) || (saved !== null && !saved.active);
  const name = scope.clients.find((c) => c.id === clientId)?.name ?? "this client";
  const set = (p: Partial<Form>) => setForm((f) => ({ ...f, ...p }));
  const when = (f: ReportFrequency) => (f === "WEEKLY" ? `Every ${WEEKDAY[info?.weekStartsOn ?? 1]} at 09:00, for the week before` : "On the 1st at 09:00, for the month before");

  const close = async () => {
    if (dirty && form.recipients.length && !(await confirm({ title: "Close without saving?", body: "Your changes to this schedule aren't saved.", confirmLabel: "Close", cancelLabel: "Keep editing", danger: true }))) return;
    onClose();
  };
  const save = async () => {
    if (!clientId) return;
    setBusy("save");
    try {
      await api.saveReportSchedule({ clientId, ...form, active: true });
      await q.refetch();
      toast.success(`Scheduled. ${name}'s report goes out ${form.frequency === "WEEKLY" ? "weekly" : "monthly"}.`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't save the schedule.");
    } finally {
      setBusy(null);
    }
  };
  const test = async () => {
    if (!clientId) return;
    setBusy("test");
    try {
      const r = await api.sendTestReport({ clientId, ...form, active: true });
      toast.success(`Test sent to ${r.sentTo}. It shows exactly what ${name} will get.`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "The test didn't send.");
    } finally {
      setBusy(null);
    }
  };
  const turnOff = async () => {
    if (!clientId || !saved || !(await confirm({ title: "Stop this report?", body: `${name} won't get scheduled reports any more. Your settings are kept if you turn it back on.`, confirmLabel: "Stop sending", danger: true }))) return;
    setBusy("off");
    try {
      await api.saveReportSchedule({ clientId, ...initial, active: false });
      await q.refetch();
      toast.success("Report stopped");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't stop it.");
    } finally {
      setBusy(null);
    }
  };

  const live = saved?.active;
  const status = !saved
    ? null
    : !saved.active
      ? "Stopped. Save to start it again."
      : `${saved.nextDate ? `Next report ${nextLabel(saved.nextDate)}, 09:00 (${info?.timezone})` : "Scheduled"}${saved.lastSentAt ? ` · last sent ${timeAgo(saved.lastSentAt)}` : ""}`;
  const switches: { key: "showSpend" | "showRevenue" | "showCampaigns" | "attachPdf"; label: string; sub: string }[] = [
    { key: "showSpend", label: "Spend", sub: "Spend, cost per result and this month's budget" },
    { key: "showRevenue", label: "Revenue", sub: "Revenue, and ROAS when spend is shown too" },
    { key: "showCampaigns", label: "Campaigns", sub: "The top campaigns and their results" },
    { key: "attachPdf", label: "Attach a PDF", sub: "A one-page report they can file or forward" },
  ];

  return (
    <Dialog
      open={open}
      onClose={() => void close()}
      title="Schedule report"
      sub={clientId ? `An email to ${name} with their numbers, a PDF and the live report link.` : "Pick the client to report to."}
      width={560}
      footer={
        <>
          {live && canEdit && (
            <Button variant="ghost" onClick={() => void turnOff()} loading={busy === "off"} disabled={busy !== null} className="mr-auto">
              Stop sending
            </Button>
          )}
          <Button variant="secondary" icon={<Send size={15} />} onClick={() => void test()} loading={busy === "test"} disabled={!clientId || !canEdit || busy !== null || info?.emailConfigured === false} title="Sends this report to you only">
            Send me a test
          </Button>
          <Button variant="primary" onClick={() => void save()} loading={busy === "save"} disabled={!clientId || !canEdit || busy !== null || !form.recipients.length || (live && !dirty)} title={!canEdit ? access.why("edit") ?? undefined : !form.recipients.length ? "Add at least one recipient" : undefined}>
            {live ? "Save changes" : "Schedule"}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        {!scope.clientId && scope.clients.length > 1 && (
          <label className="flex flex-col gap-1.5 text-[13px] font-medium text-ink-2">
            Client
            <select value={clientId ?? ""} onChange={(e) => setClientId(e.target.value || null)} className="h-10 rounded-ctl border border-line-2 bg-surface px-3 text-sm text-ink outline-none focus:border-brand focus:ring-[3px] focus:ring-brand-soft">
              <option value="">Choose a client…</option>
              {scope.clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
        )}

        {clientId &&
          (q.loading || !info ? (
            <Skeleton className="h-64" />
          ) : (
            <>
              {!info.emailConfigured && <div className="rounded-ctl bg-warn-soft px-3.5 py-2.5 text-[13px]">Email isn’t set up on the server yet (RESEND_API_KEY), so reports can’t be sent.</div>}
              {status && <div className={cn("rounded-ctl px-3.5 py-2.5 text-[13px]", saved?.lastError ? "bg-warn-soft" : "bg-surface-2 text-ink-2")}>{saved?.lastError ? `The last report didn't send: ${saved.lastError}` : status}</div>}

              <div className="flex flex-col gap-1.5">
                <span className="text-[13px] font-medium text-ink-2">Send to</span>
                <Recipients value={form.recipients} onChange={(v) => set({ recipients: v })} disabled={!canEdit} />
              </div>

              <div className="flex flex-col gap-1.5">
                <span className="text-[13px] font-medium text-ink-2">How often</span>
                <Segmented
                  label="How often"
                  value={form.frequency}
                  onChange={(v) => canEdit && set({ frequency: v })}
                  options={[
                    { value: "WEEKLY", label: "Weekly" },
                    { value: "MONTHLY", label: "Monthly" },
                  ]}
                  className="self-start"
                />
                <span className="text-xs text-ink-3">
                  {when(form.frequency)} ({info.timezone}). Change the time zone or week start in Settings › General.
                </span>
              </div>

              <div className="flex flex-col divide-y divide-line rounded-ctl border border-line">
                {switches.map((s) => (
                  <div key={s.key} className="flex items-center gap-3 px-3.5 py-3">
                    <span className="flex min-w-0 flex-1 flex-col">
                      <span className="text-sm font-medium">{s.label}</span>
                      <span className="text-xs text-ink-2">{s.sub}</span>
                    </span>
                    <Toggle checked={form[s.key]} onChange={(v) => set({ [s.key]: v })} label={s.label} disabled={!canEdit} />
                  </div>
                ))}
              </div>

              <p className="m-0 text-[13px] text-ink-2">
                {info.hasShareLink ? (
                  "The email links to the live report you shared."
                ) : (
                  <>
                    To include a live report link,{" "}
                    <button type="button" onClick={onShare} className="font-semibold text-brand hover:text-brand-hover">
                      share the report
                    </button>{" "}
                    first.
                  </>
                )}{" "}
                It comes from “{agency} via Advertix”, and replies go to you.
              </p>
            </>
          ))}
      </div>
      {dialog}
    </Dialog>
  );
}
