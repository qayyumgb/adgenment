import { Router, Request, Response } from "express";
import { requireAuth } from "../middleware/auth";

const router = Router();

router.get("/overview", requireAuth, (_req: Request, res: Response) => {
  res.json({
    spend: 0,
    impressions: 0,
    clicks: 0,
    conversions: 0,
    roas: 0,
  });
});

router.get("/campaigns/:id", requireAuth, (req: Request, res: Response) => {
  res.json({ campaignId: req.params.id, series: [] });
});

export default router;
