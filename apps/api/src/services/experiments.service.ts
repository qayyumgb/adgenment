import { Prisma, type AdAccount } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { metaService, type MetaAdStudy } from "./meta.service";
import { CONCLUSIVE, dataNeeded, metricOf, probBest, type Arm, type Goal } from "../lib/ab-stats";
import { changeLog } from "./change-log.service";
import { suggestionsService } from "./suggestions.service";
import { winnerCampaignId } from "./experiment-actions.service";
import { money as fmtMoney } from "../lib/format";

/**
 * Experiments (plan C9a): Meta A/B tests (ad studies) on the workspace's ad
 * accounts, including ones made in Ads Manager, with each version's results
 * for the test window, the chance it's the best, and what to do.
 *
 * C9b: start a creative test from Advertix (the campaign's ad plus 1–4
 * images or videos from the Creatives library, same copy), end a test, and
 * Scale the winner (a suggestion, so Approvals and Undo apply). C9c: a lesson
 * per finished test, fed to the AI Planner. Other platforms get the same
 * treatment once Advertix can write to them.
 */

const DAY = 86_400_000;
const SPLIT_TYPES = new Set(["SPLIT_TEST", "SPLIT_TEST_V2"]);

type StoredCell = { externalId: string; name: string; percent: number; campaigns: string[]; adSets: string[]; ads: string[] };

const ids = (edge?: { data?: { id: string }[] }) => (edge?.data ?? []).map((x) => x.id);

/* ── Sync ─────────────────────────────────────────────────────────────────── */

/**
 * Who owns the account's A/B tests on Meta: its Business, or (personal ad
 * accounts) the person who connected it ("me", Meta's user edge). The Business
 * id is looked up once and remembered.
 */
async function studyOwner(account: AdAccount, token: string): Promise<string> {
  if (account.metaBusinessId) return account.metaBusinessId;
  const business = await metaService.getAdAccountBusinessId(token, account.accountId).catch((err) => {
    console.error(`[experiments] business of ${account.id}:`, err instanceof Error ? err.message : err);
    return null;
  });
  if (business) await prisma.adAccount.update({ where: { id: account.id }, data: { metaBusinessId: business } });
  return business ?? "me";
}

/** The account's studies: from the ad account if Meta lists them there, else from its Business (or the user). */
async function studiesFor(account: AdAccount, token: string): Promise<MetaAdStudy[]> {
  try {
    return await metaService.getAdStudies(token, `act_${account.accountId.replace(/^act_/, "")}`);
  } catch {
    return metaService.getAdStudies(token, await studyOwner(account, token));
  }
}

/** Read the account's A/B tests into Experiment rows. Returns how many. Called after each Meta sync. */
export async function syncAccountExperiments(account: AdAccount, token = metaService.decryptToken(account.accessToken)): Promise<number> {
  if (account.platform !== "META") return 0;
  const studies = (await studiesFor(account, token)).filter((s) => SPLIT_TYPES.has(String(s.type ?? "")));
  if (!studies.length) return 0;

  const [campaigns, adSets, ads] = await Promise.all([
    prisma.campaign.findMany({ where: { adAccountId: account.id, externalId: { not: null } }, select: { externalId: true } }),
    prisma.adSet.findMany({ where: { campaign: { adAccountId: account.id } }, select: { externalId: true } }),
    prisma.ad.findMany({ where: { campaign: { adAccountId: account.id } }, select: { externalId: true } }),
  ]);
  const mine = new Set([...campaigns.map((c) => c.externalId!), ...adSets.map((s) => s.externalId), ...ads.map((a) => a.externalId)]);
  const plainId = account.accountId.replace(/^act_/, "");

  let n = 0;
  for (const s of studies) {
    let raw;
    try {
      raw = await metaService.getAdStudyCells(token, s.id);
    } catch (err) {
      console.error(`[experiments] cells of ${s.id}:`, err instanceof Error ? err.message : err);
      continue;
    }
    const cells: StoredCell[] = raw.map((c) => ({
      externalId: c.id,
      name: c.name || "Version",
      percent: Number(c.treatment_percentage ?? 0),
      campaigns: ids(c.campaigns),
      adSets: ids(c.adsets),
      ads: ids(c.ads),
    }));
    // A Business lists every account's studies: keep the ones on this account.
    const onThisAccount = raw.some((c) => (c.adaccounts?.data ?? []).some((a) => (a.account_id ?? a.id.replace(/^act_/, "")) === plainId));
    if (cells.length < 2 || !(onThisAccount || cells.some((c) => [...c.campaigns, ...c.adSets, ...c.ads].some((x) => mine.has(x))))) continue;

    const data = {
      workspaceId: account.workspaceId,
      platform: account.platform,
      name: s.name || "A/B test",
      type: String(s.type),
      startTime: s.start_time ? new Date(s.start_time) : null,
      endTime: s.end_time ? new Date(s.end_time) : null,
      cells: cells as unknown as Prisma.InputJsonValue,
      syncedAt: new Date(),
    };
    await prisma.experiment.upsert({ where: { adAccountId_externalId: { adAccountId: account.id, externalId: s.id } }, create: { adAccountId: account.id, externalId: s.id, ...data }, update: data });
    n++;
  }
  return n;
}

