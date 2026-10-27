import { Router, type Request, type Response, type NextFunction } from "express";
import { getAccess } from "../lib/access";
import { requireAuth } from "../middleware/auth";
import { approvalSettings, approvalSummary, cancel, decide, listApprovals, saveApprovalSettings } from "../services/approvals.service";

/**
 * Approvals (plan C1). Owners see and decide every request; Media buyers see
 * and can withdraw their own. Permissions per route are in lib/access
 * (capabilityFor): reads = view, cancel = edit, everything else = owner.
 */

const router = Router();
router.use(requireAuth);

const accessOf = async (req: Request) => {
  const a = await getAccess(req);
  if (!a) throw Object.assign(new Error("No workspace found"), { status: 404 });
  return a;
};

/** GET /approvals?status=pending|decided|all */
router.get("/", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const s = req.query.status === "decided" || req.query.status === "all" ? req.query.status : "pending";
    res.json({ approvals: await listApprovals(await accessOf(req), req.dbUserId!, s) });
  } catch (err) {
    next(err);
  }
});

/** GET /approvals/summary — the sidebar badge and the Overview banner. */
router.get("/summary", async (req: Request, res: Response, next: NextFunction) => {
  try {
    res.json(await approvalSummary(await accessOf(req), req.dbUserId!));
  } catch (err) {
    next(err);
  }
});

/** GET /approvals/settings — the limit, the 24-hour rule and the "Ask first" clients. */
router.get("/settings", async (req: Request, res: Response, next: NextFunction) => {
  try {
    res.json(await approvalSettings((await accessOf(req)).workspaceId));
  } catch (err) {
    next(err);
  }
});

/** PUT /approvals/settings { budgetPct: number | null, timeout, askFirstClientIds } — owners. */
router.put("/settings", async (req: Request, res: Response, next: NextFunction) => {
  try {
    res.json(await saveApprovalSettings((await accessOf(req)).workspaceId, req.body ?? {}));
  } catch (err) {
    next(err);
  }
});

/** POST /approvals/:id/approve { note? } — runs the change as the person who asked. */
router.post("/:id/approve", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const note = typeof req.body?.note === "string" ? req.body.note.trim() : null;
    res.json(await decide((await accessOf(req)).workspaceId, req.params.id, "approve", req.dbUserId!, note));
  } catch (err) {
    next(err);
  }
});

/** POST /approvals/:id/reject { note? } */
router.post("/:id/reject", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const note = typeof req.body?.note === "string" ? req.body.note.trim() : null;
    res.json(await decide((await accessOf(req)).workspaceId, req.params.id, "reject", req.dbUserId!, note));
  } catch (err) {
    next(err);
  }
});

/** POST /approvals/:id/cancel — the requester withdraws it. */
router.post("/:id/cancel", async (req: Request, res: Response, next: NextFunction) => {
  try {
    res.json(await cancel((await accessOf(req)).workspaceId, req.params.id, req.dbUserId!));
  } catch (err) {
    next(err);
  }
});

export default router;
