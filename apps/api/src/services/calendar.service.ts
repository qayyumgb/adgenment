import type { CampaignStatus, Platform, Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { campaignClientWhere } from "../lib/clients";
import { keyDates, peakWindow, type KeyDate } from "../lib/key-dates";

/**
 * Flight calendar (plan C5): every client's campaigns on one timeline, with
 * the overlaps worth a look and the key dates around them.
 *
 * Dates: the window is calendar days (the viewer's), padded a day each side
 * so every time zone gets what it shows; the page clips to what it draws.
 */

export type Phase = "live" | "scheduled" | "paused" | "draft" | "ended";

export type Flight = {
  id: string;
  name: string;
  platform: Platform;
  status: CampaignStatus;
  phase: Phase;
  objective: string;
  budget: number;
  budgetType: "DAILY" | "LIFETIME";
  currency: string;
  clientId: string | null;
  adAccountId: string;
  adAccountName: string;
  start: string;
  /** Null = runs until it's stopped. */
  end: string | null;
  /** No start date on the campaign: the bar starts when it was published or created. */
  startEstimated: boolean;
  /** Ended without an end date: the bar ends on its last day with spend. */
  endEstimated: boolean;
  audienceId: string | null;
};

export type Overlap = {
  clientId: string | null;
  platform: Platform;
  objective: string;
  adAccountName: string;
  campaignIds: string[];
  /** When at least two of them run at once (end null = no end yet). */
  from: string;
  to: string | null;
  /** They also use the same saved audience: they bid for the same people. */
  sameAudience: boolean;
};

export type PeakLaunch = { campaignId: string; keyDate: string; from: string; to: string };

const MAX = 1000;
const DAY = 86_400_000;

function phaseOf(status: CampaignStatus, start: Date, end: Date | null, now: Date): Phase {
  if (status === "ENDED" || (end && end <= now && status !== "DRAFT")) return "ended";
  if (status === "PAUSED") return "paused";
  if (status === "DRAFT") return "draft";
  return start > now ? "scheduled" : "live";
}

/** Same ad account, same objective, running at once: they compete in the same auctions. */
export function findOverlaps(flights: Flight[]): Overlap[] {
  const groups = new Map<string, Flight[]>();
  for (const f of flights) {
    if (f.phase !== "live" && f.phase !== "scheduled") continue;
    const key = `${f.adAccountId}|${f.platform}|${f.objective.toUpperCase()}`;
    groups.set(key, [...(groups.get(key) ?? []), f]);
  }
  const out: Overlap[] = [];
  const endOf = (f: Flight) => (f.end ? new Date(f.end).getTime() : Infinity);
  for (const list of groups.values()) {
    if (list.length < 2) continue;
    list.sort((a, b) => a.start.localeCompare(b.start));
    // Connected runs of overlapping flights.
    let run: Flight[] = [];
    let runEnd = -Infinity;
    const flush = () => {
      if (run.length < 2) return;
      let from = Infinity;
      let to = -Infinity;
      for (let i = 0; i < run.length; i++) {
        for (let j = i + 1; j < run.length; j++) {
          const s = Math.max(new Date(run[i].start).getTime(), new Date(run[j].start).getTime());
          const e = Math.min(endOf(run[i]), endOf(run[j]));
          if (s < e) {
            from = Math.min(from, s);
            to = Math.max(to, e);
          }
        }
      }
      if (from === Infinity) return;
      const aud = run[0].audienceId;
      out.push({
        clientId: run[0].clientId,
        platform: run[0].platform,
        objective: run[0].objective,
        adAccountName: run[0].adAccountName,
        campaignIds: run.map((f) => f.id),
        from: new Date(from).toISOString(),
        to: to === Infinity ? null : new Date(to).toISOString(),
        sameAudience: !!aud && run.every((f) => f.audienceId === aud),
      });
    };
    for (const f of list) {
      if (new Date(f.start).getTime() < runEnd) {
        run.push(f);
      } else {
        flush();
        run = [f];
      }
      runEnd = Math.max(runEnd, endOf(f));
    }
    flush();
  }
  return out.sort((a, b) => a.from.localeCompare(b.from));
}

/** Not-yet-started campaigns that launch into the peak week, when ads cost the most and learning is slowest to pay off. */
export function findPeakLaunches(flights: Flight[], now: Date): PeakLaunch[] {
  const out: PeakLaunch[] = [];
  for (const f of flights) {
    if (f.phase !== "scheduled" && f.phase !== "draft") continue;
    const start = new Date(f.start);
    if (start < now) continue;
    const day = f.start.slice(0, 10);
    const peak = peakWindow(start.getUTCFullYear());
    // Starting in the few days before counts too: learning would land on the peak.
    const from = new Date(new Date(`${peak.from}T00:00:00Z`).getTime() - 3 * DAY).toISOString().slice(0, 10);
    if (day >= from && day <= peak.to) out.push({ campaignId: f.id, keyDate: "Black Friday", from: peak.from, to: peak.to });
  }
  return out;
}

const isDay = (s: unknown): s is string => typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(s));

