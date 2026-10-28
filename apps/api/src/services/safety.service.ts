import { prisma } from "../lib/prisma";
import { escapeHtml } from "../lib/email";
import { metaService } from "./meta.service";
import { changeLog } from "./change-log.service";
import { budgetBlocker, setDailyBudget, setStatus, statusBlocker, type CampaignWithAccount } from "./campaign-actions.service";
import { computePacing } from "./pacing.service";
import { notifyMembers } from "./notifications.service";
import { suggestionsService, type SetBudgetPayload } from "./suggestions.service";
import { autoPauseWorkspaceWhere, runAutoPause } from "./auto-pause.service";

/**
 * Safety rules (plan C14), opt-in per client in Settings › AI & automation:
 *
 * - **Pixel stopped firing:** when no pixel on a Meta ad account has fired
 *   for 24 hours (it had fired before), its active conversion campaigns are
 *   paused; once a pixel fires again, the ones this rule paused (and nobody
 *   touched since) are resumed.
 * - **Monthly cap running out:** when a client is on pace to overspend its
 *   monthly budget, its active Meta daily budgets are trimmed so the rest of
 *   the month fits, by at most the workspace's daily guardrail (default 20%),
 *   once a day.
 *
 * Every action is logged as automation (7-day Undo) and emailed (SAFETY). An
 * Undo means "hands off": the rule doesn't redo it in the same episode (until
 * the pixel recovers, or until next month). "Pause all automation" stops it.
 *
 * Auto-apply (plan C13) runs in the same pass, after the rules, for clients
 * set to "Auto-apply small changes": open Meta budget suggestions that move a
 * daily budget by at most the workspace limit (default 15%), one automatic
 * move per campaign per day. Never on "Ask first" clients, never a raise the
 * cap rule is holding down, never a suggestion someone undid.
 */

const HOUR = 3_600_000;
/** No pixel event for this long = stopped (a quiet night on a small site isn't). */
export const PIXEL_SILENT_MS = 24 * HOUR;
/** Pacing projections are too noisy before this day of the month (as the pacing alerts). */
const CAP_FROM_DAY = 5;
const CONVERSION_GOALS = new Set(["OFFSITE_CONVERSIONS", "VALUE"]);

export type Rule = "PIXEL" | "CAP" | "SPEND_CAP" | "BLACKOUT";
export type Done = { clientId: string | null; line: string; key: string };

const money = (n: number, c: string | null) => {
  try {
    return new Intl.NumberFormat("en-US", { style: "currency", currency: c ?? "USD", maximumFractionDigits: 0 }).format(n);
  } catch {
    return String(Math.round(n));
  }
};

/** Rule entries for these campaigns in this episode, newest first. */
export async function ruleEntries(campaignIds: string[], rule: Rule, episode: string) {
  if (!campaignIds.length) return [];
  const rows = await prisma.changeLog.findMany({ where: { campaignId: { in: campaignIds }, actorType: "RULE" }, orderBy: { createdAt: "desc" } });
  return rows.filter((r) => {
    const a = (r.after ?? {}) as Record<string, unknown>;
    return a.rule === rule && a.episode === episode;
  });
}

/* ── Pixel ───────────────────────────────────────────────────────────────── */

/**
 * The pixel rule for a client's conversion campaigns, or (`only`) for just the
 * campaigns that turned on "Pause if tracking stops" (C6) whatever their goal.
 */
