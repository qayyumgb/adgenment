import { Router, type Request, type Response, type NextFunction } from "express";
import { Prisma, type Platform } from "@prisma/client";
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
function isPlatform(v: unknown): v is Platform {
  return typeof v === "string" && PLATFORMS.includes(v as Platform);
}

function parseDays(value: unknown, fallback = 30): number {
  const n = parseInt(String(value ?? fallback), 10);
  if (!Number.isFinite(n) || n <= 0) return fallback;
  return Math.min(365, n);
}

function pctChange(curr: number, prev: number): number {
  if (prev === 0) return curr === 0 ? 0 : 100;
  return +(((curr - prev) / prev) * 100).toFixed(2);
}

function toNumber(v: Prisma.Decimal | number | null | undefined): number {
  if (v == null) return 0;
  if (typeof v === "number") return v;
  return Number(v.toString());
}

/**
 * GET /analytics/overview
 */
router.get(
  "/overview",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const workspace = await requireWorkspace(req.dbUserId!);
      const days = parseDays(req.query.days);
      const platform = isPlatform(req.query.platform)
        ? req.query.platform
        : null;

      const now = new Date();
      const periodStart = new Date(now);
      periodStart.setUTCDate(now.getUTCDate() - days);
      const prevStart = new Date(periodStart);
      prevStart.setUTCDate(prevStart.getUTCDate() - days);

      const campaignFilter: Prisma.CampaignWhereInput = {
        workspaceId: workspace.id,
        ...(platform ? { platform } : {}),
      };

      const [current, previous] = await Promise.all([
        prisma.campaignMetrics.aggregate({
          where: {
            campaign: campaignFilter,
            date: { gte: periodStart, lte: now },
          },
          _sum: {
            spend: true,
            revenue: true,
            impressions: true,
            clicks: true,
            conversions: true,
          },
        }),
        prisma.campaignMetrics.aggregate({
          where: {
            campaign: campaignFilter,
            date: { gte: prevStart, lt: periodStart },
          },
          _sum: {
            spend: true,
            revenue: true,
            impressions: true,
            clicks: true,
            conversions: true,
          },
        }),
      ]);

      const c = {
        spend: toNumber(current._sum.spend),
        revenue: toNumber(current._sum.revenue),
        impressions: current._sum.impressions ?? 0,
        clicks: current._sum.clicks ?? 0,
        conversions: current._sum.conversions ?? 0,
      };
      const p = {
        spend: toNumber(previous._sum.spend),
        revenue: toNumber(previous._sum.revenue),
        impressions: previous._sum.impressions ?? 0,
        clicks: previous._sum.clicks ?? 0,
        conversions: previous._sum.conversions ?? 0,
      };

      const roas = c.spend > 0 ? c.revenue / c.spend : 0;
      const prevRoas = p.spend > 0 ? p.revenue / p.spend : 0;
      const ctr = c.impressions > 0 ? c.clicks / c.impressions : 0;

      res.json({
        spend: c.spend,
        revenue: c.revenue,
        impressions: c.impressions,
        clicks: c.clicks,
        conversions: c.conversions,
        roas: +roas.toFixed(2),
        ctr: +ctr.toFixed(4),
        changes: {
          spend: pctChange(c.spend, p.spend),
          revenue: pctChange(c.revenue, p.revenue),
          roas: pctChange(roas, prevRoas),
          impressions: pctChange(c.impressions, p.impressions),
          clicks: pctChange(c.clicks, p.clicks),
          conversions: pctChange(c.conversions, p.conversions),
        },
      });
    } catch (err) {
      next(err);
    }
  }
);

const TIMESERIES_METRICS = [
  "spend",
  "revenue",
  "impressions",
  "clicks",
  "conversions",
  "roas",
] as const;
type TimeseriesMetric = (typeof TIMESERIES_METRICS)[number];

/**
 * GET /analytics/timeseries
 */
router.get(
  "/timeseries",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const workspace = await requireWorkspace(req.dbUserId!);
      const days = parseDays(req.query.days);
      const platform = isPlatform(req.query.platform)
        ? req.query.platform
        : null;
      const metricRaw = String(req.query.metric ?? "spend");
      const metric: TimeseriesMetric = TIMESERIES_METRICS.includes(
        metricRaw as TimeseriesMetric
      )
        ? (metricRaw as TimeseriesMetric)
        : "spend";

      const since = new Date();
      since.setUTCDate(since.getUTCDate() - days);

      const grouped = await prisma.campaignMetrics.groupBy({
        by: ["date"],
        where: {
          campaign: {
            workspaceId: workspace.id,
            ...(platform ? { platform } : {}),
          },
          date: { gte: since },
        },
        _sum: {
          spend: true,
          revenue: true,
          impressions: true,
          clicks: true,
          conversions: true,
        },
        orderBy: { date: "asc" },
      });

      const series = grouped.map((row) => {
        const spend = toNumber(row._sum.spend);
        const revenue = toNumber(row._sum.revenue);
        const impressions = row._sum.impressions ?? 0;
        const clicks = row._sum.clicks ?? 0;
        const conversions = row._sum.conversions ?? 0;
        const roas = spend > 0 ? revenue / spend : 0;
        const values: Record<TimeseriesMetric, number> = {
          spend,
          revenue,
          impressions,
          clicks,
          conversions,
          roas: +roas.toFixed(2),
        };
        return {
          date: row.date.toISOString().slice(0, 10),
          value: values[metric],
        };
      });

      res.json(series);
    } catch (err) {
      next(err);
    }
  }
);

