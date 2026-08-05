# Ad Set + Ad implementation plan

**Status:** not started. A spike was begun on 2026-08-02 and fully reverted — see
[Where things stand](#where-things-stand). Nothing from it remains in the repo or
the database.

**Goal:** close the largest remaining gap in the Meta integration — everything
below campaign level is currently invisible and unmanageable.

---

## Why this matters

Meta splits every campaign into three levels:

| Level | Answers | What lives there |
|---|---|---|
| **Campaign** | *Why* | The objective — Traffic, Sales, Leads, Awareness |
| **Ad Set** | *Who, how much, where, when* | Targeting (age, gender, geo, interests, custom audiences), **budget**, schedule, placements |
| **Ad** | *What people see* | Image/video, headline, body copy, CTA, destination link |

We model **Campaign** and we model **Creative** (our own asset library), but we
have no representation of the two layers Meta actually delivers through. The
consequences are concrete, not cosmetic:

1. **`/campaigns/:id` → Ad Sets tab is a hardcoded "coming soon" placeholder**
   ([campaigns/[id]/page.tsx](../apps/web/app/(dashboard)/campaigns/[id]/page.tsx),
   `AdSetsTab`, marked `TODO(phase-3)`). Same for the Creatives and Audience tabs.

2. **Editing a campaign budget never reaches Meta.**
   [`PUT /campaigns/:id`](../apps/api/src/routes/campaigns.ts) writes to our DB
   and stops. The user sees "Campaign saved" while Meta keeps spending the old
   amount. This is a silent data-divergence bug and it is the highest-priority
   item here.

   The reason it belongs in *this* plan: our publish flow deliberately creates
   the campaign **without** a budget and puts the budget on the ad set
   (see the comment in [`POST /campaigns/:id/publish`](../apps/api/src/routes/campaigns.ts)
   — campaign-level CBO is opt-in and we don't use it). So there is no
   campaign-level budget on Meta to update. Fixing the bug *requires* ad-set
   write support.

3. **No per-ad-set or per-ad performance.** Metrics are campaign-level only, so
   you can't tell which audience or which creative is carrying the results —
   which is the single most useful thing a media buyer does.

4. **No A/B testing.** The standard workflow (one campaign, several ad sets with
   different audiences, compare) is impossible to represent.

5. **Campaigns synced from Ads Manager are opaque.** A boosted post or anything
   built outside Advertix routinely has several ad sets. We show one row and
   none of the structure.

---

## Where things stand

A spike on 2026-08-02 added the schema models and the Meta read methods, then
was stopped and reverted to prioritise other work.

**Reverted — none of this is in the repo:**

- `AdSet`, `AdSetMetrics`, `Ad`, `AdMetrics` models in
  [schema.prisma](../apps/api/prisma/schema.prisma)
- `getAdSets`, `getAds`, `normalizeAdCreative`, `getInsightsByLevel`,
  `getReachByLevel` and the `MetaAdSet` / `MetaAd` / `MetaEntityInsight`
  interfaces in [meta.service.ts](../apps/api/src/services/meta.service.ts)

**Database is clean.** The spike's `prisma db push` did create the four tables;
they were verified empty and dropped, and `prisma migrate diff` confirms the DB
now matches the committed schema exactly. Start tomorrow from a clean `db push`.

**What did survive** (committed as `f96ad88 publish to meta fixes`) and is
unrelated to ad sets:

- `advantage_audience` flag fix in `createAdSet` — Meta now requires an explicit
  Advantage+ audience decision on every ad set or it rejects creation
- Budget-field fixes in the create wizard and campaign settings (clearable
  input, seeded from the account's real minimum)
- Removal of the temporary `meta-warmup.service.ts` cron

---

## Design decisions already made

Worth keeping — these were reasoned through during the spike.

**Budget lives on the AdSet, not the Campaign.** Mirrors what we actually send
to Meta. Any budget edit must be pushed to the ad set.

**Store Meta's `effective_status` verbatim alongside our normalised
`CampaignStatus` enum.** Our enum answers "is it on?"; `effective_status`
answers "why isn't it delivering?" (`PENDING_REVIEW`, `WITH_ISSUES`,
`DISAPPROVED`, …). Both are needed — collapsing to the enum loses the diagnosis.

**Denormalise `campaignId` onto `Ad`** as well as `adSetId`, so the campaign
detail page can list every ad in one query without joining through ad sets.

**Fetch ad sets and ads account-wide, not per campaign.** One paged call beats N
calls when a user has dozens of campaigns; group by `campaign_id` client-side.

**Reach is stored on the entity, never in the daily metrics table.** It is
de-duplicated across the period, so summing daily rows overcounts. Same
reasoning as the existing `Campaign.reach`.

**Store the full Meta targeting spec as JSON on the ad set.** Round-tripping it
is what makes "edit targeting" possible later without rebuilding it from parts.

---

## Implementation steps

Ordered so each step is independently useful and testable.

### 1. Schema

Add to [schema.prisma](../apps/api/prisma/schema.prisma):

- **`AdSet`** — `workspaceId`, `campaignId`, `externalId`, `name`, `status`
  (`CampaignStatus`), `effectiveStatus`, `budget` (Decimal 12,2), `budgetType`,
  `optimizationGoal`, `billingEvent`, `bidStrategy`, `targeting` (Json),
  `startDate`, `endDate`, `reach`.
  `@@unique([campaignId, externalId])`, indexes on `workspaceId`, `campaignId`,
  `externalId`.
- **`AdSetMetrics`** — same column set as `CampaignMetrics`,
  `@@unique([adSetId, date])`.
- **`Ad`** — `workspaceId`, `campaignId`, `adSetId`, `externalId`, `name`,
  `status`, `effectiveStatus`, `reviewStatus`, `externalCreativeId`,
  `creativeThumbnailUrl`, `headline`, `body`, `linkUrl`, `callToAction`.
  `@@unique([adSetId, externalId])`.
- **`AdMetrics`** — same shape, `@@unique([adId, date])`.
- Add `adSets AdSet[]` and `ads Ad[]` relations to `Campaign`.

All relations `onDelete: Cascade` so deleting a campaign cleans up beneath it.

Then `npx prisma db push`.

### 2. Meta service — read

In [meta.service.ts](../apps/api/src/services/meta.service.ts):

- `getAdSets(token, adAccountId): MetaAdSet[]`
  `GET /{act_id}/adsets`, fields:
  `id,name,campaign_id,status,effective_status,daily_budget,lifetime_budget,optimization_goal,billing_event,bid_strategy,targeting,start_time,end_time,created_time`
  Use `graphFetchAll` (paging) with `limit=200`.

- `getAds(token, adAccountId): MetaAd[]`
  `GET /{act_id}/ads`, fields:
  `id,name,adset_id,campaign_id,status,effective_status,created_time,creative{id,thumbnail_url,title,body,object_story_spec,call_to_action_type}`
  The `creative{...}` field expansion avoids a second round-trip per ad.

- `normalizeAdCreative(creative)` → `{ thumbnailUrl, headline, body, linkUrl, callToAction }`

  **This is the fiddly bit.** Meta nests the same four fields differently per format:
  | Format | Headline | Body | Link |
  |---|---|---|---|
  | Link / image | `object_story_spec.link_data.name` | `link_data.message` | `link_data.link` |
  | Video | `object_story_spec.video_data.title` | `video_data.message` | — |
  | Carousel | `link_data.child_attachments[0].name` | `link_data.message` | `child_attachments[0].link` |

  Top-level `title` / `body` are populated on some creatives and not others —
  use them as the last-resort fallback, not the primary source.

- `getInsightsByLevel(token, adAccountId, level: "adset" | "ad", datePreset)`
  `level` decides whether `adset_id` or `ad_id` comes back. `time_increment=1`
  for daily rows, **`limit=500`** — 30 days × 10 ads blows past Meta's default
  page size of 25 and a silent truncation under-reports spend.

- `getReachByLevel(token, adAccountId, level, datePreset)` → `Record<id, number>`
  No `time_increment` (see the reach note above).

Budgets come back as minor-unit strings (`"27911"` = 279.11) — divide by 100,
same as campaigns.

### 3. Meta service — write

- `updateAdSet(token, adSetId, { name?, dailyBudget?, lifetimeBudget?, status?, targeting?, startTime?, endTime? })`
  `POST /{adset_id}`. Budgets ×100 on the way out. Only send provided fields.
- `updateAd(token, adId, { name?, status? })`

`updateCampaignStatus` is already generic (it POSTs `{status}` to any object id)
and is reused for campaign/adset/ad in the launch route — keep that, add the
above for the non-status fields.

### 4. Sync

In [sync.service.ts](../apps/api/src/services/sync.service.ts), extend
`syncMetaAccount` after the existing campaign sync:

1. `getAdSets` → upsert by `(campaignId, externalId)`, building a
   `metaAdSetId → our id` map. Skip ad sets whose `campaign_id` isn't in the
   campaign map (campaign outside our sync window).
2. `getAds` → upsert by `(adSetId, externalId)`, running each creative through
   `normalizeAdCreative`.
3. `getInsightsByLevel("adset")` → upsert `AdSetMetrics`.
4. `getInsightsByLevel("ad")` → upsert `AdMetrics`.
5. `getReachByLevel` for both → snapshot onto the entity rows.

Reuse the existing revenue derivation (real `action_values` first, `roas × spend`
only as fallback) — do not re-derive it differently here.

Return the new counts in `SyncResult` so the sync toast can report them.

**Watch the call budget.** This roughly doubles the Meta calls per sync. Steps
3–5 are the expensive ones; consider making ad-level insights opt-in if rate
limits bite.

### 5. Routes

In [campaigns.ts](../apps/api/src/routes/campaigns.ts) (or a new `ad-sets.ts`):

- `GET /campaigns/:id/ad-sets` — ad sets + aggregated totals, ads nested or
  separate
- `GET /campaigns/:id/ads`
- `PATCH /ad-sets/:id` — budget / status / name; **writes to Meta first, then
  our DB**, so a Meta rejection doesn't leave us lying to the user
- `PATCH /ads/:id` — status

Wrap Meta failures in `friendlyMetaError` exactly as the publish route does.

### 6. Fix the budget bug

`PUT /campaigns/:id` must, when `budget` changes on a published Meta campaign,
push the new value to the ad set (`updateAdSet`) before committing locally. If
Meta rejects it, return the friendly error and leave our value untouched.

This is worth doing **even if the rest of this plan slips** — it is a
correctness bug, not a missing feature.

### 7. Frontend

- **`AdSetsTab`** — replace the placeholder with real rows: name, status badge
  (using `effectiveStatus` for the "why"), budget, audience summary from the
  targeting JSON, spend / impressions / clicks / CTR, and per-ad-set
  pause/resume with loading state.
- **`CreativesTab`** — the campaign's actual ads: thumbnail, headline, body,
  CTA, per-ad metrics, review status.
- **`AudienceTab`** — render the targeting spec of the ad sets in plain English.

Follow the existing conventions: `useApi` for fetching, skeletons while loading,
`EmptyState` when genuinely empty, `MetaErrorCard` for errors, and a loading
state on every async button.

---

## Gotchas

- **Ad sets that vanish.** Meta ad sets can be deleted server-side. Upserting
  never removes stale local rows — decide whether to soft-delete rows absent
  from a sync, or leave them. (Same latent issue exists today for campaigns.)
- **`effective_status` ≠ `status`.** An ad can be `status: ACTIVE` and
  `effective_status: DISAPPROVED` — looks live, delivers nothing. Surface the
  effective one.
- **Deleted campaigns cascade.** Verify the cascade actually fires before
  shipping; an orphaned `AdMetrics` row is a silent leak.
- **A campaign published by us has exactly one ad set** named
  `<campaign name> — Ad Set`. Campaigns synced from Ads Manager may have many.
  The UI must not assume one.
- **Rate limits.** See the call-budget note in step 4.

---

## Rough sizing

| Step | Estimate |
|---|---|
| 1. Schema | 30 min |
| 2. Service reads | 1–2 h |
| 3. Service writes | 1 h |
| 4. Sync | 2–3 h |
| 5. Routes | 1–2 h |
| 6. Budget bug fix | 1 h |
| 7. Frontend (3 tabs) | 4–6 h |

Roughly **1.5–2 focused days**, with steps 1–4 the foundation and 6 the one that
can be pulled forward on its own.

---

## Related

- [IMPLEMENTATION.md](../IMPLEMENTATION.md) — change log, newest entries first
- [META_PUBLISH_TEST_GUIDE.md](META_PUBLISH_TEST_GUIDE.md) — manual publish test path
- Overall Meta completeness assessed at **~65%** on 2026-08-02; post-publish
  management scored lowest (~30%), which is what this plan addresses.
