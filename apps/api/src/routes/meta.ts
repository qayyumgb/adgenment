import { Router, type Request, type Response, type NextFunction } from "express";
import multer from "multer";
import { requireAuth } from "../middleware/auth";
import { prisma } from "../lib/prisma";
import { getUserWorkspace, requireWorkspace } from "../lib/workspace";
import { metaService } from "../services/meta.service";
import { syncService } from "../services/sync.service";

const router = Router();

// In-memory file upload for the publish wizard's image step. We forward the
// bytes straight to Meta's /adimages endpoint — never persist on our side.
// 10MB cap matches Meta's own upload limit; 1 file per request.
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024, files: 1 },
});

// Separate multer for /upload-video. Meta accepts videos up to 4GB but
// holding 4GB in process memory is a hard no — we cap at 200MB which covers
// the vast majority of social-format videos (≤ 90sec, ≤ 4K). If users hit
// the cap, they can host the file themselves and use the URL-paste path.
const uploadVideo = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 200 * 1024 * 1024, files: 1 },
});

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
          currency: acct.currency || null,
          timezone: acct.timezone || null,
          accessToken: encryptedToken,
          isActive: acct.accountStatus === 1,
        },
        update: {
          accountName: acct.name,
          currency: acct.currency || null,
          timezone: acct.timezone || null,
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

/**
 * POST /meta/sync — re-sync ALL active Meta ad accounts in the workspace.
 * Convenience for the "Sync now" button so the frontend doesn't need to know
 * an account id. Returns aggregate counts.
 */
router.post(
  "/sync",
  requireAuth,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const workspace = await requireWorkspace(req.dbUserId!);
      const active = await prisma.adAccount.findMany({
        where: { workspaceId: workspace.id, platform: "META", isActive: true },
      });
      if (active.length === 0) {
        return res
          .status(400)
          .json({ error: "Connect a Meta ad account first (Settings → Integrations)." });
      }
      let campaignsSynced = 0;
      let metricsSynced = 0;
      for (const acct of active) {
        const r = await syncService.syncMetaAccount(acct);
        campaignsSynced += r.campaignsSynced;
        metricsSynced += r.metricsSynced;
      }
      res.json({ success: true, accounts: active.length, campaignsSynced, metricsSynced });
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

/* ────────────────────────────────────────── */
/* Phase 1A — Publish-wizard discovery        */
/* ────────────────────────────────────────── */

/**
 * Find the workspace's connected Meta ad account + decrypt its token.
 * Most publish-wizard helpers share this lookup.
 */
async function resolveMetaContext(
  req: Request
): Promise<{ token: string; accountId: string; workspaceId: string } | { error: string; status: number }> {
  const workspace = await requireWorkspace(req.dbUserId!);
  const account = await prisma.adAccount.findFirst({
    where: { workspaceId: workspace.id, platform: "META", isActive: true },
    orderBy: { createdAt: "desc" },
  });
  if (!account) {
    return { error: "No active Meta ad account connected", status: 404 };
  }
  return {
    token: metaService.decryptToken(account.accessToken),
    accountId: account.accountId,
    workspaceId: workspace.id,
  };
}

/**
 * GET /meta/pages — Facebook Pages the user manages with ADVERTISE permission.
 * Required for the publish wizard's "sender" step.
 */
router.get(
  "/pages",
  requireAuth,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const ctx = await resolveMetaContext(req);
      if ("error" in ctx) return res.status(ctx.status).json({ error: ctx.error });
      const pages = await metaService.getPages(ctx.token);
      res.json(pages);
    } catch (err) {
      next(err);
    }
  }
);

/**
 * GET /meta/custom-audiences — both regular custom audiences AND lookalikes.
 * Lookalikes have `isLookalike: true` flagged for the UI.
 */