export async function pixelRule(workspaceId: string, clientId: string | null, now: Date, only?: Set<string>): Promise<Done[]> {
  const accounts = only
    ? await prisma.adAccount.findMany({ where: { workspaceId, platform: "META", isActive: true, archivedAt: null, campaigns: { some: { id: { in: [...only] } } } } })
    : await prisma.adAccount.findMany({ where: { workspaceId, clientId, platform: "META", isActive: true, archivedAt: null } });
  const done: Done[] = [];
  for (const account of accounts) {
    const accountClient = account.clientId;
    let pixels;
    try {
      pixels = await metaService.getPixels(metaService.decryptToken(account.accessToken), account.accountId);
    } catch (err) {
      console.error(`[safety] pixels for ${account.id}:`, err instanceof Error ? err.message : err);
      continue;
    }
    const fired = pixels.map((p) => (p.lastFiredTime ? new Date(p.lastFiredTime).getTime() : 0)).filter((t) => t > 0);
    if (!fired.length) continue; // never fired = a setup problem (Connections shows it), not an outage
    const last = Math.max(...fired);
    const silent = now.getTime() - last > PIXEL_SILENT_MS;
    // One outage = one episode, named by the last event before it.
    const episode = `${account.id}:${new Date(last).toISOString()}`;

    const campaigns = (await prisma.campaign.findMany({
      where: { adAccountId: account.id, platform: "META", externalId: { not: null } },
      include: { adAccount: true, adSets: { where: { status: { not: "ENDED" } }, select: { optimizationGoal: true } } },
    })) as (CampaignWithAccount & { adSets: { optimizationGoal: string | null }[] })[];

    if (silent) {
      const targets = campaigns.filter((c) => c.status === "ACTIVE" && (only ? only.has(c.id) : c.adSets.some((s) => CONVERSION_GOALS.has(s.optimizationGoal ?? ""))) && !statusBlocker(c));
      const earlier = await ruleEntries(targets.map((c) => c.id), "PIXEL", episode);
      for (const c of targets) {
        if (earlier.some((e) => e.campaignId === c.id)) continue; // paused already this outage, or someone undid it
        try {
          await setStatus(c, "PAUSED");
        } catch (err) {
          console.error(`[safety] pause ${c.id}:`, err instanceof Error ? err.message : err);
          continue;
        }
        await changeLog.record({ workspaceId, campaignId: c.id, campaignName: c.name, clientId: accountClient, action: "campaign.status", before: { status: "ACTIVE" }, after: { status: "PAUSED", rule: "PIXEL", episode }, actorType: "RULE", platformPushed: true, note: "(safety rule: the pixel stopped firing)" });
        done.push({ clientId: accountClient, key: `pixel:${c.id}:${episode}:pause`, line: `Paused <strong>${escapeHtml(c.name)}</strong>: no pixel event on ${escapeHtml(account.accountName)} since ${new Date(last).toUTCString().slice(5, 22)} UTC` });
      }
    } else {
      // Firing again: resume what this rule paused in earlier outages, if it's still as the rule left it.
      const paused = campaigns.filter((c) => c.status === "PAUSED" && (!only || only.has(c.id)));
      for (const c of paused) {
        const latest = await prisma.changeLog.findFirst({ where: { campaignId: c.id, action: "campaign.status" }, orderBy: { createdAt: "desc" } });
        const a = (latest?.after ?? {}) as Record<string, unknown>;
        if (!latest || latest.actorType !== "RULE" || a.rule !== "PIXEL" || a.status !== "PAUSED" || latest.undoneAt || a.episode === episode) continue;
        try {
          await setStatus(c, "ACTIVE");
        } catch (err) {
          console.error(`[safety] resume ${c.id}:`, err instanceof Error ? err.message : err);
          continue;
        }
        await changeLog.record({ workspaceId, campaignId: c.id, campaignName: c.name, clientId: accountClient, action: "campaign.status", before: { status: "PAUSED" }, after: { status: "ACTIVE", rule: "PIXEL", episode: String(a.episode), resumed: true }, actorType: "RULE", platformPushed: true, note: "(safety rule: the pixel is firing again)" });
        done.push({ clientId: accountClient, key: `pixel:${c.id}:${String(a.episode)}:resume`, line: `Resumed <strong>${escapeHtml(c.name)}</strong>: the pixel on ${escapeHtml(account.accountName)} is firing again` });
      }
    }
  }
  return done;
}

/* ── Monthly cap ─────────────────────────────────────────────────────────── */

