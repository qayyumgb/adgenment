import { Router, type Request, type Response, type NextFunction } from "express";
import { getAccess } from "../lib/access";
import { requireAuth } from "../middleware/auth";
import { alertSummary, dismissAlert, listAlerts, markSeen } from "../services/alerts.service";

/**
 * Alerts inbox (plan C2): the header bell. Everyone sees the alerts for the
 * clients they can see; dismissing needs edit (lib/access).
 */

const router = Router();
router.use(requireAuth);

const accessOf = async (req: Request) => {
  const a = await getAccess(req);
  if (!a) throw Object.assign(new Error("No workspace found"), { status: 404 });
  return a;
};

/** GET /alerts?state=open|resolved&refresh=1 (refresh: recompute now, after a fix) */
router.get("/", async (req: Request, res: Response, next: NextFunction) => {
  try {
    res.json(await listAlerts(await accessOf(req), req.dbUserId!, req.query.state === "resolved" ? "resolved" : "open", req.query.refresh === "1"));
  } catch (err) {
    next(err);
  }
});

/** GET /alerts/summary — the bell's badge. */
router.get("/summary", async (req: Request, res: Response, next: NextFunction) => {
  try {
    res.json(await alertSummary(await accessOf(req), req.dbUserId!));
  } catch (err) {
    next(err);
  }
});

/** POST /alerts/seen — I opened the inbox. */
router.post("/seen", async (req: Request, res: Response, next: NextFunction) => {
  try {
    await markSeen(await accessOf(req), req.dbUserId!);
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

/** POST /alerts/:id/dismiss */
router.post("/:id/dismiss", async (req: Request, res: Response, next: NextFunction) => {
  try {
    await dismissAlert(await accessOf(req), req.dbUserId!, req.params.id);
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

export default router;
