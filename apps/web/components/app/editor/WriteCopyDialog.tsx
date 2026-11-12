"use client";

import { useEffect, useState } from "react";
import { Sparkles } from "lucide-react";
import { useApi } from "@/hooks/useApi";
import { Button, Dialog, Segmented } from "@/components/app/ui";

/**
 * C19c: "Write the text with AI". Pick one of the client's campaigns (its
 * objective, audience and current ad copy) or describe the ad; the AI writes
 * every text box to fit. 1 AI credit; one undo step.
 */
export function WriteCopyDialog({
  open,
  onClose,
  clientId,
  boxes,
  onWrite,
  onTemplates,
  onAddHeading,
}: {
  open: boolean;
  onClose: () => void;
  clientId: string | null;
  /** How many text boxes will be written (shown so nobody is surprised). */
  boxes: number;
  onWrite: (source: { campaignId?: string; brief?: string }) => Promise<void>;
  /** No text on the design yet: start from a template, or add a heading. */
  onTemplates: () => void;
  onAddHeading: () => void;
}) {
  const [mode, setMode] = useState<"campaign" | "brief">("campaign");
  const [campaignId, setCampaignId] = useState("");
  const [brief, setBrief] = useState("");
  const [busy, setBusy] = useState(false);
  const q = useApi((c) => (open ? c.getCampaigns({ ...(clientId ? { clientId } : {}), limit: 50, includeLatestMetrics: "false" }) : new Promise<never>(() => {})), [open, clientId], { key: "copy-campaigns" });
  const campaigns = q.data?.campaigns ?? [];
  useEffect(() => {
    if (!open || q.loading) return;
    if (!campaigns.length) setMode("brief");
    else if (!campaignId) setCampaignId(campaigns[0].id);
  }, [open, q.loading, campaigns, campaignId]);

  const ready = mode === "campaign" ? Boolean(campaignId) : brief.trim().length >= 10;
  const go = async () => {
    setBusy(true);
    try {
      await onWrite(mode === "campaign" ? { campaignId } : { brief: brief.trim() });
      onClose();
    } catch {
      /* the editor already showed what went wrong; keep the dialog open to try again */
    } finally {
      setBusy(false);
    }
  };

  // The AI rewrites the text boxes already on the design; with none, say so and offer a way to get some.
  if (!boxes) {
    return (
      <Dialog
        open={open}
        onClose={onClose}
        title="Write the text with AI"
        sub="There's no text on this design yet. The AI writes the wording of the text boxes on the design (headline, text, button), so add some first."
        width={520}
        footer={
          <>
            <Button variant="secondary" onClick={() => (onClose(), onAddHeading())}>
              Add a heading
            </Button>
            <Button variant="primary" onClick={() => (onClose(), onTemplates())}>
              Browse templates
            </Button>
          </>
        }
      >
        <p className="m-0 text-sm text-ink-2">The quickest start: pick a template (it has a headline, text and a button), then come back here to have the AI write them for your campaign.</p>
      </Dialog>
    );
  }

  return (
    <Dialog
      open={open}
      onClose={() => !busy && onClose()}
      title="Write the text with AI"
      sub={`Writes the ${boxes} text box${boxes === 1 ? "" : "es"} on this design to fit. Customer quotes and names stay as they are. Uses 1 AI credit; Ctrl+Z puts the old text back.`}
      width={520}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button variant="primary" icon={<Sparkles size={15} />} onClick={() => void go()} loading={busy} disabled={!ready} title={ready ? undefined : mode === "brief" ? "Describe the ad in a sentence or two (10 characters or more)" : "Pick a campaign"}>
            Write it
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4 text-sm">
        <Segmented<"campaign" | "brief">
          label="Based on"
          value={mode}
          onChange={setMode}
          options={[
            { value: "campaign", label: "A campaign" },
            { value: "brief", label: "A short brief" },
          ]}
        />
        {mode === "campaign" ? (
          q.loading && !q.data ? (
            <div className="h-10 animate-pulse rounded-ctl bg-surface-2" />
          ) : campaigns.length ? (
            <label className="flex flex-col gap-1.5">
              <span className="text-[13px] font-medium">Campaign</span>
              <select value={campaignId} onChange={(e) => setCampaignId(e.target.value)} className="h-10 rounded-ctl border border-line-2 bg-surface px-3 text-sm text-ink outline-none focus:border-brand">
                {campaigns.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
              <span className="text-xs text-ink-3">Uses its goal, audience and the wording of its current ads.</span>
            </label>
          ) : (
            <p className="m-0 text-ink-2">No campaigns for this client yet. Describe the ad instead.</p>
          )
        ) : (
          <label className="flex flex-col gap-1.5">
            <span className="text-[13px] font-medium">What is the ad about?</span>
            <textarea
              value={brief}
              onChange={(e) => setBrief(e.target.value)}
              rows={4}
              maxLength={1500}
              placeholder="e.g. Weekend brunch at our café, 20% off for students until 30 Nov, book a table online"
              className="rounded-ctl border border-line-2 bg-surface px-3 py-2 text-sm text-ink outline-none focus:border-brand focus:ring-[3px] focus:ring-brand-soft"
            />
            <span className="text-xs text-ink-3">Include any price, discount or date you want on the ad; the AI never makes those up.</span>
          </label>
        )}
      </div>
    </Dialog>
  );
}
