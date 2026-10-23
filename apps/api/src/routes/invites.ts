import { Router, type Request, type Response, type NextFunction } from "express";
import { requireAuth } from "../middleware/auth";
import { acceptInvite, inviteInfo } from "../services/team.service";

/**
 * The invitee's side of an invite (plan B6). Signed in, but no workspace
 * needed: the invite is how they get one.
 */
const router = Router();
router.use(requireAuth);

const me = (req: Request) => ({ id: req.dbUserId!, email: req.user?.email ?? "" });

/** GET /invites/:token — what the invite page shows. */
router.get("/:token", async (req: Request, res: Response, next: NextFunction) => {
  try {
    res.json(await inviteInfo(req.params.token, me(req)));
  } catch (err) {
    next(err);
  }
});

/** POST /invites/:token/accept */
router.post("/:token/accept", async (req: Request, res: Response, next: NextFunction) => {
  try {
    res.json(await acceptInvite(req.params.token, me(req)));
  } catch (err) {
    next(err);
  }
});

export default router;
