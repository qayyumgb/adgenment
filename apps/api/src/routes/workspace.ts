import { Router, type Request, type Response, type NextFunction } from "express";
import { Prisma } from "@prisma/client";
import { requireAuth } from "../middleware/auth";
import { prisma } from "../lib/prisma";
import { requireWorkspace } from "../lib/workspace";
import { getAccess, type Access } from "../lib/access";
import { createInvites, listTeam, removeMember, resendInvite, revokeInvite, updateMember } from "../services/team.service";

/**
 * Workspace settings and the team (plan B6). Who may call what is decided
 * by `roleGuard` (lib/access.ts): team changes are owner-only, workspace
 * settings owner-only, the team list hidden from client viewers.
 */
const router = Router();
router.use(requireAuth);

async function access(req: Request): Promise<Access> {
  const a = await getAccess(req);
  if (!a) throw new Error("NO_WORKSPACE");
  return a;
}

/** GET /workspace/team — members, pending invites, seats, clients (for access pickers). */
router.get("/team", async (req: Request, res: Response, next: NextFunction) => {
  try {
    res.json(await listTeam(await access(req), req.dbUserId!));
  } catch (err) {
    next(err);
  }
});

/** GET /workspace/members — older shape, kept for existing callers. */
router.get("/members", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const workspace = await requireWorkspace(req.dbUserId!);
    const members = await prisma.workspaceMember.findMany({
      where: { workspaceId: workspace.id },
      include: { user: { select: { id: true, name: true, email: true, plan: true } } },
      orderBy: [{ createdAt: "asc" }],
    });
    res.json(members);
  } catch (err) {
    next(err);
  }
});

/** POST /workspace/invites { emails: string[], role, clientIds? } — one result per email. */
router.post("/invites", async (req: Request, res: Response, next: NextFunction) => {
  try {
    res.status(201).json(await createInvites(await access(req), req.dbUserId!, req.body ?? {}));
  } catch (err) {
    next(err);
  }
});

/** POST /workspace/invite { email, role } — older single-invite shape. */
router.post("/invite", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const out = await createInvites(await access(req), req.dbUserId!, { emails: [req.body?.email], role: req.body?.role, clientIds: req.body?.clientIds });
    const r = out.results[0];
    if (!r.ok) return res.status(400).json({ error: r.error });
    res.status(201).json(r);
  } catch (err) {
    next(err);
  }
});

/** POST /workspace/invites/:id/resend — new 7-day window, email again. */
router.post("/invites/:id/resend", async (req: Request, res: Response, next: NextFunction) => {
  try {
    res.json(await resendInvite(await access(req), req.dbUserId!, req.params.id));
  } catch (err) {
    next(err);
  }
});

/** DELETE /workspace/invites/:id — cancel; the link stops working. */
router.delete("/invites/:id", async (req: Request, res: Response, next: NextFunction) => {
  try {
    await revokeInvite(await access(req), req.params.id);
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

/** PUT /workspace/members/:memberId { role?, clientIds? } (also at …/role for older callers). */
const updateHandler = async (req: Request, res: Response, next: NextFunction) => {
  try {
    await updateMember(await access(req), req.dbUserId!, req.params.memberId, req.body ?? {});
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
};
router.put("/members/:memberId", updateHandler);
router.put("/members/:memberId/role", updateHandler);

/** DELETE /workspace/members/:memberId */
router.delete("/members/:memberId", async (req: Request, res: Response, next: NextFunction) => {
  try {
    await removeMember(await access(req), req.dbUserId!, req.params.memberId);
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

/** PATCH /workspace — name, slug, industry, company size (owner only, via roleGuard). */
router.patch("/", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const workspace = await requireWorkspace(req.dbUserId!);
    const { name, slug, industry, companySize } = req.body ?? {};
    const data: Prisma.WorkspaceUpdateInput = {};
    if (typeof name === "string" && name.trim()) data.name = name.trim();
    if (slug !== undefined) {
      if (slug === null || slug === "") {
        data.slug = null;
      } else if (typeof slug === "string") {
        const cleaned = slug
          .toLowerCase()
          .trim()
          .replace(/[^a-z0-9-]/g, "-")
          .replace(/-+/g, "-")
          .replace(/^-|-$/g, "");
        if (cleaned) data.slug = cleaned;
      }
    }
    if (industry !== undefined) data.industry = typeof industry === "string" && industry.trim() ? industry.trim() : null;
    if (companySize !== undefined) data.companySize = typeof companySize === "string" && companySize.trim() ? companySize.trim() : null;
    if (Object.keys(data).length === 0) return res.json(workspace);
    res.json(await prisma.workspace.update({ where: { id: workspace.id }, data }));
  } catch (err) {
    next(err);
  }
});

export default router;
