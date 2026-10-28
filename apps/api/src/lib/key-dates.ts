/**
 * Key dates for the flight calendar (plan C5): the retail, seasonal and
 * cultural days that move ad prices and plans. Fixed and rule-based dates
 * are computed for any year; lunar ones come from the table below and are
 * marked approximate (they can shift a day with the moon sighting).
 */

export type KeyDateGroup = "retail" | "seasonal" | "cultural";

export type KeyDate = {
  /** Calendar date, YYYY-MM-DD (no time zone: it's the same day everywhere). */
  date: string;
  name: string;
  group: KeyDateGroup;
  /** Lunar dates: may move by a day. */
  approx?: boolean;
  /** The costliest days of the year to buy ads (Black Friday to Cyber Monday). */
  peak?: boolean;
};

/** Lunar and lunisolar dates by year. Extend each autumn; years missing here are simply left out. */
const LUNAR: Record<number, { lunarNewYear: string; ramadan: string; eidFitr: string; eidAdha: string; diwali: string }> = {
  2025: { lunarNewYear: "01-29", ramadan: "03-01", eidFitr: "03-30", eidAdha: "06-06", diwali: "10-20" },
  2026: { lunarNewYear: "02-17", ramadan: "02-18", eidFitr: "03-20", eidAdha: "05-27", diwali: "11-08" },
  2027: { lunarNewYear: "02-06", ramadan: "02-08", eidFitr: "03-10", eidAdha: "05-16", diwali: "10-29" },
  2028: { lunarNewYear: "01-26", ramadan: "01-28", eidFitr: "02-26", eidAdha: "05-05", diwali: "10-17" },
};

const pad = (n: number) => String(n).padStart(2, "0");
const ymd = (y: number, m: number, d: number) => `${y}-${pad(m)}-${pad(d)}`;

/** The n-th given weekday (0 = Sunday) of a month, as a day of the month. */
function nthWeekday(year: number, month: number, weekday: number, n: number) {
  const first = new Date(Date.UTC(year, month - 1, 1)).getUTCDay();
  return 1 + ((weekday - first + 7) % 7) + (n - 1) * 7;
}

/** Easter Sunday (Gregorian, anonymous algorithm) as [month, day]. */
function easter(year: number): [number, number] {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  return [Math.floor((h + l - 7 * m + 114) / 31), ((h + l - 7 * m + 114) % 31) + 1];
}

/** Shift a YYYY-MM-DD by whole days. */
function addDays(date: string, days: number) {
  const t = new Date(`${date}T00:00:00Z`);
  t.setUTCDate(t.getUTCDate() + days);
  return t.toISOString().slice(0, 10);
}

function yearDates(y: number): KeyDate[] {
  const [em, ed] = easter(y);
  const easterDay = ymd(y, em, ed);
  const thanksgiving = ymd(y, 11, nthWeekday(y, 11, 4, 4));
  const out: KeyDate[] = [
    { date: ymd(y, 1, 1), name: "New Year's Day", group: "seasonal" },
    { date: ymd(y, 2, 14), name: "Valentine's Day", group: "seasonal" },
    { date: addDays(easterDay, -21), name: "Mothering Sunday (UK)", group: "seasonal" },
    { date: easterDay, name: "Easter", group: "seasonal" },
    { date: ymd(y, 5, nthWeekday(y, 5, 0, 2)), name: "Mother's Day (US)", group: "seasonal" },
    { date: ymd(y, 6, nthWeekday(y, 6, 0, 3)), name: "Father's Day", group: "seasonal" },
    { date: ymd(y, 10, 31), name: "Halloween", group: "seasonal" },
    { date: ymd(y, 11, 11), name: "Singles' Day", group: "retail" },
    { date: thanksgiving, name: "Thanksgiving (US)", group: "seasonal" },
    { date: addDays(thanksgiving, 1), name: "Black Friday", group: "retail", peak: true },
    { date: addDays(thanksgiving, 4), name: "Cyber Monday", group: "retail", peak: true },
    { date: ymd(y, 12, 25), name: "Christmas", group: "retail" },
    { date: ymd(y, 12, 26), name: "Boxing Day", group: "retail" },
    { date: ymd(y, 12, 31), name: "New Year's Eve", group: "seasonal" },
  ];
  const lunar = LUNAR[y];
  if (lunar) {
    out.push(
      { date: `${y}-${lunar.lunarNewYear}`, name: "Lunar New Year", group: "cultural" },
      { date: `${y}-${lunar.ramadan}`, name: "Ramadan begins", group: "cultural", approx: true },
      { date: `${y}-${lunar.eidFitr}`, name: "Eid al-Fitr", group: "cultural", approx: true },
      { date: `${y}-${lunar.eidAdha}`, name: "Eid al-Adha", group: "cultural", approx: true },
      { date: `${y}-${lunar.diwali}`, name: "Diwali", group: "cultural" }
    );
  }
  return out;
}

/** Key dates from `from` to `to` (YYYY-MM-DD, both included), in date order. */
export function keyDates(from: string, to: string): KeyDate[] {
  const out: KeyDate[] = [];
  for (let y = Number(from.slice(0, 4)); y <= Number(to.slice(0, 4)); y++) {
    for (const k of yearDates(y)) if (k.date >= from && k.date <= to) out.push(k);
  }
  return out.sort((a, b) => a.date.localeCompare(b.date) || a.name.localeCompare(b.name));
}

/** The peak buying window of a year: Thanksgiving (US) to Cyber Monday. */
export function peakWindow(year: number): { from: string; to: string } {
  const thanksgiving = ymd(year, 11, nthWeekday(year, 11, 4, 4));
  return { from: thanksgiving, to: addDays(thanksgiving, 4) };
}
