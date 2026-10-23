"use client";

import { useState } from "react";
import { Layers, Play, Sparkles } from "lucide-react";
import type { CreativeBoardItem } from "@/lib/api";
import { cn } from "@/lib/cn";
import { fmtMoney } from "@/lib/money";
import { Pill, PlatformBadge, type PlatformKey } from "@/components/app/ui";
import { FREQ_CEILING } from "@/components/app/campaign/structure";
import { STATUS_TONE, ctrOf, formatLine, roasOf, unquote } from "./board";

/** The creative's visual: its image, or its headline on a soft card when there's no media yet. */
export function CreativeArt({ item, className, large = false }: { item: CreativeBoardItem; className?: string; large?: boolean }) {
  const [broken, setBroken] = useState(false);
  const img = item.imageUrl && !broken ? item.imageUrl : null;
  return (
    <div className={cn("relative flex items-end overflow-hidden bg-[repeating-linear-gradient(135deg,var(--surface-2)_0_10px,var(--surface-3)_10px_12px)] p-3", className)}>
      {img ? (
        /* eslint-disable-next-line @next/next/no-img-element -- Meta CDN / uploaded media */
        <img src={img} alt="" loading="lazy" onError={() => setBroken(true)} className="absolute inset-0 h-full w-full object-cover" />
      ) : (item.headline || item.body) ? (
        <div className="absolute inset-0 flex items-center bg-brand-soft p-5">
          <p className={cn("line-clamp-5 font-semibold text-brand-ink [text-wrap:pretty]", large ? "text-xl" : "text-[15px]")}>“{unquote(item.headline ?? item.body ?? "")}”</p>
        </div>
      ) : null}
      {item.format === "VIDEO" && img && (
        <span className="absolute left-1/2 top-1/2 flex h-10 w-10 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-black/55 text-white">
          <Play size={16} fill="currentColor" aria-hidden="true" />
        </span>
      )}
      <span className="relative flex flex-wrap gap-1.5">
        <span className="rounded-md bg-surface px-2 py-0.5 font-mono text-xs text-ink-2">{formatLine(item).toLowerCase()}</span>
        {item.needsMedia && <span className="rounded-md bg-warn-soft px-2 py-0.5 text-xs font-semibold text-warn">Needs {item.format === "VIDEO" ? "video" : "image"}</span>}
      </span>
    </div>
  );
}

/** A board card (guide §5.4): art, status, platform, results and the frequency bar. Opens the drawer. */
export function CreativeCard({ item, clientName, compact = false, onOpen }: { item: CreativeBoardItem; clientName?: string | null; compact?: boolean; onOpen: () => void }) {
  const r = roasOf(item);
  const c = ctrOf(item);
  const ran = item.totals.impressions > 0;
  const fatigued = item.fatigue.level === "fatigued";
  const freqColor = fatigued ? "bg-neg" : item.fatigue.level === "watch" ? "bg-warn" : "bg-brand";
  return (
    <button
      type="button"
      onClick={onOpen}
      className="group flex min-w-0 flex-col overflow-hidden rounded-card border border-line bg-surface text-left shadow-card transition hover:-translate-y-0.5 hover:shadow-[var(--shadow-lg)] focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-brand-soft motion-reduce:transition-none motion-reduce:hover:translate-y-0"
    >
      <div className="relative w-full">
        <CreativeArt item={item} className="aspect-[4/5] w-full" />
        <Pill tone={STATUS_TONE[item.status]} className="absolute left-3 top-3 shadow-sm">
          {item.status}
        </Pill>
        <span className="absolute right-3 top-3 flex items-center gap-1.5">
          {item.aiGenerated && (
            <span title="Written with Advertix AI" className="flex h-6 w-6 items-center justify-center rounded-[7px] bg-surface text-brand shadow-[0_0_0_2px_var(--surface)]">
              <Sparkles size={13} aria-hidden="true" />
            </span>
          )}
          {item.format === "CAROUSEL" && item.cardCount > 1 && (
            <span title={`${item.cardCount} cards`} className="flex h-6 items-center gap-1 rounded-[7px] bg-surface px-1.5 text-[11px] font-semibold text-ink-2">
              <Layers size={12} aria-hidden="true" />
              {item.cardCount}
            </span>
          )}
          {item.source === "meta" || item.adCount > 0 || item.campaignId ? (
            <span className="rounded-[7px] shadow-[0_0_0_2px_var(--surface)]">
              <PlatformBadge platform={item.platform as PlatformKey} size={24} />
            </span>
          ) : null}
        </span>
      </div>
      <div className={cn("flex w-full flex-col gap-3", compact ? "px-3 pb-3 pt-2.5" : "px-4 pb-4 pt-3.5")}>
        <span className="flex min-w-0 flex-col leading-snug">
          <span className="truncate font-semibold" title={item.name}>
            {item.name}
          </span>
          <span className="truncate text-xs text-ink-2">{[clientName, item.source === "meta" ? "From Meta" : formatLine(item)].filter(Boolean).join(" · ")}</span>
        </span>
        {!compact && (
          <span className="grid grid-cols-3 gap-2 tabular-nums">
            <span className="flex flex-col">
              <span className="text-xs text-ink-2">ROAS</span>
              <span className="font-semibold">{r === null ? "—" : `${r.toFixed(2)}x`}</span>
            </span>
            <span className="flex flex-col">
              <span className="text-xs text-ink-2">CTR</span>
              <span className={cn("font-semibold", fatigued && item.fatigue.reason?.startsWith("CTR") && "text-neg")}>{c === null ? "—" : `${c.toFixed(2)}%`}</span>
            </span>
            <span className="flex flex-col">
              <span className="text-xs text-ink-2">Spend</span>
              <span className="font-semibold">{item.totals.spend > 0 ? fmtMoney(item.totals.spend, item.currency, { whole: true }) : "—"}</span>
            </span>
          </span>
        )}
        <span className="flex flex-col gap-1.5">
          <span className="relative h-1.5 rounded-full bg-surface-3">
            {item.frequency > 0 && <span className={cn("absolute inset-y-0 left-0 rounded-full", freqColor)} style={{ width: `${Math.min(100, (item.frequency / FREQ_CEILING) * 100)}%` }} />}
          </span>
          <span className="text-xs text-ink-2">
            {item.frequency > 0 ? `Frequency ${item.frequency.toFixed(1)}${fatigued ? " · tired" : ""}` : ran ? "Frequency not reported yet" : item.status === "Draft" ? "Not in an ad yet" : "No delivery in this period"}
          </span>
        </span>
      </div>
    </button>
  );
}
