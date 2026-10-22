import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import { DeltaPill, Skeleton } from "./Display";

/**
 * 14-bar sparkline (guide §4): last bar brand, the rest brand-soft-2,
 * heights scaled to 25–100%.
 */
export function Sparkline({ values, bars = 14, className }: { values: number[]; bars?: number; className?: string }) {
  const pts = values.slice(-bars);
  if (pts.length === 0) return <div className={cn("h-7", className)} aria-hidden="true" />;
  const max = Math.max(...pts);
  const min = Math.min(...pts);
  const span = max - min || 1;
  return (
    <div className={cn("flex h-7 items-end gap-[3px]", className)} aria-hidden="true">
      {pts.map((v, i) => (
        <span
          key={i}
          className={cn("flex-1 rounded-[2px]", i === pts.length - 1 ? "bg-brand" : "bg-brand-soft-2")}
          style={{ height: `${25 + ((v - min) / span) * 75}%` }}
        />
      ))}
    </div>
  );
}

/**
 * KPI card (guide §4): label 13/500, delta pill top right, value 26–32/600,
 * optional sparkline. `selected` + `onClick` make it a chart selector
 * (Analytics).
 */
export function KpiCard({
  label,
  value,
  delta,
  higherIsBetter = true,
  deltaFormat,
  spark,
  sub,
  loading = false,
  selected = false,
  onClick,
  className,
}: {
  label: string;
  value: ReactNode;
  /** % change vs previous period; omit to hide the pill. */
  delta?: number | null;
  higherIsBetter?: boolean;
  /** Pill text, e.g. an absolute ROAS change ("0.18"). Defaults to "12.4%". */
  deltaFormat?: (v: number) => string;
  spark?: number[];
  /** Small line under the value (e.g. "of $50,000"). */
  sub?: ReactNode;
  loading?: boolean;
  selected?: boolean;
  onClick?: () => void;
  className?: string;
}) {
  const interactive = typeof onClick === "function";
  const Tag = interactive ? "button" : "div";
  return (
    <Tag
      {...(interactive ? { type: "button" as const, onClick, "aria-pressed": selected } : {})}
      className={cn(
        "flex min-w-0 flex-col gap-2.5 rounded-card border bg-surface px-[18px] pb-4 pt-[18px] text-left shadow-card",
        selected ? "border-brand/40 bg-brand-soft" : "border-line",
        interactive && "transition-[transform,box-shadow] hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-brand-soft motion-reduce:hover:translate-y-0",
        className
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-[13px] font-medium text-ink-2">{label}</span>
        {delta !== undefined && !loading && <DeltaPill value={delta} higherIsBetter={higherIsBetter} format={deltaFormat} />}
      </div>
      {loading ? (
        <Skeleton className="h-8 w-28" />
      ) : (
        <span className="text-[30px] font-semibold leading-[1.1] tracking-[-0.03em] tabular-nums">{value}</span>
      )}
      {sub && !loading && <span className="-mt-1 text-xs text-ink-3">{sub}</span>}
      {spark && (loading ? <Skeleton className="h-7 w-full" /> : <Sparkline values={spark} />)}
    </Tag>
  );
}
