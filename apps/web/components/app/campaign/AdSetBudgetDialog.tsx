"use client";

import { useEffect, useState } from "react";
import type { CampaignAdSet } from "@/lib/api";
import { fmtMoney } from "@/lib/money";
import { Button, Dialog } from "@/components/app/ui";

/** Change one ad set's daily budget on Meta (the change log keeps an Undo). */
export function AdSetBudgetDialog({
  adSet,
  currency,
  minDailyBudget,
  onClose,
  onSave,
}: {
  adSet: CampaignAdSet | null;
  currency: string | null;
  minDailyBudget: number | null;
  onClose: () => void;
  onSave: (s: CampaignAdSet, amount: number) => Promise<boolean>;
}) {
  const [value, setValue] = useState("");
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    if (adSet) setValue(adSet.dailyBudget ? String(adSet.dailyBudget) : "");
  }, [adSet]);

  const n = Number(value);
  const floor = minDailyBudget && minDailyBudget > 0 ? minDailyBudget : 1;
  const error = value.trim() === "" ? null : !Number.isFinite(n) || n <= 0 ? "Enter a budget above zero." : n < floor ? `The minimum for this account is ${fmtMoney(floor, currency)} a day.` : null;
  const changed = adSet !== null && Number.isFinite(n) && Math.abs(n - (adSet.dailyBudget ?? 0)) >= 0.01;

  const save = async () => {
    if (!adSet) return;
    setSaving(true);
    const ok = await onSave(adSet, Math.round(n * 100) / 100);
    setSaving(false);
    if (ok) onClose();
  };

  return (
    <Dialog
      open={adSet !== null}
      onClose={onClose}
      title="Daily budget"
      sub={adSet?.name}
      width={440}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" onClick={save} loading={saving} disabled={!changed || Boolean(error) || value.trim() === ""}>
            Update on Meta
          </Button>
        </>
      }
    >
      <label className="flex flex-col gap-1.5 text-sm font-medium">
        New daily budget
        <span className="flex h-10 items-center gap-2 rounded-ctl border border-line-2 bg-surface px-3 focus-within:border-brand focus-within:ring-[3px] focus-within:ring-brand-soft">
          <input
            type="number"
            inputMode="decimal"
            step="any"
            min={floor}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && changed && !error && void save()}
            aria-invalid={Boolean(error)}
            className="min-w-0 flex-1 border-0 bg-transparent tabular-nums text-ink outline-none"
            autoFocus
          />
          <span className="text-ink-3">{currency ?? ""} a day</span>
        </span>
        {error ? (
          <span className="text-xs font-medium text-neg">{error}</span>
        ) : (
          <span className="text-xs font-normal text-ink-2">
            Now {adSet?.dailyBudget ? fmtMoney(adSet.dailyBudget, currency) : "—"} a day. It changes on Meta straight away; Undo is in the Change log for 7 days.
          </span>
        )}
      </label>
    </Dialog>
  );
}
