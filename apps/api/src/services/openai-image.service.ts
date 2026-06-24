/**
 * OpenAI Image Service — wraps the GPT Image 1 Mini endpoints at
 * https://api.openai.com/v1/images/generations (text-to-image) and
 * /v1/images/edits (image-guided, when a reference product image is sent).
 *
 * Why GPT Image 1 Mini (and why we swapped off Gemini):
 *   - Gemini Flash Image's "free tier" was geo-gated to limit:0 for our
 *     region (Pakistan). Burned a day diagnosing before finding the wall.
 *   - GPT Image 1 Mini at Low quality is $0.005/image — cheapest in the
 *     OpenAI catalog and the cheapest pay-as-you-go option from any major
 *     provider. 1,000 images = $5; a full beta month ≈ $2.50.
 *   - Same API shape as DALL-E (which most engineers already know), no SDK
 *     dependency — native fetch keeps us consistent with ai.service.ts
 *     and the rest of the codebase.
 *
 * Returns a base64 buffer — the caller forwards it to Meta's /adimages
 * endpoint via metaService.uploadImageFromBytes so the resulting creative
 * is publish-ready (no second upload at campaign launch time).
 */

import sharp from "sharp";

const OPENAI_BASE = "https://api.openai.com/v1";
const MODEL = "gpt-image-1-mini";
// Hardcoded to Low for now. Tradeoffs:
//   - Low ($0.005, 1024²) is plenty for beta + early production ads.
//   - Medium ($0.011) is noticeably sharper but 2.2× the price.
//   - High ($0.052) is overkill for ad creatives where the image is
//     decoration around copy, not the hero.
// We'll surface a quality knob in the UI once paid customers ask for it.
const QUALITY = "low";

type AspectRatio = "square" | "portrait" | "landscape";

/**
 * Map our internal aspect-ratio enum to OpenAI's accepted `size` values.
 * GPT Image 1 family supports exactly three sizes — picking anything else
 * yields a 400 from the API.
 */
function sizeForAspect(aspect: AspectRatio): "1024x1024" | "1024x1536" | "1536x1024" {
  switch (aspect) {
    case "portrait":
      return "1024x1536"; // 2:3 — generated, then center-cropped to 9:16
    case "landscape":
      return "1536x1024"; // 3:2 — generated, then center-cropped to 16:9
    case "square":
    default:
      return "1024x1024"; // 1:1 — Feed (no crop)
  }
}

/**
 * The TRUE target ratio we deliver per aspect. OpenAI only outputs 1:1,
 * 2:3, 3:2 — but ad placements want 1:1 (Feed), 9:16 (Reels/Stories),
 * and 16:9 (Video/Display). So we generate the nearest size above, then
 * center-crop to these exact ratios (`[width, height]`).
 *
 *   portrait  2:3 (0.667) → 9:16 (0.5625): trims ~80px off each side
 *   landscape 3:2 (1.5)   → 16:9 (1.778):  trims ~80px off top & bottom
 *
 * The crop is small (~10%) and centered, so faces (usually centered
 * horizontally, heads near the top) stay intact.
 */
function targetRatioForAspect(aspect: AspectRatio): [number, number] {
  switch (aspect) {
    case "portrait":
      return [9, 16];
    case "landscape":
      return [16, 9];
    case "square":
    default:
      return [1, 1];
  }
}

/**
 * Center-crop a PNG buffer to an exact width:height ratio. Returns the
 * input untouched if it's already at the target ratio (square path) or if
 * metadata can't be read. Keeps full resolution — we crop, never downscale.
 */
async function cropToRatio(
  buffer: Buffer,
  ratioW: number,
  ratioH: number
): Promise<Buffer> {
  const target = ratioW / ratioH;
  const meta = await sharp(buffer).metadata();
  const W = meta.width;
  const H = meta.height;
  if (!W || !H) return buffer;
  const current = W / H;
  // Within 0.5% of target already → nothing to do (square case).
  if (Math.abs(current - target) < 0.005) return buffer;

  let cropW: number;
  let cropH: number;
  if (current > target) {
    // Too wide → trim width, keep full height.
    cropH = H;
    cropW = Math.round(H * target);
  } else {
    // Too tall → trim height, keep full width.
    cropW = W;
    cropH = Math.round(W / target);
  }
  const left = Math.max(0, Math.round((W - cropW) / 2));
  const top = Math.max(0, Math.round((H - cropH) / 2));
  return sharp(buffer)
    .extract({ left, top, width: cropW, height: cropH })
    .png()
    .toBuffer();
}

type OpenAIImageResponse = {
  data?: Array<{
    b64_json?: string;
    revised_prompt?: string;
  }>;
  error?: {
    message?: string;
    type?: string;
    code?: string;
  };
};

export type GeneratedImage = {
  mimeType: string;
  base64: string;
  buffer: Buffer;
};

