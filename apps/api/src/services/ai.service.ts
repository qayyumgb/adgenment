/**
 * AI Service — wraps the Anthropic Messages API.
 * Uses native fetch (Node 18+) to keep dependencies minimal.
 */

const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";
const ANTHROPIC_VERSION = "2023-06-01";
// Previous model `claude-sonnet-4-20250514` retired 2026-06-15 → API returns
// an error for it now. Migrated to Opus 4.8, the current most capable model.
// Per-call cost is small (generateCreativeCopy
// ~900 tok) so the Sonnet→Opus pricing delta is ~$0.02 per generation.
const MODEL = "claude-opus-4-8";
// The AI Planner (A12) uses structured outputs on the current Opus.
const PLANNER_MODEL = "claude-opus-5-5";

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

/** One turn of the planner conversation, as sent to the Messages API. */
export type ChatTurn = { role: "user" | "assistant"; content: string };

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

/** Budget-optimizer prompt. The model receives a portfolio summary + per-
 *  campaign performance and returns a reallocation plan as strict JSON. The
 *  caller (budgetOptimizerService) only invokes this when there is real
 *  revenue/ROAS signal. All money figures are in the account currency the
 *  user message states — the model must NOT assume USD. */
const BUDGET_SYSTEM_PROMPT = `You are an expert media buyer optimizing ad budgets across platforms.

You will receive a portfolio summary and per-campaign performance (last 14 days vs the previous 14 days). Recommend how to reallocate budget.

RULES:
1. Never cut budget on campaigns with ROAS > 3x unless their spend is minimal.
2. Flag campaigns with ROAS < 1x for PAUSE or a major DECREASE.
3. INCREASE budget on campaigns with ROAS > 2.5x AND an upward trend.
4. Keep total recommended budget within 20% of the current total.
5. Don't concentrate all budget on one platform — keep a sensible mix.
6. Be specific with amounts and percentages, in the SAME currency as the input (do NOT convert to USD or add "$").
7. Every recommendedBudget must be a positive number. Use action "MAINTAIN" when no change is warranted.

Return ONLY a valid JSON object (no markdown) with EXACTLY this structure:
{
  "summary": "2-3 sentence executive summary of the portfolio",
  "totalCurrentBudget": number,
  "totalRecommendedBudget": number,
  "estimatedRoasImprovement": number,        // percentage
  "estimatedRevenueIncrease": number,        // per month, account currency
  "topOpportunity": "one sentence",
  "biggestRisk": "one sentence",
  "insights": ["insight 1", "insight 2", "insight 3"],
  "recommendations": [
    {
      "campaignId": "string",
      "campaignName": "string",
      "platform": "string",
      "currentBudget": number,
      "recommendedBudget": number,
      "budgetChange": number,                // signed
      "budgetChangePercent": number,
      "action": "INCREASE" | "DECREASE" | "PAUSE" | "MAINTAIN",
      "reason": "specific reason",
      "expectedImpact": "expected outcome if applied",
      "confidence": "HIGH" | "MEDIUM" | "LOW",
      "priority": number                     // 1 = highest priority
    }
  ]
}

Use the EXACT campaignId values from the input. Include every campaign in recommendations.`;

/** Insights prompt. Analyzes real campaign performance and returns 4–8
 *  specific, data-driven observations. Returns an OBJECT ({ insights: [...] })
 *  rather than a bare array so the shared extractJson works. */
const INSIGHTS_SYSTEM_PROMPT = `You are Advertix AI, an expert digital advertising analyst. Analyze campaign performance data and generate actionable insights.

Return ONLY a valid JSON object (no markdown) of the form { "insights": [ ... ] }.
Generate 4–8 insights MAXIMUM. Each must be specific, data-driven, and actionable — quote real numbers from the data, never generic advice. If the data is too thin to say anything specific, return fewer (or zero) insights rather than padding.

Each insight object:
{
  "type": "OPPORTUNITY" | "WARNING" | "OPTIMIZATION" | "ALERT",
  "title": string,                       // max 60 chars, specific
  "message": string,                     // 2-3 sentences, plain English, include specific numbers
  "impact": string,                      // e.g. "+$2,400/mo estimated" — omit/null if not quantifiable
  "impactType": "revenue" | "cost" | "performance",
  "affectedCampaigns": string[],         // campaign names this is about
  "platform": string | null,
  "priority": number,                    // 1 = highest
  "confidence": "HIGH" | "MEDIUM" | "LOW"
}

What to look for:
- ALERT: ROAS dropped >30% week-over-week; spend dropped to 0 (paused accidentally?); CTR < 0.5% (creative fatigue).
- WARNING: budget depletes in <3 days at current pace; ROAS < 1x (losing money); CPL up >40% this week.
- OPPORTUNITY: ROAS > 3x → scale budget; one platform clearly outperforming another; a strong day-of-week pattern.
- OPTIMIZATION: targeting/creative/scheduling adjustments backed by the numbers.

Use the EXACT campaign names from the input. Money figures are in the currency stated in the data — do NOT convert or add "$" unless the data is in USD.`;

