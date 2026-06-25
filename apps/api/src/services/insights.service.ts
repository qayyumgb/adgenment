/**
 * AI Insights. Analyzes real campaign metrics (last 30 days, with week-over-
 * week deltas) and asks Claude (via aiService — native fetch, current model)
 * for specific, data-driven observations. Mirrors budgetOptimizerService:
 *   - Never fabricates — returns [] when there's no data to analyze.
 *   - "Apply" just marks an insight actioned; the user follows it manually.
 *   - Generation is rate-limited (1-hour refresh gate) so we don't spam Claude.
 */

import { Prisma, type Insight, type InsightType } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { aiService } from "./ai.service";

const DAY_MS = 24 * 60 * 60 * 1000;
const INSIGHT_TTL_MS = 7 * DAY_MS;
const REFRESH_GATE_MS = 60 * 60 * 1000; // 1 hour
const VALID_TYPES: InsightType[] = [
  "OPPORTUNITY",
  "WARNING",
  "OPTIMIZATION",
  "ALERT",
];

interface AiInsight {
  type: string;
  title: string;
  message: string;
  impact?: string | null;
  impactType?: string | null;
  affectedCampaigns?: string[];
  platform?: string | null;
  priority?: number;
  confidence?: string;
}

class InsightsService {
  /** Generate fresh insights from real data. Returns the active insight set. */
  async generateInsights(workspaceId: string): Promise<Insight[]> {
    const now = Date.now();
    const thirty = new Date(now - 30 * DAY_MS);
    const seven = new Date(now - 7 * DAY_MS);
    const fourteen = new Date(now - 14 * DAY_MS);

    const campaigns = await prisma.campaign.findMany({
      where: { workspaceId, status: { in: ["ACTIVE", "PAUSED"] } },
      include: {
        adAccount: { select: { platform: true, currency: true } },
        metrics: { where: { date: { gte: thirty } }, orderBy: { date: "asc" } },
      },
    });

    const withMetrics = campaigns.filter((c) => c.metrics.length > 0);
    if (withMetrics.length === 0) {
      // No data to analyze — don't invent insights, don't burn a Claude call.
      await prisma.workspace.update({
        where: { id: workspaceId },
        data: { lastInsightGeneratedAt: new Date() },
      });
      return this.getInsights(workspaceId);
    }

    const currency =
      campaigns.find((c) => c.adAccount?.currency)?.adAccount?.currency ?? "USD";

    const sum = <T>(rows: T[], pick: (r: T) => number) =>
      rows.reduce((s, r) => s + pick(r), 0);

    const campaignData = withMetrics
      .map((c) => {
        const all = c.metrics;
        const last7 = all.filter((m) => m.date >= seven);
        const prev7 = all.filter((m) => m.date >= fourteen && m.date < seven);
        const spend = sum(all, (m) => Number(m.spend));
        const revenue = sum(all, (m) => Number(m.revenue));
        const impressions = sum(all, (m) => m.impressions);
        const clicks = sum(all, (m) => m.clicks);
        const conversions = sum(all, (m) => m.conversions);
        const roasOf = (rows: typeof all) => {
          const s = sum(rows, (m) => Number(m.spend));
          return s > 0 ? sum(rows, (m) => Number(m.revenue)) / s : 0;
        };
        return {
          name: c.name,
          platform: c.adAccount?.platform ?? c.platform,
          status: c.status,
          dailyBudget: Number(c.budget),
          spend30d: +spend.toFixed(2),
          revenue30d: +revenue.toFixed(2),
          impressions,
          clicks,
          conversions,
          roas: spend > 0 ? +(revenue / spend).toFixed(2) : 0,
          ctrPct: impressions > 0 ? +((clicks / impressions) * 100).toFixed(2) : 0,
          last7: {
            spend: +sum(last7, (m) => Number(m.spend)).toFixed(2),
            roas: +roasOf(last7).toFixed(2),
          },
          prev7: {
            spend: +sum(prev7, (m) => Number(m.spend)).toFixed(2),
            roas: +roasOf(prev7).toFixed(2),
          },
        };
      })
      .sort((a, b) => b.spend30d - a.spend30d)
      .slice(0, 25);

    // Platform summary
    const platformMap = new Map<
      string,
      { spend: number; revenue: number; impressions: number; clicks: number }
    >();
    for (const c of campaignData) {
      const p = platformMap.get(c.platform) ?? {
        spend: 0,
        revenue: 0,
        impressions: 0,
        clicks: 0,
      };
      p.spend += c.spend30d;
      p.revenue += c.revenue30d;
      p.impressions += c.impressions;
      p.clicks += c.clicks;
      platformMap.set(c.platform, p);
    }
    const platformSummary = [...platformMap.entries()].map(([platform, p]) => ({
      platform,
      spend: +p.spend.toFixed(2),
      revenue: +p.revenue.toFixed(2),
      roas: p.spend > 0 ? +(p.revenue / p.spend).toFixed(2) : 0,
      ctrPct: p.impressions > 0 ? +((p.clicks / p.impressions) * 100).toFixed(2) : 0,
    }));

    const totalSpend = campaignData.reduce((s, c) => s + c.spend30d, 0);
    const totalRevenue = campaignData.reduce((s, c) => s + c.revenue30d, 0);

    const userMessage = JSON.stringify(
      {
        period: "last_30_days",
        currency,
        totals: {
          spend: +totalSpend.toFixed(2),
          revenue: +totalRevenue.toFixed(2),
          avgRoas: totalSpend > 0 ? +(totalRevenue / totalSpend).toFixed(2) : 0,
        },
        platformSummary,
        campaigns: campaignData,
      },
      null,
      2
    );

    let aiInsights: AiInsight[] = [];
    try {
      const { json } = await aiService.generateInsights(userMessage);
      const parsed = JSON.parse(json) as { insights?: AiInsight[] };
      aiInsights = Array.isArray(parsed.insights) ? parsed.insights : [];
    } catch (err) {
      const code = err instanceof Error ? err.message : "AI_API_ERROR";
      if (code === "AI_PARSE_ERROR") throw new Error("AI_PARSE_ERROR");
      throw new Error("AI_API_ERROR");
    }

    const expiresAt = new Date(now + INSIGHT_TTL_MS);
    for (const ai of aiInsights.slice(0, 8)) {
      const type = (VALID_TYPES as string[]).includes(ai.type)
        ? (ai.type as InsightType)
        : "OPTIMIZATION";
      const title = String(ai.title ?? "").slice(0, 120).trim();
      if (!title || !ai.message) continue;

      const data = {
        type,
        title,
        message: String(ai.message),
        impact: ai.impact ? String(ai.impact) : null,
        impactType: ai.impactType ? String(ai.impactType) : null,
        affectedCampaigns: (Array.isArray(ai.affectedCampaigns)
          ? ai.affectedCampaigns.filter((s) => typeof s === "string")
          : []) as unknown as Prisma.InputJsonValue,
        platform: ai.platform ? String(ai.platform) : null,
        priority: typeof ai.priority === "number" ? Math.round(ai.priority) : 5,
        confidence: ["HIGH", "MEDIUM", "LOW"].includes(String(ai.confidence))
          ? String(ai.confidence)
          : "MEDIUM",
        expiresAt,
      };

      // Dedup by (type, title). Skip if an identical insight was created in the
      // last 24h; refresh it if older; otherwise create.
      const existing = await prisma.insight.findFirst({
        where: { workspaceId, type, title, status: "ACTIVE" },
        orderBy: { createdAt: "desc" },
      });
      if (existing) {
        if (existing.createdAt.getTime() > now - DAY_MS) continue;
        await prisma.insight.update({ where: { id: existing.id }, data });
      } else {
        await prisma.insight.create({ data: { workspaceId, ...data } });
      }
    }

    await prisma.workspace.update({
      where: { id: workspaceId },
      data: { lastInsightGeneratedAt: new Date() },
    });

    return this.getInsights(workspaceId);
  }

