import { Router, Request, Response, NextFunction } from "express";
import multer from "multer";
import { aiService } from "../services/ai.service";
import { openaiImageService } from "../services/openai-image.service";
import { metaService } from "../services/meta.service";
import { requireAuth } from "../middleware/auth";
import { requireWorkspace } from "../lib/workspace";
import { prisma } from "../lib/prisma";

const router = Router();

// Optional reference image for AI image generation. In-memory only — the
// bytes are forwarded straight to OpenAI's /images/edits endpoint, never
// persisted. 10MB cap mirrors meta.ts's /upload-image; 1 file per request.
// multer is a no-op for application/json requests, so JSON callers (no
// reference image) are unaffected.
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024, files: 1 },
});

const REFERENCE_IMAGE_TYPES = ["image/png", "image/jpeg", "image/webp"];

const MODEL = "claude-opus-4-8";

/**
 * In-memory rate limiter for AI image generation. Keeps per-workspace
 * tallies of recent successful generations and enforces a sliding hour
 * window. Reset on server restart (acceptable — this is abuse protection,
 * not billing). Move to Redis if we ever care about persistence.
 */
const IMAGE_GEN_PER_HOUR = 20;
const HOUR_MS = 60 * 60 * 1000;
const imageGenTimestamps = new Map<string, number[]>();

function checkImageGenRate(workspaceId: string): {
  ok: boolean;
  resetSeconds?: number;
} {
  const now = Date.now();
  const all = imageGenTimestamps.get(workspaceId) ?? [];
  const recent = all.filter((t) => now - t < HOUR_MS);
  if (recent.length >= IMAGE_GEN_PER_HOUR) {
    const oldest = recent[0];
    return {
      ok: false,
      resetSeconds: Math.ceil((oldest + HOUR_MS - now) / 1000),
    };
  }
  return { ok: true };
}

function recordImageGen(workspaceId: string): void {
  const now = Date.now();
  const all = imageGenTimestamps.get(workspaceId) ?? [];
  const recent = all.filter((t) => now - t < HOUR_MS);
  recent.push(now);
  imageGenTimestamps.set(workspaceId, recent);
}

router.get("/health", (_req: Request, res: Response) => {
  res.json({ status: "ok", model: MODEL });
});

router.post("/plan-campaign", async (req: Request, res: Response) => {
  const { prompt } = req.body ?? {};

  if (typeof prompt !== "string" || prompt.trim().length < 10) {
    return res.status(400).json({
      error: "Prompt must be at least 10 characters.",
    });
  }
  if (prompt.length > 1000) {
    return res.status(400).json({
      error: "Prompt must be at most 1000 characters.",
    });
  }

  try {
    const { json, tokensUsed } = await aiService.planCampaign(prompt);
    const plan = JSON.parse(json);
    return res.json({ success: true, plan, tokensUsed });
  } catch (err) {
    const code = err instanceof Error ? err.message : "AI_API_ERROR";
    if (code === "AI_PARSE_ERROR") {
      return res.status(500).json({
        error:
          "AI returned an unexpected response. Try rephrasing your prompt.",
      });
    }
    return res.status(500).json({
      error: "AI service is temporarily unavailable. Please try again.",
    });
  }
});

router.post("/generate-copy", async (req: Request, res: Response) => {
  const { brief, platform, objective, kind, cardCount } = req.body ?? {};

  if (typeof brief !== "string" || brief.trim().length < 10) {
    return res.status(400).json({
      error: "Brief must be at least 10 characters.",
    });
  }
  if (typeof platform !== "string" || !platform.trim()) {
    return res.status(400).json({ error: "Platform is required." });
  }
  if (typeof objective !== "string" || !objective.trim()) {
    return res.status(400).json({ error: "Objective is required." });
  }
  // Carousel-specific validation. We default to 4 cards when carousel kind
  // is requested without an explicit count — that's the sweet spot for
  // narrative flow + completion rate per Meta's own carousel best
  // practices. Cap at 5 here (Meta supports up to 10 but more cards =
  // longer prompts = worse copy quality from the LLM in practice).
  const isCarousel = kind === "carousel";
  let resolvedCardCount = 4;
  if (isCarousel) {
    if (typeof cardCount === "number") {
      if (cardCount < 2 || cardCount > 5) {
        return res
          .status(400)
          .json({ error: "cardCount must be between 2 and 5" });
      }
      resolvedCardCount = Math.round(cardCount);
    }
  }

  try {
    const { json, tokensUsed } = isCarousel
      ? await aiService.generateCarouselCopy(
          brief,
          platform,
          objective,
          resolvedCardCount
        )
      : await aiService.generateCreativeCopy(brief, platform, objective);
    const copy = JSON.parse(json);
    return res.json({ success: true, copy, tokensUsed });
  } catch (err) {
    const code = err instanceof Error ? err.message : "AI_API_ERROR";
    if (code === "AI_PARSE_ERROR") {
      return res.status(500).json({
        error: "AI returned malformed copy. Please try again.",
      });
    }
    return res.status(500).json({
      error: "AI service is temporarily unavailable. Please try again.",
    });
  }
});

/**
 * POST /ai/generate-image — generate an ad image with Gemini, then upload
 * it straight to Meta's /adimages so the caller gets back a ready-to-use
 * `{ url, hash }` (the same shape /meta/upload-image returns).
 *
 * Body: `{ brief?, headline?, description? }` — the brief is the campaign
 * brief used in copy generation; headline/description are the per-card
 * text. We assemble the image prompt server-side via
 * geminiService.buildAdImagePrompt so the frontend doesn't need to know
 * Gemini's prompt conventions.
 *
 * Rate-limited per workspace (20/hour) to protect the shared free-tier
 * Gemini quota.
 */
