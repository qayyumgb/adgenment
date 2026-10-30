/**
 * Campaign actions that Advertix performs on the ad platform on the user's
 * behalf (plan B2): change a daily budget, pause / resume. Used by suggestion
 * Apply and Undo. Same rules as PUT /campaigns/:id — push to the platform
 * first and only then write locally, so our row never claims a change the
 * platform rejected.
 *
 * Meta only for now: Google, TikTok and LinkedIn are read-only syncs.
 */

import { Prisma, type Ad, type AdAccount, type AdSet, type Campaign } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { metaService, type MetaScheduleBlock } from "./meta.service";
import { friendlyMetaError, isMetaError } from "../lib/meta-errors";

export type CampaignWithAccount = Campaign & { adAccount: AdAccount };

/** Error with an HTTP status; the error handler passes `status` through. */
export class ActionError extends Error {
  constructor(
    public status: number,
    message: string,
    public detail?: string
  ) {
    super(message);
    this.name = "ActionError";
  }
}

/** Why Advertix can't change this campaign's status on the platform, or null if it can. */
export function statusBlocker(c: CampaignWithAccount): string | null {
  if (c.platform !== "META") return "Advertix can change campaigns on Meta only for now.";
  if (!c.externalId) return "This campaign isn't live on Meta yet.";
  if (!c.adAccount.isActive) return "The ad account is disconnected. Reconnect it in Connections.";
  return null;
}

/** Why Advertix can't change this campaign's daily budget on the platform, or null if it can. */
export function budgetBlocker(c: CampaignWithAccount): string | null {
  const s = statusBlocker(c);
  if (s) return s;
  if (c.budgetType !== "DAILY") return "Only daily budgets can be changed from Advertix.";
  // Published from Advertix → the budget is on the ad set we created. Synced
  // with a campaign budget (CBO) → we stored it, so it's on the campaign.
  // Otherwise each ad set has its own budget (Ad sets tab).
  if (!c.externalAdSetId && !(Number(c.budget) > 0)) {
    return "This campaign's budget is set on its ad sets. Change it per ad set in the Ad sets tab.";
  }
  return null;
}

function platformError(err: unknown): ActionError {
  if (isMetaError(err)) {
    const f = friendlyMetaError(err);
    return new ActionError(f.status, f.message, f.detail);
  }
  return new ActionError(
    502,
    "Couldn't make this change on Meta. Nothing was changed.",
    err instanceof Error ? err.message : String(err)
  );
}

export async function setDailyBudget(c: CampaignWithAccount, amount: number): Promise<void> {
  const blocker = budgetBlocker(c);
  if (blocker) throw new ActionError(409, blocker);
  if (!Number.isFinite(amount) || amount <= 0) throw new ActionError(400, "Budget must be a positive number.");
  const min = c.adAccount.minDailyBudget;
  if (min && amount < min) {
    throw new ActionError(400, `Meta's minimum daily budget for this account is ${min}.`);
  }

  const token = metaService.decryptToken(c.adAccount.accessToken);
  try {
    if (c.externalAdSetId) {
      await metaService.updateAdSet(token, c.externalAdSetId, { dailyBudget: amount });
    } else {
      await metaService.updateCampaign(token, c.externalId!, { dailyBudget: amount });
    }
  } catch (err) {
    const e = platformError(err);
    console.error(`[campaign-actions] budget ${c.id} → ${amount} failed: ${e.detail ?? e.message}`);
    throw e;
  }

  await prisma.campaign.update({
    where: { id: c.id },
    data: { budget: new Prisma.Decimal(amount.toFixed(2)) },
  });
  // Keep the synced ad set row in step (B4).
  if (c.externalAdSetId) {
    await prisma.adSet.updateMany({ where: { campaignId: c.id, externalId: c.externalAdSetId }, data: { dailyBudget: new Prisma.Decimal(amount.toFixed(2)) } });
  }
}

