import { Router, type Request, type Response, type NextFunction } from "express";
import { requireAuth } from "../middleware/auth";
import { prisma } from "../lib/prisma";
import { requireWorkspace } from "../lib/workspace";
import { parseClientScope } from "../lib/clients";
import { computePacing, PacingError } from "../services/pacing.service";
import { allocatorData, applyAllocation } from "../services/allocator.service";
import { getAccess } from "../lib/access";

/**
 * Budgets — /api/budgets (docs/DASHBOARD_REDESIGN_PLAN.md, B1 + A11).
 * Starts with monthly pacing per client; the allocator comes with A11.
 */

const router = Router();
router.use(requireAuth);

/**
 * GET /budgets/pacing?month=YYYY-MM&clientId=
 *
 * Month-to-date spend per client against its monthly budget, with a
 * straight-line projection. Months are UTC calendar months. Spend is summed
 * in each account's own currency — clients whose accounts mix currencies
 * get a raw sum (flagged with `mixedCurrency`).
 */
router.get("/pacing", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const workspace = await requireWorkspace(req.dbUserId!);
    const scope = await parseClientScope(req, workspace.id);
    try {
      res.json(await computePacing(workspace.id, scope, req.query.month));
    } catch (err) {
      if (err instanceof PacingError) return res.status(400).json({ error: err.message });
      throw err;
    }
  } catch (err) {
    next(err);
  }
});

/**
 * GET /budgets/allocator?clientId= — one client's daily budget per platform,
 * fitted response curves, bounds, and this month's budget (plan A11).
 */
router.get("/allocator", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const workspace = await requireWorkspace(req.dbUserId!);
    const scope = await parseClientScope(req, workspace.id);
    res.json(await allocatorData(workspace.id, scope));
  } catch (err) {
    next(err);
  }
});

/** POST /budgets/allocator/apply { clientId, targets: { META: 600, … } } — proportional split, Meta now. */
router.post("/allocator/apply", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const workspace = await requireWorkspace(req.dbUserId!);
    const clientId = typeof req.body?.clientId === "string" ? req.body.clientId : "";
    const access = await getAccess(req);
    if (access?.clientIds && !access.clientIds.includes(clientId)) return res.status(404).json({ error: "Client not found" });
    res.json(await applyAllocation(workspace.id, req.dbUserId!, clientId, req.body?.targets ?? {}));
  } catch (err) {
    next(err);
  }
});

export default router;
