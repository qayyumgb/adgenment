"use client";

import { useState } from "react";
import toast from "react-hot-toast";
import { Trash2 } from "lucide-react";
import { useApiClient, type Campaign } from "@/lib/api";
import { currencySymbol } from "@/lib/money";
import { cn } from "@/lib/cn";
import { Button, Card, CardHeader } from "@/components/app/ui";
import { isLiveOnMeta, isReadOnlySync } from "@/components/app/campaigns/useCampaignMutations";

const input =
  "h-10 w-full rounded-ctl border bg-surface px-3 text-sm text-ink outline-none transition-colors focus:border-brand focus:ring-[3px] focus:ring-brand-soft";

/**
 * Settings (kept from the old detail page): rename, budget, delete. Saving a
 * campaign that is live on Meta pushes the change to Meta first (PUT
 * /campaigns/:id), and a rejection leaves nothing changed.
 */
export function SettingsTab({ campaign: c, onSaved, onDelete }: { campaign: Campaign; onSaved: () => void; onDelete: () => void }) {
  const api = useApiClient();
  const [name, setName] = useState(c.name);
  // Raw text so the last digit can be deleted (a number state snaps back to 0).
  const [budgetInput, setBudgetInput] = useState(String(Number(c.budget) || 0));
  const [busy, setBusy] = useState(false);
  const n = Number(budgetInput);
  const budget = budgetInput.trim() !== "" && Number.isFinite(n) ? n : 0;
  const minDaily = c.adAccount?.minDailyBudget ?? null;
  const readOnly = isReadOnlySync(c);
  const belowMin = budget <= 0 || (c.budgetType === "DAILY" && !!minDaily && minDaily > 0 && budget < minDaily);
  const dirty = (name.trim() !== "" && name.trim() !== c.name) || budget !== Number(c.budget);
  const sym = currencySymbol(c.adAccount?.currency);

  const save = async () => {
    if (busy || !dirty || belowMin || readOnly) return;
    setBusy(true);
    try {
      await api.updateCampaign(c.id, { name: name.trim(), budget });
      toast.success(isLiveOnMeta(c) ? "Saved here and on Meta" : "Campaign saved");
      onSaved();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Save failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex max-w-3xl flex-col gap-5">
      <Card className="flex flex-col gap-4">
        <CardHeader
          title="Campaign settings"
          sub={
            readOnly
              ? "This campaign is synced from the platform. Change its name and budget there; Advertix picks it up on the next sync."
              : isLiveOnMeta(c)
                ? "Changes are applied on Meta right away."
                : "Saved in Advertix. Publish to send it to the platform."
          }
        />
        <label className="flex flex-col gap-1.5 text-sm font-medium">
          Campaign name
          <input value={name} onChange={(e) => setName(e.target.value)} disabled={readOnly} className={cn(input, "border-line-2 disabled:opacity-60")} />
        </label>
        <label className="flex flex-col gap-1.5 text-sm font-medium">
          {c.budgetType === "DAILY" ? "Daily budget" : "Total budget"}
          <span className="relative">
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-ink-3">{sym}</span>
            <input
              type="number"
              inputMode="decimal"
              value={budgetInput}
              min={c.budgetType === "DAILY" && minDaily ? minDaily : 1}
              disabled={readOnly}
              onChange={(e) => setBudgetInput(e.target.value)}
              aria-invalid={belowMin}
              className={cn(input, "pl-12 tabular-nums disabled:opacity-60", belowMin ? "border-neg" : "border-line-2")}
            />
          </span>
          {belowMin && !readOnly && (
            <span className="text-xs font-medium text-neg">
              {budget <= 0 ? "Enter a budget above zero." : `Below this account’s minimum of ${sym}${(minDaily ?? 0).toLocaleString()} per day.`}
            </span>
          )}
        </label>
        <div>
          <Button variant="primary" onClick={save} loading={busy} disabled={!dirty || belowMin || readOnly}>
            Save changes
          </Button>
        </div>
      </Card>

      <Card className="flex flex-wrap items-center gap-4 border-neg/30">
        <div className="min-w-[220px] flex-1">
          <div className="font-semibold">Delete campaign</div>
          <div className="text-[13px] text-ink-2">
            {isLiveOnMeta(c)
              ? "Deletes it on Meta too — its ad set and ad stop delivering immediately — along with its metrics here."
              : "Removes the campaign and its metrics from Advertix."}{" "}
            This can’t be undone.
          </div>
        </div>
        <Button variant="danger" icon={<Trash2 size={16} />} onClick={onDelete}>
          Delete campaign
        </Button>
      </Card>
    </div>
  );
}
