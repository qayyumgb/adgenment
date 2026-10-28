import { Router, type Request, type Response, type NextFunction } from "express";
import { Prisma, type Platform } from "@prisma/client";
import { requireAuth } from "../middleware/auth";
import { prisma } from "../lib/prisma";
import { requireWorkspace } from "../lib/workspace";
import { clientMark, ensureClients } from "../lib/clients";
import { getAccess } from "../lib/access";
import { workspaceEntitlement } from "../lib/plans";

/**
 * Agency clients — /api/clients (docs/DASHBOARD_REDESIGN_PLAN.md, B1).
 * Ad-account assignment lives on PATCH /api/ad-accounts/:id { clientId }.
 */

const router = Router();
router.use(requireAuth);

const str = (v: unknown, max: number) =>
  typeof v === "string" && v.trim() ? v.trim().slice(0, max) : null;

/** Another client in the workspace already has this name (case-insensitive). */
async function nameTaken(workspaceId: string, name: string, exceptId?: string) {
  const hit = await prisma.client.findFirst({ where: { workspaceId, name: { equals: name, mode: "insensitive" }, ...(exceptId ? { id: { not: exceptId } } : {}) }, select: { id: true } });
  return Boolean(hit);
}
/** A 3-letter currency code, null to clear, undefined to keep; NaN-ish "bad" as false. */
function parseCurrency(v: unknown): string | null | undefined | false {
  if (v === undefined) return undefined;
  if (v === null || v === "") return null;
  return typeof v === "string" && /^[A-Za-z]{3}$/.test(v.trim()) ? v.trim().toUpperCase() : false;
}

/** Accepts a positive number, numeric string, null (clear) or undefined (keep). */
function parseBudget(v: unknown): number | null | undefined {
  if (v === undefined) return undefined;
  if (v === null || v === "") return null;
  const n = typeof v === "number" ? v : Number(v);
  if (!Number.isFinite(n) || n < 0 || n > 1e12) return NaN;
  return Math.round(n * 100) / 100;
}

function serialize(
  c: Prisma.ClientGetPayload<{ include: { adAccounts: { select: { platform: true; isActive: true } } } }>,
  campaignCount: number
) {
  const active = c.adAccounts.filter((a) => a.isActive);
  return {
    id: c.id,
    name: c.name,
    short: c.short ?? clientMark(c.name),
    vertical: c.vertical,
    logoUrl: c.logoUrl,
    monthlyBudget: c.monthlyBudget == null ? null : Number(c.monthlyBudget),
    currency: c.currency,
    isDefault: c.isDefault,
    adAccountCount: active.length,
    platforms: [...new Set(active.map((a) => a.platform))] as Platform[],
    campaignCount,
    createdAt: c.createdAt,
  };
}

async function loadClients(workspaceId: string) {
  await ensureClients(workspaceId);
  const [clients, counts] = await Promise.all([
    prisma.client.findMany({
      where: { workspaceId },
      include: { adAccounts: { select: { platform: true, isActive: true } } },
      orderBy: [{ isDefault: "desc" }, { name: "asc" }],
    }),
    prisma.campaign.groupBy({
      by: ["adAccountId"],
      where: { workspaceId },
      _count: { _all: true },
    }),
  ]);
  const accounts = await prisma.adAccount.findMany({
    where: { workspaceId },
    select: { id: true, clientId: true },
  });
  const clientOfAccount = new Map(accounts.map((a) => [a.id, a.clientId]));
  const campaignsByClient = new Map<string, number>();
  for (const row of counts) {
    const cid = clientOfAccount.get(row.adAccountId);
    if (cid) campaignsByClient.set(cid, (campaignsByClient.get(cid) ?? 0) + row._count._all);
  }
  return clients.map((c) => serialize(c, campaignsByClient.get(c.id) ?? 0));
}

/** GET /clients — all clients (creates the default one on first use). */
router.get("/", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const workspace = await requireWorkspace(req.dbUserId!);
    const all = await loadClients(workspace.id);
    // Limited members (B6) only see their clients.
    const allowed = (await getAccess(req))?.clientIds ?? null;
    const clients = allowed ? all.filter((c) => allowed.includes(c.id)) : all;
    const unassigned = allowed
      ? 0
      : await prisma.adAccount.count({ where: { workspaceId: workspace.id, clientId: null, isActive: true } });
    res.json({ clients, unassignedAdAccounts: unassigned });
  } catch (err) {
    next(err);
  }
});