router.get(
  "/custom-audiences",
  requireAuth,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const ctx = await resolveMetaContext(req);
      if ("error" in ctx) return res.status(ctx.status).json({ error: ctx.error });
      const audiences = await metaService.getCustomAudiences(
        ctx.token,
        ctx.accountId
      );
      res.json(audiences);
    } catch (err) {
      next(err);
    }
  }
);

/**
 * GET /meta/saved-audiences — older audience-template feature.
 */
router.get(
  "/saved-audiences",
  requireAuth,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const ctx = await resolveMetaContext(req);
      if ("error" in ctx) return res.status(ctx.status).json({ error: ctx.error });
      const audiences = await metaService.getSavedAudiences(
        ctx.token,
        ctx.accountId
      );
      res.json(audiences);
    } catch (err) {
      next(err);
    }
  }
);

/**
 * GET /meta/interests?q=<query> — type-ahead for the audience step.
 */
router.get(
  "/interests",
  requireAuth,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const ctx = await resolveMetaContext(req);
      if ("error" in ctx) return res.status(ctx.status).json({ error: ctx.error });
      const q = String(req.query.q ?? "").trim();
      const results = await metaService.searchInterests(ctx.token, q);
      res.json(results);
    } catch (err) {
      next(err);
    }
  }
);

/**
 * GET /meta/locations?q=<query>&types=city,region,country — type-ahead
 * for the location picker. Default types: city, region, country.
 */
router.get(
  "/locations",
  requireAuth,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const ctx = await resolveMetaContext(req);
      if ("error" in ctx) return res.status(ctx.status).json({ error: ctx.error });
      const q = String(req.query.q ?? "").trim();
      const allowed = ["country", "region", "city", "zip"] as const;
      const requested = String(req.query.types ?? "city,region,country")
        .split(",")
        .map((t) => t.trim().toLowerCase())
        .filter((t): t is (typeof allowed)[number] =>
          (allowed as readonly string[]).includes(t)
        );
      const results = await metaService.searchLocations(
        ctx.token,
        q,
        requested.length > 0 ? requested : ["city", "region", "country"]
      );
      res.json(results);
    } catch (err) {
      next(err);
    }
  }
);

/**
 * POST /meta/lookalike — create a new lookalike audience from an existing
 * seed (custom audience). Meta runs the population async — the new audience
 * will be `ready: false` for several minutes/hours after creation.
 */
router.post(
  "/lookalike",
  requireAuth,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const ctx = await resolveMetaContext(req);
      if ("error" in ctx) return res.status(ctx.status).json({ error: ctx.error });
      const { name, seedAudienceId, countryCode, ratio } = req.body ?? {};
      if (typeof name !== "string" || !name.trim()) {
        return res.status(400).json({ error: "name is required" });
      }
      if (typeof seedAudienceId !== "string" || !seedAudienceId.trim()) {
        return res.status(400).json({ error: "seedAudienceId is required" });
      }
      if (typeof countryCode !== "string" || countryCode.length !== 2) {
        return res
          .status(400)
          .json({ error: "countryCode must be a 2-letter ISO code (e.g. US)" });
      }
      const ratioNum =
        typeof ratio === "number" && ratio >= 1 && ratio <= 10 ? ratio : 1;
      const created = await metaService.createLookalikeAudience(
        ctx.token,
        ctx.accountId,
        { name: name.trim(), seedAudienceId, countryCode, ratio: ratioNum }
      );
      res.status(201).json(created);
    } catch (err) {
      next(err);
    }
  }
);

/**
 * POST /meta/upload-image — multipart upload from the publish wizard.
 *
 * Body: multipart/form-data with field `image` containing the file.
 * Returns: `{ hash, url }` — the Meta `image_hash` to use in the publish
 * payload + the Meta-hosted URL (useful for previews).
 *
 * Note: the workspace's first active Meta ad account is the upload target.
 * Meta keys images per ad account, so the hash is only valid for that account.
 */
