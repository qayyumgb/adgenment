import { Router, type Request, type Response, type NextFunction } from "express";
import {
  Prisma,
  type Platform,
  type CampaignStatus,
  type BudgetType,
} from "@prisma/client";
import { requireAuth } from "../middleware/auth";
import { prisma } from "../lib/prisma";
import { requireWorkspace } from "../lib/workspace";
import { metaService, type MetaTargeting } from "../services/meta.service";
import { isMetaError, friendlyMetaError } from "../lib/meta-errors";

const router = Router();
router.use(requireAuth);

const PLATFORMS: ReadonlyArray<Platform> = [
  "META",
  "GOOGLE",
  "TIKTOK",
  "LINKEDIN",
  "YOUTUBE",
  "SNAPCHAT",
  "PINTEREST",
  "X",
];
const STATUSES: ReadonlyArray<CampaignStatus> = [
  "DRAFT",
  "ACTIVE",
  "PAUSED",
  "ENDED",
];
const BUDGET_TYPES: ReadonlyArray<BudgetType> = ["DAILY", "LIFETIME"];

function isPlatform(v: unknown): v is Platform {
  return typeof v === "string" && PLATFORMS.includes(v as Platform);
}
function isStatus(v: unknown): v is CampaignStatus {
  return typeof v === "string" && STATUSES.includes(v as CampaignStatus);
}
function isBudgetType(v: unknown): v is BudgetType {
  return typeof v === "string" && BUDGET_TYPES.includes(v as BudgetType);
}