  /** Active, non-expired insights, priority then recency. Expires stale ones. */
  async getInsights(workspaceId: string): Promise<Insight[]> {
    await prisma.insight.updateMany({
      where: {
        workspaceId,
        status: "ACTIVE",
        expiresAt: { lt: new Date() },
      },
      data: { status: "EXPIRED" },
    });
    return prisma.insight.findMany({
      where: { workspaceId, status: "ACTIVE" },
      orderBy: [{ priority: "asc" }, { createdAt: "desc" }],
    });
  }

  async dismissInsight(id: string, workspaceId: string): Promise<Insight> {
    const found = await prisma.insight.findFirst({ where: { id, workspaceId } });
    if (!found) throw new Error("INSIGHT_NOT_FOUND");
    return prisma.insight.update({
      where: { id },
      data: { status: "DISMISSED", dismissedAt: new Date() },
    });
  }

  async applyInsight(id: string, workspaceId: string): Promise<Insight> {
    const found = await prisma.insight.findFirst({ where: { id, workspaceId } });
    if (!found) throw new Error("INSIGHT_NOT_FOUND");
    return prisma.insight.update({
      where: { id },
      data: { status: "APPLIED", appliedAt: new Date() },
    });
  }

  /** Restore a dismissed insight back to ACTIVE. */
  async restoreInsight(id: string, workspaceId: string): Promise<Insight> {
    const found = await prisma.insight.findFirst({ where: { id, workspaceId } });
    if (!found) throw new Error("INSIGHT_NOT_FOUND");
    return prisma.insight.update({
      where: { id },
      data: { status: "ACTIVE", dismissedAt: null },
    });
  }

  getDismissed(workspaceId: string): Promise<Insight[]> {
    return prisma.insight.findMany({
      where: { workspaceId, status: "DISMISSED" },
      orderBy: { dismissedAt: "desc" },
      take: 20,
    });
  }

  /**
   * Refresh: regenerate unless we generated within the last hour, in which
   * case return the existing set. Returns { insights, generated }.
   */
  async refreshInsights(
    workspaceId: string
  ): Promise<{ insights: Insight[]; generated: boolean }> {
    const ws = await prisma.workspace.findUnique({
      where: { id: workspaceId },
      select: { lastInsightGeneratedAt: true },
    });
    const last = ws?.lastInsightGeneratedAt?.getTime() ?? 0;
    if (Date.now() - last < REFRESH_GATE_MS) {
      return { insights: await this.getInsights(workspaceId), generated: false };
    }
    return { insights: await this.generateInsights(workspaceId), generated: true };
  }

  async lastGeneratedAt(workspaceId: string): Promise<Date | null> {
    const ws = await prisma.workspace.findUnique({
      where: { id: workspaceId },
      select: { lastInsightGeneratedAt: true },
    });
    return ws?.lastInsightGeneratedAt ?? null;
  }
}

export const insightsService = new InsightsService();
