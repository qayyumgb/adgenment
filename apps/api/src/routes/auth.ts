import { Router, type Request, type Response, type NextFunction } from "express";
import { requireAuth } from "../middleware/auth";
import { prisma } from "../lib/prisma";
import { trialEnd } from "../lib/plans";
import { getUserWorkspace } from "../lib/workspace";
import { getAccess } from "../lib/access";
import { pendingInviteFor } from "../services/team.service";
import { myNotifications, saveNotifications, sendBriefingNow, sendTestEmail } from "../services/notifications.service";

const router = Router();

router.use(requireAuth);

/**
 * GET /auth/me
 */
router.get("/me", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.dbUserId!;
    const workspace = await getUserWorkspace(userId);
    let workspaceWithCount = null;
    if (workspace) {
      workspaceWithCount = await prisma.workspace.findUnique({
        where: { id: workspace.id },
        include: {
          _count: { select: { members: true } },
        },
      });
    }
    // Role and client access (B6), or a pending invite for someone with no workspace yet.
    const access = workspace ? await getAccess(req) : null;
    const invite = workspace ? null : await pendingInviteFor(req.user?.email ?? "");
    res.json({
      user: req.user,
      workspace: workspaceWithCount,
      access: access ? { role: access.role, clientIds: access.clientIds } : null,
      pendingInvite: invite ? { token: invite.token, workspaceName: invite.workspace.name } : null,
    });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /auth/complete-onboarding
 *
 * Idempotent: if the user already owns/belongs to a workspace, return it
 * (200) instead of erroring — the client can safely retry without seeing
 * spurious failures.
 */
router.post(
  "/complete-onboarding",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.dbUserId!;
      const { workspaceName, industry, companySize, plan } = req.body ?? {};

      // If the user already has a workspace, hand it back — don't create a
      // second one and don't surface an error.
      const existing = await getUserWorkspace(userId);
      if (existing) {
        const member = await prisma.workspaceMember.findFirst({
          where: { workspaceId: existing.id, userId },
        });
        return res.status(200).json({ workspace: existing, member });
      }

      if (typeof workspaceName !== "string" || workspaceName.trim() === "") {
        return res.status(400).json({ error: "workspaceName is required" });
      }

      // Plans are set by Advertix, never by the client (A14 fix: a paid plan could be self-assigned here).
      void plan;
      const validPlan = "FREE" as const;

      const workspace = await prisma.workspace.create({
        data: {
          name: workspaceName.trim(),
          ownerId: userId,
          plan: validPlan,
          industry:
            typeof industry === "string" && industry.trim()
              ? industry.trim()
              : null,
          companySize:
            typeof companySize === "string" && companySize.trim()
              ? companySize.trim()
              : null,
        },
      });
      const member = await prisma.workspaceMember.create({
        data: {
          workspaceId: workspace.id,
          userId,
          role: "OWNER",
        },
      });

      res.status(201).json({ workspace, member });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * POST /auth/workspace
 */
router.post(
  "/workspace",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.dbUserId!;
      const { name } = req.body ?? {};
      if (typeof name !== "string" || name.trim() === "") {
        return res.status(400).json({ error: "name is required" });
      }
      const workspace = await prisma.workspace.create({
        data: { name: name.trim(), ownerId: userId, plan: "FREE", trialEndsAt: trialEnd() },
      });
      await prisma.workspaceMember.create({
        data: { workspaceId: workspace.id, userId, role: "OWNER" },
      });
      res.status(201).json(workspace);
    } catch (err) {
      next(err);
    }
  }
);

/**
 * GET /auth/workspace
 */
router.get(
  "/workspace",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.dbUserId!;
      const workspace = await getUserWorkspace(userId);
      if (!workspace) {
        return res.status(404).json({ error: "No workspace found" });
      }
      // Client viewers don't see the team (A14 fix: this route skipped the role guard and listed every member's email).
      const access = await getAccess(req);
      const showTeam = access?.role !== "CLIENT_VIEWER";
      const full = await prisma.workspace.findUnique({
        where: { id: workspace.id },
        include: {
          ...(showTeam ? { members: { include: { user: { select: { id: true, name: true, email: true } } } } } : {}),
          _count: { select: { adAccounts: true } },
        },
      });
      res.json(showTeam ? full : { ...full, members: [] });
    } catch (err) {
      next(err);
    }
  }
);

/** GET /auth/notifications: my email alert choices (every role; personal, so outside /workspace). */
router.get("/notifications", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const workspace = await getUserWorkspace(req.dbUserId!);
    if (!workspace) return res.status(404).json({ error: "No workspace found" });
    res.json(await myNotifications(req.dbUserId!, workspace.id));
  } catch (err) {
    next(err);
  }
});

/** PUT /auth/notifications  { prefs: { [event]: boolean } } */
router.put("/notifications", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const workspace = await getUserWorkspace(req.dbUserId!);
    if (!workspace) return res.status(404).json({ error: "No workspace found" });
    const prefs = req.body?.prefs;
    if (!prefs || typeof prefs !== "object" || Array.isArray(prefs)) return res.status(400).json({ error: "prefs must be an object" });
    res.json(await saveNotifications(req.dbUserId!, workspace.id, prefs));
  } catch (err) {
    next(err);
  }
});

/** POST /auth/notifications/test — a test email to me. */
router.post("/notifications/test", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const workspace = await getUserWorkspace(req.dbUserId!);
    if (!workspace) return res.status(404).json({ error: "No workspace found" });
    const r = await sendTestEmail(req.dbUserId!, workspace.id);
    if (!r.ok) return res.status(502).json({ error: r.error ?? "The email didn't send." });
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

/** POST /auth/notifications/briefing — today's morning briefing (C12) to me now. */
router.post("/notifications/briefing", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const workspace = await getUserWorkspace(req.dbUserId!);
    if (!workspace) return res.status(404).json({ error: "No workspace found" });
    const r = await sendBriefingNow(req.dbUserId!, workspace.id);
    if (r.empty) return res.status(409).json({ error: "Nothing to brief you on yet: no open suggestions, changes, approvals or spend for your clients." });
    if (!r.ok) return res.status(502).json({ error: r.error ?? "The email didn't send." });
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

export default router;
