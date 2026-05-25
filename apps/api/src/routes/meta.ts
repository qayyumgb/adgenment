import { Router, type Request, type Response, type NextFunction } from "express";
import { requireAuth } from "../middleware/auth";
import { prisma } from "../lib/prisma";
import { getUserWorkspace, requireWorkspace } from "../lib/workspace";
import { metaService } from "../services/meta.service";
import { syncService } from "../services/sync.service";

const router = Router();

const FRONTEND_URL =
  process.env.FRONTEND_URL ??
  process.env.WEB_ORIGIN ??
  "http://localhost:3000";

/* ────────────────────────────────────────── */
/* GET /meta/oauth-url   (auth required)      */
/* ────────────────────────────────────────── */

router.get(
  "/oauth-url",
  requireAuth,
  (req: Request, res: Response, next: NextFunction) => {
    try {
      // SECURITY TODO: replace `state = dbUserId` with a short-lived random nonce
      // persisted server-side and validated in the callback. Today an attacker
      // could craft an OAuth URL with `state = <victimUserId>` and trick the
      // victim into adding their Meta account to the victim's workspace.
      const url = metaService.getOAuthUrl(req.dbUserId!);
      res.json({ url });
    } catch (err) {
      next(err);
    }
  }
);

/* ────────────────────────────────────────── */
/* GET /meta/callback   (NO auth)             */
/* Meta redirects the user's browser here     */
/* ────────────────────────────────────────── */

router.get("/callback", async (req: Request, res: Response) => {
  const successUrl = `${FRONTEND_URL}/connect/done?connected=meta`;
  const failureUrl = `${FRONTEND_URL}/connect/done?error=meta_failed`;
  try {
    const { code, state, error: oauthError } = req.query;

    if (typeof oauthError === "string" && oauthError) {
      // User clicked "Cancel" on Facebook
      return res.redirect(`${FRONTEND_URL}/connect/done?error=meta_cancelled`);
    }

    if (typeof code !== "string" || !code) {
      return res.redirect(failureUrl);
    }
    if (typeof state !== "string" || !state.trim()) {
      return res.redirect(failureUrl);
    }

    // Validate state → must be a real user in our DB.
    const user = await prisma.user.findUnique({ where: { id: state } });
    if (!user) {
      return res.redirect(failureUrl);
    }

    // Workspaces are auto-created in requireAuth on first request, so any
    // valid user will have one — but stay defensive in case this codepath
    // runs before they've hit any authenticated route.
    const workspace = await getUserWorkspace(user.id);
    if (!workspace) {
      return res.redirect(`${FRONTEND_URL}/connect/done?error=meta_no_workspace`);
    }

    // Exchange code → short-lived → long-lived token.
    const short = await metaService.exchangeCodeForToken(code);
    const long = await metaService.getLongLivedToken(short.accessToken);
    const encryptedToken = metaService.encryptToken(long.accessToken);

    // Pull ad accounts and upsert each.
    const accounts = await metaService.getAdAccounts(long.accessToken);
    for (const acct of accounts) {
      const rawId = acct.id.startsWith("act_")
        ? acct.id.slice("act_".length)
        : acct.id;
      await prisma.adAccount.upsert({
        where: {
          workspaceId_platform_accountId: {
            workspaceId: workspace.id,
            platform: "META",
            accountId: rawId,
          },
        },
        create: {
          workspaceId: workspace.id,
          platform: "META",
          accountId: rawId,
          accountName: acct.name,
          accessToken: encryptedToken,
          isActive: acct.accountStatus === 1,
        },
        update: {
          accountName: acct.name,
          accessToken: encryptedToken,
          isActive: acct.accountStatus === 1,
        },
      });
    }

    return res.redirect(successUrl);
  } catch (err) {
    console.error("[meta/callback] error:", err);
    return res.redirect(failureUrl);
  }
});

/* ────────────────────────────────────────── */
/* POST /meta/sync/:adAccountId               */
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
          platform: "META",
        },
      });
      if (!adAccount) {
        return res.status(404).json({ error: "Meta ad account not found" });
      }

      const result = await syncService.syncMetaAccount(adAccount);
      res.json({ success: true, ...result });
    } catch (err) {
      next(err);
    }
  }
);

/* ────────────────────────────────────────── */
/* GET /meta/ad-accounts                      */
/* ────────────────────────────────────────── */

router.get(
  "/ad-accounts",
  requireAuth,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const workspace = await requireWorkspace(req.dbUserId!);
      const accounts = await prisma.adAccount.findMany({
        where: { workspaceId: workspace.id, platform: "META" },
        select: {
          id: true,
          accountId: true,
          accountName: true,
          isActive: true,
          createdAt: true,
          accessToken: true,
        },
      });

      // Enrich with fresh data from Meta — best-effort.
      const enriched = await Promise.all(
        accounts.map(async (acct) => {
          try {
            const token = metaService.decryptToken(acct.accessToken);
            const fresh = await metaService.getAdAccounts(token);
            const match = fresh.find((f) => {
              const raw = f.id.startsWith("act_")
                ? f.id.slice("act_".length)
                : f.id;
              return raw === acct.accountId;
            });
            return {
              id: acct.id,
              accountId: acct.accountId,
              accountName: match?.name ?? acct.accountName,
              currency: match?.currency,
              timezone: match?.timezone,
              isActive: match
                ? match.accountStatus === 1
                : acct.isActive,
              createdAt: acct.createdAt,
              live: match !== undefined,
            };
          } catch {
            // Token expired or revoked — return cached info + flag stale.
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
