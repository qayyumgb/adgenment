"use client";

import { useEffect, useState } from "react";
import { useAppRouter } from "@/hooks/useAppRouter";
import toast from "react-hot-toast";
import { useApiClient, type Campaign } from "@/lib/api";
import { currencySymbol } from "@/lib/money";
import { Button, Dialog } from "@/components/app/ui";

const input =
  "h-10 w-full rounded-ctl border border-line-2 bg-surface px-3 text-sm text-ink outline-none transition-colors focus:border-brand focus:ring-[3px] focus:ring-brand-soft";

/**
 * D7 Duplicate campaign. The copy is a local draft (POST
 * /campaigns/:id/duplicate) — nothing spends until it's published — and the
 * page moves to the copy so it can be edited straight away.
 */
export function DuplicateDialog({ campaign: c, open, onClose }: { campaign: Campaign; open: boolean; onClose: () => void }) {
  const api = useApiClient();
  const router = useAppRouter();
  const [name, setName] = useState("");
  const [budget, setBudget] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setName(`${c.name} (copy)`);
    setBudget(String(Number(c.budget) || ""));
  }, [open, c.name, c.budget]);

  const n = Number(budget);
  const budgetOk = budget.trim() === "" || (Number.isFinite(n) && n > 0);

  const submit = async () => {
    if (!name.trim() || !budgetOk) return;
    setBusy(true);
    try {
      const copy = await api.duplicateCampaign(c.id, { name: name.trim(), budget: budget.trim() ? n : undefined });
      toast.success("Copied as a draft");
      onClose();
      router.push(`/campaigns/${copy.id}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't duplicate. Try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={`Duplicate “${c.name}”`}
      sub="Settings, budget and targeting are copied. Creatives stay with the original."
      width={480}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" onClick={submit} loading={busy} disabled={!name.trim() || !budgetOk}>
            Duplicate
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <label className="flex flex-col gap-1.5 text-sm font-medium">
          New name
          <input value={name} onChange={(e) => setName(e.target.value)} maxLength={200} className={input} />
        </label>
        <label className="flex flex-col gap-1.5 text-sm font-medium">
          {c.budgetType === "DAILY" ? "Daily budget" : "Total budget"}
          <span className="relative">
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-ink-3">{currencySymbol(c.adAccount?.currency)}</span>
            <input type="number" inputMode="decimal" value={budget} onChange={(e) => setBudget(e.target.value)} aria-invalid={!budgetOk} className={`${input} pl-12 tabular-nums`} />
          </span>
        </label>
        <p className="rounded-ctl bg-surface-2 px-3 py-2.5 text-[13px] text-ink-2">The copy is saved as a draft, so nothing spends until you publish it.</p>
      </div>
    </Dialog>
  );
}
