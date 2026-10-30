import type { Ad, AdSet } from "@prisma/client";
import { prisma } from "../lib/prisma";
import {
  ActionError,
  ownStatus,
  setAdSetDailyBudget,
  setAdSetStatus,
  setAdStatus,
  setStatus,
  type CampaignWithAccount,
} from "./campaign-actions.service";

/**
 * Scale the winner (plan C9b): pause the other versions of a finished A/B
 * test and, when the versions are ad sets with daily budgets, move their
 * budget to the winner. Runs as a suggestion action (SCALE_WINNER), so a
 * media buyer's click waits in Approvals and Undo puts everything back.
 */

type Cell = { externalId: string; name: string; percent: number; campaigns: string[]; adSets: string[]; ads: string[] };
type Paused = { kind: "ad" | "adset" | "campaign"; id: string; was: "ACTIVE" };
export type ScalePayload = { experimentId: string; winner: number };
export type ScaleRevert = { experimentId: string; winner: number; paused: Paused[]; budget: { adSetId: string; from: number; to: number } | null; label: string };

async function load(workspaceId: string, experimentId: string) {
  const e = await prisma.experiment.findFirst({ where: { id: experimentId, workspaceId } });
  if (!e) throw new ActionError(410, "The test no longer exists.");
  const cells = (e.cells as unknown as Cell[]) ?? [];
  const campaigns = (await prisma.campaign.findMany({ where: { adAccountId: e.adAccountId, externalId: { not: null } }, include: { adAccount: true } })) as CampaignWithAccount[];
  const adSets = await prisma.adSet.findMany({ where: { campaign: { adAccountId: e.adAccountId } } });
  const ads = await prisma.ad.findMany({ where: { campaign: { adAccountId: e.adAccountId } } });
  const byId = new Map(campaigns.map((c) => [c.id, c]));
  const objects = (c: Cell) => ({
    ads: ads.filter((a) => c.ads.includes(a.externalId)),
    adSets: adSets.filter((s) => c.adSets.includes(s.externalId)),
    campaigns: campaigns.filter((x) => c.campaigns.includes(x.externalId!)),
  });
  return { e, cells, byId, objects };
}

/** The campaign Approvals and the suggestion point at: the winner's. */
export async function winnerCampaignId(workspaceId: string, experimentId: string, winner: number) {
  const { cells, objects } = await load(workspaceId, experimentId);
  const o = objects(cells[winner]);
  return o.campaigns[0]?.id ?? o.adSets[0]?.campaignId ?? o.ads[0]?.campaignId ?? null;
}

export async function scaleWinner(workspaceId: string, p: ScalePayload): Promise<ScaleRevert> {
  const { e, cells, byId, objects } = await load(workspaceId, p.experimentId);
  if (!Number.isInteger(p.winner) || !cells[p.winner]) throw new ActionError(400, "Unknown version.");
  const camp = (id: string) => {
    const c = byId.get(id);
    if (!c) throw new ActionError(410, "A campaign in this test no longer exists.");
    return c;
  };
  const paused: Paused[] = [];
  let moved = 0;
  for (const [i, cell] of cells.entries()) {
    if (i === p.winner) continue;
    const o = objects(cell);
    for (const ad of o.ads) {
      if (ownStatus(ad) !== "ACTIVE") continue;
      await setAdStatus(camp(ad.campaignId), ad, "PAUSED");
      paused.push({ kind: "ad", id: ad.id, was: "ACTIVE" });
    }
    for (const s of o.adSets) {
      if (ownStatus(s) !== "ACTIVE") continue;
      await setAdSetStatus(camp(s.campaignId), s, "PAUSED");
      paused.push({ kind: "adset", id: s.id, was: "ACTIVE" });
      moved += Number(s.dailyBudget ?? 0);
    }
    for (const c of o.campaigns) {
      if (c.status !== "ACTIVE") continue;
      await setStatus(c, "PAUSED");
      paused.push({ kind: "campaign", id: c.id, was: "ACTIVE" });
    }
  }
  if (!paused.length) throw new ActionError(409, "The other versions are already paused.");

  // Ad-set tests: the losers' daily budget goes to the winner (one ad set with a daily budget).
  let budget: ScaleRevert["budget"] = null;
  const w = objects(cells[p.winner]);
  if (moved > 0 && w.adSets.length === 1 && Number(w.adSets[0].dailyBudget ?? 0) > 0) {
    const s = w.adSets[0];
    const from = Number(s.dailyBudget);
    const to = Math.round((from + moved) * 100) / 100;
    await setAdSetDailyBudget(camp(s.campaignId), s, to);
    budget = { adSetId: s.id, from, to };
  }
  return { experimentId: e.id, winner: p.winner, paused, budget, label: cells[p.winner].name };
}

/** Undo: back to how it was, unless someone changed it since. */
export async function revertScale(workspaceId: string, r: ScaleRevert) {
  const { byId } = await load(workspaceId, r.experimentId);
  const camp = (id: string) => byId.get(id);
  if (r.budget) {
    const s = await prisma.adSet.findFirst({ where: { id: r.budget.adSetId } });
    if (!s || Math.abs(Number(s.dailyBudget ?? 0) - r.budget.to) >= 0.01) throw new ActionError(409, "The winner's budget has changed since, so Undo would overwrite that change. Adjust it on the ad set instead.");
  }
  const rows = await Promise.all(
    r.paused.map(async (x) => ({
      x,
      row: x.kind === "ad" ? await prisma.ad.findFirst({ where: { id: x.id } }) : x.kind === "adset" ? await prisma.adSet.findFirst({ where: { id: x.id } }) : await prisma.campaign.findFirst({ where: { id: x.id } }),
    }))
  );
  if (rows.some(({ x, row }) => !row || (x.kind === "campaign" ? (row as { status: string }).status : ownStatus(row as Ad | AdSet)) !== "PAUSED")) {
    throw new ActionError(409, "Some versions were turned back on since, so Undo would overwrite that. Change them on the campaign instead.");
  }
  if (r.budget) {
    const s = (await prisma.adSet.findFirst({ where: { id: r.budget.adSetId } }))!;
    const c = camp(s.campaignId);
    if (c) await setAdSetDailyBudget(c, s, r.budget.from);
  }
  for (const { x, row } of rows) {
    if (x.kind === "ad") {
      const ad = row as Ad;
      const c = camp(ad.campaignId);
      if (c) await setAdStatus(c, ad, "ACTIVE");
    } else if (x.kind === "adset") {
      const s = row as AdSet;
      const c = camp(s.campaignId);
      if (c) await setAdSetStatus(c, s, "ACTIVE");
    } else {
      const c = camp(x.id);
      if (c) await setStatus(c, "ACTIVE");
    }
  }
}
