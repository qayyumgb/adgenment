"use client";

import { useState, type KeyboardEvent, type ReactNode } from "react";
import { cn } from "@/lib/cn";
import { Card, Skeleton, Toggle } from "@/components/app/ui";
import { dayLabel } from "@/components/app/campaign/metrics";

export type TrendPoint = { date: string; value: number | null; previous: number | null };

const W = 1000;
const H = 260;

/** Round the axis top up to a "nice" number (1, 2, 2.5, 5 × 10ⁿ). */
function niceTop(max: number) {
  if (max <= 0) return 1;
  const mag = Math.pow(10, Math.floor(Math.log10(max)));
  const n = max / mag;
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10) * mag;
}

function path(values: (number | null)[], top: number, close = false) {
  const n = values.length;
  if (n === 0) return "";
  const x = (i: number) => (n === 1 ? W / 2 : (i / (n - 1)) * W);
  const y = (v: number) => H - (v / top) * H;
  // Each run of days with data is its own segment, so gaps stay gaps (and the
  // filled area doesn't bridge them).
  let d = "";
  let start = -1;
  const flush = (end: number) => {
    if (start < 0) return;
    for (let i = start; i <= end; i++) d += `${i === start ? "M" : "L"}${x(i).toFixed(1)},${y(values[i] as number).toFixed(1)} `;
    if (close) d += `L${x(end).toFixed(1)},${H} L${x(start).toFixed(1)},${H} Z `;
    start = -1;
  };
  values.forEach((v, i) => {
    if (v === null) flush(i - 1);
    else if (start < 0) start = i;
  });
  flush(n - 1);
  return d;
}

/**
 * "{Metric} by day" line (Analytics, guide §5.7): this period as a filled
 * line, the previous period dashed when Compare is on. Hover or arrow keys
 * update the header readout (guide §6: no floating tooltips).
 */
