/**
 * AI Budget Optimizer.
 *
 * Analyzes campaign ROAS over the last 14 days vs the previous 14, then asks
 * Claude (via aiService — native fetch, current model) to recommend budget
 * reallocations. v1 scope:
 *   - "Apply" updates OUR DB only (a planning/what-if tool). It does NOT push
 *     budget changes to the ad platform — that's deferred until Standard Access
 *     (see FUTURE_FEATURES.md).
 *   - Auto-mode is NOT implemented (no cron auto-applies anything).
 *   - If there's no real revenue/ROAS signal, we short-circuit with an
 *     "insufficient data" result instead of asking the model to optimize zeros.
 */

import { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { aiService } from "./ai.service";

export interface CampaignPerformance {
  id: string;
  name: string;
  platform: string;
  budget: number;
  spend: number;
  revenue: number;
  roas: number;
  impressions: number;
  clicks: number;
  ctr: number;
  conversions: number;
  trend: "up" | "down" | "stable";
  trendPercent: number;
}

export interface BudgetRecommendationItem {
  campaignId: string;
  campaignName: string;
  platform: string;
  currentBudget: number;
  recommendedBudget: number;
  budgetChange: number;
  budgetChangePercent: number;
  action: "INCREASE" | "DECREASE" | "PAUSE" | "MAINTAIN";
  reason: string;
  expectedImpact: string;
  confidence: "HIGH" | "MEDIUM" | "LOW";
  priority: number;
}

export interface OptimizationAnalysis {
  /** Set + non-actionable when there isn't enough revenue data to optimize. */
  insufficientData?: boolean;
  /** The saved BudgetRecommendation id (absent when insufficientData). */
  recommendationId?: string;
  currency: string;
  summary: string;
  totalCurrentBudget: number;
  totalRecommendedBudget: number;
  estimatedRoasImprovement: number;
  estimatedRevenueIncrease: number;
  topOpportunity: string;
  biggestRisk: string;
  insights: string[];
  recommendations: BudgetRecommendationItem[];
}

const DAY_MS = 24 * 60 * 60 * 1000;

class BudgetOptimizerService {
  async analyzeAndOptimize(workspaceId: string): Promise<OptimizationAnalysis> {
    const now = Date.now();
    const fourteenDaysAgo = new Date(now - 14 * DAY_MS);
    const twentyEightDaysAgo = new Date(now - 28 * DAY_MS);

    const campaigns = await prisma.campaign.findMany({
      where: { workspaceId, status: { in: ["ACTIVE", "PAUSED"] } },
      include: {
        adAccount: { select: { platform: true, currency: true } },
        metrics: {
          where: { date: { gte: twentyEightDaysAgo } },
          orderBy: { date: "asc" },
        },
      },
    });

    if (campaigns.length === 0) {
      throw new Error("NO_CAMPAIGNS");
    }

    // Currency: first campaign's ad-account currency (budgets are native to the
    // account). Mixed-currency portfolios are rare in beta; default USD.
    const currency =
      campaigns.find((c) => c.adAccount?.currency)?.adAccount?.currency ?? "USD";

    const performances: CampaignPerformance[] = campaigns.map((campaign) => {
      const recent = campaign.metrics.filter((m) => m.date >= fourteenDaysAgo);
      const previous = campaign.metrics.filter(
        (m) => m.date >= twentyEightDaysAgo && m.date < fourteenDaysAgo
      );

      const sum = (rows: typeof recent, pick: (m: (typeof recent)[number]) => number) =>
        rows.reduce((s, m) => s + pick(m), 0);

      const recentSpend = sum(recent, (m) => Number(m.spend));
      const recentRevenue = sum(recent, (m) => Number(m.revenue));
      const recentImpr = sum(recent, (m) => m.impressions);
      const recentClicks = sum(recent, (m) => m.clicks);
      const recentConv = sum(recent, (m) => m.conversions);

      const prevSpend = sum(previous, (m) => Number(m.spend));
      const prevRevenue = sum(previous, (m) => Number(m.revenue));

      const recentRoas = recentSpend > 0 ? recentRevenue / recentSpend : 0;
      const prevRoas = prevSpend > 0 ? prevRevenue / prevSpend : 0;
      const roasTrend = prevRoas > 0 ? ((recentRoas - prevRoas) / prevRoas) * 100 : 0;

      return {
        id: campaign.id,
        name: campaign.name,
        platform: campaign.adAccount?.platform ?? campaign.platform,
        budget: Number(campaign.budget),
        spend: recentSpend,
        revenue: recentRevenue,
        roas: recentRoas,
        impressions: recentImpr,
        clicks: recentClicks,
        ctr: recentImpr > 0 ? recentClicks / recentImpr : 0,
        conversions: recentConv,
        trend: roasTrend > 5 ? "up" : roasTrend < -5 ? "down" : "stable",
        trendPercent: Math.abs(roasTrend),
      };
    });

    const totalBudget = performances.reduce((s, c) => s + c.budget, 0);
    const totalSpend = performances.reduce((s, c) => s + c.spend, 0);
    const totalRevenue = performances.reduce((s, c) => s + c.revenue, 0);

    // Honest gate: ROAS optimization is meaningless without revenue. Most
    // beta campaigns (traffic/awareness) have zero purchase value. Don't burn
    // an AI call or save a recommendation — return a clear state for the UI.
    if (totalRevenue <= 0) {
      return {
        insufficientData: true,
        currency,
        summary:
          "Not enough revenue data to optimize. The Budget Optimizer reallocates spend based on ROAS (return on ad spend), which needs campaigns that track purchase value.",
        totalCurrentBudget: totalBudget,
        totalRecommendedBudget: totalBudget,
        estimatedRoasImprovement: 0,
        estimatedRevenueIncrease: 0,
        topOpportunity: "",
        biggestRisk: "",
        insights: [
          "Your current campaigns have no recorded revenue (they optimize for traffic/awareness, not purchases).",
          "Run a Sales-objective campaign with Meta Pixel purchase tracking to generate ROAS data.",
          "Once campaigns report revenue over ~14 days, AI recommendations will appear here.",
        ],
        recommendations: [],
      };
    }

    const avgRoas = totalSpend > 0 ? totalRevenue / totalSpend : 0;
    const userMessage = [
      `CURRENT PORTFOLIO (currency: ${currency}):`,
      `Total daily budget: ${totalBudget.toFixed(2)}`,
      `Total spend (14d): ${totalSpend.toFixed(2)}`,
      `Total revenue (14d): ${totalRevenue.toFixed(2)}`,
      `Portfolio ROAS: ${avgRoas.toFixed(2)}x`,
      ``,
      `CAMPAIGNS:`,
      JSON.stringify(performances, null, 2),
    ].join("\n");

    let parsed: Omit<OptimizationAnalysis, "currency" | "recommendationId">;
    try {
      const { json } = await aiService.optimizeBudget(userMessage);
      parsed = JSON.parse(json);
    } catch (err) {
      const code = err instanceof Error ? err.message : "AI_API_ERROR";
      if (code === "AI_PARSE_ERROR") throw new Error("AI_PARSE_ERROR");
      throw new Error("AI_API_ERROR");
    }

    const recommendations = Array.isArray(parsed.recommendations)
      ? parsed.recommendations
      : [];

    // Full analysis object (summary, insights, stats, recommendations) so the
    // page can be rebuilt from `latest` after a reload. `performances` is the
    // raw per-campaign snapshot we fed the model, kept for audit.
    const fullAnalysis: OptimizationAnalysis = {
      ...parsed,
      currency,
      recommendations,
    };

    const saved = await prisma.budgetRecommendation.create({
      data: {
        workspaceId,
        status: "PENDING",
        totalBudget: new Prisma.Decimal(totalBudget.toFixed(2)),
        currency,
        analysisData: {
          ...fullAnalysis,
          performances,
        } as unknown as Prisma.InputJsonValue,
        recommendations: recommendations as unknown as Prisma.InputJsonValue,
      },
    });

    return { ...fullAnalysis, recommendationId: saved.id };
  }

  /**
   * Apply a recommendation — DB ONLY (planning). Updates campaign budget, or
   * sets status PAUSED. Does NOT touch the ad platform. Validates each change
   * and scopes every write to the workspace.
   */
  async applyRecommendations(
    workspaceId: string,
    recommendationId: string,
    campaignIds?: string[]
  ): Promise<{ applied: number; skipped: number }> {
    const rec = await prisma.budgetRecommendation.findFirst({
      where: { id: recommendationId, workspaceId },
    });
    if (!rec) throw new Error("RECOMMENDATION_NOT_FOUND");

    const all = (rec.recommendations as unknown as BudgetRecommendationItem[]) ?? [];
    const toApply = campaignIds
      ? all.filter((r) => campaignIds.includes(r.campaignId))
      : all.filter((r) => r.action !== "MAINTAIN");

    let applied = 0;
    let skipped = 0;

    for (const r of toApply) {
      try {
        if (r.action === "MAINTAIN") {
          skipped++;
          continue;
        }
        if (r.action === "PAUSE") {
          const res = await prisma.campaign.updateMany({
            where: { id: r.campaignId, workspaceId },
            data: { status: "PAUSED" },
          });
          res.count > 0 ? applied++ : skipped++;
          continue;
        }
        // INCREASE / DECREASE → set budget, but only if it's a sane positive value.
        if (
          typeof r.recommendedBudget !== "number" ||
          !Number.isFinite(r.recommendedBudget) ||
          r.recommendedBudget <= 0
        ) {
          skipped++;
          continue;
        }
        const res = await prisma.campaign.updateMany({
          where: { id: r.campaignId, workspaceId },
          data: { budget: new Prisma.Decimal(r.recommendedBudget.toFixed(2)) },
        });
        res.count > 0 ? applied++ : skipped++;
      } catch {
        skipped++;
      }
    }

    // APPLIED when applying the full set (no explicit subset); PARTIAL when the
    // caller chose specific campaigns.
    await prisma.budgetRecommendation.update({
      where: { id: recommendationId },
      data: {
        status: campaignIds ? "PARTIAL" : "APPLIED",
        appliedAt: new Date(),
      },
    });

    return { applied, skipped };
  }

  async dismiss(workspaceId: string, recommendationId: string) {
    const rec = await prisma.budgetRecommendation.findFirst({
      where: { id: recommendationId, workspaceId },
    });
    if (!rec) throw new Error("RECOMMENDATION_NOT_FOUND");
    return prisma.budgetRecommendation.update({
      where: { id: recommendationId },
      data: { status: "DISMISSED", dismissedAt: new Date() },
    });
  }

  getHistory(workspaceId: string, limit = 10) {
    return prisma.budgetRecommendation.findMany({
      where: { workspaceId },
      orderBy: { createdAt: "desc" },
      take: limit,
    });
  }

  getLatestPending(workspaceId: string) {
    return prisma.budgetRecommendation.findFirst({
      where: { workspaceId, status: "PENDING" },
      orderBy: { createdAt: "desc" },
    });
  }
}

export const budgetOptimizerService = new BudgetOptimizerService();
