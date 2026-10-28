/**
 * Campaign dates → the times we send to Meta.
 *
 * The wizard saves calendar days ("2026-11-01") as UTC midnight. Sent as is,
 * a Pakistan account started at 05:00 and a New York one the evening before,
 * and an end date of 30 Nov stopped at the very start of 30 Nov. Meta runs ad
 * sets in the ad account's time zone, so a day means 00:00 to 23:59:59 there.
 */

/** Minutes the zone is ahead of UTC at instant t (Karachi: +300). */
function offsetMinutes(t: number, tz: string): number {
  const f = new Intl.DateTimeFormat("en-US", { timeZone: tz, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" });
  const p = Object.fromEntries(f.formatToParts(new Date(t)).map((x) => [x.type, x.value]));
  const asUtc = Date.UTC(Number(p.year), Number(p.month) - 1, Number(p.day), Number(p.hour), Number(p.minute), Number(p.second));
  return Math.round((asUtc - Math.floor(t / 1000) * 1000) / 60_000);
}

/** The instant of a wall-clock time on a calendar day in a time zone (UTC if the zone is unknown). */
export function zonedInstant(day: string, time: [number, number, number], tz: string | null | undefined): Date {
  const [y, m, d] = day.split("-").map(Number);
  const wall = Date.UTC(y, m - 1, d, ...time);
  if (!tz) return new Date(wall);
  try {
    // Twice, so a day when the clocks change still lands right.
    let t = wall - offsetMinutes(wall, tz) * 60_000;
    t = wall - offsetMinutes(t, tz) * 60_000;
    return new Date(t);
  } catch {
    return new Date(wall); // not a zone Intl knows
  }
}

/** Saved as a calendar day (exactly UTC midnight), not a real time from the platform. */
const isDay = (d: Date) => d.getUTCHours() === 0 && d.getUTCMinutes() === 0 && d.getUTCSeconds() === 0 && d.getUTCMilliseconds() === 0;
const dayOf = (d: Date) => d.toISOString().slice(0, 10);

/** Start: 00:00 on the day in the account's zone. Undefined when it's already past (Meta starts it now). */
export function metaStartTime(start: Date | null | undefined, tz: string | null | undefined, now = new Date()): string | undefined {
  if (!start) return undefined;
  const t = isDay(start) ? zonedInstant(dayOf(start), [0, 0, 0], tz) : start;
  return t.getTime() > now.getTime() ? t.toISOString() : undefined;
}

/** End: the end of the last day (23:59:59) in the account's zone. */
export function metaEndTime(end: Date | null | undefined, tz: string | null | undefined): string | undefined {
  if (!end) return undefined;
  return (isDay(end) ? zonedInstant(dayOf(end), [23, 59, 59], tz) : end).toISOString();
}
