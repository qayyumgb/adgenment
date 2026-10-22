"use client";

import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { cn } from "@/lib/cn";
import { fmtMoney } from "@/lib/money";
import { Card, Segmented, Skeleton } from "@/components/app/ui";
import { cpa, ctr, dayLabel, roas, sum, type Day } from "./metrics";

type MetricId = "roas" | "spend" | "cpa" | "ctr";

export type ChartMarker = { date: string; label: string };

/**
 * "Daily {metric}" bars (Campaign detail, guide §5.3): ROAS / Spend / CPA /
 * CTR switch, hover or arrow keys update the header readout. Markers are
 * dashed lines with a label for events from the change log (budget changes,
 * pauses, publish).
 */
export function DailyMetricChart({
  days,
  currency,
  markers = [],
  loading = false,
  className,
}: {
  days: Day[];
  currency: string | null;
  /** Events to mark on the chart (same-day events are combined). */
  markers?: ChartMarker[];
  loading?: boolean;
  className?: string;
}) {
  const [metric, setMetric] = useState<MetricId>("roas");
  const [hover, setHover] = useState<number | null>(null);
  // Chart width, for laying out marker labels without overlaps.
  const plotRef = useRef<HTMLDivElement>(null);
  const [plotW, setPlotW] = useState(600);
  useEffect(() => {
    const el = plotRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(([e]) => setPlotW(e.contentRect.width || 600));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const DEF: Record<MetricId, { name: string; get: (d: Day) => number | null; fmt: (v: number) => string; total?: (ds: Day[]) => number | null }> = {
    roas: { name: "ROAS", get: (d) => roas(d), fmt: (v) => `${v.toFixed(2)}x`, total: (ds) => roas(sum(ds)) },
    spend: { name: "spend", get: (d) => d.spend, fmt: (v) => fmtMoney(v, currency, { whole: v >= 100 }), total: (ds) => sum(ds).spend },
    cpa: { name: "cost per conversion", get: (d) => cpa(d), fmt: (v) => fmtMoney(v, currency), total: (ds) => cpa(sum(ds)) },
    ctr: { name: "CTR", get: (d) => ctr(d), fmt: (v) => `${v.toFixed(2)}%`, total: (ds) => ctr(sum(ds)) },
  };
  const def = DEF[metric];
  const values = days.map(def.get);
  const max = Math.max(0, ...values.map((v) => v ?? 0)) * 1.08 || 1;
  const total = def.total?.(days) ?? null;
  const h = hover !== null ? days[hover] : undefined;
  const hv = hover !== null ? values[hover] : null;
  const range = days.length ? `${dayLabel(days[0].date)} – ${dayLabel(days[days.length - 1].date)}` : "";
  const read = h
    ? { label: dayLabel(h.date), value: hv === null ? "No data" : def.fmt(hv) }
    : { label: range, value: total === null ? "No data yet" : `${metric === "spend" ? "Total" : "Overall"} ${def.fmt(total)}` };
  const empty = !loading && values.every((v) => !v);
  // One line per day; several events that day share it.
  const marks = Object.entries(
    markers.reduce<Record<string, string[]>>((acc, m) => {
      if (days.some((d) => d.date === m.date)) (acc[m.date] ??= []).push(m.label);
      return acc;
    }, {})
  )
    .map(([date, labels]) => {
      const i = days.findIndex((d) => d.date === date);
      const pos = ((i + 0.5) / days.length) * 100;
      return { date, pos, row: 0, label: labels.length > 1 ? `${labels[0]} +${labels.length - 1}` : labels[0], title: labels.join(" · ") };
    })
    .sort((a, b) => a.pos - b.pos);
  // Labels sit right of their line (left of it past 55%). Put each in the
  // first row where its estimated extent doesn't hit another label.
  const taken: [number, number][][] = [];
  for (const m of marks) {
    const x = (m.pos / 100) * plotW;
    const w = Math.min(180, m.label.length * 6.8 + 18);
    const span: [number, number] = m.pos > 55 ? [x - 6 - w, x - 6] : [x + 6, x + 6 + w];
    let row = 0;
    while (row < 2 && (taken[row] ?? []).some(([a, b]) => span[0] < b + 6 && span[1] > a - 6)) row++;
    (taken[row] ??= []).push(span);
    m.row = row;
  }
  const rows = marks.length ? Math.max(...marks.map((m) => m.row)) + 1 : 0;
  const step = Math.max(1, Math.round(days.length / 5));
  const xLabels = days.filter((_, i) => i % step === 0 || i === days.length - 1);

  const onKey = (e: KeyboardEvent) => {
    if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return e.key === "Escape" && setHover(null);
    e.preventDefault();
    const dir = e.key === "ArrowRight" ? 1 : -1;
    setHover((i) => (i === null ? (dir > 0 ? 0 : days.length - 1) : Math.min(days.length - 1, Math.max(0, i + dir))));
  };

  return (
    <Card className={cn("flex flex-col gap-4 px-6 pb-5 pt-[22px]", className)}>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="text-base font-semibold">Daily {def.name}</div>
          <div className="mt-0.5 text-[13px] tabular-nums text-ink-2" aria-live="polite">
            {loading ? <Skeleton className="mt-1 h-3.5 w-48" /> : (
              <>
                <span className="font-semibold text-ink">{read.label}</span> · {read.value}
              </>
            )}
          </div>
        </div>
        <Segmented
          label="Chart metric"
          value={metric}
          onChange={(m) => {
            setMetric(m);
            setHover(null);
          }}
          options={[
            { value: "roas", label: "ROAS" },
            { value: "spend", label: "Spend" },
            { value: "cpa", label: "CPA" },
            { value: "ctr", label: "CTR" },
          ]}
        />
      </div>
      <div
        ref={plotRef}
        className={cn("relative h-[230px] border-b border-line-2", !loading && !empty && (rows >= 3 ? "mt-[70px]" : rows === 2 ? "mt-12" : rows === 1 ? "mt-7" : ""))}
      >
        {!loading &&
          !empty &&
          marks.map((m) => (
            <div
              key={m.date}
              className={cn(
                "pointer-events-none absolute bottom-0 z-[1] w-0 border-l-[1.5px] border-dashed border-brand-mid",
                m.row === 2 ? "top-[-70px]" : m.row === 1 ? "top-[-48px]" : "top-[-26px]"
              )}
              style={{ left: `${m.pos}%` }}
            >
              <span
                title={m.title}
                className={cn(
                  "pointer-events-auto absolute top-[-2px] max-w-[180px] truncate whitespace-nowrap rounded-full bg-brand-soft px-2 py-px text-xs font-semibold text-brand-ink",
                  m.pos > 55 ? "right-1.5" : "left-1.5"
                )}
              >
                {m.label}
              </span>
            </div>
          ))}
        {loading ? (
          <Skeleton className="absolute inset-0" />
        ) : empty ? (
          <div className="absolute inset-0 flex items-center justify-center px-6 text-center text-sm text-ink-2">
            No {def.name} recorded in this period.
          </div>
        ) : (
          <div
            role="img"
            tabIndex={0}
            aria-label={`Daily ${def.name}, ${range}. ${read.value}. Use the arrow keys to read each day.`}
            onKeyDown={onKey}
            onMouseLeave={() => setHover(null)}
            onBlur={() => setHover(null)}
            className="absolute inset-0 flex items-end gap-[3px] rounded focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-brand-soft min-[600px]:gap-[5px]"
          >
            {days.map((d, i) => (
              <div key={d.date} onMouseEnter={() => setHover(i)} className="flex h-full flex-1 cursor-pointer items-end">
                <div
                  className={cn(
                    "w-full rounded-t transition-opacity",
                    i === days.length - 1 ? "bg-brand" : "bg-brand-mid",
                    hover !== null && hover !== i && "opacity-40"
                  )}
                  style={{ height: `${((values[i] ?? 0) / max) * 100}%` }}
                />
              </div>
            ))}
          </div>
        )}
      </div>
      <div className="flex justify-between text-xs text-ink-3" aria-hidden="true">
        {!loading && xLabels.map((d) => <span key={d.date}>{dayLabel(d.date)}</span>)}
      </div>
    </Card>
  );
}