function parseDate(value: unknown): Date | null {
  if (value == null || value === "") return null;
  if (typeof value !== "string") return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

/**
 * Is this a destination Meta will accept? Meta rejects anything that isn't
 * http(s) with a hostname, and answers with a generic code-100 that gives the
 * user no idea the URL was the problem — so we check it ourselves first.
 */
function isValidDestinationUrl(value: string): boolean {
  let url: URL;
  try {
    url = new URL(value.trim());
  } catch {
    return false;
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") return false;
  // Reject "https://" with nothing after it, and bare hostnames with no dot
  // ("https://localhost" can't be crawled by Meta's link checker).
  return url.hostname.includes(".") && !url.hostname.endsWith(".");
}

/**
 * Safe ad-account fields to embed in client-facing campaign responses. NEVER
 * include accessToken/refreshToken — those must not leave the server. Use this
 * everywhere a campaign is returned to the browser with its adAccount.
 */
const AD_ACCOUNT_PUBLIC_SELECT = {
  platform: true,
  accountName: true,
  accountId: true,
  currency: true,
  timezone: true,
  minDailyBudget: true,
} as const;

/**
 * GET /campaigns
 */
router.get("/", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const workspace = await requireWorkspace(req.dbUserId!);
    const { platform, status, search } = req.query;
    const page = Math.max(1, parseInt(String(req.query.page ?? "1"), 10) || 1);
    const limit = Math.min(
      100,
      Math.max(1, parseInt(String(req.query.limit ?? "12"), 10) || 12)
    );

    const where: Prisma.CampaignWhereInput = { workspaceId: workspace.id };
    if (isPlatform(platform)) where.platform = platform;
    if (isStatus(status)) where.status = status;
    if (typeof search === "string" && search.trim() !== "") {
      where.name = { contains: search.trim(), mode: "insensitive" };
    }

    const includeLatestMetrics =
      req.query.includeLatestMetrics === "true";

    const [total, campaigns] = await Promise.all([
      prisma.campaign.count({ where }),
      prisma.campaign.findMany({
        where,
        include: {
          adAccount: { select: AD_ACCOUNT_PUBLIC_SELECT },
          _count: { select: { metrics: true } },
          ...(includeLatestMetrics
            ? {
                metrics: {
                  orderBy: { date: "desc" as const },
                  take: 1,
                },
              }
            : {}),
        },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);

    // Aggregate lifetime totals (sum of every CampaignMetric row) per
    // campaign so cards/tables show cumulative spend instead of just the
    // last day's. One groupBy keeps it cheap regardless of how many
    // campaigns the page returns.
    let totalsByCampaignId: Record<
      string,
      {
        spend: number;
        impressions: number;
        clicks: number;
        conversions: number;
        revenue: number;
      }
    > = {};
    if (campaigns.length > 0) {
      const agg = await prisma.campaignMetrics.groupBy({
        by: ["campaignId"],
        where: { campaignId: { in: campaigns.map((c) => c.id) } },
        _sum: {
          spend: true,
          impressions: true,
          clicks: true,
          conversions: true,
          revenue: true,
        },
      });
      totalsByCampaignId = Object.fromEntries(
        agg.map((row) => [
          row.campaignId,
          {
            spend: Number(row._sum.spend ?? 0),
            impressions: row._sum.impressions ?? 0,
            clicks: row._sum.clicks ?? 0,
            conversions: row._sum.conversions ?? 0,
            revenue: Number(row._sum.revenue ?? 0),
          },
        ])
      );
    }

    const enriched = campaigns.map((c) => ({
      ...c,
      totals: totalsByCampaignId[c.id] ?? {
        spend: 0,
        impressions: 0,
        clicks: 0,
        conversions: 0,
        revenue: 0,
      },
    }));

    res.json({
      campaigns: enriched,
      total,
      page,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /campaigns
 */
router.post("/", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const workspace = await requireWorkspace(req.dbUserId!);
    const {
      name,
      platform,
      objective,
      budget,
      budgetType,
      startDate,
      endDate,
      adAccountId,
      targeting,
    } = req.body ?? {};

    if (typeof name !== "string" || !name.trim()) {
      return res.status(400).json({ error: "name is required" });
    }
    if (!isPlatform(platform)) {
      return res.status(400).json({ error: "Invalid or missing platform" });
    }
    if (typeof objective !== "string" || !objective.trim()) {
      return res.status(400).json({ error: "objective is required" });
    }
    const budgetNumber = Number(budget);
    if (!Number.isFinite(budgetNumber) || budgetNumber <= 0) {
      return res
        .status(400)
        .json({ error: "budget must be a positive number" });
    }
    if (typeof adAccountId !== "string" || !adAccountId.trim()) {
      return res
        .status(400)
        .json({ error: "adAccountId is required to create a campaign" });
    }
    const bt: BudgetType = isBudgetType(budgetType) ? budgetType : "DAILY";

    const account = await prisma.adAccount.findFirst({
      where: { id: adAccountId, workspaceId: workspace.id },
    });
    if (!account) {
      return res
        .status(404)
        .json({ error: "Ad account not found in this workspace" });
    }
    if (account.platform !== platform) {
      return res
        .status(400)
        .json({ error: "platform does not match the selected ad account" });
    }

    const campaign = await prisma.campaign.create({
      data: {
        workspaceId: workspace.id,
        adAccountId,
        platform,
        name: name.trim(),
        objective: objective.trim(),
        budget: new Prisma.Decimal(budgetNumber.toFixed(2)),
        budgetType: bt,
        startDate: parseDate(startDate),
        endDate: parseDate(endDate),
        targeting: targeting ?? Prisma.JsonNull,
        status: "DRAFT",
      },
    });

    res.status(201).json(campaign);
  } catch (err) {
    next(err);
  }
});

/**
 * GET /campaigns/:id
 */
router.get("/:id", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const workspace = await requireWorkspace(req.dbUserId!);
    const campaign = await prisma.campaign.findFirst({
      where: { id: req.params.id, workspaceId: workspace.id },
      include: {
        // Restricted select — the previous `adAccount: true` leaked the
        // encrypted accessToken/refreshToken to the browser.
        adAccount: { select: AD_ACCOUNT_PUBLIC_SELECT },
        metrics: { orderBy: { date: "desc" }, take: 30 },
      },
    });
    if (!campaign) {
      return res.status(404).json({ error: "Campaign not found" });
    }
    // Lifetime totals on detail too — convenient for the metric cards.
    const agg = await prisma.campaignMetrics.aggregate({
      where: { campaignId: campaign.id },
      _sum: {
        spend: true,
        impressions: true,
        clicks: true,
        conversions: true,
        revenue: true,
      },
    });
    res.json({
      ...campaign,
      totals: {
        spend: Number(agg._sum.spend ?? 0),
        impressions: agg._sum.impressions ?? 0,
        clicks: agg._sum.clicks ?? 0,
        conversions: agg._sum.conversions ?? 0,
        revenue: Number(agg._sum.revenue ?? 0),
      },
    });
  } catch (err) {
    next(err);
  }
});

/**
 * PUT /campaigns/:id
 */
router.put("/:id", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const workspace = await requireWorkspace(req.dbUserId!);
    const existing = await prisma.campaign.findFirst({
      where: { id: req.params.id, workspaceId: workspace.id },
      include: { adAccount: true },
    });
    if (!existing) {
      return res.status(404).json({ error: "Campaign not found" });
    }

    const { name, status, budget, budgetType, startDate, endDate, targeting } =
      req.body ?? {};

    const data: Prisma.CampaignUpdateInput = {};
    if (typeof name === "string" && name.trim()) data.name = name.trim();
    if (isStatus(status)) data.status = status;
    if (budget !== undefined) {
      const n = Number(budget);
      if (!Number.isFinite(n) || n <= 0) {
        return res
          .status(400)
          .json({ error: "budget must be a positive number" });
      }
      data.budget = new Prisma.Decimal(n.toFixed(2));
    }
    if (isBudgetType(budgetType)) data.budgetType = budgetType;
    if (startDate !== undefined) data.startDate = parseDate(startDate);
    if (endDate !== undefined) data.endDate = parseDate(endDate);
    if (targeting !== undefined) {
      data.targeting = targeting === null ? Prisma.JsonNull : targeting;
    }

    // Push the edit to Meta BEFORE committing locally, so a rejection leaves
    // our row matching what Meta actually has. Writing locally first would let
    // the UI report a budget Meta never accepted — the user then believes they
    // changed their spend and they haven't.
    //
    // Which object takes which field matters: name and status live on the
    // campaign, but budget and schedule live on the AD SET, because publish
    // deliberately creates the campaign without a budget.
    if (existing.platform === "META" && existing.externalId) {
      const token = metaService.decryptToken(existing.adAccount.accessToken);
      const nextName = typeof data.name === "string" ? data.name : undefined;
      // DRAFT/ENDED have no Meta equivalent — only ACTIVE/PAUSED map across.
      const nextStatus =
        status === "ACTIVE" || status === "PAUSED"
          ? (status as "ACTIVE" | "PAUSED")
          : undefined;

      const budgetChanged =
        budget !== undefined && Number(budget) !== Number(existing.budget);
      const effectiveBudgetType = isBudgetType(budgetType)
        ? budgetType
        : existing.budgetType;
      const startChanged =
        startDate !== undefined &&
        parseDate(startDate)?.getTime() !== existing.startDate?.getTime();
      const endChanged =
        endDate !== undefined &&
        parseDate(endDate)?.getTime() !== existing.endDate?.getTime();

      try {
        if (nextName || nextStatus) {
          await metaService.updateCampaign(token, existing.externalId, {
            name: nextName,
            status: nextStatus,
          });
        }

        if (existing.externalAdSetId) {
          const n = Number(budget);
          await metaService.updateAdSet(token, existing.externalAdSetId, {
            name: nextName ? `${nextName} — Ad Set` : undefined,
            status: nextStatus,
            ...(budgetChanged && effectiveBudgetType === "DAILY"
              ? { dailyBudget: n }
              : {}),
            ...(budgetChanged && effectiveBudgetType === "LIFETIME"
              ? { lifetimeBudget: n }
              : {}),
            ...(startChanged
              ? { startTime: parseDate(startDate)?.toISOString() }
              : {}),
            ...(endChanged
              ? { endTime: parseDate(endDate)?.toISOString() }
              : {}),
          });
        } else if (budgetChanged) {
          // Published before we tracked the ad set id — we can't reach the
          // object that owns the budget, so don't pretend the change landed.
          return res.status(409).json({
            error:
              "This campaign was published before Advertix started tracking its ad set, so the budget can't be changed from here. Update it in Meta Ads Manager, then run a sync.",
          });
        }
      } catch (err) {
        const friendly = isMetaError(err)
          ? friendlyMetaError(err)
          : {
              status: 502,
              message: "Couldn't save this change on Meta — nothing was changed.",
              detail: err instanceof Error ? err.message : String(err),
            };
        console.error(`[campaigns/update] Meta update failed: ${friendly.detail}`);
        return res
          .status(friendly.status)
          .json({ error: friendly.message, detail: friendly.detail });
      }
    }

    const updated = await prisma.campaign.update({
      where: { id: existing.id },
      data,
    });
    res.json(updated);
  } catch (err) {
    next(err);
  }
});

/**
 * DELETE /campaigns/:id
 */
router.delete(
  "/:id",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const workspace = await requireWorkspace(req.dbUserId!);
      const existing = await prisma.campaign.findFirst({
        where: { id: req.params.id, workspaceId: workspace.id },
        include: { adAccount: true },
      });
      if (!existing) {
        return res.status(404).json({ error: "Campaign not found" });
      }

      // Delete on Meta FIRST, then locally.
      //
      // Deleting only our row leaves the campaign live on Meta, still
      // spending, and now invisible in Advertix — so the user can't even pause
      // it. Meta's delete cascades to the ad sets and ads beneath it, so this
      // one call cleans up the whole hierarchy we created at publish.
      if (existing.platform === "META" && existing.externalId) {
        const token = metaService.decryptToken(existing.adAccount.accessToken);
        try {
          await metaService.deleteObject(token, existing.externalId);
        } catch (err) {
          // Already gone on Meta (deleted in Ads Manager, or a half-finished
          // publish) — nothing to orphan, so let the local delete proceed.
          const goneOnMeta =
            isMetaError(err) &&
            (err.metaCode === 803 ||
              /does not exist|cannot be loaded|unsupported get request/i.test(
                err.metaUserMessage ?? ""
              ));
          if (!goneOnMeta) {
            // `?force=true` is the escape hatch for a Meta object that can
            // never be deleted (revoked token, closed account). It removes our
            // row knowingly, leaving the campaign on Meta — the response says
            // so so the caller can warn the user.
            if (req.query.force !== "true") {
              const friendly = isMetaError(err)
                ? friendlyMetaError(err)
                : {
                    status: 502,
                    message:
                      "Couldn't delete this campaign on Meta, so it wasn't deleted here either — it would keep spending with no way to reach it.",
                    detail: err instanceof Error ? err.message : String(err),
                  };
              console.error(
                `[campaigns/delete] Meta delete failed for ${existing.externalId}: ${friendly.detail}`
              );
              return res.status(friendly.status).json({
                error: friendly.message,
                detail: friendly.detail,
                canForce: true,
              });
            }
            console.warn(
              `[campaigns/delete] FORCED local delete of ${existing.id}; Meta campaign ${existing.externalId} still exists`
            );
          }
        }
      }

      await prisma.campaign.delete({ where: { id: existing.id } });
      res.json({ success: true });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * GET /campaigns/:id/metrics
 */
router.get(
  "/:id/metrics",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const workspace = await requireWorkspace(req.dbUserId!);
      const days = Math.max(
        1,
        Math.min(365, parseInt(String(req.query.days ?? "30"), 10) || 30)
      );
      const campaign = await prisma.campaign.findFirst({
        where: { id: req.params.id, workspaceId: workspace.id },
        select: { id: true },
      });
      if (!campaign) {
        return res.status(404).json({ error: "Campaign not found" });
      }
      const since = new Date();
      since.setUTCDate(since.getUTCDate() - days);
      const metrics = await prisma.campaignMetrics.findMany({
        where: { campaignId: campaign.id, date: { gte: since } },
        orderBy: { date: "asc" },
      });
      res.json(metrics);
    } catch (err) {
      next(err);
    }
  }
);

/**
 * POST /campaigns/:id/metrics
 */
router.post(
  "/:id/metrics",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const workspace = await requireWorkspace(req.dbUserId!);
      const campaign = await prisma.campaign.findFirst({
        where: { id: req.params.id, workspaceId: workspace.id },
        select: { id: true },
      });
      if (!campaign) {
        return res.status(404).json({ error: "Campaign not found" });
      }

      const { date, impressions, clicks, spend, conversions, revenue } =
        req.body ?? {};
      const dateObj = parseDate(date);
      if (!dateObj) {
        return res.status(400).json({ error: "Invalid or missing date" });
      }
      const imp = Number(impressions) || 0;
      const clk = Number(clicks) || 0;
      const spn = Number(spend) || 0;
      const conv = Number(conversions) || 0;
      const rev = Number(revenue) || 0;

      const ctr = imp > 0 ? clk / imp : 0;
      const cpc = clk > 0 ? spn / clk : 0;
      const cpm = imp > 0 ? (spn / imp) * 1000 : 0;
      const roas = spn > 0 ? rev / spn : 0;

      const data = {
        impressions: imp,
        clicks: clk,
        spend: new Prisma.Decimal(spn.toFixed(2)),
        conversions: conv,
        revenue: new Prisma.Decimal(rev.toFixed(2)),
        ctr,
        cpc,
        cpm,
        roas,
      };

      const metric = await prisma.campaignMetrics.upsert({
        where: {
          campaignId_date: { campaignId: campaign.id, date: dateObj },
        },
        create: { campaignId: campaign.id, date: dateObj, ...data },
        update: data,
      });
      res.status(201).json(metric);
    } catch (err) {
      next(err);
    }
  }
);

