"use client";

import { useState } from "react";
import { Pin } from "lucide-react";
import type { HoursCell } from "@/lib/api";
import { cn } from "@/lib/cn";
import { fmtMoney } from "@/lib/money";

/**
 * Smart hours heatmap (plan C7, guide §8): cost per result by weekday and
 * hour against the average. Diverging: brand = cheaper, grey = average, red
 * outline = 40%+ more expensive; hatched = too few to judge. Hovering or
 * focusing a cell fills the readout line; clicking (or tapping, on phones
 * with no hover) pins one so it can be compared with others. A hidden table
 * carries the numbers for screen readers.
 */

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
/** Monday first. */
const ORDER = [1, 2, 3, 4, 5, 6, 0];
const NOTHING = 99;
const HATCH = "bg-[repeating-linear-gradient(135deg,rgb(var(--c-surface-2))_0_3px,rgb(var(--c-line-2))_3px_4px)]";
export const hh = (h: number) => `${String(h % 24).padStart(2, "0")}:00`;

function tone(c: HoursCell) {
  if (c.empty) return "bg-surface-2/50";
  if (c.value == null) return HATCH;
  if (c.value < 0.72) return "bg-brand";
  if (c.value < 0.92) return "bg-brand-mid";
  if (c.value < 1.4) return "bg-surface-3";
  return "bg-neg-soft shadow-[inset_0_0_0_1px_rgb(var(--c-neg))]";
}

export function cellText(c: HoursCell, metric: "conversion" | "click", currency: string | null, resultWord: string) {
  const when = `${c.weekday >= 0 ? `${DAYS[c.weekday]} ` : ""}${hh(c.hour)}–${hh(c.hour + 1)}`;
  if (c.empty) return `${when}: no delivery`;
  const results = metric === "conversion" ? c.conversions : c.clicks;
  const spent = `${fmtMoney(c.spend, currency, { whole: c.spend >= 100 })} spent, ${Math.round(results * 10) / 10} ${resultWord}${results === 1 ? "" : "s"}`;
  if (c.value == null) return `${when}: ${spent}. Too few to judge.`;
  if (c.value >= NOTHING) return `${when}: ${spent}. Nothing back for more than 3× the average cost.`;
  const pct = Math.round((c.value - 1) * 100);
  return `${when}: ${spent}, ${fmtMoney(c.spend / results, currency)} each (${pct === 0 ? "average" : `${pct > 0 ? "+" : "−"}${Math.abs(pct)}% vs average`}).`;
}

