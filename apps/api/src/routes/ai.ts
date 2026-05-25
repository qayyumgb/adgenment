import { Router, Request, Response } from "express";
import { aiService } from "../services/ai.service";

const router = Router();

const MODEL = "claude-sonnet-4-20250514";

router.get("/health", (_req: Request, res: Response) => {
  res.json({ status: "ok", model: MODEL });
});

router.post("/plan-campaign", async (req: Request, res: Response) => {
  const { prompt } = req.body ?? {};

  if (typeof prompt !== "string" || prompt.trim().length < 10) {
    return res.status(400).json({
      error: "Prompt must be at least 10 characters.",
    });
  }
  if (prompt.length > 1000) {
    return res.status(400).json({
      error: "Prompt must be at most 1000 characters.",
    });
  }

  try {
    const { json, tokensUsed } = await aiService.planCampaign(prompt);
    const plan = JSON.parse(json);
    return res.json({ success: true, plan, tokensUsed });
  } catch (err) {
    const code = err instanceof Error ? err.message : "AI_API_ERROR";
    if (code === "AI_PARSE_ERROR") {
      return res.status(500).json({
        error:
          "AI returned an unexpected response. Try rephrasing your prompt.",
      });
    }
    return res.status(500).json({
      error: "AI service is temporarily unavailable. Please try again.",
    });
  }
});

router.post("/generate-copy", async (req: Request, res: Response) => {
  const { brief, platform, objective } = req.body ?? {};

  if (typeof brief !== "string" || brief.trim().length < 10) {
    return res.status(400).json({
      error: "Brief must be at least 10 characters.",
    });
  }
  if (typeof platform !== "string" || !platform.trim()) {
    return res.status(400).json({ error: "Platform is required." });
  }
  if (typeof objective !== "string" || !objective.trim()) {
    return res.status(400).json({ error: "Objective is required." });
  }

  try {
    const { json, tokensUsed } = await aiService.generateCreativeCopy(
      brief,
      platform,
      objective
    );
    const copy = JSON.parse(json);
    return res.json({ success: true, copy, tokensUsed });
  } catch (err) {
    const code = err instanceof Error ? err.message : "AI_API_ERROR";
    if (code === "AI_PARSE_ERROR") {
      return res.status(500).json({
        error: "AI returned malformed copy. Please try again.",
      });
    }
    return res.status(500).json({
      error: "AI service is temporarily unavailable. Please try again.",
    });
  }
});

export default router;
