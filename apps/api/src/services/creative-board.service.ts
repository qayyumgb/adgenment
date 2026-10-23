import type { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { campaignClientWhere, ownedOrSharedWhere } from "../lib/clients";
import { adResults, ctrOf, zero, type FatigueRead, type Totals } from "../lib/ad-metrics";
import { ownStatus } from "./campaign-actions.service";
import { refreshExpiredMetaMedia } from "./meta-media-refresh.service";

/**
 * The Creatives board (plan A8): library creatives and the ads synced from
 * Meta (B4) as one list, with results, delivery status and creative fatigue.
 *
 * A library creative is linked to the Meta ad Advertix published it as:
 * publishing from the library sets `Creative.campaignId`, and the campaign's
 * `externalCreativeId` is the creative of the ad we created. Synced ads with
 * no library creative behind them are listed as their own items ("From Meta").
 */

export type BoardStatus = "Live" | "Learning" | "Fatigued" | "Paused" | "In review" | "Rejected" | "Ended" | "Draft" | "Archived";

export type BoardItem = {
  key: string;
  source: "library" | "meta";
  creativeId: string | null;
  adId: string | null;
  campaignId: string | null;
  campaignName: string | null;
  name: string;
  format: "IMAGE" | "VIDEO" | "CAROUSEL" | "TEXT" | "UNKNOWN";
  imageUrl: string | null;
  videoId: string | null;
  headline: string | null;
  body: string | null;
  callToAction: string | null;
  linkUrl: string | null;
  cardCount: number;
  status: BoardStatus;
  platform: string;
  clientId: string | null;
  currency: string | null;
  aiGenerated: boolean;
  createdAt: string;
  /** Library item with no image / video yet. */
  needsMedia: boolean;
  totals: Totals;
  frequency: number;
  fatigue: FatigueRead;
  /** Live ads this creative runs in. */
  adCount: number;
  /** Meta ads only: its own on / off switch, and why it can't be changed. */
  switchOn: boolean | null;
  statusBlocker: string | null;
  /** Library items: the raw content, for the edit dialog. */
  content: Prisma.JsonValue | null;
};

const str = (v: unknown) => (typeof v === "string" && v.trim() !== "" ? v : null);
const first = (v: unknown) => (Array.isArray(v) ? str(v.find((x) => str(x))) : null);

/** What a library creative shows, from its free-form content JSON. */
function libraryFields(type: string, content: Prisma.JsonValue) {
  const c = (content && typeof content === "object" && !Array.isArray(content) ? content : {}) as Record<string, unknown>;
  const cards = Array.isArray(c.cards) ? (c.cards as Record<string, unknown>[]) : [];
  const card0 = cards[0] ?? {};
  const imageUrl = str(c.thumbnailUrl) ?? str(c.imageUrl) ?? str(c.url) ?? str(c.image_url) ?? str(card0.imageUrl) ?? str(card0.url);
  const videoId = str(c.videoId);
  return {
    format: (type === "IMAGE" || type === "VIDEO" || type === "CAROUSEL" || type === "TEXT" ? type : "UNKNOWN") as BoardItem["format"],
    imageUrl: imageUrl && /^https?:|^data:image\//.test(imageUrl) ? imageUrl : null,
    videoId,
    headline: first(c.headlines) ?? str(c.headline) ?? str(card0.headline),
    body: first(c.primary_texts) ?? str(c.primaryText) ?? str(c.text) ?? str(c.copy),
    callToAction: first(c.ctas) ?? str(c.callToAction),
    linkUrl: str(c.linkUrl) ?? str(card0.link),
    cardCount: cards.length,
    needsMedia: type !== "TEXT" && !imageUrl && !videoId,
  };
}

type AdRow = Prisma.AdGetPayload<{
  include: {
    adSet: { select: { learningStage: true } };
    campaign: { select: { id: true; name: true; status: true; externalCreativeId: true; adAccount: { select: { clientId: true; currency: true; isActive: true } } } };
  };
}>;

/** How a synced ad is delivering, in board terms. */
function adStatus(ad: AdRow, fatigue: FatigueRead): BoardStatus {
  const eff = ad.effectiveStatus;
  if (ad.status === "ENDED" || eff === "DELETED" || eff === "ARCHIVED") return "Ended";
  if (eff === "DISAPPROVED") return "Rejected";
  if (eff === "PENDING_REVIEW" || eff === "IN_PROCESS" || eff === "PREAPPROVED") return "In review";
  if (eff !== "ACTIVE" && ad.status !== "ACTIVE") return "Paused";
  if (fatigue.level === "fatigued") return "Fatigued";
  if (ad.adSet.learningStage === "LEARNING") return "Learning";
  return "Live";
}

// When one creative runs in several ads, the item takes the most telling status.
const RANK: BoardStatus[] = ["Fatigued", "Live", "Learning", "In review", "Rejected", "Paused", "Ended"];

function blockerFor(ad: AdRow): string | null {
  if (!ad.campaign.adAccount.isActive) return "The ad account is disconnected. Reconnect it in Connections.";
  if (ad.status === "ENDED") return "It has ended or was deleted on Meta.";
  if (ad.status === "DRAFT") return "Meta is still reviewing it, or it needs attention in Ads Manager.";
  return null;
}

export async function creativeBoard(workspaceId: string, clientId: string | null, days: number) {
  const [library, ads] = await Promise.all([
    prisma.creative.findMany({
      where: { workspaceId, ...ownedOrSharedWhere(clientId) },
      include: { campaign: { select: { id: true, name: true, platform: true, externalCreativeId: true } } },
      orderBy: { createdAt: "desc" },
      take: 500,
    }),
    prisma.ad.findMany({
      where: { campaign: { workspaceId, platform: "META", ...campaignClientWhere(clientId) } },
      include: {
        adSet: { select: { learningStage: true } },
        campaign: { select: { id: true, name: true, status: true, externalCreativeId: true, adAccount: { select: { clientId: true, currency: true, isActive: true } } } },
      },
      orderBy: { createdAt: "desc" },
      take: 1000,
    }),
  ]);
  // Meta CDN preview URLs expire; re-resolve stale ones (no-op when fresh).
  await refreshExpiredMetaMedia(workspaceId, library);
  const results = await adResults(ads.map((a) => a.id), days);

  // Library creative ↔ the ad Advertix published it as.
  const libraryByAdKey = new Map<string, string>();
  for (const c of library) {
    if (c.campaignId && c.campaign?.externalCreativeId) libraryByAdKey.set(`${c.campaignId}:${c.campaign.externalCreativeId}`, c.id);
  }
  const linked = new Map<string, AdRow[]>();
  const loose: AdRow[] = [];
  for (const ad of ads) {
    const creativeId = ad.creativeExternalId ? libraryByAdKey.get(`${ad.campaignId}:${ad.creativeExternalId}`) : undefined;
    if (creativeId) linked.set(creativeId, [...(linked.get(creativeId) ?? []), ad]);
    else loose.push(ad);
  }

  const items: BoardItem[] = [];
  for (const c of library) {
    const mine = linked.get(c.id) ?? [];
    const f = libraryFields(c.type, c.content);
    const totals = mine.reduce((acc, a) => {
      const t = results.totals(a.id);
      (Object.keys(acc) as (keyof Totals)[]).forEach((k) => (acc[k] += t[k]));
      return acc;
    }, zero());
    const reads = mine.map((a) => ({ ad: a, fatigue: results.fatigue(a.id, a.frequency30d) }));
    const statuses = reads.map((r) => adStatus(r.ad, r.fatigue));
    const status: BoardStatus = statuses.length
      ? RANK.find((s) => statuses.includes(s)) ?? "Ended"
      : c.status === "ARCHIVED"
        ? "Archived"
        : "Draft";
    const worst = reads.find((r) => r.fatigue.level === "fatigued") ?? reads.find((r) => r.fatigue.level === "watch") ?? reads[0];
    const top = [...mine].sort((a, b) => results.totals(b.id).spend - results.totals(a.id).spend)[0];
    items.push({
      key: `lib:${c.id}`,
      source: "library",
      creativeId: c.id,
      adId: null,
      campaignId: c.campaign?.id ?? null,
      campaignName: c.campaign?.name ?? null,
      name: c.name,
      ...f,
      status,
      platform: c.campaign?.platform ?? "META",
      clientId: c.clientId,
      currency: top?.campaign.adAccount.currency ?? null,
      aiGenerated: c.aiGenerated,
      createdAt: c.createdAt.toISOString(),
      totals,
      frequency: mine.reduce((m, a) => Math.max(m, a.frequency30d), 0),
      fatigue: worst?.fatigue ?? { level: "ok", reason: null },
      adCount: mine.filter((a) => a.status !== "ENDED").length,
      switchOn: null,
      statusBlocker: null,
      content: c.content,
    });
  }
  for (const ad of loose) {
    const fatigue = results.fatigue(ad.id, ad.frequency30d);
    items.push({
      key: `ad:${ad.id}`,
      source: "meta",
      creativeId: null,
      adId: ad.id,
      campaignId: ad.campaign.id,
      campaignName: ad.campaign.name,
      name: ad.name,
      format: (["IMAGE", "VIDEO", "CAROUSEL"].includes(ad.format) ? ad.format : "UNKNOWN") as BoardItem["format"],
      imageUrl: ad.imageUrl,
      videoId: null,
      headline: ad.headline,
      body: ad.body,
      callToAction: ad.callToAction,
      linkUrl: ad.linkUrl,
      cardCount: 0,
      status: adStatus(ad, fatigue),
      platform: "META",
      clientId: ad.campaign.adAccount.clientId,
      currency: ad.campaign.adAccount.currency,
      aiGenerated: false,
      createdAt: ad.createdAt.toISOString(),
      needsMedia: false,
      totals: results.totals(ad.id),
      frequency: ad.frequency30d,
      fatigue,
      adCount: ad.status === "ENDED" ? 0 : 1,
      switchOn: ownStatus(ad) === "ACTIVE",
      statusBlocker: blockerFor(ad),
      content: null,
    });
  }

  // The hook to build on: the best-returning item with real spend and copy.
  const withSpend = items.filter((i) => i.totals.spend > 0);
  const avgSpend = withSpend.reduce((a, i) => a + i.totals.spend, 0) / Math.max(1, withSpend.length);
  const best = withSpend
    .filter((i) => (i.headline || i.body) && i.totals.revenue > 0 && i.totals.spend >= avgSpend * 0.25)
    .sort((a, b) => b.totals.revenue / b.totals.spend - a.totals.revenue / a.totals.spend)[0];
  const bestHook = best
    ? {
        key: best.key,
        name: best.name,
        text: (best.headline ?? best.body ?? "").slice(0, 160),
        roas: +(best.totals.revenue / best.totals.spend).toFixed(2),
        ctr: ctrOf(best.totals),
      }
    : null;

  return { days, items, bestHook };
}
