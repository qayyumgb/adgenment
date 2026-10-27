/**
 * Change log (plan B3): an append-only record of every campaign change and a
 * 7-day undo for budget, status and name changes, and for ad set / ad status
 * and ad set budgets (B4).
 *
 * Recording never throws — a logging failure must not fail the change the
 * user just made. Undo goes through the same paths as a normal edit
 * (platform first, then our row) and is refused when the value has changed
 * again since, so it never silently overwrites someone else's change.
 */

import { Prisma, type ChangeActor, type ChangeLog } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { money } from "../lib/format";
import { approvalContext } from "../lib/approval-context";
import {
  ActionError,
  setAdSetDailyBudget,
  setAdSetStatus,
  setAdStatus,
  ownStatus,
  setDailyBudget,
  setName,
  setStatus,
  type CampaignWithAccount,
} from "./campaign-actions.service";

export const CHANGE_UNDO_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;
const UNDOABLE = new Set(["campaign.budget", "campaign.status", "campaign.rename", "adset.status", "adset.budget", "ad.status"]);

type CampaignLike = {
  id: string;
  workspaceId: string;
  name: string;
  platform: string;
  status: string;
  budget: Prisma.Decimal | number;
  budgetType: string;
  startDate: Date | null;
  endDate: Date | null;
  targeting: Prisma.JsonValue | null;
  externalId?: string | null;
};

type Actor = { actorType: ChangeActor; userId?: string | null; suggestionId?: string | null; platformPushed?: boolean; note?: string };

const STATUS_WORD: Record<string, string> = { ACTIVE: "Active", PAUSED: "Paused", DRAFT: "Draft", ENDED: "Ended" };
const day = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : null);

/** One readable line per change. */
export function describe(action: string, before: Record<string, unknown> | null, after: Record<string, unknown> | null, currency?: string | null) {
  switch (action) {
    case "campaign.budget": {
      const b = Number(before?.budget ?? 0);
      const a = Number(after?.budget ?? 0);
      const kind = after?.budgetType === "LIFETIME" ? "lifetime" : "daily";
      return `${a >= b ? "Raised" : "Lowered"} ${kind} budget from ${money(b, currency)} to ${money(a, currency)}`;
    }
    case "campaign.status":
      if (after?.status === "PAUSED") return "Paused the campaign";
      if (after?.status === "ACTIVE") return before?.status === "PAUSED" ? "Resumed the campaign" : "Set the campaign live";
      return `Changed status from ${STATUS_WORD[String(before?.status)] ?? before?.status} to ${STATUS_WORD[String(after?.status)] ?? after?.status}`;
    case "campaign.rename":
      return `Renamed from “${before?.name}” to “${after?.name}”`;
    case "campaign.schedule":
      return "Changed the schedule";
    case "campaign.targeting":
      return "Changed targeting";
    case "campaign.create":
      return "Created the campaign";
    case "campaign.duplicate":
      return `Duplicated from “${before?.name}”`;
    case "campaign.publish":
      return "Published to Meta (paused, ready to launch)";
    case "campaign.delete":
      return "Deleted the campaign";
    case "adset.status":
      return `${after?.status === "PAUSED" ? "Paused" : "Resumed"} ad set “${after?.name ?? before?.name}”`;
    case "adset.budget": {
      const b = Number(before?.dailyBudget ?? 0);
      const a = Number(after?.dailyBudget ?? 0);
      return `${a >= b ? "Raised" : "Lowered"} the daily budget of ad set “${after?.name ?? before?.name}” from ${money(b, currency)} to ${money(a, currency)}`;
    }
    case "ad.status":
      return `${after?.status === "PAUSED" ? "Paused" : "Resumed"} ad “${after?.name ?? before?.name}”`;
    default:
      return "Changed the campaign";
  }
}

class ChangeLogService {
  /** Write one entry. Never throws. */
  async record(input: {
    workspaceId: string;
    campaignId: string | null;
    campaignName: string;
    clientId?: string | null;
    action: string;
    before?: Record<string, unknown> | null;
    after?: Record<string, unknown> | null;
    currency?: string | null;
    summary?: string;
    revertOfId?: string;
  } & Actor): Promise<ChangeLog | null> {
    try {
      const approval = approvalContext.getStore();
      const summary = (input.summary ?? describe(input.action, input.before ?? null, input.after ?? null, input.currency)) + (input.note ? ` ${input.note}` : "");
      return await prisma.changeLog.create({
        data: {
          workspaceId: input.workspaceId,
          campaignId: input.campaignId,
          campaignName: input.campaignName.slice(0, 200),
          clientId: input.clientId ?? null,
          actorType: input.actorType,
          actorUserId: input.userId ?? null,
          action: input.action,
          summary: summary.slice(0, 500),
          before: input.before ? (input.before as Prisma.InputJsonValue) : Prisma.JsonNull,
          after: input.after ? (input.after as Prisma.InputJsonValue) : Prisma.JsonNull,
          platformPushed: input.platformPushed ?? false,
          suggestionId: input.suggestionId ?? null,
          revertOfId: input.revertOfId ?? null,
          approvalId: approval?.approvalId ?? null,
          approvedById: approval?.approvedById ?? null,
        },
      });
    } catch (err) {
      console.error("[change-log] record failed:", err instanceof Error ? err.message : err);
      return null;
    }
  }