export function HoursHeatmap({
  cells,
  hours,
  metric,
  currency,
  resultWord,
  highlight,
}: {
  cells: HoursCell[];
  hours: HoursCell[];
  metric: "conversion" | "click";
  currency: string | null;
  /** "purchase", "click"… */
  resultWord: string;
  /** Hours the suggestion is about (outlined in the All days row). */
  highlight?: { from: number; to: number } | null;
}) {
  const [focus, setFocus] = useState<HoursCell | null>(null);
  const [pinned, setPinned] = useState<HoursCell | null>(null);
  const same = (a: HoursCell | null, b: HoursCell | null) => !!a && !!b && a.weekday === b.weekday && a.hour === b.hour;
  const at = (d: number, h: number) => cells.find((c) => c.weekday === d && c.hour === h);
  const inHighlight = (h: number) => !!highlight && (highlight.from < highlight.to ? h >= highlight.from && h < highlight.to : h >= highlight.from || h < highlight.to);
  const cell = (c: HoursCell | undefined, key: string, extra?: string) =>
    c ? (
      <button
        key={key}
        type="button"
        aria-pressed={same(pinned, c)}
        aria-label={cellText(c, metric, currency, resultWord)}
        onClick={() => setPinned(same(pinned, c) ? null : c)}
        onMouseEnter={() => setFocus(c)}
        onFocus={() => setFocus(c)}
        onMouseLeave={() => setFocus(null)}
        onBlur={() => setFocus(null)}
        className={cn(
          "flex h-[26px] cursor-pointer items-center justify-center rounded-[5px] focus-visible:ring-2 focus-visible:ring-ink",
          tone(c),
          extra,
          // Lifted above its neighbours, which would otherwise paint over the outline.
          same(pinned, c) ? "relative z-10 outline outline-2 outline-offset-2 outline-brand" : "outline-none"
        )}
      >
        {same(pinned, c) && (
          <span className="flex h-4 w-4 items-center justify-center rounded-full bg-surface shadow-[0_1px_2px_rgba(0,0,0,.25)]" aria-hidden="true">
            <Pin size={10} strokeWidth={2.5} className="text-brand" />
          </span>
        )}
      </button>
    ) : (
      <span key={key} className="h-[26px] rounded-[5px] bg-surface-2/50" />
    );

  return (
    <div className="flex flex-col gap-3">
      <div className="overflow-x-auto">
        <div className="flex min-w-[760px] flex-col gap-[3px]" onMouseLeave={() => setFocus(null)} onKeyDown={(e) => e.key === "Escape" && setPinned(null)}>
          <div className="grid grid-cols-[64px_repeat(24,minmax(0,1fr))] gap-[3px] text-[11px] text-ink-3" aria-hidden="true">
            <span />
            {Array.from({ length: 24 }, (_, h) => (
              <span key={h} className="text-center tabular-nums">
                {h % 3 === 0 ? String(h).padStart(2, "0") : ""}
              </span>
            ))}
          </div>
          <div className="grid grid-cols-[64px_repeat(24,minmax(0,1fr))] items-center gap-[3px] border-b border-line pb-[6px]">
            <span className="text-xs font-semibold text-ink">All days</span>
            {hours.map((c) => cell(c, `all-${c.hour}`, inHighlight(c.hour) ? "ring-2 ring-ink ring-offset-1 ring-offset-surface" : undefined))}
          </div>
          {ORDER.map((d) => (
            <div key={d} className="grid grid-cols-[64px_repeat(24,minmax(0,1fr))] items-center gap-[3px]">
              <span className="text-xs text-ink-2">{DAYS[d]}</span>
              {Array.from({ length: 24 }, (_, h) => cell(at(d, h), `${d}-${h}`))}
            </div>
          ))}
        </div>
      </div>
      <div className="flex min-h-[20px] flex-col gap-1 text-[13px] text-ink-2" aria-live="polite">
        {pinned && (
          <span className="flex flex-wrap items-center gap-x-2">
            <span className="inline-flex items-center gap-1 rounded bg-brand-soft px-1.5 text-xs font-semibold text-brand-ink">
              <Pin size={11} strokeWidth={2.5} aria-hidden="true" /> Pinned
            </span>
            <span className="text-ink">{cellText(pinned, metric, currency, resultWord)}</span>
            <button type="button" onClick={() => setPinned(null)} className="text-xs font-semibold text-brand hover:underline">
              Unpin
            </button>
          </span>
        )}
        {focus && !same(focus, pinned) ? (
          <span>{cellText(focus, metric, currency, resultWord)}</span>
        ) : (
          !pinned && <span>Hover, tap or tab through the cells for the numbers. Click one to pin it and compare.</span>
        )}
      </div>
      <Legend />
      <table className="sr-only">
        <caption>Cost per {resultWord} by hour, all days together</caption>
        <thead>
          <tr>
            <th scope="col">Hour</th>
            <th scope="col">Details</th>
          </tr>
        </thead>
        <tbody>
          {hours.map((c) => (
            <tr key={c.hour}>
              <th scope="row">{hh(c.hour)}</th>
              <td>{cellText(c, metric, currency, resultWord)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Legend() {
  const items: [string, string][] = [
    ["bg-brand", "30%+ cheaper"],
    ["bg-brand-mid", "Cheaper"],
    ["bg-surface-3", "Around average (up to +40%)"],
    ["bg-neg-soft shadow-[inset_0_0_0_1px_rgb(var(--c-neg))]", "40%+ more expensive"],
    [HATCH, "Too few to judge"],
  ];
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-ink-2">
      {items.map(([cls, label]) => (
        <span key={label} className="flex items-center gap-1.5">
          <span className={cn("h-3.5 w-3.5 rounded", cls)} aria-hidden="true" />
          {label}
        </span>
      ))}
    </div>
  );
}
