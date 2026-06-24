import { Router, type Request, type Response, type NextFunction } from "express";
import type { Platform } from "@prisma/client";
import { requireAuth } from "../middleware/auth";
import { prisma } from "../lib/prisma";
import { requireWorkspace } from "../lib/workspace";

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
  isActive: true,
  createdAt: true,
} as const;

/**
 * GET /ad-accounts
 */
router.get("/", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const workspace = await requireWorkspace(req.dbUserId!);
    const accounts = await prisma.adAccount.findMany({
      where: { workspaceId: workspace.id },
      select: PUBLIC_AD_ACCOUNT_SELECT,
      orderBy: { createdAt: "desc" },
    });
    res.json(accounts);
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
        accessToken,
        refreshToken:
          typeof refreshToken === "string" && refreshToken.trim()
            ? refreshToken
            : null,
        isActive: true,
      },
      update: {
        accountName: accountName.trim(),
        accessToken,
        refreshToken:
          typeof refreshToken === "string" && refreshToken.trim()
            ? refreshToken
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
