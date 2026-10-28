import { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { escapeHtml } from "../lib/email";
import { changeLog } from "./change-log.service";
import { setStatus, statusBlocker, type CampaignWithAccount } from "./campaign-actions.service";
import { localParts } from "./notifications.service";
import { pixelRule, ruleEntries, type Done } from "./safety.service";

/**
 * Auto-pause (plan C6), set per campaign in the New campaign wizard or the
 * campaign's Settings tab. Meta only (Advertix pauses through the API):
 *
 * - **Spend cap:** pause once lifetime spend reaches the cap. Checked with the
 *   hourly safety pass, so it can run over by about an hour's spend.
 * - **Blackout dates:** paused on those days (workspace time zone), resumed
 *   the day after.
 * - **Tracking stops:** the C14 pixel rule for this one campaign.
 *
 * Like the safety rules: every pause is a RULE change-log entry with Undo, and
 * an Undo means hands off for that episode. Advertix resumes only after a
 * blackout ends (planned in advance), only what it paused, and only if nobody
 * changed the campaign since. After a cap pause a person turns it back on, so
 * the extra spend goes through Approvals like any launch. "Pause all
 * automation" stops it all.
 */

export type Blackout = { from: string; to: string; label?: string };

const DAY = 86_400_000;
const MAX_BLACKOUTS = 20;
const isDay = (s: unknown): s is string => typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(s));
const bad = (msg: string) => Object.assign(new Error(msg), { status: 400 });

export function blackoutsOf(v: Prisma.JsonValue | null | undefined): Blackout[] {
  if (!Array.isArray(v)) return [];
  return v.filter((b): b is Blackout => !!b && typeof b === "object" && isDay((b as Blackout).from) && isDay((b as Blackout).to));
}

/** Validate the auto-pause settings from a request body. */
export function parseAutoPause(input: { spendCap?: unknown; blackouts?: unknown; pauseOnTrackingLoss?: unknown }) {
  let spendCap: number | null = null;
  if (input.spendCap !== undefined && input.spendCap !== null && input.spendCap !== "") {
    const n = Number(input.spendCap);
    if (!Number.isFinite(n) || n <= 0 || n > 100_000_000) throw bad("The spend cap must be an amount above zero.");
    spendCap = Math.round(n * 100) / 100;
  }
  const raw = input.blackouts === undefined || input.blackouts === null ? [] : input.blackouts;
  if (!Array.isArray(raw)) throw bad("Blackout dates must be a list.");
  if (raw.length > MAX_BLACKOUTS) throw bad(`Up to ${MAX_BLACKOUTS} blackout periods.`);
  const blackouts: Blackout[] = raw.map((b: { from?: unknown; to?: unknown; label?: unknown }) => {
    if (!isDay(b?.from) || !isDay(b?.to)) throw bad("Each blackout needs a start and end date.");
    if (b.to < b.from) throw bad("A blackout can't end before it starts.");
    if (Date.parse(b.to) - Date.parse(b.from) > 366 * DAY) throw bad("A blackout can last a year at most.");
    const label = typeof b.label === "string" ? b.label.trim().slice(0, 60) : "";
    return { from: b.from, to: b.to, ...(label ? { label } : {}) };
  });
  blackouts.sort((a, b) => a.from.localeCompare(b.from));
  return { spendCap, blackouts, pauseOnTrackingLoss: input.pauseOnTrackingLoss === true };
}

async function lifetimeSpend(campaignIds: string[]) {
  if (!campaignIds.length) return new Map<string, number>();
  const agg = await prisma.campaignMetrics.groupBy({ by: ["campaignId"], where: { campaignId: { in: campaignIds } }, _sum: { spend: true } });
  return new Map(agg.map((a) => [a.campaignId, Number(a._sum.spend ?? 0)]));
}

