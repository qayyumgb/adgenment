import type { Flight, KeyDate } from "@/lib/api";

/** Calendar maths for the flight calendar (C5), in the viewer's local time. */

export const DAY = 86_400_000;

export type Zoom = "month" | "quarter" | "half";
export const ZOOMS: Record<Zoom, { label: string; days: number; lead: number; step: number }> = {
  // days shown, weeks shown before today, weeks moved by ‹ ›
  month: { label: "5 weeks", days: 35, lead: 1, step: 2 },
  quarter: { label: "3 months", days: 91, lead: 2, step: 6 },
  half: { label: "6 months", days: 182, lead: 4, step: 12 },
};

export function startOfDay(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}
export function addDays(d: Date, n: number) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
}
/** Monday of d's week. */
export function monday(d: Date) {
  const s = startOfDay(d);
  return addDays(s, -((s.getDay() + 6) % 7));
}
export function ymd(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
/** A key date (YYYY-MM-DD) as local midnight. */
export function fromYmd(s: string) {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
}
/** Window that shows today near the start. */
export function defaultStart(zoom: Zoom, today = new Date()) {
  return addDays(monday(today), -7 * ZOOMS[zoom].lead);
}

const dm = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short" });
const dmy = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric" });
const wdm = new Intl.DateTimeFormat("en-GB", { weekday: "short", day: "numeric", month: "short" });

/** "3 Nov" */
export const fmtDay = (d: Date) => dm.format(d);
/** "Tue 3 Nov" */
export const fmtWeekday = (d: Date) => wdm.format(d);
/** "3 Nov – 1 Dec 2026", or with both years when they differ. */
export function fmtRange(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() ? `${dm.format(a)} – ${dmy.format(b)}` : `${dmy.format(a)} – ${dmy.format(b)}`;
}

/** The last day a flight runs (its end is exclusive at midnight → the day before). */
export function lastDay(f: Flight) {
  if (!f.end) return null;
  const end = new Date(f.end);
  return startOfDay(end).getTime() === end.getTime() ? addDays(end, -1) : startOfDay(end);
}

/** "3 Nov – 1 Dec 2026 · 29 days" / "Since 1 Sep 2026 · no end date" */
export function flightDates(f: Flight) {
  const start = new Date(f.start);
  const last = lastDay(f);
  if (!last) return `${start > new Date() ? "From" : "Since"} ${dmy.format(start)} · no end date`;
  const days = Math.max(1, Math.round((startOfDay(last).getTime() - startOfDay(start).getTime()) / DAY) + 1);
  return `${fmtRange(start, last)} · ${days} day${days === 1 ? "" : "s"}`;
}

/** OUTCOME_SALES → "Sales" */
export function objectiveLabel(o: string) {
  const s = o.replace(/^OUTCOME_/, "").replace(/_/g, " ").toLowerCase();
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** Key dates close enough to share one marker at this zoom. */
export function groupKeyDates(dates: KeyDate[], days: number): KeyDate[][] {
  const near = Math.max(1, Math.ceil(days / 30));
  const out: KeyDate[][] = [];
  for (const k of dates) {
    const last = out[out.length - 1];
    if (last && (fromYmd(k.date).getTime() - fromYmd(last[last.length - 1].date).getTime()) / DAY <= near) last.push(k);
    else out.push([k]);
  }
  return out;
}

/** Pack flights into lanes so ones that don't overlap share a line. */
export function packLanes(flights: Flight[], minDays: number): Flight[][] {
  const lanes: { end: number; items: Flight[] }[] = [];
  const sorted = [...flights].sort((a, b) => a.start.localeCompare(b.start) || a.name.localeCompare(b.name));
  for (const f of sorted) {
    const s = new Date(f.start).getTime();
    // Short bars still need room for their label.
    const e = Math.max(f.end ? new Date(f.end).getTime() : Infinity, s + minDays * DAY);
    const lane = lanes.find((l) => l.end <= s);
    if (lane) {
      lane.items.push(f);
      lane.end = e;
    } else lanes.push({ end: e, items: [f] });
  }
  return lanes.map((l) => l.items);
}
