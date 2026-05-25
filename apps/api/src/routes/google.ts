import { Router, type Request, type Response, type NextFunction } from "express";
import { requireAuth } from "../middleware/auth";
import { prisma } from "../lib/prisma";
import { encryptToken, decryptToken } from "../lib/crypto";
import { getUserWorkspace, requireWorkspace } from "../lib/workspace";
import { googleService } from "../services/google.service";
import { syncService } from "../services/sync.service";

const router = Router();

const FRONTEND_URL =
  process.env.FRONTEND_URL ??
  process.env.WEB_ORIGIN ??
  "http://localhost:3000";

/* ────────────────────────────────────────── */
/* GET /google/oauth-url   (auth required)    */
/* ────────────────────────────────────────── */

router.get(
  "/oauth-url",
  requireAuth,
  (req: Request, res: Response, next: NextFunction) => {
    try {
      // SECURITY TODO: same as Meta — replace `state = dbUserId` with a
      // short-lived random nonce persisted server-side and validated on
      // callback, so an attacker can't forge state to attach a Google
      // account to someone else's workspace.
      const url = googleService.getOAuthUrl(req.dbUserId!);
      res.json({ url });
    } catch (err) {
      next(err);
    }
  }
);

/* ────────────────────────────────────────── */
/* GET /google/callback   (NO auth)           */
/* Google redirects the user's browser here   */
/* ────────────────────────────────────────── */

router.get("/callback", async (req: Request, res: Response) => {
  const successUrl = `${FRONTEND_URL}/connect/done?connected=google`;
  const failureUrl = `${FRONTEND_URL}/connect/done?error=google_failed`;
  try {
    const { code, state, error: oauthError } = req.query;

    if (typeof oauthError === "string" && oauthError) {
      return res.redirect(`${FRONTEND_URL}/connect/done?error=google_cancelled`);
    }
    if (typeof code !== "string" || !code) {
      return res.redirect(failureUrl);
    }
    if (typeof state !== "string" || !state.trim()) {
      return res.redirect(failureUrl);
    }

    const user = await prisma.user.findUnique({ where: { id: state } });
    if (!user) {
      return res.redirect(failureUrl);
    }

    const workspace = await getUserWorkspace(user.id);
    if (!workspace) {
      return res.redirect(
        `${FRONTEND_URL}/connect/done?error=google_no_workspace`
      );
    }

    // Exchange code for access + refresh tokens.
    const tokens = await googleService.exchangeCodeForTokens(code);
    if (!tokens.refresh_token) {
      // No refresh token = we won't be able to refresh later. Most likely
      // the user previously consented and Google didn't re-issue one.
      // We force `prompt=consent` in the OAuth URL so this should be rare.
      console.warn("[google/callback] no refresh_token in response");
    }
    const encryptedAccess = encryptToken(tokens.access_token);
    const encryptedRefresh = tokens.refresh_token
      ? encryptToken(tokens.refresh_token)
      : null;

    // Pull accessible customer accounts.
    const customers = await googleService.getCustomerAccounts(
      tokens.access_token
    );
    if (customers.length === 0) {
      return res.redirect(
        `${FRONTEND_URL}/connect/done?error=google_no_customers`
      );
    }

    // Upsert each customer as an AdAccount.
    for (const c of customers) {
      await prisma.adAccount.upsert({
        where: {
          workspaceId_platform_accountId: {
            workspaceId: workspace.id,
            platform: "GOOGLE",
            accountId: c.id,
          },
        },
        create: {
          workspaceId: workspace.id,
          platform: "GOOGLE",
          accountId: c.id,
          accountName: c.name,
          accessToken: encryptedAccess,
          refreshToken: encryptedRefresh,
          isActive: c.status === "ENABLED" || c.status === "UNKNOWN",
        },
        update: {
          accountName: c.name,
          accessToken: encryptedAccess,
          // Only overwrite refresh token if we got a new one — preserves
          // the previously-stored refresh token if Google didn't re-issue.
          ...(encryptedRefresh ? { refreshToken: encryptedRefresh } : {}),
          isActive: c.status === "ENABLED" || c.status === "UNKNOWN",
        },
      });
    }

    return res.redirect(successUrl);
  } catch (err) {
    console.error("[google/callback] error:", err);
    return res.redirect(failureUrl);
  }
});

/* ────────────────────────────────────────── */
/* POST /google/sync/:adAccountId             */
/* ────────────────────────────────────────── */

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
          platform: "GOOGLE",
        },
      });
      if (!adAccount) {
        return res.status(404).json({ error: "Google ad account not found" });
      }
      const result = await syncService.syncGoogleAccount(adAccount);
      res.json({ success: true, ...result });
    } catch (err) {
      next(err);
    }
  }
);

/* ────────────────────────────────────────── */
/* GET /google/customers                      */
/* ────────────────────────────────────────── */

router.get(
  "/customers",
  requireAuth,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const workspace = await requireWorkspace(req.dbUserId!);
      const accounts = await prisma.adAccount.findMany({
        where: { workspaceId: workspace.id, platform: "GOOGLE" },
        select: {
          id: true,
          accountId: true,
          accountName: true,
          isActive: true,
          createdAt: true,
          accessToken: true,
          refreshToken: true,
        },
      });

      const enriched = await Promise.all(
        accounts.map(async (acct) => {
          try {
            const accessToken = decryptToken(acct.accessToken);
            const fresh = await googleService.getCustomerAccounts(accessToken);
            const match = fresh.find((f) => f.id === acct.accountId);
            return {
              id: acct.id,
              accountId: acct.accountId,
              accountName: match?.name ?? acct.accountName,
              currency: match?.currencyCode,
              timezone: match?.timeZone,
              status: match?.status,
              isActive: match
                ? match.status !== "CANCELED" && match.status !== "SUSPENDED"
                : acct.isActive,
              createdAt: acct.createdAt,
              live: match !== undefined,
            };
          } catch {
            return {
              id: acct.id,
              accountId: acct.accountId,
              accountName: acct.accountName,
              isActive: acct.isActive,
              createdAt: acct.createdAt,
              live: false,
            };
          }
        })
      );

      res.json(enriched);
    } catch (err) {
      next(err);
    }
  }
);

export default router;
