/**
 * Sync service — pulls campaigns + daily insights from connected ad platforms
 * into our DB. Today: Meta only. Designed so Google / TikTok / LinkedIn can
 * each add their own `syncXAccount` method later.
 */

import {
  Prisma,
  type AdAccount,
  type CampaignStatus,
  type BudgetType,
} from "@prisma/client";
import { prisma } from "../lib/prisma";
import { metaService, type MetaCampaign } from "./meta.service";

export type SyncResult = {
  platform: string;
  campaignsSynced: number;
  metricsSynced: number;
};

function mapMetaStatus(status: string): CampaignStatus {
  switch (status) {
    case "ACTIVE":
      return "ACTIVE";
    case "PAUSED":
      return "PAUSED";
    case "DELETED":
    case "ARCHIVED":
      return "ENDED";
    default:
      return "DRAFT";
  }
}

function metaBudget(mc: MetaCampaign): { amount: number; type: BudgetType } {
  if (mc.daily_budget) {
    return { amount: parseFloat(mc.daily_budget) / 100, type: "DAILY" };
  }
  if (mc.lifetime_budget) {
    return { amount: parseFloat(mc.lifetime_budget) / 100, type: "LIFETIME" };
  }
  return { amount: 0, type: "DAILY" };
}

function dayUTC(iso: string): Date {
  const d = new Date(iso);
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

class SyncService {
  async syncMetaAccount(adAccount: AdAccount): Promise<SyncResult> {
    const token = metaService.decryptToken(adAccount.accessToken);
    const accountId = adAccount.accountId;

    // 1. Pull campaigns and upsert by (adAccountId, externalId).
    const metaCampaigns = await metaService.getCampaigns(token, accountId);
    const idMap: Record<string, string> = {}; // metaId → our DB cuid
    let campaignsSynced = 0;

    for (const mc of metaCampaigns) {
      const status = mapMetaStatus(mc.status);
      const { amount, type: budgetType } = metaBudget(mc);

      const campaign = await prisma.campaign.upsert({
        where: {
          adAccountId_externalId: {
            adAccountId: adAccount.id,
            externalId: mc.id,
          },
        },
        create: {
          workspaceId: adAccount.workspaceId,
          adAccountId: adAccount.id,
          platform: "META",
          name: mc.name,
          status,
          objective: mc.objective ?? "UNKNOWN",
          budget: new Prisma.Decimal(amount.toFixed(2)),
          budgetType,
          externalId: mc.id,
          startDate: mc.start_time ? new Date(mc.start_time) : null,
          endDate: mc.stop_time ? new Date(mc.stop_time) : null,
          targeting: Prisma.JsonNull,
        },
        update: {
          name: mc.name,
          status,
          objective: mc.objective ?? "UNKNOWN",
          budget: new Prisma.Decimal(amount.toFixed(2)),
          budgetType,
          startDate: mc.start_time ? new Date(mc.start_time) : null,
          endDate: mc.stop_time ? new Date(mc.stop_time) : null,
        },
      });
      idMap[mc.id] = campaign.id;
      campaignsSynced++;
    }

    // 2. Pull last-30d insights with daily breakdown and upsert metrics.
    const insights = await metaService.getCampaignInsights(
      token,
      accountId,
      "last_30d"
    );
    let metricsSynced = 0;

    for (const insight of insights) {
      const ourCampaignId = idMap[insight.campaign_id];
      if (!ourCampaignId) continue;

      const spend = parseFloat(insight.spend || "0");
      const impressions = parseInt(insight.impressions || "0", 10) || 0;
      const clicks = parseInt(insight.clicks || "0", 10) || 0;

      const purchaseAction = insight.actions?.find(
        (a) =>
          a.action_type === "purchase" ||
          a.action_type === "offsite_conversion.fb_pixel_purchase"
      );
      const conversions = purchaseAction
        ? parseFloat(purchaseAction.value) || 0
        : 0;

      const roasEntry = insight.purchase_roas?.[0];
      const roas = roasEntry ? parseFloat(roasEntry.value) || 0 : 0;
      const revenue = roas * spend;

      const ctr = impressions > 0 ? clicks / impressions : 0;
      const cpc = clicks > 0 ? spend / clicks : 0;
      const cpm = impressions > 0 ? (spend / impressions) * 1000 : 0;

      const date = dayUTC(insight.date_start);

      await prisma.campaignMetrics.upsert({
        where: {
          campaignId_date: { campaignId: ourCampaignId, date },
        },
        create: {
          campaignId: ourCampaignId,
          date,
          impressions,
          clicks,
          spend: new Prisma.Decimal(spend.toFixed(2)),
          conversions: Math.round(conversions),
          revenue: new Prisma.Decimal(revenue.toFixed(2)),
          ctr,
          cpc,
          cpm,
          roas,
        },
        update: {
          impressions,
          clicks,
          spend: new Prisma.Decimal(spend.toFixed(2)),
          conversions: Math.round(conversions),
          revenue: new Prisma.Decimal(revenue.toFixed(2)),
          ctr,
          cpc,
          cpm,
          roas,
        },
      });
      metricsSynced++;
    }

    return { platform: "META", campaignsSynced, metricsSynced };
  }
}

export const syncService = new SyncService();
