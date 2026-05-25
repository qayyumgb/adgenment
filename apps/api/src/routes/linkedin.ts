import { Router, type Request, type Response, type NextFunction } from "express";
import { requireAuth } from "../middleware/auth";
import { prisma } from "../lib/prisma";
import { encryptToken } from "../lib/crypto";
import { getUserWorkspace, requireWorkspace } from "../lib/workspace";
import { linkedinService } from "../services/linkedin.service";
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
      const url = linkedinService.getOAuthUrl(req.dbUserId!);
      res.json({ url });
    } catch (err) {
      next(err);
    }
  }
);

router.get("/callback", async (req: Request, res: Response) => {
  const successUrl = `${FRONTEND_URL}/connect/done?connected=linkedin`;
  const failureUrl = `${FRONTEND_URL}/connect/done?error=linkedin_failed`;
  try {
    const { code, state, error: oauthError } = req.query;

    if (typeof oauthError === "string" && oauthError) {
      return res.redirect(
        `${FRONTEND_URL}/connect/done?error=linkedin_cancelled`
      );
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
        `${FRONTEND_URL}/connect/done?error=linkedin_no_workspace`
      );
    }

    const tokens = await linkedinService.exchangeCodeForToken(code);
    const encryptedAccess = encryptToken(tokens.access_token);
    const encryptedRefresh = tokens.refresh_token
      ? encryptToken(tokens.refresh_token)
      : null;

    const accounts = await linkedinService.getAdAccounts(tokens.access_token);
    if (accounts.length === 0) {
      return res.redirect(
        `${FRONTEND_URL}/connect/done?error=linkedin_no_accounts`
      );
    }

    for (const acc of accounts) {
      await prisma.adAccount.upsert({
        where: {
          workspaceId_platform_accountId: {
            workspaceId: workspace.id,
            platform: "LINKEDIN",
            accountId: acc.id,
          },
        },
        create: {
          workspaceId: workspace.id,
          platform: "LINKEDIN",
          accountId: acc.id,
          accountName: acc.name,
          accessToken: encryptedAccess,
          refreshToken: encryptedRefresh,
          isActive: acc.status === "ACTIVE",
        },
        update: {
          accountName: acc.name,
          accessToken: encryptedAccess,
          ...(encryptedRefresh ? { refreshToken: encryptedRefresh } : {}),
          isActive: acc.status === "ACTIVE",
        },
      });
    }

    return res.redirect(successUrl);
  } catch (err) {
    console.error("[linkedin/callback] error:", err);
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
          platform: "LINKEDIN",
        },
      });
      if (!adAccount) {
        return res
          .status(404)
          .json({ error: "LinkedIn ad account not found" });
      }
      const result = await syncService.syncLinkedInAccount(adAccount);
      res.json({ success: true, ...result });
    } catch (err) {
      next(err);
    }
  }
);

export default router;
