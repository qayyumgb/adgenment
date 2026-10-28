import { Router, type Request, type Response, type NextFunction } from "express";
import { requireAuth } from "../middleware/auth";
import { prisma } from "../lib/prisma";
import { requireWorkspace } from "../lib/workspace";
import { parseClientScope } from "../lib/clients";
import { assertClientAccess, getAccess } from "../lib/access";
import { flightCalendar, launchCheck, parseWindow } from "../services/calendar.service";

/** Flight calendar (plan C5). Read-only: everyone who sees campaigns sees it. */

const router = Router();
router.use(requireAuth);

const isDay = (v: unknown): v is string => typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(v));

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

/** GET /calendar/check?adAccountId=&objective=&start=YYYY-MM-DD&end=YYYY-MM-DD&excludeId= (the wizard's schedule, C6) */
router.get("/check", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { adAccountId, objective, start, end, excludeId } = req.query;
    if (typeof adAccountId !== "string" || typeof objective !== "string" || !isDay(start) || (end !== undefined && end !== "" && !isDay(end))) {
      return res.status(400).json({ error: "adAccountId, objective and start (YYYY-MM-DD) are required." });
    }
    const workspace = await requireWorkspace(req.dbUserId!);
    // Limited members (B6): only their clients' accounts.
    const access = await getAccess(req);
    if (access?.clientIds) {
      const a = await prisma.adAccount.findFirst({ where: { id: adAccountId, workspaceId: workspace.id }, select: { clientId: true } });
      if (a) assertClientAccess(access, a.clientId);
    }
    res.json(await launchCheck(workspace.id, { adAccountId, objective, start, end: isDay(end) ? end : null, excludeId: typeof excludeId === "string" ? excludeId : null }));
  } catch (err) {
    next(err);
  }
});

export default router;
