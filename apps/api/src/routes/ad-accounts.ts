import { Router, type Request, type Response, type NextFunction } from "express";
import type { Platform } from "@prisma/client";
import { requireAuth } from "../middleware/auth";
import { prisma } from "../lib/prisma";
import { requireWorkspace } from "../lib/workspace";
import { ensureClients, parseClientScope } from "../lib/clients";
import { encryptToken } from "../lib/crypto";

const router = Router();
router.use(requireAuth);

const PLATFORMS: ReadonlyArray<Platform> = [
  "META",
  "GOOGLE",
  "TIKTOK",
  "LINKEDIN",
  "YOUTUBE",
  "SNAPCHAT",
  "PINTEREST",
  "X",
];
function isPlatform(v: unknown): v is Platform {
  return typeof v === "string" && PLATFORMS.includes(v as Platform);
}

// NB: never include accessToken/refreshToken here. currency/timezone/
// minDailyBudget are safe display metadata the UI needs (budget input symbol,
// timestamps, grounded budget recommendation).
const PUBLIC_AD_ACCOUNT_SELECT = {
  id: true,
  platform: true,
  accountId: true,
  accountName: true,
  currency: true,
  timezone: true,
  minDailyBudget: true,
  accountStatus: true,
  isActive: true,
  createdAt: true,
  lastSyncedAt: true,
  clientId: true,
  tokenExpiresAt: true,
  archivedAt: true,
} as const;

const DAY_MS = 24 * 60 * 60 * 1000;

type StoredHealth = { overall?: string; checks?: { status?: string; title?: string }[] };

/**
 * Compact health summary from the stored Meta health report (metadata +
 * lastHealthCheck). Null when no check has run (non-Meta accounts today).
 */
function healthSummary(metadata: unknown, checkedAt: Date | null) {
  const report = metadata as StoredHealth | null;
  if (!report || typeof report !== "object" || !report.overall) return null;
  const problems = (report.checks ?? []).filter((c) => c.status === "error" || c.status === "warning");
  const worst = problems.find((c) => c.status === "error") ?? problems[0];
  return {
    overall: report.overall as "healthy" | "degraded" | "blocked",
    issues: problems.length,
    topIssue: worst?.title ?? null,
    checkedAt,
  };
}

/**
 * GET /ad-accounts?clientId=&include=archived
 */
router.get("/", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const workspace = await requireWorkspace(req.dbUserId!);
    await ensureClients(workspace.id);
    const clientId = await parseClientScope(req, workspace.id);
    const accounts = await prisma.adAccount.findMany({
      // Archived accounts (A13) stay out of lists unless asked for.
      where: { workspaceId: workspace.id, ...(clientId ? { clientId } : {}), ...(req.query.include === "archived" ? {} : { archivedAt: null }) },
      select: { ...PUBLIC_AD_ACCOUNT_SELECT, metadata: true, lastHealthCheck: true },
      orderBy: { createdAt: "desc" },
    });

    // Last-30-day spend per account (one query over the accounts' campaigns).
    const since = new Date(Date.now() - 30 * DAY_MS);
    const ids = accounts.map((a) => a.id);
    const spendByAccount = new Map<string, number>();
    if (ids.length) {
      const campaigns = await prisma.campaign.findMany({
        where: { adAccountId: { in: ids } },
        select: { id: true, adAccountId: true },
      });
      const accountOf = new Map(campaigns.map((c) => [c.id, c.adAccountId]));
      if (campaigns.length) {
        const sums = await prisma.campaignMetrics.groupBy({
          by: ["campaignId"],
          where: { campaignId: { in: campaigns.map((c) => c.id) }, date: { gte: since } },
          _sum: { spend: true },
        });
        for (const row of sums) {
          const acct = accountOf.get(row.campaignId);
          if (acct) spendByAccount.set(acct, (spendByAccount.get(acct) ?? 0) + Number(row._sum.spend ?? 0));
        }
      }
    }

    res.json(
      accounts.map(({ metadata, lastHealthCheck, ...a }) => ({
        ...a,
        health: healthSummary(metadata, lastHealthCheck),
        spend30d: +(spendByAccount.get(a.id) ?? 0).toFixed(2),
      }))
    );
  } catch (err) {
    next(err);
  }
});

