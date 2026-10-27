import { Router, type Request, type Response, type NextFunction } from "express";
import { getAccess } from "../lib/access";
import { requireAuth } from "../middleware/auth";
import { safetySettings, saveSafetySettings } from "../services/safety.service";

/**
 * Automation settings (plan C14): safety rules per client, the largest daily
 * cut and "Pause all automation". Everyone reads (lib/access); owners change.
 */

const router = Router();
router.use(requireAuth);

const workspaceOf = async (req: Request) => {
  const a = await getAccess(req);
  if (!a) throw Object.assign(new Error("No workspace found"), { status: 404 });
  return a.workspaceId;
};

/** GET /automation/settings */
router.get("/settings", async (req: Request, res: Response, next: NextFunction) => {
  try {
    res.json(await safetySettings(await workspaceOf(req)));
  } catch (err) {
    next(err);
  }
});

/** PUT /automation/settings  { maxCutPct?, automationPaused?, clients?: [{ id, pixel?, cap? }] } */
router.put("/settings", async (req: Request, res: Response, next: NextFunction) => {
  try {
    res.json(await saveSafetySettings(await workspaceOf(req), req.body ?? {}));
  } catch (err) {
    next(err);
  }
});

export default router;
