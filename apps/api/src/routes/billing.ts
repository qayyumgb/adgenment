import { Router, type Request, type Response, type NextFunction } from "express";
import { getAccess } from "../lib/access";
import { requireAuth } from "../middleware/auth";
import { billingStatus, changePlan, createCheckout, portalSession } from "../services/billing.service";

/**
 * Billing (plan C11). Everyone (but client viewers) can see the plan; only
 * owners choose, change or manage it (lib/access). The Stripe webhook is
 * mounted in index.ts, before the JSON parser (it needs the raw body).
 */

const router = Router();
router.use(requireAuth);

const workspaceOf = async (req: Request) => {
  const a = await getAccess(req);
  if (!a) throw Object.assign(new Error("No workspace found"), { status: 404 });
  return a.workspaceId;
};

/** GET /billing/status */
router.get("/status", async (req: Request, res: Response, next: NextFunction) => {
  try {
    res.json(await billingStatus(await workspaceOf(req)));
  } catch (err) {
    next(err);
  }
});

/** POST /billing/checkout { tier: FOUNDER | TEAM | AGENCY, interval: month | year } → { url } */
router.post("/checkout", async (req: Request, res: Response, next: NextFunction) => {
  try {
    res.json(await createCheckout(await workspaceOf(req), req.dbUserId!, req.body ?? {}));
  } catch (err) {
    next(err);
  }
});

/** POST /billing/change { tier, interval } — switch plan (prorated). */
router.post("/change", async (req: Request, res: Response, next: NextFunction) => {
  try {
    res.json(await changePlan(await workspaceOf(req), req.body ?? {}));
  } catch (err) {
    next(err);
  }
});

/** POST /billing/portal → { url } (invoices, card, cancel). */
router.post("/portal", async (req: Request, res: Response, next: NextFunction) => {
  try {
    res.json(await portalSession(await workspaceOf(req)));
  } catch (err) {
    next(err);
  }
});

export default router;
