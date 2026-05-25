/**
 * AI Service — wraps the Anthropic Messages API.
 * Uses native fetch (Node 18+) to keep dependencies minimal.
 */

const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";
const ANTHROPIC_VERSION = "2023-06-01";
const MODEL = "claude-sonnet-4-20250514";

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

const PLAN_SYSTEM_PROMPT = `You are AdGenius AI, an expert digital advertising strategist with 15 years of experience managing $500M+ in ad spend across Meta, Google, TikTok, LinkedIn, and YouTube.

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
}

export const aiService = new AIService();
