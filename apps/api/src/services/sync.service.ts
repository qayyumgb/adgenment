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
import { changeLog } from "./change-log.service";
import { metaService, type MetaAdCreativeInfo, type MetaCampaign } from "./meta.service";
import { googleService, isGoogleAuthError } from "./google.service";
import { tiktokService } from "./tiktok.service";
import { linkedinService } from "./linkedin.service";

export type SyncResult = {
  platform: string;
  campaignsSynced: number;
  metricsSynced: number;
  /** Meta only (B4): ad sets / ads upserted. */
  adSetsSynced?: number;
  adsSynced?: number;
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

type MetaActions = Array<{ action_type: string; value: string }> | undefined;
const PURCHASE_TYPES = ["purchase", "offsite_conversion.fb_pixel_purchase"];
// Meta reports the same add-to-cart under several overlapping types; take the
// first present in this order so one event is never counted twice.
const ADD_TO_CART_TYPES = ["omni_add_to_cart", "add_to_cart", "offsite_conversion.fb_pixel_add_to_cart"];

function firstActionValue(list: MetaActions, types: string[]): number {
  for (const t of types) {
    const hit = list?.find((a) => a.action_type === t);
    if (hit) return parseFloat(hit.value) || 0;
  }
  return 0;
}

/** Spend, clicks, purchases and revenue from one Meta insights row (campaign or ad level). */
export function metaResults(row: {
  spend?: string;
  impressions?: string;
  clicks?: string;
  actions?: MetaActions;
  action_values?: MetaActions;
  purchase_roas?: MetaActions;
}) {
  const spend = parseFloat(row.spend || "0");
  const impressions = parseInt(row.impressions || "0", 10) || 0;
  const clicks = parseInt(row.clicks || "0", 10) || 0;
  const purchaseAction = row.actions?.find((a) => PURCHASE_TYPES.includes(a.action_type));
  const conversions = purchaseAction ? parseFloat(purchaseAction.value) || 0 : 0;
  // Revenue = real purchase value from `action_values` (NOT roas × spend,
  // which is circular and breaks when Meta omits purchase_roas). Falls
  // back to roas × spend only when action_values is absent.
  const purchaseValue = row.action_values?.find((a) => PURCHASE_TYPES.includes(a.action_type));
  const roasEntry = row.purchase_roas?.[0];
  const roas = roasEntry ? parseFloat(roasEntry.value) || 0 : 0;
  const revenue = purchaseValue ? parseFloat(purchaseValue.value) || 0 : roas * spend;
  return { spend, impressions, clicks, conversions, revenue, roas };
}

/** What an ad's creative shows, from whichever of Meta's creative shapes it uses. */
function creativeFields(c: MetaAdCreativeInfo | undefined) {
  const ld = c?.object_story_spec?.link_data;
  const vd = c?.object_story_spec?.video_data;
  const af = c?.asset_feed_spec;
  const cards = ld?.child_attachments ?? [];
  const format = !c ? "UNKNOWN" : c.video_id || vd || af?.videos?.length || c.object_type === "VIDEO" ? "VIDEO" : cards.length > 1 ? "CAROUSEL" : "IMAGE";
  const pick = (...v: (string | undefined | null)[]) => v.find((x) => typeof x === "string" && x.trim() !== "") ?? null;
  return {
    creativeExternalId: c?.id ?? null,
    format,
    imageUrl: pick(c?.image_url, ld?.picture, cards[0]?.picture, vd?.image_url, af?.images?.[0]?.url, af?.videos?.[0]?.thumbnail_url, c?.thumbnail_url),
    headline: pick(c?.title, ld?.name, vd?.title, af?.titles?.[0]?.text, cards[0]?.name),
    body: pick(c?.body, ld?.message, vd?.message, af?.bodies?.[0]?.text),
    callToAction: pick(c?.call_to_action_type, ld?.call_to_action?.type, vd?.call_to_action?.type, af?.call_to_action_types?.[0]),
    linkUrl: pick(ld?.link, vd?.call_to_action?.value?.link, af?.link_urls?.[0]?.website_url, cards[0]?.link),
  };
}

const minor = (v: string | undefined) => (v ? new Prisma.Decimal((parseFloat(v) / 100).toFixed(2)) : null);

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
  /** Sync one ad account on its own platform (Connections, the scheduler, first sync after connect). */
  async syncAccount(adAccount: AdAccount): Promise<SyncResult> {
    // The last failure is kept on the account (sync-failure alerts, A14) and cleared on success.
    try {
      const result = await this.syncByPlatform(adAccount);
      if (adAccount.lastSyncError) await prisma.adAccount.update({ where: { id: adAccount.id }, data: { lastSyncError: null, lastSyncErrorAt: null } }).catch(() => undefined);
      return result;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Sync failed";
      await prisma.adAccount.update({ where: { id: adAccount.id }, data: { lastSyncError: message.slice(0, 500), lastSyncErrorAt: new Date() } }).catch(() => undefined);
      throw err;
    }
  }

  private syncByPlatform(adAccount: AdAccount): Promise<SyncResult> {
    switch (adAccount.platform) {
      case "META":
        return this.syncMetaAccount(adAccount);
      case "GOOGLE":
        return this.syncGoogleAccount(adAccount);
      case "TIKTOK":
        return this.syncTikTokAccount(adAccount);
      case "LINKEDIN":
        return this.syncLinkedInAccount(adAccount);
      default:
        throw new Error(`Advertix can't sync ${adAccount.platform} yet.`);
    }
  }

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
            minDailyBudget: match.minDailyBudget ?? null,
            accountStatus: match.accountStatus ?? null,
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
    // What we had before this sync, to log changes made outside Advertix
    // (Ads Manager). Our own edits update the row immediately, so they don't
    // show up as differences here.
    const known = new Map(
      (
        await prisma.campaign.findMany({
          where: { adAccountId: adAccount.id, externalId: { not: null } },
          select: { id: true, externalId: true, name: true, status: true, budget: true, budgetType: true },
        })
      ).map((c) => [c.externalId as string, c])
    );

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
          // No campaign-level budget means it lives on the ad set(s) — always
          // the case for campaigns published from Advertix. Keep the budget we
          // stored instead of overwriting it with 0.
          ...(amount > 0 ? { budget: new Prisma.Decimal(amount.toFixed(2)), budgetType } : {}),
          startDate: mc.start_time ? new Date(mc.start_time) : null,
          endDate: mc.stop_time ? new Date(mc.stop_time) : null,
        },
      });
      idMap[mc.id] = campaign.id;
      campaignsSynced++;

      const prev = known.get(mc.id);
      if (prev) {
        const base = {
          workspaceId: adAccount.workspaceId,
          campaignId: campaign.id,
          campaignName: campaign.name,
          clientId: adAccount.clientId,
          currency: adAccount.currency,
          actorType: "SYNC" as const,
          platformPushed: true,
          note: "(outside Advertix)",
        };
        if (prev.name !== campaign.name) {
          await changeLog.record({ ...base, action: "campaign.rename", before: { name: prev.name }, after: { name: campaign.name } });
        }
        if (amount > 0 && Math.abs(Number(prev.budget) - amount) >= 0.01) {
          await changeLog.record({
            ...base,
            action: "campaign.budget",
            before: { budget: Number(prev.budget), budgetType: prev.budgetType },
            after: { budget: amount, budgetType },
          });
        }
        // Only deliberate on / off flips; review or billing states would be noise.
        const flip = (a: string, b: string) => (a === "ACTIVE" && b === "PAUSED") || (a === "PAUSED" && b === "ACTIVE");
        if (flip(prev.status, campaign.status)) {
          await changeLog.record({ ...base, action: "campaign.status", before: { status: prev.status }, after: { status: campaign.status } });
        }
      }
    }

    // 2. Daily insights → metrics. The first sync of an account pulls 90 days
    //    (Analytics offers a 90-day range); later syncs refresh the last 30.
    const datePreset = adAccount.backfilledAt ? "last_30d" : "last_90d";
    const insights = await metaService.getCampaignInsights(
      token,
      accountId,
      datePreset
    );
    let metricsSynced = 0;

    for (const insight of insights) {
      const ourCampaignId = idMap[insight.campaign_id];
      if (!ourCampaignId) continue;

      const { spend, impressions, clicks, conversions, revenue, roas } = metaResults(insight);

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

    // 3. Range-level unique reach per campaign. Reach is de-duplicated across
    //    days, so it can't be summed from the daily rows above — fetch the
    //    single period figure and snapshot it on each campaign. Non-fatal.
    try {
      const reachMap = await metaService.getCampaignReach(
        token,
        accountId,
        "last_30d"
      );
      await Promise.all(
        Object.entries(reachMap).map(([metaId, reach]) => {
          const ourId = idMap[metaId];
          if (!ourId) return Promise.resolve(null);
          return prisma.campaign.update({
            where: { id: ourId },
            data: { reach },
          });
        })
      );
    } catch (err) {
      console.error("[sync:meta] reach fetch failed (non-fatal):", err);
    }

    // 4. Ad sets, ads and ad-level daily results (B4). Non-fatal: campaign
    //    data above is still good if this part fails, and the 90-day backfill
    //    is retried on the next sync.
    let structure: { adSets: number; ads: number } | null = null;
    try {
      structure = await this.syncMetaStructure(adAccount, token, idMap, datePreset);
    } catch (err) {
      console.error("[sync:meta] ad sets / ads failed (non-fatal):", err instanceof Error ? err.message : err);
    }

    // 5. Stamp the successful sync so the UI can show "last synced" and the
    //    scheduler can skip recently-synced accounts.
    await prisma.adAccount.update({
      where: { id: adAccount.id },
      data: { lastSyncedAt: new Date(), ...(structure && !adAccount.backfilledAt ? { backfilledAt: new Date() } : {}) },
    });

    return { platform: "META", campaignsSynced, metricsSynced, adSetsSynced: structure?.adSets, adsSynced: structure?.ads };
  }

  /**
   * Refresh one published campaign's ad sets and ads right after publish or
   * launch, so the campaign page shows them without waiting for a sync.
   */
  async syncMetaCampaignStructure(campaignId: string): Promise<void> {
    const c = await prisma.campaign.findUnique({ where: { id: campaignId }, include: { adAccount: true } });
    if (!c || c.platform !== "META" || !c.externalId || !c.adAccount.isActive) return;
    const token = decryptToken(c.adAccount.accessToken);
    await this.syncMetaStructure(c.adAccount, token, { [c.externalId]: c.id }, null, c.externalId);
  }

  /**
   * Campaigns published from Advertix keep their budget on their one ad set
   * ("<name> — Ad Set"). Ones published before we stored that ad set's id
   * showed a budget of 0 and couldn't change it: link them here. Linked
   * campaigns show the ad set's budget, so Ads Manager edits show up too.
   */
  private async linkPublishedAdSets(campaignIds: string[]) {
    const campaigns = await prisma.campaign.findMany({
      where: { id: { in: campaignIds } },
      select: { id: true, name: true, budget: true, budgetType: true, externalAdSetId: true, adSets: { where: { status: { not: "ENDED" } }, select: { externalId: true, name: true, dailyBudget: true, lifetimeBudget: true } } },
    });
    for (const c of campaigns) {
      const s = c.externalAdSetId ? c.adSets.find((x) => x.externalId === c.externalAdSetId) : c.adSets.length === 1 && Number(c.budget) === 0 && c.adSets[0].name === `${c.name} — Ad Set` ? c.adSets[0] : undefined;
      if (!s) continue;
      const daily = Number(s.dailyBudget ?? 0);
      const lifetime = Number(s.lifetimeBudget ?? 0);
      const [budget, budgetType] = daily > 0 ? [s.dailyBudget!, "DAILY" as const] : lifetime > 0 ? [s.lifetimeBudget!, "LIFETIME" as const] : [null, null];
      if (!budget) continue;
      if (c.externalAdSetId && Number(c.budget) === Number(budget) && c.budgetType === budgetType) continue;
      await prisma.campaign.update({ where: { id: c.id }, data: { externalAdSetId: s.externalId, budget, budgetType } });
    }
  }

  /**
   * Ad sets, ads and (when `datePreset` is set) ad-level daily results for
   * the campaigns in `idMap` (Meta campaign id → our id). With
   * `onlyCampaign`, only that campaign's objects are fetched.
   */
  private async syncMetaStructure(
    adAccount: AdAccount,
    token: string,
    idMap: Record<string, string>,
    datePreset: string | null,
    onlyCampaign?: string
  ): Promise<{ adSets: number; ads: number }> {
    const accountId = adAccount.accountId;
    const ourCampaignIds = Object.values(idMap);

    // Ad sets.
    const metaAdSets = await metaService.getAdSets(token, accountId, onlyCampaign);
    const adSetMap: Record<string, string> = {}; // Meta ad set id → our id
    for (const s of metaAdSets) {
      const campaignId = idMap[s.campaign_id];
      if (!campaignId) continue;
      const data = {
        name: s.name,
        status: mapMetaStatus(s.status, s.effective_status, s.end_time),
        effectiveStatus: s.effective_status ?? null,
        dailyBudget: minor(s.daily_budget),
        lifetimeBudget: minor(s.lifetime_budget),
        optimizationGoal: s.optimization_goal ?? null,
        learningStage: s.learning_stage_info?.status ?? null,
        targeting: s.targeting ? (s.targeting as Prisma.InputJsonValue) : Prisma.JsonNull,
        startTime: s.start_time ? new Date(s.start_time) : null,
        endTime: s.end_time ? new Date(s.end_time) : null,
      };
      const row = await prisma.adSet.upsert({
        where: { campaignId_externalId: { campaignId, externalId: s.id } },
        create: { campaignId, externalId: s.id, ...data },
        update: data,
      });
      adSetMap[s.id] = row.id;
    }
    await this.linkPublishedAdSets(ourCampaignIds);

    // Ads.
    const metaAds = await metaService.getAds(token, accountId, onlyCampaign);
    const adMap: Record<string, string> = {}; // Meta ad id → our id
    for (const a of metaAds) {
      const adSetId = adSetMap[a.adset_id];
      const campaignId = idMap[a.campaign_id];
      if (!adSetId || !campaignId) continue;
      const data = {
        campaignId,
        name: a.name,
        status: mapMetaStatus(a.status, a.effective_status, undefined),
        effectiveStatus: a.effective_status ?? null,
        ...creativeFields(a.creative),
      };
      const row = await prisma.ad.upsert({
        where: { adSetId_externalId: { adSetId, externalId: a.id } },
        create: { adSetId, externalId: a.id, ...data },
        update: data,
      });
      adMap[a.id] = row.id;
    }

    // Deleted on Meta (no longer listed) → ended here; history stays.
    await prisma.adSet.updateMany({
      where: { campaignId: { in: ourCampaignIds }, externalId: { notIn: Object.keys(adSetMap) }, status: { not: "ENDED" } },
      data: { status: "ENDED", effectiveStatus: "DELETED" },
    });
    await prisma.ad.updateMany({
      where: { campaignId: { in: ourCampaignIds }, externalId: { notIn: Object.keys(adMap) }, status: { not: "ENDED" } },
      data: { status: "ENDED", effectiveStatus: "DELETED" },
    });

    if (datePreset) {
      // Daily ad results, written in batches.
      const rows = await metaService.getAdInsights(token, accountId, datePreset);
      const writes: Prisma.PrismaPromise<unknown>[] = [];
      for (const r of rows) {
        const adId = adMap[r.ad_id];
        if (!adId) continue;
        const { spend, impressions, clicks, conversions, revenue } = metaResults(r);
        const values = {
          impressions,
          reach: parseInt(r.reach || "0", 10) || 0,
          clicks,
          spend: new Prisma.Decimal(spend.toFixed(2)),
          conversions: Math.round(conversions),
          revenue: new Prisma.Decimal(revenue.toFixed(2)),
          landingPageViews: Math.round(firstActionValue(r.actions, ["landing_page_view"])),
          addToCart: Math.round(firstActionValue(r.actions, ADD_TO_CART_TYPES)),
        };
        const date = dayUTC(r.date_start);
        writes.push(
          prisma.adMetrics.upsert({
            where: { adId_date: { adId, date } },
            create: { adId, date, ...values },
            update: values,
          })
        );
      }
      for (let i = 0; i < writes.length; i += 100) await prisma.$transaction(writes.slice(i, i + 100));

      // 30-day reach and frequency (frequency drives the fatigue read).
      const [byAd, byAdSet] = await Promise.all([
        metaService.getReachFrequency(token, accountId, "ad"),
        metaService.getReachFrequency(token, accountId, "adset"),
      ]);
      const updates: Prisma.PrismaPromise<unknown>[] = [
        ...Object.entries(byAd)
          .filter(([metaId]) => adMap[metaId])
          .map(([metaId, v]) => prisma.ad.update({ where: { id: adMap[metaId] }, data: { reach30d: v.reach, frequency30d: v.frequency } })),
        ...Object.entries(byAdSet)
          .filter(([metaId]) => adSetMap[metaId])
          .map(([metaId, v]) => prisma.adSet.update({ where: { id: adSetMap[metaId] }, data: { reach30d: v.reach, frequency30d: v.frequency } })),
      ];
      for (let i = 0; i < updates.length; i += 100) await prisma.$transaction(updates.slice(i, i + 100));
    }

    return { adSets: Object.keys(adSetMap).length, ads: Object.keys(adMap).length };
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

    await prisma.adAccount.update({ where: { id: adAccount.id }, data: { lastSyncedAt: new Date() } });
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

    await prisma.adAccount.update({ where: { id: adAccount.id }, data: { lastSyncedAt: new Date() } });
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

    await prisma.adAccount.update({ where: { id: adAccount.id }, data: { lastSyncedAt: new Date() } });
    return { platform: "LINKEDIN", campaignsSynced, metricsSynced };
  }
}

export const syncService = new SyncService();