async function capRule(workspaceId: string, clientId: string, maxCutPct: number, now: Date): Promise<Done[]> {
  const pacing = await computePacing(workspaceId, clientId, undefined, now);
  const p = pacing.clients[0];
  if (!p || p.status !== "AHEAD" || p.mixedCurrency || !p.monthlyBudget || pacing.dayOfMonth < CAP_FROM_DAY) return [];
  const episode = `${clientId}:${pacing.month}`;
  const today = now.toISOString().slice(0, 10);

  const campaigns = (await prisma.campaign.findMany({
    where: { workspaceId, platform: "META", status: "ACTIVE", externalId: { not: null }, adAccount: { clientId, isActive: true, archivedAt: null } },
    include: { adAccount: true },
  })) as CampaignWithAccount[];
  const targets = campaigns.filter((c) => !budgetBlocker(c) && Number(c.budget) > 0);
  if (!targets.length) return [];

  const earlier = await ruleEntries(targets.map((c) => c.id), "CAP", episode);
  // Someone undid a cut this month: they've taken over this client's budgets.
  if (earlier.some((e) => e.undoneAt)) return [];
  if (earlier.some((e) => ((e.after ?? {}) as Record<string, unknown>).day === today)) return []; // once a day

  const daysLeft = Math.max(1, pacing.daysInMonth - pacing.dayOfMonth + 1);
  const remaining = Math.max(0, p.monthlyBudget - p.spent);
  const dailyRate = p.spent / Math.max(1, pacing.dayOfMonth);
  const wanted = dailyRate > 0 ? remaining / daysLeft / dailyRate : 0;
  const factor = Math.max(1 - maxCutPct / 100, Math.min(1, wanted));
  if (factor > 0.99) return [];

  const done: Done[] = [];
  for (const c of targets) {
    const from = Number(c.budget);
    const min = c.adAccount.minDailyBudget ?? 1;
    const to = Math.max(min, Math.round(from * factor * 100) / 100);
    if (to >= from - 0.01) continue;
    try {
      await setDailyBudget(c, to);
    } catch (err) {
      console.error(`[safety] cut ${c.id}:`, err instanceof Error ? err.message : err);
      continue;
    }
    await changeLog.record({ workspaceId, campaignId: c.id, campaignName: c.name, clientId, action: "campaign.budget", before: { budget: from, budgetType: c.budgetType }, after: { budget: to, budgetType: c.budgetType, rule: "CAP", episode, day: today }, currency: c.adAccount.currency, actorType: "RULE", platformPushed: true, note: "(safety rule: monthly budget running out)" });
    done.push({ clientId, key: `cap:${c.id}:${today}`, line: `Lowered <strong>${escapeHtml(c.name)}</strong> from ${money(from, c.adAccount.currency)} to ${money(to, c.adAccount.currency)} a day: ${escapeHtml(p.name)} is on pace to spend ${money(p.projected, p.currency)} of its ${money(p.monthlyBudget, p.currency)} budget` });
  }
  return done;
}

/* ── Auto-apply (C13) ────────────────────────────────────────────────────── */

