/**
 * Suggestions (plan B2): everything Advertix suggests, with real Apply → Undo
 * where the action can be executed and reverted, and Review otherwise.
 *
 * Sources today:
 *  - INSIGHT: active AI insights (review-only; mapped to a campaign / client
 *    when the insight names exactly one campaign).
 *  - BUDGET_OPTIMIZER: the latest pending budget analysis. Budget changes and
 *    pauses are executable on Meta within guardrails; anything else is Review.
 * Both generators call the sync functions below after they run, so the old
 * Insights and Budget optimizer pages keep working on their own tables until
 * they are rebuilt (A10, A11).
 */

import { Prisma, type Suggestion, type SuggestionSource } from "@prisma/client";
import { prisma } from "../lib/prisma";
import type { BudgetRecommendationItem } from "./budget-optimizer.service";
import {
  ActionError,
  budgetBlocker,
  setDailyBudget,
  setStatus,
  statusBlocker,
  type CampaignWithAccount,
} from "./campaign-actions.service";
import { changeLog } from "./change-log.service";

const DAY_MS = 24 * 60 * 60 * 1000;
/** Apply can be undone for this long (guide §6; B3 uses the same window). */
export const UNDO_WINDOW_MS = 7 * DAY_MS;
const SNOOZE_DAYS = 7;
/** Executable budget changes stay within these multiples of the current budget. */
const MIN_RATIO = 0.5;
const MAX_RATIO = 2;

export type SetBudgetPayload = { campaignId: string; dailyBudget: number };
export type SetStatusPayload = { campaignId: string; status: "ACTIVE" | "PAUSED" };

type Draft = {
  dedupeKey: string;
  sourceRef: string;
  clientId: string | null;
  campaignId: string | null;
  kind: string;
  title: string;
  reason: string;
  impact: string | null;
  priority: number;
  confidence: string | null;
  actionType: "SET_DAILY_BUDGET" | "SET_STATUS" | null;
  actionLabel: string;
  doneLabel: string | null;
  actionPayload: SetBudgetPayload | SetStatusPayload | null;
  reviewHref: string | null;
  expiresAt: Date | null;
};

function money(n: number, currency: string | null | undefined) {
  const whole = Math.abs(n - Math.round(n)) < 0.005;
  const opts = { style: "currency" as const, minimumFractionDigits: whole ? 0 : 2, maximumFractionDigits: whole ? 0 : 2 };
  try {
    return new Intl.NumberFormat("en-US", { ...opts, currency: (currency ?? "USD").toUpperCase() }).format(n);
  } catch {
    return new Intl.NumberFormat("en-US", { ...opts, currency: "USD" }).format(n);
  }
}

/** Impact goes in a small right-aligned slot; long prose belongs in the reason. */
const shortImpact = (s: string | null | undefined) => (s && s.trim().length > 0 && s.trim().length <= 48 ? s.trim() : null);

const loadCampaign = (workspaceId: string, id: string) =>
  prisma.campaign.findFirst({ where: { id, workspaceId }, include: { adAccount: true } });

/* ── Drafts from the generators ───────────────────────────────────────────── */

function budgetDraft(r: BudgetRecommendationItem, c: CampaignWithAccount, recId: string, expiresAt: Date): Draft | null {
  const currency = c.adAccount.currency;
  const base = {
    sourceRef: recId,
    clientId: c.adAccount.clientId,
    campaignId: c.id,
    kind: "Budget shift",
    reason: String(r.reason ?? "").trim() || "Based on the last 14 days of spend and ROAS.",
    impact: shortImpact(r.expectedImpact),
    priority: typeof r.priority === "number" ? Math.round(r.priority) : 5,
    confidence: r.confidence ?? null,
    reviewHref: `/campaigns/${c.id}`,
    expiresAt,
  };

  if (r.action === "PAUSE") {
    const executable = !statusBlocker(c) && c.status === "ACTIVE";
    return {
      ...base,
      dedupeKey: `status:${c.id}`,
      title: `Pause “${c.name}”`,
      actionType: executable ? "SET_STATUS" : null,
      actionLabel: "Pause campaign",
      doneLabel: "Campaign paused",
      actionPayload: executable ? { campaignId: c.id, status: "PAUSED" } : null,
    };
  }

  if (r.action !== "INCREASE" && r.action !== "DECREASE") return null;
  const next = Number(r.recommendedBudget);
  if (!Number.isFinite(next) || next <= 0) return null;
  const current = Number(c.budget);
  const up = r.action === "INCREASE";
  const ratio = current > 0 ? next / current : 0;
  const min = c.adAccount.minDailyBudget;
  const executable =
    !budgetBlocker(c) && current > 0 && ratio >= MIN_RATIO && ratio <= MAX_RATIO && Math.abs(next - current) >= 0.01 && (!min || next >= min);
  return {
    ...base,
    dedupeKey: `budget:${c.id}`,
    title:
      current > 0
        ? `${up ? "Raise" : "Lower"} “${c.name}” from ${money(current, currency)} to ${money(next, currency)}/day`
        : `${up ? "Raise" : "Lower"} “${c.name}” to ${money(next, currency)}/day`,
    actionType: executable ? "SET_DAILY_BUDGET" : null,
    actionLabel: up ? "Raise budget" : "Lower budget",
    doneLabel: up ? "Budget raised" : "Budget lowered",
    actionPayload: executable ? { campaignId: c.id, dailyBudget: +next.toFixed(2) } : null,
  };
}