/* ── Reading ──────────────────────────────────────────────────────────────── */

type Totals = Arm & { revenue: number };
const zero = (): Totals => ({ spend: 0, impressions: 0, clicks: 0, conversions: 0, revenue: 0 });

/** Each version's totals over the test window, from ad-level results (or campaign-level when a version is whole campaigns). */
async function cellTotals(accountId: string, cells: StoredCell[], from: Date, to: Date) {
  const adsOf = await prisma.ad.findMany({
    where: { campaign: { adAccountId: accountId } },
    select: { id: true, externalId: true, adSet: { select: { externalId: true } }, campaign: { select: { externalId: true } } },
  });
  const campaignsOf = await prisma.campaign.findMany({ where: { adAccountId: accountId, externalId: { not: null } }, select: { id: true, externalId: true } });
  const out: Totals[] = [];
  for (const c of cells) {
    const t = zero();
    // Whole campaigns are counted from campaign results below, not ad by ad.
    const adIds = adsOf.filter((a) => c.ads.includes(a.externalId) || c.adSets.includes(a.adSet.externalId)).map((a) => a.id);
    if (adIds.length) {
      const m = await prisma.adMetrics.aggregate({ where: { adId: { in: adIds }, date: { gte: from, lte: to } }, _sum: { spend: true, impressions: true, clicks: true, conversions: true, revenue: true } });
      t.spend += Number(m._sum.spend ?? 0);
      t.impressions += m._sum.impressions ?? 0;
      t.clicks += m._sum.clicks ?? 0;
      t.conversions += m._sum.conversions ?? 0;
      t.revenue += Number(m._sum.revenue ?? 0);
    }
    const campIds = campaignsOf.filter((x) => c.campaigns.includes(x.externalId!)).map((x) => x.id);
    if (campIds.length) {
      const m = await prisma.campaignMetrics.aggregate({ where: { campaignId: { in: campIds }, date: { gte: from, lte: to } }, _sum: { spend: true, impressions: true, clicks: true, conversions: true, revenue: true } });
      t.spend += Number(m._sum.spend ?? 0);
      t.impressions += m._sum.impressions ?? 0;
      t.clicks += m._sum.clicks ?? 0;
      t.conversions += m._sum.conversions ?? 0;
      t.revenue += Number(m._sum.revenue ?? 0);
    }
    out.push(t);
  }
  return out;
}

const dayStart = (d: Date) => new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));

export type ExperimentView = Awaited<ReturnType<typeof view>>;

