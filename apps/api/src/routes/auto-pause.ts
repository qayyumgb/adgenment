import { Router, type Request, type Response, type NextFunction } from "express";
import { requireAuth } from "../middleware/auth";
import { requireWorkspace } from "../lib/workspace";
import { saveAutoPause } from "../services/auto-pause.service";

/** Auto-pause (plan C6), mounted under /campaigns: a campaign's spend cap, blackout dates and tracking switch. Saving needs edit. */
const router = Router();
router.use(requireAuth);

/** PUT /campaigns/:id/auto-pause { spendCap, blackouts: [{ from, to, label? }], pauseOnTrackingLoss } */
router.put("/:id/auto-pause", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const workspace = await requireWorkspace(req.dbUserId!);
    res.json(await saveAutoPause(workspace.id, req.params.id, req.body ?? {}));
  } catch (err) {
    next(err);
  }
});

export default router;