const INSIGHT_KIND: Record<string, string> = {
  OPPORTUNITY: "Opportunity",
  OPTIMIZATION: "Optimization",
  WARNING: "Warning",
  ALERT: "Alert",
};

/* ── Service ──────────────────────────────────────────────────────────────── */

class SuggestionsService {
  /**
   * Write a generator's current batch: refresh open matches, create new ones,
   * expire this source's open suggestions that weren't proposed again. Respects
   * Not now (snoozed until …) and recent applies (no re-proposing inside the
   * undo window).
   */
  private async upsertBatch(workspaceId: string, source: SuggestionSource, drafts: Draft[]) {
    const now = new Date();
    const keys = new Set<string>();
    for (const d of drafts) {
      if (keys.has(d.dedupeKey)) continue;
      keys.add(d.dedupeKey);
      const existing = await prisma.suggestion.findFirst({
        where: { workspaceId, dedupeKey: d.dedupeKey, status: { in: ["OPEN", "SNOOZED", "APPLIED"] } },
        orderBy: { createdAt: "desc" },
      });
      if (existing?.status === "SNOOZED" && existing.snoozedUntil && existing.snoozedUntil > now) continue;
      if (existing?.status === "APPLIED" && existing.appliedAt && now.getTime() - existing.appliedAt.getTime() < UNDO_WINDOW_MS) continue;
      if (existing?.suppressUntil && existing.suppressUntil > now) continue;

      const data = {
        source,
        sourceRef: d.sourceRef,
        clientId: d.clientId,
        campaignId: d.campaignId,
        kind: d.kind,
        title: d.title.slice(0, 200),
        reason: d.reason,
        impact: d.impact,
        priority: d.priority,
        confidence: d.confidence,
        actionType: d.actionType,
        actionLabel: d.actionLabel,
        doneLabel: d.doneLabel,
        actionPayload: d.actionPayload ? (d.actionPayload as unknown as Prisma.InputJsonValue) : Prisma.JsonNull,
        reviewHref: d.reviewHref,
        expiresAt: d.expiresAt,
      };
      if (existing?.status === "OPEN") {
        await prisma.suggestion.update({ where: { id: existing.id }, data });
      } else {
        await prisma.suggestion.create({ data: { workspaceId, dedupeKey: d.dedupeKey, ...data } });
      }
    }
    await prisma.suggestion.updateMany({
      where: { workspaceId, source, status: "OPEN", dedupeKey: { notIn: [...keys] } },
      data: { status: "EXPIRED" },
    });
  }