class OpenAIImageService {
  /**
   * Build the image prompt from the campaign brief + per-card text. We
   * spell out anti-text rules explicitly because Meta rejects ad images
   * with typography overlays, and OpenAI's default outputs sometimes
   * include them.
   *
   * Note: unlike Gemini, OpenAI sets the aspect ratio via the API `size`
   * parameter — we don't need to mention it in the prompt text. Cleaner
   * separation, fewer ways the model can ignore us.
   */
  buildAdImagePrompt(args: {
    brief?: string;
    headline?: string;
    description?: string;
    /** True when the caller is sending a reference product image to the
     *  /images/edits endpoint. Switches the prompt from "generate a scene"
     *  to "feature THIS product as the hero" so the model treats the
     *  attached image as the subject, not loose inspiration. */
    hasReference?: boolean;
  }): string {
    const parts: string[] = args.hasReference
      ? [
          "A reference product image is provided. Feature that exact product as the hero subject of a social media ad — preserve its shape, colour, label, text and proportions faithfully — and build a clean, professional commercial scene around it.",
        ]
      : ["Generate a clean, professional ad image for a social media ad."];
    if (args.brief?.trim()) {
      parts.push(`Brand & campaign context: ${args.brief.trim()}`);
    }
    if (args.headline?.trim()) {
      parts.push(`The ad's message: "${args.headline.trim()}"`);
    }
    if (args.description?.trim()) {
      parts.push(`Supporting detail: ${args.description.trim()}`);
    }
    parts.push(
      [
        "Style requirements:",
        "- Photorealistic commercial photography or polished illustration",
        "- Eye-catching, conversion-focused, brand-appropriate",
        "- DO NOT include any text, captions, logos, or typography in the image — copy is overlaid separately by Meta at delivery time",
        "- Bright, high-contrast, visually distinct from other ads in the feed",
      ].join("\n")
    );
    return parts.join("\n\n");
  }

  /**
   * Generate a single image from a text prompt. Returns base64 + a Buffer
   * so the caller can either persist it or forward it to Meta directly.
   *
   * Throws:
   *   - "OPENAI_NO_KEY" — env var missing/empty
   *   - "OPENAI_BLOCKED" — prompt or response hit a content filter
   *   - "OPENAI_API_ERROR" — network / non-2xx response (status + body
   *      logged to the server console for diagnosis)
   *   - "OPENAI_NO_IMAGE" — request succeeded but no image part returned
   */
  async generateImage(
    prompt: string,
    aspect: AspectRatio = "square",
    reference?: { buffer: Buffer; mimeType: string }
  ): Promise<GeneratedImage> {
    // Resolve the API key BEFORE the fetch try/catch — otherwise a
    // missing-key error gets rebranded as "OPENAI_API_ERROR" and the
    // operator has no idea their env var isn't set.
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error("OPENAI_NO_KEY");
    }

    const size = sizeForAspect(aspect);
    let response: Response;
    try {
      if (reference) {
        // Image-guided generation: the /images/edits endpoint takes the
        // reference as a multipart file alongside the prompt. We let fetch
        // set the multipart boundary (don't add a content-type header).
        // NB: gpt-image-1-mini does NOT support `input_fidelity` — sending
        // it returns a 400, so the product is guided, not pixel-perfect.
        const form = new FormData();
        form.append("model", MODEL);
        form.append("prompt", prompt);
        form.append("n", "1");
        form.append("size", size);
        form.append("quality", QUALITY);
        form.append("output_format", "png");
        form.append(
          "image",
          new Blob([reference.buffer], { type: reference.mimeType }),
          "reference.png"
        );
        response = await fetch(`${OPENAI_BASE}/images/edits`, {
          method: "POST",
          headers: { authorization: `Bearer ${apiKey}` },
          body: form,
        });
      } else {
        response = await fetch(`${OPENAI_BASE}/images/generations`, {
          method: "POST",
          headers: {
            "content-type": "application/json",
            authorization: `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            model: MODEL,
            prompt,
            n: 1,
            size,
            quality: QUALITY,
            // gpt-image-1 family always returns base64; this field is the
            // explicit name for that behavior. Setting it makes the contract
            // obvious to anyone reading the call.
            output_format: "png",
          }),
        });
      }
    } catch (err) {
      const reason = err instanceof Error ? err.message : "network error";
      console.error("[openai-image] network error:", reason);
      throw new Error("OPENAI_API_ERROR");
    }

    if (!response.ok) {
      const body = await response.text().catch(() => "");
      console.error(
        "[openai-image] non-2xx",
        response.status,
        body.slice(0, 500)
      );
      // OpenAI returns a 400 with code="content_policy_violation" when a
      // prompt trips their content filter — surface that distinctly so
      // the route can show a friendly toast.
      if (body.includes("content_policy_violation")) {
        throw new Error("OPENAI_BLOCKED");
      }
      throw new Error("OPENAI_API_ERROR");
    }

    let data: OpenAIImageResponse;
    try {
      data = (await response.json()) as OpenAIImageResponse;
    } catch {
      throw new Error("OPENAI_API_ERROR");
    }

    const b64 = data.data?.[0]?.b64_json;
    if (!b64) {
      console.error(
        "[openai-image] no image in response:",
        JSON.stringify(data).slice(0, 500)
      );
      throw new Error("OPENAI_NO_IMAGE");
    }

    // Center-crop to the true placement ratio (9:16 / 16:9 / 1:1). OpenAI
    // can't produce 9:16 or 16:9 directly, so we crop the 2:3 / 3:2 output
    // down to the exact ratio the ad placement expects.
    const rawBuffer = Buffer.from(b64, "base64");
    const [rw, rh] = targetRatioForAspect(aspect);
    let buffer: Buffer = rawBuffer;
    try {
      buffer = await cropToRatio(rawBuffer, rw, rh);
    } catch (err) {
      // If the crop fails for any reason, fall back to the uncropped image
      // rather than failing the whole generation — a slightly-off ratio is
      // better than no image.
      console.error("[openai-image] crop failed, using uncropped:", err);
      buffer = rawBuffer;
    }
    const outBase64 = buffer === rawBuffer ? b64 : buffer.toString("base64");
    return { base64: outBase64, mimeType: "image/png", buffer };
  }
}

export const openaiImageService = new OpenAIImageService();
