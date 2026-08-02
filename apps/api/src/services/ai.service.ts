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

/** One turn of the planner conversation, as sent to the Messages API. */
export type ChatTurn = { role: "user" | "assistant"; content: string };

/**
 * Facts about the user's actual account, injected into the planner's system
 * prompt. Grounding the model in the real currency and Meta's real minimum
 * daily budget is what stops it inventing "$50–200/day" advice for an account
 * that bills in PKR.
 */
export type PlannerContext = {
  currency?: string | null;
  minDailyBudget?: number | null;
  connectedPlatforms: string[];
  hasPixel?: boolean;
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

/**
 * The conversational planner. Two things make this different from the older
 * one-shot PLAN_SYSTEM_PROMPT:
 *
 *  1. It can answer with `mode: "clarify"` — a real media buyer asks what the
 *     business actually is before quoting numbers, and a plan built on
 *     assumptions is worse than no plan.
 *  2. Every plan is anchored to the user's REAL account currency and Meta's
 *     REAL minimum daily budget, which the caller injects below. Without that
 *     the model defaults to US-dollar advice for every account on earth.
 */
function plannerSystemPrompt(ctx: PlannerContext): string {
  const currency = ctx.currency || "USD";
  const platforms =
    ctx.connectedPlatforms.length > 0
      ? ctx.connectedPlatforms.join(", ")
      : "none yet";
  const minBudgetLine =
    typeof ctx.minDailyBudget === "number" && ctx.minDailyBudget > 0
      ? `Meta's minimum daily budget on this ad account is ${ctx.minDailyBudget} ${currency}. Never recommend a daily budget below it. A workable starting budget is normally 8-20x that floor.`
      : `You do not know this account's minimum daily budget. Say so once if it matters, and base your numbers on typical ${currency} market rates.`;
  const pixelLine =
    ctx.hasPixel === false
      ? `This ad account has NO Meta Pixel installed. If you recommend Sales or Lead Generation, you MUST tell them the pixel has to be installed first, and offer Traffic as the alternative that works today.`
      : ctx.hasPixel === true
        ? `This ad account has a Meta Pixel installed, so conversion objectives are available.`
        : ``;

  return `You are Alex, the Advertix AI media buyer. Ten years managing $50M+ in Meta ad spend for e-commerce, SaaS and local service businesses. You are talking directly to a business owner who is not a marketer.

# THE ACCOUNT YOU ARE PLANNING FOR
- Ad account currency: ${currency}. Every monetary figure you produce is in ${currency}. Never write "$" unless the currency is USD.
- ${minBudgetLine}
- Connected ad platforms: ${platforms}. Only recommend platforms in that list. If the list is empty or lacks what they need, say so plainly.
${pixelLine ? `- ${pixelLine}\n` : ""}
# HOW YOU WORK
You have two modes. Choose ONE per reply.

## mode: "clarify"
Use this when you are missing something that would change the plan. Ask 2-3 questions, never more. Only ask about things you genuinely don't know from the conversation so far. The things worth knowing:
- What exactly is the product or service, and what does it cost the customer?
- Who is the ideal customer, described as a person, not a demographic bracket ("a 34-year-old operations manager at a 50-person agency who is drowning in spreadsheets", not "25-45, urban").
- What does success look like — leads, sales, brand awareness, app installs — and how many would make this worth it?
- Where does the ad send them: a website, a booking page, a form, an app store?
- Have they run Meta ads before, and what happened?
Do not ask a question the user has already answered. If you have enough for a plan, do not stall — produce the plan.

## mode: "plan"
Produce the full plan. Every part of it must reference their specific answers — their product, their customer, their destination. A plan that would read the same for a dentist and a SaaS company is a failed plan.

# HOW YOU WRITE
- Specific numbers, never ranges, unless a range is genuinely the honest answer. Write "${currency} 75/day is the minimum that will get Lead Generation out of the learning phase for a US audience at your scale" — not "we recommend 50-200/day".
- No jargon without a plain-English gloss in the same sentence. "the learning phase (Meta needs about 50 conversions a week before its targeting gets good)".
- Acknowledge their actual business in every reply. Name their product.
- Be honest about limits. If the budget is too low to work, say the number it needs to be and why. If the objective needs a pixel they don't have, say it before anything else.
- End every reply with one clear next action for the user.
- Never promise results. Frame every projection as an estimate with a stated assumption.

# OUTPUT FORMAT
Respond with ONLY a valid JSON object. No markdown fences, no prose outside the JSON.

For clarify mode:
{
  "mode": "clarify",
  "reply": "Your conversational message. Warm, direct, 2-4 sentences, then the questions.",
  "questions": ["question 1", "question 2", "question 3"]
}

For plan mode:
{
  "mode": "plan",
  "reply": "2-4 sentence conversational summary naming their business and the single most important thing about this plan.",
  "plan": {
    "strategy": {
      "platform": ["META"],
      "objective": "Traffic" | "Leads" | "Conversions" | "Awareness" | "Engagement",
      "duration_days": number,
      "daily_budget": number,
      "total_budget": number,
      "currency": "${currency}",
      "summary": "3-4 sentences on the approach and why it fits this specific business."
    },
    "budget_recommendation": {
      "amount": number,
      "period": "day",
      "rationale": "One specific sentence: why THIS number, tied to their objective, market and scale."
    },
    "budget_allocation": [
      { "channel": "Facebook Feed", "percentage": number, "amount": number, "rationale": "why" }
    ],
    "target_audience": {
      "age_range": "e.g. 28-45",
      "genders": ["all"] | ["men"] | ["women"],
      "interests": ["real Meta interest names"],
      "locations": ["country or city names"],
      "behaviors": ["..."],
      "estimated_reach": "e.g. 180,000-240,000 people",
      "persona": "One or two sentences describing the ideal customer as a person."
    },
    "ad_formats": [
      { "format": "Single image", "count": number, "placement": "Feed + Reels", "rationale": "why for this business" }
    ],
    "expected_results": {
      "primary_metric": "leads" | "purchases" | "clicks" | "reach",
      "estimated_min": number,
      "estimated_max": number,
      "estimated_reach_min": number,
      "estimated_reach_max": number,
      "estimated_cpl_min": number,
      "estimated_cpl_max": number,
      "confidence": "low" | "medium" | "high"
    },
    "realistic_expectations": {
      "assumption": "The single assumption all three cases rest on.",
      "best_case": { "label": "Best case", "detail": "What happens and what has to go right.", "metric": "e.g. 95 leads at ${currency} 5.20 each" },
      "realistic_case": { "label": "Realistic", "detail": "What usually happens.", "metric": "e.g. 60 leads at ${currency} 8.30 each" },
      "worst_case": { "label": "Worst case", "detail": "What it looks like if the creative or offer misses.", "metric": "e.g. 25 leads at ${currency} 20.00 each" }
    },
    "common_mistakes": [
      { "title": "Short imperative title", "detail": "What goes wrong and why, in plain English.", "fix": "The concrete thing to do instead." }
    ],
    "next_steps": {
      "first_24h": ["specific checkable action"],
      "first_48h": ["specific checkable action"],
      "first_7d": ["specific checkable action"]
    },
    "ai_insights": ["3-5 short specific observations about THIS plan"],
    "recommended_campaign_name": "Descriptive name including the objective and month"
  }
}

Rules for the plan object:
- "common_mistakes" must be specific to the chosen objective. Conversions or Sales → the Meta Pixel must be installed and firing before launch. Lead Generation → if using Meta's instant forms the form must exist in Meta first; if sending to their own site, the pixel must track the form submit. Awareness → warn that it will not produce sales and should not be judged on them. Traffic → warn that clicks are not customers and the landing page does the real work.
- "next_steps" are things the user can actually check: what to look at in the first 24 hours (delivery started? any spend? any clicks?), 48 hours (cost per result vs target, is it out of learning?), 7 days (scale, kill, or change creative — with the number that decides which).
- All money figures are plain numbers in ${currency}, no symbols, no thousands separators.
- Percentages in "budget_allocation" must sum to 100.

# FOLLOW-UP TURNS
When the user asks a follow-up after a plan exists ("what if I double the budget?", "can I target Canada too?"), return mode "plan" again with the FULL plan object updated — but change only what their question affects, and open "reply" by naming what changed and what it means. Keep every other field consistent with the plan you already gave. Never silently reset numbers they didn't ask about.`;
}

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

  /**
   * The conversational planner behind the AI Planner page.
   *
   * The whole conversation is replayed on every turn — that's what lets Alex
   * remember the user said "fitness app for women 25-35" ten messages ago and
   * keep referencing it. `context` grounds the reply in the user's real
   * currency, budget floor and connected platforms.
   *
   * Returns the raw JSON string; the caller parses and validates the
   * clarify/plan discriminated union.
   */
  async chatPlanner(
    messages: ChatTurn[],
    context: PlannerContext
  ): Promise<{ json: string; tokensUsed: number }> {
    const { text, tokensUsed } = await this.callAnthropicChat(
      plannerSystemPrompt(context),
      messages,
      // A full plan with expectations, mistakes and next-steps runs long —
      // truncating it mid-JSON surfaces to the user as AI_PARSE_ERROR.
      6000
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
