"use client";

import { useState } from "react";
import { TrendingUp } from "lucide-react";
import type { CampaignAd } from "@/lib/api";
import { cn } from "@/lib/cn";
import { fmtMoney } from "@/lib/money";
import { Card, Pill, Toggle } from "@/components/app/ui";
import { DELIVERY_TONE, FORMAT_LABEL, FREQ_CEILING, ctrOf, deliveryLabel, roasOf } from "./structure";

/**
 * One ad (guide §5.3 ad tiles): creative, ROAS / CTR / spend and a
 * frequency bar against 5.0 with the fatigue read. `full` (Ads tab) adds the
 * headline, primary text and the pause switch.
 */
export function AdTile({
  ad,
  currency,
  adSetName,
  full = false,
  busy = false,
  onToggle,
}: {
  ad: CampaignAd;
  currency: string | null;
  adSetName?: string;
  full?: boolean;
  busy?: boolean;
  onToggle?: () => void;
}) {
  const [broken, setBroken] = useState(false);
  const r = roasOf(ad.totals);
  const c = ctrOf(ad.totals);
  const status = deliveryLabel(ad);
  const fatigued = ad.fatigue.level === "fatigued";
  const freq = ad.frequency30d;
  const freqColor = fatigued ? "bg-neg" : ad.fatigue.level === "watch" ? "bg-warn" : "bg-brand";
  const img = ad.imageUrl && !broken ? ad.imageUrl : null;
  const ended = ad.status === "ENDED";
  // The frequency is already on the line above; keep only the rest of the read.
  const rest = ad.fatigue.reason?.replace(/^Frequency [\d.]+(: | and )/, "") ?? null;
  const reason = rest ? rest.charAt(0).toUpperCase() + rest.slice(1) : null;

  return (
    <Card padded={false} className="flex min-w-0 flex-col overflow-hidden">
      <div className="relative flex aspect-[4/5] items-end bg-[repeating-linear-gradient(135deg,var(--surface-2)_0_10px,var(--surface-3)_10px_12px)] p-3">
        {img && (
          /* eslint-disable-next-line @next/next/no-img-element -- Meta CDN URLs, not optimisable */
          <img src={img} alt="" loading="lazy" onError={() => setBroken(true)} className="absolute inset-0 h-full w-full object-cover" />
        )}
        <span className="relative rounded-md bg-surface px-2 py-0.5 font-mono text-xs text-ink-2">{FORMAT_LABEL[ad.format].toLowerCase()}</span>
        {fatigued && (
          <span className="absolute left-3 top-3 flex items-center gap-1.5 rounded-full bg-neg px-2.5 py-[3px] text-xs font-semibold text-white">
            <TrendingUp size={12} strokeWidth={2.5} aria-hidden="true" />
            Fatigued
          </span>
        )}
      </div>
      <div className="flex flex-1 flex-col gap-3 px-4 pb-4 pt-3.5">
        <div className="flex items-start gap-2">
          <span className="flex min-w-0 flex-1 flex-col leading-snug">
            <span className="truncate font-semibold" title={ad.name}>
              {ad.name}
            </span>
            <span className="truncate text-xs text-ink-2">{[FORMAT_LABEL[ad.format], adSetName].filter(Boolean).join(" · ")}</span>
          </span>
          {status !== "Active" && <Pill tone={DELIVERY_TONE[status] ?? "neutral"}>{status}</Pill>}
        </div>

        {full && (ad.headline || ad.body) && (
          <div className="flex flex-col gap-1 rounded-ctl bg-surface-2 px-3 py-2.5 text-sm">
            {ad.headline && <span className="font-semibold">{ad.headline}</span>}
            {ad.body && <span className="line-clamp-3 text-ink-2">{ad.body}</span>}
          </div>
        )}

        <div className="grid grid-cols-3 gap-2 tabular-nums">
          <span className="flex flex-col">
            <span className="text-xs text-ink-2">ROAS</span>
            <span className="text-[15px] font-semibold">{r === null ? "—" : `${r.toFixed(2)}x`}</span>
          </span>
          <span className="flex flex-col">
            <span className="text-xs text-ink-2">CTR</span>
            <span className={cn("text-[15px] font-semibold", fatigued && ad.fatigue.reason?.startsWith("CTR") && "text-neg")}>{c === null ? "—" : `${c.toFixed(2)}%`}</span>
          </span>
          <span className="flex flex-col">
            <span className="text-xs text-ink-2">Spend</span>
            <span className="text-[15px] font-semibold">{ad.totals.spend > 0 ? fmtMoney(ad.totals.spend, currency, { whole: ad.totals.spend >= 1000 }) : "—"}</span>
          </span>
        </div>

        {ended ? (
          <p className="mt-auto text-xs text-ink-2">{ad.effectiveStatus === "DELETED" ? "Deleted on Meta. Its results stay in the campaign totals." : "This ad has ended."}</p>
        ) : (
          <div className="mt-auto flex flex-col gap-1.5">
            <span className="relative h-1.5 rounded-full bg-surface-3" role="meter" aria-label="Frequency" aria-valuemin={0} aria-valuemax={FREQ_CEILING} aria-valuenow={Math.min(freq, FREQ_CEILING)}>
              <span className={cn("absolute inset-y-0 left-0 rounded-full", freqColor)} style={{ width: `${Math.min(100, (freq / FREQ_CEILING) * 100)}%` }} />
            </span>
            <span className="text-xs text-ink-2">{freq > 0 ? `Frequency ${freq.toFixed(1)}` : "No frequency reported yet"}</span>
            {reason && <span className={cn("text-xs", fatigued ? "text-neg" : "text-ink-2")}>{reason}</span>}
          </div>
        )}

        {full && onToggle && !ended && (
          <div className="flex items-center justify-between gap-3 border-t border-line pt-3 text-[13px]">
            <span className="text-ink-2">{ad.switchOn ? "On" : "Off"} on Meta</span>
            <span title={ad.statusBlocker ?? undefined}>
              <Toggle checked={ad.switchOn} onChange={onToggle} label={`${ad.switchOn ? "Pause" : "Resume"} ${ad.name}`} disabled={busy || Boolean(ad.statusBlocker)} />
            </span>
          </div>
        )}
      </div>
    </Card>
  );
}
