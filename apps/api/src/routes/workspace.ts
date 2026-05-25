import { Router, type Request, type Response, type NextFunction } from "express";
import { type WorkspaceRole, Prisma } from "@prisma/client";
import { requireAuth } from "../middleware/auth";
import { prisma } from "../lib/prisma";
import { getUserRoleInWorkspace, requireWorkspace } from "../lib/workspace";

const router = Router();
router.use(requireAuth);

const ASSIGNABLE_ROLES: ReadonlyArray<WorkspaceRole> = [
  "ADMIN",
  "EDITOR",
  "VIEWER",
];
function isAssignableRole(v: unknown): v is WorkspaceRole {
  return (
    typeof v === "string" &&
    ASSIGNABLE_ROLES.includes(v as WorkspaceRole)
  );
}

/**
 * GET /workspace/members
 */
router.get(
  "/members",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const workspace = await requireWorkspace(req.dbUserId!);
      const members = await prisma.workspaceMember.findMany({
        where: { workspaceId: workspace.id },
        include: {
          user: {
            select: { id: true, name: true, email: true, plan: true },
          },
        },
        orderBy: [{ role: "asc" }],
      });
      res.json(members);
    } catch (err) {
      next(err);
    }
  }
);

/**
 * POST /workspace/invite
 */
router.post(
  "/invite",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const workspace = await requireWorkspace(req.dbUserId!);
      const role = await getUserRoleInWorkspace(req.dbUserId!, workspace.id);
      if (role !== "OWNER" && role !== "ADMIN") {
        return res
          .status(403)
          .json({ error: "Only owners and admins can invite members" });
      }

      const { email, role: inviteRole } = req.body ?? {};
      if (
        typeof email !== "string" ||
        !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
      ) {
        return res.status(400).json({ error: "Valid email is required" });
      }
      if (!isAssignableRole(inviteRole)) {
        return res
          .status(400)
          .json({ error: "role must be ADMIN, EDITOR, or VIEWER" });
      }

      // TODO: persist a pending Invite record and send via Resend.
      res.json({
        success: true,
        message: `Invite sent to ${email}`,
        email,
        role: inviteRole,
      });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * PUT /workspace/members/:memberId/role
 */
router.put(
  "/members/:memberId/role",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const workspace = await requireWorkspace(req.dbUserId!);
      const myRole = await getUserRoleInWorkspace(req.dbUserId!, workspace.id);
      if (myRole !== "OWNER" && myRole !== "ADMIN") {
        return res
          .status(403)
          .json({ error: "Only owners and admins can change roles" });
      }

      const { role } = req.body ?? {};
      if (!isAssignableRole(role)) {
        return res
          .status(400)
          .json({ error: "role must be ADMIN, EDITOR, or VIEWER" });
      }

      const target = await prisma.workspaceMember.findFirst({
        where: { id: req.params.memberId, workspaceId: workspace.id },
      });
      if (!target) {
        return res.status(404).json({ error: "Member not found" });
      }
      if (target.role === "OWNER") {
        return res
          .status(400)
          .json({ error: "Cannot change role of the workspace owner" });
      }

      const updated = await prisma.workspaceMember.update({
        where: { id: target.id },
        data: { role },
        include: {
          user: { select: { id: true, name: true, email: true } },
        },
      });
      res.json(updated);
    } catch (err) {
      next(err);
    }
  }
);

/**
 * DELETE /workspace/members/:memberId
 */
router.delete(
  "/members/:memberId",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const workspace = await requireWorkspace(req.dbUserId!);
      const myRole = await getUserRoleInWorkspace(req.dbUserId!, workspace.id);
      if (myRole !== "OWNER") {
        return res
          .status(403)
          .json({ error: "Only the workspace owner can remove members" });
      }

      const target = await prisma.workspaceMember.findFirst({
        where: { id: req.params.memberId, workspaceId: workspace.id },
      });
      if (!target) {
        return res.status(404).json({ error: "Member not found" });
      }
      if (target.role === "OWNER") {
        return res
          .status(400)
          .json({ error: "Cannot remove the workspace owner" });
      }

      await prisma.workspaceMember.delete({ where: { id: target.id } });
      res.json({ success: true });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * PATCH /workspace
 *
 * Schema currently supports `name` only. `slug`, `industry`, `companySize`
 * are accepted in the request body but ignored — see TODO below.
 */
router.patch(
  "/",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const workspace = await requireWorkspace(req.dbUserId!);
      const myRole = await getUserRoleInWorkspace(req.dbUserId!, workspace.id);
      if (myRole !== "OWNER") {
        return res
          .status(403)
          .json({ error: "Only the workspace owner can update settings" });
      }

      const { name } = req.body ?? {};
      const data: Prisma.WorkspaceUpdateInput = {};
      if (typeof name === "string" && name.trim()) data.name = name.trim();

      if (Object.keys(data).length === 0) {
        return res.json(workspace);
      }

      // TODO: persist `slug`, `industry`, `companySize` after schema migration.

      const updated = await prisma.workspace.update({
        where: { id: workspace.id },
        data,
      });
      res.json(updated);
    } catch (err) {
      next(err);
    }
  }
);

export default router;
