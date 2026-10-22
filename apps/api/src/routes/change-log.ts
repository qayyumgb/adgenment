import { Router, type Request, type Response, type NextFunction } from "express";
import { requireAuth } from "../middleware/auth";
import { prisma } from "../lib/prisma";
import { requireWorkspace } from "../lib/workspace";
import { parseClientScope } from "../lib/clients";
import { changeLog } from "../services/change-log.service";
import { suggestionsService } from "../services/suggestions.service";

/**
 * Change log (plan B3). GET lists entries newest first (per campaign or per
 * client); POST /:id/undo reverses a budget / status / name change within 7
 * days. Entries from an applied suggestion are undone through the suggestion,
 * so its state (Applied → open again) stays in step.
 */
const router = Router();
router.use(requireAuth);

/** GET /change-log?campaignId=&clientId=&limit=&before=<ISO> */
router.get("/", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const workspace = await requireWorkspace(req.dbUserId!);
    const clientId = await parseClientScope(req, workspace.id);
    const campaignId = typeof req.query.campaignId === "string" && req.query.campaignId ? req.query.campaignId : undefined;
    const before = typeof req.query.before === "string" && !Number.isNaN(Date.parse(req.query.before)) ? new Date(req.query.before) : undefined;
    const limit = parseInt(String(req.query.limit ?? "50"), 10) || 50;
    const entries = await changeLog.list(workspace.id, { campaignId, clientId, limit, before });
    res.json({ entries });
  } catch (err) {
    next(err);
  }
});

/** POST /change-log/:id/undo */
router.post("/:id/undo", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const workspace = await requireWorkspace(req.dbUserId!);
    const entry = await prisma.changeLog.findFirst({ where: { id: req.params.id, workspaceId: workspace.id } });
    if (!entry) return res.status(404).json({ error: "Change not found." });

    if (entry.suggestionId && entry.actorType === "AI" && changeLog.canUndo(entry)) {
      await suggestionsService.undo(workspace.id, entry.suggestionId, req.dbUserId!);
    } else {
      await changeLog.undo(workspace.id, entry.id, req.dbUserId!);
    }
    const [updated] = await changeLog.list(workspace.id, { campaignId: entry.campaignId ?? undefined, limit: 1 });
    res.json({ ok: true, latest: updated ?? null });
  } catch (err) {
    next(err);
  }
});

export default router;
