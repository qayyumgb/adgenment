import { Router, Request, Response, NextFunction } from "express";
import multer from "multer";
import { aiService, type ChatTurn } from "../services/ai.service";
import { buildPlan, plannerContext, plannerStarters, plannerSystemPrompt, PLANNER_SCHEMA, type PlannerOutput } from "../services/planner.service";
import { assertClientAccess, getAccess } from "../lib/access";
import { ClientScopeError } from "../lib/clients";
import { openaiImageService } from "../services/openai-image.service";
import { metaService, type MetaTargeting } from "../services/meta.service";
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

/* ── AI Planner (plan A12) ─────────────────────────────────────────────────── */

/** Longest conversation we replay to the model; a guard against an unbounded transcript. */
const PLANNER_MAX_TURNS = 40;
const PLANNER_MAX_CHARS = 4000;
const PLANS_PER_HOUR = 30;
const planTimestamps = new Map<string, number[]>();

function takePlanSlot(workspaceId: string): { ok: boolean; resetSeconds?: number } {
  const now = Date.now();
  const recent = (planTimestamps.get(workspaceId) ?? []).filter((t) => now - t < HOUR_MS);
  if (recent.length >= PLANS_PER_HOUR) return { ok: false, resetSeconds: Math.ceil((recent[0] + HOUR_MS - now) / 1000) };
  recent.push(now);
  planTimestamps.set(workspaceId, recent);
  return { ok: true };
}

/** The transcript from the client: user / assistant turns, trimmed, opening on a user turn and ending on one. */
function parsePlannerTurns(body: unknown): ChatTurn[] | { error: string } {
  const raw = (body as { messages?: unknown } | null)?.messages;
  if (!Array.isArray(raw)) return { error: "Describe the goal, budget and timing." };
  const turns: ChatTurn[] = [];
  for (const t of raw) {
    const m = (t ?? {}) as { role?: unknown; content?: unknown };
    if (m.role !== "user" && m.role !== "assistant") return { error: "Each message needs a role of 'user' or 'assistant'." };
    if (typeof m.content !== "string" || !m.content.trim()) continue;
    turns.push({ role: m.role, content: m.content.trim().slice(0, PLANNER_MAX_CHARS) });
  }
  const windowed = turns.slice(-PLANNER_MAX_TURNS);
  while (windowed.length && windowed[0].role === "assistant") windowed.shift();
  if (!windowed.length) return { error: "Describe the goal, budget and timing." };
  if (windowed[windowed.length - 1].role !== "user") return { error: "The last message must come from you." };
  return windowed;
}

/** The client a planner request is for: `clientId` (query or body), checked against the member's access. */
async function plannerClient(req: Request, workspaceId: string, raw: unknown): Promise<string | null> {
  const id = typeof raw === "string" && raw && raw !== "all" ? raw : null;
  const access = await getAccess(req);
  if (!id) return access?.clientIds?.[0] ?? null;
  const found = await prisma.client.findFirst({ where: { id, workspaceId }, select: { id: true } });
  if (!found) throw new ClientScopeError();
  if (access) assertClientAccess(access, found.id);
  return found.id;
}

/**
 * GET /ai/planner/context?clientId= — what Advertix reads before planning
 * (last 30 days, platforms compared, fatigue and shared audiences) plus
 * starter briefs from real data. Under "All clients" it picks a client.
 */