async function autoApply(workspaceId: string, clientId: string, maxPct: number, now: Date): Promise<Done[]> {
  const today = now.toISOString().slice(0, 10);
  const month = today.slice(0, 7);
  const suggestions = await prisma.suggestion.findMany({
    where: {
      workspaceId,
      clientId,
      status: "OPEN",
      actionType: "SET_DAILY_BUDGET",
      AND: [{ OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] }, { OR: [{ suppressUntil: null }, { suppressUntil: { lte: now } }] }],
    },
    orderBy: [{ priority: "asc" }, { createdAt: "desc" }],
  });
  const done: Done[] = [];
  const moved = new Set<string>();
  for (const s of suggestions) {
    const p = s.actionPayload as Partial<SetBudgetPayload> | null;
    if (!p?.campaignId || !(Number(p.dailyBudget) > 0) || moved.has(p.campaignId)) continue;
    const c = (await prisma.campaign.findFirst({ where: { id: p.campaignId, workspaceId }, include: { adAccount: true } })) as CampaignWithAccount | null;
    if (!c || c.status !== "ACTIVE" || budgetBlocker(c)) continue;
    const from = Number(c.budget);
    const to = Number(p.dailyBudget);
    if (!(from > 0) || Math.abs(to - from) / from > maxPct / 100 + 1e-9 || Math.abs(to - from) < 0.01) continue;
    if (c.adAccount.minDailyBudget && to < c.adAccount.minDailyBudget) continue;

    // One automatic move per campaign per day (auto-apply or a safety rule), and
    // no raise while the cap rule is holding this client's budgets down.
    const recent = await prisma.changeLog.findMany({ where: { campaignId: c.id, actorType: { in: ["AI", "RULE"] }, actorUserId: null, createdAt: { gte: new Date(now.getTime() - 2 * 86_400_000) } } });
    const autoToday = recent.some((e) => {
      const a = (e.after ?? {}) as Record<string, unknown>;
      return a.auto === today || a.day === today;
    });
    if (autoToday) continue;
    if (to > from) {
      const held = await prisma.changeLog.findFirst({ where: { clientId, actorType: "RULE", action: "campaign.budget", undoneAt: null, after: { path: ["episode"], equals: `${clientId}:${month}` } } });
      if (held) continue;
    }

    try {
      await suggestionsService.apply(workspaceId, s.id, null, { day: today });
    } catch (err) {
      console.error(`[auto-apply] ${s.id}:`, err instanceof Error ? err.message : err);
      continue;
    }
    moved.add(c.id);
    done.push({ clientId, key: `auto:${s.id}:${today}`, line: `Applied “${escapeHtml(s.title)}”: <strong>${escapeHtml(c.name)}</strong> from ${money(from, c.adAccount.currency)} to ${money(to, c.adAccount.currency)} a day` });
  }
  return done;
}

/* ── Running ─────────────────────────────────────────────────────────────── */

/** One pass over a workspace: safety rules, then auto-apply. Returns what was done (also emailed and logged). */
export async function runSafetyRules(workspaceId: string, now = new Date()): Promise<Done[]> {
  const ws = await prisma.workspace.findUniqueOrThrow({ where: { id: workspaceId }, select: { name: true, automationPaused: true, safetyMaxCutPct: true, autoApplyMaxPct: true } });
  if (ws.automationPaused) return [];
  const clients = await prisma.client.findMany({ where: { workspaceId, OR: [{ safetyPixel: true }, { safetyCap: true }, { autoApply: true }] }, select: { id: true, safetyPixel: true, safetyCap: true, autoApply: true, askFirst: true } });
  const done: Done[] = [];
  for (const c of clients) {
    try {
      if (c.safetyPixel) done.push(...(await pixelRule(workspaceId, c.id, now)));
      if (c.safetyCap) done.push(...(await capRule(workspaceId, c.id, ws.safetyMaxCutPct, now)));
      // "Ask first" clients wait for an owner for every spend change, automation included.
      if (c.autoApply && !c.askFirst) done.push(...(await autoApply(workspaceId, c.id, ws.autoApplyMaxPct, now)));
    } catch (err) {
      console.error(`[safety] client ${c.id}:`, err instanceof Error ? err.message : err);
    }
  }
  // Auto-pause (C6): per-campaign spend caps, blackout dates, tracking.
  try {
    done.push(...(await runAutoPause(workspaceId, new Set(clients.filter((c) => c.safetyPixel).map((c) => c.id)), now)));
  } catch (err) {
    console.error("[auto-pause] workspace", workspaceId, err instanceof Error ? err.message : err);
  }
  for (const d of done) {
    await notifyMembers(
      workspaceId,
      (m) => m.role === "OWNER" || m.role === "MEDIA_BUYER",
      "SAFETY",
      { key: d.key, clientId: d.clientId, line: d.line },
      "Advertix changed a campaign on its own",
      `Your automation in ${escapeHtml(ws.name)} (safety rules, auto-pause or auto-apply) acted on its own. You can undo it for 7 days in Activity:`,
      { label: "Review in Activity", path: "/activity" }
    ).catch((err) => console.error("[safety] email:", err instanceof Error ? err.message : err));
  }
  return done;
}

