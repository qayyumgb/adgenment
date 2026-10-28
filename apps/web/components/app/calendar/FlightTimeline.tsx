"use client";

import { useMemo } from "react";
import { Pause } from "lucide-react";
import type { Flight, FlightPhase, KeyDate } from "@/lib/api";
import { cn } from "@/lib/cn";
import { PLATFORM_META, type PlatformKey } from "@/components/app/ui";
import { DAY, addDays, fmtDay, flightDates, fromYmd, groupKeyDates, monday, packLanes } from "./dates";

/**
 * The flight calendar's timeline (C5): a row per client, a bar per campaign
 * from start to end, today and the key dates as lines across. Positions are
 * percentages, so it fits any width without measuring.
 */

export const PHASE: Record<FlightPhase, { label: string; bar: string }> = {
  live: { label: "Live", bar: "bg-brand text-white" },
  scheduled: { label: "Scheduled", bar: "bg-brand-mid text-ink" },
  draft: { label: "Draft", bar: "border-[1.5px] border-dashed border-ink-3 bg-surface text-ink-2" },
  paused: { label: "Paused", bar: "bg-surface-3 text-ink-2" },
  ended: { label: "Ended", bar: "border border-line bg-surface-2 text-ink-3" },
};

export type ClientRow = { id: string | null; name: string; flights: Flight[] };

