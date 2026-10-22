import { Router, type Request, type Response, type NextFunction } from "express";
import type { Suggestion } from "@prisma/client";
import { requireAuth } from "../middleware/auth";
import { requireWorkspace } from "../lib/workspace";
import { parseClientScope } from "../lib/clients";
import { insightsService } from "../services/insights.service";
import { suggestionsService, UNDO_WINDOW_MS } from "../services/suggestions.service";

/**
 * Suggestions (plan B2). Apply runs the action on the ad platform and records
 * what Undo restores; review-only suggestions carry a `reviewHref` instead.
 */
const router = Router();
router.use(requireAuth);

type WithNames = Suggestion & { client?: { name: string } | null; campaign?: { name: string } | null };

function serialize(s: WithNames) {
  return {
    id: s.id,
    kind: s.kind,
    clientId: s.clientId,
    clientName: s.client?.name ?? null,
    campaignId: s.campaignId,
    campaignName: s.campaign?.name ?? null,
    title: s.title,
    reason: s.reason,
    impact: s.impact,
    priority: s.priority,
    confidence: s.confidence,
    /** True when Apply really executes (and Undo reverts) on the platform. */
    executable: Boolean(s.actionType && s.actionPayload),
    actionType: s.actionType,
    actionPayload: s.actionPayload,
    actionLabel: s.actionLabel,
    doneLabel: s.doneLabel,
    reviewHref: s.reviewHref,
    status: s.status,
    snoozedUntil: s.snoozedUntil,
    appliedAt: s.appliedAt,
    canUndo:
      s.status === "SNOOZED" ||
      (s.status === "APPLIED" && !!s.revertPayload && !!s.appliedAt && Date.now() - s.appliedAt.getTime() < UNDO_WINDOW_MS),
    createdAt: s.createdAt,
  };
}

/** GET /suggestions?clientId=&campaignId=&include=applied */
router.get("/", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const workspace = await requireWorkspace(req.dbUserId!);
    const clientId = await parseClientScope(req, workspace.id);
    const campaignId = typeof req.query.campaignId === "string" && req.query.campaignId ? req.query.campaignId : undefined;
    const rows = await suggestionsService.list(workspace.id, {
      clientId,
      campaignId,
      includeApplied: req.query.include === "applied",
    });
    const lastCheckedAt = await insightsService.lastGeneratedAt(workspace.id);
    res.json({ suggestions: rows.map(serialize), lastCheckedAt });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /suggestions/refresh — re-run the insight check (1-hour gate in the
 * service) and return the open set. `generated: false` = checked recently.
 */
router.post("/refresh", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const workspace = await requireWorkspace(req.dbUserId!);
    let generated = false;
    try {
      generated = (await insightsService.refreshInsights(workspace.id)).generated;
    } catch (err) {
      const code = err instanceof Error ? err.message : "AI_API_ERROR";
      return res.status(code === "AI_PARSE_ERROR" ? 502 : 503).json({ error: "The check didn’t finish. Try again in a moment." });
    }
    // Also picks up insights and budget analyses changed on the old pages.
    await suggestionsService.syncFromInsights(workspace.id);
    await suggestionsService.syncFromBudgetRecommendations(workspace.id);
    const rows = await suggestionsService.list(workspace.id);
    const lastCheckedAt = await insightsService.lastGeneratedAt(workspace.id);
    res.json({ suggestions: rows.map(serialize), lastCheckedAt, generated });
  } catch (err) {
    next(err);
  }
});

/** POST /suggestions/:id/apply */
router.post("/:id/apply", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const workspace = await requireWorkspace(req.dbUserId!);
    const s = await suggestionsService.apply(workspace.id, req.params.id, req.dbUserId!);
    res.json(serialize(s));
  } catch (err) {
    next(err);
  }
});

/** POST /suggestions/:id/snooze  { days?: number } — "Not now", default 7 days. */
router.post("/:id/snooze", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const workspace = await requireWorkspace(req.dbUserId!);
    const days = Number((req.body ?? {}).days);
    const s = await suggestionsService.snooze(workspace.id, req.params.id, Number.isFinite(days) && days > 0 ? days : undefined);
    res.json(serialize(s));
  } catch (err) {
    next(err);
  }
});

/** POST /suggestions/:id/undo — revert an apply (within 7 days) or wake a snooze. */
router.post("/:id/undo", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const workspace = await requireWorkspace(req.dbUserId!);
    const s = await suggestionsService.undo(workspace.id, req.params.id, req.dbUserId!);
    res.json(serialize(s));
  } catch (err) {
    next(err);
  }
});

export default router;
