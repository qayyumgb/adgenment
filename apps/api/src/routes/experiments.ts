import { Router, type Request, type Response, type NextFunction } from "express";
import { requireAuth } from "../middleware/auth";
import { requireWorkspace } from "../lib/workspace";
import { parseClientScope } from "../lib/clients";
import { endTest, lessonsFor, listExperiments, scaleSuggestion, setGoal, setLesson, startCreativeTest } from "../services/experiments.service";
import { syncService } from "../services/sync.service";

/**
 * Experiments (plan C9): A/B tests on the workspace's ad accounts. Reading is
 * for everyone; starting, ending, the goal and lessons need edit; Scale the
 * winner returns a suggestion to apply (Approvals for media buyers).
 */
const router = Router();
router.use(requireAuth);

/** GET /experiments?clientId= */
router.get("/", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const workspace = await requireWorkspace(req.dbUserId!);
    const clientId = await parseClientScope(req, workspace.id);
    res.json({ experiments: await listExperiments(workspace.id, clientId) });
  } catch (err) {
    next(err);
  }
});

/** GET /experiments/lessons?clientId= — what finished tests showed (C9c). */
router.get("/lessons", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const workspace = await requireWorkspace(req.dbUserId!);
    const clientId = await parseClientScope(req, workspace.id);
    res.json({ lessons: await lessonsFor(workspace.id, clientId, 20) });
  } catch (err) {
    next(err);
  }
});

/** PUT /experiments/:id/goal { goal: "purchase" | "click" | "ctr" | "auto" } */
router.put("/:id/goal", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const workspace = await requireWorkspace(req.dbUserId!);
    res.json(await setGoal(workspace.id, req.params.id, req.body?.goal));
  } catch (err) {
    next(err);
  }
});

/** PUT /experiments/:id/lesson { lesson } (C9c) */
router.put("/:id/lesson", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const workspace = await requireWorkspace(req.dbUserId!);
    res.json(await setLesson(workspace.id, req.params.id, req.body?.lesson));
  } catch (err) {
    next(err);
  }
});

/** POST /experiments/:id/end — end a running test now (C9b). */
router.post("/:id/end", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const workspace = await requireWorkspace(req.dbUserId!);
    res.json(await endTest(workspace.id, req.dbUserId!, req.params.id));
  } catch (err) {
    next(err);
  }
});

/** POST /experiments/:id/scale { winner? } → { suggestionId }, then /suggestions/:id/apply (C9b). */
router.post("/:id/scale", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const workspace = await requireWorkspace(req.dbUserId!);
    const s = await scaleSuggestion(workspace.id, req.params.id, req.body?.winner);
    res.json({ suggestionId: s.id, status: s.status });
  } catch (err) {
    next(err);
  }
});

export default router;

/** Mounted under /campaigns. POST /campaigns/:id/experiments { name, creativeIds, days, dailyBudget } (C9b). */
export const campaignExperimentsRouter = Router();
campaignExperimentsRouter.use(requireAuth);
campaignExperimentsRouter.post("/:id/experiments", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const workspace = await requireWorkspace(req.dbUserId!);
    const e = await startCreativeTest(workspace.id, req.dbUserId!, req.params.id, req.body ?? {});
    // Bring the new ads in, so results show from the first sync.
    void syncService.syncMetaCampaignStructure(req.params.id).catch((err) => console.error("[experiments] structure refresh:", err instanceof Error ? err.message : err));
    res.status(201).json({ id: e.id });
  } catch (err) {
    next(err);
  }
});
