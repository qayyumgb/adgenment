import { Router, type Request, type Response, type NextFunction } from "express";
import type { Platform } from "@prisma/client";
import { requireAuth } from "../middleware/auth";
import { requireWorkspace } from "../lib/workspace";
import { parseClientScope } from "../lib/clients";
import { getAccess } from "../lib/access";
import { prisma } from "../lib/prisma";
import { acceptPending, connectionsOverview, ConnectionError, CONNECTABLE, disconnectPlatform, discardPending, pendingView, setArchived, setAutoSync, syncAll } from "../services/connections.service";

/**
 * Connections (plan A13): platforms, ad accounts with a status each, the
 * accounts an OAuth connect found (pick them in the Connect dialog), sync,
 * auto-sync per platform, archive / restore. Connecting itself still goes
 * through /<platform>/oauth-url; assigning a client is PATCH /ad-accounts/:id.
 */
const router = Router();
router.use(requireAuth);

const fail = (res: Response, err: unknown, next: NextFunction) =>
  err instanceof ConnectionError ? res.status(err.status).json({ error: err.message }) : next(err);
const isPlatform = (v: unknown): v is Platform => typeof v === "string" && (CONNECTABLE as string[]).includes(v);

/** GET /connections?clientId= */
router.get("/", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const workspace = await requireWorkspace(req.dbUserId!);
    res.json(await connectionsOverview(workspace.id, await parseClientScope(req, workspace.id)));
  } catch (err) {
    fail(res, err, next);
  }
});

/** GET /connections/pending/:id — accounts found by the last connect, waiting to be picked. */
router.get("/pending/:id", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const workspace = await requireWorkspace(req.dbUserId!);
    res.json(await pendingView(workspace.id, req.params.id));
  } catch (err) {
    fail(res, err, next);
  }
});

/** POST /connections/pending/:id/accept  { accounts: [{ accountId, clientId }] } */
router.post("/pending/:id/accept", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const workspace = await requireWorkspace(req.dbUserId!);
    const access = await getAccess(req);
    res.status(201).json(await acceptPending(workspace.id, req.params.id, Array.isArray(req.body?.accounts) ? req.body.accounts : [], access?.clientIds ?? null));
  } catch (err) {
    fail(res, err, next);
  }
});

/** DELETE /connections/pending/:id — the user closed the dialog without adding. */
router.delete("/pending/:id", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const workspace = await requireWorkspace(req.dbUserId!);
    await discardPending(workspace.id, req.params.id);
    res.json({ success: true });
  } catch (err) {
    fail(res, err, next);
  }
});

/** POST /connections/sync  { platform? } — Sync now. */
router.post("/sync", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const workspace = await requireWorkspace(req.dbUserId!);
    const platform = req.body?.platform;
    if (platform !== undefined && platform !== null && !isPlatform(platform)) return res.status(400).json({ error: "Unknown platform" });
    res.json(await syncAll(workspace.id, await parseClientScope(req, workspace.id), platform ?? null));
  } catch (err) {
    fail(res, err, next);
  }
});

/** POST /connections/accounts/:id/sync — one account. */
router.post("/accounts/:id/sync", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const workspace = await requireWorkspace(req.dbUserId!);
    const account = await prisma.adAccount.findFirst({ where: { id: req.params.id, workspaceId: workspace.id } });
    if (!account) return res.status(404).json({ error: "Ad account not found" });
    if (account.archivedAt) return res.status(400).json({ error: "Restore this account before syncing it." });
    const { syncService } = await import("../services/sync.service");
    try {
      const r = await syncService.syncAccount(account);
      res.json({ ok: true, campaigns: r.campaignsSynced, metrics: r.metricsSynced });
    } catch (err) {
      res.status(502).json({ error: err instanceof Error ? err.message : "Sync failed" });
    }
  } catch (err) {
    fail(res, err, next);
  }
});

/** POST /connections/accounts/:id/archive  and  /restore */
for (const action of ["archive", "restore"] as const) {
  router.post(`/accounts/:id/${action}`, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const workspace = await requireWorkspace(req.dbUserId!);
      res.json(await setArchived(workspace.id, req.params.id, action === "archive"));
    } catch (err) {
      fail(res, err, next);
    }
  });
}

/** POST /connections/disconnect  { platform } — remove the platform's accounts in the client scope. */
router.post("/disconnect", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const workspace = await requireWorkspace(req.dbUserId!);
    const platform = req.body?.platform;
    if (!isPlatform(platform)) return res.status(400).json({ error: "Unknown platform" });
    res.json(await disconnectPlatform(workspace.id, await parseClientScope(req, workspace.id), platform));
  } catch (err) {
    fail(res, err, next);
  }
});

/** PATCH /connections/auto-sync  { platform, enabled } */
router.patch("/auto-sync", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const workspace = await requireWorkspace(req.dbUserId!);
    const { platform, enabled } = req.body ?? {};
    if (!isPlatform(platform) || typeof enabled !== "boolean") return res.status(400).json({ error: "platform and enabled are required" });
    res.json(await setAutoSync(workspace.id, platform, enabled));
  } catch (err) {
    fail(res, err, next);
  }
});

export default router;
