"use client";

import type { ReactNode } from "react";
import { Card, Segmented, Skeleton } from "@/components/app/ui";

export type ShareEntry = { key: string; label: string; icon?: ReactNode; value: number };

/** "Share of {metric}" by platform or client (Analytics, guide §5.7). */
export function SharePanel<B extends string>({
  metricLabel,
  entries,
  format,
  by,
  byOptions,
  onByChange,
  loading = false,
}: {
  metricLabel: string;
  entries: ShareEntry[];
  format: (v: number) => string;
  by: B;
  byOptions: { value: B; label: string }[];
  onByChange: (b: B) => void;
  loading?: boolean;
}) {
  const sorted = [...entries].filter((e) => e.value > 0).sort((a, b) => b.value - a.value);
  const total = sorted.reduce((n, e) => n + e.value, 0);
  return (
    <Card className="flex flex-col gap-4 px-5 py-[20px]">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-base font-semibold">Share of {metricLabel}</span>
        {byOptions.length > 1 && <Segmented label="Share by" size="sm" value={by} onChange={onByChange} options={byOptions} />}
      </div>
      {loading ? (
        <div className="flex flex-col gap-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-9" />
          ))}
        </div>
      ) : sorted.length === 0 ? (
        <p className="rounded-ctl bg-surface-2 p-3.5 text-sm text-ink-2">Nothing to compare in this period.</p>
      ) : (
        <ul className="flex flex-col gap-3.5">
          {sorted.map((e, i) => {
            const pct = (e.value / total) * 100;
            return (
              <li key={e.key} className="flex flex-col gap-1.5">
                <div className="flex items-center gap-2 text-sm">
                  {e.icon}
                  <span className="min-w-0 flex-1 truncate font-medium">{e.label}</span>
                  <span className="tabular-nums text-ink-2">{format(e.value)}</span>
                  <span className="w-10 text-right font-semibold tabular-nums">{Math.round(pct)}%</span>
                </div>
                <span className="h-1.5 overflow-hidden rounded-full bg-surface-3" aria-hidden="true">
                  <span className="block h-full rounded-full bg-brand" style={{ width: `${pct}%`, opacity: Math.max(0.35, 1 - i * 0.15) }} />
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}