export function TrendChart({
  title,
  points,
  format,
  compare,
  onCompareChange,
  compareLabel,
  summary,
  loading = false,
  headerExtra,
  className,
}: {
  title: string;
  points: TrendPoint[];
  format: (v: number) => string;
  compare: boolean;
  onCompareChange: (v: boolean) => void;
  compareLabel: string;
  /** Readout when nothing is hovered, e.g. "Last 30 days · $18,420 · previous $16,300". */
  summary: ReactNode;
  loading?: boolean;
  headerExtra?: ReactNode;
  className?: string;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const cur = points.map((p) => p.value);
  const prev = points.map((p) => p.previous);
  const top = niceTop(Math.max(0, ...cur.map((v) => v ?? 0), ...(compare ? prev.map((v) => v ?? 0) : [])) * 1.05);
  const empty = !loading && cur.every((v) => !v);
  const h = hover !== null ? points[hover] : undefined;
  const step = Math.max(1, Math.round(points.length / 5));
  const xLabels = points.filter((_, i) => i % step === 0 || i === points.length - 1);
  const grid = [1, 0.75, 0.5, 0.25];
  const xPct = (i: number) => (points.length <= 1 ? 50 : (i / (points.length - 1)) * 100);

  const onKey = (e: KeyboardEvent) => {
    if (e.key === "Escape") return setHover(null);
    if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
    e.preventDefault();
    const dir = e.key === "ArrowRight" ? 1 : -1;
    setHover((i) => (i === null ? (dir > 0 ? 0 : points.length - 1) : Math.min(points.length - 1, Math.max(0, i + dir))));
  };

  return (
    <Card className={cn("flex flex-col gap-4 px-6 pb-5 pt-[22px]", className)}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-base font-semibold">{title}</div>
          <div className="mt-0.5 text-[13px] tabular-nums text-ink-2" aria-live="polite">
            {loading ? (
              <Skeleton className="mt-1 h-3.5 w-56" />
            ) : h ? (
              <>
                <span className="font-semibold text-ink">{dayLabel(h.date)}</span> · {h.value === null ? "No data" : format(h.value)}
                {compare && <> · previous {h.previous === null ? "no data" : format(h.previous)}</>}
              </>
            ) : (
              summary
            )}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {headerExtra}
          <label className="flex cursor-pointer items-center gap-2.5 text-[13px] font-medium">
            <Toggle checked={compare} onChange={onCompareChange} label={compareLabel} />
            <span className="whitespace-nowrap">{compareLabel}</span>
          </label>
        </div>
      </div>

      <div className="grid grid-cols-[52px_minmax(0,1fr)] gap-2.5">
        <div className="relative h-[260px] text-xs tabular-nums text-ink-3" aria-hidden="true">
          {!loading &&
            !empty &&
            grid.map((g) => (
              <span key={g} className="absolute right-0 -translate-y-1/2" style={{ top: `${(1 - g) * 100}%` }}>
                {format(top * g)}
              </span>
            ))}
        </div>
        <div className="relative h-[260px]">
          {grid.map((g) => (
            <div key={g} className="absolute inset-x-0 border-t border-dashed border-line-2" style={{ top: `${(1 - g) * 100}%` }} aria-hidden="true" />
          ))}
          <div className="absolute inset-x-0 bottom-0 border-t border-line-2" aria-hidden="true" />
          {loading ? (
            <Skeleton className="absolute inset-0" />
          ) : empty ? (
            <div className="absolute inset-0 flex items-center justify-center text-sm text-ink-2">No data in this period.</div>
          ) : (
            <>
              <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="absolute inset-0 h-full w-full overflow-visible" aria-hidden="true">
                <defs>
                  <linearGradient id="adx-trend-area" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--brand)" stopOpacity="0.22" />
                    <stop offset="100%" stopColor="var(--brand)" stopOpacity="0" />
                  </linearGradient>
                </defs>
                <path d={path(cur, top, true)} fill="url(#adx-trend-area)" />
                {compare && (
                  <path d={path(prev, top)} fill="none" stroke="var(--ink-3)" strokeWidth={1.5} strokeDasharray="5 5" vectorEffect="non-scaling-stroke" />
                )}
                <path d={path(cur, top)} fill="none" stroke="var(--brand)" strokeWidth={2.5} strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
              </svg>
              {h && hover !== null && (
                <>
                  <div className="pointer-events-none absolute bottom-0 top-0 w-px bg-ink-3/50" style={{ left: `${xPct(hover)}%` }} aria-hidden="true" />
                  {h.value !== null && (
                    <div
                      className="pointer-events-none absolute h-2.5 w-2.5 -translate-x-1/2 translate-y-1/2 rounded-full border-2 border-surface bg-brand"
                      style={{ left: `${xPct(hover)}%`, bottom: `${(h.value / top) * 100}%` }}
                      aria-hidden="true"
                    />
                  )}
                </>
              )}
              <div
                role="img"
                tabIndex={0}
                aria-label={`${title}. Use the arrow keys to read each day.`}
                onKeyDown={onKey}
                onMouseLeave={() => setHover(null)}
                onBlur={() => setHover(null)}
                className="absolute inset-0 flex rounded focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-brand-soft"
              >
                {points.map((p, i) => (
                  <div key={p.date} onMouseEnter={() => setHover(i)} className="h-full flex-1 cursor-crosshair" />
                ))}
              </div>
            </>
          )}
        </div>
        <div />
        <div className="flex justify-between text-xs text-ink-3" aria-hidden="true">
          {!loading && xLabels.map((p) => <span key={p.date}>{dayLabel(p.date)}</span>)}
        </div>
      </div>

      <div className="flex gap-[18px] text-[13px] text-ink-2">
        <span className="flex items-center gap-2">
          <span className="h-0.5 w-4 rounded bg-brand" aria-hidden="true" />
          This period
        </span>
        {compare && (
          <span className="flex items-center gap-2">
            <span className="w-4 border-t-[1.5px] border-dashed border-ink-3" aria-hidden="true" />
            Previous period
          </span>
        )}
      </div>
    </Card>
  );
}