  /**
   * Diff a campaign before / after an edit and write one entry per changed
   * field group (budget, status, name, schedule, targeting).
   */
  async recordCampaignUpdate(
    before: CampaignLike,
    after: CampaignLike,
    actor: Actor,
    meta: { clientId?: string | null; currency?: string | null }
  ): Promise<ChangeLog[]> {
    const base = { workspaceId: after.workspaceId, campaignId: after.id, campaignName: after.name, clientId: meta.clientId, currency: meta.currency, ...actor };
    const writes: Promise<ChangeLog | null>[] = [];
    if (Number(before.budget) !== Number(after.budget) || before.budgetType !== after.budgetType) {
      writes.push(
        this.record({
          ...base,
          action: "campaign.budget",
          before: { budget: Number(before.budget), budgetType: before.budgetType },
          after: { budget: Number(after.budget), budgetType: after.budgetType },
        })
      );
    }
    if (before.status !== after.status) {
      writes.push(this.record({ ...base, action: "campaign.status", before: { status: before.status }, after: { status: after.status } }));
    }
    if (before.name !== after.name) {
      writes.push(this.record({ ...base, action: "campaign.rename", before: { name: before.name }, after: { name: after.name } }));
    }
    if (day(before.startDate) !== day(after.startDate) || day(before.endDate) !== day(after.endDate)) {
      writes.push(
        this.record({
          ...base,
          action: "campaign.schedule",
          before: { startDate: day(before.startDate), endDate: day(before.endDate) },
          after: { startDate: day(after.startDate), endDate: day(after.endDate) },
        })
      );
    }
    if (JSON.stringify(before.targeting ?? null) !== JSON.stringify(after.targeting ?? null)) {
      writes.push(this.record({ ...base, action: "campaign.targeting" }));
    }
    return (await Promise.all(writes)).filter((x): x is ChangeLog => x !== null);
  }

  canUndo(e: Pick<ChangeLog, "action" | "undoneAt" | "revertOfId" | "createdAt" | "actorType">) {
    return (
      UNDOABLE.has(e.action) &&
      !e.undoneAt &&
      !e.revertOfId &&
      e.actorType !== "SYNC" &&
      Date.now() - e.createdAt.getTime() < CHANGE_UNDO_WINDOW_MS
    );
  }

  async list(workspaceId: string, opts: { campaignId?: string; clientId?: string | null; limit?: number; before?: Date }) {
    const rows = await prisma.changeLog.findMany({
      where: {
        workspaceId,
        ...(opts.campaignId ? { campaignId: opts.campaignId } : {}),
        ...(opts.clientId ? { clientId: opts.clientId } : {}),
        ...(opts.before ? { createdAt: { lt: opts.before } } : {}),
      },
      orderBy: { createdAt: "desc" },
      take: Math.min(200, Math.max(1, opts.limit ?? 50)),
    });
    const userIds = [...new Set(rows.flatMap((r) => [r.actorUserId, r.undoneById, r.approvedById]).filter((x): x is string => !!x))];
    const users = userIds.length ? await prisma.user.findMany({ where: { id: { in: userIds } }, select: { id: true, name: true, email: true } }) : [];
    const nameOf = (id: string | null) => {
      const u = users.find((x) => x.id === id);
      return u ? u.name || u.email : null;
    };
    return rows.map((r) => ({ ...r, actorName: nameOf(r.actorUserId), undoneByName: nameOf(r.undoneById), approvedByName: nameOf(r.approvedById), canUndo: this.canUndo(r) }));
  }

  /** Mark an entry undone and write the reversing entry. */
  async markUndone(original: ChangeLog, userId: string | null, extra: Partial<Parameters<ChangeLogService["record"]>[0]> = {}) {
    await prisma.changeLog.update({ where: { id: original.id }, data: { undoneAt: new Date(), undoneById: userId } });
    return this.record({
      workspaceId: original.workspaceId,
      campaignId: original.campaignId,
      campaignName: original.campaignName,
      clientId: original.clientId,
      actorType: "USER",
      userId,
      action: original.action,
      before: (original.after as Record<string, unknown>) ?? null,
      after: (original.before as Record<string, unknown>) ?? null,
      platformPushed: original.platformPushed,
      revertOfId: original.id,
      ...extra,
      summary: `Undid: ${original.summary.replace(/ \(.*\)$/, "")}`,
    });
  }

