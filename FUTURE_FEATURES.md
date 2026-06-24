# Advertix — Future Features Backlog

Features explicitly DEFERRED for later builds. **Do not start any of these without first checking the prerequisite gate listed.**

The pattern that keeps this file useful: when a customer or competitor inspires us to build something big, we write it down here with a clear gate. We DON'T start building. When the gate clears, we revisit, re-scope, and decide if it's still the right move.

---

## 🎨 AI Image Generation (Madgicx-style)

**Status:** Deferred
**Earliest start:** After all gates cleared (see below)
**Inspired by:** [Madgicx AI Ad Hub](https://madgicx.com) — reviewed 2026-06-22

### What it is

A built-in image generator that creates ad creatives from a text prompt. User describes the ad they want; the platform generates 3-4 image variants matched to their brand voice and aspect ratio. Generated images go straight into the creative library and can be attached to campaigns.

Key UI pieces seen in Madgicx:
- AI Ad Hub with "My AI Generations" + "Community AI Generations" tabs
- Aspect ratio picker (Square, Portrait, Story, Reels)
- Prompt templates (predefined prompts users can adapt)
- Number-of-outputs selector (3, 4, 6 outputs per generation)
- Sub-pages: Ad Library, Brands, Saved Inspirations, Recent Edits
- Brand training (upload past ads → fine-tune generation to your style)

### Why we want it

- **Differentiates from spreadsheet-era ad tools** — AI-first feels like a real product, not a wrapper
- **Sticky** — once a brand uploads voice + past ads, switching cost is high
- **Premium tier** — natural place to charge $99+/month vs. our beta-free tier
- **Customer feedback** — Madgicx-style is what users will compare us to

### Why we are NOT building it yet

| Constraint | Reality |
|---|---|
| **Cost per image** | $0.05-$0.20 per generation from DALL-E 3 / Stable Diffusion / Replicate. At 1000 users × 10 images/day = $30K-$60K/month in API costs. **Not economically viable pre-revenue.** |
| **Time** | Image generation is 6-9 months minimum to ship at quality bar customers expect. Touch points: prompt engineering, brand training, image editor, asset pipeline, moderation, error handling, storage. |
| **Competitive risk** | Madgicx, Pencil, AdCreative.ai, Predis.ai already do this with venture-funded teams. We can't win on features. We win on niche fit. |
| **Wrong fight** | Our actual pitch is "AI ad management across platforms" — strategy, planning, analytics, publishing. Image generation is feature creep into a different product. |

### Prerequisite gates — ALL must clear before starting

- [ ] Phase 1B done — carousel + video publishing on Meta works end-to-end
- [ ] Meta App Review approved → Marketing API at Standard Access
- [ ] Production Clerk swap done, real session security
- [ ] Production CORS, custom API domain `api.advertix.io`
- [ ] **First 10 paid customers onboarded** ← the hard gate. Without revenue, image gen burns cash with no offset.
- [ ] At least 3 of those paid customers have specifically asked for image generation (validates demand)
- [ ] At least one other platform (Google or TikTok) has full publish flow working

### When all gates clear — how we'd approach it

**Phase 1 — Minimum viable image gen (~2 weeks):**

- Prompt input → 4 image variants
- One aspect ratio (Square 1080×1080)
- Use Replicate API for cost flexibility (vs. locked into OpenAI)
- Cost-cap: each user gets N generations/month based on tier
- Generated images save to `Creatives` library automatically
- Skip brand training, community, ad library — those are Phase 2+

**Phase 2 — Brand training (~3 weeks):**

- User uploads past ads (10-20 images)
- We fine-tune or use embeddings/RAG to bias generation
- Saved as a "Brand profile" → reusable across generations

**Phase 3 — Multiple aspect ratios + advanced controls (~2 weeks):**

- Portrait (1080×1350), Story (1080×1920), Reels
- Style controls: photo / illustration / 3D / minimalist
- Color theme controls

**Phase 4 — Community + inspirations (~1 month):**

- Show what other users in same niche have generated (opt-in)
- Bookmark / save / fork from community
- This is the moat-building phase

**Phase 5 — Editor (~1 month):**

- Inline crop, text overlay, color adjustments
- Goes beyond pure generation

### Reference notes / patterns to copy from Madgicx UI

When we do build, these are good UI patterns:

- **Bottom-bar prompt input** (like ChatGPT, Claude.ai) — feels familiar, encourages prompting
- **Inline output count + aspect selector chips** — quick controls without modal nesting
- **Demo mode banner** for unconnected accounts ("You're using demo, click to connect")
- **Two-pane layout** with main left nav + inner section nav
- **"NEW!" / "BETA" badges** on the sidebar item — signals product velocity

These patterns are FREE to borrow. They don't require image generation infrastructure.

### What to do BEFORE building this

1. When you (the founder) start thinking "we should build image gen now" — re-read this doc
2. Check if all gates are clear
3. If yes — re-scope by current state of the market (Madgicx might have changed; new tools might exist; image gen APIs might be cheaper)
4. Talk to your top 3 paying customers — would they pay extra for this?
5. Only then start

---

## ✍️ Separate raw image-prompt field (power-user mode)

**Status:** Deferred
**Earliest start:** When a user asks for finer control over the generated image, OR when we ship reference-image upload (natural time to rework the generate flow)
**Inspired by:** User request 2026-06-24 (wanting a full photographer/CGI-style prompt that controls the image directly)

### What it is

Today the AI Generate modal has ONE input — the `brief`. It feeds **both** the copy generator (headlines / primary text / descriptions / CTAs) **and** the image generator (wrapped by `buildAdImagePrompt`). That's great for "describe your ad idea, get everything" but it means a user can't write a detailed, image-only prompt (lighting, lens, composition, "place the product on a marble counter in morning light…") without that text also polluting copy generation and producing odd headlines.

This feature adds an **optional second field**: a raw image prompt that goes *straight to the image model untouched*, bypassing `buildAdImagePrompt`. When filled, it overrides the brief-derived image prompt; the brief still drives copy. When empty, behaviour is exactly as today (one brief → both).

UI sketch:
- A collapsible "Advanced: image prompt" section under the main brief (collapsed by default — keep the simple path simple).
- Textarea pre-fillable from a photographer-style template (the verbatim reference the user shared: "You are a professional product photographer and CGI artist…").
- Small note: "Overrides the auto-generated image prompt. Copy still comes from the brief above."

### Why we want it

- **Power users / agencies** want deterministic control over the visual, not an AI's interpretation of a marketing brief.
- Pairs naturally with **reference-image upload** (deferred) — a product-placement prompt only makes sense once you can attach the product photo.
- Cheap to build relative to its perceived value (it's a field + a branch in the generate flow, not new infra).

### Why we are NOT building it yet

| Constraint | Reality |
|---|---|
| **Demand unproven** | One user mentioned it once. The single-brief flow covers the 90% case. Don't add a second input (and the "which prompt wins?" mental model) until someone actually hits the ceiling. |
| **Better with image upload** | The most compelling use (place *my* product into a scene) needs reference-image upload, which is itself deferred. Building the raw-prompt field first ships a half-feature. |
| **Pipeline change** | `buildAdImagePrompt` currently owns the anti-text / no-logo / aspect rules that keep Meta from rejecting creatives. A raw override has to re-assert those guardrails (or risk text-in-image rejections), so it's not a pure passthrough. |

### Prerequisite gates

- [ ] A real user hits the limit of the single-brief flow and asks for image-only control, OR
- [x] Reference-image upload (+ icon in the prompt bar) is being built — do both together *(shipped 2026-06-24: image-guided generation via OpenAI `/v1/images/edits`. This companion gate has cleared — the raw-prompt field can now be picked up whenever; it stays deferred until a user asks for image-only control.)*
- [ ] Decide the guardrail story: does the raw prompt still get the anti-text / no-logo / size rules appended, or is the user fully on their own?

### When the gate clears — how we'd approach it

1. Add optional `imagePrompt` state in `AIGenerateModal`; collapsible "Advanced" section.
2. In `generate()`, if `imagePrompt` is non-empty, send it to `/ai/generate-image` as a new `rawPrompt` field; route uses it verbatim (still appending the Meta-safety suffix unless we decide otherwise) instead of calling `buildAdImagePrompt`.
3. Seed the field from a photographer/CGI template (the user's reference).
4. Brief continues to drive copy generation untouched.
5. When reference-image upload lands, add a product-placement template that references the uploaded image.

---

## 🖼️ Multi-provider image generation (FLUX schnell + OpenAI)

**Status:** Deferred (decided 2026-06-24, build later)
**Earliest start:** When we next iterate on image quality — likely right after App Review / first beta feedback, when weak `gpt-image-1-mini` output becomes a real complaint.
**Inspired by:** Founder observation that `gpt-image-1-mini` quality is too low for shippable ad creatives.

### What it is

Run **two** image providers side by side instead of OpenAI alone, and route by
the **outputs** count (the 1–3 chip in AI Generate):

| Outputs requested | Provider split |
|---|---|
| **1** | **FLUX first** (FLUX.1 [schnell] on Fal) |
| **2** | **1 from FLUX + 1 from OpenAI** (`gpt-image-1-mini`) — give the user a choice of styles |
| **3** | TBD — likely 2 FLUX + 1 OpenAI (decide when building) |

Rationale: FLUX.1 [schnell] is **better quality AND cheaper** than mini (~$0.003
vs $0.005/img) and **Apache 2.0** (fully clear for commercial use, no
self-hosting — runs serverless on Fal). Keeping OpenAI in the mix at outputs≥2
gives stylistic variety (the two models have different "looks") and a built-in
fallback if one provider is down.

### Why we want it

- **Quality** — the immediate driver. mini's output isn't good enough for ads.
- **Cost** — FLUX schnell is cheaper per image, so leading with it at outputs=1 is a win on both axes.
- **Variety + resilience** — two providers = two visual styles to pick from, and one degrades gracefully if the other fails (same best-effort pattern `generate()` already uses).

### Why we are NOT building it yet

| Constraint | Reality |
|---|---|
| **Not the current priority** | App Review + beta come first. Provider-swapping is polish, not a blocker. |
| **New dependency + key** | Adds a Fal account, `FAL_KEY` env, and a second failure mode to monitor. Worth it, but not mid-App-Review. |
| **Reference-image path needs porting** | The `+` reference feature currently uses OpenAI `/images/edits`. FLUX's equivalent is **FLUX.1 Kontext / img2img** on Fal — needs wiring before reference + FLUX work together. |

### Prerequisite gates

- [ ] Current OpenAI-only flow is stable in beta (no point adding a provider mid-instability)
- [ ] Decide the outputs=3 split
- [ ] Confirm Fal pricing + that FLUX schnell quality holds for *ad* imagery (not just demo prompts)

### When the gate clears — how we'd approach it

1. **Abstract the provider seam.** Today [openai-image.service.ts](apps/api/src/services/openai-image.service.ts) is OpenAI-specific. Introduce a small `ImageProvider` interface (`generateImage(prompt, aspect, reference?)`) with `OpenAIImageProvider` + `FalFluxProvider` implementations. This is the same seam we used for the Gemini→OpenAI swap.
2. **Add `FalFluxProvider`** — Fal API, model `fal-ai/flux/schnell`; for the reference path use **FLUX.1 Kontext** (`fal-ai/flux-pro/kontext` or img2img variant) instead of `/images/edits`. New env: `FAL_KEY`.
3. **Routing lives in the route, not the providers.** In `POST /ai/generate-image` (or a new batch endpoint), pick the provider per the outputs-count table above. Simplest: frontend keeps firing N parallel calls (as it does now) but tags each call with a `provider` hint, OR the backend owns the split. Backend-owned split is cleaner — one call with `outputs`, route fans out.
4. **Keep OpenAI as fallback** — if FLUX errors, fall back to OpenAI for that slot rather than returning an empty image (mirror the existing `firstImageError` graceful-degrade logic in `generate()`).
5. **Guardrails carry over** — `buildAdImagePrompt`'s anti-text/no-logo rules apply to FLUX too (FLUX also tends to render text); reuse the same prompt builder.

---

## 📊 Real Meta reach estimate for Audiences

**Status:** Deferred
**Earliest start:** After Meta App Review approved (Standard Access)
**Inspired by:** Audiences feature shipped 2026-06-24 with honest "approx size" only — see [AUDIENCES.md](AUDIENCES.md).

### What it is

Replace the best-effort "approx size" on audience cards + in the builder with a
**real reach range** from Meta's `delivery_estimate` API. When a user builds or
edits an audience (or loads one in the publish wizard), show the true estimated
reach for the targeting spec, recomputed as they edit.

### Why we are NOT building it yet

| Constraint | Reality |
|---|---|
| **Access tier** | Delivery/reach estimates are most reliable at Standard Access — which we only get once App Review is approved. Building against Dev Access risks inconsistent numbers. |
| **Async + flaky** | Meta's estimate isn't always ready instantly (`estimate_ready: false`); needs polling/loading states and graceful "estimate pending" UX. |
| **Not blocking** | The honest "approx size" (interest `audience_size` / custom-audience `approximate_count`) is good enough to ship the feature; real reach is a polish upgrade. |

### Prerequisite gates

- [ ] Meta App Review approved → Marketing API at Standard Access
- [ ] Audiences feature validated in beta (people actually build + reuse them)

### When the gate clears — how we'd approach it

1. Add `metaService.estimateReach(token, accountId, targeting, optimizationGoal)` → `GET /act_<id>/delivery_estimate`; handle the async "estimate not ready" state (return a pending flag, let the client poll).
2. Surface a real reach range on the audience cards + builder, replacing the "approx size" line. Store the last-computed range on the `Audience` row (optional) or compute on demand.
3. Recompute when targeting changes in the builder (debounced).
4. Optionally surface the same estimate live in the publish wizard's targeting step.

---

## (Add more deferred features below this line as they come up)

<!--
Template:

## 🏷️ Feature Name

**Status:** Deferred
**Earliest start:** When [gate]
**Inspired by:** [source]

### What it is
…

### Why we want it
…

### Why we are NOT building it yet
…

### Prerequisite gates
- [ ] …

### When all gates clear — how we'd approach it
…
-->