router.get("/planner/context", requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const workspace = await requireWorkspace(req.dbUserId!);
    const clientId = await plannerClient(req, workspace.id, req.query.clientId);
    const access = await getAccess(req);
    const [context, starters] = await Promise.all([
      plannerContext(workspace.id, clientId, { pixel: req.query.pixel !== "0" }),
      plannerStarters(workspace.id, clientId ? [clientId] : access?.clientIds ?? null),
    ]);
    res.json({ ...context, starters });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /ai/plan-campaign — one planner turn.
 *
 * Body: `{ messages: [{ role, content }], clientId, currentPlan? }`. The
 * whole transcript is replayed; `currentPlan` (the model's last draft) is
 * attached to the latest message so follow-ups change only what's asked.
 *
 * Returns `{ mode: "clarify", reply, questions, suggestions, steps }` or
 * `{ mode: "plan", reply, plan, steps }`, where the plan's budgets and
 * forecast are computed here from the client's own history.
 */
router.post("/plan-campaign", requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const workspace = await requireWorkspace(req.dbUserId!);
    const turns = parsePlannerTurns(req.body);
    if (!Array.isArray(turns)) return res.status(400).json({ error: turns.error });
    const clientId = await plannerClient(req, workspace.id, req.body?.clientId);
    const context = await plannerContext(workspace.id, clientId);
    if (!context.client) return res.status(400).json({ error: "Add a client with a connected ad account first." });

    const slot = takePlanSlot(workspace.id);
    if (!slot.ok) {
      return res.status(429).json({ error: `That's ${PLANS_PER_HOUR} plans this hour for this workspace. Try again in ${Math.ceil((slot.resetSeconds ?? 60) / 60)} min.` });
    }

    const current = req.body?.currentPlan;
    const messages = turns.map((t, i) =>
      i === turns.length - 1 && current && typeof current === "object"
        ? { role: t.role, content: `<current_plan>\n${JSON.stringify(current).slice(0, 60_000)}\n</current_plan>\n\n${t.content}` }
        : t
    );

    let out: PlannerOutput;
    try {
      const { json } = await aiService.planner(plannerSystemPrompt(context), messages, PLANNER_SCHEMA);
      out = JSON.parse(json) as PlannerOutput;
    } catch (err) {
      const code = err instanceof Error ? err.message : "AI_API_ERROR";
      if (code === "AI_REFUSAL") return res.status(422).json({ error: "Advertix can't plan that request. Try describing the campaign differently." });
      if (code === "AI_PARSE_ERROR") return res.status(502).json({ error: "The plan came back incomplete. Try again, or ask for a smaller plan." });
      if (code === "AI_RATE_LIMIT") return res.status(429).json({ error: "The AI planner is busy right now. Try again in a minute." });
      return res.status(503).json({ error: "The AI planner is temporarily unavailable. Try again in a moment." });
    }

    const reply = out.reply?.trim() || null;
    if (out.mode === "plan" && out.plan && Array.isArray(out.plan.campaigns) && out.plan.campaigns.length) {
      return res.json({ mode: "plan" as const, reply: reply ?? "Here's the plan.", plan: buildPlan(out.plan, context), steps: context.steps });
    }
    return res.json({
      mode: "clarify" as const,
      reply: reply ?? "Before I plan this, tell me the budget, timing and goal.",
      questions: (out.questions ?? []).filter((q) => typeof q === "string" && q.trim()).slice(0, 3),
      suggestions: (out.suggestions ?? []).filter((q) => typeof q === "string" && q.trim()).slice(0, 4),
      steps: context.steps,
    });
  } catch (err) {
    next(err);
  }
});

/* ── Ask about this campaign (plan B5) ────────────────────────────────────── */

const ASK_PER_HOUR = 30;
const askTimestamps = new Map<string, number[]>();

/** Per-workspace hourly cap on campaign questions (each one is an LLM call). */
function takeAskSlot(workspaceId: string): { ok: boolean; resetSeconds?: number } {
  const now = Date.now();
  const recent = (askTimestamps.get(workspaceId) ?? []).filter((t) => now - t < HOUR_MS);
  if (recent.length >= ASK_PER_HOUR) {
    return { ok: false, resetSeconds: Math.ceil((recent[0] + HOUR_MS - now) / 1000) };
  }
  recent.push(now);
  askTimestamps.set(workspaceId, recent);
  return { ok: true };
}

