import { Router, type Request, type Response, type NextFunction } from "express";
import { requireAuth } from "../middleware/auth";
import { requireWorkspace } from "../lib/workspace";
import { parseClientScope } from "../lib/clients";
import { flightCalendar, parseWindow } from "../services/calendar.service";

/** Flight calendar (plan C5). Read-only: everyone who sees campaigns sees it. */

const router = Router();
router.use(requireAuth);

/** GET /calendar?from=YYYY-MM-DD&to=YYYY-MM-DD&clientId= */
router.get("/", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const window = parseWindow(req.query.from, req.query.to);
    if (!window) return res.status(400).json({ error: "from and to must be dates (YYYY-MM-DD), at most 400 days apart." });
    const workspace = await requireWorkspace(req.dbUserId!);
    const clientId = await parseClientScope(req, workspace.id);
    res.json(await flightCalendar(workspace.id, clientId, window));
  } catch (err) {
    next(err);
  }
});

export default router;
