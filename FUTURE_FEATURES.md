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
