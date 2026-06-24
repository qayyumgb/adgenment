import { Router, type Request, type Response, type NextFunction } from "express";
import { requireAuth } from "../middleware/auth";
import { requireWorkspace } from "../lib/workspace";
import { budgetOptimizerService } from "../services/budget-optimizer.service";

const router = Router();
router.use(requireAuth);

// In-memory rate limiter — AI analysis is the expensive call. 10/hour per
// workspace. Reset on restart (abuse protection, not billing).
const ANALYSES_PER_HOUR = 10;
const HOUR_MS = 60 * 60 * 1000;
const analysisTimestamps = new Map<string, number[]>();

function checkRate(workspaceId: string): { ok: boolean; resetSeconds?: number } {
  const now = Date.now();
  const recent = (analysisTimestamps.get(workspaceId) ?? []).filter(
    (t) => now - t < HOUR_MS
  );
  if (recent.length >= ANALYSES_PER_HOUR) {
    return { ok: false, resetSeconds: Math.ceil((recent[0] + HOUR_MS - now) / 1000) };
  }
  return { ok: true };
}
function recordRun(workspaceId: string) {
  const now = Date.now();
  const recent = (analysisTimestamps.get(workspaceId) ?? []).filter(
    (t) => now - t < HOUR_MS
  );
  recent.push(now);
  analysisTimestamps.set(workspaceId, recent);
}

/**
 * POST /budget-optimizer/analyze — run an AI budget analysis for the workspace.
 */
router.post("/analyze", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const workspace = await requireWorkspace(req.dbUserId!);
    const rate = checkRate(workspace.id);
    if (!rate.ok) {
      return res.status(429).json({
        error: `Rate limit reached — ${ANALYSES_PER_HOUR} analyses per hour. Try again in ${rate.resetSeconds}s.`,
      });
    }

    let analysis;
    try {
      analysis = await budgetOptimizerService.analyzeAndOptimize(workspace.id);
    } catch (err) {
      const code = err instanceof Error ? err.message : "AI_API_ERROR";
      if (code === "NO_CAMPAIGNS") {
        return res.status(400).json({
          error:
            "No campaigns to optimize yet. Connect an ad account and run campaigns first.",
        });
      }
      if (code === "AI_PARSE_ERROR") {
        return res
          .status(502)
          .json({ error: "AI returned an unexpected response. Try again." });
      }
      return res
        .status(503)
        .json({ error: "AI service is temporarily unavailable. Try again." });
    }

    // Only count against the limit on a successful AI run (insufficient-data
    // results don't call the model, so they don't burn a slot).
    if (!analysis.insufficientData) recordRun(workspace.id);
    res.json(analysis);
  } catch (err) {
    next(err);
  }
});

/**
 * POST /budget-optimizer/apply — apply recommendations (DB-only / planning).
 * Body: { recommendationId, campaignIds? }
 */
router.post("/apply", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const workspace = await requireWorkspace(req.dbUserId!);
    const { recommendationId, campaignIds } = (req.body ?? {}) as {
      recommendationId?: unknown;
      campaignIds?: unknown;
    };
    if (typeof recommendationId !== "string" || !recommendationId) {
      return res.status(400).json({ error: "recommendationId is required" });
    }
    const ids =
      Array.isArray(campaignIds) && campaignIds.every((v) => typeof v === "string")
        ? (campaignIds as string[])
        : undefined;

    try {
      const result = await budgetOptimizerService.applyRecommendations(
        workspace.id,
        recommendationId,
        ids
      );
      res.json(result);
    } catch (err) {
      if (err instanceof Error && err.message === "RECOMMENDATION_NOT_FOUND") {
        return res.status(404).json({ error: "Recommendation not found" });
      }
      throw err;
    }
  } catch (err) {
    next(err);
  }
});

/**
 * POST /budget-optimizer/dismiss — mark a recommendation dismissed.
 * Body: { recommendationId }
 */
router.post("/dismiss", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const workspace = await requireWorkspace(req.dbUserId!);
    const { recommendationId } = (req.body ?? {}) as { recommendationId?: unknown };
    if (typeof recommendationId !== "string" || !recommendationId) {
      return res.status(400).json({ error: "recommendationId is required" });
    }
    try {
      const updated = await budgetOptimizerService.dismiss(
        workspace.id,
        recommendationId
      );
      res.json(updated);
    } catch (err) {
      if (err instanceof Error && err.message === "RECOMMENDATION_NOT_FOUND") {
        return res.status(404).json({ error: "Recommendation not found" });
      }
      throw err;
    }
  } catch (err) {
    next(err);
  }
});

/**
 * GET /budget-optimizer/history — recent analyses.
 */
router.get("/history", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const workspace = await requireWorkspace(req.dbUserId!);
    const history = await budgetOptimizerService.getHistory(workspace.id);
    res.json(history);
  } catch (err) {
    next(err);
  }
});

/**
 * GET /budget-optimizer/latest — most recent PENDING recommendation, or null.
 */
router.get("/latest", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const workspace = await requireWorkspace(req.dbUserId!);
    const latest = await budgetOptimizerService.getLatestPending(workspace.id);
    res.json(latest ?? null);
  } catch (err) {
    next(err);
  }
});

export default router;
