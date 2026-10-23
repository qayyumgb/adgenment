import type { AudienceType } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { campaignClientWhere, ownedOrSharedWhere } from "../lib/clients";
import { adResults, zero, type Totals } from "../lib/ad-metrics";
import { audienceLine, customAudienceIds, targetingKey } from "../lib/targeting";
import { friendlyMetaError, isMetaError } from "../lib/meta-errors";
import { metaService, type MetaCustomAudience, type MetaSavedAudience } from "./meta.service";

/**
 * The Audiences board (plan A9): saved audiences (Advertix library) and the
 * custom / lookalike / saved audiences on the client's Meta ad account, with
 * size, where each is used, its results, a status, and warnings Advertix
 * can actually verify (decision on open question 1: no overlap %, because
 * Meta's overlap tool isn't in its public API).
 *
 * Where an audience is used:
 *  - saved audiences: campaigns created from them (`Campaign.audienceId`);
 *  - Meta custom / lookalike audiences: synced ad sets (B4) whose targeting
 *    includes them.
 * Meta saved audiences are copied into ad sets when used, so Meta doesn't
 * report where they run; their usage is unknown, not zero.
 */

export type AudienceStatus = "Ready" | "Unused" | "Building" | "Learning limited" | "Underperforming";
export type AudienceWarning = { kind: "lookalike-seed" | "shared-ad-sets" | "duplicate"; text: string; campaignId: string | null };

export type AudienceItem = {
  key: string;
  source: "library" | "meta-custom" | "meta-saved";
  id: string;
  name: string;
  /** Library: Advertix type; Meta: subtype in words. */
  typeLabel: string;
  summary: string;
  description: string | null;
  sizeLower: number | null;
  sizeUpper: number | null;
  clientId: string | null;
  /** Meta items: the ad account (our id) it lives on — lookalikes are built there. */
  adAccountId: string | null;
  aiGenerated: boolean;
  updatedAt: string | null;
  ready: boolean;
  /** Campaigns using it; null when the platform doesn't say (Meta saved audiences). */
  usedIn: number | null;
  campaigns: { id: string; name: string }[];
  totals: Totals;
  status: AudienceStatus;
  warnings: AudienceWarning[];
  /** Meta lookalikes: what they're built from. */
  lookalikeOf: string[];
  /** A Meta custom audience that can seed a lookalike (ready, big enough, not a lookalike itself). */
  canSeedLookalike: boolean;
  /** Library items: what the edit dialog needs. */
  library: { type: AudienceType; targeting: unknown } | null;
};

export type AudienceTip = {
  key: string;
  kind: "warning" | "lookalike";
  title: string;
  detail: string;
  audienceKey: string;
  campaignId: string | null;
  /** Lookalike tips: the Meta seed to build from. */
  seedId: string | null;
};

const LIB_TYPE: Record<AudienceType, string> = {
  INTEREST: "Interest",
  RETARGETING: "Retargeting",
  LOOKALIKE: "Lookalike",
  CUSTOM: "Custom",
  BEHAVIORAL: "Behavioral",
  SAVED: "Saved",
};
const META_SUBTYPE: Record<string, string> = {
  CUSTOM: "Customer list",
  WEBSITE: "Website visitors",
  APP: "App activity",
  ENGAGEMENT: "Engagement",
  VIDEO: "Video viewers",
  LOOKALIKE: "Lookalike",
  OFFLINE_CONVERSION: "Offline activity",
  CLAIM: "Claimed",
  MANAGED: "Managed",
  PARTNER: "Partner",
  BAG_OF_ACCOUNTS: "Accounts",
  STUDY_RULE_AUDIENCE: "Study",
  FOX: "Shopping",
};
const subtypeLabel = (s: string) => META_SUBTYPE[s] ?? s.charAt(0) + s.slice(1).toLowerCase().replace(/_/g, " ");

const add = (a: Totals, b: Totals): Totals => {
  const out = { ...a };
  (Object.keys(out) as (keyof Totals)[]).forEach((k) => (out[k] += b[k]));
  return out;
};
const roas = (t: Totals) => (t.spend > 0 && t.revenue > 0 ? t.revenue / t.spend : null);
const MIN_LOOKALIKE_SEED = 1000;