/** Validate ?from=&to= (calendar days, at most ~13 months apart). */
export function parseWindow(from: unknown, to: unknown): { from: string; to: string } | null {
  if (!isDay(from) || !isDay(to) || to < from) return null;
  if (Date.parse(to) - Date.parse(from) > 400 * DAY) return null;
  return { from, to };
}

export async function flightCalendar(workspaceId: string, clientId: string | null, window: { from: string; to: string }, now = new Date()) {
  const lo = new Date(Date.parse(window.from) - DAY);
  const hi = new Date(Date.parse(window.to) + 2 * DAY);

  const where: Prisma.CampaignWhereInput = {
    workspaceId,
    ...campaignClientWhere(clientId),
    AND: [
      // Starts before the window ends (no start: placed on publish/create, filtered below).
      { OR: [{ startDate: null }, { startDate: { lt: hi } }] },
      // Ends after it starts, or hasn't an end date.
      { OR: [{ endDate: null }, { endDate: { gte: lo } }] },
      // Drafts without a start date aren't on the calendar.
      { NOT: { status: "DRAFT", startDate: null } },
    ],
  };
  const [rows, clients, undated] = await Promise.all([
    prisma.campaign.findMany({
      where,
      select: {
        id: true,
        name: true,
        platform: true,
        status: true,
        objective: true,
        budget: true,
        budgetType: true,
        startDate: true,
        endDate: true,
        publishedAt: true,
        createdAt: true,
        audienceId: true,
        adAccountId: true,
        adAccount: { select: { clientId: true, accountName: true, currency: true } },
      },
      orderBy: [{ startDate: "asc" }, { createdAt: "asc" }],
      take: MAX + 1,
    }),
    prisma.client.findMany({
      where: { workspaceId, ...(clientId ? { id: clientId } : {}) },
      select: { id: true, name: true, isDefault: true },
      orderBy: [{ isDefault: "desc" }, { name: "asc" }],
    }),
    prisma.campaign.count({ where: { workspaceId, ...campaignClientWhere(clientId), status: "DRAFT", startDate: null } }),
  ]);
  const truncated = rows.length > MAX;
  const list = rows.slice(0, MAX);

  // Ended with no end date (archived/deleted on the platform): end on the last day with spend.
  const noEnd = list.filter((c) => c.status === "ENDED" && !c.endDate).map((c) => c.id);
  const lastDay = new Map<string, Date>();
  if (noEnd.length) {
    const agg = await prisma.campaignMetrics.groupBy({ by: ["campaignId"], where: { campaignId: { in: noEnd } }, _max: { date: true } });
    for (const a of agg) if (a._max.date) lastDay.set(a.campaignId, a._max.date);
  }

  const flights: Flight[] = [];
  for (const c of list) {
    const start = c.startDate ?? c.publishedAt ?? c.createdAt;
    let end = c.endDate;
    let endEstimated = false;
    if (c.status === "ENDED" && !end) {
      const last = lastDay.get(c.id);
      if (!last) continue; // never ran: nothing to draw
      end = new Date(last.getTime() + DAY);
      endEstimated = true;
    }
    if (start >= hi || (end && end < lo)) continue;
    if (end && end < start) end = start;
    flights.push({
      id: c.id,
      name: c.name,
      platform: c.platform,
      status: c.status,
      phase: phaseOf(c.status, start, end, now),
      objective: c.objective,
      budget: Number(c.budget),
      budgetType: c.budgetType,
      currency: c.adAccount.currency ?? "USD",
      clientId: c.adAccount.clientId,
      adAccountId: c.adAccountId,
      adAccountName: c.adAccount.accountName ?? "Ad account",
      start: start.toISOString(),
      end: end ? end.toISOString() : null,
      startEstimated: !c.startDate,
      endEstimated,
      audienceId: c.audienceId,
    });
  }

  // Key dates: a little either side so markers at the edges aren't lost.
  const kd: KeyDate[] = keyDates(lo.toISOString().slice(0, 10), hi.toISOString().slice(0, 10));

  return {
    from: window.from,
    to: window.to,
    now: now.toISOString(),
    clients: clients.map(({ id, name }) => ({ id, name })),
    flights,
    overlaps: findOverlaps(flights),
    peakLaunches: findPeakLaunches(flights, now),
    keyDates: kd,
    undatedDrafts: undated,
    truncated,
  };
}