/* ────────────────────────────────────────── */
/* Phase 1A — Publish to Meta                 */
/* ────────────────────────────────────────── */

/**
 * POST /campaigns/:id/publish
 *
 * Take a local DRAFT Meta campaign + the wizard's targeting/creative/budget
 * payload and create the full hierarchy on Meta:
 *
 *   1. Resolve image → image_hash (upload from URL or pre-uploaded hash)
 *   2. Create Campaign on Meta
 *   3. Create Ad Set
 *   4. Create Ad Creative
 *   5. Create Ad
 *
 * Each step is wrapped so a failure rolls back any prior step that
 * created a Meta-side object — otherwise we'd leak orphan campaigns into
 * the user's ad account.
 *
 * On success: returns the published campaign with its external IDs.
 * On failure: campaign stays DRAFT, `publishError` is populated.
 */
router.post(
  "/:id/publish",
  async (req: Request, res: Response, next: NextFunction) => {
    const workspace = await requireWorkspace(req.dbUserId!);
    const campaign = await prisma.campaign.findFirst({
      where: { id: req.params.id, workspaceId: workspace.id },
      // Full record (incl. encrypted accessToken) needed server-side to call
      // Meta. NEVER return this object to the client — the response uses a
      // separate `updated` query without adAccount.
      include: { adAccount: true },
    });
    if (!campaign) {
      return res.status(404).json({ error: "Campaign not found" });
    }
    if (campaign.platform !== "META") {
      return res
        .status(400)
        .json({ error: "Only Meta publish is supported in Phase 1A" });
    }
    if (campaign.externalId) {
      return res
        .status(409)
        .json({ error: "Campaign already published. Use launch/pause to control status." });
    }

    const {
      pageId,
      targeting,
      creative,
    } = (req.body ?? {}) as PublishPayload;

    // ── Validation ──────────────────────────────────────────────────────
    if (typeof pageId !== "string" || !pageId.trim()) {
      return res.status(400).json({ error: "pageId is required" });
    }
    if (!targeting || typeof targeting !== "object") {
      return res.status(400).json({ error: "targeting is required" });
    }
    // Meta rejects an ad set with no geography ("A location is missing…")
    // unless a custom or saved audience supplies its own. Catch it here so the
    // caller gets a message naming the step to fix, rather than Meta's version
    // three API calls later — and so a direct API consumer gets the same
    // guardrail the wizard has.
    {
      const geo = targeting.geo_locations;
      const hasGeo =
        (geo?.countries?.length ?? 0) > 0 ||
        (geo?.cities?.length ?? 0) > 0 ||
        (geo?.regions?.length ?? 0) > 0 ||
        (geo?.zips?.length ?? 0) > 0;
      const hasAudience =
        (targeting.custom_audiences?.length ?? 0) > 0 ||
        (targeting.saved_audiences?.length ?? 0) > 0;
      if (!hasGeo && !hasAudience) {
        return res.status(400).json({
          error:
            "Add at least one location (country or city) in the Audience step, or pick a saved/custom audience — Meta won't run an ad set without knowing where to show it.",
          step: "audience",
        });
      }
    }
    if (!creative || typeof creative !== "object") {
      return res.status(400).json({ error: "creative is required" });
    }
    if (typeof creative.message !== "string" || !creative.message.trim()) {
      return res.status(400).json({ error: "creative.message is required" });
    }
    if (typeof creative.linkUrl !== "string" || !creative.linkUrl.trim()) {
      return res.status(400).json({ error: "creative.linkUrl is required" });
    }
    if (!isValidDestinationUrl(creative.linkUrl)) {
      return res.status(400).json({
        error:
          "The destination URL isn't valid. It needs to be a full web address starting with https:// — for example https://yoursite.com/offer",
      });
    }
    const hasCarouselCards = (creative.cards?.length ?? 0) >= 2;
    if (
      !creative.imageUrl &&
      !creative.imageHash &&
      !creative.videoUrl &&
      !creative.videoId &&
      !hasCarouselCards &&
      !creative.libraryCreativeId
    ) {
      return res.status(400).json({
        error:
          "creative needs imageUrl, imageHash, videoUrl, videoId, cards (2-10), or libraryCreativeId",
      });
    }
    if (
      creative.cards &&
      (creative.cards.length < 2 || creative.cards.length > 10)
    ) {
      return res
        .status(400)
        .json({ error: "carousel needs 2-10 cards" });
    }

    const token = metaService.decryptToken(campaign.adAccount.accessToken);
    const adAccountId = campaign.adAccount.accountId;
    const objective = metaService.mapObjectiveToMeta(campaign.objective);

    // ── Pre-flight: catch everything Meta would reject, in plain English ──
    // These checks all run BEFORE we create anything on Meta, so a failure
    // here leaves the user's ad account untouched — no rollback needed and no
    // cryptic code-100 to decode.
    if (!metaService.isPublishableObjective(objective)) {
      return res.status(400).json({
        error:
          "App Promotion campaigns can't be published from Advertix yet — they need an app registered with Meta. Change the campaign objective to Traffic, Leads, Sales, Awareness or Engagement.",
      });
    }

    const budgetNumber = Number(campaign.budget) || 0;
    if (budgetNumber <= 0) {
      return res.status(400).json({
        error:
          "This campaign has no budget set. Add a daily or lifetime budget in the campaign's Settings tab before publishing.",
      });
    }

    // Meta requires an end date on any ad set carrying a lifetime budget —
    // without one it can't work out the daily pacing.
    if (campaign.budgetType === "LIFETIME" && !campaign.endDate) {
      return res.status(400).json({
        error:
          "Lifetime-budget campaigns need an end date so Meta knows how to pace the spend. Add one in the campaign's Settings tab.",
      });
    }

    // Daily budget below the account's real floor is rejected by Meta with a
    // message that doesn't name the actual minimum. We know it from sync.
    const minDaily = campaign.adAccount.minDailyBudget;
    if (
      campaign.budgetType === "DAILY" &&
      typeof minDaily === "number" &&
      minDaily > 0 &&
      budgetNumber < minDaily
    ) {
      const cur = campaign.adAccount.currency ?? "";
      return res.status(400).json({
        error: `Your daily budget is below this ad account's minimum of ${minDaily} ${cur}. Raise the budget in the campaign's Settings tab and publish again.`,
      });
    }

    // Conversion objectives optimize against a pixel. Meta rejects the ad set
    // outright without one, so resolve it up front and give the user the real
    // instruction instead of "Invalid parameter".
    const optimization = metaService.optimizationFor(objective);
    let promotedPixelId: string | undefined;
    if (optimization.promotedObject === "pixel") {
      let pixels;
      try {
        pixels = await metaService.getPixels(token, adAccountId);
      } catch (err) {
        const friendly = isMetaError(err)
          ? friendlyMetaError(err)
          : { status: 502, message: "Couldn't check your Meta Pixel. Try again." };
        return res.status(friendly.status).json({ error: friendly.message });
      }
      if (pixels.length === 0) {
        return res.status(400).json({
          error:
            "This objective optimizes for conversions, which needs a Meta Pixel on your website. Create one in Meta Events Manager and install it on your site, then publish again. If you just want clicks to your site, switch the campaign objective to Traffic.",
        });
      }
      // Prefer a pixel that has actually received events — a pixel object that
      // has never fired isn't installed, and Meta will barely deliver the ad.
      const live = pixels.find((p) => p.lastFiredTime !== null);
      promotedPixelId = (live ?? pixels[0]).id;
    }

    // ── Rollback bookkeeping ────────────────────────────────────────────
    // We track what we created on Meta so we can clean up if a later
    // step fails. Order matters — delete children before parents.
    const created: {
      metaCampaignId?: string;
      adSetId?: string;
      creativeId?: string;
      adId?: string;
    } = {};

    async function rollback() {
      try {
        if (created.adId) {
          await metaService.deleteObject(token, created.adId).catch(() => undefined);
        }
        if (created.creativeId) {
          await metaService.deleteObject(token, created.creativeId).catch(() => undefined);
        }
        if (created.adSetId) {
          await metaService.deleteObject(token, created.adSetId).catch(() => undefined);
        }
        if (created.metaCampaignId) {
          await metaService.deleteObject(token, created.metaCampaignId).catch(() => undefined);
        }
      } catch {
        // best-effort
      }
    }

    // Tracks which Meta call we're on so a failure names the exact step
    // (e.g. "[create ad creative] Meta API: …") instead of a bare error.
    let publishStep = "preparing";

    try {
      // ── 1. Resolve asset → image_hash | video_id | child_attachments ──
      // The publish payload can carry an image (imageHash/imageUrl), a
      // video (videoId/videoUrl), a carousel (cards[2-10]), or a library
      // creative reference (libraryCreativeId) that resolves to one of
      // those. We figure out the ad shape here so the rest of the flow
      // knows whether to upload to /adimages, /advideos, or build a
      // child_attachments array.
      let imageHash: string | undefined = creative.imageHash;
      let videoId: string | undefined = creative.videoId;
      let thumbnailUrl: string | undefined = creative.thumbnailUrl;
      let imageUrlForResolution: string | undefined = creative.imageUrl;
      let videoUrlForResolution: string | undefined = creative.videoUrl;
      let resolvedCards: Array<{
        imageHash: string;
        headline?: string;
        description?: string;
        link?: string;
      }> | undefined;
      let libCreativeType: string | undefined;

      // Library creative lookup — only when no direct asset was provided.
      // For carousel library creatives we expand the saved card list and
      // re-upload any images that aren't already hashed.
      if (
        !imageHash &&
        !videoId &&
        !imageUrlForResolution &&
        !videoUrlForResolution &&
        !hasCarouselCards &&
        creative.libraryCreativeId
      ) {
        const libCreative = await prisma.creative.findFirst({
          where: {
            id: creative.libraryCreativeId,
            workspaceId: workspace.id,
          },
        });
        if (!libCreative) {
          return res
            .status(404)
            .json({ error: "Library creative not found in this workspace" });
        }
        libCreativeType = libCreative.type;
        const content = (libCreative.content ?? {}) as Record<string, unknown>;
        if (libCreative.type === "CAROUSEL") {
          // Library carousel stores cards on content.cards. Hand them to
          // the same card-upload code path below — pre-uploaded hashes
          // are passed through, raw URLs get uploaded on the fly.
          const cards = Array.isArray(content.cards) ? content.cards : [];
          if (cards.length < 2 || cards.length > 10) {
            return res.status(400).json({
              error: "Library carousel must have 2-10 cards",
            });
          }
          creative.cards = cards.map((c) => {
            const card = (c ?? {}) as Record<string, unknown>;
            return {
              imageHash:
                typeof card.imageHash === "string"
                  ? card.imageHash
                  : undefined,
              imageUrl:
                typeof card.imageUrl === "string"
                  ? card.imageUrl
                  : typeof card.url === "string"
                    ? card.url
                    : undefined,
              headline:
                typeof card.headline === "string"
                  ? card.headline
                  : typeof card.name === "string"
                    ? card.name
                    : undefined,
              description:
                typeof card.description === "string"
                  ? card.description
                  : undefined,
              link:
                typeof card.link === "string" ? card.link : undefined,
            };
          });
        } else {
          const url =
            typeof content.imageUrl === "string"
              ? content.imageUrl
              : typeof content.url === "string"
                ? content.url
                : null;
          // Prefer the stored Meta handle over the URL. Creatives that were
          // uploaded to or generated on Meta already have an image_hash; using
          // it skips a re-upload entirely. Falling through to the URL for one
          // of these means handing Meta its own signed CDN link, which it
          // refuses to fetch.
          const storedHash =
            typeof content.imageHash === "string" && content.imageHash.trim()
              ? content.imageHash
              : null;
          if (libCreative.type !== "VIDEO" && storedHash) {
            imageHash = storedHash;
          } else if (!url) {
            return res
              .status(400)
              .json({ error: "Library creative has no media URL" });
          } else if (libCreative.type === "VIDEO") {
            videoUrlForResolution = url;
          } else {
            imageUrlForResolution = url;
          }
        }
      }

      // Resolve to video_id when this is a video ad. Meta transcodes async,
      // so we have to poll status before using the id in a creative — short
      // timeout because the upstream upload should already have been done
      // via /meta/upload-video (where the client did the long poll). This
      // poll here is the fallback when the user pasted a videoUrl directly.
      if (!videoId && videoUrlForResolution) {
        const uploaded = await metaService.uploadVideoFromUrl(
          token,
          adAccountId,
          videoUrlForResolution
        );
        videoId = uploaded.id;
      }

      if (videoId) {
        // Wait until ready (or fail fast). We poll for up to ~2 minutes —
        // longer than that means the user should retry from a finished
        // upload via the Upload Creative flow.
        const startedAt = Date.now();
        const maxMs = 2 * 60 * 1000;
        // Loop body is sequential by design — each iteration is one
        // Graph fetch, and we sleep between. Disable the lint rule that
        // would push us to Promise.all.
        // eslint-disable-next-line no-constant-condition
        while (true) {
          const probe = await metaService.getVideoStatus(token, videoId);
          if (probe.status === "ready") {
            if (!thumbnailUrl && probe.thumbnailUrl) {
              thumbnailUrl = probe.thumbnailUrl;
            }
            break;
          }
          if (probe.status === "error") {
            return res.status(502).json({
              error: "Meta failed to transcode the uploaded video",
            });
          }
          if (Date.now() - startedAt > maxMs) {
            return res.status(504).json({
              error:
                "Video is still processing on Meta — wait a minute and publish again",
            });
          }
          await new Promise((r) => setTimeout(r, 3000));
        }
      }

      // Resolve to image_hash for image ads.
      if (!videoId && !imageHash && imageUrlForResolution) {
        // Meta will not re-ingest its own CDN assets: scontent.*.fbcdn.net URLs
        // are signed, referrer-protected and short-lived, and /adimages rejects
        // them (observed as a bare code 3, which reads like a permissions
        // problem and sent us down the wrong path entirely). If we've reached
        // here with one, the creative's stored image_hash went missing upstream
        // — say that, rather than making a call that cannot succeed.
        if (/(^|\.)fbcdn\.net|scontent[-.]/i.test(imageUrlForResolution)) {
          return res.status(400).json({
            error:
              "This image is already hosted on Meta but its image reference is missing, so it can't be re-uploaded. Re-select the image in the Creative step (or upload it again) and publish once more.",
            step: "preparing",
          });
        }
        const uploaded = await metaService.uploadImageFromUrl(
          token,
          adAccountId,
          imageUrlForResolution
        );
        imageHash = uploaded.hash;
      }

      // Resolve each carousel card → image_hash. Cards that already carry
      // a hash pass through unchanged; cards with just an imageUrl get
      // uploaded to /adimages here. Done sequentially because Meta rate-
      // limits parallel uploads on the same ad account.
      if (creative.cards && creative.cards.length >= 2) {
        const out: Array<{
          imageHash: string;
          headline?: string;
          description?: string;
          link?: string;
        }> = [];
        for (const card of creative.cards) {
          let hash = card.imageHash;
          if (!hash && card.imageUrl) {
            const uploaded = await metaService.uploadImageFromUrl(
              token,
              adAccountId,
              card.imageUrl
            );
            hash = uploaded.hash;
          }
          if (!hash) {
            return res.status(400).json({
              error: "Each carousel card needs imageUrl or imageHash",
            });
          }
          out.push({
            imageHash: hash,
            headline: card.headline,
            description: card.description,
            link: card.link,
          });
        }
        resolvedCards = out;
      }

      if (!imageHash && !videoId && !resolvedCards) {
        return res.status(400).json({
          error:
            "Could not resolve asset — provide image/video URL, hash, cards, or libraryCreativeId",
        });
      }
      void libCreativeType;

      // ── 2. Create Campaign on Meta ───────────────────────────────────
      const dailyBudget =
        campaign.budgetType === "DAILY" ? budgetNumber : undefined;
      const lifetimeBudget =
        campaign.budgetType === "LIFETIME" ? budgetNumber : undefined;

      publishStep = "create campaign";
      const metaCampaign = await metaService.createCampaign(
        token,
        adAccountId,
        {
          name: campaign.name,
          objective, // OUTCOME_*
          // Important: ad sets carry the budget for OUTCOME_* objectives
          // (campaign-level CBO is opt-in); we don't pass budgets at this
          // level to avoid double-counting.
          status: "PAUSED",
        }
      );
      created.metaCampaignId = metaCampaign.id;

      // ── 3. Create Ad Set ────────────────────────────────────────────
      publishStep = "create ad set";
      const adSet = await metaService.createAdSet(token, adAccountId, {
        name: `${campaign.name} — Ad Set`,
        campaignId: metaCampaign.id,
        objective,
        targeting: targeting as MetaTargeting,
        status: "PAUSED",
        dailyBudget,
        lifetimeBudget,
        // Meta rejects a start_time in the past. A campaign drafted last week
        // and published today would fail on its own stored start date, so
        // clamp to "now" and let Meta schedule from publish time.
        startTime:
          campaign.startDate && campaign.startDate.getTime() > Date.now()
            ? campaign.startDate.toISOString()
            : undefined,
        endTime: campaign.endDate?.toISOString(),
        promotedPageId: pageId,
        promotedPixelId,
      });
      created.adSetId = adSet.id;

      // ── 4. Create Ad Creative ────────────────────────────────────────
      publishStep = "create ad creative";
      const adCreative = await metaService.createAdCreative(
        token,
        adAccountId,
        {
          name: `${campaign.name} — Creative`,
          pageId,
          imageHash,
          videoId,
          cards: resolvedCards,
          thumbnailUrl,
          message: creative.message,
          headline: creative.headline,
          description: creative.description,
          linkUrl: creative.linkUrl,
          callToAction: creative.callToAction,
        }
      );
      created.creativeId = adCreative.id;

      // ── 5. Create Ad ─────────────────────────────────────────────────
      publishStep = "create ad";
      const ad = await metaService.createAd(token, adAccountId, {
        name: `${campaign.name} — Ad`,
        adSetId: adSet.id,
        creativeId: adCreative.id,
        status: "PAUSED",
      });
      created.adId = ad.id;

      // ── 6. Persist to our DB ─────────────────────────────────────────
      const updated = await prisma.campaign.update({
        where: { id: campaign.id },
        data: {
          status: "PAUSED",
          externalId: metaCampaign.id,
          externalAdSetId: adSet.id,
          externalCreativeId: adCreative.id,
          externalAdId: ad.id,
          externalPageId: pageId,
          publishedAt: new Date(),
          publishError: null,
          targeting: targeting as Prisma.InputJsonValue,
        },
      });

      return res.status(201).json({
        success: true,
        campaign: updated,
        meta: {
          campaignId: metaCampaign.id,
          adSetId: adSet.id,
          creativeId: adCreative.id,
          adId: ad.id,
        },
      });
    } catch (err) {
      const raw = err instanceof Error ? err.message : "Publish to Meta failed";
      // Keep the raw error + failing step in server logs for debugging…
      const stepRaw = `[${publishStep}] ${raw}`;
      // Roll back any Meta-side objects we already created
      await rollback();
      // …but show the user a plain, actionable message.
      const friendly = isMetaError(err)
        ? friendlyMetaError(err)
        : { status: 502, message: stepRaw, detail: raw };
      try {
        await prisma.campaign.update({
          where: { id: campaign.id },
          data: { publishError: friendly.message },
        });
      } catch {
        // ignore — error logging is best-effort
      }
      // Log the full picture: which of the five Meta calls failed, and Meta's
      // verbatim response. The friendly message is a guess at the cause for
      // some codes; this line is the ground truth when one is wrong.
      console.error(
        `[campaigns/publish] FAILED at step "${publishStep}" — ${friendly.detail}\n  raw: ${raw}`
      );
      // `detail` + `step` let the UI show exactly what Meta said and which of
      // the five publish calls failed, without the user digging in server logs.
      return res.status(friendly.status).json({
        error: friendly.message,
        detail: friendly.detail,
        step: publishStep,
      });
    }
    void next; // satisfies lint when no fall-through next() is used
  }
);