/** One test, worked out: status, day x of y, versions with results and chance of being best, and advice. */
export async function view(e: Prisma.ExperimentGetPayload<{ include: { adAccount: { select: { id: true; accountId: true; accountName: true; currency: true; clientId: true; client: { select: { name: true } } } } } }>, now = new Date()) {
  const cells = (e.cells as unknown as StoredCell[]) ?? [];
  const start = e.startTime ?? now;
  const end = e.endTime;
  const status: "scheduled" | "running" | "ended" = start > now ? "scheduled" : end && end <= now ? "ended" : "running";
  const totalDays = end ? Math.max(1, Math.round((end.getTime() - start.getTime()) / DAY)) : null;
  const elapsedDays = status === "scheduled" ? 0 : Math.max(1, Math.ceil(((end && end < now ? end : now).getTime() - start.getTime()) / DAY));
  const totals = status === "scheduled" ? cells.map(zero) : await cellTotals(e.adAccountId, cells, dayStart(start), end && end < now ? end : now);

  const all = totals.reduce((a, t) => ({ ...a, conversions: a.conversions + t.conversions, clicks: a.clicks + t.clicks }), zero());
  const goal: Goal = (e.goal as Goal | null) ?? (all.conversions >= 10 ? "purchase" : "click");
  const hasData = totals.some((t) => t.spend > 0);
  const p = hasData ? probBest(totals, goal) : cells.map(() => 0);
  const lead = hasData ? p.indexOf(Math.max(...p)) : -1;
  const others = totals.map((t, i) => ({ t, i })).filter((x) => x.i !== lead);
  const runnerUp = others.sort((a, b) => p[b.i] - p[a.i])[0];
  const lm = lead >= 0 ? metricOf(totals[lead], goal) : null;
  const rm = runnerUp ? metricOf(runnerUp.t, goal) : null;
  // Cost goals: lower is better; CTR: higher is better.
  const lift = lm != null && rm != null && rm > 0 ? (goal === "ctr" ? lm / rm - 1 : 1 - lm / rm) : null;
  const confidence = lead >= 0 ? p[lead] : 0;
  const conclusive = confidence >= CONCLUSIVE;

  let expectedConclusive: string | null = null;
  let tooClose = false;
  if (status === "running" && hasData && !conclusive) {
    const k = dataNeeded(totals, goal);
    if (k == null) tooClose = true;
    else expectedConclusive = new Date(start.getTime() + elapsedDays * k * DAY).toISOString();
  }
  // Ending now saves what the other versions would still spend.
  const remainingDays = status === "running" && end ? Math.max(0, (end.getTime() - now.getTime()) / DAY) : 0;
  const savedByEnding = conclusive && remainingDays > 0 ? others.reduce((s, x) => s + (x.t.spend / elapsedDays) * remainingDays, 0) : 0;

  return {
    id: e.id,
    externalId: e.externalId,
    name: e.name,
    type: e.type,
    platform: e.platform,
    adAccount: { id: e.adAccount.id, accountId: e.adAccount.accountId, name: e.adAccount.accountName, currency: e.adAccount.currency },
    clientId: e.adAccount.clientId,
    clientName: e.adAccount.client?.name ?? null,
    startTime: e.startTime?.toISOString() ?? null,
    endTime: e.endTime?.toISOString() ?? null,
    status,
    day: elapsedDays,
    totalDays,
    goal,
    goalChosen: e.goal != null,
    versions: cells.map((c, i) => ({ name: c.name, percent: c.percent, ...totals[i], metric: metricOf(totals[i], goal), chanceBest: p[i], leading: i === lead && hasData })),
    confidence,
    conclusive,
    lift,
    expectedConclusive,
    tooClose,
    savedByEnding,
    syncedAt: e.syncedAt.toISOString(),
    createdInAdvertix: !!e.createdById,
    // Scale the winner (C9b): the latest one, applied (with Undo) or waiting.
    scale: await prisma.suggestion
      .findFirst({ where: { workspaceId: e.workspaceId, dedupeKey: { startsWith: `experiment:${e.id}:scale:` }, status: { in: ["OPEN", "APPLIED"] } }, orderBy: { createdAt: "desc" }, select: { id: true, status: true, appliedAt: true, title: true } })
      .then((s) => (s ? { suggestionId: s.id, status: s.status, appliedAt: s.appliedAt?.toISOString() ?? null, title: s.title } : null)),
    lesson: e.lesson ?? null,
    suggestedLesson: status === "ended" ? suggestedLesson(e.name, cells.map((c) => c.name), lead, conclusive, lift, goal, e.endTime ?? now) : null,
  };
}

/** C9c: "Founder hook beat UGC hook: 23% cheaper per purchase (Oct 2026)". */
function suggestedLesson(test: string, names: string[], lead: number, conclusive: boolean, lift: number | null, goal: Goal, ended: Date) {
  const when = ended.toLocaleString("en-GB", { month: "short", year: "numeric", timeZone: "UTC" });
  if (lead < 0) return null;
  const others = names.filter((_, i) => i !== lead).join(" and ");
  if (!conclusive) return `No clear difference between ${names.join(" and ")} (${test}, ${when}).`;
  const what = goal === "ctr" ? "higher click-through rate" : `cheaper per ${goal === "purchase" ? "purchase" : "click"}`;
  return `${names[lead]} beat ${others}${lift != null ? `: ${Math.round(Math.abs(lift) * 100)}% ${what}` : ""} (${test}, ${when}).`;
}

