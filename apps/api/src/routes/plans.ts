import { Router, type Request, type Response, type NextFunction } from "express";
import { Prisma, type PlanStatus, type Platform } from "@prisma/client";
import { requireAuth } from "../middleware/auth";
import { prisma } from "../lib/prisma";
import { requireWorkspace } from "../lib/workspace";
import { parseBodyClientId, parseClientScope } from "../lib/clients";
import { assertClientAccess, getAccess } from "../lib/access";
import { changeLog } from "../services/change-log.service";
import { OBJECTIVES, PLATFORM_NAME, plannedTargeting } from "../services/planner.service";

/**
 * Saved AI plans (plan B5; the AI Planner page saves to them from A12). A
 * plan keeps every version the planner produced, newest = `latestVersion`.
 * Each version's JSON carries the plan and the chat that led to it, so a
 * saved plan reopens where it was left. Drafts created from a version are
 * linked back (`Campaign.planId` / `planVersion`).
 */
const router = Router();
router.use(requireAuth);

const STATUSES: PlanStatus[] = ["DRAFT", "USED", "ARCHIVED"];
const MAX_PLAN_BYTES = 400_000;

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
  client: { select: { name: true } },
} as const;

const summary = <T extends { brief: string; client: { name: string } | null }>({ client, ...p }: T) => ({ ...p, brief: p.brief.slice(0, 280), clientName: client?.name ?? null });

/** A plan of this workspace that the member may see (limited members: their clients only; else 404). */
async function findPlan(req: Request, workspaceId: string) {
  const plan = await prisma.plan.findFirst({ where: { id: req.params.id, workspaceId } });
  if (!plan) return null;
  const access = await getAccess(req);
  if (access) assertClientAccess(access, plan.clientId);
  return plan;
}

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
    res.json({ plans: plans.map(summary) });
  } catch (err) {
    next(err);
  }
});

/** GET /plans/:id — the plan with every version (newest first) and the drafts made from it. */
router.get("/:id", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const workspace = await requireWorkspace(req.dbUserId!);
    if (!(await findPlan(req, workspace.id))) return res.status(404).json({ error: "Plan not found" });
    const plan = await prisma.plan.findUniqueOrThrow({
      where: { id: req.params.id },
      include: {
        versions: { orderBy: { version: "desc" } },
        campaigns: { select: { id: true, name: true, platform: true, status: true, planVersion: true }, orderBy: { createdAt: "asc" } },
        client: { select: { name: true } },
      },
    });
    res.json(summaryDetail(plan));
  } catch (err) {
    next(err);
  }
});

const summaryDetail = <T extends { client: { name: string } | null }>({ client, ...p }: T) => ({ ...p, clientName: client?.name ?? null });

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
    const access = await getAccess(req);
    if (access) assertClientAccess(access, clientId);

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

/** POST /plans/:id/versions  { plan, note?, title? } — appends the next version. */
router.post("/:id/versions", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const workspace = await requireWorkspace(req.dbUserId!);
    if (!(await findPlan(req, workspace.id))) return res.status(404).json({ error: "Plan not found" });
    const plan = parsePlan(req.body?.plan);
    if (isError(plan)) return res.status(400).json(plan);
    const note = typeof req.body?.note === "string" ? req.body.note.slice(0, 200) : null;
    const title = typeof req.body?.title === "string" && req.body.title.trim() ? req.body.title.trim().slice(0, 120) : undefined;

    const result = await prisma.$transaction(async (tx) => {
      const existing = await tx.plan.findUniqueOrThrow({ where: { id: req.params.id } });
      const version = existing.latestVersion + 1;
      const v = await tx.planVersion.create({ data: { planId: existing.id, version, plan, note } });
      await tx.plan.update({ where: { id: existing.id }, data: { latestVersion: version, ...(title ? { title } : {}) } });
      return v;
    });
    res.status(201).json(result);
  } catch (err) {
    next(err);
  }
});

/** PATCH /plans/:id  { title?, status?, clientId? } */
router.patch("/:id", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const workspace = await requireWorkspace(req.dbUserId!);
    const existing = await findPlan(req, workspace.id);
    if (!existing) return res.status(404).json({ error: "Plan not found" });
    const body = (req.body ?? {}) as Record<string, unknown>;
    const data: Prisma.PlanUncheckedUpdateInput = {};
    if (typeof body.title === "string" && body.title.trim()) data.title = body.title.trim().slice(0, 120);
    if (body.status !== undefined) {
      if (!STATUSES.includes(body.status as PlanStatus)) return res.status(400).json({ error: "status must be DRAFT, USED or ARCHIVED" });
      data.status = body.status as PlanStatus;
    }
    const clientId = await parseBodyClientId(body.clientId, workspace.id);
    if (clientId !== undefined) {
      const access = await getAccess(req);
      if (access) assertClientAccess(access, clientId);
      data.clientId = clientId;
    }
    const updated = await prisma.plan.update({ where: { id: existing.id }, data, select: LIST_SELECT });
    res.json(summary(updated));
  } catch (err) {
    next(err);
  }
});

