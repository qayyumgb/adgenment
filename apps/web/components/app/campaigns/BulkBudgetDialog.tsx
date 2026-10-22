"use client";

import { useState } from "react";
import type { Campaign } from "@/lib/api";
import { fmtMoney } from "@/lib/money";
import { Button, Dialog, Segmented } from "@/components/app/ui";
import { isLiveOnMeta, isReadOnlySync } from "./useCampaignMutations";

type Mode = "pct" | "set";

/**
 * Bulk "Edit budgets" (guide §4.1 bulk bar). Either change every selected
 * budget by a percentage or set them all to one amount. Shows each change
 * before saving; campaigns live on Meta change there immediately.
 */
export function BulkBudgetDialog({
  open,
  campaigns,
  onClose,
  onSave,
}: {
  open: boolean;
  campaigns: Campaign[];
  onClose: () => void;
  onSave: (changes: { campaign: Campaign; budget: number }[]) => Promise<unknown>;
}) {
  const [mode, setMode] = useState<Mode>("pct");
  const [value, setValue] = useState("10");
  const [saving, setSaving] = useState(false);

  const n = Number(value);
  const valid = value.trim() !== "" && Number.isFinite(n) && (mode === "set" ? n > 0 : n > -100 && n !== 0);
  const editable = campaigns.filter((c) => !isReadOnlySync(c));
  const readOnly = campaigns.length - editable.length;
  const changes = valid
    ? editable.map((c) => {
        const current = Number(c.budget) || 0;
        const next = mode === "set" ? n : current * (1 + n / 100);
        return { campaign: c, current, budget: Math.round(next * 100) / 100 };
      })
    : [];
  const usable = changes.filter((x) => x.budget > 0 && Math.abs(x.budget - x.current) >= 0.01);
  const live = usable.filter((x) => isLiveOnMeta(x.campaign)).length;

  const save = async () => {
    setSaving(true);
    try {
      await onSave(usable.map(({ campaign, budget }) => ({ campaign, budget })));
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Edit budgets"
      sub={`${campaigns.length} campaign${campaigns.length === 1 ? "" : "s"} selected`}
      width={520}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" onClick={save} loading={saving} disabled={usable.length === 0}>
            Update {usable.length || ""} budget{usable.length === 1 ? "" : "s"}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <Segmented
          label="How to change budgets"
          value={mode}
          onChange={(m) => {
            setMode(m);
            setValue(m === "pct" ? "10" : "");
          }}
          stretch
          options={[
            { value: "pct", label: "Change by %" },
            { value: "set", label: "Set to amount" },
          ]}
        />
        <label className="flex flex-col gap-1.5 text-sm font-medium">
          {mode === "pct" ? "Change (use a minus sign to lower)" : "New budget per campaign"}
          <span className="flex h-10 items-center gap-2 rounded-ctl border border-line-2 bg-surface px-3 focus-within:border-brand focus-within:ring-[3px] focus-within:ring-brand-soft">
            <input
              type="number"
              inputMode="decimal"
              step="any"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              className="min-w-0 flex-1 border-0 bg-transparent tabular-nums text-ink outline-none"
              aria-invalid={!valid && value !== ""}
            />
            <span className="text-ink-3">{mode === "pct" ? "%" : "per budget period"}</span>
          </span>
        </label>

        {changes.length > 0 && (
          <div className="max-h-56 overflow-y-auto rounded-ctl border border-line">
            {changes.map(({ campaign: c, current, budget }) => {
              const skip = budget <= 0 || Math.abs(budget - current) < 0.01;
              const cur = c.adAccount?.currency ?? null;
              return (
                <div key={c.id} className="flex items-center justify-between gap-3 border-b border-line px-3 py-2 text-[13px] last:border-b-0">
                  <span className="min-w-0 truncate">{c.name}</span>
                  <span className={skip ? "flex-none text-ink-3" : "flex-none tabular-nums"}>
                    {skip ? "No change" : `${fmtMoney(current, cur)} → ${fmtMoney(budget, cur)}${c.budgetType === "DAILY" ? "/day" : " lifetime"}`}
                  </span>
                </div>
              );
            })}
          </div>
        )}
        {readOnly > 0 && (
          <p className="text-[13px] text-ink-2">
            {readOnly} selected campaign{readOnly === 1 ? " is" : "s are"} on Google, TikTok or LinkedIn. Change those budgets in the platform’s own ads manager for now.
          </p>
        )}
        {live > 0 && (
          <p className="text-[13px] text-ink-2">
            {live} of these {live === 1 ? "is" : "are"} live on Meta and will change there right away.
          </p>
        )}
      </div>
    </Dialog>
  );
}