export async function listExperiments(workspaceId: string, clientId: string | null, now = new Date()) {
  const rows = await prisma.experiment.findMany({
    where: { workspaceId, ...(clientId ? { adAccount: { clientId } } : {}) },
    include: { adAccount: { select: { id: true, accountId: true, accountName: true, currency: true, clientId: true, client: { select: { name: true } } } } },
    orderBy: [{ startTime: "desc" }],
    take: 50,
  });
  const views = await Promise.all(rows.map((r) => view(r, now)));
  const order = { running: 0, scheduled: 1, ended: 2 };
  return views.sort((a, b) => order[a.status] - order[b.status]);
}

export async function setGoal(workspaceId: string, id: string, goal: unknown) {
  const g = goal === null || goal === "auto" ? null : goal === "purchase" || goal === "click" || goal === "ctr" ? goal : undefined;
  if (g === undefined) throw Object.assign(new Error("Goal must be purchase, click, ctr or auto."), { status: 400 });
  const r = await prisma.experiment.updateMany({ where: { id, workspaceId }, data: { goal: g } });
  if (!r.count) throw Object.assign(new Error("Test not found"), { status: 404 });
  return { goal: g };
}

/* ── C9b: start, end, scale ───────────────────────────────────────────────── */

const bad = (status: number, msg: string) => Object.assign(new Error(msg), { status });
const MIN_DAYS = 3;
const MAX_DAYS = 30;

type NewTest = { name?: unknown; creativeIds?: unknown; days?: unknown; dailyBudget?: unknown };

/**
 * Start a creative A/B test on a Meta campaign published from Advertix: its
 * current ad is version A; each library creative becomes a new ad in the same
 * ad set with the same copy and Page; then Meta's creative test (SPLIT_TEST_V2)
 * splits the audience evenly. Anything created is removed if a step fails.
 */
