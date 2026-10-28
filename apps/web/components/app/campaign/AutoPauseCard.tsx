"use client";

import { useState } from "react";
import toast from "react-hot-toast";
import { useApi } from "@/hooks/useApi";
import { useApiClient, type Campaign } from "@/lib/api";
import { currencySymbol } from "@/lib/money";
import { useAccess } from "@/components/app/team/access";
import { Button, Card, CardHeader } from "@/components/app/ui";
import { GOALS } from "@/components/app/new-campaign/model";
import { AutoPauseFields, autoPauseCheck, autoPauseFromCampaign, toAutoPause, type AutoPauseForm } from "./AutoPauseFields";

/** Auto-pause (C6) on the campaign's Settings tab: the same choices as the wizard, for Meta campaigns (published or synced). */
export function AutoPauseCard({ campaign: c, onSaved }: { campaign: Campaign; onSaved: () => void }) {
  const api = useApiClient();
  const canEdit = useAccess().can("edit");
  const initial = autoPauseFromCampaign(c);
  const [form, setForm] = useState<AutoPauseForm>(initial);
  const [busy, setBusy] = useState(false);
  const today = new Date().toISOString().slice(0, 10);
  const start = c.startDate && c.startDate.slice(0, 10) > today ? c.startDate.slice(0, 10) : today;
  const end = c.endDate ? c.endDate.slice(0, 10) : null;
  const running = !end || end >= today;
  // Key dates still ahead while it runs, as blackout suggestions.
  const check = useApi((x) => (running ? x.checkLaunch({ adAccountId: c.adAccountId, objective: c.objective, start, end, excludeId: c.id }) : Promise.resolve(null)), [c.adAccountId, c.objective, start, end, c.id], { key: "launch-check" });
  const safety = useApi((x) => x.getSafetySettings(), [], { key: "safety-settings" }).data;
  const client = safety?.clients.find((x) => x.id === c.adAccount?.clientId);
  const needsPixel = /sales|conversion|lead/i.test(c.objective) || !!GOALS.find((g) => g.value === c.objective)?.needsPixel;
  const dirty = JSON.stringify(toAutoPause(form)) !== JSON.stringify(toAutoPause(initial));
  const valid = autoPauseCheck(form).ok;

  const save = async () => {
    if (busy || !dirty || !valid) return;
    setBusy(true);
    try {
      const res = await api.setAutoPause(c.id, toAutoPause(form));
      if (res.acted.length) toast.success(res.acted[0]);
      else toast.success("Auto-pause saved");
      onSaved();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Save failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card className="flex flex-col gap-4">
      <CardHeader
        title="Pause automatically"
        sub={
          c.externalId
            ? "Advertix checks every hour, and each pause shows in Activity with Undo."
            : "Saved now; it starts checking once the campaign is published."
        }
      />
      <AutoPauseFields
        value={form}
        onChange={setForm}
        currencySymbol={currencySymbol(c.adAccount?.currency)}
        trackingRelevant={needsPixel}
        trackingCoveredBy={client?.pixel && needsPixel ? client.name : null}
        keyDates={check.data?.keyDates ?? []}
        minDate={today}
        maxDate={end ?? undefined}
        disabled={!canEdit || busy}
      />
      {safety?.automationPaused && <p className="m-0 text-xs font-medium text-warn">Automation is paused for this workspace (Settings › AI &amp; automation), so these won&apos;t act until it&apos;s turned back on.</p>}
      {canEdit && (
        <div className="flex gap-2">
          <Button variant="primary" onClick={save} loading={busy} disabled={!dirty || !valid}>
            Save auto-pause
          </Button>
          {dirty && (
            <Button variant="ghost" onClick={() => setForm(initial)} disabled={busy}>
              Discard
            </Button>
          )}
        </div>
      )}
    </Card>
  );
}