  /** Mirror the active insights into suggestions (review-only). */
  async syncFromInsights(workspaceId: string) {
    const insights = await prisma.insight.findMany({
      where: { workspaceId, status: "ACTIVE", OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }] },
    });
    const names = [
      ...new Set(insights.flatMap((i) => (Array.isArray(i.affectedCampaigns) ? (i.affectedCampaigns as unknown[]) : []).filter((n): n is string => typeof n === "string"))),
    ];
    const campaigns = names.length
      ? await prisma.campaign.findMany({
          where: { workspaceId, name: { in: names } },
          select: { id: true, name: true, adAccount: { select: { clientId: true } } },
        })
      : [];

    const drafts: Draft[] = insights.map((i) => {
      const affected = (Array.isArray(i.affectedCampaigns) ? (i.affectedCampaigns as unknown[]) : []).filter((n): n is string => typeof n === "string");
      const matched = campaigns.filter((c) => affected.includes(c.name));
      const one = matched.length === 1 ? matched[0] : null;
      const clientIds = [...new Set(matched.map((c) => c.adAccount.clientId))];
      return {
        dedupeKey: `insight:${i.id}`,
        sourceRef: i.id,
        clientId: one ? one.adAccount.clientId : clientIds.length === 1 ? clientIds[0] : null,
        campaignId: one?.id ?? null,
        kind: INSIGHT_KIND[i.type] ?? "Optimization",
        title: i.title,
        reason: i.message,
        impact: shortImpact(i.impact),
        priority: i.priority,
        confidence: i.confidence,
        actionType: null,
        actionLabel: "Review",
        doneLabel: null,
        actionPayload: null,
        reviewHref: one ? `/campaigns/${one.id}` : "/analytics",
        expiresAt: i.expiresAt,
      };
    });
    await this.upsertBatch(workspaceId, "INSIGHT", drafts);
  }

  /** Mirror the latest pending budget analysis into suggestions. */
  async syncFromBudgetRecommendations(workspaceId: string) {
    const rec = await prisma.budgetRecommendation.findFirst({
      where: { workspaceId, status: "PENDING" },
      orderBy: { createdAt: "desc" },
    });
    if (!rec) {
      await this.upsertBatch(workspaceId, "BUDGET_OPTIMIZER", []);
      return;
    }
    const items = ((rec.recommendations as unknown as BudgetRecommendationItem[]) ?? []).filter((r) => r && r.action !== "MAINTAIN");
    const campaigns = await prisma.campaign.findMany({
      where: { workspaceId, id: { in: items.map((r) => r.campaignId).filter((id) => typeof id === "string") } },
      include: { adAccount: true },
    });
    const expiresAt = new Date(rec.createdAt.getTime() + 7 * DAY_MS);
    const drafts = items
      .map((r) => {
        const c = campaigns.find((x) => x.id === r.campaignId);
        return c ? budgetDraft(r, c, rec.id, expiresAt) : null;
      })
      .filter((d): d is Draft => d !== null);
    await this.upsertBatch(workspaceId, "BUDGET_OPTIMIZER", drafts);
  }

  /** First visit after B2 ships: copy what the old generators already produced. */
  private async backfillIfEmpty(workspaceId: string) {
    const any = await prisma.suggestion.findFirst({ where: { workspaceId }, select: { id: true } });
    if (any) return;
    await this.syncFromInsights(workspaceId);
    await this.syncFromBudgetRecommendations(workspaceId);
  }

  /** Housekeeping on read: wake finished snoozes, expire stale suggestions. */
  private async tidy(workspaceId: string) {
    const now = new Date();
    await prisma.suggestion.updateMany({
      where: { workspaceId, status: "SNOOZED", snoozedUntil: { lte: now } },
      data: { status: "OPEN", snoozedUntil: null },
    });
    await prisma.suggestion.updateMany({
      where: { workspaceId, status: { in: ["OPEN", "SNOOZED"] }, expiresAt: { lte: now } },
      data: { status: "EXPIRED" },
    });
  }

  async list(
    workspaceId: string,
    opts: { clientId?: string | null; campaignId?: string; includeApplied?: boolean } = {}
  ) {
    await this.backfillIfEmpty(workspaceId);
    await this.tidy(workspaceId);
    const statusWhere: Prisma.SuggestionWhereInput = opts.includeApplied
      ? { OR: [{ status: "OPEN" }, { status: "APPLIED", appliedAt: { gte: new Date(Date.now() - UNDO_WINDOW_MS) } }] }
      : { status: "OPEN" };
    return prisma.suggestion.findMany({
      where: {
        workspaceId,
        ...(opts.clientId ? { clientId: opts.clientId } : {}),
        ...(opts.campaignId ? { campaignId: opts.campaignId } : {}),
        ...statusWhere,
      },
      include: { client: { select: { name: true } }, campaign: { select: { name: true } } },
      orderBy: [{ priority: "asc" }, { createdAt: "desc" }],
      take: 100,
    });
  }

  private async find(workspaceId: string, id: string) {
    const s = await prisma.suggestion.findFirst({ where: { id, workspaceId } });
    if (!s) throw new ActionError(404, "Suggestion not found.");
    return s;
  }

  /** `auto` (C13): applied by auto-apply on that day: no person, noted in the change log. */
  async apply(workspaceId: string, id: string, userId: string | null, auto?: { day: string }): Promise<Suggestion> {
    const s = await this.find(workspaceId, id);
    if (!s.actionType || !s.actionPayload) throw new ActionError(400, "This suggestion can't be applied from Advertix. Review it instead.");
    if (s.status === "APPLIED") throw new ActionError(409, "Already applied.");
    if (s.status !== "OPEN" && s.status !== "SNOOZED") throw new ActionError(409, "This suggestion is no longer open.");

    // Claim it first so a double click can't run the action twice.
    const claimed = await prisma.suggestion.updateMany({
      where: { id, status: { in: ["OPEN", "SNOOZED"] } },
      data: { status: "APPLIED", appliedAt: new Date(), appliedById: userId, snoozedUntil: null },
    });
    if (claimed.count !== 1) throw new ActionError(409, "This suggestion is already being applied.");

    try {
      const revert = await this.execute(workspaceId, s.actionType, s.actionPayload, "apply");
      await this.logChange(workspaceId, s, s.actionType, revert, s.actionPayload as Partial<SetBudgetPayload & SetStatusPayload>, userId, "AI", auto);
      return await prisma.suggestion.update({
        where: { id },
        data: { revertPayload: revert as unknown as Prisma.InputJsonValue, undoneAt: null },
      });
    } catch (err) {
      await prisma.suggestion.update({
        where: { id },
        data: { status: s.status, snoozedUntil: s.snoozedUntil, appliedAt: null, appliedById: null },
      });
      throw err;
    }
  }

  async snooze(workspaceId: string, id: string, days = SNOOZE_DAYS): Promise<Suggestion> {
    const s = await this.find(workspaceId, id);
    if (s.status !== "OPEN") throw new ActionError(409, "Only open suggestions can be snoozed.");
    const until = new Date(Date.now() + Math.min(30, Math.max(1, days)) * DAY_MS);
    return prisma.suggestion.update({ where: { id }, data: { status: "SNOOZED", snoozedUntil: until } });
  }

  async undo(workspaceId: string, id: string, userId: string | null = null): Promise<Suggestion> {
    const s = await this.find(workspaceId, id);
    if (s.status === "SNOOZED") {
      return prisma.suggestion.update({ where: { id }, data: { status: "OPEN", snoozedUntil: null } });
    }
    if (s.status !== "APPLIED") throw new ActionError(409, "Nothing to undo.");
    if (!s.appliedAt || Date.now() - s.appliedAt.getTime() > UNDO_WINDOW_MS) {
      throw new ActionError(409, "Undo is available for 7 days after applying.");
    }
    if (!s.actionType || !s.revertPayload) throw new ActionError(409, "This change can't be undone from Advertix.");

    // Refuse if the campaign changed since we applied (e.g. edited in Ads
    // Manager and synced): undoing would silently overwrite that change.
    await this.assertUnchanged(workspaceId, s.actionType, s.actionPayload);
    await this.execute(workspaceId, s.actionType, s.revertPayload, "undo");
    // Mark the change-log entry undone (writes the reversing entry); suggestions
    // applied before the change log existed get a plain entry instead.
    const entry = await prisma.changeLog.findFirst({
      where: { workspaceId, suggestionId: s.id, undoneAt: null, revertOfId: null },
      orderBy: { createdAt: "desc" },
    });
    if (entry) await changeLog.markUndone(entry, userId);
    else await this.logChange(workspaceId, s, s.actionType, s.actionPayload as Partial<SetBudgetPayload & SetStatusPayload>, s.revertPayload as Partial<SetBudgetPayload & SetStatusPayload>, userId, "USER");
    return prisma.suggestion.update({
      where: { id },
      data: {
        status: "OPEN",
        appliedAt: null,
        appliedById: null,
        revertPayload: Prisma.JsonNull,
        undoneAt: new Date(),
        // Automation (later) must not re-apply something a person just undid.
        suppressUntil: new Date(Date.now() + UNDO_WINDOW_MS),
      },
    });
  }

  /** Change-log entry for an executed suggestion action (before → after). */
  private async logChange(
    workspaceId: string,
    s: Suggestion,
    actionType: string,
    before: Partial<SetBudgetPayload & SetStatusPayload> | null,
    after: Partial<SetBudgetPayload & SetStatusPayload> | null,
    userId: string | null,
    actorType: "AI" | "USER" = "AI",
    auto?: { day: string }
  ) {
    const campaignId = after?.campaignId ?? before?.campaignId;
    if (!campaignId) return;
    const c = await prisma.campaign.findFirst({ where: { id: campaignId, workspaceId }, include: { adAccount: { select: { clientId: true, currency: true } } } });
    if (!c) return;
    const budget = actionType === "SET_DAILY_BUDGET";
    await changeLog.record({
      workspaceId,
      campaignId: c.id,
      campaignName: c.name,
      clientId: c.adAccount.clientId,
      currency: c.adAccount.currency,
      actorType,
      userId,
      suggestionId: s.id,
      platformPushed: true,
      action: budget ? "campaign.budget" : "campaign.status",
      before: budget ? { budget: Number(before?.dailyBudget), budgetType: "DAILY" } : { status: before?.status },
      after: { ...(budget ? { budget: Number(after?.dailyBudget), budgetType: "DAILY" } : { status: after?.status }), ...(auto ? { auto: auto.day } : {}) },
      ...(auto ? { note: "(applied automatically)" } : {}),
    });
  }

  private async assertUnchanged(workspaceId: string, actionType: string, applied: Prisma.JsonValue | null) {
    const p = applied as Partial<SetBudgetPayload & SetStatusPayload> | null;
    if (!p?.campaignId) return;
    const c = await loadCampaign(workspaceId, p.campaignId);
    if (!c) throw new ActionError(410, "The campaign no longer exists.");
    if (actionType === "SET_DAILY_BUDGET" && Math.abs(Number(c.budget) - Number(p.dailyBudget)) >= 0.01) {
      throw new ActionError(409, "The budget has changed since this was applied, so Undo would overwrite that change. Adjust it on the campaign instead.");
    }
    if (actionType === "SET_STATUS" && c.status !== p.status) {
      throw new ActionError(409, "The campaign's status has changed since this was applied. Change it on the campaign instead.");
    }
  }

  /** Run an action; returns the payload that reverses it. */
  private async execute(
    workspaceId: string,
    actionType: string,
    payload: Prisma.JsonValue,
    mode: "apply" | "undo"
  ): Promise<SetBudgetPayload | SetStatusPayload> {
    const p = payload as Partial<SetBudgetPayload & SetStatusPayload> | null;
    if (!p?.campaignId) throw new ActionError(400, "This suggestion is missing its campaign.");
    const c = await loadCampaign(workspaceId, p.campaignId);
    if (!c) throw new ActionError(410, "The campaign no longer exists.");

    if (actionType === "SET_DAILY_BUDGET") {
      const next = Number(p.dailyBudget);
      const current = Number(c.budget);
      // Guardrail re-checked at apply time: the budget may have changed since
      // the suggestion was made. Undo restores the exact previous value.
      if (mode === "apply") {
        const ratio = current > 0 ? next / current : 0;
        if (ratio < MIN_RATIO || ratio > MAX_RATIO) {
          throw new ActionError(409, "The campaign's budget has changed since this was suggested. Review it on the campaign.");
        }
      }
      await setDailyBudget(c, next);
      return { campaignId: c.id, dailyBudget: current };
    }

    if (actionType === "SET_STATUS") {
      const next = p.status;
      if (next !== "ACTIVE" && next !== "PAUSED") throw new ActionError(400, "Unknown status.");
      if (c.status === next) throw new ActionError(409, `The campaign is already ${next === "PAUSED" ? "paused" : "active"}.`);
      if (c.status !== "ACTIVE" && c.status !== "PAUSED") throw new ActionError(409, "Only active or paused campaigns can be changed.");
      const previous = c.status;
      await setStatus(c, next);
      return { campaignId: c.id, status: previous };
    }

    throw new ActionError(400, "Unknown action.");
  }
}

export const suggestionsService = new SuggestionsService();
