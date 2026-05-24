import { Router, Request, Response } from "express";
import { requireAuth } from "../middleware/auth";

const router = Router();

router.get("/me", requireAuth, (req: Request, res: Response) => {
  res.json({ userId: (req as Request & { auth?: { userId?: string } }).auth?.userId ?? null });
});

export default router;
