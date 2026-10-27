"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { PauseCircle } from "lucide-react";
import { useApi } from "@/hooks/useApi";
import { useApiClient } from "@/lib/api";
import { cn } from "@/lib/cn";
import { Button, Card, Skeleton, Toggle } from "@/components/app/ui";
import { useAccess } from "@/components/app/team/access";
import type { SettingsSaver } from "./types";

/**
 * Settings › AI & automation › Automation: what Advertix may do on its own,
 * per client and off until turned on. Auto-apply small changes (plan C13) and
 * the two safety rules (C14), their limits, and "Pause all automation".
 * Owners edit; others read.
 */

type Row = { id: string; name: string; pixel: boolean; cap: boolean; autoApply: boolean; askFirst: boolean; hasMonthlyBudget: boolean };
type Form = { maxCutPct: string; autoApplyMaxPct: string; automationPaused: boolean; clients: Row[] };

const field = "h-10 w-20 rounded-ctl border border-line-2 bg-surface px-3 text-sm text-ink outline-none focus:border-brand focus:ring-[3px] focus:ring-brand-soft disabled:cursor-not-allowed disabled:bg-surface-2 disabled:text-ink-2";
const cols = "grid grid-cols-[minmax(120px,1fr)_repeat(3,minmax(64px,84px))] items-center gap-2";

function Pct({ value, onChange, max, label, disabled, invalid }: { value: string; onChange: (v: string) => void; max: number; label: string; disabled: boolean; invalid: boolean }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <input type="number" inputMode="numeric" min={1} max={max} value={value} onChange={(e) => onChange(e.target.value)} disabled={disabled} aria-label={label} aria-invalid={invalid} className={cn(field, invalid && "border-neg")} />%
    </span>
  );
}