/** Earlier turns from the client: alternating user / assistant, last 6, bounded size. */
function parseAskHistory(raw: unknown): ChatTurn[] {
  if (!Array.isArray(raw)) return [];
  const turns = raw
    .filter(
      (t): t is ChatTurn =>
        !!t &&
        typeof t === "object" &&
        ((t as ChatTurn).role === "user" || (t as ChatTurn).role === "assistant") &&
        typeof (t as ChatTurn).content === "string" &&
        (t as ChatTurn).content.trim().length > 0
    )
    .map((t) => ({ role: t.role, content: t.content.slice(0, 2000) }))
    .slice(-6);
  // The Messages API needs strict alternation starting with "user".
  const out: ChatTurn[] = [];
  for (const t of turns) {
    if (out.length === 0 && t.role !== "user") continue;
    if (out.length && out[out.length - 1].role === t.role) continue;
    out.push(t);
  }
  // The new question is appended as a user turn, so history must end on assistant.
  while (out.length && out[out.length - 1].role === "user") out.pop();
  return out;
}

/**
 * POST /ai/campaigns/:id/ask  { question, history? }
 * Answers from the campaign's own data only: settings, the last 30 days of
 * daily metrics, week-over-week change and open suggestions.
 */
router.post("/campaigns/:id/ask", requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const workspace = await requireWorkspace(req.dbUserId!);
    const question = typeof req.body?.question === "string" ? req.body.question.trim() : "";
    if (!question) return res.status(400).json({ error: "Ask a question about this campaign." });
    if (question.length > 500) return res.status(400).json({ error: "Keep the question under 500 characters." });

    const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const campaign = await prisma.campaign.findFirst({
      where: { id: req.params.id, workspaceId: workspace.id },
      include: {
        adAccount: { select: { platform: true, currency: true, accountName: true } },
        metrics: { where: { date: { gte: since } }, orderBy: { date: "asc" } },
        suggestions: { where: { status: "OPEN" }, select: { title: true, reason: true }, take: 5 },
      },
    });
    if (!campaign) return res.status(404).json({ error: "Campaign not found" });

    const rate = takeAskSlot(workspace.id);
    if (!rate.ok) {
      return res.status(429).json({ error: `That's a lot of questions — try again in ${Math.ceil((rate.resetSeconds ?? 60) / 60)} min.` });
    }

    const daily = campaign.metrics.map((m) => ({
      date: m.date.toISOString().slice(0, 10),
      spend: Number(m.spend),
      revenue: Number(m.revenue),
      impressions: m.impressions,
      clicks: m.clicks,
      conversions: m.conversions,
    }));
    const sum = (rows: typeof daily) =>
      rows.reduce(
        (a, d) => ({ spend: a.spend + d.spend, revenue: a.revenue + d.revenue, impressions: a.impressions + d.impressions, clicks: a.clicks + d.clicks, conversions: a.conversions + d.conversions }),
        { spend: 0, revenue: 0, impressions: 0, clicks: 0, conversions: 0 }
      );
    const ratios = (t: ReturnType<typeof sum>) => ({
      ...t,
      spend: +t.spend.toFixed(2),
      revenue: +t.revenue.toFixed(2),
      roas: t.spend > 0 ? +(t.revenue / t.spend).toFixed(2) : null,
      ctrPct: t.impressions > 0 ? +((t.clicks / t.impressions) * 100).toFixed(2) : null,
      cpa: t.conversions > 0 ? +(t.spend / t.conversions).toFixed(2) : null,
    });
    const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    const twoWeeksAgo = Date.now() - 14 * 24 * 60 * 60 * 1000;
    const at = (d: { date: string }) => new Date(d.date).getTime();

    const context = JSON.stringify({
      campaign: {
        name: campaign.name,
        platform: campaign.platform,
        account: campaign.adAccount.accountName,
        status: campaign.status,
        objective: campaign.objective,
        budget: Number(campaign.budget),
        budgetType: campaign.budgetType,
        currency: campaign.adAccount.currency ?? "unknown",
        startDate: campaign.startDate?.toISOString().slice(0, 10) ?? null,
        endDate: campaign.endDate?.toISOString().slice(0, 10) ?? null,
        reach30d: campaign.reach,
        publishedFromAdvertix: Boolean(campaign.publishedAt),
      },
      last30Days: ratios(sum(daily)),
      last7Days: ratios(sum(daily.filter((d) => at(d) >= weekAgo))),
      previous7Days: ratios(sum(daily.filter((d) => at(d) >= twoWeeksAgo && at(d) < weekAgo))),
      daily,
      openSuggestions: campaign.suggestions,
      notAvailableYet: ["ad set / ad breakdown", "audience breakdown", "creative performance", "placement breakdown"],
    });

    try {
      const { answer } = await aiService.askAboutCampaign(context, [
        ...parseAskHistory(req.body?.history),
        { role: "user", content: question },
      ]);
      res.json({ answer, basedOn: { days: 30, daysWithData: daily.length } });
    } catch {
      res.status(503).json({ error: "Couldn't get an answer right now. Try again in a moment." });
    }
  } catch (err) {
    next(err);
  }
});

