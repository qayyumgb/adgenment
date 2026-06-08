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
          adAccount: {
            select: {
              platform: true,
              accountName: true,
              currency: true,
              timezone: true,
            },
          },
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
        adAccount: true,
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
      });
      if (!existing) {
        return res.status(404).json({ error: "Campaign not found" });
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

export default router;