router.post(
  "/upload-image",
  requireAuth,
  upload.single("image"),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const ctx = await resolveMetaContext(req);
      if ("error" in ctx) return res.status(ctx.status).json({ error: ctx.error });
      const file = req.file;
      if (!file) {
        return res.status(400).json({ error: "No image file uploaded (field name must be 'image')" });
      }
      if (!file.mimetype.startsWith("image/")) {
        return res.status(400).json({ error: "Uploaded file must be an image" });
      }
      const result = await metaService.uploadImageFromBytes(
        ctx.token,
        ctx.accountId,
        file.buffer,
        file.originalname || "upload.jpg",
        file.mimetype
      );
      res.json(result);
    } catch (err) {
      next(err);
    }
  }
);

/**
 * POST /meta/upload-video — multipart upload of a video for use in a video ad.
 *
 * Body: multipart/form-data with field `video` containing the file.
 * Returns: `{ id }` — Meta's `video_id`, used in `object_story_spec.video_data`.
 *
 * Important: Meta transcodes videos asynchronously. The returned id is NOT
 * immediately usable in an ad — the client must poll `/meta/video-status/:id`
 * until status is "ready" before publishing.
 */
router.post(
  "/upload-video",
  requireAuth,
  uploadVideo.single("video"),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const ctx = await resolveMetaContext(req);
      if ("error" in ctx) return res.status(ctx.status).json({ error: ctx.error });
      const file = req.file;
      if (!file) {
        return res
          .status(400)
          .json({ error: "No video file uploaded (field name must be 'video')" });
      }
      if (!file.mimetype.startsWith("video/")) {
        return res.status(400).json({ error: "Uploaded file must be a video" });
      }
      const result = await metaService.uploadVideoFromBytes(
        ctx.token,
        ctx.accountId,
        file.buffer,
        file.originalname || "upload.mp4",
        file.mimetype
      );
      res.json(result);
    } catch (err) {
      next(err);
    }
  }
);

/**
 * GET /meta/video-status/:videoId — poll a video's transcode status.
 *
 * Returns `{ status, thumbnailUrl }`:
 *   - status: "processing" | "ready" | "error" | null (Meta hasn't populated yet)
 *   - thumbnailUrl: Meta's auto-generated poster, available once ready
 *
 * Clients should poll every 2–3 seconds with a hard timeout (~5 min) — short
 * clips usually transcode in 10-30s, but Meta can take minutes for 4K/HEVC.
 */
router.get(
  "/video-status/:videoId",
  requireAuth,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const ctx = await resolveMetaContext(req);
      if ("error" in ctx) return res.status(ctx.status).json({ error: ctx.error });
      const { videoId } = req.params;
      if (!videoId || !/^\d+$/.test(videoId)) {
        return res.status(400).json({ error: "Invalid video id" });
      }
      const result = await metaService.getVideoStatus(ctx.token, videoId);
      res.json(result);
    } catch (err) {
      next(err);
    }
  }
);

/**
 * GET /meta/video-source/:videoId — fetch a playable MP4 URL for a video.
 *
 * Used by the in-app preview to actually play a video uploaded via /advideos
 * (Meta doesn't return a public stream URL at upload time — we have to ask
 * for `source` explicitly, and the signed URL rotates so it can't be cached
 * client-side).
 *
 * Returns `{ source, permalinkUrl }` — either may be null if the video is
 * still transcoding or Meta declines to share the source for this asset.
 */
router.get(
  "/video-source/:videoId",
  requireAuth,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const ctx = await resolveMetaContext(req);
      if ("error" in ctx) return res.status(ctx.status).json({ error: ctx.error });
      const { videoId } = req.params;
      if (!videoId || !/^\d+$/.test(videoId)) {
        return res.status(400).json({ error: "Invalid video id" });
      }
      const result = await metaService.getVideoSource(ctx.token, videoId);
      res.json(result);
    } catch (err) {
      next(err);
    }
  }
);

export default router;
