/**
 * Campaign actions that Advertix performs on the ad platform on the user's
 * behalf (plan B2): change a daily budget, pause / resume. Used by suggestion
 * Apply and Undo. Same rules as PUT /campaigns/:id — push to the platform
 * first and only then write locally, so our row never claims a change the
 * platform rejected.
 *
 * Meta only for now: Google, TikTok and LinkedIn are read-only syncs.
 */

import { Prisma, type AdAccount, type Campaign } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { metaService } from "./meta.service";
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
  // Otherwise the budget is spread across ad sets we don't track yet (B4).
  if (!c.externalAdSetId && !(Number(c.budget) > 0)) {
    return "This campaign's budget is set on its ad sets. Change it in Meta Ads Manager.";
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
}