export async function audienceBoard(workspaceId: string, clientId: string | null, days: number) {
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const [library, accounts, adSets] = await Promise.all([
    prisma.audience.findMany({
      where: { workspaceId, ...ownedOrSharedWhere(clientId) },
      include: { campaigns: { select: { id: true, name: true, status: true } } },
      orderBy: { updatedAt: "desc" },
      take: 300,
    }),
    prisma.adAccount.findMany({
      where: { workspaceId, platform: "META", isActive: true, ...(clientId ? { clientId } : {}) },
      orderBy: { createdAt: "desc" },
      take: 8,
    }),
    prisma.adSet.findMany({
      where: { campaign: { workspaceId, platform: "META", ...campaignClientWhere(clientId) } },
      select: { id: true, name: true, status: true, learningStage: true, targeting: true, campaign: { select: { id: true, name: true } }, ads: { select: { id: true } } },
    }),
  ]);

  // Meta audiences on every Meta account in scope (one per client in an
  // agency). A failure isn't fatal: the page says why (expired connection,
  // rate limit…) and shows the rest.
  type Tagged<X> = X & { account: (typeof accounts)[number] };
  const custom: Tagged<MetaCustomAudience>[] = [];
  const saved: Tagged<MetaSavedAudience>[] = [];
  const errors: string[] = [];
  await Promise.all(
    accounts.map(async (account) => {
      const token = metaService.decryptToken(account.accessToken);
      const [c, sv] = await Promise.allSettled([metaService.getCustomAudiences(token, account.accountId), metaService.getSavedAudiences(token, account.accountId)]);
      if (c.status === "fulfilled") custom.push(...c.value.map((x) => ({ ...x, account })));
      if (sv.status === "fulfilled") saved.push(...sv.value.map((x) => ({ ...x, account })));
      const failed = [c, sv].find((r): r is PromiseRejectedResult => r.status === "rejected");
      if (failed) {
        const msg = isMetaError(failed.reason) ? friendlyMetaError(failed.reason).message : "Couldn't load audiences from Meta. Try again in a moment.";
        errors.push(accounts.length > 1 ? `${account.accountName}: ${msg}` : msg);
      }
    })
  );
  const metaError = errors.length ? errors.join(" ") : null;

  // Ad set results (B4) for the Meta custom audience usage.
  const results = await adResults(adSets.flatMap((s) => s.ads.map((a) => a.id)), days);
  const sets = adSets.map((s) => ({
    ...s,
    on: s.status === "ACTIVE",
    aud: customAudienceIds(s.targeting),
    totals: s.ads.reduce((t, a) => add(t, results.totals(a.id)), zero()),
  }));

  // Library usage: campaigns made from the audience, with their results.
  const usedCampaignIds = library.flatMap((a) => a.campaigns.map((c) => c.id));
  const campaignTotals = new Map<string, Totals>();
  if (usedCampaignIds.length) {
    const rows = await prisma.campaignMetrics.groupBy({
      by: ["campaignId"],
      where: { campaignId: { in: usedCampaignIds }, date: { gte: since } },
      _sum: { spend: true, revenue: true, conversions: true, impressions: true, clicks: true },
    });
    for (const r of rows) {
      campaignTotals.set(r.campaignId, {
        ...zero(),
        spend: Number(r._sum.spend ?? 0),
        revenue: Number(r._sum.revenue ?? 0),
        conversions: r._sum.conversions ?? 0,
        impressions: r._sum.impressions ?? 0,
        clicks: r._sum.clicks ?? 0,
      });
    }
  }

  const items: AudienceItem[] = [];
  for (const a of library) {
    const campaigns = a.campaigns.filter((c) => c.status !== "ENDED" || campaignTotals.has(c.id));
    items.push({
      key: `lib:${a.id}`,
      source: "library",
      id: a.id,
      name: a.name,
      typeLabel: LIB_TYPE[a.type],
      summary: audienceLine(a.targeting) || "Broad: no filters",
      description: a.description,
      sizeLower: null,
      sizeUpper: a.approxSize,
      clientId: a.clientId,
      adAccountId: null,
      aiGenerated: a.aiGenerated,
      updatedAt: a.updatedAt.toISOString(),
      ready: true,
      usedIn: campaigns.length,
      campaigns: campaigns.slice(0, 5).map((c) => ({ id: c.id, name: c.name })),
      totals: campaigns.reduce((t, c) => add(t, campaignTotals.get(c.id) ?? zero()), zero()),
      status: "Ready",
      warnings: [],
      lookalikeOf: [],
      canSeedLookalike: false,
      library: { type: a.type, targeting: a.targeting },
    });
  }
  const seededFrom = new Set(custom.flatMap((c) => c.lookalike?.originIds ?? []));
  for (const c of custom) {
    const using = sets.filter((s) => s.aud.included.includes(c.id));
    const campaigns = [...new Map(using.map((s) => [s.campaign.id, s.campaign])).values()];
    items.push({
      key: `meta:${c.id}`,
      source: "meta-custom",
      id: c.id,
      name: c.name,
      typeLabel: c.isLookalike && c.lookalike?.ratio ? `Lookalike ${Math.round(c.lookalike.ratio * 100)}%` : subtypeLabel(c.subtype),
      summary: c.isLookalike
        ? [c.lookalike?.originNames.length ? `Seeded from ${c.lookalike.originNames.join(", ")}` : "Lookalike", c.lookalike?.country].filter(Boolean).join(" · ")
        : c.description || subtypeLabel(c.subtype),
      description: c.description ?? null,
      sizeLower: c.sizeLower,
      sizeUpper: c.sizeUpper,
      clientId: c.account.clientId,
      adAccountId: c.account.id,
      aiGenerated: false,
      updatedAt: null,
      ready: c.ready,
      usedIn: campaigns.length,
      campaigns: campaigns.slice(0, 5),
      totals: using.reduce((t, s) => add(t, s.totals), zero()),
      status: "Ready",
      warnings: [],
      lookalikeOf: c.lookalike?.originNames ?? [],
      canSeedLookalike: !c.isLookalike && c.ready && (c.sizeUpper ?? 0) >= MIN_LOOKALIKE_SEED,
      library: null,
    });
  }
  for (const s of saved) {
    items.push({
      key: `saved:${s.id}`,
      source: "meta-saved",
      id: s.id,
      name: s.name,
      typeLabel: "Saved on Meta",
      summary: s.description || "Saved targeting on the Meta ad account",
      description: s.description ?? null,
      sizeLower: null,
      sizeUpper: s.approxSize,
      clientId: s.account.clientId,
      adAccountId: s.account.id,
      aiGenerated: false,
      updatedAt: null,
      ready: true,
      usedIn: null,
      campaigns: [],
      totals: zero(),
      status: "Ready",
      warnings: [],
      lookalikeOf: [],
      canSeedLookalike: false,
      library: null,
    });
  }

  // Status from the numbers.
  const all = items.reduce((t, i) => add(t, i.totals), zero());
  const overall = roas(all);
  for (const i of items) {
    if (!i.ready) i.status = "Building";
    else if (i.usedIn === 0) i.status = "Unused";
    else if (i.source === "meta-custom" && sets.some((s) => s.on && s.learningStage === "FAIL" && s.aud.included.includes(i.id))) i.status = "Learning limited";
    else {
      const r = roas(i.totals);
      if (overall !== null && r !== null && i.totals.spend >= all.spend * 0.1 && r < overall * 0.6) i.status = "Underperforming";
    }
  }

  // Verified warnings.
  const byMetaId = new Map(items.filter((i) => i.source === "meta-custom").map((i) => [i.id, i]));
  const tips: AudienceTip[] = [];
  for (const c of custom.filter((x) => x.isLookalike)) {
    for (const seedId of c.lookalike?.originIds ?? []) {
      const seed = byMetaId.get(seedId);
      if (!seed) continue;
      const lal = byMetaId.get(c.id)!;
      const withLal = sets.filter((s) => s.on && s.aud.included.includes(c.id) && !s.aud.excluded.includes(seedId));
      const withSeed = sets.filter((s) => s.on && s.aud.included.includes(seedId));
      const pair = withLal.flatMap((a) => withSeed.filter((b) => b.id !== a.id).map((b) => [a, b] as const))[0];
      if (!pair) continue;
      const [a, b] = pair;
      const text = `“${lal.name}” runs in ad set “${a.name}” while its seed “${seed.name}” runs in “${b.name}”, and “${a.name}” doesn't exclude the seed. Both ad sets bid on the same people.`;
      lal.warnings.push({ kind: "lookalike-seed", text, campaignId: a.campaign.id });
      seed.warnings.push({ kind: "lookalike-seed", text, campaignId: a.campaign.id });
      tips.push({ key: `lal:${c.id}:${seedId}`, kind: "warning", title: `“${lal.name}” and its seed “${seed.name}” compete`, detail: `${text} Exclude the seed from the lookalike ad set.`, audienceKey: lal.key, campaignId: a.campaign.id, seedId: null });
    }
  }
  for (const i of items.filter((x) => x.source === "meta-custom")) {
    const using = sets.filter((s) => s.on && s.aud.included.includes(i.id));
    const byCampaign = new Map<string, typeof using>();
    for (const s of using) byCampaign.set(s.campaign.id, [...(byCampaign.get(s.campaign.id) ?? []), s]);
    for (const group of byCampaign.values()) {
      if (group.length < 2) continue;
      const text = `${group.length} active ad sets in “${group[0].campaign.name}” target “${i.name}” (${group.map((s) => `“${s.name}”`).join(", ")}). They compete for the same people.`;
      i.warnings.push({ kind: "shared-ad-sets", text, campaignId: group[0].campaign.id });
      tips.push({ key: `shared:${i.id}:${group[0].campaign.id}`, kind: "warning", title: `“${i.name}” is in ${group.length} ad sets of one campaign`, detail: `${text} Merge them into one ad set, or exclude it from all but one.`, audienceKey: i.key, campaignId: group[0].campaign.id, seedId: null });
    }
  }
  const lib = items.filter((x) => x.source === "library");
  const keys = new Map(lib.map((i) => [i.key, targetingKey(i.library!.targeting as never)]));
  for (let x = 0; x < lib.length; x++) {
    for (let y = x + 1; y < lib.length; y++) {
      const a = keys.get(lib[x].key)!;
      const b = keys.get(lib[y].key)!;
      if (!a.countries.length || a.countries.join() !== b.countries.join() || a.cities.join() !== b.cities.join() || a.genders !== b.genders || a.custom.join() !== b.custom.join()) continue;
      const overlapYears = Math.min(a.ageMax, b.ageMax) - Math.max(a.ageMin, b.ageMin);
      const smaller = Math.min(a.ageMax - a.ageMin, b.ageMax - b.ageMin) || 1;
      if (overlapYears / smaller < 0.8) continue;
      const shared = a.interests.filter((id) => b.interests.includes(id)).length;
      const union = new Set([...a.interests, ...b.interests]).size;
      if (union > 0 && shared / union < 0.75) continue;
      const detail = union ? `same locations, ages and gender, ${shared} of ${union} interests shared` : "same locations, ages and gender, no interests";
      lib[x].warnings.push({ kind: "duplicate", text: `Targets almost the same people as “${lib[y].name}” (${detail}).`, campaignId: null });
      lib[y].warnings.push({ kind: "duplicate", text: `Targets almost the same people as “${lib[x].name}” (${detail}).`, campaignId: null });
      tips.push({ key: `dup:${lib[x].id}:${lib[y].id}`, kind: "warning", title: `“${lib[x].name}” and “${lib[y].name}” are near-duplicates`, detail: `They target ${detail}. Keep one, or make them distinct, so campaigns built from them don't compete.`, audienceKey: lib[x].key, campaignId: null, seedId: null });
    }
  }

  // New-audience ideas: seeds with no lookalike yet (biggest first).
  for (const i of items.filter((x) => x.canSeedLookalike && !seededFrom.has(x.id)).sort((p, q) => (q.sizeUpper ?? 0) - (p.sizeUpper ?? 0)).slice(0, 2)) {
    tips.push({
      key: `seed:${i.id}`,
      kind: "lookalike",
      title: `Build a lookalike from “${i.name}”`,
      detail: `It has ${i.sizeLower && i.sizeUpper ? `${i.sizeLower.toLocaleString("en-US")}–${i.sizeUpper.toLocaleString("en-US")}` : `about ${(i.sizeUpper ?? 0).toLocaleString("en-US")}`} people and no lookalike has been built from it. A 1% lookalike finds the people most like them.`,
      audienceKey: i.key,
      campaignId: null,
      seedId: i.id,
    });
  }

  return {
    days,
    metaAccounts: accounts.map((a) => ({ id: a.id, name: a.accountName, clientId: a.clientId })),
    metaError,
    items,
    tips,
  };
}
