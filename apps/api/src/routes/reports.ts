import { Router, type Request, type Response, type NextFunction } from "express";
import { getAccess } from "../lib/access";
import { requireAuth } from "../middleware/auth";
import { getSchedule, saveSchedule, sendTest } from "../services/reports.service";

/**
 * Scheduled client reports (plan C4b). Reading needs view; saving and test
 * sends need edit and access to the client (lib/access).
 */

const router = Router();
router.use(requireAuth);

const accessOf = async (req: Request) => {
  const a = await getAccess(req);
  if (!a) throw Object.assign(new Error("No workspace found"), { status: 404 });
  return a;
};

/** GET /reports/schedule?clientId= */
router.get("/schedule", async (req: Request, res: Response, next: NextFunction) => {
  try {
    res.json(await getSchedule(await accessOf(req), req.query.clientId));
  } catch (err) {
    next(err);
  }
});

/** PUT /reports/schedule { clientId, frequency, recipients, showSpend, showRevenue, showCampaigns, attachPdf, active } */
router.put("/schedule", async (req: Request, res: Response, next: NextFunction) => {
  try {
    res.json(await saveSchedule(await accessOf(req), req.dbUserId!, req.body ?? {}));
  } catch (err) {
    next(err);
  }
});

/** POST /reports/schedule/test — the report as set in the form, to me only. */
router.post("/schedule/test", async (req: Request, res: Response, next: NextFunction) => {
  try {
    res.json(await sendTest(await accessOf(req), req.dbUserId!, req.body ?? {}));
  } catch (err) {
    next(err);
  }
});

export default router;
