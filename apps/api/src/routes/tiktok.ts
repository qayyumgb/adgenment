import { Router, type Request, type Response, type NextFunction } from "express";
import { requireAuth } from "../middleware/auth";
import { prisma } from "../lib/prisma";
import { encryptToken } from "../lib/crypto";
import { getUserWorkspace, requireWorkspace } from "../lib/workspace";
import { tiktokService } from "../services/tiktok.service";
import { syncService } from "../services/sync.service";

const router = Router();

const FRONTEND_URL =
  process.env.FRONTEND_URL ??
  process.env.WEB_ORIGIN ??
  "http://localhost:3000";

router.get(
  "/oauth-url",
  requireAuth,
  (req: Request, res: Response, next: NextFunction) => {
    try {
      const url = tiktokService.getOAuthUrl(req.dbUserId!);
      res.json({ url });
    } catch (err) {
      next(err);
    }
  }
);

router.get("/callback", async (req: Request, res: Response) => {
  const successUrl = `${FRONTEND_URL}/connect/done?connected=tiktok`;
  const failureUrl = `${FRONTEND_URL}/connect/done?error=tiktok_failed`;
  try {
    const { code, state, error: oauthError } = req.query;

    if (typeof oauthError === "string" && oauthError) {
      return res.redirect(`${FRONTEND_URL}/connect/done?error=tiktok_cancelled`);
    }
    if (typeof code !== "string" || !code) {
      return res.redirect(failureUrl);
    }
    if (typeof state !== "string" || !state.trim()) {
      return res.redirect(failureUrl);
    }

    const user = await prisma.user.findUnique({ where: { id: state } });
    if (!user) return res.redirect(failureUrl);

    const workspace = await getUserWorkspace(user.id);
    if (!workspace) {
      return res.redirect(
        `${FRONTEND_URL}/connect/done?error=tiktok_no_workspace`
      );
    }

    const tokens = await tiktokService.exchangeCodeForToken(code);
    if (!tokens.access_token || tokens.advertiser_ids.length === 0) {
      return res.redirect(
        `${FRONTEND_URL}/connect/done?error=tiktok_no_advertisers`
      );
    }
    const encryptedAccess = encryptToken(tokens.access_token);

    const advertisers = await tiktokService.getAdvertiserInfo(
      tokens.access_token,
      tokens.advertiser_ids
    );

    for (const adv of advertisers) {
      await prisma.adAccount.upsert({
        where: {
          workspaceId_platform_accountId: {
            workspaceId: workspace.id,
            platform: "TIKTOK",
            accountId: adv.id,
          },
        },
        create: {
          workspaceId: workspace.id,
          platform: "TIKTOK",
          accountId: adv.id,
          accountName: adv.name || `Advertiser ${adv.id}`,
          accessToken: encryptedAccess,
          isActive: adv.status === "STATUS_ENABLE" || adv.status === "ACTIVE",
        },
        update: {
          accountName: adv.name || `Advertiser ${adv.id}`,
          accessToken: encryptedAccess,
          isActive: adv.status === "STATUS_ENABLE" || adv.status === "ACTIVE",
        },
      });
    }

    return res.redirect(successUrl);
  } catch (err) {
    console.error("[tiktok/callback] error:", err);
    return res.redirect(failureUrl);
  }
});

router.post(
  "/sync/:adAccountId",
  requireAuth,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const workspace = await requireWorkspace(req.dbUserId!);
      const adAccount = await prisma.adAccount.findFirst({
        where: {
          id: req.params.adAccountId,
          workspaceId: workspace.id,
          platform: "TIKTOK",
        },
      });
      if (!adAccount) {
        return res.status(404).json({ error: "TikTok ad account not found" });
      }
      const result = await syncService.syncTikTokAccount(adAccount);
      res.json({ success: true, ...result });
    } catch (err) {
      next(err);
    }
  }
);

export default router;
