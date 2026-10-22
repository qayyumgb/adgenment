"use client";

import { useState, type KeyboardEvent } from "react";
import { cn } from "@/lib/cn";
import { fmtMoney } from "@/lib/money";
import { Card, Segmented, Skeleton } from "@/components/app/ui";

export type DayPoint = { date: string; spend: number; revenue: number };

const RANGES = [7, 14, 30] as const;
type Range = (typeof RANGES)[number];
const GAP: Record<Range, string> = { 7: "gap-[22px]", 14: "gap-2.5", 30: "gap-[5px]" };
const LABEL_STEP: Record<Range, number> = { 7: 1, 14: 3, 30: 6 };

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const dayLabel = (iso: string) => {
  const [, m, d] = iso.split("-").map(Number);
  return `${d} ${MONTHS[m - 1]}`;
};

/** Round the axis top up to a half step of its magnitude (e.g. 18,400 → 20,000). */
function niceMax(max: number) {
  if (max <= 0) return 1;
  const mag = Math.pow(10, Math.floor(Math.log10(max)));
  return Math.ceil(max / (mag / 2)) * (mag / 2);
}

/**
 * Spend & revenue bars (Overview, guide §5.1). Revenue sits behind spend.
 * Hovering (or arrow keys when focused) updates the readout in the header,
 * not a floating tooltip (guide §6).
 */
export function SpendRevenueChart({
  days,
  currency,
  loading = false,
  className,
}: {
  /** Daily points, oldest first; the chart shows the last 7 / 14 / 30. */
  days: DayPoint[];
  currency: string | null;
  loading?: boolean;
  className?: string;
}) {
  const [range, setRange] = useState<Range>(30);
  const [hover, setHover] = useState<number | null>(null);

  const shown = days.slice(-range);
  const top = niceMax(Math.max(0, ...shown.map((d) => Math.max(d.revenue, d.spend))));
  const sum = shown.reduce((a, d) => ({ spend: a.spend + d.spend, revenue: a.revenue + d.revenue }), { spend: 0, revenue: 0 });
  const h = hover !== null ? shown[hover] : undefined;
  const read = h ? { label: dayLabel(h.date), ...h } : { label: `Last ${range} days`, ...sum };
  const roas = read.spend > 0 ? `${(read.revenue / read.spend).toFixed(2)}x` : "—";
  const empty = !loading && sum.spend === 0 && sum.revenue === 0;
  const money = (n: number) => fmtMoney(n, currency, { whole: true });
  const axis = [0, 0.5, 1].map((f) => ({ pos: `${f * 100}%`, label: fmtMoney(f * top, currency, { compact: true }) }));
  const step = LABEL_STEP[range];
  const xLabels = shown.filter((_, i) => i % step === 0 || i === shown.length - 1);

  const onKey = (e: KeyboardEvent) => {
    if (!shown.length) return;
    if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
      e.preventDefault();
      const dir = e.key === "ArrowRight" ? 1 : -1;
      setHover((i) => (i === null ? (dir > 0 ? 0 : shown.length - 1) : Math.min(shown.length - 1, Math.max(0, i + dir))));
    } else if (e.key === "Escape") {
      setHover(null);
    }
  };

  return (
    <Card className={cn("flex flex-col gap-[18px] px-6 pb-5 pt-[22px]", className)}>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="text-base font-semibold">Spend & revenue</div>
          <div className="mt-0.5 text-[13px] tabular-nums text-ink-2" aria-live="polite">
            {loading ? (
              <Skeleton className="mt-1 h-3.5 w-64" />
            ) : (
              <>
                <span className="font-semibold text-ink">{read.label}</span> · Spend {money(read.spend)} · Revenue {money(read.revenue)} ·{" "}
                <span className="font-semibold text-brand-ink">ROAS {roas}</span>
              </>
            )}
          </div>
        </div>
        <Segmented
          label="Chart range"
          value={range}
          onChange={(r) => {
            setRange(r);
            setHover(null);
          }}
          options={RANGES.map((r) => ({ value: r, label: `${r}D` }))}
        />
      </div>

      <div className="grid grid-cols-[44px_minmax(0,1fr)] gap-2.5">
        <div className="relative h-[250px] text-xs tabular-nums text-ink-3" aria-hidden="true">
          {!loading &&
            !empty &&
            axis.map((a) => (
              <span key={a.pos} className="absolute right-0 translate-y-1/2" style={{ bottom: a.pos }}>
                {a.label}
              </span>
            ))}
        </div>
        <div className="relative h-[250px]">
          {axis.map((a) => (
            <div key={a.pos} className="absolute inset-x-0 border-t border-dashed border-line-2" style={{ bottom: a.pos }} aria-hidden="true" />
          ))}
          {loading ? (
            <Skeleton className="absolute inset-0" />
          ) : empty ? (
            <div className="absolute inset-0 flex items-center justify-center text-sm text-ink-2">No spend in the last {range} days.</div>
          ) : (
            <div
              role="img"
              tabIndex={0}
              aria-label={`Daily spend and revenue, last ${range} days. Spend ${money(sum.spend)}, revenue ${money(sum.revenue)}. Use the arrow keys to read each day.`}
              onKeyDown={onKey}
              onMouseLeave={() => setHover(null)}
              onBlur={() => setHover(null)}
              className={cn("absolute inset-0 flex items-end rounded focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-brand-soft", GAP[range])}
            >
              {shown.map((d, i) => (
                <div
                  key={d.date}
                  onMouseEnter={() => setHover(i)}
                  className={cn("relative h-full flex-1 cursor-pointer transition-opacity", hover !== null && hover !== i && "opacity-40")}
                >
                  <div className="absolute inset-x-0 bottom-0 rounded-t bg-brand-soft-2" style={{ height: `${(d.revenue / top) * 100}%` }} />
                  <div className="absolute inset-x-0 bottom-0 rounded-t bg-brand" style={{ height: `${(d.spend / top) * 100}%` }} />
                </div>
              ))}
            </div>
          )}
        </div>
        <div />
        <div className="flex justify-between text-xs text-ink-3" aria-hidden="true">
          {!loading && xLabels.map((d) => <span key={d.date}>{dayLabel(d.date)}</span>)}
        </div>
      </div>

      <div className="flex gap-[18px] text-[13px] text-ink-2">
        <span className="flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-[3px] bg-brand" aria-hidden="true" />
          Spend
        </span>
        <span className="flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-[3px] bg-brand-soft-2" aria-hidden="true" />
          Revenue
        </span>
      </div>
    </Card>
  );
}
