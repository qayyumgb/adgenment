# Audiences — Purpose, Benefits & Implementation Plan

The Audiences feature lets users **build, save, and reuse ad-targeting
definitions** (who an ad is shown to) instead of re-specifying targeting from
scratch on every campaign. It turns the previously static mock page
([apps/web/app/(dashboard)/audiences/page.tsx](apps/web/app/(dashboard)/audiences/page.tsx))
into a real, data-backed feature.

---

## What an "Audience" is

An **Audience** is a saved, reusable **Meta targeting spec** — the same
`MetaTargeting` JSON the campaign publish flow already sends to Meta when it
creates an ad set (age, gender, geo, interests, custom audiences, lookalikes,
placements). Saved workspace-scoped, it can prefill the publish wizard so the
same targeting is applied consistently across many campaigns.

There are **two kinds**, surfaced as two tabs:

1. **My Audiences** — targeting templates *we* persist in our DB (`Audience`
   model). Built either by AI or by hand. Fully editable, duplicable, reusable.
2. **Meta Audiences** — the user's **real** Custom / Saved / Lookalike audiences
   pulled live from their connected Meta ad account (read-only mirror), plus a
   "Create lookalike" action. Not persisted by us — always fetched fresh.

> **Scope:** Meta only in v1. Google/TikTok/LinkedIn use different targeting
> shapes; multi-platform audiences come later. Building an audience requires a
> connected Meta ad account (same gate as AI image generation).

---

## Why we want it (benefits)

- **Reusability** — define "Eco-conscious millennials, US, skincare" once; apply
  it to every relevant campaign. No re-typing, no drift.
- **Consistency** — the same audience means the same targeting spec every time,
  so performance comparisons across campaigns are apples-to-apples.
- **Speed via AI** — describe an audience in plain English and get a real,
  editable Meta targeting spec back (interests/geo resolved to actual Meta IDs).
- **Control via Manual** — power users build precisely with interest/geo/custom-
  audience pickers — the same pickers used in the publish wizard.
- **Foundation for optimization** — once saved and measurable, audiences become
  the unit we can later attach real reach estimates and performance to.

---

## Honesty principle (important)

The original mock showed `size`, `avgCpm`, `matchRate`, and `reachLow/High` —
**all fabricated**. For a product people trust with ad spend, we do **not** show
invented numbers. Instead:

- **Now:** show only what's real — the targeting criteria summary, the audience
  **type**, and an **approximate size** *only where Meta actually provides it*
  (interest `audience_size`, custom-audience `approximate_count`). When unknown,
  we say "size unknown" rather than guess. CPM / match-rate are dropped.
- **After Meta App Review** (see phase 2): replace approx size with a **real
  reach range** from Meta's `delivery_estimate` API.

---

## Builders — AI and Manual (user chooses)

The build modal offers a mode toggle:

- **AI** — a text description → our `/ai/generate-audience` endpoint. An LLM
  proposes structured targeting (age/gender/geo/interests); the server then
  **resolves** interest and location names to real Meta IDs via the existing
  `/meta/interests` and `/meta/locations` search endpoints. The result is shown
  as editable chips before saving.
- **Manual** — age/gender controls + interest search + geo search + custom-
  audience picker (the shared targeting components, reused from the publish
  wizard). Produces an identical `MetaTargeting` spec.

Both paths save through the same `POST /audiences` endpoint.

---

## How it connects to campaigns

In the publish wizard's targeting step, a **"Load saved audience"** dropdown
seeds the wizard state (age/geo/interests/custom-audiences) from a chosen saved
audience. The user can still tweak before publishing. This is the primary
integration point — saved audiences flow straight into real ad-set targeting.

---

## Architecture (where things live)

| Layer | Location |
|---|---|
| Data model | `Audience` model in [apps/api/prisma/schema.prisma](apps/api/prisma/schema.prisma) (workspace-scoped, stores `targeting` JSON) |
| CRUD API | `apps/api/src/routes/audiences.ts` (mirrors `creatives.ts`) |
| AI builder | `POST /ai/generate-audience` + `aiService.generateAudienceTargeting()` |
| Meta primitives (reused) | `meta.service.ts`: `getCustomAudiences`, `getSavedAudiences`, `searchInterests`, `searchLocations`, `createLookalikeAudience` |
| API client | `getAudiences` / `createAudience` / `updateAudience` / `deleteAudience` / `duplicateAudience` / `generateAudienceTargeting` in [apps/web/lib/api.ts](apps/web/lib/api.ts) |
| Shared UI | `apps/web/components/targeting/` (InterestSearch, GeoSearch, CustomAudiencePicker — extracted from the publish wizard) |
| Page | [apps/web/app/(dashboard)/audiences/page.tsx](apps/web/app/(dashboard)/audiences/page.tsx) |

---

## Implementation plan (build order)

0. **This doc.**
1. **Data model** — `Audience` model + `AudienceType` enum + `Workspace.audiences`
   relation; migration `add_audience`.
2. **CRUD route** — `audiences.ts` (list/create/update/delete/duplicate),
   workspace-scoped, registered at `/audiences`.
3. **AI builder** — `generateAudienceTargeting()` service method + the
   `/ai/generate-audience` route that resolves names → real Meta IDs.
4. **API client** — Audience types + methods in `api.ts` (reuse existing Meta
   audience/interest/location methods).
5. **Shared targeting components** — extract InterestSearch / GeoSearch /
   CustomAudiencePicker out of `PublishToMetaModal.tsx` into
   `components/targeting/` so the builder and the wizard share one copy.
6. **Page** — convert mock → real: two tabs, honest cards, AI|Manual build modal,
   Edit/Duplicate/Delete wired to the API.
7. **Publish integration** — "Load saved audience" dropdown in the wizard.
8. **Docs** — IMPLEMENTATION.md changelog; FUTURE_FEATURES.md reach-estimate phase.

---

## Phase 2 — real Meta reach estimate (deferred)

**Gate: Meta App Review approved** (delivery estimates are most reliable at
Standard Access). Then:

- Add `metaService.estimateReach(token, accountId, targeting, optimizationGoal)`
  → `GET /act_<id>/delivery_estimate`, handling the async "estimate not ready"
  state.
- Surface a **real reach range** on audience cards and in the builder, replacing
  the approx-size signal.
- Recompute when targeting is edited.

Tracked alongside the other gated work in
[FUTURE_FEATURES.md](FUTURE_FEATURES.md).