/** DELETE /plans/:id — drafts made from it stay (their link is cleared). */
router.delete("/:id", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const workspace = await requireWorkspace(req.dbUserId!);
    if (!(await findPlan(req, workspace.id))) return res.status(404).json({ error: "Plan not found" });
    await prisma.plan.delete({ where: { id: req.params.id } });
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

type DraftSource = { platform?: unknown; name?: unknown; objective?: unknown; daily?: unknown; start?: unknown; end?: unknown; ageMin?: unknown; ageMax?: unknown; genders?: unknown; countries?: unknown };

/**
 * POST /plans/:id/drafts  { version? } — "Create campaigns as drafts": one
 * DRAFT campaign per planned campaign (paused, nothing spends), on the
 * client's ad account for that platform, with the plan's daily budget, dates
 * and targeting. Campaigns on platforms the client hasn't connected are
 * skipped with the reason. Once per version.
 */
router.post("/:id/drafts", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const workspace = await requireWorkspace(req.dbUserId!);
    const plan = await findPlan(req, workspace.id);
    if (!plan) return res.status(404).json({ error: "Plan not found" });
    if (!plan.clientId) return res.status(400).json({ error: "Pick a client for this plan first." });
    const versionNo = Number(req.body?.version) || plan.latestVersion;
    const version = await prisma.planVersion.findUnique({ where: { planId_version: { planId: plan.id, version: versionNo } } });
    if (!version) return res.status(404).json({ error: "That version doesn't exist." });
    if (await prisma.campaign.count({ where: { planId: plan.id, planVersion: versionNo } })) {
      return res.status(409).json({ error: `Drafts were already created from version ${versionNo}.` });
    }
    const source = ((version.plan as { campaigns?: unknown }).campaigns ?? []) as DraftSource[];
    if (!Array.isArray(source) || !source.length) return res.status(400).json({ error: "This version has no campaigns." });

    const client = await prisma.client.findUnique({ where: { id: plan.clientId }, select: { name: true } });
    const accounts = await prisma.adAccount.findMany({ where: { workspaceId: workspace.id, clientId: plan.clientId, isActive: true }, orderBy: { createdAt: "asc" } });
    const date = (v: unknown) => (typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v) ? new Date(`${v}T00:00:00Z`) : null);
    const created: { id: string; name: string; platform: Platform }[] = [];
    const skipped: { name: string; platform: string; reason: string }[] = [];

    for (const c of source.slice(0, 8)) {
      const platform = String(c.platform ?? "") as Platform;
      const name = String(c.name ?? "").trim().slice(0, 120) || "Planned campaign";
      const platformName = PLATFORM_NAME[platform] ?? platform;
      const account = accounts.find((a) => a.platform === platform);
      if (!account) {
        skipped.push({ name, platform, reason: `No ${platformName} account is connected for ${client?.name ?? "this client"}.` });
        continue;
      }
      const daily = Math.round(Number(c.daily) * 100) / 100;
      if (!(daily > 0)) {
        skipped.push({ name, platform, reason: "It has no budget in this plan." });
        continue;
      }
      const objective = (OBJECTIVES as readonly string[]).includes(String(c.objective)) ? String(c.objective) : "Traffic";
      const ageMin = Math.min(65, Math.max(13, Math.round(Number(c.ageMin) || 18)));
      const targeting = plannedTargeting({
        ageMin,
        ageMax: Math.min(65, Math.max(ageMin, Math.round(Number(c.ageMax) || 65))),
        genders: c.genders === "men" || c.genders === "women" ? c.genders : "all",
        countries: Array.isArray(c.countries) ? c.countries.map(String).filter((x) => /^[A-Z]{2}$/.test(x)) : [],
      });
      const campaign = await prisma.campaign.create({
        data: {
          workspaceId: workspace.id,
          adAccountId: account.id,
          platform,
          name,
          objective,
          budget: new Prisma.Decimal(daily.toFixed(2)),
          budgetType: "DAILY",
          startDate: date(c.start),
          endDate: date(c.end),
          targeting,
          status: "DRAFT",
          planId: plan.id,
          planVersion: versionNo,
        },
      });
      await changeLog.record({
        workspaceId: workspace.id,
        campaignId: campaign.id,
        campaignName: campaign.name,
        clientId: plan.clientId,
        actorType: "USER",
        userId: req.dbUserId,
        action: "campaign.create",
        note: `(from the AI plan "${plan.title}")`,
      });
      created.push({ id: campaign.id, name: campaign.name, platform });
    }
    if (created.length) await prisma.plan.update({ where: { id: plan.id }, data: { status: "USED" } });
    res.status(created.length ? 201 : 200).json({ created, skipped });
  } catch (err) {
    next(err);
  }
});

export default router;
