import { Router, type Request, type Response, type NextFunction } from "express";
import { Prisma } from "@prisma/client";
import { requireAuth } from "../middleware/auth";
import { prisma } from "../lib/prisma";
import { requireWorkspace } from "../lib/workspace";
import { getAccess, type Access } from "../lib/access";
import { createInvites, listTeam, removeMember, resendInvite, revokeInvite, seats, updateMember } from "../services/team.service";
import { createClerkClient } from "@clerk/backend";

const clerk = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY });

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
    const { name, slug, industry, companySize, website, timezone, weekStartsOn } = req.body ?? {};
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
    if (website !== undefined) data.website = typeof website === "string" && website.trim() ? website.trim().slice(0, 200) : null;
    if (timezone !== undefined) {
      if (timezone === null || timezone === "") data.timezone = null;
      else if (typeof timezone === "string" && validTimeZone(timezone)) data.timezone = timezone;
      else return res.status(400).json({ error: "Unknown time zone" });
    }
    if (weekStartsOn !== undefined) {
      if (weekStartsOn !== 0 && weekStartsOn !== 1) return res.status(400).json({ error: "weekStartsOn must be 0 (Sunday) or 1 (Monday)" });
      data.weekStartsOn = weekStartsOn;
    }
    if (Object.keys(data).length === 0) return res.json(workspace);
    res.json(await prisma.workspace.update({ where: { id: workspace.id }, data }));
  } catch (err) {
    next(err);
  }
});

const validTimeZone = (tz: string) => {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
};

/**
 * GET /workspace/billing — the plan and what the workspace uses against it.
 * Advertix doesn't bill through the app yet (decision 10), so there are no
 * invoices or payment methods here.
 */
router.get("/billing", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const workspace = await requireWorkspace(req.dbUserId!);
    const now = new Date();
    const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
    const [clients, adAccounts, seatInfo, spend] = await Promise.all([
      prisma.client.count({ where: { workspaceId: workspace.id } }),
      prisma.adAccount.count({ where: { workspaceId: workspace.id, archivedAt: null } }),
      seats(workspace.id, workspace.plan),
      prisma.campaignMetrics.findMany({ where: { date: { gte: monthStart }, campaign: { workspaceId: workspace.id } }, select: { spend: true, campaign: { select: { adAccount: { select: { currency: true } } } } } }),
    ]);
    const byCurrency = new Map<string, number>();
    for (const m of spend) {
      const cur = m.campaign.adAccount.currency ?? "USD";
      byCurrency.set(cur, (byCurrency.get(cur) ?? 0) + Number(m.spend));
    }
    res.json({
      plan: workspace.plan,
      clients,
      adAccounts,
      seats: seatInfo,
      spendThisMonth: [...byCurrency.entries()].map(([currency, amount]) => ({ currency, amount: Math.round(amount * 100) / 100 })).sort((a, b) => b.amount - a.amount),
    });
  } catch (err) {
    next(err);
  }
});

/**
 * DELETE /workspace  { confirmName } — owner only (roleGuard: "workspace").
 * Deletes the workspace and everything in it (clients, ad accounts and their
 * synced data, campaigns, creatives, audiences, plans, history, invites).
 * Then deletes the owner's login too, unless they still belong to another
 * workspace. Nothing changes on the ad platforms.
 */
router.delete("/", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const workspace = await requireWorkspace(req.dbUserId!);
    const a = await access(req);
    if (a.role !== "OWNER") return res.status(403).json({ error: "Only the owner can delete the workspace." });
    if (typeof req.body?.confirmName !== "string" || req.body.confirmName.trim() !== workspace.name.trim()) {
      return res.status(400).json({ error: "Type the workspace name exactly to confirm." });
    }
    const user = await prisma.user.findUniqueOrThrow({ where: { id: req.dbUserId! } });
    await prisma.workspace.delete({ where: { id: workspace.id } });

    // The login goes too when it no longer belongs anywhere.
    const elsewhere = await prisma.workspaceMember.count({ where: { userId: user.id } });
    const ownsOther = await prisma.workspace.count({ where: { ownerId: user.id } });
    let accountDeleted = false;
    let loginError: string | null = null;
    if (!elsewhere && !ownsOther) {
      await prisma.user.delete({ where: { id: user.id } });
      try {
        await clerk.users.deleteUser(user.clerkId);
        accountDeleted = true;
      } catch (err) {
        loginError = "Your data is deleted, but the login couldn't be removed. Email support@advertix.io and we'll finish it.";
        console.error("[workspace] Clerk delete failed:", err instanceof Error ? err.message : err);
      }
    }
    res.json({ deleted: true, accountDeleted, loginError });
  } catch (err) {
    next(err);
  }
});

export default router;