const money = (n: number, c: string | null) => {
  try {
    return new Intl.NumberFormat("en-US", { style: "currency", currency: c ?? "USD", maximumFractionDigits: 0 }).format(n);
  } catch {
    return String(Math.round(n));
  }
};
const dayLabel = (d: string) => new Date(`${d}T00:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });

type Candidate = CampaignWithAccount & { spendCap: Prisma.Decimal | null; blackouts: Prisma.JsonValue | null; pauseOnTrackingLoss: boolean; endDate: Date | null };

/** What paused it last, if it was one of these rules and is still in effect (not undone). */
async function ourPause(campaignId: string) {
  const latest = await prisma.changeLog.findFirst({ where: { campaignId, action: "campaign.status" }, orderBy: { createdAt: "desc" } });
  const a = (latest?.after ?? {}) as Record<string, unknown>;
  if (!latest || latest.actorType !== "RULE" || a.status !== "PAUSED" || latest.undoneAt) return null;
  return a.rule === "SPEND_CAP" || a.rule === "BLACKOUT" ? { rule: a.rule as "SPEND_CAP" | "BLACKOUT", episode: String(a.episode), until: typeof a.until === "string" ? a.until : null } : null;
}

async function pause(c: Candidate, workspaceId: string, rule: "SPEND_CAP" | "BLACKOUT", episode: string, note: string, extra: Record<string, unknown>) {
  await setStatus(c, "PAUSED");
  await changeLog.record({ workspaceId, campaignId: c.id, campaignName: c.name, clientId: c.adAccount.clientId, action: "campaign.status", before: { status: "ACTIVE" }, after: { status: "PAUSED", rule, episode, ...extra }, actorType: "RULE", platformPushed: true, note });
}

async function resume(c: Candidate, workspaceId: string, rule: "SPEND_CAP" | "BLACKOUT", episode: string, note: string) {
  await setStatus(c, "ACTIVE");
  await changeLog.record({ workspaceId, campaignId: c.id, campaignName: c.name, clientId: c.adAccount.clientId, action: "campaign.status", before: { status: "PAUSED" }, after: { status: "ACTIVE", rule, episode, resumed: true }, actorType: "RULE", platformPushed: true, note });
}

/** Spend cap and blackouts for these campaigns. */
async function scheduleRules(workspaceId: string, campaigns: Candidate[], today: string, now: Date, canResume = true): Promise<Done[]> {
  const spend = await lifetimeSpend(campaigns.filter((c) => c.spendCap != null || c.status === "PAUSED").map((c) => c.id));
  const done: Done[] = [];
  for (const c of campaigns) {
    if (statusBlocker(c)) continue;
    const ended = !!c.endDate && c.endDate < now;
    const cap = c.spendCap != null ? Number(c.spendCap) : null;
    const spent = spend.get(c.id) ?? 0;
    const blackout = blackoutsOf(c.blackouts).find((b) => b.from <= today && today <= b.to);
    try {
      if (c.status === "ACTIVE") {
        if (cap != null && spent >= cap) {
          const episode = `${c.id}:cap:${cap}`;
          if ((await ruleEntries([c.id], "SPEND_CAP", episode)).length) continue; // paused already at this cap, or someone undid it
          await pause(c, workspaceId, "SPEND_CAP", episode, "(auto-pause: spend cap reached)", { spent });
          done.push({ clientId: c.adAccount.clientId, key: `spendcap:${episode}`, line: `Paused <strong>${escapeHtml(c.name)}</strong>: it has spent ${money(spent, c.adAccount.currency)} of its ${money(cap, c.adAccount.currency)} cap` });
        } else if (blackout && !ended) {
          const episode = `${c.id}:blackout:${blackout.from}:${blackout.to}`;
          if ((await ruleEntries([c.id], "BLACKOUT", episode)).length) continue;
          await pause(c, workspaceId, "BLACKOUT", episode, `(auto-pause: blackout dates${blackout.label ? `, ${blackout.label}` : ""})`, { until: blackout.to });
          done.push({ clientId: c.adAccount.clientId, key: `blackout:${episode}`, line: `Paused <strong>${escapeHtml(c.name)}</strong> for ${blackout.label ? `${escapeHtml(blackout.label)}, ` : "its blackout dates, "}${dayLabel(blackout.from)}${blackout.to !== blackout.from ? ` – ${dayLabel(blackout.to)}` : ""}. It resumes the day after.` });
        }
      } else if (canResume && c.status === "PAUSED" && !ended) {
        const ours = await ourPause(c.id);
        // Back on the day after the blackout it paused for, unless the cap or another blackout holds it.
        if (ours?.rule !== "BLACKOUT" || !ours.until || today <= ours.until || blackout || (cap != null && spent >= cap)) continue;
        await resume(c, workspaceId, "BLACKOUT", ours.episode, "(auto-pause: blackout dates over)");
        done.push({ clientId: c.adAccount.clientId, key: `blackout:${ours.episode}:resume`, line: `Resumed <strong>${escapeHtml(c.name)}</strong>: its blackout dates are over` });
      }
    } catch (err) {
      console.error(`[auto-pause] ${c.id}:`, err instanceof Error ? err.message : err);
    }
  }
  return done;
}

const candidateInclude = { adAccount: true } as const;
const pausedByUs: Prisma.ChangeLogWhereInput = {
  actorType: "RULE",
  action: "campaign.status",
  undoneAt: null,
  after: { path: ["rule"], equals: "BLACKOUT" },
};
/** Campaigns with a rule, or paused for a blackout (since removed, it still needs its resume). */
const candidateWhere = (workspaceId: string): Prisma.CampaignWhereInput => ({
  workspaceId,
  platform: "META",
  externalId: { not: null },
  OR: [
    { spendCap: { not: null } },
    { pauseOnTrackingLoss: true },
    { blackouts: { not: Prisma.DbNull } },
    { status: "PAUSED", changeLogs: { some: pausedByUs } },
  ],
});

/** The hourly pass (from the safety scheduler). `pixelClients`: clients whose own C14 pixel rule already covers them. */
export async function runAutoPause(workspaceId: string, pixelClients: Set<string>, now = new Date()): Promise<Done[]> {
  const ws = await prisma.workspace.findUniqueOrThrow({ where: { id: workspaceId }, select: { timezone: true, automationPaused: true } });
  if (ws.automationPaused) return [];
  const campaigns = (await prisma.campaign.findMany({ where: candidateWhere(workspaceId), include: candidateInclude })) as Candidate[];
  if (!campaigns.length) return [];
  const today = localParts(now, ws.timezone).date;
  const done = await scheduleRules(workspaceId, campaigns, today, now);
  const tracking = new Set(campaigns.filter((c) => c.pauseOnTrackingLoss && !(c.adAccount.clientId && pixelClients.has(c.adAccount.clientId))).map((c) => c.id));
  if (tracking.size) {
    try {
      done.push(...(await pixelRule(workspaceId, null, now, tracking)));
    } catch (err) {
      console.error("[auto-pause] tracking:", err instanceof Error ? err.message : err);
    }
  }
  return done;
}

/** Workspaces the hourly pass needs to visit for auto-pause. */
export const autoPauseWorkspaceWhere: Prisma.CampaignListRelationFilter = {
  some: {
    platform: "META",
    OR: [{ spendCap: { not: null } }, { pauseOnTrackingLoss: true }, { blackouts: { not: Prisma.DbNull } }, { status: "PAUSED", changeLogs: { some: pausedByUs } }],
  },
};

export function autoPauseOf(c: { spendCap: Prisma.Decimal | null; blackouts: Prisma.JsonValue | null; pauseOnTrackingLoss: boolean }) {
  return { spendCap: c.spendCap != null ? Number(c.spendCap) : null, blackouts: blackoutsOf(c.blackouts), pauseOnTrackingLoss: c.pauseOnTrackingLoss };
}

/**
 * Save a campaign's auto-pause settings, then check it straight away: a
 * blackout that covers today or a cap already reached pauses it now. Returns
 * the settings and what was done.
 */
export async function saveAutoPause(workspaceId: string, campaignId: string, input: Parameters<typeof parseAutoPause>[0], now = new Date()) {
  const c = await prisma.campaign.findFirst({ where: { id: campaignId, workspaceId }, select: { id: true, platform: true } });
  if (!c) throw Object.assign(new Error("Campaign not found"), { status: 404 });
  if (c.platform !== "META") throw Object.assign(new Error("Auto-pause works on Meta campaigns for now."), { status: 409 });
  const rules = parseAutoPause(input);
  const saved = await prisma.campaign.update({
    where: { id: campaignId },
    // An empty list stays a list (not null), so a blackout removed mid-way still gets its resume.
    data: { spendCap: rules.spendCap, blackouts: rules.blackouts as unknown as Prisma.InputJsonValue, pauseOnTrackingLoss: rules.pauseOnTrackingLoss },
    include: candidateInclude,
  });
  let acted: Done[] = [];
  const ws = await prisma.workspace.findUniqueOrThrow({ where: { id: workspaceId }, select: { timezone: true, automationPaused: true } });
  if (!ws.automationPaused && saved.externalId) {
    // Pauses only: turning a campaign back on is a person's call (and goes through Approvals).
    acted = await scheduleRules(workspaceId, [saved as Candidate], localParts(now, ws.timezone).date, now, false);
  }
  return { autoPause: autoPauseOf(saved), status: acted.length ? (await prisma.campaign.findUniqueOrThrow({ where: { id: campaignId }, select: { status: true } })).status : saved.status, acted: acted.map((d) => d.line.replace(/<[^>]+>/g, "")) };
}