/**
 * POST /ad-accounts
 */
router.post("/", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const workspace = await requireWorkspace(req.dbUserId!);
    const { platform, accountId, accountName, accessToken, refreshToken } =
      req.body ?? {};

    if (!isPlatform(platform)) {
      return res.status(400).json({ error: "Invalid or missing platform" });
    }
    if (typeof accountId !== "string" || !accountId.trim()) {
      return res.status(400).json({ error: "accountId is required" });
    }
    if (typeof accountName !== "string" || !accountName.trim()) {
      return res.status(400).json({ error: "accountName is required" });
    }
    if (typeof accessToken !== "string" || !accessToken.trim()) {
      return res.status(400).json({ error: "accessToken is required" });
    }

    const account = await prisma.adAccount.upsert({
      where: {
        workspaceId_platform_accountId: {
          workspaceId: workspace.id,
          platform,
          accountId: accountId.trim(),
        },
      },
      create: {
        workspaceId: workspace.id,
        platform,
        accountId: accountId.trim(),
        accountName: accountName.trim(),
        // Stored encrypted, like the OAuth callbacks.
        accessToken: encryptToken(accessToken),
        refreshToken:
          typeof refreshToken === "string" && refreshToken.trim()
            ? encryptToken(refreshToken)
            : null,
        isActive: true,
      },
      update: {
        accountName: accountName.trim(),
        // Stored encrypted, like the OAuth callbacks.
        accessToken: encryptToken(accessToken),
        refreshToken:
          typeof refreshToken === "string" && refreshToken.trim()
            ? encryptToken(refreshToken)
            : null,
        isActive: true,
      },
      select: PUBLIC_AD_ACCOUNT_SELECT,
    });

    res.status(201).json(account);
  } catch (err) {
    next(err);
  }
});

/**
 * DELETE /ad-accounts/:id
 */
router.delete(
  "/:id",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const workspace = await requireWorkspace(req.dbUserId!);
      const existing = await prisma.adAccount.findFirst({
        where: { id: req.params.id, workspaceId: workspace.id },
      });
      if (!existing) {
        return res.status(404).json({ error: "Ad account not found" });
      }
      await prisma.adAccount.delete({ where: { id: existing.id } });
      res.json({ success: true });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * PATCH /ad-accounts/:id — assign to a client: { clientId: string | null }.
 */
router.patch("/:id", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const workspace = await requireWorkspace(req.dbUserId!);
    const existing = await prisma.adAccount.findFirst({
      where: { id: req.params.id, workspaceId: workspace.id },
    });
    if (!existing) {
      return res.status(404).json({ error: "Ad account not found" });
    }
    const { clientId } = req.body ?? {};
    if (clientId !== null && typeof clientId !== "string") {
      return res.status(400).json({ error: "clientId must be a client id or null" });
    }
    if (clientId) {
      const client = await prisma.client.findFirst({
        where: { id: clientId, workspaceId: workspace.id },
        select: { id: true },
      });
      if (!client) return res.status(404).json({ error: "Client not found" });
    }
    const updated = await prisma.adAccount.update({
      where: { id: existing.id },
      data: { clientId: clientId ?? null },
      select: PUBLIC_AD_ACCOUNT_SELECT,
    });
    res.json(updated);
  } catch (err) {
    next(err);
  }
});

/**
 * PATCH /ad-accounts/:id/toggle
 */
router.patch(
  "/:id/toggle",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const workspace = await requireWorkspace(req.dbUserId!);
      const existing = await prisma.adAccount.findFirst({
        where: { id: req.params.id, workspaceId: workspace.id },
      });
      if (!existing) {
        return res.status(404).json({ error: "Ad account not found" });
      }
      const updated = await prisma.adAccount.update({
        where: { id: existing.id },
        data: { isActive: !existing.isActive },
        select: PUBLIC_AD_ACCOUNT_SELECT,
      });
      res.json(updated);
    } catch (err) {
      next(err);
    }
  }
);

export default router;