/** Why Advertix can't set this campaign's hours on Meta (smart hours, C7), or null if it can. */
export function scheduleBlocker(c: CampaignWithAccount): string | null {
  const s = statusBlocker(c);
  if (s) return s;
  if (!c.externalAdSetId) return "This campaign wasn't published from Advertix, so set its hours on each ad set in Ads Manager.";
  if (c.budgetType !== "LIFETIME") return "Meta allows hour schedules only on a total (lifetime) budget.";
  return null;
}

/** The hours our single ad set runs in (no blocks = around the clock). */
export async function getAdSchedule(c: CampaignWithAccount): Promise<MetaScheduleBlock[]> {
  const blocker = scheduleBlocker(c);
  if (blocker) throw new ActionError(409, blocker);
  try {
    return (await metaService.getAdSetSchedule(metaService.decryptToken(c.adAccount.accessToken), c.externalAdSetId!)).schedule;
  } catch (err) {
    throw platformError(err);
  }
}

/** Set the hours our single ad set runs in, on Meta. */
export async function setAdSchedule(c: CampaignWithAccount, schedule: MetaScheduleBlock[]): Promise<void> {
  const blocker = scheduleBlocker(c);
  if (blocker) throw new ActionError(409, blocker);
  try {
    await metaService.updateAdSet(metaService.decryptToken(c.adAccount.accessToken), c.externalAdSetId!, { schedule });
  } catch (err) {
    const e = platformError(err);
    console.error(`[campaign-actions] schedule ${c.id} failed: ${e.detail ?? e.message}`);
    throw e;
  }
}

/** Rename on Meta (campaign + our single ad set, as PUT /campaigns/:id does), then locally. */
export async function setName(c: CampaignWithAccount, name: string): Promise<void> {
  const blocker = statusBlocker(c);
  if (blocker) throw new ActionError(409, blocker);
  const token = metaService.decryptToken(c.adAccount.accessToken);
  try {
    await metaService.updateCampaign(token, c.externalId!, { name });
    if (c.externalAdSetId) await metaService.updateAdSet(token, c.externalAdSetId, { name: `${name} — Ad Set` });
  } catch (err) {
    const e = platformError(err);
    console.error(`[campaign-actions] rename ${c.id} failed: ${e.detail ?? e.message}`);
    throw e;
  }
  await prisma.campaign.update({ where: { id: c.id }, data: { name } });
}

export async function setStatus(c: CampaignWithAccount, status: "ACTIVE" | "PAUSED"): Promise<void> {
  const blocker = statusBlocker(c);
  if (blocker) throw new ActionError(409, blocker);

  const token = metaService.decryptToken(c.adAccount.accessToken);
  try {
    await metaService.updateCampaign(token, c.externalId!, { status });
    // Our publishes create one ad set per campaign; keep it in step (mirrors PUT /campaigns/:id).
    if (c.externalAdSetId) await metaService.updateAdSet(token, c.externalAdSetId, { status });
  } catch (err) {
    const e = platformError(err);
    console.error(`[campaign-actions] status ${c.id} → ${status} failed: ${e.detail ?? e.message}`);
    throw e;
  }

  await prisma.campaign.update({ where: { id: c.id }, data: { status } });
  if (c.externalAdSetId) {
    await prisma.adSet.updateMany({ where: { campaignId: c.id, externalId: c.externalAdSetId }, data: { status } });
  }
}

/* ── Ad sets and ads (plan B4, Meta) ─────────────────────────────────── */

/**
 * The ad set's / ad's own on-off switch, which can differ from how it
 * delivers: Meta reports CAMPAIGN_PAUSED / ADSET_PAUSED for one that is on but
 * whose parent is off. Pause / resume and their undo compare against this.
 */
export function ownStatus(row: { status: string; effectiveStatus: string | null }): string {
  if (row.effectiveStatus === "PAUSED") return "PAUSED";
  if (row.effectiveStatus === "ACTIVE" || row.effectiveStatus === "CAMPAIGN_PAUSED" || row.effectiveStatus === "ADSET_PAUSED") return "ACTIVE";
  return row.status;
}

