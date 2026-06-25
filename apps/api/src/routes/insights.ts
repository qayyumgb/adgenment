import { Router, type Request, type Response, type NextFunction } from "express";
import { requireAuth } from "../middleware/auth";
import { requireWorkspace } from "../lib/workspace";
import { insightsService } from "../services/insights.service";

const router = Router();
router.use(requireAuth);

// Generation is the expensive (Claude) call. 5/hour per workspace on top of
// the service's 1-hour refresh gate.
const GEN_PER_HOUR = 5;
const HOUR_MS = 60 * 60 * 1000;
const genTimestamps = new Map<string, number[]>();
function checkRate(id: string): { ok: boolean; resetSeconds?: number } {
  const now = Date.now();
  const recent = (genTimestamps.get(id) ?? []).filter((t) => now - t < HOUR_MS);
  if (recent.length >= GEN_PER_HOUR) {
    return { ok: false, resetSeconds: Math.ceil((recent[0] + HOUR_MS - now) / 1000) };
  }
  return { ok: true };
}
function recordGen(id: string) {
  const now = Date.now();
  const recent = (genTimestamps.get(id) ?? []).filter((t) => now - t < HOUR_MS);
  recent.push(now);
  genTimestamps.set(id, recent);
}

/** GET /insights — active insights + when they were last generated. */
router.get("/", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const workspace = await requireWorkspace(req.dbUserId!);
    const [insights, lastGeneratedAt] = await Promise.all([
      insightsService.getInsights(workspace.id),
      insightsService.lastGeneratedAt(workspace.id),
    ]);
    res.json({ insights, lastGeneratedAt, total: insights.length });
  } catch (err) {
    next(err);
  }
});

/** POST /insights/generate — regenerate (rate-limited + 1-hour refresh gate). */
router.post("/generate", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const workspace = await requireWorkspace(req.dbUserId!);
    const rate = checkRate(workspace.id);
    if (!rate.ok) {
      return res.status(429).json({
        error: `Rate limit reached — ${GEN_PER_HOUR} generations per hour. Try again in ${rate.resetSeconds}s.`,
      });
    }
    let result;
    try {
      result = await insightsService.refreshInsights(workspace.id);
    } catch (err) {
      const code = err instanceof Error ? err.message : "AI_API_ERROR";
      if (code === "AI_PARSE_ERROR") {
        return res.status(502).json({ error: "AI returned an unexpected response. Try again." });
      }
      return res.status(503).json({ error: "AI service is temporarily unavailable. Try again." });
    }
    if (result.generated) recordGen(workspace.id);
    const lastGeneratedAt = await insightsService.lastGeneratedAt(workspace.id);
    res.json({
      insights: result.insights,
      generated: result.generated,
      lastGeneratedAt,
      total: result.insights.length,
    });
  } catch (err) {
    next(err);
  }
});

/** POST /insights/:id/dismiss */
router.post("/:id/dismiss", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const workspace = await requireWorkspace(req.dbUserId!);
    const updated = await insightsService.dismissInsight(req.params.id, workspace.id);
    res.json(updated);
  } catch (err) {
    if (err instanceof Error && err.message === "INSIGHT_NOT_FOUND") {
      return res.status(404).json({ error: "Insight not found" });
    }
    next(err);
  }
});

/** POST /insights/:id/apply */
router.post("/:id/apply", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const workspace = await requireWorkspace(req.dbUserId!);
    const updated = await insightsService.applyInsight(req.params.id, workspace.id);
    res.json(updated);
  } catch (err) {
    if (err instanceof Error && err.message === "INSIGHT_NOT_FOUND") {
      return res.status(404).json({ error: "Insight not found" });
    }
    next(err);
  }
});

/** POST /insights/:id/restore — un-dismiss */
router.post("/:id/restore", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const workspace = await requireWorkspace(req.dbUserId!);
    const updated = await insightsService.restoreInsight(req.params.id, workspace.id);
    res.json(updated);
  } catch (err) {
    if (err instanceof Error && err.message === "INSIGHT_NOT_FOUND") {
      return res.status(404).json({ error: "Insight not found" });
    }
    next(err);
  }
});

/** GET /insights/dismissed */
router.get("/dismissed", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const workspace = await requireWorkspace(req.dbUserId!);
    const insights = await insightsService.getDismissed(workspace.id);
    res.json({ insights });
  } catch (err) {
    next(err);
  }
});

export default router;