/**
 * GET /analytics/by-platform
 */
router.get(
  "/by-platform",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const workspace = await requireWorkspace(req.dbUserId!);
      const days = parseDays(req.query.days);
      const since = new Date();
      since.setUTCDate(since.getUTCDate() - days);

      const rows = await prisma.campaignMetrics.findMany({
        where: {
          campaign: { workspaceId: workspace.id },
          date: { gte: since },
        },
        include: {
          campaign: { select: { platform: true } },
        },
      });

      const byPlatform = new Map<
        Platform,
        {
          platform: Platform;
          spend: number;
          revenue: number;
          impressions: number;
          clicks: number;
          conversions: number;
        }
      >();

      for (const r of rows) {
        const p = r.campaign.platform;
        const bucket = byPlatform.get(p) ?? {
          platform: p,
          spend: 0,
          revenue: 0,
          impressions: 0,
          clicks: 0,
          conversions: 0,
        };
        bucket.spend += toNumber(r.spend);
        bucket.revenue += toNumber(r.revenue);
        bucket.impressions += r.impressions;
        bucket.clicks += r.clicks;
        bucket.conversions += r.conversions;
        byPlatform.set(p, bucket);
      }

      const result = Array.from(byPlatform.values()).map((b) => ({
        ...b,
        roas: b.spend > 0 ? +(b.revenue / b.spend).toFixed(2) : 0,
        ctr:
          b.impressions > 0
            ? +(b.clicks / b.impressions).toFixed(4)
            : 0,
      }));

      result.sort((a, b) => b.spend - a.spend);
      res.json(result);
    } catch (err) {
      next(err);
    }
  }
);

const CAMPAIGN_SORT_FIELDS = [
  "spend",
  "revenue",
  "roas",
  "impressions",
  "clicks",
  "conversions",
] as const;
type CampaignSortField = (typeof CAMPAIGN_SORT_FIELDS)[number];

/**
 * GET /analytics/campaigns
 */
router.get(
  "/campaigns",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const workspace = await requireWorkspace(req.dbUserId!);
      const days = parseDays(req.query.days);
      const sortBy: CampaignSortField = CAMPAIGN_SORT_FIELDS.includes(
        req.query.sortBy as CampaignSortField
      )
        ? (req.query.sortBy as CampaignSortField)
        : "spend";
      const sortOrder =
        String(req.query.sortOrder ?? "desc").toLowerCase() === "asc"
          ? "asc"
          : "desc";
      const page = Math.max(
        1,
        parseInt(String(req.query.page ?? "1"), 10) || 1
      );
      const limit = Math.min(
        100,
        Math.max(1, parseInt(String(req.query.limit ?? "10"), 10) || 10)
      );

      const since = new Date();
      since.setUTCDate(since.getUTCDate() - days);

      const grouped = await prisma.campaignMetrics.groupBy({
        by: ["campaignId"],
        where: {
          campaign: { workspaceId: workspace.id },
          date: { gte: since },
        },
        _sum: {
          spend: true,
          revenue: true,
          impressions: true,
          clicks: true,
          conversions: true,
        },
      });

      const campaigns = await prisma.campaign.findMany({
        where: {
          workspaceId: workspace.id,
          id: { in: grouped.map((g) => g.campaignId) },
        },
        select: { id: true, name: true, platform: true, status: true },
      });
      const campaignMap = new Map(campaigns.map((c) => [c.id, c]));

      const rows = grouped
        .map((g) => {
          const c = campaignMap.get(g.campaignId);
          if (!c) return null;
          const spend = toNumber(g._sum.spend);
          const revenue = toNumber(g._sum.revenue);
          const impressions = g._sum.impressions ?? 0;
          const clicks = g._sum.clicks ?? 0;
          const conversions = g._sum.conversions ?? 0;
          return {
            id: c.id,
            name: c.name,
            platform: c.platform,
            status: c.status,
            spend,
            revenue,
            roas: spend > 0 ? +(revenue / spend).toFixed(2) : 0,
            impressions,
            clicks,
            ctr:
              impressions > 0
                ? +(clicks / impressions).toFixed(4)
                : 0,
            conversions,
            cpa: conversions > 0 ? +(spend / conversions).toFixed(2) : 0,
          };
        })
        .filter((r): r is NonNullable<typeof r> => r !== null);

      rows.sort((a, b) =>
        sortOrder === "asc" ? a[sortBy] - b[sortBy] : b[sortBy] - a[sortBy]
      );

      const total = rows.length;
      const paged = rows.slice((page - 1) * limit, page * limit);

      res.json({
        campaigns: paged,
        total,
        page,
        totalPages: Math.max(1, Math.ceil(total / limit)),
      });
    } catch (err) {
      next(err);
    }
  }
);

export default router;
