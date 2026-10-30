"use client";

import { useMemo, useState } from "react";
import toast from "react-hot-toast";
import { Check } from "lucide-react";
import { useApi } from "@/hooks/useApi";
import { ApprovalPendingError, useApiClient } from "@/lib/api";
import { cn } from "@/lib/cn";
import { currencySymbol, fmtMoney } from "@/lib/money";
import Link from "next/link";
import { Button, Dialog } from "@/components/app/ui";

/**
 * New A/B test (plan C9b): a creative test on a Meta campaign published from
 * Advertix. Its current ad is version A; each picked image or video from the
 * Creatives library becomes another version with the same text, link and Page.
 * Meta splits the audience so each person sees one version.
 */

const field =
  "h-10 w-full rounded-ctl border border-line-2 bg-surface px-3 text-sm text-ink outline-none transition-colors focus:border-brand focus:ring-[3px] focus:ring-brand-soft";

export function NewTestDialog({ open, onClose, clientId, onStarted }: { open: boolean; onClose: () => void; clientId: string | null; onStarted: () => void }) {
  const api = useApiClient();
  const campaignsQ = useApi((c) => (open ? c.getCampaigns({ platform: "META", limit: 200, clientId: clientId ?? undefined }) : Promise.resolve(null)), [open, clientId], { key: "experiment-campaigns" });
  const creativesQ = useApi((c) => (open ? c.getCreatives({ limit: 100, clientId: clientId ?? undefined }) : Promise.resolve(null)), [open, clientId], { key: "experiment-creatives" });
  // Tests start from campaigns Advertix published (it knows their ad set, ad and Page).
  const campaigns = useMemo(() => (campaignsQ.data?.campaigns ?? []).filter((c) => c.externalId && c.externalAdSetId && (c.status === "ACTIVE" || c.status === "PAUSED")), [campaignsQ.data]);
  const creatives = useMemo(() => (creativesQ.data?.creatives ?? []).filter((c) => c.type === "IMAGE" || c.type === "VIDEO"), [creativesQ.data]);

  const [campaignId, setCampaignId] = useState("");
  const [name, setName] = useState("");
  const [picked, setPicked] = useState<string[]>([]);
  const [days, setDays] = useState("7");
  const [budget, setBudget] = useState("");
  const [busy, setBusy] = useState(false);

  const campaign = campaigns.find((c) => c.id === campaignId) ?? null;
  const currency = campaign?.adAccount?.currency ?? null;
  const min = campaign?.adAccount?.minDailyBudget ?? 0;
  const versions = picked.length + 1;
  const d = Number(days);
  const b = Number(budget);
  const errors = {
    name: !name.trim() ? "Give the test a name." : null,
    picked: picked.length < 1 ? "Pick 1 to 4 creatives." : null,
    days: !Number.isInteger(d) || d < 3 || d > 30 ? "3 to 30 days." : null,
    budget: !(b > 0) ? "Set a daily budget." : min > 0 && b < min * versions ? `At least ${fmtMoney(min * versions, currency)} a day (${fmtMoney(min, currency)} per version).` : null,
  };
  const valid = !!campaign && !Object.values(errors).some(Boolean);
  // Why Start test is off, in words (first thing missing).
  const missing = !campaign ? "Pick a campaign." : errors.picked ?? errors.name ?? errors.days ?? errors.budget;

  const reset = () => {
    setCampaignId("");
    setName("");
    setPicked([]);
    setDays("7");
    setBudget("");
  };
  const close = () => {
    if (busy) return;
    reset();
    onClose();
  };
  const toggle = (id: string) => setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : p.length >= 4 ? p : [...p, id]));

  const start = async () => {
    if (!campaign || !valid) return;
    setBusy(true);
    try {
      await api.startExperiment(campaign.id, { name: name.trim(), creativeIds: picked, days: d, dailyBudget: b });
      toast.success(`“${name.trim()}” is set up on Meta. It starts in about 10 minutes.`);
      reset();
      onStarted();
      onClose();
    } catch (err) {
      if (err instanceof ApprovalPendingError) {
        reset();
        onClose();
      } else toast.error(err instanceof Error ? err.message : "Couldn't start the test");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={close}
      width={640}
      title="New A/B test"
      sub="Test new images or videos against a campaign's current ad. Meta shows each person one version, so the comparison is fair."
      footer={
        <>
          <Button variant="secondary" onClick={close} disabled={busy}>
            Cancel
          </Button>
          <Button variant="primary" onClick={() => void start()} loading={busy} disabled={!valid}>
            Start test
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <label className="flex flex-col gap-1.5 text-sm font-medium">
          Campaign
          <select
            value={campaignId}
            onChange={(e) => {
              setCampaignId(e.target.value);
              const c = campaigns.find((x) => x.id === e.target.value);
              if (c && !budget) setBudget(String(Math.max(Number(c.budget) || 0, (c.adAccount?.minDailyBudget ?? 0) * 2) || ""));
              if (c && !name) setName(`${c.name}: creative test`);
            }}
            className={field}
          >
            <option value="">{campaignsQ.loading ? "Loading campaigns…" : campaigns.length ? "Pick a Meta campaign" : "No Meta campaigns published from Advertix yet"}</option>
            {campaigns.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
                {c.status === "PAUSED" ? " (paused)" : ""}
              </option>
            ))}
          </select>
          <span className="text-xs font-normal text-ink-2">Its current ad is version A. The new versions copy its text, link and Page.</span>
        </label>

        <label className="flex flex-col gap-1.5 text-sm font-medium">
          Test name
          <input value={name} maxLength={120} onChange={(e) => setName(e.target.value)} placeholder="e.g. Founder hook vs UGC hook" className={field} />
        </label>

        <div className="flex flex-col gap-1.5 text-sm font-medium">
          Versions to test <span className="text-xs font-normal text-ink-2">Pick 1 to 4 images or videos from Creatives ({picked.length}/4).</span>
          {creatives.length === 0 ? (
            <span className="rounded-ctl bg-surface-2 px-3 py-2.5 text-[13px] font-normal text-ink-2">{creativesQ.loading ? (
                "Loading creatives…"
              ) : (
                <>
                  No images or videos in Creatives yet, so there&apos;s nothing to test against the current ad.{" "}
                  <Link href="/creatives" className="font-semibold text-brand no-underline hover:underline">
                    Add creatives
                  </Link>
                </>
              )}
            </span>
          ) : (
            <ul className="m-0 grid max-h-[220px] list-none grid-cols-[repeat(auto-fill,minmax(150px,1fr))] gap-2 overflow-y-auto p-0">
              {creatives.map((c) => {
                const on = picked.includes(c.id);
                const content = (c.content ?? {}) as Record<string, unknown>;
                const img = typeof content.imageUrl === "string" ? content.imageUrl : typeof content.thumbnailUrl === "string" ? content.thumbnailUrl : null;
                return (
                  <li key={c.id}>
                    <button
                      type="button"
                      role="checkbox"
                      aria-checked={on}
                      onClick={() => toggle(c.id)}
                      disabled={!on && picked.length >= 4}
                      className={cn("flex w-full items-center gap-2 rounded-ctl border p-2 text-left text-[13px] font-normal transition-colors disabled:opacity-50", on ? "border-brand bg-brand-soft" : "border-line hover:bg-surface-2")}
                    >
                      {img ? (
                        /* eslint-disable-next-line @next/next/no-img-element -- library and Meta CDN URLs, not optimisable */
                        <img src={img} alt="" className="h-9 w-9 flex-none rounded object-cover" />
                      ) : <span className="flex h-9 w-9 flex-none items-center justify-center rounded bg-surface-3 text-[10px] text-ink-3">{c.type === "VIDEO" ? "Video" : "Image"}</span>}
                      <span className="min-w-0 flex-1 truncate">{c.name}</span>
                      {on && <Check size={14} className="flex-none text-brand" aria-hidden="true" />}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div className="grid gap-4 min-[520px]:grid-cols-2">
          <label className="flex flex-col gap-1.5 text-sm font-medium">
            Days
            <input type="number" min={3} max={30} value={days} onChange={(e) => setDays(e.target.value)} className={cn(field, "tabular-nums")} />
            <span className={cn("text-xs", errors.days && days ? "font-medium text-neg" : "font-normal text-ink-2")}>{errors.days && days ? errors.days : "7–14 days usually gives a clear answer."}</span>
          </label>
          <label className="flex flex-col gap-1.5 text-sm font-medium">
            Test budget a day
            <span className="relative">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-ink-3">{currencySymbol(currency)}</span>
              <input type="number" inputMode="decimal" value={budget} onChange={(e) => setBudget(e.target.value)} className={cn(field, "pl-12 tabular-nums")} />
            </span>
            <span className={cn("text-xs", errors.budget && budget ? "font-medium text-neg" : "font-normal text-ink-2")}>
              {errors.budget && budget ? errors.budget : picked.length ? `Split evenly across ${versions} versions: about ${b > 0 ? fmtMoney(b / versions, currency) : "—"} a day each.` : "Split evenly across the versions you pick."}
            </span>
          </label>
        </div>
        <p className="m-0 text-xs text-ink-3">Advertix creates the new ads on Meta, then starts Meta&apos;s creative test. If any step fails, it removes what it created.</p>
        {!valid && missing && (
          <p className="m-0 text-right text-xs font-medium text-ink-2" aria-live="polite">
            To start: {missing.charAt(0).toLowerCase() + missing.slice(1)}
          </p>
        )}
      </div>
    </Dialog>
  );
}