export function FlightTimeline({
  start,
  days,
  rows,
  keyDates,
  flagged,
  selectedId,
  onSelect,
}: {
  start: Date;
  days: number;
  rows: ClientRow[];
  keyDates: KeyDate[];
  /** Campaign ids with something to check (overlap, peak launch). */
  flagged: Set<string>;
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  const t0 = start.getTime();
  const span = days * DAY;
  const pct = (t: number) => ((t - t0) / span) * 100;
  const clamp = (n: number) => Math.min(100, Math.max(0, n));
  const now = Date.now();
  const todayPct = pct(now);

  const scale = useMemo(() => {
    const weeks: { left: number; label: string }[] = [];
    for (let d = monday(addDays(start, 6)); d.getTime() < t0 + span; d = addDays(d, 7)) weeks.push({ left: pct(d.getTime()), label: fmtDay(d) });
    const months: { left: number; label: string }[] = [];
    for (let d = new Date(start.getFullYear(), start.getMonth() + 1, 1); d.getTime() < t0 + span; d = new Date(d.getFullYear(), d.getMonth() + 1, 1)) {
      months.push({ left: pct(d.getTime()), label: d.toLocaleString("en-GB", { month: "short", year: d.getMonth() === 0 ? "numeric" : undefined }) });
    }
    // Name the month the window opens in, unless the next one starts right away.
    if (!months.length || months[0].left > 12) months.unshift({ left: 0, label: start.toLocaleString("en-GB", { month: "short", year: "numeric" }) });
    const weekends: number[] = [];
    if (days <= 35) for (let i = 0; i < days; i++) if ([0, 6].includes(addDays(start, i).getDay())) weekends.push(pct(addDays(start, i).getTime()));
    return { weeks, months, weekends };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [t0, days]);

  const markers = useMemo(
    () =>
      groupKeyDates(keyDates, days)
        .map((g) => ({ g, left: pct(fromYmd(g[0].date).getTime() + DAY / 2) }))
        .filter((m) => m.left >= 0 && m.left <= 100),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [keyDates, t0, days]
  );

  // Label room: ~9 days at 3 months, scaled to the zoom.
  const minDays = days / 10;

  return (
    <div className="overflow-x-auto">
      <div className="min-w-[760px] px-4 pb-7 pt-2 min-[720px]:px-5">
        <div className="grid grid-cols-[160px_minmax(0,1fr)] gap-3">
          <span />
          {/* Scale: months, week starts, key-date labels. */}
          <div className="relative h-[52px] text-[11px] text-ink-3" aria-hidden="true">
            {scale.months.map((m) => (
              <span key={m.left} className="absolute top-0 font-semibold text-ink-2" style={{ left: `${m.left}%` }}>
                {m.label}
              </span>
            ))}
            {days <= 182 &&
              scale.weeks.map((w, i) => (days > 91 && i % 2 ? null : (
                <span key={w.left} className="absolute top-[17px] -translate-x-1/2 whitespace-nowrap tabular-nums" style={{ left: `${w.left}%` }}>
                  {w.label}
                </span>
              )))}
            {markers.map(({ g, left }) => (
              <span
                key={g[0].date}
                title={g.map((k) => `${k.name} · ${fmtDay(fromYmd(k.date))}${k.approx ? " (approx.)" : ""}`).join("\n")}
                className={cn(
                  "absolute top-[34px] max-w-[132px] -translate-x-1/2 truncate whitespace-nowrap rounded px-1 font-semibold",
                  g.some((k) => k.peak) ? "bg-warn-soft text-warn" : "bg-surface-2 text-ink-2"
                )}
                style={{ left: `${Math.min(94, Math.max(4, left))}%` }}
              >
                {g[0].name}
                {g.length > 1 ? ` +${g.length - 1}` : ""}
              </span>
            ))}
          </div>
        </div>

        <div className="relative">
          {/* Lines across every row: weeks, weekends, key dates, today. */}
          <div className="pointer-events-none absolute inset-y-0 left-[172px] right-0" aria-hidden="true">
            {scale.weekends.map((l) => (
              <span key={l} className="absolute inset-y-0 bg-surface-2/70" style={{ left: `${l}%`, width: `${100 / days}%` }} />
            ))}
            {scale.weeks.map((w) => (
              <span key={w.left} className="absolute inset-y-0 border-l border-line" style={{ left: `${w.left}%` }} />
            ))}
            {markers.map(({ g, left }) => (
              <span key={g[0].date} className={cn("absolute inset-y-0 border-l border-dashed", g.some((k) => k.peak) ? "border-warn/70" : "border-ink-3/40")} style={{ left: `${left}%` }} />
            ))}
            {todayPct >= 0 && todayPct <= 100 && (
              <span className="absolute inset-y-0 z-10 border-l-2 border-brand" style={{ left: `${todayPct}%` }}>
                <span className="absolute -bottom-[18px] -translate-x-1/2 rounded bg-brand px-1 text-[10px] font-semibold leading-4 text-white">Today</span>
              </span>
            )}
          </div>

          {rows.map((row) => {
            const lanes = packLanes(row.flights, minDays);
            return (
              <div key={row.id ?? "none"} className="grid grid-cols-[160px_minmax(0,1fr)] gap-3 border-t border-line py-2">
                <div className="flex min-w-0 flex-col justify-center pr-1">
                  <span className="truncate text-[13px] font-semibold">{row.name}</span>
                  <span className="text-xs text-ink-3">
                    {row.flights.length} campaign{row.flights.length === 1 ? "" : "s"}
                  </span>
                </div>
                <div className="flex flex-col gap-1.5">
                  {lanes.map((lane, i) => (
                    <div key={i} className="relative h-7">
                      {lane.map((f) => {
                        const s = new Date(f.start).getTime();
                        const e = f.end ? new Date(f.end).getTime() : Infinity;
                        const left = clamp(pct(s));
                        const right = e === Infinity ? 100 : clamp(pct(e));
                        const cutL = s < t0;
                        const cutR = e > t0 + span;
                        const p = PLATFORM_META[f.platform as PlatformKey] ?? PLATFORM_META.META;
                        return (
                          <button
                            key={f.id}
                            type="button"
                            onClick={() => onSelect(f.id)}
                            aria-pressed={selectedId === f.id}
                            title={`${f.name}\n${PHASE[f.phase].label} · ${flightDates(f)}`}
                            className={cn(
                              "absolute inset-y-0 flex min-w-[10px] items-center gap-1.5 overflow-hidden whitespace-nowrap rounded-lg px-1.5 text-left text-xs font-semibold transition-shadow",
                              "focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-brand-soft",
                              PHASE[f.phase].bar,
                              cutL && "rounded-l-none",
                              cutR && "rounded-r-none",
                              !f.end && "[mask-image:linear-gradient(to_right,#000_85%,transparent)]",
                              flagged.has(f.id) && "ring-2 ring-warn",
                              selectedId === f.id && "ring-2 ring-ink ring-offset-1 ring-offset-surface"
                            )}
                            style={{ left: `${left}%`, width: `${Math.max(0, right - left)}%` }}
                          >
                            <span className={cn("flex h-4 min-w-4 flex-none items-center justify-center rounded px-0.5 text-[9px] font-bold", p.className)} aria-hidden="true">
                              {p.mark}
                            </span>
                            {f.phase === "paused" && <Pause size={11} aria-hidden="true" className="flex-none" />}
                            <span className="truncate">{f.name}</span>
                          </button>
                        );
                      })}
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/** The colour key, as in the mockup. */
export function PhaseLegend() {
  return (
    <span className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-ink-2">
      {(["live", "scheduled", "draft", "paused", "ended"] as FlightPhase[]).map((k) => (
        <span key={k} className="flex items-center gap-1.5">
          <span className={cn("h-2 w-3 rounded-[3px]", PHASE[k].bar)} aria-hidden="true" />
          {PHASE[k].label}
        </span>
      ))}
      <span className="flex items-center gap-1.5">
        <span className="h-2 w-3 rounded-[3px] ring-2 ring-inset ring-warn" aria-hidden="true" />
        Worth a look
      </span>
    </span>
  );
}