router.post(
  "/generate-image",
  requireAuth,
  upload.single("image"),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const workspace = await requireWorkspace(req.dbUserId!);

      // Optional reference image (multipart `image` field). When present we
      // switch OpenAI to the image-guided /images/edits endpoint. Validate
      // the type up front — multer already enforces the 10MB size cap.
      const refFile = req.file;
      if (refFile && !REFERENCE_IMAGE_TYPES.includes(refFile.mimetype)) {
        return res.status(400).json({
          error: "Reference image must be PNG, JPEG, or WebP.",
        });
      }
      const rate = checkImageGenRate(workspace.id);
      if (!rate.ok) {
        return res.status(429).json({
          error: `Rate limit reached — ${IMAGE_GEN_PER_HOUR} AI image generations per hour. Try again in ${rate.resetSeconds}s.`,
        });
      }

      const { brief, headline, description, aspect } = (req.body ?? {}) as {
        brief?: unknown;
        headline?: unknown;
        description?: unknown;
        aspect?: unknown;
      };
      const hasAnyText =
        (typeof brief === "string" && brief.trim().length > 0) ||
        (typeof headline === "string" && headline.trim().length > 0) ||
        (typeof description === "string" && description.trim().length > 0);
      if (!hasAnyText) {
        return res.status(400).json({
          error: "Need at least a brief, headline, or description to generate from",
        });
      }
      const normalizedAspect: "square" | "portrait" | "landscape" =
        aspect === "portrait" || aspect === "landscape" ? aspect : "square";

      // Resolve the workspace's active Meta ad account — required so we
      // can upload the generated image straight to /adimages (account-
      // scoped). If the user hasn't connected Meta yet, we still generate
      // the image but return the raw bytes; the frontend handles that
      // case by saving as a base64 thumbnail (rare path; Meta upload is
      // the happy path).
      const adAccount = await prisma.adAccount.findFirst({
        where: {
          workspaceId: workspace.id,
          platform: "META",
          isActive: true,
        },
        orderBy: { createdAt: "desc" },
      });
      if (!adAccount) {
        return res.status(400).json({
          error:
            "Connect a Meta ad account first (Settings → Integrations) — AI image generation uploads to Meta to skip a re-upload at publish time",
        });
      }

      // Build the prompt — OpenAI doesn't need aspect in the text (we set
      // it via the API `size` param below), but we keep the prompt builder
      // generic so it stays useful if we ever add another provider.
      const prompt = openaiImageService.buildAdImagePrompt({
        brief: typeof brief === "string" ? brief : undefined,
        headline: typeof headline === "string" ? headline : undefined,
        description:
          typeof description === "string" ? description : undefined,
        hasReference: Boolean(refFile),
      });

      let generated;
      try {
        generated = await openaiImageService.generateImage(
          prompt,
          normalizedAspect,
          refFile
            ? { buffer: refFile.buffer, mimeType: refFile.mimetype }
            : undefined
        );
      } catch (err) {
        const code = err instanceof Error ? err.message : "OPENAI_API_ERROR";
        if (code === "OPENAI_NO_KEY") {
          // Operator hasn't set OPENAI_API_KEY. 503 (server config issue,
          // not the user's fault). The message tells them exactly what
          // to do — saves a round-trip into the logs.
          return res.status(503).json({
            error:
              "AI image generation isn't configured on this server (OPENAI_API_KEY missing). Add the key to apps/api/.env and restart.",
          });
        }
        if (code === "OPENAI_BLOCKED") {
          return res.status(422).json({
            error:
              "The image prompt was blocked by OpenAI's content filter. Try softer wording.",
          });
        }
        if (code === "OPENAI_NO_IMAGE") {
          return res.status(502).json({
            error:
              "OpenAI returned no image. Try regenerating, or rephrase the brief.",
          });
        }
        return res.status(502).json({
          error: "AI image service is temporarily unavailable. Try again.",
        });
      }

      // Forward to Meta /adimages — same flow as a device upload but with
      // bytes that came from Gemini instead of a multipart form.
      const token = metaService.decryptToken(adAccount.accessToken);
      const result = await metaService.uploadImageFromBytes(
        token,
        adAccount.accountId,
        generated.buffer,
        `ai-generated-${Date.now()}.png`,
        generated.mimeType
      );

      // Only count generation against the workspace's rate limit AFTER
      // the full flow (Gemini + Meta upload) succeeds. A safety-filter
      // block or a Meta upload failure shouldn't burn a slot.
      recordImageGen(workspace.id);

      // Return a base64 data URL for the PREVIEW alongside the Meta
      // {url, hash}. Meta's /adimages `url` is a short-lived,
      // referrer-protected scontent.fbcdn.net CDN link that frequently
      // won't render in an <img> tag — so the UI shows the data URL
      // (guaranteed to load, it's the bytes we just generated) while
      // `hash` is what actually gets attached to the ad creative at
      // publish time.
      return res.json({
        url: result.url,
        hash: result.hash,
        dataUrl: `data:${generated.mimeType};base64,${generated.base64}`,
      });
    } catch (err) {
      next(err);
    }
  }
);

export default router;