/** `picked`: a level chosen at the top of the tab, applied to every client that allows it (`n` changes on each pick). */
export function SafetyCard({ setSaver, picked }: { setSaver: (s: SettingsSaver | null) => void; picked?: { autoApply: boolean; n: number } | null }) {
  const api = useApiClient();
  const access = useAccess();
  const canEdit = access.can("workspace");
  const q = useApi((c) => c.getSafetySettings(), [], { key: "safety-settings" });
  const s = q.data;
  const initial = useMemo<Form | null>(() => (s ? { maxCutPct: String(s.maxCutPct), autoApplyMaxPct: String(s.autoApplyMaxPct), automationPaused: s.automationPaused, clients: s.clients } : null), [s]);
  const [form, setForm] = useState<Form | null>(null);
  useEffect(() => setForm(initial), [initial]);
  useEffect(() => {
    if (!picked) return;
    setForm((f) => (f ? { ...f, clients: f.clients.map((c) => (c.askFirst ? c : { ...c, autoApply: picked.autoApply })) } : f));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [picked?.n]);

  const cut = Number(form?.maxCutPct);
  const auto = Number(form?.autoApplyMaxPct);
  const cutOk = Number.isInteger(cut) && cut >= 1 && cut <= 50;
  const autoOk = Number.isInteger(auto) && auto >= 1 && auto <= 30;
  const dirty = Boolean(form && initial && JSON.stringify(form) !== JSON.stringify(initial));

  useEffect(() => {
    if (!form || !initial) return setSaver(null);
    setSaver({
      dirty,
      disabled: !canEdit || !cutOk || !autoOk,
      reason: !canEdit ? access.why("workspace") : !autoOk ? "The auto-apply limit is a whole number from 1 to 30." : !cutOk ? "The largest daily cut is a whole number from 1 to 50." : null,
      save: async () => {
        await api.saveSafetySettings({ maxCutPct: cut, autoApplyMaxPct: auto, automationPaused: form.automationPaused, clients: form.clients.map(({ id, pixel, cap, autoApply }) => ({ id, pixel, cap, autoApply })) });
        await q.refetch();
      },
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form, initial, dirty, canEdit, cutOk, autoOk]);
  useEffect(() => () => setSaver(null), [setSaver]);

  if (q.error) {
    return (
      <Card className="flex flex-wrap items-center justify-between gap-3">
        <span className="text-sm text-neg">Couldn’t load the automation settings: {q.error}</span>
        <Button variant="secondary" size="sm" onClick={() => void q.refetch()}>
          Try again
        </Button>
      </Card>
    );
  }
  if (!form || !s) return <Skeleton className="h-[360px] rounded-card" />;
  const set = (p: Partial<Form>) => setForm((f) => (f ? { ...f, ...p } : f));
  const setClient = (id: string, p: Partial<Row>) => set({ clients: form.clients.map((c) => (c.id === id ? { ...c, ...p } : c)) });
  const off = form.automationPaused;

  return (
    <Card padded={false} id="automation" className="flex flex-col gap-[18px] p-[22px]">
      <div className="flex flex-col gap-0.5">
        <span className="text-base font-semibold">Automation</span>
        <span className="text-[13px] text-ink-2">
          What Advertix may do on its own, per client. Every automatic change is logged in{" "}
          <Link href="/activity" className="font-medium text-brand no-underline hover:text-brand-hover">
            Activity
          </Link>{" "}
          (Undo for 7 days) and emailed to owners and media buyers, and anything someone undoes isn’t done again. Meta campaigns only.{!canEdit && ` ${access.why("workspace")}`}
        </span>
      </div>

      <div className={cn("flex items-start gap-3 rounded-ctl border px-3.5 py-3", off ? "border-warn/40 bg-warn-soft" : "border-line bg-surface-2")}>
        <Toggle checked={off} onChange={(v) => set({ automationPaused: v })} label="Pause all automation" disabled={!canEdit} className="mt-0.5" />
        <span className="flex flex-col gap-0.5">
          <span className="flex items-center gap-1.5 text-sm font-semibold">
            {off && <PauseCircle size={15} className="text-warn" aria-hidden="true" />}
            Pause all automation
          </span>
          <span className="text-[13px] text-ink-2">{off ? "Nothing changes on its own until you switch this off. Your choices are kept." : "Stops auto-apply and every safety rule at once, without losing your choices below."}</span>
        </span>
      </div>

      <ul className="m-0 flex list-none flex-col gap-2 p-0 text-[13px] text-ink-2">
        <li>
          <strong className="text-ink">Auto-apply small changes:</strong> budget suggestions that move a daily budget by at most the limit below apply on their own, one move per campaign per day. Everything else still waits for a click. Not available for “Ask first” clients.
        </li>
        <li>
          <strong className="text-ink">Pixel stopped firing:</strong> when no Meta Pixel on the client’s ad account has had an event for 24 hours, its active conversion campaigns are paused, and resumed once the pixel fires again (unless someone changed them meanwhile).
        </li>
        <li>
          <strong className="text-ink">Monthly budget running out:</strong> from the 5th, when a client is on pace to overspend its monthly budget, its Meta daily budgets are lowered so the rest of the month fits, once a day and by at most the cut below. Budgets are never raised, and auto-apply won’t raise them either while this holds.
        </li>
      </ul>

      <div className={cn("overflow-x-auto rounded-ctl border border-line", off && "opacity-60")}>
        <div className="min-w-[420px]">
          <div className={cn(cols, "bg-surface-2 px-4 py-2.5 text-xs font-medium text-ink-2")}>
            <span>Client</span>
            <span className="text-center">Auto-apply</span>
            <span className="text-center">Pixel</span>
            <span className="text-center">Monthly cap</span>
          </div>
          {form.clients.length === 0 ? (
            <p className="m-0 border-t border-line px-4 py-3 text-[13px] text-ink-3">No clients yet.</p>
          ) : (
            form.clients.map((c) => (
              <div key={c.id} className={cn(cols, "border-t border-line px-4 py-3")}>
                <span className="flex min-w-0 flex-col">
                  <span className="truncate text-sm font-medium">{c.name}</span>
                  {c.askFirst && <span className="text-xs text-ink-3">“Ask first” is on, so auto-apply is off. Turn it off in Approvals above to use auto-apply.</span>}
                  {!c.hasMonthlyBudget && (
                    <span className="text-xs text-ink-3">
                      No monthly budget.{" "}
                      <Link href="/budgets" className="text-brand no-underline hover:text-brand-hover">
                        Set one
                      </Link>
                    </span>
                  )}
                </span>
                <Toggle checked={c.autoApply && !c.askFirst} onChange={(v) => setClient(c.id, { autoApply: v })} label={`Auto-apply small changes for ${c.name}`} disabled={!canEdit || c.askFirst} className="mx-auto" />
                <Toggle checked={c.pixel} onChange={(v) => setClient(c.id, { pixel: v })} label={`Pixel rule for ${c.name}`} disabled={!canEdit} className="mx-auto" />
                <Toggle checked={c.cap} onChange={(v) => setClient(c.id, { cap: v })} label={`Monthly cap rule for ${c.name}`} disabled={!canEdit || (!c.hasMonthlyBudget && !c.cap)} className="mx-auto" />
              </div>
            ))
          )}
        </div>
      </div>

      <div className="flex flex-col gap-2.5 text-sm text-ink-2">
        <span className="flex flex-wrap items-center gap-2">
          Auto-apply moves a daily budget by at most
          <Pct value={form.autoApplyMaxPct} onChange={(v) => set({ autoApplyMaxPct: v })} max={30} label="Auto-apply limit, percent" disabled={!canEdit} invalid={!autoOk} />
          at a time.
        </span>
        <span className="flex flex-wrap items-center gap-2">
          The monthly cap rule lowers a daily budget by at most
          <Pct value={form.maxCutPct} onChange={(v) => set({ maxCutPct: v })} max={50} label="Largest daily cut, percent" disabled={!canEdit} invalid={!cutOk} />
          a day.
        </span>
      </div>
    </Card>
  );
}
