import type { MetaScheduleBlock } from "../services/meta.service";

/**
 * A Meta ad set's hour schedule as a week grid (smart hours, C7). Meta takes
 * blocks of minutes per set of days; no blocks = runs around the clock.
 */

type Grid = boolean[][]; // [weekday 0 = Sunday][hour] = runs

/** Hours from `from` up to `to` (exclusive), wrapping past midnight. */
export function hourRange(from: number, to: number) {
  const out: number[] = [];
  for (let h = from; h !== to; h = (h + 1) % 24) out.push(h);
  return out;
}

export const hh = (h: number) => `${String(h % 24).padStart(2, "0")}:00`;

export function gridFromBlocks(blocks: MetaScheduleBlock[]): Grid {
  if (!blocks.length) return Array.from({ length: 7 }, () => Array(24).fill(true));
  const g: Grid = Array.from({ length: 7 }, () => Array(24).fill(false));
  for (const b of blocks) {
    for (const d of b.days) {
      if (d < 0 || d > 6) continue;
      for (let h = Math.floor(b.start_minute / 60); h < Math.ceil(b.end_minute / 60) && h < 24; h++) g[d][h] = true;
    }
  }
  return g;
}

/** Runs of on-hours per day, days with the same pattern grouped (what Meta's adset_schedule takes). */
export function blocksFromGrid(g: Grid): MetaScheduleBlock[] {
  const byRun = new Map<string, number[]>();
  for (let d = 0; d < 7; d++) {
    let h = 0;
    while (h < 24) {
      if (!g[d][h]) {
        h++;
        continue;
      }
      const start = h;
      while (h < 24 && g[d][h]) h++;
      const key = `${start * 60}-${h * 60}`;
      byRun.set(key, [...(byRun.get(key) ?? []), d]);
    }
  }
  return [...byRun.entries()].map(([k, days]) => {
    const [start_minute, end_minute] = k.split("-").map(Number);
    return { start_minute, end_minute, days, timezone_type: "ADVERTISER" as const };
  });
}

/** Around the clock, written out (Meta needs blocks once an ad set has a schedule). */
export const ALL_HOURS: MetaScheduleBlock[] = [{ start_minute: 0, end_minute: 1440, days: [0, 1, 2, 3, 4, 5, 6], timezone_type: "ADVERTISER" }];

/** The current schedule with these hours switched off on every day. */
export function withHoursOff(current: MetaScheduleBlock[], from: number, to: number): MetaScheduleBlock[] {
  const g = gridFromBlocks(current);
  for (const h of hourRange(from, to)) for (let d = 0; d < 7; d++) g[d][h] = false;
  return blocksFromGrid(g);
}

export const sameSchedule = (a: MetaScheduleBlock[], b: MetaScheduleBlock[]) => JSON.stringify(gridFromBlocks(a)) === JSON.stringify(gridFromBlocks(b));

/** "Off 00:00–06:00" / "Around the clock" / "Custom hours" for logs and the UI. */
export function describeSchedule(blocks: MetaScheduleBlock[]): string {
  const g = gridFromBlocks(blocks);
  const off = Array.from({ length: 24 }, (_, h) => g.every((day) => !day[h]));
  const anyOff = g.some((day) => day.some((on) => !on));
  if (!anyOff) return "around the clock";
  if (!g.every((day) => JSON.stringify(day) === JSON.stringify(g[0]))) return "custom hours";
  // One run of off-hours (possibly wrapping)?
  const starts = off.map((v, h) => v && !off[(h + 23) % 24]).reduce((n, v) => n + (v ? 1 : 0), 0);
  if (starts !== 1) return "custom hours";
  const from = off.findIndex((v, h) => v && !off[(h + 23) % 24]);
  let to = from;
  while (off[to]) to = (to + 1) % 24;
  return `off ${hh(from)}–${hh(to)}`;
}
