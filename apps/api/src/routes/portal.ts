import { Router, type Request, type Response, type NextFunction } from "express";
import { getAccess } from "../lib/access";
import { requireAuth } from "../middleware/auth";
import { createShare, getShare, portalReport, revokeShare, updateShare } from "../services/portal.service";

/**
 * Client portal (plan C4).
 *
 * - `/portal/:token`: public, no login (the link is the key; rate-limited in index.ts).
 * - `/shares`: signed in; managing a client's link needs edit and access to
 *   that client (lib/access).
 */

export const publicPortalRouter = Router();

/** GET /portal/:token?days=7|30|90 */
publicPortalRouter.get("/:token", async (req: Request, res: Response, next: NextFunction) => {
  try {
    res.set("Cache-Control", "no-store");
    res.set("X-Robots-Tag", "noindex");
    res.json(await portalReport(req.params.token, req.query.days));
  } catch (err) {
    next(err);
  }
});

export const sharesRouter = Router();
sharesRouter.use(requireAuth);

const accessOf = async (req: Request) => {
  const a = await getAccess(req);
  if (!a) throw Object.assign(new Error("No workspace found"), { status: 404 });
  return a;
};

/** GET /shares?clientId= — the client's live link, or null. */
sharesRouter.get("/", async (req: Request, res: Response, next: NextFunction) => {
  try {
    res.json({ share: await getShare(await accessOf(req), req.query.clientId) });
  } catch (err) {
    next(err);
  }
});

/** POST /shares { clientId, showSpend?, showRevenue?, showCampaigns?, expiresInDays? } — a new link (the old one stops working). */
sharesRouter.post("/", async (req: Request, res: Response, next: NextFunction) => {
  try {
    res.status(201).json({ share: await createShare(await accessOf(req), req.dbUserId!, req.body ?? {}) });
  } catch (err) {
    next(err);
  }
});

/** PATCH /shares/:id { showSpend?, showRevenue?, showCampaigns? } */
sharesRouter.patch("/:id", async (req: Request, res: Response, next: NextFunction) => {
  try {
    res.json({ share: await updateShare(await accessOf(req), req.params.id, req.body ?? {}) });
  } catch (err) {
    next(err);
  }
});

/** DELETE /shares/:id — the link stops working. */
sharesRouter.delete("/:id", async (req: Request, res: Response, next: NextFunction) => {
  try {
    await revokeShare(await accessOf(req), req.params.id);
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});
