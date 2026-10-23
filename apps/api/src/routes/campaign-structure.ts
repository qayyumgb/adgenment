import { Router, type Request, type Response, type NextFunction } from "express";
import type { Ad, AdSet, Prisma } from "@prisma/client";
import { requireAuth } from "../middleware/auth";
import { prisma } from "../lib/prisma";
import { requireWorkspace } from "../lib/workspace";
import { changeLog } from "../services/change-log.service";
import { adResults, zero, type Totals } from "../lib/ad-metrics";
import { audienceLine } from "../lib/targeting";
import {
  ActionError,
  adSetBudgetBlocker,
  childStatusBlocker,
  setAdSetDailyBudget,
  setAdSetStatus,
  setAdStatus,
  ownStatus,
  type CampaignWithAccount,
} from "../services/campaign-actions.service";

/**
 * A campaign's ad sets and ads (plan B4, Meta first), mounted under
 * /campaigns. GET returns them with results for the period, a plain audience
 * line per ad set and a fatigue read per ad; the POSTs pause / resume an ad
 * set or ad and change an ad set's daily budget on Meta, each written to the
 * change log (undoable for 7 days).
 */
const router = Router();
router.use(requireAuth);


async function loadCampaign(req: Request): Promise<CampaignWithAccount> {
  const workspace = await requireWorkspace(req.dbUserId!);
  const c = await prisma.campaign.findFirst({ where: { id: req.params.id, workspaceId: workspace.id }, include: { adAccount: true } });
  if (!c) throw new ActionError(404, "Campaign not found.");
  return c;
}




/** GET /campaigns/:id/structure?days=30 */
router.get("/:id/structure", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const c = await loadCampaign(req);
    const days = Math.min(365, Math.max(1, parseInt(String(req.query.days ?? "30"), 10) || 30));
    const [adSets, ads] = await Promise.all([
      prisma.adSet.findMany({ where: { campaignId: c.id }, orderBy: { createdAt: "asc" } }),
      prisma.ad.findMany({ where: { campaignId: c.id }, orderBy: { createdAt: "asc" } }),
    ]);

    const results = await adResults(ads.map((a) => a.id), days);

    const adRows = ads.map((a: Ad) => {
      const totals = results.totals(a.id);
      return {
        id: a.id,
        adSetId: a.adSetId,
        externalId: a.externalId,
        name: a.name,
        status: a.status,
        effectiveStatus: a.effectiveStatus,
        format: a.format,
        imageUrl: a.imageUrl,
        headline: a.headline,
        body: a.body,
        callToAction: a.callToAction,
        linkUrl: a.linkUrl,
        reach30d: a.reach30d,
        frequency30d: a.frequency30d,
        totals,
        fatigue: results.fatigue(a.id, a.frequency30d),
        switchOn: ownStatus(a) === "ACTIVE",
        statusBlocker: childStatusBlocker(c, a),
      };
    });

    const adSetRows = adSets.map((s: AdSet) => {
      const mine = adRows.filter((a) => a.adSetId === s.id);
      const totals = mine.reduce((acc, a) => {
        (Object.keys(acc) as (keyof Totals)[]).forEach((k) => (acc[k] += a.totals[k]));
        return acc;
      }, zero());
      return {
        id: s.id,
        externalId: s.externalId,
        name: s.name,
        status: s.status,
        effectiveStatus: s.effectiveStatus,
        dailyBudget: s.dailyBudget === null ? null : Number(s.dailyBudget),
        lifetimeBudget: s.lifetimeBudget === null ? null : Number(s.lifetimeBudget),
        optimizationGoal: s.optimizationGoal,
        learningStage: s.learningStage,
        audience: audienceLine(s.targeting),
        reach30d: s.reach30d,
        frequency30d: s.frequency30d,
        adCount: mine.length,
        totals,
        switchOn: ownStatus(s) === "ACTIVE",
        budgetBlocker: adSetBudgetBlocker(c, s),
        statusBlocker: childStatusBlocker(c, s),
      };
    });

    res.json({
      platform: c.platform,
      syncedAt: c.adAccount.lastSyncedAt,
      days,
      // One budget for the whole campaign (campaign budget optimisation).
      campaignBudget: !c.externalAdSetId && Number(c.budget) > 0 && adSets.every((s) => s.dailyBudget === null && s.lifetimeBudget === null),
      adSets: adSetRows,
      ads: adRows,
    });
  } catch (err) {
    next(err);
  }
});

const parseStatus = (v: unknown) => (v === "ACTIVE" || v === "PAUSED" ? v : null);

/** POST /campaigns/:id/adsets/:adSetId/status { status: "ACTIVE" | "PAUSED" } */
router.post("/:id/adsets/:adSetId/status", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const c = await loadCampaign(req);
    const status = parseStatus(req.body?.status);
    if (!status) return res.status(400).json({ error: "status must be ACTIVE or PAUSED." });
    const s = await prisma.adSet.findFirst({ where: { id: req.params.adSetId, campaignId: c.id } });
    if (!s) return res.status(404).json({ error: "Ad set not found." });
    const was = ownStatus(s);
    if (was === status) return res.json({ ok: true });
    await setAdSetStatus(c, s, status);
    await changeLog.record({
      workspaceId: c.workspaceId,
      campaignId: c.id,
      campaignName: c.name,
      clientId: c.adAccount.clientId,
      actorType: "USER",
      userId: req.dbUserId,
      action: "adset.status",
      before: { adSetId: s.id, name: s.name, status: was },
      after: { adSetId: s.id, name: s.name, status },
      platformPushed: true,
    });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

/** POST /campaigns/:id/adsets/:adSetId/budget { dailyBudget: number } */
router.post("/:id/adsets/:adSetId/budget", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const c = await loadCampaign(req);
    const amount = Number(req.body?.dailyBudget);
    const s = await prisma.adSet.findFirst({ where: { id: req.params.adSetId, campaignId: c.id } });
    if (!s) return res.status(404).json({ error: "Ad set not found." });
    const before = Number(s.dailyBudget);
    if (Math.abs(before - amount) < 0.01) return res.json({ ok: true });
    await setAdSetDailyBudget(c, s, amount);
    await changeLog.record({
      workspaceId: c.workspaceId,
      campaignId: c.id,
      campaignName: c.name,
      clientId: c.adAccount.clientId,
      currency: c.adAccount.currency,
      actorType: "USER",
      userId: req.dbUserId,
      action: "adset.budget",
      before: { adSetId: s.id, name: s.name, dailyBudget: before },
      after: { adSetId: s.id, name: s.name, dailyBudget: amount },
      platformPushed: true,
    });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

/** POST /campaigns/:id/ads/:adId/status { status: "ACTIVE" | "PAUSED" } */
router.post("/:id/ads/:adId/status", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const c = await loadCampaign(req);
    const status = parseStatus(req.body?.status);
    if (!status) return res.status(400).json({ error: "status must be ACTIVE or PAUSED." });
    const ad = await prisma.ad.findFirst({ where: { id: req.params.adId, campaignId: c.id } });
    if (!ad) return res.status(404).json({ error: "Ad not found." });
    const was = ownStatus(ad);
    if (was === status) return res.json({ ok: true });
    await setAdStatus(c, ad, status);
    await changeLog.record({
      workspaceId: c.workspaceId,
      campaignId: c.id,
      campaignName: c.name,
      clientId: c.adAccount.clientId,
      actorType: "USER",
      userId: req.dbUserId,
      action: "ad.status",
      before: { adId: ad.id, name: ad.name, status: was },
      after: { adId: ad.id, name: ad.name, status },
      platformPushed: true,
    });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

export default router;
