import { Router, type Request, type Response, type NextFunction } from "express";
import { requireAuth } from "../middleware/auth";
import { prisma } from "../lib/prisma";
import { getUserWorkspace } from "../lib/workspace";

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
    res.json({
      user: req.user,
      workspace: workspaceWithCount,
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

      const validPlan =
        plan === "STARTER" || plan === "PRO" || plan === "ENTERPRISE"
          ? plan
          : "FREE";

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
        data: { name: name.trim(), ownerId: userId, plan: "FREE" },
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
      const full = await prisma.workspace.findUnique({
        where: { id: workspace.id },
        include: {
          members: {
            include: {
              user: { select: { id: true, name: true, email: true } },
            },
          },
          _count: { select: { adAccounts: true } },
        },
      });
      res.json(full);
    } catch (err) {
      next(err);
    }
  }
);

export default router;