/** Why Advertix can't change this ad set's daily budget, or null if it can. */
export function adSetBudgetBlocker(c: CampaignWithAccount, s: AdSet): string | null {
  const blocker = statusBlocker(c);
  if (blocker) return blocker;
  if (s.status === "ENDED") return "This ad set has ended.";
  if (s.dailyBudget === null) {
    if (s.lifetimeBudget !== null) return "This ad set has a lifetime budget. Change it in Meta Ads Manager.";
    return "This campaign shares one budget across its ad sets. Change it on the campaign.";
  }
  return null;
}

/** Why Advertix can't pause / resume this ad set or ad, or null if it can. */
export function childStatusBlocker(c: CampaignWithAccount, row: { status: string }): string | null {
  const blocker = statusBlocker(c);
  if (blocker) return blocker;
  if (row.status === "ENDED") return "It has ended or was deleted on Meta.";
  if (row.status === "DRAFT") return "Meta is still reviewing it, or it needs attention in Ads Manager.";
  return null;
}

export async function setAdSetStatus(c: CampaignWithAccount, s: AdSet, status: "ACTIVE" | "PAUSED"): Promise<void> {
  const blocker = childStatusBlocker(c, s);
  if (blocker) throw new ActionError(409, blocker);
  const token = metaService.decryptToken(c.adAccount.accessToken);
  try {
    await metaService.updateAdSet(token, s.externalId, { status });
  } catch (err) {
    const e = platformError(err);
    console.error(`[campaign-actions] ad set ${s.id} → ${status} failed: ${e.detail ?? e.message}`);
    throw e;
  }
  // A resumed ad set still doesn't deliver while its campaign is paused.
  const effectiveStatus = status === "ACTIVE" && c.status !== "ACTIVE" ? "CAMPAIGN_PAUSED" : status;
  await prisma.adSet.update({ where: { id: s.id }, data: { status: effectiveStatus === status ? status : "PAUSED", effectiveStatus } });
}

export async function setAdSetDailyBudget(c: CampaignWithAccount, s: AdSet, amount: number): Promise<void> {
  const blocker = adSetBudgetBlocker(c, s);
  if (blocker) throw new ActionError(409, blocker);
  if (!Number.isFinite(amount) || amount <= 0) throw new ActionError(400, "Budget must be a positive number.");
  const min = c.adAccount.minDailyBudget;
  if (min && amount < min) throw new ActionError(400, `Meta's minimum daily budget for this account is ${min}.`);
  const token = metaService.decryptToken(c.adAccount.accessToken);
  try {
    await metaService.updateAdSet(token, s.externalId, { dailyBudget: amount });
  } catch (err) {
    const e = platformError(err);
    console.error(`[campaign-actions] ad set budget ${s.id} → ${amount} failed: ${e.detail ?? e.message}`);
    throw e;
  }
  const value = new Prisma.Decimal(amount.toFixed(2));
  await prisma.adSet.update({ where: { id: s.id }, data: { dailyBudget: value } });
  // Advertix publishes one ad set per campaign and shows its budget as the campaign's.
  if (c.externalAdSetId === s.externalId) await prisma.campaign.update({ where: { id: c.id }, data: { budget: value } });
}

export async function setAdStatus(c: CampaignWithAccount, ad: Ad, status: "ACTIVE" | "PAUSED"): Promise<void> {
  const blocker = childStatusBlocker(c, ad);
  if (blocker) throw new ActionError(409, blocker);
  const token = metaService.decryptToken(c.adAccount.accessToken);
  try {
    await metaService.updateAdStatus(token, ad.externalId, status);
  } catch (err) {
    const e = platformError(err);
    console.error(`[campaign-actions] ad ${ad.id} → ${status} failed: ${e.detail ?? e.message}`);
    throw e;
  }
  // A resumed ad still doesn't deliver while its ad set or campaign is off.
  const parent = await prisma.adSet.findUnique({ where: { id: ad.adSetId }, select: { status: true, effectiveStatus: true } });
  const effectiveStatus =
    status !== "ACTIVE" ? status : c.status !== "ACTIVE" ? "CAMPAIGN_PAUSED" : parent && ownStatus(parent) !== "ACTIVE" ? "ADSET_PAUSED" : status;
  await prisma.ad.update({ where: { id: ad.id }, data: { status: effectiveStatus === status ? status : "PAUSED", effectiveStatus } });
}