/* ── Settings ────────────────────────────────────────────────────────────── */

export async function safetySettings(workspaceId: string) {
  const [ws, clients] = await Promise.all([
    prisma.workspace.findUniqueOrThrow({ where: { id: workspaceId }, select: { safetyMaxCutPct: true, autoApplyMaxPct: true, automationPaused: true } }),
    prisma.client.findMany({ where: { workspaceId }, select: { id: true, name: true, safetyPixel: true, safetyCap: true, autoApply: true, askFirst: true, monthlyBudget: true }, orderBy: { name: "asc" } }),
  ]);
  return {
    maxCutPct: ws.safetyMaxCutPct,
    autoApplyMaxPct: ws.autoApplyMaxPct,
    automationPaused: ws.automationPaused,
    clients: clients.map((c) => ({ id: c.id, name: c.name, pixel: c.safetyPixel, cap: c.safetyCap, autoApply: c.autoApply, askFirst: c.askFirst, hasMonthlyBudget: c.monthlyBudget != null && Number(c.monthlyBudget) > 0 })),
  };
}

const pctIn = (v: unknown, max: number, what: string) => {
  const n = Math.round(Number(v));
  if (!Number.isFinite(n) || n < 1 || n > max) throw Object.assign(new Error(`${what} must be between 1% and ${max}%.`), { status: 400 });
  return n;
};

export async function saveSafetySettings(workspaceId: string, input: { maxCutPct?: unknown; autoApplyMaxPct?: unknown; automationPaused?: unknown; clients?: unknown }) {
  const data: { safetyMaxCutPct?: number; autoApplyMaxPct?: number; automationPaused?: boolean } = {};
  if (input.maxCutPct !== undefined) data.safetyMaxCutPct = pctIn(input.maxCutPct, 50, "The largest daily cut");
  if (input.autoApplyMaxPct !== undefined) data.autoApplyMaxPct = pctIn(input.autoApplyMaxPct, 30, "The auto-apply limit");
  if (input.automationPaused !== undefined) data.automationPaused = input.automationPaused === true;
  const rows = Array.isArray(input.clients) ? (input.clients as { id?: unknown; pixel?: unknown; cap?: unknown; autoApply?: unknown }[]) : [];
  await prisma.$transaction(async (tx) => {
    if (Object.keys(data).length) await tx.workspace.update({ where: { id: workspaceId }, data });
    for (const r of rows) {
      if (typeof r.id !== "string") continue;
      const flags = {
        ...(typeof r.pixel === "boolean" ? { safetyPixel: r.pixel } : {}),
        ...(typeof r.cap === "boolean" ? { safetyCap: r.cap } : {}),
        ...(typeof r.autoApply === "boolean" ? { autoApply: r.autoApply } : {}),
      };
      await tx.client.updateMany({ where: { id: r.id, workspaceId }, data: flags });
    }
  });
  return safetySettings(workspaceId);
}

/* ── Scheduler ───────────────────────────────────────────────────────────── */

let handle: NodeJS.Timeout | null = null;
let running = false;

async function tick() {
  if (running) return;
  running = true;
  try {
    const workspaces = await prisma.workspace.findMany({
      where: { automationPaused: false, OR: [{ clients: { some: { OR: [{ safetyPixel: true }, { safetyCap: true }, { autoApply: true }] } } }, { campaigns: autoPauseWorkspaceWhere }] },
      select: { id: true },
    });
    for (const w of workspaces) {
      try {
        await runSafetyRules(w.id);
      } catch (err) {
        console.error("[safety] workspace", w.id, err instanceof Error ? err.message : err);
      }
    }
  } finally {
    running = false;
  }
}

/** Hourly safety checks. Disable with SAFETY_RULES_ENABLED=false. */
export function startSafetyScheduler() {
  if ((process.env.SAFETY_RULES_ENABLED ?? "true").toLowerCase() === "false" || handle) return;
  setTimeout(() => {
    void tick();
    handle = setInterval(() => void tick(), HOUR);
  }, 180_000);
  console.log("[safety] safety rules scheduled hourly");
}
