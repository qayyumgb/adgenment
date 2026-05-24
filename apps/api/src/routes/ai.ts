import { Router, Request, Response } from "express";
import { requireAuth } from "../middleware/auth";

const router = Router();

router.post("/plan-campaign", requireAuth, (req: Request, res: Response) => {
  const { prompt, platform, budget } = req.body ?? {};
  res.json({
    plan: {
      summary: "Placeholder campaign plan",
      prompt: prompt ?? null,
      platform: platform ?? null,
      budget: budget ?? null,
      steps: [],
    },
  });
});

export default router;
