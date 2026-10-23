import { Router, type Request, type Response, type NextFunction } from "express";
import { Prisma, type Platform } from "@prisma/client";
import { requireAuth } from "../middleware/auth";
import { prisma } from "../lib/prisma";
import { requireWorkspace } from "../lib/workspace";
import { clientMark, ensureClients } from "../lib/clients";
import { getAccess } from "../lib/access";

/**
 * Agency clients — /api/clients (docs/DASHBOARD_REDESIGN_PLAN.md, B1).
 * Ad-account assignment lives on PATCH /api/ad-accounts/:id { clientId }.
 */

const router = Router();
router.use(requireAuth);

const str = (v: unknown, max: number) =>
  typeof v === "string" && v.trim() ? v.trim().slice(0, max) : null;

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

    await ensureClients(workspace.id);
    const created = await prisma.client.create({
      data: {
        workspaceId: workspace.id,
        name,
        short: str(req.body?.short, 3)?.toUpperCase() ?? clientMark(name),
        vertical: str(req.body?.vertical, 120),
        logoUrl: str(req.body?.logoUrl, 500),
        monthlyBudget: budget ?? null,
        currency: str(req.body?.currency, 3)?.toUpperCase() ?? null,
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
      data.name = name;
    }
    if (req.body?.short !== undefined) data.short = str(req.body.short, 3)?.toUpperCase() ?? null;
    if (req.body?.vertical !== undefined) data.vertical = str(req.body.vertical, 120);
    if (req.body?.logoUrl !== undefined) data.logoUrl = str(req.body.logoUrl, 500);
    if (req.body?.currency !== undefined) data.currency = str(req.body.currency, 3)?.toUpperCase() ?? null;
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
 * DELETE /clients/:id — its ad accounts, creatives and audiences become
 * unassigned (nothing is deleted on the platforms). The last client can't
 * be deleted: every workspace keeps at least one.
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

    await prisma.client.delete({ where: { id: existing.id } });
    // If one client is left, unassigned accounts fold back into it.
    await ensureClients(workspace.id);
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

export default router;
