"use client";

import clsx from "clsx";

/**
 * Generic skeleton card — used as a sized placeholder block.
 */
export function SkeletonCard({ className }: { className?: string }) {
  return (
    <div
      className={clsx(
        "animate-pulse rounded-2xl bg-slate-200/70",
        className
      )}
    />
  );
}

/**
 * Skeleton text lines — pass `lines` for multi-line paragraphs.
 */
export function SkeletonText({
  width = "full",
  lines = 1,
  className,
}: {
  width?: "full" | "half" | "sm" | "xs";
  lines?: number;
  className?: string;
}) {
  const widthClass =
    width === "full"
      ? "w-full"
      : width === "half"
        ? "w-1/2"
        : width === "sm"
          ? "w-24"
          : "w-12";

  return (
    <div className={clsx("space-y-2", className)}>
      {Array.from({ length: lines }).map((_, i) => (
        <div
          key={i}
          className={clsx(
            "h-3 animate-pulse rounded bg-slate-200/70",
            widthClass
          )}
        />
      ))}
    </div>
  );
}

/**
 * Mimics MetricCard layout — title pill, big number, badge + sparkline.
 */
export function SkeletonMetricCard() {
  return (
    <div className="metric-card">
      <div className="flex items-start justify-between">
        <div className="h-3 w-20 animate-pulse rounded bg-slate-200/70" />
        <div className="h-9 w-9 animate-pulse rounded-xl bg-slate-200/70" />
      </div>
      <div className="mt-3 h-8 w-32 animate-pulse rounded bg-slate-200/70" />
      <div className="mt-3 flex items-center justify-between gap-2">
        <div className="h-5 w-24 animate-pulse rounded-full bg-slate-200/70" />
        <div className="h-12 w-20 animate-pulse rounded bg-slate-200/70" />
      </div>
    </div>
  );
}

/**
 * Mimics a single table row.
 */
export function SkeletonTableRow({ cols = 6 }: { cols?: number }) {
  return (
    <tr className="border-t border-slate-50">
      {Array.from({ length: cols }).map((_, i) => (
        <td key={i} className="px-5 py-3.5">
          <div className="h-4 w-full animate-pulse rounded bg-slate-200/70" />
        </td>
      ))}
    </tr>
  );
}

/**
 * Mimics a campaign card in grid view.
 */
export function SkeletonCampaignCard() {
  return (
    <div className="rounded-2xl border border-slate-200/70 bg-white p-5 shadow-card">
      <div className="flex items-center justify-between">
        <div className="h-5 w-16 animate-pulse rounded-full bg-slate-200/70" />
        <div className="h-5 w-20 animate-pulse rounded-full bg-slate-200/70" />
      </div>
      <div className="mt-3 space-y-2">
        <div className="h-5 w-3/4 animate-pulse rounded bg-slate-200/70" />
        <div className="h-3 w-1/2 animate-pulse rounded bg-slate-200/70" />
      </div>
      <div className="mt-4 grid grid-cols-3 gap-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="space-y-2">
            <div className="h-2 w-12 animate-pulse rounded bg-slate-200/70" />
            <div className="h-4 w-16 animate-pulse rounded bg-slate-200/70" />
          </div>
        ))}
      </div>
      <div className="mt-4 border-t border-slate-100 pt-3">
        <div className="h-4 w-3/4 animate-pulse rounded bg-slate-200/70" />
      </div>
    </div>
  );
}

/**
 * Skeleton for a chart card — header + chart placeholder.
 */
export function SkeletonChartCard({ height = 288 }: { height?: number }) {
  return (
    <div className="rounded-2xl border border-slate-200/70 bg-white p-5 shadow-card">
      <div className="flex items-start justify-between">
        <div className="space-y-2">
          <div className="h-4 w-32 animate-pulse rounded bg-slate-200/70" />
          <div className="h-3 w-48 animate-pulse rounded bg-slate-200/70" />
        </div>
        <div className="h-8 w-24 animate-pulse rounded-xl bg-slate-200/70" />
      </div>
      <div
        className="mt-4 animate-pulse rounded-xl bg-slate-200/50"
        style={{ height }}
      />
    </div>
  );
}