/** POST /clients — { name, short?, vertical?, logoUrl?, monthlyBudget?, currency? } */
router.post("/", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const workspace = await requireWorkspace(req.dbUserId!);
    const name = str(req.body?.name, 120);
    if (!name) return res.status(400).json({ error: "name is required" });
    const budget = parseBudget(req.body?.monthlyBudget);
    if (Number.isNaN(budget)) return res.status(400).json({ error: "monthlyBudget must be a positive number" });
    const currency = parseCurrency(req.body?.currency);
    if (currency === false) return res.status(400).json({ error: "Currency must be a 3-letter code, like USD or PKR." });

    await ensureClients(workspace.id);
    if (await nameTaken(workspace.id, name)) return res.status(409).json({ error: `There's already a client called “${name}”.` });
    // Plan limit (C11): Founder 1, Team 5, Agency 10 (the trial counts as Agency).
    const ent = await workspaceEntitlement(workspace.id);
    const count = await prisma.client.count({ where: { workspaceId: workspace.id } });
    if (count >= ent.limits.clients) {
      return res.status(402).json({
        code: "PLAN_LIMIT",
        error: ent.state === "EXPIRED" ? "Your free trial has ended. Choose a plan to add clients." : `Your plan includes ${ent.limits.clients} client${ent.limits.clients === 1 ? "" : "s"}. Upgrade in Settings › Billing to add more.`,
      });
    }
    const created = await prisma.client.create({
      data: {
        workspaceId: workspace.id,
        name,
        short: str(req.body?.short, 3)?.toUpperCase() ?? clientMark(name),
        vertical: str(req.body?.vertical, 120),
        logoUrl: str(req.body?.logoUrl, 500),
        monthlyBudget: budget ?? null,
        currency: currency ?? null,
      },
    });
    const all = await loadClients(workspace.id);
    res.status(201).json(all.find((c) => c.id === created.id));
  } catch (err) {
    next(err);
  }
});

/** PATCH /clients/:id — any of the POST fields. */
router.patch("/:id", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const workspace = await requireWorkspace(req.dbUserId!);
    const existing = await prisma.client.findFirst({
      where: { id: req.params.id, workspaceId: workspace.id },
    });
    if (!existing) return res.status(404).json({ error: "Client not found" });

    const data: Prisma.ClientUpdateInput = {};
    if (req.body?.name !== undefined) {
      const name = str(req.body.name, 120);
      if (!name) return res.status(400).json({ error: "name cannot be empty" });
      if (await nameTaken(workspace.id, name, existing.id)) return res.status(409).json({ error: `There's already a client called “${name}”.` });
      data.name = name;
    }
    if (req.body?.short !== undefined) data.short = str(req.body.short, 3)?.toUpperCase() ?? null;
    if (req.body?.vertical !== undefined) data.vertical = str(req.body.vertical, 120);
    if (req.body?.logoUrl !== undefined) data.logoUrl = str(req.body.logoUrl, 500);
    const currency = parseCurrency(req.body?.currency);
    if (currency === false) return res.status(400).json({ error: "Currency must be a 3-letter code, like USD or PKR." });
    if (currency !== undefined) data.currency = currency;
    const budget = parseBudget(req.body?.monthlyBudget);
    if (Number.isNaN(budget)) return res.status(400).json({ error: "monthlyBudget must be a positive number" });
    if (budget !== undefined) data.monthlyBudget = budget;

    await prisma.client.update({ where: { id: existing.id }, data });
    const all = await loadClients(workspace.id);
    res.json(all.find((c) => c.id === existing.id));
  } catch (err) {
    next(err);
  }
});

/**
 * DELETE /clients/:id?moveTo=<clientId> — everything the client had moves
 * to `moveTo`: ad accounts (with their campaigns), creatives, audiences,
 * suggestions, saved plans, history, alerts, approvals and team access (so a teammate
 * limited to this client keeps a limit, not suddenly every client). Its
 * portal link and scheduled report stop. Nothing changes on the platforms.
 * The last client can't be deleted.
 */
router.delete("/:id", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const workspace = await requireWorkspace(req.dbUserId!);
    const existing = await prisma.client.findFirst({
      where: { id: req.params.id, workspaceId: workspace.id },
    });
    if (!existing) return res.status(404).json({ error: "Client not found" });
    const total = await prisma.client.count({ where: { workspaceId: workspace.id } });
    if (total <= 1) return res.status(400).json({ error: "A workspace needs at least one client." });
    const moveTo = typeof req.query.moveTo === "string" ? req.query.moveTo : "";
    const target = moveTo && moveTo !== existing.id ? await prisma.client.findFirst({ where: { id: moveTo, workspaceId: workspace.id }, select: { id: true } }) : null;
    if (!target) return res.status(400).json({ error: "Choose the client to move its ad accounts and history to." });

    const from = { clientId: existing.id };
    const to = { clientId: target.id };
    await prisma.$transaction(async (tx) => {
      await tx.adAccount.updateMany({ where: from, data: to });
      await tx.creative.updateMany({ where: from, data: to });
      await tx.audience.updateMany({ where: from, data: to });
      await tx.suggestion.updateMany({ where: from, data: to });
      await tx.changeLog.updateMany({ where: from, data: to });
      await tx.alert.updateMany({ where: from, data: to });
      await tx.approvalRequest.updateMany({ where: from, data: to });
      await tx.plan.updateMany({ where: from, data: to });
      // Team access moves too: dropping it would turn a limited member into "all clients".
      const grants = await tx.memberClientAccess.findMany({ where: from, select: { memberId: true } });
      for (const g of grants) {
        await tx.memberClientAccess.upsert({ where: { memberId_clientId: { memberId: g.memberId, clientId: target.id } }, create: { memberId: g.memberId, clientId: target.id }, update: {} });
      }
      await tx.client.delete({ where: { id: existing.id } });
    });
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

export default router;