  /**
   * Undo a budget / status / name entry (not one that came from a suggestion —
   * the route sends those through the suggestion's own undo).
   */
  async undo(workspaceId: string, id: string, userId: string) {
    const e = await prisma.changeLog.findFirst({ where: { id, workspaceId } });
    if (!e) throw new ActionError(404, "Change not found.");
    if (!this.canUndo(e)) {
      if (e.undoneAt) throw new ActionError(409, "This change was already undone.");
      if (Date.now() - e.createdAt.getTime() >= CHANGE_UNDO_WINDOW_MS) throw new ActionError(409, "Undo is available for 7 days after a change.");
      throw new ActionError(400, "This change can't be undone from Advertix.");
    }
    if (!e.campaignId) throw new ActionError(410, "The campaign no longer exists.");
    const c = await prisma.campaign.findFirst({ where: { id: e.campaignId, workspaceId }, include: { adAccount: true } });
    if (!c) throw new ActionError(410, "The campaign no longer exists.");

    const before = (e.before ?? {}) as Record<string, unknown>;
    const after = (e.after ?? {}) as Record<string, unknown>;
    const live = c.platform === "META" && Boolean(c.externalId);
    if (!live && c.externalId) throw new ActionError(409, "This campaign is managed on its platform. Change it there.");
    const changed = () => new ActionError(409, "This has changed again since, so Undo would overwrite that change. Edit the campaign instead.");

    if (e.action === "campaign.budget") {
      if (Math.abs(Number(c.budget) - Number(after.budget)) >= 0.01) throw changed();
      const target = Number(before.budget);
      if (!(target > 0)) throw new ActionError(400, "There's no earlier budget to go back to.");
      if (live) {
        if (c.budgetType !== "DAILY") throw new ActionError(409, "Change lifetime budgets in Settings.");
        await setDailyBudget(c as CampaignWithAccount, target);
      } else {
        await prisma.campaign.update({ where: { id: c.id }, data: { budget: new Prisma.Decimal(target.toFixed(2)) } });
      }
    } else if (e.action === "campaign.status") {
      if (c.status !== after.status) throw changed();
      const target = String(before.status);
      if (live) {
        if (target !== "ACTIVE" && target !== "PAUSED") throw new ActionError(409, "Only active / paused can be restored on Meta.");
        await setStatus(c as CampaignWithAccount, target);
      } else {
        await prisma.campaign.update({ where: { id: c.id }, data: { status: target as "ACTIVE" | "PAUSED" | "DRAFT" | "ENDED" } });
      }
    } else if (e.action === "adset.status" || e.action === "adset.budget") {
      if (!live) throw new ActionError(409, "This campaign isn't live on Meta.");
      const s = await prisma.adSet.findFirst({ where: { id: String(after.adSetId), campaignId: c.id } });
      if (!s) throw new ActionError(410, "The ad set no longer exists.");
      if (e.action === "adset.status") {
        if (ownStatus(s) !== after.status) throw changed();
        await setAdSetStatus(c as CampaignWithAccount, s, before.status === "ACTIVE" ? "ACTIVE" : "PAUSED");
      } else {
        if (Math.abs(Number(s.dailyBudget) - Number(after.dailyBudget)) >= 0.01) throw changed();
        const target = Number(before.dailyBudget);
        if (!(target > 0)) throw new ActionError(400, "There's no earlier budget to go back to.");
        await setAdSetDailyBudget(c as CampaignWithAccount, s, target);
      }
    } else if (e.action === "ad.status") {
      if (!live) throw new ActionError(409, "This campaign isn't live on Meta.");
      const ad = await prisma.ad.findFirst({ where: { id: String(after.adId), campaignId: c.id } });
      if (!ad) throw new ActionError(410, "The ad no longer exists.");
      if (ownStatus(ad) !== after.status) throw changed();
      await setAdStatus(c as CampaignWithAccount, ad, before.status === "ACTIVE" ? "ACTIVE" : "PAUSED");
    } else if (e.action === "campaign.rename") {
      if (c.name !== after.name) throw changed();
      const target = String(before.name ?? "").trim();
      if (!target) throw new ActionError(400, "There's no earlier name to go back to.");
      if (live) await setName(c as CampaignWithAccount, target);
      else await prisma.campaign.update({ where: { id: c.id }, data: { name: target } });
    }

    return this.markUndone(e, userId, { platformPushed: live });
  }
}

export const changeLog = new ChangeLogService();