/**
 * POST /campaigns/:id/launch
 *
 * Flip a published Meta campaign + its ad set + its ad from PAUSED to
 * ACTIVE. All three need to be ACTIVE for the ad to actually serve —
 * pausing just the campaign isn't sufficient.
 *
 * To pause: call this with `{ status: "PAUSED" }`.
 */
router.post(
  "/:id/launch",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const workspace = await requireWorkspace(req.dbUserId!);
      const campaign = await prisma.campaign.findFirst({
        where: { id: req.params.id, workspaceId: workspace.id },
        // Full record (incl. encrypted accessToken) needed server-side to call
        // Meta. NEVER return this object to the client — the response uses a
        // separate `updated` query without adAccount.
        include: { adAccount: true },
      });
      if (!campaign) {
        return res.status(404).json({ error: "Campaign not found" });
      }
      if (!campaign.externalId) {
        return res
          .status(400)
          .json({ error: "Campaign is not published to Meta yet" });
      }

      const target =
        (req.body?.status as "ACTIVE" | "PAUSED" | undefined) ?? "ACTIVE";
      if (target !== "ACTIVE" && target !== "PAUSED") {
        return res.status(400).json({ error: "status must be ACTIVE or PAUSED" });
      }

      const token = metaService.decryptToken(campaign.adAccount.accessToken);
      const previous: "ACTIVE" | "PAUSED" =
        target === "ACTIVE" ? "PAUSED" : "ACTIVE";

      // Flip campaign → ad set → ad. All three must match for delivery: a
      // campaign set ACTIVE while its ad set is still PAUSED serves nothing,
      // and a PAUSE that only lands on the campaign keeps spending. So if any
      // step fails we put the ones we already flipped back, rather than
      // leaving the user in a half-on state their dashboard can't describe.
      const flipped: string[] = [];
      const ids = [
        campaign.externalId,
        campaign.externalAdSetId,
        campaign.externalAdId,
      ].filter((id): id is string => typeof id === "string" && id !== "");

      try {
        for (const id of ids) {
          await metaService.updateCampaignStatus(token, id, target);
          flipped.push(id);
        }
      } catch (err) {
        for (const id of flipped.reverse()) {
          await metaService
            .updateCampaignStatus(token, id, previous)
            .catch(() => undefined);
        }
        const friendly = isMetaError(err)
          ? friendlyMetaError(err)
          : {
              status: 502,
              message:
                target === "ACTIVE"
                  ? "Meta wouldn't start this campaign. Nothing was changed — check your ad account in Meta Ads Manager and try again."
                  : "Meta wouldn't pause this campaign. Nothing was changed — try again in a moment.",
            };
        return res.status(friendly.status).json({ error: friendly.message });
      }

      const updated = await prisma.campaign.update({
        where: { id: campaign.id },
        data: { status: target },
      });
      res.json({ success: true, campaign: updated });
    } catch (err) {
      next(err);
    }
  }
);

interface PublishPayload {
  pageId?: string;
  targeting?: MetaTargeting;
  creative?: {
    message?: string;
    headline?: string;
    description?: string;
    linkUrl?: string;
    callToAction?: import("../services/meta.service").MetaCallToActionType;
    // Image-ad inputs (one of these resolves to image_hash)
    imageHash?: string;
    imageUrl?: string;
    // Video-ad inputs (one of these resolves to video_id)
    videoId?: string;
    videoUrl?: string;
    thumbnailUrl?: string;
    // Carousel inputs — 2-10 cards. Each card either has a pre-uploaded
    // image_hash OR an imageUrl we re-upload to Meta on publish.
    cards?: Array<{
      imageHash?: string;
      imageUrl?: string;
      headline?: string;
      description?: string;
      link?: string;
    }>;
    // Library reference — image, video, or carousel
    libraryCreativeId?: string;
  };
}

export default router;