// Auth required: this endpoint spends LLM tokens. It was previously public
// (reachable directly on the API host without a session).
router.post("/generate-copy", requireAuth, async (req: Request, res: Response) => {
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

/** Map the AI's gender strings to Meta's numeric codes. Empty (or both) = all
 *  genders, which Meta represents by OMITTING the field. */
function mapGenders(v: unknown): number[] {
  if (!Array.isArray(v)) return [];
  const set = new Set<number>();
  for (const g of v) {
    if (g === "male") set.add(1);
    if (g === "female") set.add(2);
  }
  // Both selected = no restriction → omit (return []).
  return set.size === 1 ? [...set] : [];
}

/** Clamp an age to Meta's allowed 13-65 range, falling back when invalid. */
function clampAge(v: unknown, fallback: number): number {
  if (typeof v === "number" && Number.isFinite(v)) {
    return Math.min(65, Math.max(13, Math.round(v)));
  }
  return fallback;
}

const AUDIENCE_TYPE_VALUES = [
  "LOOKALIKE",
  "INTEREST",
  "RETARGETING",
  "CUSTOM",
  "BEHAVIORAL",
  "SAVED",
] as const;
type AudienceTypeValue = (typeof AUDIENCE_TYPE_VALUES)[number];
function normalizeAudienceType(v: unknown): AudienceTypeValue {
  return typeof v === "string" &&
    (AUDIENCE_TYPE_VALUES as readonly string[]).includes(v)
    ? (v as AudienceTypeValue)
    : "INTEREST";
}

/**
 * POST /ai/generate-audience — turn a plain-English description into a real,
 * editable Meta targeting spec. The LLM proposes targeting by NAME; we then
 * resolve interest + location names to real Meta IDs via the /search
 * endpoints so the result is publish-ready (not just suggestions).
 *
 * Requires a connected Meta ad account (needed to resolve names → IDs).
 * Body: `{ description }`. Returns `{ name, type, description, targeting,
 * resolved, approxSize }`.
 */
router.post(
  "/generate-audience",
  requireAuth,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const workspace = await requireWorkspace(req.dbUserId!);
      const { description } = (req.body ?? {}) as { description?: unknown };
      if (typeof description !== "string" || description.trim().length < 10) {
        return res.status(400).json({
          error: "Describe the audience in at least 10 characters.",
        });
      }

      const adAccount = await prisma.adAccount.findFirst({
        where: { workspaceId: workspace.id, platform: "META", isActive: true },
        orderBy: { createdAt: "desc" },
      });
      if (!adAccount) {
        return res.status(400).json({
          error:
            "Connect a Meta ad account first (Settings → Integrations) — we resolve interests and locations against Meta to build a real audience.",
        });
      }
      const token = metaService.decryptToken(adAccount.accessToken);

      // 1. LLM proposes a structured targeting definition (names, not IDs).
      let proposal: {
        name?: unknown;
        type?: unknown;
        age_min?: unknown;
        age_max?: unknown;
        genders?: unknown;
        geo?: { countries?: unknown; cities?: unknown };
        interests?: unknown;
        rationale?: unknown;
      };
      try {
        const { json } = await aiService.generateAudienceTargeting(
          description.trim()
        );
        proposal = JSON.parse(json);
      } catch (err) {
        const code = err instanceof Error ? err.message : "AI_API_ERROR";
        if (code === "AI_PARSE_ERROR") {
          return res.status(502).json({
            error: "AI returned malformed targeting. Try rephrasing.",
          });
        }
        return res.status(503).json({
          error: "AI service is temporarily unavailable. Try again.",
        });
      }

      // 2. Resolve names → real Meta IDs (parallel, best-effort: a name that
      //    doesn't match anything on Meta is simply dropped).
      const asStrings = (v: unknown, cap: number): string[] =>
        Array.isArray(v)
          ? v.filter((s): s is string => typeof s === "string" && s.trim() !== "").slice(0, cap)
          : [];
      const interestNames = asStrings(proposal.interests, 8);
      const countryNames = asStrings(proposal.geo?.countries, 10);
      const cityNames = asStrings(proposal.geo?.cities, 10);

      const [interestRes, countryRes, cityRes] = await Promise.all([
        Promise.all(
          interestNames.map((n) =>
            metaService.searchInterests(token, n).then((r) => r[0] ?? null).catch(() => null)
          )
        ),
        Promise.all(
          countryNames.map((n) =>
            metaService.searchLocations(token, n, ["country"]).then((r) => r[0] ?? null).catch(() => null)
          )
        ),
        Promise.all(
          cityNames.map((n) =>
            metaService.searchLocations(token, n, ["city"]).then((r) => r[0] ?? null).catch(() => null)
          )
        ),
      ]);

      const interests = interestRes
        .filter((i): i is NonNullable<typeof i> => i !== null)
        .map((i) => ({ id: i.id, name: i.name }));
      const countries = countryRes
        .filter((c): c is NonNullable<typeof c> => c !== null)
        .map((c) => c.countryCode)
        .filter((c): c is string => typeof c === "string");
      const cities = cityRes
        .filter((c): c is NonNullable<typeof c> => c !== null)
        .map((c) => ({ key: c.key }));

      // 3. Assemble the MetaTargeting spec.
      const ageMin = clampAge(proposal.age_min, 18);
      const ageMax = Math.max(ageMin, clampAge(proposal.age_max, 65));
      const genders = mapGenders(proposal.genders);
      const hasGeo = countries.length > 0 || cities.length > 0;
      const targeting: MetaTargeting = {
        age_min: ageMin,
        age_max: ageMax,
        ...(genders.length ? { genders } : {}),
        ...(hasGeo
          ? {
              geo_locations: {
                ...(countries.length ? { countries } : {}),
                ...(cities.length ? { cities } : {}),
              },
            }
          : {}),
        ...(interests.length ? { interests } : {}),
      };

      // Approx size: the broadest single interest. Meta OR's interests, so the
      // true union is >= this — a conservative, honest lower-bound signal.
      const approxSize =
        interestRes.reduce(
          (m, i) =>
            i && typeof i.audienceSize === "number"
              ? Math.max(m, i.audienceSize)
              : m,
          0
        ) || null;

      return res.json({
        name:
          typeof proposal.name === "string" && proposal.name.trim()
            ? proposal.name.trim().slice(0, 80)
            : "AI audience",
        type: normalizeAudienceType(proposal.type),
        description:
          typeof proposal.rationale === "string" && proposal.rationale.trim()
            ? proposal.rationale.trim()
            : description.trim(),
        targeting,
        resolved: {
          interests,
          countries: countryRes.filter((c) => c !== null),
          cities: cityRes.filter((c) => c !== null),
        },
        approxSize,
      });
    } catch (err) {
      next(err);
    }
  }
);

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
