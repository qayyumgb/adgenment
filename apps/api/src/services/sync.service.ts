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
import { decryptToken, encryptToken } from "../lib/crypto";
import { metaService, type MetaCampaign } from "./meta.service";
import { googleService, isGoogleAuthError } from "./google.service";
import { tiktokService } from "./tiktok.service";
import { linkedinService } from "./linkedin.service";

export type SyncResult = {
  platform: string;
  campaignsSynced: number;
  metricsSynced: number;
};

/**
 * Map Meta's status fields to our CampaignStatus enum.
 *
 * Meta has two status fields:
 *   - `status` — toggle state (the on/off switch).
 *   - `effective_status` — actual delivery state.
 *
 * `effective_status` is more accurate because it accounts for budget
 * exhaustion, scheduling, etc. We also treat `stop_time` in the past as
 * ENDED — Meta returns `status: ACTIVE` even for finished campaigns whose
 * delivery is "Completed" in Ads Manager.
 */
function mapMetaStatus(
  status: string,
  effectiveStatus: string | undefined,
  stopTimeIso: string | undefined
): CampaignStatus {
  if (stopTimeIso) {
    const stop = new Date(stopTimeIso).getTime();
    if (!Number.isNaN(stop) && stop < Date.now()) return "ENDED";
  }
  const s = effectiveStatus || status;
  switch (s) {
    case "ACTIVE":
      return "ACTIVE";
    case "PAUSED":
    case "CAMPAIGN_PAUSED":
    case "ADSET_PAUSED":
      return "PAUSED";
    case "DELETED":
    case "ARCHIVED":
      return "ENDED";
    case "PENDING_REVIEW":
    case "DISAPPROVED":
    case "PREAPPROVED":
    case "PENDING_BILLING_INFO":
    case "IN_PROCESS":
    case "WITH_ISSUES":
      return "DRAFT";
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

function mapGoogleStatus(status: string): CampaignStatus {
  switch (status) {
    case "ENABLED":
      return "ACTIVE";
    case "PAUSED":
      return "PAUSED";
    case "REMOVED":
      return "ENDED";
    default:
      return "DRAFT";
  }
}

function mapGoogleChannelType(type: string): string {
  switch (type) {
    case "SEARCH":
      return "Search";
    case "DISPLAY":
      return "Display";
    case "SHOPPING":
      return "Shopping";
    case "VIDEO":
      return "Video";
    case "PERFORMANCE_MAX":
      return "Performance Max";
    case "LOCAL":
      return "Local";
    case "SMART":
      return "Smart";
    case "DISCOVERY":
      return "Discovery";
    case "DEMAND_GEN":
      return "Demand Gen";
    default:
      return type;
  }
}

// Google uses 2037-12-30 as the "no end date" sentinel for ongoing campaigns.
const GOOGLE_NO_END_DATE = "2037-12-30";

function mapTikTokStatus(status: string): CampaignStatus {
  switch (status) {
    case "ENABLE":
    case "CAMPAIGN_STATUS_ENABLE":
    case "ACTIVE":
      return "ACTIVE";
    case "DISABLE":
    case "CAMPAIGN_STATUS_DISABLE":
    case "PAUSE":
      return "PAUSED";
    case "DELETE":
    case "CAMPAIGN_STATUS_DELETE":
      return "ENDED";
    default:
      return "DRAFT";
  }
}

function mapLinkedInStatus(status: string): CampaignStatus {
  switch (status) {
    case "ACTIVE":
      return "ACTIVE";
    case "PAUSED":
      return "PAUSED";
    case "DRAFT":
      return "DRAFT";
    case "ARCHIVED":
    case "CANCELED":
    case "COMPLETED":
      return "ENDED";
    default:
      return "DRAFT";
  }
}

// LinkedIn assumes $50 / external website conversion when revenue isn't
// reported by the API. Rough heuristic — see TODO in IMPLEMENTATION.md.
const LINKEDIN_REVENUE_PER_CONVERSION = 50;

class SyncService {
  async syncMetaAccount(adAccount: AdAccount): Promise<SyncResult> {
    const token = decryptToken(adAccount.accessToken);
    const accountId = adAccount.accountId;

    // 0. Refresh the cached currency/timezone from Meta. The OAuth callback
    //    persists these on first connect, but ad-account currency can change
    //    (it's actually editable in FB Business Manager) so we re-fetch on
    //    every sync to stay accurate.
    try {
      const fresh = await metaService.getAdAccounts(token);
      const match = fresh.find((f) => {
        const raw = f.id.startsWith("act_") ? f.id.slice("act_".length) : f.id;
        return raw === accountId;
      });
      if (match && (match.currency || match.timezone)) {
        await prisma.adAccount.update({
          where: { id: adAccount.id },
          data: {
            currency: match.currency || null,
            timezone: match.timezone || null,
          },
        });
      }
    } catch {
      // best-effort; don't fail the whole sync over metadata
    }

    // 1. Pull campaigns and upsert by (adAccountId, externalId).
    const metaCampaigns = await metaService.getCampaigns(token, accountId);
    const idMap: Record<string, string> = {}; // metaId → our DB cuid
    let campaignsSynced = 0;

    for (const mc of metaCampaigns) {
      const status = mapMetaStatus(mc.status, mc.effective_status, mc.stop_time);
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

  /**
   * Sync a Google Ads customer account. Refreshes the access token via
   * the stored refresh token if Google returns a 401.
   */
  async syncGoogleAccount(adAccount: AdAccount): Promise<SyncResult> {
    const customerId = googleService.normalizeCustomerId(adAccount.accountId);

    // Returns a working access token, refreshing + persisting it if needed.
    const getAccessToken = async (): Promise<string> => {
      let accessToken = decryptToken(adAccount.accessToken);
      // We trust the stored access token first; if any call returns 401,
      // refresh via the stored refresh_token and persist the new one.
      try {
        // Cheap "is the token live" probe — pull one campaign row.
        await googleService.getCampaigns(accessToken, customerId);
        return accessToken;
      } catch (err) {
        if (!isGoogleAuthError(err) || !adAccount.refreshToken) throw err;
        const refresh = decryptToken(adAccount.refreshToken);
        const fresh = await googleService.refreshAccessToken(refresh);
        accessToken = fresh.access_token;
        await prisma.adAccount.update({
          where: { id: adAccount.id },
          data: { accessToken: encryptToken(accessToken) },
        });
        return accessToken;
      }
    };

    const accessToken = await getAccessToken();

    // 1. Pull campaigns and upsert.
    const campaigns = await googleService.getCampaigns(accessToken, customerId);
    const idMap: Record<string, string> = {};
    let campaignsSynced = 0;

    for (const gc of campaigns) {
      if (!gc.id) continue;
      const status = mapGoogleStatus(gc.status);
      const objective = mapGoogleChannelType(gc.advertisingChannelType);
      const budget = gc.budgetAmountMicros
        ? Number(BigInt(gc.budgetAmountMicros)) / 1_000_000
        : 0;
      const startDate = gc.startDate ? new Date(gc.startDate) : null;
      const endDate =
        gc.endDate && gc.endDate !== GOOGLE_NO_END_DATE
          ? new Date(gc.endDate)
          : null;
      const budgetType: BudgetType = "DAILY";

      const campaign = await prisma.campaign.upsert({
        where: {
          adAccountId_externalId: {
            adAccountId: adAccount.id,
            externalId: gc.id,
          },
        },
        create: {
          workspaceId: adAccount.workspaceId,
          adAccountId: adAccount.id,
          platform: "GOOGLE",
          externalId: gc.id,
          name: gc.name,
          status,
          objective,
          budget: new Prisma.Decimal(budget.toFixed(2)),
          budgetType,
          startDate,
          endDate,
          targeting: Prisma.JsonNull,
        },
        update: {
          name: gc.name,
          status,
          objective,
          budget: new Prisma.Decimal(budget.toFixed(2)),
          budgetType,
          startDate,
          endDate,
        },
      });
      idMap[gc.id] = campaign.id;
      campaignsSynced++;
    }

    // 2. Pull last-30d daily metrics and upsert.
    const today = new Date();
    const start = new Date(today);
    start.setUTCDate(today.getUTCDate() - 30);
    const startStr = start.toISOString().slice(0, 10);
    const endStr = today.toISOString().slice(0, 10);

    const metrics = await googleService.getCampaignMetrics(
      accessToken,
      customerId,
      startStr,
      endStr
    );

    let metricsSynced = 0;
    for (const m of metrics) {
      const ourCampaignId = idMap[m.campaignId];
      if (!ourCampaignId || !m.date) continue;

      const spend = m.costMicros
        ? Number(BigInt(m.costMicros)) / 1_000_000
        : 0;
      const impressions = parseInt(m.impressions || "0", 10) || 0;
      const clicks = parseInt(m.clicks || "0", 10) || 0;
      const conversions = parseFloat(m.conversions || "0") || 0;
      const revenue = parseFloat(m.conversionValue || "0") || 0;

      const ctr = impressions > 0 ? clicks / impressions : 0;
      const cpc = clicks > 0 ? spend / clicks : 0;
      const cpm = impressions > 0 ? (spend / impressions) * 1000 : 0;
      const roas = spend > 0 ? revenue / spend : 0;

      const date = dayUTC(m.date);

      const data = {
        impressions,
        clicks,
        spend: new Prisma.Decimal(spend.toFixed(2)),
        conversions: Math.round(conversions),
        revenue: new Prisma.Decimal(revenue.toFixed(2)),
        ctr,
        cpc,
        cpm,
        roas,
      };

      await prisma.campaignMetrics.upsert({
        where: { campaignId_date: { campaignId: ourCampaignId, date } },
        create: { campaignId: ourCampaignId, date, ...data },
        update: data,
      });
      metricsSynced++;
    }

    return { platform: "GOOGLE", campaignsSynced, metricsSynced };
  }

  /**
   * Sync a TikTok Ads advertiser. TikTok returns budgets and spend in the
   * advertiser's currency (not micros) so no conversion is needed.
   */
  async syncTikTokAccount(adAccount: AdAccount): Promise<SyncResult> {
    const accessToken = decryptToken(adAccount.accessToken);
    const advertiserId = adAccount.accountId;

    // 1. Pull campaigns and upsert.
    const campaigns = await tiktokService.getCampaigns(
      accessToken,
      advertiserId
    );
    const idMap: Record<string, string> = {};
    let campaignsSynced = 0;

    for (const tc of campaigns) {
      if (!tc.campaign_id) continue;
      const status = mapTikTokStatus(tc.status);
      const budgetType: BudgetType =
        tc.budget_mode === "BUDGET_MODE_TOTAL" ? "LIFETIME" : "DAILY";

      const campaign = await prisma.campaign.upsert({
        where: {
          adAccountId_externalId: {
            adAccountId: adAccount.id,
            externalId: tc.campaign_id,
          },
        },
        create: {
          workspaceId: adAccount.workspaceId,
          adAccountId: adAccount.id,
          platform: "TIKTOK",
          externalId: tc.campaign_id,
          name: tc.campaign_name,
          status,
          objective: tc.objective_type,
          budget: new Prisma.Decimal((tc.budget ?? 0).toFixed(2)),
          budgetType,
          startDate: tc.create_time ? new Date(tc.create_time) : null,
          endDate: null,
          targeting: Prisma.JsonNull,
        },
        update: {
          name: tc.campaign_name,
          status,
          objective: tc.objective_type,
          budget: new Prisma.Decimal((tc.budget ?? 0).toFixed(2)),
          budgetType,
        },
      });
      idMap[tc.campaign_id] = campaign.id;
      campaignsSynced++;
    }

    // 2. Pull last-30d daily metrics.
    const today = new Date();
    const start = new Date(today);
    start.setUTCDate(today.getUTCDate() - 30);
    const startStr = start.toISOString().slice(0, 10);
    const endStr = today.toISOString().slice(0, 10);

    const metrics = await tiktokService.getCampaignMetrics(
      accessToken,
      advertiserId,
      startStr,
      endStr
    );

    let metricsSynced = 0;
    for (const m of metrics) {
      const ourCampaignId = idMap[m.campaign_id];
      if (!ourCampaignId || !m.stat_time_day) continue;

      const spend = parseFloat(m.spend || "0") || 0;
      const impressions = parseInt(m.impressions || "0", 10) || 0;
      const clicks = parseInt(m.clicks || "0", 10) || 0;
      const conversions = parseFloat(m.conversions || "0") || 0;
      // TikTok doesn't return revenue directly — use 2x spend as a coarse
      // ROAS-2 placeholder. Real revenue should come from the merchant's
      // own pixel/conversion tracking in a future enhancement.
      const revenue = spend * 2;

      const ctr = impressions > 0 ? clicks / impressions : 0;
      const cpc = clicks > 0 ? spend / clicks : 0;
      const cpm = impressions > 0 ? (spend / impressions) * 1000 : 0;
      const roas = spend > 0 ? revenue / spend : 0;

      const date = dayUTC(m.stat_time_day);

      const data = {
        impressions,
        clicks,
        spend: new Prisma.Decimal(spend.toFixed(2)),
        conversions: Math.round(conversions),
        revenue: new Prisma.Decimal(revenue.toFixed(2)),
        ctr,
        cpc,
        cpm,
        roas,
      };

      await prisma.campaignMetrics.upsert({
        where: { campaignId_date: { campaignId: ourCampaignId, date } },
        create: { campaignId: ourCampaignId, date, ...data },
        update: data,
      });
      metricsSynced++;
    }

    return { platform: "TIKTOK", campaignsSynced, metricsSynced };
  }

  /**
   * Sync a LinkedIn Ads account. LinkedIn returns budgets nested as
   * `{ amount, currencyCode }` and run schedules as epoch milliseconds.
   */
  async syncLinkedInAccount(adAccount: AdAccount): Promise<SyncResult> {
    const accessToken = decryptToken(adAccount.accessToken);
    const accountId = adAccount.accountId;

    // 1. Pull campaigns and upsert.
    const campaigns = await linkedinService.getCampaigns(
      accessToken,
      accountId
    );
    const idMap: Record<string, string> = {};
    let campaignsSynced = 0;

    for (const lc of campaigns) {
      if (!lc.id) continue;
      const status = mapLinkedInStatus(lc.status);
      const hasDailyBudget =
        lc.dailyBudget && parseFloat(lc.dailyBudget.amount) > 0;
      const budgetType: BudgetType = hasDailyBudget ? "DAILY" : "LIFETIME";
      const budgetAmount = hasDailyBudget
        ? parseFloat(lc.dailyBudget!.amount)
        : lc.totalBudget
          ? parseFloat(lc.totalBudget.amount)
          : 0;

      const startDate = lc.runSchedule.start
        ? new Date(lc.runSchedule.start)
        : null;
      const endDate = lc.runSchedule.end
        ? new Date(lc.runSchedule.end)
        : null;

      const campaign = await prisma.campaign.upsert({
        where: {
          adAccountId_externalId: {
            adAccountId: adAccount.id,
            externalId: lc.id,
          },
        },
        create: {
          workspaceId: adAccount.workspaceId,
          adAccountId: adAccount.id,
          platform: "LINKEDIN",
          externalId: lc.id,
          name: lc.name,
          status,
          objective: lc.objectiveType,
          budget: new Prisma.Decimal(budgetAmount.toFixed(2)),
          budgetType,
          startDate,
          endDate,
          targeting: Prisma.JsonNull,
        },
        update: {
          name: lc.name,
          status,
          objective: lc.objectiveType,
          budget: new Prisma.Decimal(budgetAmount.toFixed(2)),
          budgetType,
          startDate,
          endDate,
        },
      });
      idMap[lc.id] = campaign.id;
      campaignsSynced++;
    }

    // 2. Pull last-30d daily metrics via the analytics endpoint.
    const today = new Date();
    const start = new Date(today);
    start.setUTCDate(today.getUTCDate() - 30);

    const startDate = {
      year: start.getUTCFullYear(),
      month: start.getUTCMonth() + 1,
      day: start.getUTCDate(),
    };
    const endDate = {
      year: today.getUTCFullYear(),
      month: today.getUTCMonth() + 1,
      day: today.getUTCDate(),
    };

    const analytics = await linkedinService.getCampaignAnalytics(
      accessToken,
      accountId,
      startDate,
      endDate
    );

    let metricsSynced = 0;
    for (const a of analytics) {
      const ourCampaignId = idMap[a.campaignId];
      if (!ourCampaignId || !a.dateStart) continue;

      const spend = parseFloat(a.costInLocalCurrency || "0") || 0;
      const impressions = a.impressions || 0;
      const clicks = a.clicks || 0;
      const conversions = a.externalWebsiteConversions || 0;
      const revenue = conversions * LINKEDIN_REVENUE_PER_CONVERSION;

      const ctr = impressions > 0 ? clicks / impressions : 0;
      const cpc = clicks > 0 ? spend / clicks : 0;
      const cpm = impressions > 0 ? (spend / impressions) * 1000 : 0;
      const roas = spend > 0 ? revenue / spend : 0;

      const date = dayUTC(a.dateStart);

      const data = {
        impressions,
        clicks,
        spend: new Prisma.Decimal(spend.toFixed(2)),
        conversions: Math.round(conversions),
        revenue: new Prisma.Decimal(revenue.toFixed(2)),
        ctr,
        cpc,
        cpm,
        roas,
      };

      await prisma.campaignMetrics.upsert({
        where: { campaignId_date: { campaignId: ourCampaignId, date } },
        create: { campaignId: ourCampaignId, date, ...data },
        update: data,
      });
      metricsSynced++;
    }

    return { platform: "LINKEDIN", campaignsSynced, metricsSynced };
  }
}

export const syncService = new SyncService();