const ASK_SYSTEM_PROMPT = `You are Advertix, answering a marketer's questions about ONE ad campaign.

Rules:
- Use ONLY the campaign data provided below. Never invent metrics, benchmarks presented as facts, or numbers that aren't in the data.
- If the data can't answer the question (for example there is no ad set, ad, audience or creative breakdown yet), say so plainly and suggest what to check instead.
- Quote real numbers with the currency code from the data. Do not convert currencies.
- Be concise: at most about 120 words. Plain text; short paragraphs or up to 4 "- " bullets. No headings, no markdown tables.
- You cannot change the campaign. Never say you have changed, paused or adjusted anything; recommend instead.
- Days with zero spend may simply be days the campaign wasn't running.`;

class AIService {
  private async callAnthropic(
    system: string,
    userMessage: string,
    maxTokens: number
  ): Promise<AIResult> {
    return this.callAnthropicChat(
      system,
      [{ role: "user", content: userMessage }],
      maxTokens
    );
  }

  /**
   * Multi-turn variant. The single-message `callAnthropic` delegates here so
   * there is one place that talks to the Messages API.
   */
  private async callAnthropicChat(
    system: string,
    messages: ChatTurn[],
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
          messages,
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

  /**
   * The AI Planner (A12): one structured call per turn. The reply is
   * guaranteed to match `schema` (structured outputs), so there's no JSON
   * scraping. Runs on Claude Opus 5.5 with the server-side refusal fallback.
   */
  async planner(system: string, messages: ChatTurn[], schema: object): Promise<{ json: string; tokensUsed: number }> {
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
          "anthropic-beta": "server-side-fallback-2026-07-01",
        },
        body: JSON.stringify({
          model: PLANNER_MODEL,
          max_tokens: 16000,
          system,
          messages,
          fallbacks: "default",
          output_config: { effort: "medium", format: { type: "json_schema", schema } },
        }),
      });
    } catch {
      throw new Error("AI_API_ERROR");
    }
    if (!response.ok) {
      const body = await response.text().catch(() => "");
      console.error("[anthropic] planner non-2xx", response.status, body.slice(0, 500));
      throw new Error(response.status === 429 ? "AI_RATE_LIMIT" : "AI_API_ERROR");
    }
    let data: AnthropicResponse;
    try {
      data = (await response.json()) as AnthropicResponse;
    } catch {
      throw new Error("AI_API_ERROR");
    }
    if (data.stop_reason === "refusal") throw new Error("AI_REFUSAL");
    // Cut off mid-answer: the JSON would be incomplete.
    if (data.stop_reason === "max_tokens") throw new Error("AI_PARSE_ERROR");
    const json = (data.content ?? [])
      .filter((b) => b.type === "text" && typeof b.text === "string")
      .map((b) => b.text)
      .join("")
      .trim();
    if (!json) throw new Error("AI_API_ERROR");
    try {
      JSON.parse(json);
    } catch {
      throw new Error("AI_PARSE_ERROR");
    }
    return { json, tokensUsed: (data.usage?.input_tokens ?? 0) + (data.usage?.output_tokens ?? 0) };
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

  /**
   * Budget optimization. The caller builds `userMessage` from real campaign
   * performance (portfolio summary + per-campaign metrics). We return a parsed
   * reallocation plan. Only called when there is genuine revenue/ROAS signal —
   * the optimizer service short-circuits on zero-revenue data so we never ask
   * the model to "optimize" zeros.
   */
  async optimizeBudget(
    userMessage: string
  ): Promise<{ json: string; tokensUsed: number }> {
    const { text, tokensUsed } = await this.callAnthropic(
      BUDGET_SYSTEM_PROMPT,
      userMessage,
      2000
    );
    const json = this.extractJson(text);
    return { json, tokensUsed };
  }

  /**
   * Generate AI insights from a campaign-performance summary. Returns the raw
   * JSON object string `{ "insights": [...] }`; the caller parses + persists.
   * Only called when there is real data to analyze.
   */
  /**
   * Free-text answer about one campaign (Campaign detail, "Ask about this
   * campaign"). `context` is the campaign's JSON snapshot; `messages` is the
   * conversation so far, ending with the user's question.
   */
  async askAboutCampaign(context: string, messages: ChatTurn[]): Promise<{ answer: string; tokensUsed: number }> {
    const { text, tokensUsed } = await this.callAnthropicChat(`${ASK_SYSTEM_PROMPT}\n\nCAMPAIGN DATA (JSON):\n${context}`, messages, 700);
    return { answer: text, tokensUsed };
  }

  async generateInsights(
    userMessage: string
  ): Promise<{ json: string; tokensUsed: number }> {
    const { text, tokensUsed } = await this.callAnthropic(
      INSIGHTS_SYSTEM_PROMPT,
      userMessage,
      2500
    );
    const json = this.extractJson(text);
    return { json, tokensUsed };
  }
}

export const aiService = new AIService();
