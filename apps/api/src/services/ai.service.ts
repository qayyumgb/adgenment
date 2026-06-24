/**
 * AI Service — wraps the Anthropic Messages API.
 * Uses native fetch (Node 18+) to keep dependencies minimal.
 */

const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";
const ANTHROPIC_VERSION = "2023-06-01";
// Previous model `claude-sonnet-4-20250514` retired 2026-06-15 → API returns
// an error for it now. Migrated to Opus 4.8, the current most capable model.
// Per-call cost is small (planCampaign ~1500 tok output, generateCreativeCopy
// ~900 tok) so the Sonnet→Opus pricing delta is ~$0.02 per generation.
const MODEL = "claude-opus-4-8";

type AnthropicResponse = {
  id?: string;
  type?: string;
  role?: string;
  content?: Array<{ type: string; text?: string }>;
  model?: string;
  stop_reason?: string;
  usage?: {
    input_tokens: number;
    output_tokens: number;
  };
};

export type AIResult = {
  text: string;
  tokensUsed: number;
};

const PLAN_SYSTEM_PROMPT = `You are Advertix AI, an expert digital advertising strategist with 15 years of experience managing $500M+ in ad spend across Meta, Google, TikTok, LinkedIn, and YouTube.

When given a campaign goal, respond ONLY with a valid JSON object (no markdown, no extra text) in this exact structure:
{
  "strategy": {
    "platform": string[],
    "objective": string,
    "duration_days": number,
    "total_budget": number,
    "currency": "USD",
    "summary": string
  },
  "budget_allocation": [
    { "channel": string, "percentage": number, "amount": number, "rationale": string }
  ],
  "target_audience": {
    "age_range": string,
    "genders": string[],
    "interests": string[],
    "locations": string[],
    "behaviors": string[],
    "estimated_reach": string
  },
  "ad_formats": [
    { "format": string, "count": number, "placement": string, "rationale": string }
  ],
  "expected_results": {
    "primary_metric": string,
    "estimated_min": number,
    "estimated_max": number,
    "estimated_reach_min": number,
    "estimated_reach_max": number,
    "estimated_cpl_min": number,
    "estimated_cpl_max": number,
    "confidence": "low" | "medium" | "high"
  },
  "ai_insights": string[],
  "recommended_campaign_name": string
}
Be realistic, specific, and data-driven. Base estimates on real industry benchmarks.`;

const COPY_SYSTEM_PROMPT = `You are an expert ad copywriter. Return ONLY valid JSON with:
{ "headlines": string[5], "primary_texts": string[3], "descriptions": string[3], "ctas": string[4] }
Headlines max 40 chars. Primary texts max 125 chars. Punchy, conversion-focused.`;

/** Carousel copy prompt. The model writes a coherent N-card story (hook →
 *  build-up → social proof / benefit → CTA), plus the same ad-level body
 *  copy + CTA variants the image/video flow returns. We render the cards
 *  in the editor with empty image dropzones; user uploads one image per
 *  card to complete the creative. */
const CAROUSEL_COPY_SYSTEM_PROMPT = (cardCount: number) =>
  `You are an expert ad copywriter writing a Meta carousel ad with ${cardCount} cards. The cards tell a single narrative arc — typically: card 1 = attention-grabbing hook, middle cards = benefit / proof, last card = direct CTA.

Return ONLY valid JSON in this exact shape:
{
  "primary_texts": string[3],
  "ctas": string[4],
  "cards": [
    { "headline": string, "description": string }
  ]
}

Constraints:
- "cards" MUST have exactly ${cardCount} entries.
- Each card.headline is max 40 chars, punchy, distinct from other cards' headlines.
- Each card.description is max 30 chars (Meta's sub-headline cap on carousels), or omit if not needed.
- "primary_texts" are 3 variants of the SHARED body copy that sits above all cards. Max 125 chars each.
- "ctas" are 4 distinct call-to-action options (free text — e.g. "Shop now", "Learn more"). Pick what fits the brief.
- Coherent across all cards. The story should make sense if a reader swipes through cards 1..${cardCount} in order.
- Conversion-focused, no markdown, no explanations.`;

/** Audience-builder prompt. The model proposes a Meta-shaped targeting
 *  definition from a plain-English description. It returns NAMES (not Meta
 *  IDs) — the route resolves interest/location names to real Meta IDs via the
 *  /search endpoints afterwards. We keep the model's job to "interpret intent
 *  into structured targeting" and leave ID resolution to the platform. */
