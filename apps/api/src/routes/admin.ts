import { Router, type Request, type Response, type NextFunction } from "express";
import { requireAuth } from "../middleware/auth";
import { adminCancelDeletion, adminScheduleDeletion, adminWorkspaces, deletionHistory, isSuperadmin } from "../services/retention.service";

/**
 * Superadmin (plan C15b): locked workspaces and their deletion. Only users
 * listed in SUPERADMIN_EMAILS / SUPERADMIN_CLERK_IDS get past the guard; everyone
 * else gets a 404, so the routes don't advertise themselves. No workspace
 * role or plan check applies here (lib/access skips /admin).
 */

const router = Router();
router.use(requireAuth);
router.use((req: Request, res: Response, next: NextFunction) => (isSuperadmin(req.user) ? next() : res.status(404).json({ error: "Not found" })));

const by = (req: Request) => req.user?.email ?? req.user?.clerkId ?? "superadmin";

/** GET /admin/workspaces?filter=locked|all */
router.get("/workspaces", async (req: Request, res: Response, next: NextFunction) => {
  try {
    res.json({ workspaces: await adminWorkspaces(req.query.filter === "all" ? "all" : "locked") });
  } catch (err) {
    next(err);
  }
});

/** POST /admin/workspaces/:id/delete { confirmName } — deleted in 7 days unless they choose a plan. */
router.post("/workspaces/:id/delete", async (req: Request, res: Response, next: NextFunction) => {
  try {
    res.json(await adminScheduleDeletion(req.params.id, req.body?.confirmName, by(req)));
  } catch (err) {
    next(err);
  }
});

/** POST /admin/workspaces/:id/cancel-deletion */
router.post("/workspaces/:id/cancel-deletion", async (req: Request, res: Response, next: NextFunction) => {
  try {
    res.json(await adminCancelDeletion(req.params.id, by(req)));
  } catch (err) {
    next(err);
  }
});

/** GET /admin/deletions — every scheduled deletion, newest first. */
router.get("/deletions", async (_req: Request, res: Response, next: NextFunction) => {
  try {
    res.json({ deletions: await deletionHistory() });
  } catch (err) {
    next(err);
  }
});

export default router;
