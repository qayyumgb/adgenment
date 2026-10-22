import { Router, type Request, type Response, type NextFunction } from "express";
import { Prisma, type PlanStatus } from "@prisma/client";
import { requireAuth } from "../middleware/auth";
import { prisma } from "../lib/prisma";
import { requireWorkspace } from "../lib/workspace";
import { parseBodyClientId, parseClientScope } from "../lib/clients";

/**
 * Saved AI plans (plan B5; the AI Planner page uses them from A12). A plan
 * keeps every version the planner produced, newest = `latestVersion`.
 */
const router = Router();
router.use(requireAuth);

const STATUSES: PlanStatus[] = ["DRAFT", "USED", "ARCHIVED"];
const MAX_PLAN_BYTES = 200_000;

/** The planner's plan object; bounded so a runaway payload can't bloat the table. */
function parsePlan(raw: unknown): Prisma.InputJsonValue | { error: string } {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return { error: "plan must be an object" };
  if (JSON.stringify(raw).length > MAX_PLAN_BYTES) return { error: "plan is too large" };
  return raw as Prisma.InputJsonValue;
}

const isError = (v: unknown): v is { error: string } => !!v && typeof v === "object" && "error" in (v as object) && typeof (v as { error: unknown }).error === "string" && Object.keys(v as object).length === 1;

function titleFrom(title: unknown, plan: Record<string, unknown>, brief: string) {
  if (typeof title === "string" && title.trim()) return title.trim().slice(0, 120);
  for (const k of ["title", "name", "summary"]) {
    const v = plan[k];
    if (typeof v === "string" && v.trim()) return v.trim().slice(0, 120);
  }
  return brief.slice(0, 60) || "Untitled plan";
}

const LIST_SELECT = {
  id: true,
  title: true,
  brief: true,
  status: true,
  latestVersion: true,
  clientId: true,
  createdById: true,
  createdAt: true,
  updatedAt: true,
} as const;

/** GET /plans?clientId= — newest first. */
router.get("/", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const workspace = await requireWorkspace(req.dbUserId!);
    const clientId = await parseClientScope(req, workspace.id);
    const plans = await prisma.plan.findMany({
      where: { workspaceId: workspace.id, ...(clientId ? { clientId } : {}), ...(req.query.include === "archived" ? {} : { status: { not: "ARCHIVED" } }) },
      select: LIST_SELECT,
      orderBy: { updatedAt: "desc" },
      take: 100,
    });
    res.json({ plans: plans.map((p) => ({ ...p, brief: p.brief.slice(0, 280) })) });
  } catch (err) {
    next(err);
  }
});

/** GET /plans/:id — the plan with every version, newest first. */
router.get("/:id", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const workspace = await requireWorkspace(req.dbUserId!);
    const plan = await prisma.plan.findFirst({
      where: { id: req.params.id, workspaceId: workspace.id },
      include: { versions: { orderBy: { version: "desc" } } },
    });
    if (!plan) return res.status(404).json({ error: "Plan not found" });
    res.json(plan);
  } catch (err) {
    next(err);
  }
});

/** POST /plans  { brief, plan, title?, clientId?, note? } — saves version 1. */
router.post("/", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const workspace = await requireWorkspace(req.dbUserId!);
    const body = (req.body ?? {}) as Record<string, unknown>;
    const brief = typeof body.brief === "string" ? body.brief.trim().slice(0, 4000) : "";
    if (!brief) return res.status(400).json({ error: "brief is required" });
    const plan = parsePlan(body.plan);
    if (isError(plan)) return res.status(400).json(plan);
    const clientId = await parseBodyClientId(body.clientId, workspace.id);

    const created = await prisma.plan.create({
      data: {
        workspaceId: workspace.id,
        clientId: clientId ?? null,
        createdById: req.dbUserId!,
        title: titleFrom(body.title, body.plan as Record<string, unknown>, brief),
        brief,
        latestVersion: 1,
        versions: { create: { version: 1, plan, note: typeof body.note === "string" ? body.note.slice(0, 200) : null } },
      },
      include: { versions: true },
    });
    res.status(201).json(created);
  } catch (err) {
    next(err);
  }
});

/** POST /plans/:id/versions  { plan, note? } — appends the next version. */
router.post("/:id/versions", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const workspace = await requireWorkspace(req.dbUserId!);
    const plan = parsePlan(req.body?.plan);
    if (isError(plan)) return res.status(400).json(plan);
    const note = typeof req.body?.note === "string" ? req.body.note.slice(0, 200) : null;

    const result = await prisma.$transaction(async (tx) => {
      const existing = await tx.plan.findFirst({ where: { id: req.params.id, workspaceId: workspace.id } });
      if (!existing) return null;
      const version = existing.latestVersion + 1;
      const v = await tx.planVersion.create({ data: { planId: existing.id, version, plan, note } });
      await tx.plan.update({ where: { id: existing.id }, data: { latestVersion: version } });
      return v;
    });
    if (!result) return res.status(404).json({ error: "Plan not found" });
    res.status(201).json(result);
  } catch (err) {
    next(err);
  }
});

/** PATCH /plans/:id  { title?, status?, clientId? } */
router.patch("/:id", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const workspace = await requireWorkspace(req.dbUserId!);
    const existing = await prisma.plan.findFirst({ where: { id: req.params.id, workspaceId: workspace.id } });
    if (!existing) return res.status(404).json({ error: "Plan not found" });
    const body = (req.body ?? {}) as Record<string, unknown>;
    const data: Prisma.PlanUncheckedUpdateInput = {};
    if (typeof body.title === "string" && body.title.trim()) data.title = body.title.trim().slice(0, 120);
    if (body.status !== undefined) {
      if (!STATUSES.includes(body.status as PlanStatus)) return res.status(400).json({ error: "status must be DRAFT, USED or ARCHIVED" });
      data.status = body.status as PlanStatus;
    }
    const clientId = await parseBodyClientId(body.clientId, workspace.id);
    if (clientId !== undefined) data.clientId = clientId;
    const updated = await prisma.plan.update({ where: { id: existing.id }, data, select: LIST_SELECT });
    res.json(updated);
  } catch (err) {
    next(err);
  }
});

/** DELETE /plans/:id */
router.delete("/:id", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const workspace = await requireWorkspace(req.dbUserId!);
    const { count } = await prisma.plan.deleteMany({ where: { id: req.params.id, workspaceId: workspace.id } });
    if (!count) return res.status(404).json({ error: "Plan not found" });
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

export default router;
