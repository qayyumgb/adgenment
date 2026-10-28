"use client";

import { Fragment, useMemo } from "react";
import { Flag, Play, Square, Star } from "lucide-react";
import type { Flight, KeyDate } from "@/lib/api";
import { cn } from "@/lib/cn";
import { PlatformBadge, type PlatformKey } from "@/components/app/ui";
import { DAY, addDays, fmtDay, fmtWeekday, fromYmd, lastDay, monday, startOfDay } from "./dates";

/**
 * The flight calendar as a list (C5): what starts, ends and which key dates
 * fall in the period, week by week. The default on phones.
 */

type Event =
  | { kind: "start" | "end"; day: Date; flight: Flight }
  | { kind: "key"; day: Date; key: KeyDate };

export function FlightAgenda({
  start,
  days,
  flights,
  keyDates,
  clientName,
  flagged,
  selectedId,
  onSelect,
}: {
  start: Date;
  days: number;
  flights: Flight[];
  keyDates: KeyDate[];
  clientName: (id: string | null) => string;
  flagged: Set<string>;
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  const weeks = useMemo(() => {
    const endT = start.getTime() + days * DAY;
    const inView = (d: Date) => d.getTime() >= start.getTime() && d.getTime() < endT;
    const events: Event[] = [];
    for (const f of flights) {
      const s = startOfDay(new Date(f.start));
      if (inView(s) && !f.startEstimated) events.push({ kind: "start", day: s, flight: f });
      const last = lastDay(f);
      if (last && inView(last) && !f.endEstimated) events.push({ kind: "end", day: last, flight: f });
    }
    for (const k of keyDates) if (inView(fromYmd(k.date))) events.push({ kind: "key", day: fromYmd(k.date), key: k });
    events.sort((a, b) => a.day.getTime() - b.day.getTime() || (a.kind === "key" ? -1 : b.kind === "key" ? 1 : 0));
    const byWeek = new Map<number, Event[]>();
    for (const e of events) {
      const w = monday(e.day).getTime();
      byWeek.set(w, [...(byWeek.get(w) ?? []), e]);
    }
    return [...byWeek.entries()].map(([w, list]) => ({ week: new Date(w), list }));
  }, [start, days, flights, keyDates]);

  const today = startOfDay(new Date()).getTime();
  const thisWeek = monday(new Date()).getTime();

  if (!weeks.length) return <p className="m-0 px-5 py-8 text-center text-sm text-ink-2">Nothing starts or ends in this period.</p>;

  return (
    <ol className="m-0 list-none p-0">
      {weeks.map(({ week, list }) => (
        <li key={week.getTime()} className="border-t border-line first:border-t-0">
          <div className={cn("bg-surface-2 px-5 py-1.5 text-xs font-semibold", week.getTime() === thisWeek ? "text-brand" : "text-ink-2")}>
            {week.getTime() === thisWeek && "This week · "}
            {fmtDay(week)} – {fmtDay(addDays(week, 6))}
          </div>
          <ul className="m-0 list-none p-0">
            {list.map((e, i) => {
              const past = e.day.getTime() < today;
              const isToday = e.day.getTime() === today;
              return (
                <Fragment key={i}>
                  {e.kind === "key" ? (
                    <li className={cn("flex items-center gap-3 px-5 py-2.5 text-sm", past && "opacity-60")}>
                      <span className="w-[86px] flex-none text-xs tabular-nums text-ink-3">{isToday ? "Today" : fmtWeekday(e.day)}</span>
                      <span className={cn("flex h-6 w-6 flex-none items-center justify-center rounded-full", e.key.peak ? "bg-warn-soft text-warn" : "bg-surface-2 text-ink-2")} aria-hidden="true">
                        <Star size={13} />
                      </span>
                      <span className={cn("font-medium", e.key.peak && "text-warn")}>
                        {e.key.name}
                        {e.key.approx && <span className="font-normal text-ink-3"> (date approx.)</span>}
                      </span>
                    </li>
                  ) : (
                    <li>
                      <button
                        type="button"
                        onClick={() => onSelect(e.flight.id)}
                        aria-pressed={selectedId === e.flight.id}
                        className={cn(
                          "flex w-full items-center gap-3 px-5 py-2.5 text-left text-sm hover:bg-surface-2 focus-visible:bg-surface-2 focus-visible:outline-none",
                          selectedId === e.flight.id && "bg-brand-soft/60",
                          past && "opacity-60"
                        )}
                      >
                        <span className="w-[86px] flex-none text-xs tabular-nums text-ink-3">{isToday ? "Today" : fmtWeekday(e.day)}</span>
                        <span
                          className={cn("flex h-6 w-6 flex-none items-center justify-center rounded-full", e.kind === "start" ? "bg-brand-soft text-brand" : "bg-surface-3 text-ink-2")}
                          aria-hidden="true"
                        >
                          {e.kind === "start" ? <Play size={12} /> : <Square size={11} />}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate font-medium">
                            {e.flight.name} {e.kind === "start" ? (e.flight.phase === "draft" ? "is planned to start" : "starts") : "ends"}
                          </span>
                          <span className="block truncate text-xs text-ink-3">
                            {clientName(e.flight.clientId)} · {e.flight.adAccountName}
                          </span>
                        </span>
                        {flagged.has(e.flight.id) && <Flag size={14} className="flex-none text-warn" aria-label="Worth a look" />}
                        <PlatformBadge platform={e.flight.platform as PlatformKey} size={20} />
                      </button>
                    </li>
                  )}
                </Fragment>
              );
            })}
          </ul>
        </li>
      ))}
    </ol>
  );
}