export async function startCreativeTest(workspaceId: string, userId: string, campaignId: string, input: NewTest) {
  const name = typeof input.name === "string" ? input.name.trim().slice(0, 120) : "";
  if (!name) throw bad(400, "Give the test a name.");
  const creativeIds = Array.isArray(input.creativeIds) ? [...new Set(input.creativeIds.filter((x): x is string => typeof x === "string"))] : [];
  if (creativeIds.length < 1 || creativeIds.length > 4) throw bad(400, "Pick 1 to 4 creatives to test against the current ad.");
  const days = Math.round(Number(input.days));
  if (!Number.isFinite(days) || days < MIN_DAYS || days > MAX_DAYS) throw bad(400, `A test runs ${MIN_DAYS} to ${MAX_DAYS} days.`);
  const dailyBudget = Math.round(Number(input.dailyBudget) * 100) / 100;
  if (!(dailyBudget > 0)) throw bad(400, "Set the test's daily budget.");

  const c = await prisma.campaign.findFirst({ where: { id: campaignId, workspaceId }, include: { adAccount: true } });
  if (!c) throw bad(404, "Campaign not found");
  if (c.platform !== "META" || !c.externalId || !c.externalAdSetId) throw bad(409, "A/B tests start from a Meta campaign published from Advertix.");
  if (!c.adAccount.isActive) throw bad(409, "The ad account is disconnected. Reconnect it in Connections.");
  const min = c.adAccount.minDailyBudget ?? 0;
  if (min > 0 && dailyBudget < min * (creativeIds.length + 1)) {
    throw bad(400, `Each version needs at least the account's daily minimum: ${fmtMoney(min * (creativeIds.length + 1), c.adAccount.currency)} a day for ${creativeIds.length + 1} versions.`);
  }
  const base = await prisma.ad.findFirst({ where: { campaignId: c.id, adSet: { externalId: c.externalAdSetId }, status: { in: ["ACTIVE", "PAUSED"] } }, orderBy: { createdAt: "asc" } });
  if (!base) throw bad(409, "This campaign has no ad to test against yet. Sync it, or check its ad in Ads Manager.");
  if (!base.linkUrl) throw bad(409, "The current ad has no link, so the new versions can't copy it.");
  const creatives = await prisma.creative.findMany({ where: { id: { in: creativeIds }, workspaceId } });
  if (creatives.length !== creativeIds.length) throw bad(404, "One of the creatives no longer exists.");

  const token = metaService.decryptToken(c.adAccount.accessToken);
  // The Page the new versions post as: known when Advertix published the
  // campaign; for synced ones, read it from the current ad and remember it.
  let pageId = c.externalPageId;
  if (!pageId && base.creativeExternalId) {
    pageId = await metaService.getCreativePageId(token, base.creativeExternalId).catch(() => null);
    if (pageId) await prisma.campaign.update({ where: { id: c.id }, data: { externalPageId: pageId } });
  }
  if (!pageId) throw bad(409, "Advertix couldn't find which Facebook Page this campaign's ad uses. Sync the account (Connections → Sync now) and try again.");
  // The Business when there is one; a personal ad account's tests belong to the person.
  const owner = await studyOwner(c.adAccount, token);

  const created: { adId: string; creativeId: string }[] = [];
  let studyId: string | null = null;
  const cleanup = async () => {
    if (studyId) await metaService.deleteObject(token, studyId).catch(() => {});
    for (const x of created) {
      await metaService.deleteObject(token, x.adId).catch(() => {});
      await metaService.deleteObject(token, x.creativeId).catch(() => {});
    }
  };
  try {
    for (const lib of creatives) {
      const content = (lib.content ?? {}) as Record<string, unknown>;
      const str = (k: string) => (typeof content[k] === "string" && (content[k] as string).trim() ? (content[k] as string) : null);
      let imageHash: string | undefined;
      let videoId: string | undefined;
      if (lib.type === "VIDEO") {
        videoId = str("videoId") ?? undefined;
        if (!videoId) throw bad(409, `“${lib.name}” isn't uploaded to Meta yet. Open it in Creatives and upload it first.`);
      } else {
        imageHash = str("imageHash") ?? undefined;
        const url = str("imageUrl") ?? str("url");
        if (!imageHash && url) imageHash = (await metaService.uploadImageFromUrl(token, c.adAccount.accountId, url)).hash;
        if (!imageHash) throw bad(409, `“${lib.name}” has no image. Pick an image or video creative.`);
      }
      const creative = await metaService.createAdCreative(token, c.adAccount.accountId, {
        name: `${name} — ${lib.name}`.slice(0, 200),
        pageId,
        message: base.body ?? "",
        headline: base.headline ?? undefined,
        linkUrl: base.linkUrl,
        callToAction: (base.callToAction ?? undefined) as never,
        imageHash,
        videoId,
        thumbnailUrl: str("thumbnailUrl") ?? undefined,
      });
      const ad = await metaService.createAd(token, c.adAccount.accountId, { name: `${c.name} — ${lib.name}`.slice(0, 200), adSetId: c.externalAdSetId, creativeId: creative.id, status: base.status === "ACTIVE" ? "ACTIVE" : "PAUSED" });
      created.push({ adId: ad.id, creativeId: creative.id });
    }
    const names = ["Current ad", ...creatives.map((x) => x.name)];
    const adIds = [base.externalId, ...created.map((x) => x.adId)];
    const each = Math.floor(100 / adIds.length);
    const cells = adIds.map((adId, i) => ({ name: names[i].slice(0, 100), percent: each + (i === 0 ? 100 - each * adIds.length : 0), adId }));
    const start = Math.floor(Date.now() / 1000) + 600;
    const end = start + days * 86_400;
    const study = await metaService.createCreativeTest(token, owner, { name, startTime: start, endTime: end, dailyBudget, cells });
    studyId = study.id;

    const row = await prisma.experiment.create({
      data: {
        workspaceId,
        adAccountId: c.adAccount.id,
        platform: "META",
        externalId: study.id,
        name,
        type: "SPLIT_TEST_V2",
        startTime: new Date(start * 1000),
        endTime: new Date(end * 1000),
        cells: cells.map((x) => ({ externalId: "", name: x.name, percent: x.percent, campaigns: [], adSets: [], ads: [x.adId] })) as unknown as Prisma.InputJsonValue,
        createdById: userId,
        createdAds: created as unknown as Prisma.InputJsonValue,
      },
    });
    await changeLog.record({ workspaceId, campaignId: c.id, campaignName: c.name, clientId: c.adAccount.clientId, currency: c.adAccount.currency, action: "experiment.create", after: { test: name, versions: cells.length, dailyBudget, days }, actorType: "USER", userId, platformPushed: true });
    return row;
  } catch (err) {
    await cleanup();
    throw err;
  }
}

