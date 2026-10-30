import { Router, type Request, type Response, type NextFunction } from "express";
import type { Platform } from "@prisma/client";
import { requireAuth } from "../middleware/auth";
import { requireWorkspace } from "../lib/workspace";
import { parseClientScope } from "../lib/clients";
import { campaignHours, clientHours, setSmartHours, suggestNow } from "../services/hours.service";

/**
 * Smart hours (plan C7). Reading is for everyone who sees campaigns; turning
 * Smart hours on and preparing a change need edit, and applying it goes
 * through the suggestion's Apply (and Approvals).
 */

/** Mounted under /campaigns. */
export const campaignHoursRouter = Router();
campaignHoursRouter.use(requireAuth);

/** GET /campaigns/:id/hours — the heatmap, the gate and the suggestion. */
campaignHoursRouter.get("/:id/hours", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const workspace = await requireWorkspace(req.dbUserId!);
    res.json(await campaignHours(workspace.id, req.params.id));
  } catch (err) {
    next(err);
  }
});

/** PUT /campaigns/:id/smart-hours { on } */
campaignHoursRouter.put("/:id/smart-hours", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const workspace = await requireWorkspace(req.dbUserId!);
    res.json(await setSmartHours(workspace.id, req.params.id, req.body?.on === true));
  } catch (err) {
    next(err);
  }
});

/** POST /campaigns/:id/hours/suggest — the current suggestion as a suggestion row, to apply. */
campaignHoursRouter.post("/:id/hours/suggest", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const workspace = await requireWorkspace(req.dbUserId!);
    const s = await suggestNow(workspace.id, req.params.id);
    res.json({ suggestionId: s.id, status: s.status });
  } catch (err) {
    next(err);
  }
});

const PLATFORMS: Platform[] = ["META", "GOOGLE", "TIKTOK"];

/** Mounted at /hours. GET /hours?clientId=&platform= — a client's campaigns together (Budgets). */
export const hoursRouter = Router();
hoursRouter.use(requireAuth);
hoursRouter.get("/", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const workspace = await requireWorkspace(req.dbUserId!);
    const clientId = await parseClientScope(req, workspace.id);
    const platform = PLATFORMS.find((p) => p === req.query.platform) ?? null;
    res.json(await clientHours(workspace.id, clientId, platform));
  } catch (err) {
    next(err);
  }
});