const AUDIENCE_SYSTEM_PROMPT = `You are a Meta Ads targeting expert. Convert a plain-English audience description into a structured targeting definition.

Return ONLY valid JSON (no markdown, no prose) in this exact shape:
{
  "name": string,                       // a short, descriptive audience name (max 60 chars)
  "type": "INTEREST" | "RETARGETING" | "LOOKALIKE" | "CUSTOM" | "BEHAVIORAL" | "SAVED",
  "age_min": number,                    // 13-65
  "age_max": number,                    // 13-65, >= age_min
  "genders": ("male" | "female")[],     // empty array = all genders
  "geo": {
    "countries": string[],              // country NAMES, e.g. ["United States", "Canada"]
    "cities": string[]                  // city NAMES, e.g. ["New York", "Los Angeles"]
  },
  "interests": string[],                // real Meta interest NAMES, e.g. ["Organic food", "Skincare"]
  "rationale": string                   // one sentence on why this targeting fits
}

Rules:
- Pick interest names that actually exist as Meta ad interests (common, well-known topics).
- 3-8 interests is ideal. Don't invent obscure interests.
- If the description implies retargeting/custom data ("cart abandoners", "past purchasers"), set type accordingly and keep interests minimal.
- Default genders to [] (all) unless the description clearly specifies one.
- If no geography is implied, leave countries/cities empty.`;

class AIService {
  private async callAnthropic(
    system: string,
    userMessage: string,
    maxTokens: number
  ): Promise<AIResult> {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) throw new Error("AI_API_ERROR");

    let response: Response;
    try {
      response = await fetch(ANTHROPIC_URL, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-api-key": apiKey,
          "anthropic-version": ANTHROPIC_VERSION,
        },
        body: JSON.stringify({
          model: MODEL,
          max_tokens: maxTokens,
          system,
          messages: [{ role: "user", content: userMessage }],
        }),
      });
    } catch {
      throw new Error("AI_API_ERROR");
    }

    if (!response.ok) {
      const body = await response.text().catch(() => "");
      console.error("[anthropic] non-2xx", response.status, body.slice(0, 500));
      throw new Error("AI_API_ERROR");
    }

    let data: AnthropicResponse;
    try {
      data = (await response.json()) as AnthropicResponse;
    } catch {
      throw new Error("AI_API_ERROR");
    }

    const text = data.content
      ?.filter((b) => b.type === "text" && typeof b.text === "string")
      .map((b) => b.text)
      .join("")
      .trim();

    if (!text) throw new Error("AI_API_ERROR");

    const tokensUsed =
      (data.usage?.input_tokens ?? 0) + (data.usage?.output_tokens ?? 0);

    return { text, tokensUsed };
  }

  private extractJson(text: string): string {
    // Models sometimes wrap output in ```json fences; strip them defensively.
    let candidate = text.trim();
    if (candidate.startsWith("```")) {
      candidate = candidate
        .replace(/^```(?:json)?\s*/i, "")
        .replace(/```\s*$/, "")
        .trim();
    }
    // If still surrounded by prose, isolate the first {...} block.
    if (!candidate.startsWith("{")) {
      const first = candidate.indexOf("{");
      const last = candidate.lastIndexOf("}");
      if (first === -1 || last === -1 || last < first) {
        throw new Error("AI_PARSE_ERROR");
      }
      candidate = candidate.slice(first, last + 1);
    }
    try {
      JSON.parse(candidate);
    } catch {
      throw new Error("AI_PARSE_ERROR");
    }
    return candidate;
  }

  async planCampaign(
    prompt: string
  ): Promise<{ json: string; tokensUsed: number }> {
    const { text, tokensUsed } = await this.callAnthropic(
      PLAN_SYSTEM_PROMPT,
      prompt,
      1500
    );
    const json = this.extractJson(text);
    return { json, tokensUsed };
  }

  async generateCreativeCopy(
    brief: string,
    platform: string,
    objective: string
  ): Promise<{ json: string; tokensUsed: number }> {
    const userMessage = `Platform: ${platform}. Objective: ${objective}. Brief: ${brief}`;
    const { text, tokensUsed } = await this.callAnthropic(
      COPY_SYSTEM_PROMPT,
      userMessage,
      900
    );
    const json = this.extractJson(text);
    return { json, tokensUsed };
  }

  /**
   * Generate per-card carousel copy. Returns the same `primary_texts` +
   * `ctas` ad-level variants as the single-asset flow, plus a `cards`
   * array (length === cardCount) where each card carries its own headline
   * + description. Images are NOT generated here — the user uploads one
   * per card to complete the creative.
   */
  async generateCarouselCopy(
    brief: string,
    platform: string,
    objective: string,
    cardCount: number
  ): Promise<{ json: string; tokensUsed: number }> {
    const userMessage = `Platform: ${platform}. Objective: ${objective}. Cards: ${cardCount}. Brief: ${brief}`;
    const { text, tokensUsed } = await this.callAnthropic(
      CAROUSEL_COPY_SYSTEM_PROMPT(cardCount),
      userMessage,
      1200 // ~200 tokens of headroom per card * ~5 cards
    );
    const json = this.extractJson(text);
    return { json, tokensUsed };
  }

  /**
   * Propose a structured Meta targeting definition from a plain-English
   * audience description. Returns interest/location NAMES (not IDs) — the
   * caller resolves those to real Meta IDs via the /search endpoints.
   */
  async generateAudienceTargeting(
    description: string
  ): Promise<{ json: string; tokensUsed: number }> {
    const { text, tokensUsed } = await this.callAnthropic(
      AUDIENCE_SYSTEM_PROMPT,
      `Audience description: ${description}`,
      700
    );
    const json = this.extractJson(text);
    return { json, tokensUsed };
  }
}

export const aiService = new AIService();