async function findExperiment(workspaceId: string, id: string) {
  const e = await prisma.experiment.findFirst({ where: { id, workspaceId }, include: { adAccount: true } });
  if (!e) throw bad(404, "Test not found");
  return e;
}

/** End a running test now. */
export async function endTest(workspaceId: string, userId: string, id: string) {
  const e = await findExperiment(workspaceId, id);
  if (e.endTime && e.endTime <= new Date()) throw bad(409, "This test has already ended.");
  const endAt = Math.floor(Date.now() / 1000) + 60;
  await metaService.endAdStudy(metaService.decryptToken(e.adAccount.accessToken), e.externalId, endAt);
  // Meta gets a minute ahead (it may refuse a time in the past); here it ends now.
  await prisma.experiment.update({ where: { id: e.id }, data: { endTime: new Date() } });
  await changeLog.record({ workspaceId, campaignId: null, campaignName: e.name, clientId: e.adAccount.clientId, action: "experiment.end", after: { test: e.name }, actorType: "USER", userId, platformPushed: true });
  return { ok: true };
}

/**
 * "Scale the winner": a suggestion to apply through the usual flow, so a
 * media buyer's click waits in Approvals and it can be undone for 7 days.
 */
export async function scaleSuggestion(workspaceId: string, id: string, winner: unknown) {
  const e = await findExperiment(workspaceId, id);
  const v = await view({ ...e, adAccount: { ...e.adAccount, client: e.adAccount.clientId ? await prisma.client.findUnique({ where: { id: e.adAccount.clientId }, select: { name: true } }) : null } });
  const w = winner === undefined ? v.versions.findIndex((x) => x.leading) : Number(winner);
  if (!Number.isInteger(w) || !v.versions[w]) throw bad(400, "Pick the version to keep.");
  const campaignId = await winnerCampaignId(workspaceId, e.id, w);
  if (!campaignId) throw bad(409, "Advertix can't find this test's campaigns yet. Sync the account and try again.");
  const others = v.versions.filter((_, i) => i !== w).map((x) => x.name).join(" and ");
  const s = await suggestionsService.upsertOne(workspaceId, {
    dedupeKey: `experiment:${e.id}:scale:${w}`,
    sourceRef: e.id,
    clientId: e.adAccount.clientId,
    campaignId,
    kind: "A/B test",
    title: `Scale the winner of “${e.name}”: ${v.versions[w].name}`,
    reason: `Pauses ${others} and, for ad set versions, moves their daily budget to ${v.versions[w].name}.${v.conclusive ? ` Advertix is ${Math.round(v.confidence * 100)}% sure it's the best.` : " The test isn't conclusive yet."}`,
    impact: null,
    priority: 3,
    confidence: v.conclusive ? "HIGH" : "LOW",
    actionType: "SCALE_WINNER",
    actionLabel: "Scale the winner",
    doneLabel: "Winner scaled",
    actionPayload: { experimentId: e.id, winner: w },
    reviewHref: "/experiments",
    expiresAt: new Date(Date.now() + 7 * DAY),
  });
  return s;
}

/* ── C9c: lessons ─────────────────────────────────────────────────────────── */

export async function setLesson(workspaceId: string, id: string, lesson: unknown) {
  const text = typeof lesson === "string" ? lesson.trim().slice(0, 300) : "";
  const r = await prisma.experiment.updateMany({ where: { id, workspaceId }, data: { lesson: text || null } });
  if (!r.count) throw bad(404, "Test not found");
  return { lesson: text || null };
}

/** What finished tests showed for a client (saved lesson, else Advertix's read when it was clear), newest first. */
export async function lessonsFor(workspaceId: string, clientId: string | null, limit = 8) {
  const ended = (await listExperiments(workspaceId, clientId)).filter((e) => e.status === "ended");
  return ended
    .map((e) => ({ id: e.id, test: e.name, clientName: e.clientName, endTime: e.endTime, lesson: e.lesson ?? (e.conclusive ? e.suggestedLesson : null), saved: !!e.lesson }))
    .filter((l): l is typeof l & { lesson: string } => !!l.lesson)
    .slice(0, limit);
}
