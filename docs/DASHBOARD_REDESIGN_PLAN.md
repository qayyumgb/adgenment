# Dashboard redesign — implementation plan

**Status (2026-10-26):** **Phase 0, A1, B1, A2, A3, A4, B2, A5, B5, A6, B3, A10, A7, B4, A8, A9, B6, A11, A12, A13, A14 and A15 done**: tracks A and B are complete (see [§ 11](#11-progress)). Next: Track C. A10 was done ahead of A7 (it doesn't depend on it). Pre-launch items (OAuth nonce, Clerk production) stay on their own track.

**Goal:** rebuild the logged-in product (`app.advertix.io`) to the new design, keep every feature that works today, and add the new agency features from the mockups. Do it in an order where no button pretends to do something it doesn't.

**Sources of truth** (`F:\prev-desktop\proexe\advertix-repo\Advertix UI Redesign mockup\`):

| File | Role |
|---|---|
| `docs/Advertix UI Guide.md` | Design system: tokens, type, shell, components, data-grid rules, interaction rules. **Wins over the mockups and the code if they disagree.** |
| `docs/Claude Agent Prompt.md` | Build order and ground rules (Step 1 foundations → Step 2 shell → Step 3 DataGrid → Step 4 pages) and the per-page acceptance checklist |
| `Overview`, `Campaigns v2`, `Campaign Detail v2`, `New Campaign`, `Creatives`, `Audiences`, `Analytics`, `Budgets`, `AI Planner`, `Connections`, `Settings` `.dc.html` | Page targets (inline styles are the spec) |
| `Modals.dc.html` | Dialogs D1–D7 |
| `Feature Proposals.dc.html` | Product review: 12 recommendations, new features F1–F8 |
| `Mobile.dc.html`, `_parts/shell-gen.js` | Mobile shell and the shared sidebar / top bar / page header |

**Ignore:** `Dashboard.dc.html`, `Campaigns.dc.html`, `Campaign Detail.dc.html` (v1 — built on the separate "Modernist" design system in `_ds/`, superseded by v2), `Dashboard v2` options 2b and 2c (Overview is option 2a), `uploads/` (feedback screenshots, not specs), `marketing/` (already shipped — [MARKETING_REDESIGN_PLAN.md](MARKETING_REDESIGN_PLAN.md)).

---

## 1. Summary

The new design is an **agency product**: one workspace runs many **clients**, every page filters by client, and the AI's suggestions sit next to the data with *Apply → Applied → Undo*. Today's backend is a **single-brand product** where:

- there is **no Client entity**: ad accounts, campaigns, creatives and audiences belong straight to the workspace;
- **"Apply" doesn't apply.** `insights/:id/apply` only flips a status, and the budget optimizer's apply writes our database, not Meta. There's no change log and no undo;
- a campaign has **one ad set and one ad** (IDs on the Campaign row). There are no ad-set or ad tables and no ad-level metrics, frequency or fatigue;
- there are **no alerts, approvals, team invites (stubbed), notification channels, scheduled jobs (besides a 6-hour Meta sync), billing or Snapchat**.

So this is **two projects running side by side**:

1. **UI revamp (Track A).** Mostly frontend. Every page is rebuilt on new tokens, primitives, shell and a shared DataGrid, wired to today's API wherever the data exists.
2. **Backend foundations (Track B).** Client, real suggestions with execution and undo, change log, ad sets and ads, and a set of small API exposures. These unlock about half of what the mockups show.

The **new features** (Track C: alerts, approvals, client portal, ⌘K, flight calendar, smart hours, experiments, Snapchat, Stripe) come after the core of A and B.

Rough size: **Track A ≈ 60 working days, Track B ≈ 30, Track C ≈ 80+**, for one developer. Details in [§ 9](#9-sizing).

---

## 2. Where the app is today

From a full read of `apps/web` and `apps/api`.

| Area | State today |
|---|---|
| Shell | Always-dark fixed sidebar, no mobile layout (no drawer, no bottom bar). The collapsed sidebar can't be re-expanded (bug). The workspace card is hard-coded "My Workspace". The header's notifications, ⌘K search, bell and help are fake |
| Theme | `darkMode: "class"` is configured, but nothing toggles it; pages hard-code `slate-*` and hex values. Font: Plus Jakarta Sans |
| Primitives | Only `Modal`, `Skeleton`, `EmptyState`, `WizardRail`, `MetaErrorCard`, `VideoThumbnailPlayer`. No shared Button, Input, Select, Tabs, Badge, Card, Table, Menu — each page re-implements them |
| Data fetching | `useApi` has no cache or dedupe; `getMe` is fetched twice per page; the sidebar refetches on every navigation; Campaigns makes 4 calls just for status counts |
| Real data | Dashboard, Campaigns, Campaign detail (Overview + Settings tabs), Audiences, Creatives, Analytics, Insights, Budget optimizer, AI Planner, Settings General/Workspace/Integrations |
| Fake / mock | Billing (entirely), Settings Notifications / API keys / Security / Danger zone, Insights chat widget, header notifications, Campaign detail Ad sets / Creatives / Audience tabs, "Duplicate" / "Archive" menu items, Analytics "Export report", Creatives `FALLBACK_COPY` when AI copy fails |
| Platforms | **Meta: full** (OAuth, sync, health, publish, launch/pause, edit, delete). Google / TikTok / LinkedIn: OAuth + read-only manual sync. Snapchat, YouTube, Pinterest, X: enum only |
| Giant files | `creatives/page.tsx` 5,241 lines, `PublishToMetaModal.tsx` 2,757, `settings/page.tsx` 1,712, `CreateCampaignModal.tsx` 1,453, four ~270-line near-identical `*Connect.tsx` |

**Bugs and security found during the review (fix in Phase 0):**

- `POST /api/ai/generate-copy` has **no `requireAuth`** (`apps/api/src/routes/ai.ts:248`), so anyone can spend our AI budget.
- Mojibake ("Syncingâ€¦") in `components/settings/{Google,LinkedIn,TikTok}Connect.tsx`.
- `/budget-optimizer` is missing from the middleware's `APP_ONLY_PREFIXES`.
- Dead code: `components/dashboard/CampaignTable.tsx`, `app/api/ai/plan-campaign/route.ts`.
- The onboarding gate is unreachable (the auth middleware auto-creates a workspace).

---

## 3. Ground rules for this project

1. **The guide wins.** Tokens, sizes, radii and copy come from `Advertix UI Guide.md` and the mockups; no invented colours.
2. **Nothing working gets dropped.** Every current capability has a home in the new UI — see the parity checklist in [§ 7](#7-feature-parity-checklist). If the mockup leaves something out (e.g. the Meta Page picker, destination URL, Insights list, Meta audiences tab), we add it in the new style.
3. **No fake actions.** A button either does what it says or is visibly disabled with the reason ("Available when Google publishing ships"). In particular, any *Apply* that touches spend must really execute and be undoable, or it doesn't ship as "Apply".
4. **Mock data never reaches production users.** Following the agent prompt, sections whose API doesn't exist yet are built against a typed interface plus a mock in `apps/web/lib/mocks/` with a `// TODO(api): <endpoint>` comment. But mocks are **only shown in development or behind `NEXT_PUBLIC_UI_PREVIEW=1`**. In production the section shows its empty or "coming soon" state.
5. **Client is the context.** Every list and analytics call takes the selected client from `ClientContext` (persisted as `?client=`). Until Track B1 lands, that context holds "All clients" only, and the switcher reads "All clients".
6. **Per page:** match the mockup at 390 / 768 / 1024 / 1440 in light and dark; empty, loading (skeleton) and error states; keyboard reachable; `tsc --noEmit` + `next lint` clean; guide's acceptance checklist ticked.

---

## 4. Decisions needed before we start

Recommended answer first.

**Decided 2026-10-21:**
- **#1 Clients** → new `Client` model, ad accounts assigned to clients, one default client for single-brand workspaces.
- **#2 Start order** → Phase 0, then UI foundation (A1–A3) in parallel with Clients (B1), then pages.
- **#3 Mock data** → dev / preview flag only; production shows empty or "coming soon" states.
- **#4 AI Apply** → only actions that really execute and can be undone; others show "Review".
- Items 5–12 still open; they're needed before the phase that uses them, not to start.

1. **Clients.** **Recommend:** a new `Client` model (name, short mark, vertical, logo, monthly budget, autonomy, ask-first) with `AdAccount.clientId`; campaigns, creatives, audiences and metrics inherit the client through their ad account. Single-brand workspaces get one default client, and the switcher hides itself when there's only one client.
2. **Order of work.** **Recommend:** Track A (foundations → shell → DataGrid) and Track B1 (Clients) in parallel first, then pages. Building pages on a workspace-only API and retrofitting clients later means touching every page twice.
3. **Mock policy in production.** **Recommend:** as in [§ 3.4](#3-ground-rules-for-this-project) — dev / preview flag only.
4. **Suggestions.** **Recommend:** a unified `Suggestion` model replacing `Insight` and `BudgetRecommendation` (migrate both), with per-kind executors. Phase 1 executes only what we can do for real on Meta (budget change, pause/resume, rotate ad); other kinds show **Review** (opens the item) instead of Apply.
5. **Ad sets and ads.** **Recommend:** add `AdSet` and `Ad` tables plus ad-level daily metrics (incl. frequency) for **Meta first**. This unlocks Campaign detail tabs, creative performance, fatigue and audience performance.
6. **New campaign wizard shape.** **Recommend:** keep **one Campaign row per platform** (today's model), grouped as one "launch" in the wizard. Publishing stays Meta-only, and other platforms save as drafts marked "publishing coming soon". The wizard gains the Meta-required fields the mockup omits: Page, destination URL, CTA, placements, gender, geo search, interests, custom/lookalike audiences, plus the live ad preview.
7. **Roles — decided 2026-10-22 (B6):** agency roles, enforced on the API. **Was recommended:** migrate `WorkspaceRole` to `OWNER | MEDIA_BUYER | ANALYST | CLIENT_VIEWER` (ADMIN/EDITOR → MEDIA_BUYER, VIEWER → ANALYST) plus `MemberClientAccess`.
8. **Snapchat and other unbuilt platforms.** **Recommend:** shown as "Coming soon" (never "connected") in the sidebar box, Connections and the wizard, until a connector exists.
9. **Campaigns grid suggestion flow.** The mockup has Apply → Applied with no Not now or Undo. **Recommend:** follow guide § 6 everywhere (Apply → Applied → Undo; Not now → Snoozed).
10. **Billing.** **Recommend:** no Stripe in this project. The Billing tab shows the real plan from the DB and usage computed from real data; "Change plan" links to `/pricing` / contact. Prices come from `apps/web/lib/marketing/pricing.ts`, which removes today's $699 vs $499 conflict.
11. **Automation levels.** **Recommend:** "Suggest only" works from day one. "Auto-apply small changes" and "Autopilot" are visible but disabled ("Available once Approvals & undo ship") until Track B3 exists (guide principle 5: nothing changes without consent).
12. **Data fetching.** **Recommend:** add **SWR** (~4 KB) behind `useApi` for caching and dedupe. It fixes the duplicate fetches without touching every call site's shape.

---

## 5. Technical approach

### 5.1 Tokens, fonts, theme

- Guide § 2.1 tokens become CSS variables on `:root` and `.dark` in `globals.css` (`--bg`, `--surface`, `--surface-2/3`, `--ink`, `--ink-2/3`, `--line`, `--line-2`, `--brand`, `--brand-hover`, `--brand-soft`, `--brand-soft-2`, `--brand-ink`, `--brand-mid`, `--grad`, `--pos/neg/warn` + `-soft`). They don't collide with the marketing site, which uses `--mk-*` scoped to `.mk`.
- Tailwind maps them to colours (`bg-surface`, `text-ink-2`, `border-line`, `bg-brand-soft` …), radii (`card 16`, `menu 14`, `ctl 10`) and shadows (`card`, `pop`).
- Font: **Geist** for the whole app via the `geist` package (already installed for marketing). Plus Jakarta Sans is removed once the last old page is gone.
- Dark mode: a `ThemeProvider` toggles `.dark` on `<html>` (saved per user in localStorage, defaulting to the OS). The mockups' `[data-theme=dark]` maps to `.dark`.
- The old utilities (`.glass-card`, `.metric-card`, `.gradient-text`, `.btn-brand`, `primary-*` indigo, `sidebar-*`) are deleted when nothing uses them.

### 5.2 Folder layout

- `components/app/ui/` — primitives (Button, Segmented, Toggle, Checkbox, Pill, DeltaPill, PlatformBadge, Card, KpiCard + Sparkline, Menu, MultiSelectMenu, Drawer, Dialog with bottom sheet under 600px, EmptyState, Skeleton, AiSuggestion, AiNote, Tabs, SelectableCard, MeterBar, PacingBar).
- `components/app/grid/` — the DataGrid (column config, Sort / Columns / Row-height menus, sticky Action column, selection + bulk bar, footer totals, persisted per table in `localStorage` `advertix.grid.<tableId>`).
- `components/app/charts/` — hand-rolled SVG bar, line and area charts with the hover readout in the card header (guide § 6). Recharts stays only where a page still needs it, then goes.
- `components/app/shell/` — AppShell, Sidebar, ClientSwitcher, AdAccountsBox, TopBar, PageHeader, MobileAppBar, MobileDrawer, BottomTabBar, ThemeToggle.
- Page-specific pieces next to their routes (`components/app/<page>/`), so no page file grows past ~600 lines.
- `lib/mocks/` — typed mocks (preview only, [§ 3.4](#3-ground-rules-for-this-project)).
- `lib/publish/` — publish logic pulled out of `PublishToMetaModal.tsx` (targeting spec, placements, asset payload, URL validation, copy limits, schedule validation), so the wizard and any future publish surface share one implementation.
- `/dev/ui` — dev-only page showing every primitive in both themes (agent prompt Step 1.5).

### 5.3 Routes

| Today | New | Notes |
|---|---|---|
| `/dashboard` | `/dashboard` (Overview) | |
| `/campaigns`, `/campaigns/[id]` | same | |
| `CreateCampaignModal` (`?new=1`) | `/campaigns/new` | `?new=1` redirects; AI Planner prefill kept |
| `/creatives`, `/audiences`, `/analytics`, `/ai-planner` | same | |
| `/insights` | → `/analytics` (+ Overview suggestions) | redirect |
| `/budget-optimizer` | `/budgets` | redirect |
| `/billing` | `/settings?tab=billing` | redirect |
| Settings › Integrations | `/connections` | update ~15 `/settings?tab=integrations` links incl. the API's `meta-health.service.ts` `RECONNECT_URL` and middleware lists |
| — | `/activity` (Approvals & history, F2) | Track C |

### 5.4 Release approach

There are no real users yet (per IMPLEMENTATION.md), so pages are replaced **in place, one by one**, on `main`: you verify locally and push. The new shell lands early, so old pages render inside it for a while; that's acceptable pre-launch. Each page's PR description has screenshots at 1440 and 390, light and dark.

---

## 6. Phases

### Phase 0 — Fixes that shouldn't wait (≈ 1–2 days) — ✅ done 2026-10-21

- ✅ `requireAuth` on `POST /api/ai/generate-copy`; the Next proxy forwards the Clerk token. Verified: no token / fake token → 401. A route audit found no other unprotected endpoints besides `/api/ai/health` and the four OAuth callbacks, which must stay public.
- ✅ Expired Meta creative preview URLs are refreshed on read (`apps/api/src/services/meta-media-refresh.service.ts`), covered by a stubbed end-to-end test. Still to check live: open the Creatives library with creatives older than a few days.
- ✅ Mojibake and BOMs fixed in the three Connect components; `/budget-optimizer` added to `APP_ONLY_PREFIXES`; dead `CampaignTable.tsx` and the unused plan-campaign proxy deleted.
- *(Pre-launch, separate track):* OAuth state nonce (Roadmap 3.2), Clerk production instance (3.1).

### Track A — UI revamp

| # | Phase | Contents | Real data | Waits on |
|---|---|---|---|---|
| A1 | Foundations | Tokens, Geist, ThemeProvider, Tailwind mapping, primitives, `/dev/ui`, SWR behind `useApi` | — | — |
| A2 | Shell | Sidebar (client switcher, nav with live counts, **ad-accounts box** fed by ad accounts + token warning), top bar (search opens ⌘K later, role pill, alerts bell, theme toggle, help, avatar), PageHeader, mobile app bar / drawer / bottom tab bar; collapse bug fixed | ad accounts, campaign count, me | Clients (B1) for the switcher contents |
| A3 | DataGrid | Guide § 4.1 in full | — | — |
| A4 | **Overview** (`/dashboard`) | Greeting, 5 KPI cards with sparklines, spend & revenue chart (7/14/30D, hover readout), Advertix suggests, client pacing table | KPIs, chart, sparklines, suggestions (Insights for now) | Clients table + pacing need B1 + B5; real Apply needs B2 |
| A5 | **Campaigns** | KPI strip, AI banner + "Only show these", DataGrid (status segment with counts, platform multi-select, toggle pause/resume, suggestion column, sticky Action), bulk bar (Pause, Resume, Edit budgets, Duplicate), footer totals, CSV export (client-side, D6 CSV) | rows, 30-day metrics (joined from `/analytics/campaigns`), toggles, bulk status | "Learning" status (B4); suggestion column (B2); duplicate endpoint (B5) |
| A6 | **Campaign detail** | Header with status toggle, tabs Overview / Ad sets / Ads / Change log; 6 KPIs; metric-switch chart with event markers; suggestions; **Ask about this campaign**; ad-set grid; ad tiles with fatigue bars. Keep today's Settings (rename, budget, delete), Launch on Meta, Ads Manager link, `?publish=1` | KPIs, chart, status, settings, publish/launch | Ad sets / ads / fatigue (B4); change log + markers (B3); Ask (new `POST /ai/campaigns/:id/ask`, B5) |
| A7 | **New campaign** (`/campaigns/new`) | 5-step wizard (Goal → Platforms & budget → Audience → Ads → Review & launch), live forecast + setup-strength panel, autosaved draft, done screen. **Plus the Meta-required fields** (decision 6), live MetaAdPreview, MetaErrorCard, pixel warning on the Goal step, budget floor and date validation, "Run continuously", AI Planner prefill | All of today's create + publish flow, restyled; forecast from 30-day analytics | Client step (B1); multiple ads per launch (B4) |
| A8 | **Creatives** | Creative studio (prompt, format, tone → 4 drafts), card grid (status segment, sort, size), detail drawer with Advertix read and Create variants. **Keep:** upload (image/video with progress + transcode polling, URL paste, carousel builder), copy-variant editor, edit/replace media, delete, kind/platform filters | library, AI generation, upload | Spend / ROAS / CTR / frequency per creative (B4) |
| A9 | **Audiences** | Stats, overlap and new-audience suggestion cards, DataGrid with type filter and overlap bars, D2 Create audience. **Keep:** Meta audiences (merged into the grid as a source), Build with AI (a "Describe it" tab in D2), manual builder pickers, edit / duplicate / delete (row menu), lookalike via `createMetaLookalike` | saved + Meta audiences, AI builder | "Used in", ROAS, CPA (audience↔campaign link, B4); overlap is an estimate (decision in [§ 10](#10-open-questions)) |
| A10 | **Analytics** (absorbs `/insights`) | 5 clickable KPI cards driving the line chart, previous-period compare, share panel (platform / client), 5-step funnel, breakdown grid (platform / client / **campaign**), D6 Export, D5 Schedule report. **Keep:** Insights list with Generate (1-hour gate), Apply, Dismiss, dismissed + Restore — as an "Advertix read" band | KPIs, chart, compare (2× window), share, breakdown by platform / campaign, insights | By client (B1); funnel landing-page-views and add-to-cart (B4 sync); scheduled reports (Track C) |
| A11 | **Budgets** (`/budgets`) | Cross-platform allocator (sliders on response curves, recommended markers, live projection, Use Advertix mix, Schedule these budgets), monthly pacing grid. **Keep:** per-campaign recommendations (move to the Campaigns suggestion column), history (→ Change log), insufficient-data states, a clear "planning mode — not pushed to the platforms" note until writes exist | curves fitted from daily metrics | Per-client caps (B1); scheduled live budget writes (B2/B3 + a nightly job) |
| A12 | **AI Planner** | Chat with starter briefs, reasoning steps, plan card (facts, timeline, campaigns, forecast, watch-outs), refinement chips, Create campaigns as drafts. **Keep:** clarify questions (reuse the chip row), "using your account" context, rich plan details (collapsible), open-one-in-the-wizard for Meta publishing | `planCampaign` (prompt + schema extended to plan v2) | Saved plans and versions (new `Plan` model, B5) |
| A13 | **Connections** (`/connections`) | Token warning, platform cards with auto-sync, ad-account grid (filter, Renew, Fix pixel, Assign client, Archive), D1 Connect dialog (3 steps). **Keep:** OAuth popups, per-platform sync, disconnect with confirm, full Meta health report (account drawer), `?connected=` / `?error=` toasts; one `useConnectPlatform` hook replaces the four Connect components | accounts, OAuth, sync, health | `lastSyncedAt` + `tokenExpiresAt` exposure, per-account 30-day spend (B5); Assign client (B1); D1 account selection (B5) |
| A14 | **Settings** (tabs General, Team, AI & automation, Notifications, Billing) | General (agency profile, reporting defaults), Team grid + D4 invite, AI & automation (autonomy, guardrail, ask-first clients, rules), Notifications matrix, Billing. **Keep:** workspace save, members / role / remove, and a home for API keys, security and danger zone (bottom of General + Clerk profile) | workspace, members | Invites (B6); autonomy / guardrail / rules (B3 + Track C); notification delivery (Track C) |
| A15 | Dialogs + QA | D1–D7 finished where their pages live (D1 Connections, D2 Audiences, D3 Creatives, D4 Settings, D5/D6 Analytics + Campaigns, D7 Campaigns + detail); full pass at 390 / 768 / 1024 / 1440 × light / dark; delete old components, Plus Jakarta and old utilities | — | — |

### Track B — Backend foundations

| # | Phase | Contents | Unlocks |
|---|---|---|---|
| B1 | **Clients** | `Client` model, `AdAccount.clientId`, CRUD `/clients`, `?clientId=` on campaigns / creatives / audiences / analytics / insights, `GET /analytics/by-client`, `Client.monthlyBudget` + `GET /budgets/pacing?month=` | Switcher, Overview client table + pacing, Analytics by client, Connections Assign client, Budgets, D1 / D2 / D4 |
| B2 | **Suggestions** | `Suggestion` model (kind, clientId, campaignId, title, reason, impact, actionLabel, doneLabel, actionPayload, status, snoozedUntil, suppressUntil, revertPayload); migrate Insights + budget recommendations; executors for Meta budget / status / rotate; `apply`, `snooze`, `undo` endpoints | Every Apply → Applied → Undo on Overview, Campaigns, Campaign detail, Creatives, Audiences, Budgets |
| B3 | **Change log & undo** | Immutable `ChangeLog` (actor user / AI / rule, before / after, campaign, approvedBy), 7-day undo window; every mutation (campaign PUT, suggestion apply, budget changes) writes to it | Campaign detail Change log tab + chart markers, Settings audit log, Approvals (F2), automation levels |
| B4 | **Ad sets, ads, richer metrics (Meta first)** | `AdSet`, `Ad` tables + daily ad-level metrics (frequency, reach, landing-page views, add-to-cart), learning status, 90-day backfill; `Campaign.audienceId` (or join table) | Campaign detail tabs, creative performance + fatigue, audience performance, funnel, "Learning" status, duplicate with ad sets |
| B5 | **Small API exposures** | `lastSyncedAt`, `tokenExpiresAt`, health summary on ad accounts; `days` window on `/campaigns`; previous-period series + `metric=cpa`; `POST /campaigns/:id/duplicate`; `POST /ai/campaigns/:id/ask`; `Plan` model; per-account 30-day spend; D1 account selection (stage discovered accounts instead of auto-adding all) | Bits of most pages |
| B6 | **Team** | `Invite` model + Resend email (the key is already used by `/api/contact`), role migration (decision 7), `MemberClientAccess`, seats from the plan | Settings › Team, D4, role pill |

### Track C — New features (after the core of A and B)

Ordered by value and dependencies (Feature Proposals + review):

| # | Feature | Depends on | Size |
|---|---|---|---|
| C1 ✅ | **F2 Approvals & history** — `/activity`: waiting-for-approval queue above the guardrail or for ask-first clients, history with Undo | B3, B6 | M |
| C2 ✅ | **F1 Alerts inbox** — header bell panel; anomaly engine (CPA spikes, pacing, tracking silence), health checks for all platforms, grouped per campaign, one-click fixes | B1, B3, job queue (C10), notification channels | L |
| C3 ✅ | **F5 Command palette (⌘K)** — clients, campaigns, actions; "Ask Advertix" needs `/ai/chat` (not yet) | B1 | S |
| C4 ✅ | **F4 Client portal + D5 Scheduled reports** — share links (token, toggles), public read-only view, weekly PDF + email | B1, PDF rendering service | L |
| C5 ✅ | **F7 Flight calendar** — `/calendar`: every client's launches and end dates on one timeline, overlap warnings, holiday markers | B1, SCHEDULED status | M |
| C6 ✅ | **F8 Schedule step** in the wizard (end date, auto-pause: spend cap, blackout dates, tracking stops; calendar warnings). Smart hours moved to C7; "Out of stock" needs Shopify (C18) | C1, C2 engine | M (+L for triggers) |
| C7 ✅ | **F6 Smart-hours heatmap** — Hours tab (campaign) + client view (Budgets); daily hourly report (Meta; Google/TikTok readers untested); 14 days + 300 conversions gate; Meta one-click hour schedule on lifetime budgets via Approvals with Undo; Google/TikTok exact steps; Smart hours switch (wizard + tab) | C1, hourly sync, Google / TikTok write parity | L |
| C8 | **Snapchat connector** — **kept "coming soon" everywhere (decided 2026-10-30)**; build the connector later, when a customer needs it | — | M |
| C9 ✅ | **F3 Experiments** — tests with significance, scale the winner. **Decided 2026-10-30:** Meta's own A/B test (ad studies, a fair randomised split), creatives first, in phases: **C9a** (M) Experiments page reading A/B tests on the account (incl. ones made in Ads Manager): results per version, confidence, expected end, early-stop note · **C9b** (L) create creative tests from Advertix + "Scale the winner" through Approvals with Undo (creative tests are `SPLIT_TEST_V2` on `/{business_id}/ad_studies`; check whether it needs the C16 Graph API upgrade first) · **C9c** (S) test history and lessons per client, fed to the AI Planner. **Other platforms: when Advertix gets write access to Google, TikTok, LinkedIn (and Snapchat, C8), add their experiments the same way** (Google Ads experiments, TikTok split tests, LinkedIn A/B tests) on the same Experiments page and model | B4, C1, (C16 for C9b) | XL |
| C10 | **Job queue** — BullMQ + Redis replaces the in-process `setInterval`; multi-platform sync, alerts, reports, scheduled budgets / launches | Adds a Redis service on Railway (≈ $1–3 / month extra) | M |
| C11 (part) | Stripe billing ✅, activation checklist ✅, AI credits ✅. Shopify / GA4 moved to C18 (last in the series) | — | — |
| C12 ✅ | **Morning briefing email** — daily, in the workspace time zone: top 3 decisions across clients (numbers + one-click link) and anything applied overnight. Opt-in per person in Settings › Notifications | A14 notifications, B2 | S |
| C13 ✅ | **Guarded auto-apply** — per client "Suggest only" / "Auto-apply small changes" (Settings › AI). Only executable Meta budget suggestions, under a daily limit (default 15% of the campaign's budget), one move per campaign per day, logged as applied automatically with 7-day undo; workspace "Pause all automation" switch. Runs after each sync | B2, B3, A14 | M |
| C14 ✅ | **Safety rules** (opt-in per client) — pixel stopped firing → pause affected Meta campaigns until it fires again; monthly cap run-out → lower daily budgets inside the guardrail. Each action emailed with Undo | C13, Meta health, `computePacing` | M |
| C15 | **Feature gating by plan** — **priority: medium** (decided 2026-10-28: every feature stays open on every plan for now; to discuss before enforcing). The pricing table promises a split: approvals from Team; auto-apply, safety rules, client portal links and scheduled reports from Agency (clients, seats, AI credits and free client-viewer seats on Agency+ are already enforced). Enforce it with `lib/plans.ts` entitlements (API checks + locked states with "Upgrade" in the UI), grandfather existing workspaces, and keep the pricing table and the app in step | C11 billing | M |
| C16 | **Graph API version upgrade** — **priority: high, right after Meta App Review approval** (don't touch the Meta integration during review). `meta.service.ts` calls `v19.0` (Jan 2024; Meta supports a version ~2 years, then silently upgrades calls). Move to the current version, check deprecations in the changelog, then re-test publish, sync, ad sets / ads, budgets, pixels, audiences, image / video upload | App Review | S–M |
| C17 | **Meta Ads MCP server** — **priority: low, after launch.** Not a replacement for the Graph API integration (deterministic syncs and writes stay direct). Candidates: "Ask Advertix" chat (read-only breakdowns we don't sync), pixel / CAPI signal diagnostics for C14 and C2, and A/B tests + lift studies for C9. Verify Meta's docs before planning | C16, /ai/chat | M |
| C18 | **Shopify / GA4 revenue truth** — **last in this series** (decided 2026-10-28). Order: 1) Shopify via a store access key (custom app, no review): real revenue, refunds, blended ROAS per client across Overview, Analytics, Budgets, portal and reports; submit Google verification and Shopify protected-customer-data access while building. 2) GA4 on the existing Google sign-in (+ analytics.readonly): any website, per-campaign attribution via UTMs, "platform claims vs GA4". 3) Shopify public app (one-click connect) once Shopify approves. APIs are free; cost is review time and ~3–4 weeks of build | Google / Shopify reviews | L |

---

## 7. Feature parity checklist

Everything here works today and must survive the redesign.

| Capability today | New home |
|---|---|
| Meta publish: Page picker, audience (geo search, cities + radius, exclusions, age, gender, interests, custom / saved audiences, placements), creative (library, upload, URL, image / video / carousel, message, headline, description, link, CTA), live preview, error card, success with Ads Manager link | New campaign wizard (+ `lib/publish`) |
| Launch / pause on Meta, Open in Ads Manager, `?publish=1` | Campaign detail header |
| Campaign rename / budget / delete | Campaign detail (Edit + Settings) |
| AI Planner prefill → wizard | `/campaigns/new` prefill |
| Creatives: AI generate (image / carousel / text, platform, objective, tone, aspect, outputs, templates, reference image), upload with transcode polling, carousel builder, copy-variant editor, replace media, delete, filters | Creative studio + detail drawer (editable) + D3 |
| Audiences: saved templates, Meta custom / saved audiences, AI builder, manual pickers, edit / duplicate / delete | Audiences grid (source column, row menu) + D2 |
| Insights: generate (1-hour gate), apply, dismiss, dismissed + restore | Overview suggestions + Analytics "Advertix read" band |
| Budget optimizer: analyze, per-campaign recommendations, apply all, dismiss, history | Budgets allocator + Campaigns suggestion column + Change log |
| Analytics: 7/30/90 range, impressions + clicks charts, campaign breakdown table | Range menu, metric menu, "By campaign" segment |
| OAuth popups (4 platforms), sync now, disconnect, Meta health report, `?connected=` toasts | Connections + D1 + account drawer |
| Workspace name, members, role change, remove | Settings General / Team |
| Sign-in / sign-up, `/connect/done` popup page | Restyled, logic unchanged |

---

## 8. Definition of done (per page)

From the agent prompt's checklist, plus our rules:

- [ ] Matches the mockup at 390 / 768 / 1024 / 1440 in light and dark
- [ ] One primary button; every button works or is visibly disabled with a reason
- [ ] Tables use DataGrid (Sort, Columns, Row height; only the Action column is sticky)
- [ ] Client switcher filters the page (once B1 exists)
- [ ] AI suggestions follow Apply → Applied → Undo and Not now → Snoozed — and Apply really executes
- [ ] Empty, loading and error states in the product's voice
- [ ] Keyboard: sensible tab order, Esc closes menus and dialogs, visible focus
- [ ] No hard-coded colours outside the token files; no mock data in production
- [ ] Every capability from [§ 7](#7-feature-parity-checklist) for this page still works
- [ ] `tsc --noEmit` and `next lint` clean; the page file stays under ~600 lines

---

## 9. Sizing

Working days for one developer; rough.

| Track | Items | Days |
|---|---|---|
| Phase 0 | Fixes | 1–2 |
| A | A1 3 · A2 3 · A3 3 · A4 3 · A5 3 · A6 4 · A7 6 · A8 5 · A9 4 · A10 4 · A11 4 · A12 4 · A13 3 · A14 4 · A15 4 | ≈ 57 |
| B | B1 4 · B2 6 · B3 5 · B4 8 · B5 4 · B6 3 | ≈ 30 |
| C | C1 5 · C2 10 · C3 2 · C4 10 · C5 4 · C6 4 · C7 10 · C8 8 · C9 15 · C10 4 · C11 15+ | ≈ 85+ |

Suggested order: **Phase 0 → A1 + B1 → A2 + A3 → A4 → B2 → A5 → B5 → A6 → B3 → A7 → B4 → A8–A10 → B6 → A11–A15 → Track C.**

---

## 10. Open questions

Not blocking the start, but needed before the named phase:

1. **(A9) — decided:** no overlap %; only warnings Advertix can verify (lookalike next to its unexcluded seed, one audience in several ad sets of a campaign, near-duplicate saved audiences). See A9 in § 11.
2. **(A7)** Goals: the mockup adds App installs (needs an app object on Meta) and drops Engagement / Video views. Which set?
3. **(A7)** Age: the mockup's bucket chips can't express gaps on Meta (it takes min / max). Use a min / max range in the same style?
4. **(A8)** AI video drafts: the studio implies AI video generation, which doesn't exist. Keep studio drafts to images and copy?
5. **(A8) — decided:** creative statuses are derived from ad delivery (Live / Learning / Fatigued / Paused / In review / Rejected / Ended); library items not in an ad are Draft or Archived (see A8 in § 11).
6. **(A11) — decided:** a platform's new daily total is split across its campaigns in proportion to their current budgets, and applied to live Meta campaigns right away (with Undo); other platforms are listed to change by hand. See A11 in § 11.
7. **(A14) — decided:** "Audit log" opens the workspace change log in a drawer; "Manage" / account "Open" open the Connections account drawer (A13); "Pacing rules" (Budgets header) waits for automation (Track C).
8. **(A2)** What the AI Planner sidebar badge ("4") counts.
9. **(C2)** Slack: an OAuth app or incoming webhooks to start?
10. Currency: the mockups hard-code `$`. We keep each account's currency (`lib/money.ts`), with mixed-currency totals shown in the workspace's default currency.

---

## 10a. Testing backlog

Features built and covered by automated tests, but not yet tested end to end by hand. Tick one off once it has been tested locally and on production.

- [ ] **Experiments (C9a + C9b + C9c)**, built 2026-10-30, not yet looked at in the browser or run against real Meta A/B tests. **Test on production** (the local test app can't create ads). Needs `prisma db push` (Experiment, AdAccount.metaBusinessId).
  - **C9a, reading:** a test made in Ads Manager shows on **Experiments** after a sync, with results per version, chance-best bars, the pill, the Advertix note, Judge by, and the Ads Manager link. Empty state; client switcher; phone; dark mode.
  - **C9b, New test:** dialog (campaign published from Advertix, name, 1–4 images or videos from Creatives, days, test budget with the per-version minimum) → new ads on Meta with the same copy, and Meta's creative test (check Ads Manager → Experiments). A failure removes what was created. An Ask first client's media buyer goes to Approvals.
  - **C9b, End test** (with confirm), and **Scale the winner**: it pauses the other versions and moves an ad-set version's daily budget to the winner. A media buyer's click goes to Approvals; Undo restores everything; it's in Activity.
  - **C9c, lessons:** an ended test shows "What it showed" pre-filled; Save; it's listed under "What your tests showed"; the AI Planner uses it (ask it for a plan for that client and look for the lesson in its reasoning).
  - If anything Meta-side fails, send the API log lines (`[sync:meta] experiments`, or the error toast). Ad study calls use `META_STUDIES_API_VERSION` (default v25.0).
- [ ] **Smart hours (C7)**, built 2026-10-30, not yet looked at in the browser. Needs `prisma db push` (HourlyStat + 3 fields). Seed script for local data in the C7 notes below:
  - **Data:** about 4 minutes after the API starts (then hourly), each active ad account with spend in the last 45 days gets its hourly report once a day; the campaign's Hours tab says "updated …".
  - **Hours tab:** heatmap (Mon–Sun × 24 hours + "All days" row), hover/tab readout, legend, hatched thin cells; the 14 days / 300 purchases progress before the gate; dark mode; phone (scrolls sideways inside the card).
  - **Suggestion:** "Switch off 00:00–06:00" with the why and ≈ saving; one click on a Meta campaign published from Advertix with a total budget (changes the ad set's hours in Ads Manager); a media buyer's click goes to Approvals; Undo restores the hours. Daily budget → the manual steps. "Keep it running around the clock" when nothing qualifies.
  - **Smart hours switch:** on the tab and in the wizard (with "Use $X in total" on Meta); with it on, the suggestion also appears in the suggestions feed.
  - **Budgets:** the client heatmap with All / Meta / Google / TikTok; mixed currencies explained.
  - **Google / TikTok:** need a connected account (and Google's developer token) to test at all.
- [ ] **Schedule step and auto-pause (C6)**, built 2026-10-28, not yet looked at in the browser. Needs `prisma db push` (3 Campaign fields):
  - **Wizard step 2:** Run continuously / Set an end date (Total budget forces an end date); the day count; the Black Friday and overlap notes for Meta (try a start date of 25 Nov, and a goal matching a running campaign).
  - **Pause automatically:** spend cap (an amount above zero), blackout dates (key-date chips for the campaign's dates, your own dates, remove), Tracking stops ("Already on" when the client's safety rule covers it). The review step's Auto-pause line; publishing keeps it (Settings tab shows it).
  - **Acting (needs a live Meta campaign):** a blackout covering today pauses it on save; the next day after a blackout it turns back on; a spend cap already reached pauses it on save; raising the cap doesn't restart it. Each shows in Activity with Undo and sends the "changed a campaign on its own" email. Pause all automation stops it.
  - **Roles:** analysts see the card read-only; limited members only for their clients.
  - **Dates in the account's time zone** (fix, 2026-10-28): publish a campaign for tomorrow to the end of next week. In Ads Manager the ad set should start at 00:00 and end at 23:59 in the ad account's time zone.
- [ ] **Flight calendar (`/calendar`, C5)**, built 2026-10-28, not yet looked at in the browser:
  - **Timeline:** a row per client; bars at the right dates for live, scheduled, draft, paused and ended campaigns; open-ended bars fade out; the Today line; 5 weeks / 3 months / 6 months; ‹ › and Today.
  - **Key dates:** Black Friday and Cyber Monday in orange; the Key dates menu hides retail, seasonal and cultural dates and remembers the choice.
  - **Worth a look:** two live campaigns with the same objective on one ad account show an overlap; a draft or scheduled campaign starting in Black Friday week shows the launch warning. Clicking a name selects the bar.
  - **Selected panel:** dates, budget, account; Open campaign keeps the client.
  - **Client switcher:** All clients shows every client's row, one client only theirs; a limited member sees only their clients.
  - **Phones:** opens on List (week by week); the timeline scrolls sideways inside its card only; dark mode.
- [ ] **Get started (`/setup`, C11)**, flagged 2026-10-28 as not fully tested. Test with a fresh workspace and with an existing one:
  - **Each step ticks off when it's done for real:**
    - connect plus the first sync finishing (not just connecting);
    - two clients with every account assigned;
    - a monthly budget;
    - an AI check that finds nothing, and one that finds suggestions;
    - a pending invite, and an accepted one;
    - a portal link, and a scheduled report;
    - the briefing turned on.
  - **Per client:** switch between All clients and each client. Counts, titles ("… for Lumen") and buttons follow the client, "Add your clients" disappears, and the sidebar badge matches the page.
  - **All clients:** a client step ticks only when every client has done it ("1 of 2 clients done · still to do: …"). "Your clients" shows each client's own progress, and Open switches to it.
  - **Skip / Undo skip** for the optional steps; required steps can't be skipped.
  - **Hide from sidebar / Show in sidebar;** the ✓ badge once everything is done; the page still reachable from ⌘K.
  - **Roles:** owners see the page and the link; media buyers, analysts and client viewers see "Set up by the workspace owner" and no link. A limited member can't open the page for a client they can't see.
  - **Phones:** only the next step's buttons; the other titles are links; no sideways scroll; dark mode.
- [ ] **Stripe billing and the trial (C11)**, in the sandbox:
  - Checkout with the 4242 card during the trial (no charge until the trial ends), and after it;
  - switching plans (prorated);
  - Manage billing: invoices, card, cancel at period end;
  - the webhook syncing the plan;
  - a failed payment (Stripe test card `4000 0000 0000 0341`);
  - trial-ending and trial-ended emails and banners;
  - an ended trial blocking AI and new clients;
  - the 5-client / 5-seat trial limits.
- [ ] **AI credits (C11):**
  - the meter going up after each AI action (images 1 / 2 / 5);
  - the 80% notice and email;
  - the out-of-credits dialog at 100% (owner vs non-owner);
  - the trial's 100 credits covering the whole trial;
  - `AI_CREDITS_ENFORCED=false`.
- [ ] **On production after the deploy** (pending since 2026-10-27):
  - the morning briefing (C12);
  - auto-apply (C13);
  - safety rules (C14). They only act on real conditions (a silent pixel, a client overspending), so watch Activity and the "Automatic changes" emails for the first week.

## 11. Progress

### A1 — Foundations ✅ (2026-10-21)

- **Tokens:** guide § 2.1 values (copied from the mockups' `:root` / dark blocks) in `apps/web/app/globals.css` as RGB channels (`--c-*`) plus ready vars (`--brand` …), dark values under `.dark`. Tailwind maps them: `bg-bg`, `bg-surface(-2/-3)`, `text-ink(-2/-3)`, `border-line(-2)`, `bg-brand(-hover/-soft/-soft-2)`, `text-brand-ink`, `pos / neg / warn(-soft)`, radii `rounded-card / -menu / -ctl`, shadows `shadow-card / -pop`. Scrollbars per § 2.3.
- **Font:** Geist (sans + mono) for the whole app, loaded once in the root layout. Plus Jakarta Sans removed. Don't import Geist in nested layouts: Next then puts its CSS in that layout's chunk only (this happened once and was fixed).
- **Theme:** `components/app/theme/ThemeProvider.tsx` toggles `.dark` on `<html>` and removes it when the app unmounts, so marketing stays light. **Default is light** until A15 (old pages aren't dark-ready); `THEME_SCRIPT` prevents a flash.
- **Primitives** in `components/app/ui/` (exported from `index.ts`): Button / ButtonLink / IconButton, Segmented, Toggle, Checkbox, Pill / StatusPill / DeltaPill, PlatformBadge, Card / CardHeader, KpiCard + Sparkline, Menu (+ MenuItem / MenuLabel / MenuSeparator), Dialog (bottom sheet under 600px), Drawer, Skeleton, EmptyState, AiMark, AiNote, AiSuggestion (with `mode="review"` for non-executable suggestions, decision #4). Keyboard: Esc, focus trap, arrow keys in menus and segmented controls.
- **`/dev/ui`:** every primitive in both themes; public in development only and 404 in production.
- **Data fetching:** SWR behind `useApi`. Pass `{ key }` as the third argument to share and cache a request; existing calls are unchanged.
- Note: guide `--ink-3` (#85829a) is about 3.7:1 on white, below AA for small text. Kept as specified for now; revisit in A15.

### B1 — Clients ✅ (2026-10-21)

- **Schema** (additive, `prisma db push`): `Client` (name, short, vertical, logoUrl, monthlyBudget, currency, isDefault), `AdAccount.clientId`, `Creative.clientId`, `Audience.clientId` (null = shared library item).
- **`apps/api/src/lib/clients.ts`:** `ensureClients()` creates a default client named after the workspace on first use, and assigns unassigned accounts while there's only one client. Also `parseClientScope()` (`?clientId=`; an unknown id → 404), `campaignClientWhere()`, `ownedOrSharedWhere()`, `parseBodyClientId()`.
- **Endpoints:** `GET/POST/PATCH/DELETE /api/clients` (the last client can't be deleted), `PATCH /api/ad-accounts/:id { clientId }`, `GET /api/analytics/by-client`, `GET /api/budgets/pacing?month=&clientId=` (spent / projected / status / run-out day). `?clientId=` added to `/campaigns`, `/ad-accounts`, `/analytics/{overview,timeseries,by-platform,campaigns}`, `/creatives`, `/audiences`. Ad accounts now expose `lastSyncedAt` and `clientId`. Insights are not client-scoped; B2 replaces them.
- **Web client** (`lib/api.ts`): `Client`, `ClientPacing`, `ClientBreakdown` types; `getClients / createClient / updateClient / deleteClient / assignAdAccountClient / getPacing / getAnalyticsByClient`; optional `clientId` on the analytics, ad-account, campaign, creative and audience calls.
- **Tested** against the local DB, with route handlers called directly in a throwaway workspace that is cleaned up afterwards: default client, scoped analytics / campaigns / creatives, pacing, bad ids, delete rules.
- **Deploy order:** run `npx prisma db push` against the production (Railway) database **before** the new API deploys. The API reads the `Client` table on common requests (e.g. `GET /ad-accounts`).

### A2 — App shell ✅ (2026-10-21)

- **`components/app/shell/`:** `AppShell` (256px sticky sidebar + sticky 64px top bar from 900px; below that a 56px app bar, left drawer and 66px bottom tab bar with the raised Plan tile), `SidebarContent` (logo, client switcher, Workspace + Account nav with the campaign count, ad-accounts box, user row), `TopBar` / `MobileAppBar`, `PageHeader` + `PageTabs` + `PageBody` (header sticks under the top bar).
- **Client scope:** `ClientProvider` / `useClientScope()` keeps the selected client in `?client=` and localStorage `advertix.client`; `scoped(href)` carries it across nav links. With one client the switcher is static and `clientId` stays null (no filtering).
- **Honest states:** search (until the C3 command palette) and alerts (until F1) are visibly disabled with the reason; the theme toggle shows in development only (A15); empty ad accounts → "Connect an account" opens the existing `ConnectModal`; load errors show "Try again".
- Routes not yet rebuilt still get the old padded content area (`REBUILT_ROUTES` in `AppShell.tsx`; remove in A15). Temporary nav targets: Insights (until A10), Budgets → `/budget-optimizer` (A11), Connections → `/settings?tab=integrations` (A13).
- Old `components/layout/Sidebar.tsx` and `Header.tsx` deleted. Dev preview at `/dev/shell`.

### A3 — DataGrid ✅ (2026-10-21)

- **`components/app/grid/`** (`DataGrid`, `CellText`, `GridSearch`, `FilterMultiSelect`, `BulkButton`, `GridEmpty`, `useGridDisplay`). Guide § 4.1 in full: Sort menu (fields + Order segment, labels A→Z for text and High to low for numbers), clickable headers with ↑/↓, Columns menu (identity + Action "Always shown", "· N hidden", Reset to default), Row height (Comfortable 64 / Compact 48) + "Wrap long values", sticky Action column only, selection with indeterminate header checkbox, floating dark bulk bar, footer totals, loading skeleton rows, empty slot.
- **Column config:** `{ id, label, width (min px), grow? (fr), align, sortValue?, sortType?, defaultHidden?, render(row, display), footer? }`. The first column is the identity column. Widths are min + fr, so every row lines up and the table scrolls sideways once it no longer fits.
- **Persistence:** sort, hidden columns, row height and wrap in localStorage `advertix.grid.<tableId>`, read after mount and validated against the current columns.
- Sorting is client-side over the rows passed in (empty values always last). Selection is pruned to the visible rows, so bulk actions never touch rows hidden by a filter.
- On phones the Sort / Columns buttons drop their secondary text and the bulk-bar actions scroll while the count and ✕ stay visible. Dev preview with demo rows at `/dev/grid`.
### A4 — Overview ✅ (2026-10-21)

- **`/dashboard`** rebuilt on the new shell (`app/(dashboard)/dashboard/page.tsx` + `components/app/overview/`): greeting with date and scope, summary line (clients · campaigns live · ad accounts synced N ago), 5 KPI cards (Spend, Revenue, ROAS, Conversions, Cost / conversion; last 30 days vs the 30 before, 14-day sparklines), Spend & revenue bars (7D / 14D / 30D, hover or arrow keys update the header readout), Advertix suggests, client pacing table (DataGrid). Everything follows the client switcher.
- **Deltas:** `GET /analytics/overview` now also returns `previous` (raw previous-period totals, additive). With no prior data the pill shows "—" instead of a misleading +100%; ROAS shows an absolute change; cost / conversion is derived.
- **Suggestions (until B2):** active Insights + the latest pending budget analysis. Neither can be applied and undone yet, so every item offers **Review** (→ `/insights` or `/budget-optimizer`). Not now dismisses an insight (shown faded as "Dismissed" with Undo = restore). Empty state has "Check my accounts" (insights generate, honours the 1-hour gate). Insights aren't client-scoped yet; a note says so when a client is selected.
- **Clients table** (only with more than one client and "All clients" selected): last-30-day spend / revenue / ROAS from `/analytics/by-client`, this month's pacing bar with a today marker from `/budgets/pacing`, and a computed note (runs out on day N, underspending by X, on pace, set a budget). View switches the client scope. Spend on unassigned ad accounts shows as "Not assigned".
- **Currency:** taken from the ad accounts in scope; if they mix currencies the summary says so. KPIs drop cents (`fmtMoney(…, { whole: true })`).
- **Dropped from the old dashboard** (per the mockup; covered elsewhere): AI banner (→ suggestions), platform breakdown (→ Analytics share panel, A7), active campaigns table (→ Campaigns), quick actions, budget widget (→ suggestions + Budgets). Export report is visibly disabled until D6. Unused `components/dashboard/PlatformBreakdown.tsx` deleted.
- Dev preview `/dev/overview` renders the real page; the screenshot script answers its API calls with demo JSON (no mock data in the app).

### B2 — Suggestions ✅ (2026-10-21)

- **Schema** (additive, `prisma db push`): `Suggestion` (kind, clientId, campaignId, title, reason, impact, priority, actionType, actionPayload, revertPayload, actionLabel, doneLabel, reviewHref, status OPEN / APPLIED / SNOOZED / DISMISSED / EXPIRED, snoozedUntil, suppressUntil, appliedAt / appliedById / undoneAt, source + sourceRef + dedupeKey, expiresAt) with enums `SuggestionStatus`, `SuggestionSource`.
- **Migration approach:** Suggestions are the source for the new UI. The insight generator and the budget optimizer now also write suggestions (and mirror dismiss / restore / apply), and a workspace's existing active insights + latest pending analysis are copied in on its first `GET /suggestions`. The old Insights and Budget optimizer pages keep using their own tables until A10 / A11 rebuild them; drop `Insight` / `BudgetRecommendation` then.
- **Executors** (`services/campaign-actions.service.ts`, Meta only — the other platforms are read-only syncs): set daily budget (ad set for campaigns published from Advertix, campaign object for synced campaigns with a campaign budget) and pause / resume. Platform first, then our row, same as `PUT /campaigns/:id`.
- **Guardrails:** a budget suggestion is executable only if the campaign is on Meta with a daily budget we can reach, the account is connected, and the new budget is 0.5×–2× the current one and above the account minimum; the ratio is re-checked at apply time. Everything else (Google / TikTok / LinkedIn, ad-set-level budgets, big jumps, insights) is Review → the campaign or the old page. Creative rotation waits for ads (B4).
- **Endpoints** `/api/suggestions`: `GET ?clientId=&campaignId=&include=applied`, `POST /refresh` (insight check with the 1-hour gate + re-sync), `POST /:id/apply` (claims the row first so a double click can't run twice; rolls back on a platform error), `POST /:id/snooze { days=7 }`, `POST /:id/undo` (reverts an apply within 7 days, refused with 409 if the value changed since — e.g. edited in Ads Manager and synced; also wakes a snooze). Regeneration respects snoozes and recent applies.
- **Overview** now uses suggestions: real Apply → "Budget raised" + Undo where executable, Review otherwise, Not now → "Snoozed 7 days" + Undo, filtered by the client switcher, "Show all" past 4.
- **Fix found on the way:** Meta sync overwrote the stored budget of campaigns published from Advertix with 0 (their budget is on the ad set, so Meta reports no campaign budget). Sync now keeps the stored budget when Meta reports none.
- **Tested** against the local DB with Meta mocked (16 checks): backfill, executability rules, client filter, apply on ad set vs campaign, double apply, undo, undo conflict, platform error rollback, pause / resume, review-only, snooze across regeneration, mirroring from the old pages.
- **Deploy order:** `npx prisma db push` on Railway **before** the API deploys (the API reads `Suggestion` on Overview load and after every insight / budget run).

### A5 — Campaigns ✅ (2026-10-21)

- **`/campaigns`** rebuilt (`app/(dashboard)/campaigns/page.tsx` + `components/app/campaigns/`): header (scope · last 30 days, counts, Sync now, Export CSV, New campaign), KPI strip (Running now, Spend, Blended ROAS, Daily budget live), AI banner with "Only show these", DataGrid with search, status segment with counts, platform multi-select, Clear filters.
- **Grid:** Campaign (client · objective), Platform, Status (toggle + pill), Budget / day, Spend, ROAS, Conversions, CTR and Reach (hidden by default), Advertix suggests. Sticky Action: the suggestion's real Apply (or Review), then Undo; otherwise Publish (Meta drafts → `?publish=1`) or Open; plus a row menu (Open, Publish, Pause / Resume, Not now, Duplicate as draft, Delete with the Meta warning). Footer totals (live daily budget, spend, blended ROAS, conversions).
- **Bulk bar:** Pause, Resume (counts only the rows that can change), Edit budgets (dialog: change by % or set an amount, previews every change, says which are live on Meta; saved through `PUT /campaigns/:id`, which pushes to Meta first), Duplicate (drafts). Partial failures are reported by name.
- **Honesty fix:** Google / TikTok / LinkedIn campaigns synced from the platform are view-only for status and budget (the old page's toggle only changed our copy, which the next sync reverted). Their status pill says where to change it; the budget dialog leaves them out with a note.
- **Data:** one request — `GET /campaigns?limit=500&days=30` (new: `days` makes totals cover the last N days instead of lifetime; cap raised from 100 to 500; `adAccount.clientId` exposed). Filtering, counts and sorting run in the browser. Over 500 campaigns, a note says only the most recent 500 are shown.
- **Shared:** `useSuggestions` (Apply / Not now / Undo, used by Overview and Campaigns); `Menu` gained `portal` (fixed-position panel that flips up near the bottom, for menus inside the scrolling grid); the shell's rebuilt-route list is now exact paths (`/campaigns/[id]` keeps the old padding until A6).
- **Kept from the old page:** Sync now with step labels + Meta error card, `?new=1` + AI Planner prefill into the create modal, per-campaign pause / resume (on Meta when live), publish hand-off, duplicate, delete. **Dropped:** card / list view switch and pagination (one grid, loaded at once), the date-range select (it never changed the data).
- **Later:** "Learning" status (B4); bulk Duplicate uses the existing create call until the duplicate endpoint (B5); phones get the sticky Action column at full width — revisit with the mobile pass (A15).
- **Follow-ups from review (2026-10-21):**
  - **Card view:** DataGrid takes `renderCards`; a table / cards switch sits before Sort and is saved with the other grid preferences (`view` in `advertix.grid.<tableId>`). In card view Sort and filters stay; Columns, Row height and selection don't apply. Campaign cards show platform, status toggle, name, 30-day spend / ROAS / conversions, budget and reach, the suggestion, and the same main button + row menu as the table.
  - **Menus never change page layout:** every `Menu` now renders as a fixed panel at page level. It opens below the trigger or above when there's more room, caps its height and scrolls inside if neither side fits, follows the trigger on scroll / resize, and closes if the trigger leaves the screen. Applies to every grid and toolbar menu (the earlier `portal` option is gone — it's the only mode).
  - **Header / cell alignment:** sortable right-aligned headers put the ↑ / ↓ slot on the left, so their text ends exactly where the numbers below end (it was ~14px off).

### B5 — Small API exposures ✅ (2026-10-21)

- **Ad accounts** (`GET /ad-accounts`): `tokenExpiresAt` (new column, set at OAuth: Meta long-lived token ≈ 60 days, LinkedIn refresh token ≈ 1 year, TikTok when it has one; Google null), `health` summary from the stored Meta health report (`overall`, `issues`, `topIssue`, `checkedAt`; null when no check has run), `spend30d` per account in its own currency. (`lastSyncedAt` and the client came with B1.)
- **Timeseries** (`GET /analytics/timeseries`): `metric=cpa` (spend ÷ conversions per day, 0 on days without conversions) and `compare=previous` — each point gets `previous`, the value on the same day one period earlier (null when there was no data). Without `compare` the response is unchanged. (`days` on `/campaigns` came with A5.)
- **`POST /campaigns/:id/duplicate { name?, budget? }`**: copies a campaign as a local DRAFT in the same ad account — nothing is created on the platform until it's published. Budget, budget type, objective and targeting are copied; schedule dates already in the past are dropped. Creatives belong to one campaign each, so they aren't copied. The Campaigns row / bulk Duplicate now uses it.
- **`POST /ai/campaigns/:id/ask { question, history? }`** ("Ask about this campaign", used by A6): answers only from that campaign's data — settings, 30 days of daily metrics, last 7 vs previous 7 days, open suggestions — and says what isn't available yet (ad set / ad / audience / creative breakdowns). ≤ 500-character questions, last 6 turns of history (sanitised to alternate), 30 questions per workspace per hour, plain-text answers of about 120 words.
- **Saved plans**: `Plan` (title, brief, status DRAFT / USED / ARCHIVED, client, `latestVersion`) + `PlanVersion` (version, plan JSON, note). `GET /plans?clientId=&include=archived`, `GET /plans/:id` (versions newest first), `POST /plans` (v1), `POST /plans/:id/versions`, `PATCH /plans/:id`, `DELETE /plans/:id`. The AI Planner starts saving to it in A12.
- **Moved to A13:** D1 account selection (stage discovered accounts and add only the picked ones). It needs the D1 dialog; changing the OAuth callbacks first would make today's Connect stop adding accounts.
- **Tested** against the local DB (AI mocked): account fields, cpa + compare alignment and the unchanged default shape, duplicate rules, ask context + history sanitising + 404s, plan versions / archive / cascade delete.
- **Deploy order:** `npx prisma db push` on Railway before the API deploys (new `AdAccount.tokenExpiresAt` column, `Plan` / `PlanVersion` tables, `PlanStatus` enum).

### A6 — Campaign detail ✅ (2026-10-21)

- **`/campaigns/[id]`** rebuilt (`app/(dashboard)/campaigns/[id]/page.tsx` + `components/app/campaign/`). Header: breadcrumb (Campaigns › client › name), platform badge, name + status, summary (platform · objective • live since • account • budget), status switch (pause / resume, on Meta when live; disabled with the reason for drafts, ended and read-only synced campaigns), Duplicate (D7 dialog → `POST /campaigns/:id/duplicate`, opens the copy), Ads Manager link, Publish to Meta (unpublished Meta drafts) or Edit campaign, ⋯ → Delete with the Meta warning. Tabs in `?tab=`: Overview, Ad sets, Ads, Change log, Settings.
- **Overview:** 6 KPI cards (Spend, Revenue, ROAS, Conversions, Cost / conversion, CTR) for the last 30 days vs the 30 before (no change pill when there's no earlier data); "Advertix read" with the plain observations from the old page (no conversions, CTR under 1%, budget capping); "Daily {metric}" bars with ROAS / Spend / CPA / CTR, hover / arrow-key readout; this campaign's suggestions with real Apply / Undo (Review on a non-executable one opens Settings); **Ask about this campaign** (starter questions, follow-ups keep context, answers from the campaign's own 30 days); daily breakdown DataGrid (compact by default, footer totals). Without data: empty state + side panel only.
- **Settings:** rename and budget (account minimum check; synced Google / TikTok / LinkedIn campaigns are read-only with a note), delete. **Change log:** what Advertix already records — created / imported, published, suggestions applied — until B3 brings the full audit trail. **Ad sets / Ads:** honest "coming soon" (B4) with an Ads Manager link when live.
- **Kept:** `?publish=1` opens the publish wizard, the last publish error card, Launch / pause on Meta, Ads Manager deep link, rename / budget / delete. Event markers on the chart come with B3; ad sets, ads and fatigue with B4.
- **Shared:** `DataGrid` `defaultDensity`; `useSuggestions` accepts `campaignId`; the shell's rebuilt-route list accepts patterns. Unused `components/dashboard/SpendChart.tsx` deleted.

### B3 — Change log & undo ✅ (2026-10-21)

- **Schema** (additive, `prisma db push`): `ChangeLog` (workspace, client, campaign — set null on delete, `campaignName` kept — actor USER / AI / RULE / SYNC, `actorUserId` = who made or approved it, action, summary, before / after, `platformPushed`, `suggestionId`, `revertOfId`, `undoneAt` / `undoneById`) + enum `ChangeActor`.
- **Recorded** (`services/change-log.service.ts`; recording never fails the change itself): campaign create, edit (one entry per changed group: budget, status, name, schedule, targeting), duplicate, publish, launch / pause, delete; applied suggestions (actor AI, approved by the user); Budget optimizer "apply" (actor AI, marked "in Advertix only — not sent to the platform"); and on Meta sync, name / budget / active ↔ paused changes made outside Advertix (actor SYNC, not undoable). Google / TikTok / LinkedIn syncs don't record outside changes yet.
- **Undo** (`POST /change-log/:id/undo`): budget, status and name changes within 7 days. Same path as a normal edit — on Meta first for live campaigns (ad set or campaign budget, campaign + ad set status / name), our row otherwise — and refused (409) when the value has changed again since. An undo writes its own entry (`revertOfId`) and marks the original. Entries from a suggestion are undone through the suggestion, so it reopens and both stay in step; suggestion Undo marks its log entry too.
- **`GET /change-log?campaignId=&clientId=&limit=&before=`**: newest first with actor names, `canUndo`, paging by `before`.
- **Campaign detail:** the Change log tab lists every entry (avatar: person initials / Advertix / sync), who, when, "on the platform" vs "in Advertix only", Undo, "Undone by …", Load older. The daily chart shows markers for budget changes, pauses / resumes and publishing, laid out so labels don't overlap.
- **Tested** against the local DB with Meta mocked (9 checks): entries per change, local and Meta undo (ad set budget, rename on campaign + ad set, status via launch), conflict refusal, suggestion apply → AI entry → undo through the log, sync-detected changes logged once, delete keeps entries. B2 checks re-run: 16/16.
- **Deploy order:** `npx prisma db push` on Railway before the API deploys (new `ChangeLog` table, `ChangeActor` enum).

### A10 — Analytics (absorbs Insights) ✅ (2026-10-22)

- **`/analytics`** rebuilt (`app/(dashboard)/analytics/page.tsx` + `components/app/analytics/`), following the client switcher. Header: scope · reporting, period and comparison line, 7 / 30 / 90-day range, Export CSV (the breakdown rows), Schedule report visibly disabled until Track C.
- **KPI cards** (Spend, Revenue, ROAS, Conversions, Cost / conversion) vs the previous period; clicking one drives the trend chart. **Trend chart:** line + area for this period, dashed previous period (`compare=previous`, B5) with a toggle, hover / arrow-key readout, "More metrics" (Impressions, Clicks). Days without delivery are 0 for totals and a gap for ROAS / CPA.
- **Share of {metric}** by platform or client (client only with several clients and "All clients"). **Funnel:** impressions → clicks → conversions with step rates; landing-page views and add-to-cart say "Not synced yet" (B4) instead of inventing numbers; a plain "Where people drop off" read from CTR / conversion rate.
- **Advertix read** (the old Insights page): observations with Check again (1-hour gate), Mark done, Dismiss, and the dismissed list with Restore. `/insights` now redirects here; the sidebar's temporary Insights item is gone (Analytics highlights for `/insights`); insight-based suggestions' Review links point at `/analytics`.
- **Breakdown** DataGrid by platform / client / campaign (top 100 by spend, rows link to the campaign): Spend, Revenue, ROAS, Conv., CPA, CTR, CPM, Impressions + Clicks (hidden), footer totals.
- **Kept from the old page:** 7 / 30 / 90 range, impressions and clicks charts (More metrics), platform comparison (share + breakdown), sortable campaign table (breakdown → campaign), AI insights. Removed: unused `components/dashboard/MetricCard.tsx` (the old `components/dashboard/` folder is now empty and deleted), the old Insights page and its skeleton.

### A7 — New campaign wizard ✅ (2026-10-22)

- **`/campaigns/new`** is a full page that replaces `CreateCampaignModal` and `PublishToMetaModal` (`app/(dashboard)/campaigns/new/page.tsx` + `components/app/new-campaign/{model.ts, steps.tsx, review.tsx}`). There are 5 steps in the header bar: Goal → Platforms & budget → Audience → Ads → Review & launch. You can jump back to any step, or forward up to the first incomplete one.
- **Goal:** Website visits / Leads / Sales / Awareness / Engagement, with an optional name. Advertix names the campaign from platform, goal and month until you type one. Leads and Sales warn up front when the Meta ad account has no Pixel, with a link to Events Manager.
- **Platforms & budget:** one card per platform showing the connected account and its client.
  - Meta publishes from Advertix. Google / TikTok / LinkedIn are saved as drafts ("publishing coming soon"). Unconnected platforms link to Connect.
  - Daily or total budget, checked against the account's real minimum (shown as a hint; the field starts empty rather than pre-filled with the minimum).
  - Start / end dates or "Run continuously". A total budget needs an end date.
- **Audience** and **Ads** (Meta) reuse the publish flow's steps, extracted to `components/campaigns/publish/metaSteps.tsx` and moved to design tokens:
  - Audience: location (required unless a saved / custom audience is picked), demographics, interests, custom and saved audiences.
  - Ads: Facebook Page, library / upload / URL creative, placements, copy, link and CTA, live preview.
  - The targeting pickers were moved to tokens too.
- **Review & launch:** a summary of every step with Edit links and an editable name. Launch modes are Publish paused (recommended), Publish and start now (`launchCampaign`), or Save as draft. Meta errors use `MetaErrorCard`.
  - Retries never duplicate anything: ids already created are reused (PUT) and only the publish is repeated.
  - The done screen lists each platform's result (Paused on Meta / Live / Draft) with Open campaign and Ads Manager links.
- **Side panel:** Forecast from the client's last 30 days (CPM, CTR, conversion rate → spend, reach, clicks or results, cost per 1,000 views, ROAS for Sales). It says plainly when there's no budget or no history to estimate from. Also shows setup strength with the remaining checks, and a tip for each step.
- **Draft safety:** the wizard autosaves to `localStorage` on every change. Coming back shows "Picked up where you left off" with Start over. Save draft & exit is in the header.
- **Entry points:**
  - `?from=<campaignId>` opens an existing draft, with its platform locked. This is the "Publish to Meta" path from the campaigns grid and campaign detail; `/campaigns/<id>?publish=1` redirects here.
  - The AI Planner's sessionStorage prefill maps goal, name, platform, budget, ages, gender and countries.
  - `/campaigns?new=1` redirects here. The New campaign buttons (campaigns page, overview) link here.
- **Removed:** `components/campaigns/CreateCampaignModal.tsx`, `components/campaigns/publish/PublishToMetaModal.tsx`, `components/ui/WizardRail.tsx`.

### Navigation feedback (2026-10-22)

- A thin progress bar (`components/app/shell/NavigationProgress.tsx`) starts on any in-app link click, or on a button that navigates through `useAppRouter` (`hooks/useAppRouter.ts`, a `useRouter` whose `push` starts the bar), so a click never looks ignored. Budgets and New campaign got route skeletons; the wizard's "Connect" link is a `<Link>` (it was a full reload).
- Measured: under `next dev`, the first visit to a page waits for it to compile (up to ~10 s). A production build switched pages in ~25 ms. `onDemandEntries` in `next.config.js` keeps compiled pages for an hour in dev.

### B4 — Ad sets, ads, richer metrics (Meta first) ✅ (2026-10-22)

- **Schema:** `AdSet` (budgets, optimisation goal, learning stage, targeting, 30-day reach and frequency), `Ad` (creative format, image, headline, text, CTA, link, 30-day reach and frequency), `AdMetrics` (daily impressions, reach, clicks, spend, conversions, revenue, landing-page views, add-to-cart), and `AdAccount.backfilledAt`.
- **Sync** (`sync.service.ts`):
  - Each Meta sync also pulls ad sets, ads, daily ad-level insights, and 30-day reach and frequency per ad and per ad set.
  - The first sync of an account pulls 90 days, for campaign metrics too (Analytics offers 90 days); later syncs refresh 30.
  - Ad sets and ads that disappear from Meta are marked ended and keep their history.
  - This part is non-fatal: if it fails, campaign data still syncs and the backfill is retried next time.
  - Publish and launch refresh that campaign's ad sets and ads straight away.
  - Results parsing is shared between campaign and ad level; add-to-cart takes the first of Meta's overlapping action types, so nothing is counted twice.
- **API:**
  - `GET /campaigns/:id/structure?days=` returns ad sets and ads with period totals, a plain audience line, a fatigue read, and why each control is blocked.
  - Fatigue is "fatigued" at frequency ≥ 4, or at ≥ 2.5 with CTR down 30%+ week on week (last 7 complete days against the 7 before, with 1,000+ impressions in each). It's "watch" at frequency ≥ 3 or CTR down 20%+.
  - `POST /campaigns/:id/adsets/:adSetId/status|budget` and `POST /campaigns/:id/ads/:adId/status` act on Meta first, then locally. Each writes a change-log entry (`adset.status`, `adset.budget`, `ad.status`), undoable for 7 days.
  - Pause / resume compares against the object's own switch: one that's on while its campaign or ad set is off reads `CAMPAIGN_PAUSED` / `ADSET_PAUSED`.
  - Advertix-published single-ad-set budgets stay mirrored on the campaign.
  - `GET /campaigns` adds `learning` (LEARNING / LIMITED); `GET /analytics/overview` adds `adLevel` funnel totals.
  - `requireAuth` skips a second verification when two routers share a mount path.
- **Web:**
  - Campaign detail Overview gains the ad-set grid (status, budget share, spend, ROAS, cost per conversion, frequency, pause switch, budget edit) and the top 4 ad tiles (frequency bar against 5.0, Fatigued badge, fatigue read).
  - The **Ad sets** tab shows a card per ad set with a plain read (learning phase, share of spend, best or lowest ROAS, frequency), results and controls.
  - The **Ads** tab shows every ad with headline, text and pause switch, filterable by ad set.
  - Tab counts. Honest empty states: other platforms, unpublished drafts, and "Sync now" when a live campaign hasn't synced ad sets yet.
  - The Campaigns grid shows **Learning / Learning limited**.
  - The Analytics funnel shows real landing-page views and add-to-cart, with rates against Meta's clicks when other platforms are in scope.
- **Tests:** an integration test (local DB, Meta mocked) covers sync and backfill, ended ads, structure totals, audience line and fatigue, ad set / ad pause + undo, budget + undo, blockers, the campaign-paused case, the learning flag, funnel totals and the publish refresh (11 checks). B2, B3 and B5 still pass.
- **Later:** creative performance and fatigue on Creatives (A8); audience performance and the audience↔campaign link (A9; the wizard targets Meta audiences directly, so `Campaign.audienceId` waits for the Audiences page); duplicate with ad sets; multiple ads per launch in the wizard; Google / TikTok / LinkedIn ad groups.

### A8 — Creatives ✅ (2026-10-22)

- **`/creatives`** rebuilt (`app/(dashboard)/creatives/page.tsx` + `components/app/creatives/`), following the client switcher. The header shows assets · fatigued · drafts, with Upload and Creative studio.
- **One board for library creatives and the ads synced from Meta** (`GET /creatives/board?days=30&clientId=`, `services/creative-board.service.ts`):
  - **Linking:** publishing from the library now sets `Creative.campaignId`, and the campaign's `externalCreativeId` identifies the ad Advertix created, so a library creative shows that ad's real results. Synced ads with no library creative behind them appear as "From Meta" items.
  - **Statuses** come from delivery (this answers open question 5): Live, Learning, Fatigued (B4 fatigue read), Paused, In review, Rejected and Ended for anything running; Draft or Archived for library items that aren't in an ad.
  - `bestHook` is the best-returning item with copy.
  - Fatigue helpers moved to `lib/ad-metrics.ts`, shared with the campaign ad-set view.
- **Cards:**
  - Each card shows art (or the headline when there's no media, plus "Needs image"), status, platform, AI mark, carousel card count, ROAS / CTR / spend and a frequency bar against 5.0.
  - Status tabs with counts: All / Live / Fatigued / Draft, plus Archived when there are any.
  - Search covers name and headline; Type and Source filters.
  - Sort by Spend / ROAS / CTR / Frequency / Newest / Name; large or small cards. Sort, card size and studio open/closed persist (`advertix.creatives`).
- **Drawer:**
  - Preview (video plays on demand), headline / text / CTA, 30-day Spend / ROAS / CTR / Frequency, and a plain read from the item's own numbers.
  - **Create variants** opens the studio prefilled from the item's copy.
  - Library items: Edit / Add image, Download, Open campaign, Archive / Restore, Delete. Meta ads: Open campaign and a pause / resume switch on Meta (B4 endpoint, undoable in the campaign's change log).
- **Creative studio:**
  - Inputs: a prompt (Cmd/Ctrl+Enter), Image / Video / Carousel / Text, 1:1 / 9:16 / 16:9, tone, platform and goal, and images per run (none / 1 / 2 / 4, rate-limited to 20 an hour). Carousels take 2–5 cards with an image per card optional. Also a reference image (PNG / JPEG / WebP up to 10 MB) and the six prompt templates from the old page.
  - The brief can build on the best hook ("Builds on …", toggleable).
  - Output: four drafts (one for a carousel), unsaved until **Save to library** / Save all. Saved content keeps every copy variant with the chosen one first, so the variant editor and the wizard work as before. Drafts save to the client in scope.
  - When the AI call fails, it says so and keeps the prompt. The old hard-coded fallback copy is gone.
- **Kept and moved** (into `components/app/creatives/`, restyled onto design tokens and our `Dialog`):
  - Upload: image / video / carousel, device or HTTPS link with a live load check and video page-link detection, 8 MB / 200 MB limits, Meta upload with progress and the 3-minute transcode polling, video orientation.
  - The carousel builder (2–10 cards, AI image per card).
  - The edit dialog: name, the copy-variant editor, carousel edit, video replace.
- **Fixed on the way:**
  - Uploads and attached images save the Meta `imageHash`, so publishing doesn't upload them again.
  - An existing image can now be replaced, not only attached.
  - Uploads belong to the client in scope.
  - The replace-video preview no longer leaks object URLs.
  - Removed the cards' fake "CTR — · 0 imp." and the sorts that did nothing.
- **Removed:** the old 5,241-line page and `components/ui/Modal.tsx` (it was only used there). Dev route `/dev/creatives`.
- **Later:** "Save to library" for synced Meta ads; a Download that bundles carousel cards; a full-screen AI workspace for long briefs (the studio covers the common case).

### A9 — Audiences ✅ (2026-10-22)

- **`/audiences`** rebuilt (`app/(dashboard)/audiences/page.tsx` + `components/app/audiences/`), following the client switcher.
  - **Header:** audiences · in use · to check, with Build with AI and Create audience.
  - **Stats:** Audiences (saved / on Meta), In use, To check, Best ROAS.
  - **Tip cards:** dismissible (`advertix.audiences.dismissed`), then one DataGrid.
- **One board** (`GET /audiences/board?days=30&clientId=`, `services/audience-board.service.ts`):
  - **What it lists:** saved audiences (Advertix) plus the custom, lookalike and saved audiences on every Meta ad account in scope (one per client under "All clients"), each tagged with its account.
  - **Usage and results:**
    - Saved audiences: campaigns made from them, via the new `Campaign.audienceId`.
    - Meta custom audiences: synced ad sets (B4) whose targeting includes them.
    - Meta saved audiences: usage is "—", because Meta copies them into ad sets and doesn't say where they run.
  - **Status from the numbers:** Ready, Unused, Building (Meta still filling), Learning limited (an active ad set using it), Underperforming (ROAS under 60% of the view's, with 10%+ of spend).
  - **Sizes:** Meta's own range for Meta audiences; "largest interest" (shown as N+) for saved ones.
  - **A Meta failure isn't fatal:** the page says why (expired connection, rate limit…) and shows the rest. This replaces the old regex that told users to "connect Meta" for any error.
- **Overlap (open question 1 — decided: verified warnings only, no %):**
  - A lookalike running next to its seed in another active ad set that doesn't exclude it.
  - One custom audience in 2+ active ad sets of a campaign.
  - Saved audiences with near-identical targeting (same locations, cities, gender and custom audiences, 80%+ age overlap, 75%+ shared interests).
  - Each warning names the ad sets; the cards link to the campaign's Ad sets tab.
- **New-audience ideas:** ready custom audiences with 1,000+ people and no lookalike yet → Build lookalike.
- **D2 Create audience** (`AudienceDialog`):
  - **Describe it:** AI, resolved against Meta's interest and location search, with the five templates and Cmd/Ctrl+Enter. The draft opens on Build it to review; drafting again asks first if you edited.
  - **Build it:** name, type, description (new; the AI's rationale fills it), age (validated on blur, min ≤ max), gender, countries, cities, interests, custom audiences (now shown for every type), and size.
  - **Lookalike:** seed, country, 1–10% similarity, created on the seed's Meta account. This was wired in the API but never offered before. `POST /meta/lookalike` and the other Meta discovery routes take an optional `adAccountId`.
  - Closing with unsaved changes asks first.
- **Wizard link:**
  - Loading a saved audience (Load saved audience, or **Use in campaign** → `/campaigns/new?audience=<id>`, which keeps an unfinished draft) records `libraryAudienceId`, sent as `audienceId` on the Meta campaign.
  - `audienceToState` keeps city and custom-audience names, so they're no longer shown as ids.
- **Fixed:**
  - Countries outside the common 12 (from AI or Meta) are now visible and removable in `CountryPicker`, for the wizard too.
  - Saved audiences belong to the client in view.
  - The approx. size no longer goes stale when interests are removed.
  - Actions are reachable without hover.
  - Duplicate / Delete / Edit / Use in campaign moved into a row menu.
- **Shared:** `lib/targeting.ts` (`audienceLine` now reads top-level interests too, `customAudienceIds`, `targetingKey`), used by the campaign ad-set view and this board.
- **Schema:** `Campaign.audienceId` (nullable, `SetNull`). **Run `prisma db push` on production before deploying the API.**
- **Tests:** an integration test (local DB, Meta mocked) covers the audienceId link, Meta usage / statuses / error handling, saved-audience results, all three warnings and clearing one, lookalike ideas, client scope, the lookalike account choice, and the route (8 checks). A8, B4 and B3 still pass.
- **Later:** one-click "add exclusion" on Meta for the lookalike / seed warning (needs ad-set targeting writes); paging past 200 custom / 100 saved Meta audiences.

### B6 — Team ✅ (2026-10-22)

- **Roles (decision 7 — decided: agency roles):**
  - **The four roles:** Owner (everything), Media buyer (edit campaigns, creatives, audiences, suggestions and AI that saves; connect ad accounts), Analyst (view and export only), Client viewer (view and export, only their clients).
  - **Client limits:** any non-owner can be limited to some clients (`MemberClientAccess`); client viewers always are. Limited members always work inside one of their clients.
  - **Legacy values:** ADMIN / EDITOR / VIEWER stay in the enum as legacy values. `scripts/migrate-roles.ts` moves rows to MEDIA_BUYER / ANALYST, and the code reads any leftover as its new equivalent, so `prisma db push` never has to drop enum values.
- **Enforcement on the API** (`lib/access.ts`): `roleGuard` runs before every router.
  - **How a request is classified:** every request maps to a capability (view, export, edit, connect, clients, team, workspace). Read-only POSTs (Ask about this campaign, Check again, refresh suggestions) count as view.
  - **Refusals:** a 403 with a plain reason ("Analysts can view and export, but not change anything here. Ask an owner for Media buyer access.").
  - **Client limits:** checked on campaign / creative / audience / suggestion / change-log ids. Other clients' objects answer 404, so ids don't leak.
  - **Lists:** `parseClientScope` forces a limited member's scope to one of their clients and refuses others; `/clients` and the switcher only list their clients.
  - Client viewers can't open workspace settings or the team list.
- **Invites** (`Invite` model, `services/team.service.ts`):
  - **Inviting:** up to 10 emails at a time, with a role and optional client access (required for client viewers). Each link works for 7 days and only for the invited email.
  - **Email:** sent via Resend from the API (`RESEND_API_KEY`, `INVITE_FROM`, `FRONTEND_URL`). Without a key the invite is still stored, the reason is saved, and the owner gets a copyable link instead of a false "sent".
  - **Managing:** resend (renews), cancel, copy link.
  - **Seats from the plan:** Free/Founder 2, Starter/Team 5, Pro/Agency 10 (client viewers free), Enterprise unlimited. Pending invites count.
  - **Accepting** (`/invite/<token>`):
    - Sign-in is required, and the email must match. Someone signing up from an invite doesn't get an auto-created workspace; onboarding sends them to their invite.
    - An unused auto-created workspace is replaced on accept. A workspace with data blocks joining with a plain message (one workspace per person for now); nothing is deleted.
    - Wrong-email, cancelled, expired and already-used links each say so.
  - The old `POST /workspace/invite`, which answered "Invite sent" without storing or sending anything, now creates a real invite.
- **Members:** change role and client access (owner untouchable, not yourself, seat-checked), remove. `GET /workspace/team` returns members, invites, seats and clients. `/auth/me` returns `access` and `pendingInvite`.
- **Web:**
  - Settings › Team (the tab was "Workspace") is the new `TeamPanel`: seats bar, members grid with role pills and client access, a row menu to change access or remove, and pending invites with status, Copy link, Resend / Renew and Cancel.
  - The D4 `InviteDialog` has email chips, role cards, client chips and a seat check, and shows per-email results with links when email didn't go out. It's also used for "Change role or access".
  - `/invite/[token]` page.
  - Role pill and sidebar show the real role ("Analyst · view only").
  - Read-only roles get disabled buttons with the reason, not failures:
    - Disabled with a reason: New campaign and Sync, Creatives upload and studio (the studio is hidden), Audiences create, campaign detail actions.
    - Removed from view: grid toggles, Apply buttons (shown as Review), row menus, bulk selection, the drawer's edit actions.
    - The wizard explains instead of opening.
  - `useAccess()` mirrors the server rules.
- **Tests:** integration test (local DB) covering capability mapping, the guard per role, client limits (lists, details, edits, 404s), the team list, seats per plan, invites (member emails, client-viewer rule, no-email-key path), accept (wrong email, workspace replacement, busy workspace, cancelled / expired / renewed), member changes and `/auth/me` (9 checks). B2, B3, B4, B5, A8 and A9 still pass.
- **Production:**
  - **Before deploying the API:** run `npx prisma db push`, then `npx tsx --env-file=.env scripts/migrate-roles.ts`.
  - **API environment:** set `RESEND_API_KEY` (and `INVITE_FROM` with a verified sender domain) on the API. `FRONTEND_URL` must be the app URL.
- **Later:** switching between several workspaces; per-client roles beyond read / edit; audit export of team changes (C1).

### A11 — Budgets ✅ (2026-10-22)

- **Route:** `/budgets` replaces `/budget-optimizer`, which now redirects there. The nav points at `/budgets`. No schema change.
- **Cross-platform allocator** (`GET /budgets/allocator`, `services/allocator.service.ts`, `lib/curves.ts`):
  - **Curves:** for each platform, Advertix fits `value(b) = A · (1 − e^(−b/k))` to the client's last 60 days of daily spend and revenue (or conversions when no revenue is recorded).
  - **When it refuses to fit:** fewer than 10 days with spend, spend that barely changed, or no results. The platform is then fixed at today's budget and shows the reason.
  - **Limits it trusts:** half to double today's budget, and never more than 1.5× the highest daily spend it has seen.
  - **What counts:** only active campaigns with a daily budget. Under "All clients" the allocator picks a client, with tabs to switch between them.
  - **Web** (`components/app/budgets/`): one slider per platform with Advertix's mark on it, "Next $ returns", and a live projection (value per day with the change vs today, daily budget, ROAS or cost per result, the mix bar). "Why this mix" explains the move in words. "Use Advertix mix" spreads today's total by marginal return. "Fit to the monthly budget" spreads what's left of the month over the days left.
- **Applying (open question 6 — decided: proportional split, applied to Meta now):**
  - **Split:** a platform's new total is split across its campaigns in proportion to their current budgets, so every campaign moves by the same %.
  - **Review first:** "Review & apply" shows each campaign's old → new budget and whether it will change on Meta.
  - **What goes to Meta:** live Meta campaigns change on Meta through `POST /budgets/allocator/apply` (ad-set or campaign budget). Each change gets a change-log entry with the 7-day Undo.
  - **What doesn't:** drafts, accounts below their minimum daily budget, and Google / TikTok / LinkedIn (read-only today) are listed with the reason ("Change it in Google Ads…"). Failures are reported per campaign and don't stop the rest.
  - Needs edit rights. Analysts can still move the sliders as a what-if.
- **Monthly pacing:** a grid of each client's month-to-date spend against its monthly budget, with a bar showing today's mark, a straight-line projection, a status (On track / Ahead / Behind / No budget / No spend) and a plain note ("Runs out 26 Oct at today's rate", "$7,040 would go unspent").
  - **Owners** set or remove the budget inline.
  - **Row actions:** "Lower budgets" / "Raise budgets" open the allocator for that client, fitted to the month. "Plan" opens it as is.
- **Per-campaign budget review** (kept from the Budget optimizer): the Budget shift suggestions, with Apply / Undo through the B2 executors, so changes really reach Meta. "Review budgets" runs the 14-day-vs-14-day analysis again; the not-enough-data message is shown as is. History lives in the Change log.
- **Removed:** the old page, whose "Apply" only changed the database, and the now-unused `components/ui/EmptyState.tsx`.
- **Tests:** integration test (local DB, Meta mocked) covering:
  - the curve fit recovering a known curve, and the three refusals;
  - allocator data (totals, bounds, fixed platforms, blockers, month budget);
  - the proportional apply to Meta, with change-log entries and skips for drafts and Google;
  - below-minimum failures per campaign and the zero-target refusal;
  - falling back to conversions, and the edit capability.

  5 checks. Screenshots: allocator, mix, apply preview and results, pacing → allocator, review, analyst, empty, dark, mobile.
- **Later:** scheduled budgets (a nightly job) once writes exist for the other platforms; an ad-set level allocator; curves per campaign.

### A12 — AI Planner ✅ (2026-10-22)

- **Grounded in the client's account** (`services/planner.service.ts`, `GET /ai/planner/context`). Before planning, Advertix reads the client's:
  - last 30 days per platform and per campaign (ROAS, or cost per result when no revenue is recorded);
  - response curves (A11) and weekly spread;
  - fatigued ads (B4 read) and custom audiences used by several running campaigns;
  - the month's budget, minimum daily budgets and pixel state.

  The chat's four reasoning steps tick as that work finishes and say what each found ("4 campaigns with spend · $12,800 in 30 days", "Meta 4.18x ROAS · Google Ads 3.73x ROAS", "1 fatigued ad · 1 audience used by several campaigns"). Under "All clients" a "Planning for" picker chooses the client.
- **Plan v2** (`POST /ai/plan-campaign`, Claude Opus 5.5 with structured outputs, so the reply always matches the schema; medium effort; server-side refusal fallback):
  - **The model drafts:** title, budget, days, start, target, phases, and campaigns (platform, goal, audience line, age / gender / countries, interests, share, active days, creatives needed, rationale, the existing campaign it builds on). It also writes watch-outs, assumptions and 24 h / 48 h / 7 d checks.
  - **The server computes:** each campaign's total and daily budget (its share over its own days), dates, minimum-budget warnings and blockers for unconnected platforms.
  - **The server forecasts** from the client's own history: the response curve at the planned spend, else the 30-day average, with the range from the last 4 weeks. Platforms without history get no forecast and the plan says so. "Forecast meets target" / "below target" compares that number with the user's target.
  - The model is told not to state forecast numbers itself.
- **Clarify questions:** at most 3, with up to 4 tappable answers in the chip row.
- **Refinement chips:** "Make it {platform}-heavy" (leans into the platform whose history returns best), "Cut budget by a third", "Stretch by a week". The current draft rides along with each follow-up so only what's asked changes.
- **Starters from real data:** "Spend the rest of October well" (the monthly budget left), "Scale {best campaign}", or a fill-in-the-blanks launch brief for clients without data.
- **Saved plans and versions** (B5 model):
  - **Saving:** the first plan saves automatically; each refinement is the next version, named after what was asked. Each version stores the plan and the conversation that led to it.
  - **"Saved plans" dialog:** open, archive, delete. Deleting a plan keeps its drafts.
  - **The v{n} menu** switches versions.
  - **Access:** limited members only see their clients' plans; the plans routes now check client access.
- **Create campaigns as drafts** (`POST /plans/:id/drafts`):
  - **What it creates:** one DRAFT campaign per planned campaign, on the client's ad account for that platform, with the plan's daily budget, dates and targeting (Meta format). Each is linked to the plan and version (new `Campaign.planId` / `planVersion`) and logged in the change log.
  - **Skips:** campaigns on platforms the client hasn't connected, with the reason.
  - **Limits:** once per version; the plan is then marked Used.
  - **Afterwards:** Meta drafts get "Finish in the wizard" (`/campaigns/new?from=`, which now also loads the draft's targeting); the others say "Saved as a draft · publishing coming soon".
- **Also on the page:**
  - "How Advertix built this" disclosure: rationale per campaign, interests to pick, assumptions, checks.
  - "Copy summary" (plain text) replaces the mockup's "Share with client", which has nothing behind it yet.
- **Read-only roles:** analysts can open saved plans; the composer, starters and Create are disabled with the reason.
- **Removed:**
  - the old planner prompt and methods, and the unused one-shot `planCampaign`;
  - the sessionStorage hand-off to the wizard, which ignored "all genders", was skipped when an autosaved draft existed, and dropped interests;
  - the old 1,080-line page.
- **Schema:** `Campaign.planId` (→ Plan, set null on delete) and `Campaign.planVersion`. Run `prisma db push` before deploying the API.
- **Tests:** integration test (local DB, AI and Meta mocked) covering:
  - context (client pick, per-platform results, curve, weekly spread, fatigue, shared audiences, step texts, prompt, starters);
  - plan building (shares, daily budgets, dates, forecast from curve / average with range, no forecast without history, blockers, minimum-budget warning);
  - the route (clarify, plan, current plan attached, transcript checks, client limits, refusal);
  - the exact Anthropic request (model, structured output, effort, fallbacks header, no sampling params; refusal and truncation);
  - saved plans and drafts (versions with chat, drafts on the right accounts with budget / dates / targeting / change log, skips, once per version, client limits, delete keeps drafts).

  5 checks. B5, B6 and A11 still pass. One live call against a synthetic account confirmed the API accepts the schema and settings (about 36 s, about 6.4k tokens). Screenshots: empty, thinking, plan, versions, drafts, saved plans, reopened plan, clarify, error, analyst, dark, mobile.
- **Later:** streaming the reply; a per-plan "share with client" page; the sidebar badge (open question 8).

### A13 — Connections ✅ (2026-10-23)

- **Route:** `/connections` replaces Settings › Integrations (Settings no longer has the tab; `/settings?tab=integrations` redirects, and Settings now honours `?tab=`). All links moved, including Meta health "Reconnect" (`RECONNECT_URL`), error cards, empty states, the wizard and the legal pages.
- **Staged connects (decision: stage, then pick):**
  - **OAuth no longer adds every ad account it finds.** Accounts already in Advertix just get the new token; this is "Renew", and Meta health re-checks.
  - **New accounts wait** in a `PendingConnection` (encrypted tokens, 30 minutes). The callbacks redirect to `/connect/done?connected=&renewed=&pending=`.
  - **The D1 dialog** (`components/app/connections/ConnectDialog.tsx`) lists the pending accounts with checkboxes and a client each. A client named like the account is suggested; disabled accounts start unticked. It then adds only the picked ones (`POST /connections/pending/:id/accept`) and starts their first sync in the background.
  - **Limited members** must assign accounts to their own clients. Outside a popup, `/connect/done` continues on `/connections?pending=`.
- **One connect hook** (`useConnectPlatform`) replaces the four copy-paste Connect components and `ConnectModal`, all deleted. It gives plain words for every callback error.
- **Page:**
  - **Token warning** per platform: expiring within 7 days or expired, with Renew.
  - **Platform cards:** status (Connected / Needs attention / Not connected / Coming soon), accounts, 30-day spend (or "Mixed" across currencies), Auto-sync toggle, Sync / Connect, last sync. Snapchat is coming soon (decision 8).
  - **Accounts grid:** client, currency, 30-day spend, status, last sync. Filters: All / Needs attention / Unassigned / Archived.
  - **Row action by status:** Renew, Fix pixel, Review, Assign client (owners), Archive (inactive), Restore, Open.
- **Account statuses** (most urgent first): Archived, Inactive, Access expired, Token expiring, Needs attention (blocking health check), Pixel issue, Unassigned (multi-client workspaces), Healthy.
- **Account drawer:**
  - **Details:** client (owners can change it), currency, time zone, minimum daily budget, access expiry, last sync, spend, campaigns.
  - **Full Meta health report:** every problem with what to do, and Check again.
  - **Actions:** Sync now, Renew access, Archive / Restore, and Disconnect. Disconnect's confirm says exactly what's removed (the account, its campaigns, results, ad sets and ads; change-log history stays; nothing changes on the platform).
- **Archive (decision: hide and stop syncing):** `AdAccount.archivedAt`. Archived accounts are hidden from lists, counts and the wizard; excluded from syncs, planners and allocators (also marked inactive); data kept; restorable.
- **Auto-sync for all four platforms (decision):**
  - The scheduler now syncs Meta, Google, TikTok and LinkedIn every `SYNC_INTERVAL_HOURS`, skipping archived accounts and platforms a workspace turned off (`Workspace.autoSyncOff`, `PATCH /connections/auto-sync`).
  - Google, TikTok and LinkedIn syncs now record `lastSyncedAt`; it was never set before.
  - `syncService.syncAccount` dispatches per platform. `POST /connections/sync` (Sync now) and `/connections/accounts/:id/sync` report per account.
- **Fixes:**
  - **Role bypass:** starting OAuth (`GET /<platform>/oauth-url`) needed only "view", so analysts could attach accounts. It now needs "connect", as do all Connections writes.
  - **Meta health was run without a platform check:** it could send another platform's token to Meta. It's now Meta-only, and moved into `meta-health.service.ts`.
  - **Encryption:** `POST /ad-accounts` stored raw tokens; it now encrypts them.
  - **LinkedIn token expiry:** it reported the refresh token's lifetime (~1 year), but access tokens aren't refreshed. It now reports the access token's (~60 days).
  - **Broken `?tab=integrations` links** and "Last synced" showing `createdAt` are gone with the old tab.
  - **Sidebar ad-accounts box:** shows the soonest token expiry ("LinkedIn access expires in 3 days · Renew"). Its Assign link opens the Unassigned filter.
- **Schema:** `AdAccount.archivedAt`, `Workspace.autoSyncOff`, new `PendingConnection`. All additive.
- **Tests:** integration test (local DB, platforms mocked):
  - staging (renew in place, pending for new ones);
  - accept (only picked and offered accounts, clients, first sync, limited members, expired pendings);
  - statuses and their precedence;
  - the overview (spend, cards, client scope);
  - sync now, archive / restore and auto-sync;
  - guards (OAuth needs connect, health is Meta-only, scheduler covers four platforms).

  6 checks. B1, B5 and B6 still pass. Screenshots: page, D1 pick / choose / done, drawer with health report and disconnect confirm, assign, needs attention, sync, analyst, dark, mobile.
- **Later:** a per-account auto-sync override; revoking access on the platform on disconnect; LinkedIn token refresh.

### A13 follow-up — Connections cards (2026-10-25)

- Card **Connect** goes straight to the platform's sign-in (no dialog first). Renew from rows and the banner works the same way. The dialog only opens afterwards, when there are new accounts to pick.
- Connected cards have **Sync** and **Disconnect**. `POST /connections/disconnect { platform }` removes that platform's accounts in the client scope, with a confirm that says exactly what goes (accounts, campaigns, results, ad sets, ads; change log stays; nothing changes on the platform).
- The Unassigned tab counts every account without a client, even when another issue is its main status.
- The Connect dialog only loads connections while open (it's mounted closed in the sidebar's empty state).

### A14 — Settings ✅ (2026-10-25)

- **Tabs:** General, Team (B6 `TeamPanel`), AI & automation, Notifications, Billing.
  - `?tab=` opens a tab; the old `?tab=workspace` maps to Team; `?tab=integrations` redirects to Connections.
  - `/billing` redirects to `/settings?tab=billing`.
  - Client viewers see General, AI and Notifications only (the API refuses them the team and billing).
  - **Header:** Audit log, plus Save changes on General (owners) and Notifications. It reads "Saved" only right after saving, and leaving a tab with unsaved edits asks first.
- **Removed: the fake parts of the old page.**
  - API Keys (invented keys, a `Math.random()` "new key").
  - Security (invented sessions and a fake failed login; dead buttons).
  - Danger Zone (toasts that did nothing).
  - The old Billing page (invented usage, plans that didn't match pricing).
  - Notification toggles that saved nothing.
- **General:**
  - **Agency profile:** name, website, industry, team size. The lists now match onboarding and can be cleared.
  - **Reporting defaults (decision: week start and time zone only):** `Workspace.timezone` and `weekStartsOn`, used by the weekly summary. Attribution window and Shopify/GA4 are left out rather than faked.
  - **Your login:** Clerk's profile (name, email, password, two-step, devices).
  - **Delete workspace (decision: real deletion):** owner only, type the name to confirm. `DELETE /workspace` deletes the workspace and all its data, then the owner's Advertix and Clerk login unless they belong elsewhere. A Clerk failure is reported, not hidden. Members keep their own logins. Non-owners can't edit General, so they get no save button.
- **AI & automation (decision 11):** "Suggest only" shown as active; Auto-apply and Autopilot as coming soon, plus what Advertix does today. Guardrails, ask-first clients and rules wait for auto-apply instead of being switches that do nothing.
- **Notifications (decision: real email, few events):**
  - **Settings:** each person picks email alerts per event (`WorkspaceMember.notifications`, `GET/PUT /auth/notifications`, a personal setting for any role). Slack and in-app show as coming soon. There's a test email (`POST /auth/notifications/test`), a list of recent alerts, and an honest banner when `RESEND_API_KEY` isn't set.
  - **Events and defaults:**
    - Ad platform access expiring (7 days) or expired, and sync failures (`AdAccount.lastSyncError`, set and cleared by `syncService.syncAccount`): owners and media buyers.
    - Budget pacing ahead / behind, from day 5 of the month (shared `computePacing`, moved out of the route): owners and media buyers, analysts can opt in.
    - Weekly summary (last 7 days vs the 7 before per client, at 09:00 on the week's first day in the workspace time zone): everyone. Client viewers only see their clients.
  - **Sending:** hourly scheduler (`startNotificationScheduler`; off with `NOTIFICATIONS_ENABLED=false`, nothing sent without the key). One email per person per event per run. Every item is logged once per person (`NotificationLog`), so there are no duplicates. Sender: `ALERTS_FROM`, falling back to `INVITE_FROM` / `CONTACT_FROM`.
- **Billing (decision 10):** the real plan mapped to the pricing page (FREE → Founder, free during the beta; STARTER → Team; PRO → Agency; ENTERPRISE). Usage against limits: clients, USD spend managed this month (other currencies listed separately), seats (`GET /workspace/billing`). No invoices or cards, since Advertix doesn't bill in the app; Compare plans / Email support instead.
- **Audit log (open question 7):** a drawer with the workspace change log (who, what, applied suggestion / outside Advertix, on the platform, undone), in the client scope, with "Show older".
- **Fixes:**
  - `GET /auth/workspace` skipped the role guard and gave client viewers every member's email; it no longer does.
  - `complete-onboarding` let the client set its own plan; it's always FREE now.
  - The data-deletion page described a Settings button that didn't work; it now describes the real "Delete workspace" flow and accurate timing.
- **Schema:**
  - `Workspace.website`, `timezone`, `weekStartsOn`;
  - `WorkspaceMember.notifications`;
  - `AdAccount.lastSyncError`, `lastSyncErrorAt`;
  - new `NotificationLog`.

  All additive.
- **Tests:** integration test (local DB, Resend mocked) covering:
  - workspace settings and validation;
  - preferences and role defaults;
  - sync errors recorded and cleared;
  - alerts (who gets what, opt-outs, client limits, no duplicates, weekly only on the week's first day, test email, no-key error);
  - billing usage;
  - both auth fixes;
  - workspace deletion (exact name, owner only, cascade, login removal, members untouched, Clerk failure reported).

  7 checks. B1, B6, A11 and A13 (7 checks, with platform disconnect) still pass. Screenshots: each tab, dirty save, delete confirm, audit log, analyst, client viewer, dark, mobile.
- **Later:** Slack and in-app alerts; auto-apply with guardrails, ask-first clients and rules; attribution window; logo upload; in-app billing.

### A15 — Dialogs + QA ✅ (2026-10-26)

- **Dialogs:** D1 (A13), D2 (A9), D3 (A8) and D4 (B6) were finished with their pages. A15 added:
  - **D6 Export** (`components/app/export/`), on Campaigns, Analytics and the Overview (whose "Export report" was disabled until now).
    - **CSV:** the rows as shown.
    - **Excel workbook (decision: CSV + Excel):** built in the browser with `write-excel-file` (loaded only on download). Bold header, frozen first row, number formats, and a bold Total row. Ratios are computed from the sums; money totals are left blank when a sheet mixes currencies.
    - **Sheets:** Campaigns has one per platform (plus "All campaigns"). Analytics has a Summary (KPIs vs the previous period) plus the breakdown. The Overview has a Summary plus Daily.
    - "Send to Google Sheets" shows as coming soon. `components/app/campaigns/csv.ts` is gone.
  - **D7 Duplicate:** for a single campaign, the row menu and the bulk bar now open the dialog (name and budget for the copy). Several selected campaigns are still copied as drafts in one go.
  - **D5 Schedule report** stays visibly disabled until Track C (C4).
- **Dark mode for everyone:** the theme follows the device (`DEFAULT_THEME = "system"`), and the top-bar toggle shows in production.
- **Contrast:** `--c-ink-3` is #6c6980 in light (was the guide's #85829a, about 3.7:1) and #8c899f in dark. Both are at least 4.5:1 on bg, surface and surface-2.
- **Old code removed:**
  - `components/{ui,settings,targeting,campaigns,layout}` are gone. The pieces still in use moved into `components/app/`:
    - `meta/MetaErrorCard` and `meta/MetaHealthStatus`, both restyled onto tokens;
    - `new-campaign/metaSteps` and `MetaAdPreview`;
    - `targeting/pickers`;
    - `creatives/VideoThumbnailPlayer`.
  - The unused legacy `Skeleton` is deleted.
  - `globals.css` lost the legacy tokens, the component classes (glass-card, metric-card, nav-item, status-dot, btn-brand, …) and the old animations: 404 → 147 lines.
  - `tailwind.config.ts` lost the `primary`, `dark` and `sidebar` colours, the `glow` and `card-hover` shadows, and the old keyframes.
  - `REBUILT_ROUTES` is gone from `AppShell`, since every page renders its own header and body. Plus Jakarta was already gone.
- **Off-dashboard pages on tokens:** onboarding, sign-in / sign-up (Clerk primary #6448f2), the OAuth `connect/done` popup, and the privacy / terms / data-deletion pages (marketing tokens). The Upload dialog's selected tab was white text on `bg-ink`, unreadable in dark mode.
- **QA:**
  - **Screenshots and overflow checks** at 390 / 768 / 1024 / 1440 × light / dark, with mocked API: Overview, Campaigns, Campaign detail, New campaign, Analytics, Creatives and Audiences. No horizontal overflow, theme applied everywhere.
  - **Not re-run in this pass:** Budgets, AI Planner, Connections and Settings. The dev server was restarted mid-run. They were checked at mobile and dark in A11–A14, and nothing in A15 changes their layout beyond tokens.
  - **Export test:** every dialog downloads CSV and Excel. Contents verified: sheets, headers, rows, totals.
  - Type-check and lint clean.
- **Later:** Google Sheets export (needs Google OAuth); D5 scheduled reports (C4).

### C1 — Approvals & history ✅ (2026-10-27)

- **What waits:** only Media buyers' changes. Owners never wait; analysts and client viewers can't change anything anyway.
  - **Big budget increases:** a live Meta campaign's budget raised by more than the workspace limit at once. The default is 20%, settable from 1–1000% or Off.
  - **"Ask first" clients:** every change that affects spend (budget, status, schedule, targeting, audience, launch / publish, delete, ad set and ad status, applying a suggestion or a budget plan). Drafts and renames pass.
- **How it works:**
  - `approvalGate` (after `roleGuard`) answers **202** `{pendingApproval, approval, message}` and stores the method, path and body. Nothing is sent to Meta.
  - Asking twice for the same thing returns the request already waiting.
  - Approving replays the stored request through the same router **as the requester**, so role and client limits are checked again. A requester demoted meanwhile gets FAILED.
  - The change log records `approvalId` and `approvedById`.
  - A platform error marks the request FAILED, with the reason.
- **24-hour rule** (Settings › AI & automation › Approvals): if nobody answers within 24 hours, **Keep pending** (default), **Approve** or **Reject**. A scheduler checks every 10 minutes (`APPROVALS_TIMEOUT_ENABLED=false` turns it off).
- **Surfacing:**
  - The sidebar **Activity** badge shows the waiting count, in amber once any request is past 24 hours.
  - Owners see an Overview banner.
  - The Activity page shows a banner explaining what the 24-hour rule will do.
  - The `APPROVALS` email event (owners and media buyers, on by default) covers both "waiting for you" and "decided".
- **Activity page** (`/activity`), following the client switcher:
  - **Waiting:** owners Approve (confirm) or Reject (optional note); requesters can Withdraw.
  - **Decided:** with the decider, or "automatically after 24 hours".
  - **Change history:** with "approved by" and Undo.
- **Web:** the API client turns a 202 into an "⏳ Sent to an owner for approval" notice (with the reason) instead of an error, so every existing screen works unchanged.
- **Code:**
  - `services/approvals.service.ts`, `routes/approvals.ts`, `lib/approval-context.ts`;
  - `app/(dashboard)/activity/page.tsx`, `components/app/approvals/`, `components/app/settings/ApprovalsCard.tsx`.
- **Schema:**
  - `ApprovalRequest`, plus the `ApprovalTimeout` and `ApprovalStatus` enums;
  - `Workspace.approvalBudgetPct` / `approvalTimeout`;
  - `Client.askFirst`;
  - `ChangeLog.approvalId` / `approvedById`.
  - **Production needs `prisma db push` before the API deploys.**
- **Test:** 13 scenarios through the full router with Meta stubbed. They include signed-out requests getting 401 everywhere: an early build let `getAccess` match any member when there was no user, and it now returns null.

### C12 — Morning briefing email ✅ (2026-10-27)

- **What:** one email per person per day, with four sections:
  - **Changes waiting for your approval:** owners only.
  - **Today's top 3 decisions:** open, unexpired suggestions by priority. Each has its impact and reason, and the title links to the campaign.
  - **What changed in the last 24 hours:** up to 6 entries, each saying who made it: a teammate (with "approved" when it went through C1), an applied suggestion, or "changed on the ad platform". The rest link to Activity.
  - **Yesterday's spend per client:** spend plus revenue and ROAS, or results.
- **Who:** owners, media buyers and analysts, limited to the clients they can see.
  - **Opt-in:** off by default; turned on per person in Settings › Notifications.
  - Client viewers aren't offered it.
- **When:** from 08:00 in the workspace time zone, through the hourly alerts job. A late server still catches up until 11:00; after that it waits for the next day. Logged once per person per local date (`briefing:<date>`).
  - A day with nothing to say sends nothing.
- **Send me today's briefing now:** a link under the Morning briefing row in Settings › Notifications (`POST /auth/notifications/briefing`). It sends regardless of the time or the setting.
- **Code:** `briefingData` / `briefingEmail` / `sendBriefing` in `services/notifications.service.ts`. No schema change.
- **Test:** 5 checks:
  - content and order;
  - per-person scope;
  - only from 08:00 until 11:00 local, once a day, opt-in;
  - send-now, and an empty day sending nothing;
  - the defaults.

### C14 — Safety rules ✅ (2026-10-27)

- **Where:** Settings › AI & automation › Safety rules. Each rule is turned on per client and is off by default. Owners edit; everyone else reads. It shares the page's Save button with Approvals.
- **Pixel stopped firing:**
  - **When it acts:** no Meta Pixel on the client's ad account has had an event for 24 hours, and it had fired before. A pixel that never fired is a setup problem, which Connections already shows.
  - **What it does:** pauses the client's active campaigns whose ad sets optimise for conversions (`OFFSITE_CONVERSIONS` / `VALUE`).
  - **Recovery:** once a pixel fires again, it resumes only what it paused, and only if nobody changed the campaign since.
  - **One outage = one episode,** named by the last event before it.
- **Monthly budget running out:**
  - **When it acts:** from the 5th of the month, when pacing says the client is AHEAD of its monthly budget. Mixed-currency clients are skipped.
  - **What it does:** lowers the active Meta daily budgets so the rest of the month fits. It cuts at most the guardrail (default 20%, 1–50%) per day, once a day, respects Meta's minimum budget, and never raises a budget.
- **Hands off after Undo:** every action is a change-log entry by "Safety rule", with a note and the 7-day Undo.
  - An undone pause means the rule leaves that campaign alone for the rest of the outage.
  - An undone cut means the rule leaves that client alone for the rest of the month.
- **Pause all automation** (`Workspace.automationPaused`) stops every rule and keeps the choices. C13 auto-apply will use it too.
- **Emails:** the new `SAFETY` event, on by default for owners and media buyers, with a link to Activity. Activity and the morning briefing label these entries "Safety rule".
- **Runs:** hourly, only for workspaces with a client opted in (`SAFETY_RULES_ENABLED=false` turns it off).
- **Code:**
  - `services/safety.service.ts`;
  - `routes/automation.ts` (`GET/PUT /automation/settings`);
  - `components/app/settings/SafetyCard.tsx`.
- **Schema:** `Client.safetyPixel` / `safetyCap`, `Workspace.safetyMaxCutPct` / `automationPaused`. **Production needs `prisma db push`.**
- **Test:** 8 scenarios with Meta stubbed:
  - pause and resume;
  - same outage;
  - undo means hands off;
  - a person's change wins;
  - never-fired pixel, rule off, and Pause all;
  - cap trimming, once a day, undo for the month;
  - early in the month, validation, permissions and emails.

### C13 — Guarded auto-apply ✅ (2026-10-27)

- **Where:** Settings › AI & automation › **Automation** (the card that also holds the C14 safety rules). Each client gets an **Auto-apply** switch, off by default, meaning "Suggest only". The workspace sets the limit: default 15%, range 1–30%.
  - The "How much should Advertix do on its own?" card now shows how many clients use each level; Autopilot is still coming soon.
- **What applies on its own:** only open, unexpired `SET_DAILY_BUDGET` suggestions on live Meta campaigns that are active and whose daily budget Advertix can change, and only if the move is within the limit and at or above Meta's minimum budget.
  - Order: highest priority first.
  - **One automatic move per campaign per day.** This counts safety-rule cuts too.
- **Never:**
  - "Ask first" clients (their switch is disabled, with a hint);
  - review-only cards;
  - a suggestion someone undid (the existing 7-day `suppressUntil`);
  - a raise while the C14 cap rule is holding that client's budgets down this month (cuts still apply);
  - anything while **Pause all automation** is on.
- **Logged as:** "Suggestion, applied automatically". The suggestion moves to Applied with no applier; the change-log entry has `actorUserId` null, the note "(applied automatically)", `after.auto = <day>`, and the normal 7-day Undo. Emailed through the `SAFETY` alert, now labelled "Automatic changes".
- **Runs:** hourly in the same pass as the safety rules, rules first. It applies suggestions that already exist (Claude writes them when someone runs the check), so it makes no extra AI calls. (The plan said "after each sync"; syncs are periodic too, and running in the same pass keeps it next to the cap rule.)
- **Code:**
  - `autoApply` in `services/safety.service.ts`;
  - `suggestionsService.apply(…, userId: null, { day })`;
  - `components/app/settings/SafetyCard.tsx` and `AiTab.tsx`.
- **Schema:** `Client.autoApply`, `Workspace.autoApplyMaxPct`. **Production needs `prisma db push`.**
- **Test:** 6 checks:
  - applies only small budget moves, logged with Undo;
  - every skip case;
  - one move per campaign per day;
  - an undo isn't repeated;
  - no raises while the cap rule holds;
  - Pause all, the limit and Suggest only.

### C2 — Alerts inbox ✅ (2026-10-28)

- **The bell:**
  - The header bell (desktop and mobile) is live.
  - Its badge counts alerts that are new since you last opened the inbox. It turns red when any open alert is critical, and refreshes on every page change and every 5 minutes.
  - Opening the inbox marks everything as seen.
- **The panel:**
  - **Open / Resolved tabs:** Resolved holds alerts that cleared or were dismissed in the last 7 days.
  - **Grouping:** alerts are grouped by campaign, ad account or client, most severe first.
  - **Each alert** shows a title, the numbers, how long it has been open, and one-click fixes: Reconnect, **Sync now**, **Pause** (after a confirm; for a Media buyer it goes through C1 approvals) and **Undo**, plus links to Budgets, Connections, a campaign or the Automation settings.
  - **Dismiss** applies to the whole workspace (edit role); the alert comes back if the problem clears and returns.
  - After a fix the engine recomputes straight away.
- **Engine** (`services/alerts.service.ts`): reads stored data only, with no platform calls. One row per condition (`dedupeKey`): it stays open while the condition holds, resolves when it clears, and reopens as a new episode. It runs hourly (`ALERTS_INBOX_ENABLED=false` turns that off), and also when the inbox opens if the last run was more than 10 minutes ago. Resolved alerts are deleted after 30 days. Kinds:
  - **Access:** expired (critical) or expiring.
  - **Account:** blocked (critical) or a pixel issue, from the same `accountStatus` as Connections.
  - **Sync failed:** within 24 hours.
  - **Pacing:** over (warning) or under (info) the monthly budget, from the 5th. Includes "Turn on the cap rule" when it's off.
  - **CPA spike:** yesterday's cost per conversion is at least 1.5× the 7 days before, with at least 10 conversions in that week and meaningful spend; or the campaign spent at least 2× its usual CPA with no conversions.
  - **Tracking silence** (critical): an account spent at least half its usual amount yesterday with no conversions, after at least 14 conversions in the week before. Includes "Turn on the pixel rule"; that account's campaigns get no separate CPA alerts.
  - **Automation:** auto-apply and safety-rule changes from the last 24 hours, with Undo, until undone.
  - "Yesterday" is in the workspace time zone.
- **Who sees what:** members see the alerts for their clients. Alerts without a client (unassigned accounts) only go to members who see every client. Reading needs view; dismissing needs edit.
- **Email alerts** (A14) are unchanged; the inbox is the in-app view.
- **Routes:** `GET /alerts?state=open|resolved&refresh=1`, `GET /alerts/summary`, `POST /alerts/seen`, `POST /alerts/:id/dismiss`.
- **Schema:** the `Alert` model, the `AlertSeverity` enum and `WorkspaceMember.alertsSeenAt`. **Production needs `prisma db push`.**
- **Not yet:** platform health checks beyond Meta (Google, TikTok and LinkedIn are covered by access and sync failures); grouping across clients for portfolio views; Slack and in-app push.
- **Test:** 4 scenario groups:
  - every kind, with its fixes and the severity order;
  - deduplication, resolve, reopen and dismiss;
  - per-member scope and unread;
  - undo dropping out, and permissions.

### C4a — Client portal ✅ (2026-10-28)

C4 is split in two: **C4a**, the share link and portal (done), and **C4b**, the scheduled weekly email with a PDF (next).

- **Share report** (Analytics header) opens a dialog for the client in scope; with "All clients", you pick one.
  - **One live link per client.** **New link** stops the old one; **Turn off link** stops it.
  - **Expiry:** never, 30 days or 90 days.
  - **What it shows:** switches for **Spend** (with cost per result and this month's budget), **Revenue** (with ROAS when spend is shown too) and the **Campaign list**. Changes apply to the live link straight away. Results, clicks and CTR are always shown.
  - **Visits:** the dialog shows how many times the link was opened, and when.
  - **Who:** creating and changing links needs edit and access to that client; everyone can see the link.
- **The portal** (`/portal/<token>`, public, no login, `noindex`, no-referrer):
  - shows the agency and client names;
  - 7 / 30 / 90 days compared with the period before;
  - KPI cards, the month's budget bar, a day-by-day chart (spend, revenue, results or clicks) and a campaign table, which becomes cards on phones;
  - when the data was last synced, and a "Powered by Advertix" footer;
  - light and dark mode.

  A link that is revoked, expired or made up gets the same "This link doesn't work any more" page.
- **Security:**
  - **The token:** 32 random bytes, looked up by sha256 and kept AES-encrypted (`encryptToken`) so the link can be copied again; never stored in clear.
  - **Hidden numbers aren't sent:** the API leaves them out of the response, not just off the page.
  - **Responses:** `Cache-Control: no-store` and `X-Robots-Tag: noindex`.
  - **Rate limit:** 120 requests per 15 minutes per IP on `/api/portal`.
  - **Scope:** only that client's ad accounts are read.
- **Routes:** `GET /portal/:token?days=` (public); `GET /shares?clientId=`, `POST /shares`, `PATCH /shares/:id`, `DELETE /shares/:id`.
- **Schema:** `ClientShare`. **Production needs `prisma db push`.**
- **Checks:**
  - **API test:** 4 groups — the full report and the client boundary; toggles really remove data; new, expired and revoked links all 404; scope and permissions.
  - **Screenshots** at 1280 and 390, light and dark, with spend hidden, and for a revoked link: no page errors, no horizontal overflow.

### C4b — Scheduled client reports ✅ (2026-10-28)

- **Schedule report** (Analytics header, next to Share report), one schedule per client:
  - **Recipients:** chips; type or paste, separated by Enter, comma or space; checked and de-duplicated; up to 10.
  - **When:** **Weekly** (the workspace's first day of the week, covering the 7 days before) or **Monthly** (the 1st, covering the calendar month before), at **09:00 workspace time**.
  - **What's in it:** the same Spend / Revenue / Campaigns switches as the portal, plus **Attach a PDF**.
  - **Status line:** "Next report Mon 2 Nov, 09:00 (Asia/Karachi) · last sent …", or the last error.
  - **Send me a test** sends the report exactly as set in the form, to you only, marked "[Test]".
  - **Stop sending** keeps the settings. Closing with unsaved changes asks first.
  - If the client has no share link yet, a link opens Share report.
- **The email:**
  - **Sender and replies:** from "<agency> via Advertix" on the verified address (`ALERTS_FROM`); Reply-To is the person who set it up.
  - **Subject:** "<client>: Week of 19–25 Oct 2026" or "<client>: October 2026".
  - **Body:** the headline numbers with their change, coloured by whether it's good (spend stays neutral); this month's budget (weekly reports only); the top 5 campaigns; "View the live report" when the client has a share link.
  - **Quiet periods** say "No ad activity in this period."
- **The PDF** (pdfkit, Geist fonts bundled in `apps/api/assets/fonts` under the OFL, about 20 KB):
  - header and period;
  - KPI cards, four a row, with big numbers shrunk to fit;
  - the budget bar;
  - a campaign table: up to 30 rows, long names cut with "…", the header repeated on new pages;
  - a footer on every page.
- **Same numbers everywhere:** `clientReport()` in `portal.service.ts` now backs both the portal and the reports. Hidden numbers are left out of the data.
- **Sending:**
  - an hourly job, sending only with `RESEND_API_KEY` (`SCHEDULED_REPORTS_ENABLED=false` turns it off);
  - due from 09:00 on its day, local time;
  - the period is claimed first (`lastPeriod`), so it goes out once even if two runs overlap;
  - errors are kept in `lastError` and shown in the dialog.
- **Permissions:** viewing a schedule needs view; saving and test sends need edit and access to the client.
- **Deploy:** new dependency `pdfkit` (plus `@types/pdfkit`). The Dockerfile now copies `apps/api/assets`. **Schema:** `ReportSchedule`. **Production needs `prisma db push`.**
- **Checks:**
  - **API test:** 5 groups:
    - periods;
    - validation;
    - timing, local 09:00, once per period;
    - the email (sender, Reply-To, PDF, link, hidden numbers);
    - test sends, permissions, off.
  - **The PDF** was rendered and reviewed.

### C5 — Flight calendar ✅ (2026-10-28)

- **Calendar** (`/calendar`, in the sidebar after Campaigns and in ⌘K) follows the client switcher. It's read-only, so everyone who can see campaigns can see it.
- **Timeline:**
  - a row per client (plus "Unassigned accounts"); campaigns that don't overlap share a line;
  - one bar per campaign, from its start to its end: **Live** (brand), **Scheduled** (brand-mid: active, start in the future), **Draft** (dashed, only with a start date), **Paused** (with a pause mark), **Ended**;
  - no end date: the bar fades out to the right; bars cut by the window edge lose their rounded corner;
  - week lines, weekend shading at 5 weeks, the **Today** line, and key-date lines with labels (dates close together share one, "Black Friday +1");
  - **zoom** 5 weeks / 3 months / 6 months; ‹ › move 2 / 6 / 12 weeks; **Today** jumps back. Earlier data stays on screen while the next window loads.
- **List view** (the default on phones): what starts and ends each week, plus the key dates, with "This week" highlighted.
- **Selecting a bar** shows its dates and length, phase, client, platform, ad account, objective and budget, with **Open campaign** (or Open draft).
- **Worth a look** (above the calendar; flagged bars get an orange ring):
  - **Overlap:** live or scheduled campaigns on the **same ad account with the same objective, running at once**. They bid in the same auctions, so the platform delivers mostly one. The note is stronger when they use the same saved audience.
  - **Launches into Black Friday week:** a draft or scheduled campaign starting from 3 days before Thanksgiving to Cyber Monday. It would spend its learning days at the most expensive time, so the note suggests starting a week or two earlier. It disappears once the campaign has started.
  - **Not built:** the mockup's warning when *different* clients run on the same platform in the same week. Separate clients don't bid against each other, so it would flag something that isn't a problem.
- **Key dates** (`lib/key-dates.ts`), switchable as Retail / Seasonal / Cultural (remembered per browser):
  - computed for any year: New Year, Valentine's, Mothering Sunday (UK), Easter, Mother's Day (US), Father's Day, Halloween, Singles' Day, Thanksgiving (US), Black Friday, Cyber Monday (both marked as the peak), Christmas, Boxing Day, New Year's Eve;
  - from a table for 2025–2028: Lunar New Year, Ramadan begins, Eid al-Fitr and Eid al-Adha (marked approximate) and Diwali. **Add a row to `LUNAR` each year**; years without one leave those dates out rather than guess.
- **Dates on the calendar:**
  - campaigns with no start date use when they were published or created (shown as such);
  - ended campaigns with no end date (archived on the platform) end on their last day with spend, and ones that never spent are left out;
  - drafts with no start date aren't shown: a note counts them, with a link to Campaigns;
  - up to 1,000 campaigns per window, with a note past that.
- **API:** `GET /calendar?from=YYYY-MM-DD&to=YYYY-MM-DD&clientId=` (at most 400 days), in `services/calendar.service.ts`. It returns the campaigns, overlaps, peak launches, key dates and the count of undated drafts. **No schema change.**
- **Shared:** `useApi` has a `keepPrevious` option (SWR `keepPreviousData`).
- **Checks:** API test with 7 groups: key dates for 2026 and 2027 (Easter, Thanksgiving, Black Friday, Mother's Day, across the year end, no guessed lunar years); the window; phases and what's left out; overlaps; peak launches; client scope and shared audience; permissions. Typecheck and lint clean. **Not yet seen in the browser** (the dev server was off).

### C6 — Schedule step and auto-pause ✅ (2026-10-28)

- **Scope (decided 2026-10-28):** schedule plus auto-pause. Smart hours moved to **C7**, where the engine is: Meta can only switch hours off (with a lifetime budget), not lower bids by hour, so a switch now would do nothing. "Out of stock" needs Shopify (**C18**).
- **Wizard, step 2 (Budget and schedule):**
  - **Run continuously / Set an end date** (as the mockup) replaces the toggle; a total budget needs an end date; the end date shows the number of days.
  - **Calendar notes** for the Meta campaign (`GET /calendar/check`): starts in **Black Friday week** (from 3 days before Thanksgiving to Cyber Monday), or **overlaps** a running or scheduled campaign on the same ad account with the same objective, with a link to the calendar.
- **Pause automatically** (new card in step 2, Meta only; also on the campaign's **Settings** tab for published and synced Meta campaigns):
  - **Spend reaches a cap:** pauses once lifetime spend (all synced days) reaches it. It's checked hourly, so it can go a little over. **It never restarts on its own:** after a cap pause a person turns it back on, so the extra spend goes through Approvals like any launch.
  - **Blackout dates:** up to 20 periods, in the workspace time zone, with optional names. Chips suggest the key dates while it runs (Diwali, Christmas…). Paused on those days; **back on the day after** the blackout ends, unless someone changed it meanwhile.
  - **Tracking stops:** the C14 pixel rule for just this campaign, whatever its goal (paused while the account's pixel has been silent 24 hours, resumed when it fires). When the client's own safety rule already covers it, the switch shows "Already on".
  - **Saving checks at once:** a blackout covering today, or a cap already reached, pauses it on save (pauses only; turning on is a person's call).
  - **The review step** shows an Auto-pause line ("Pauses at $1,000 spent, on Diwali · 8 Nov").
- **Same machinery as the safety rules:**
  - the hourly safety pass runs auto-pause too (`services/auto-pause.service.ts`);
  - each action is a RULE change-log entry with a note and the 7-day Undo; an Undo means hands off for that episode;
  - **Pause all automation** stops it;
  - the same "Advertix changed a campaign on its own" email.
- **API:**
  - `PUT /campaigns/:id/auto-pause` (`routes/auto-pause.ts`, edit), with validation.
  - `GET /calendar/check?adAccountId=&objective=&start=&end=&excludeId=` (view; limited members only for their clients).
- **Fix (C5):** overlaps now match an objective under both its names (the wizard's "Conversions" and a synced campaign's "OUTCOME_SALES").
- **Schema:** `Campaign.spendCap`, `blackouts` (JSON), `pauseOnTrackingLoss`. **Production needs `prisma db push`.**
- **Checks:** API test with 7 groups (validation; spend cap; blackouts in the workspace time zone with resume the day after and a person's change winning; pause on save and Pause all; tracking for one campaign; the calendar check across objective names; permissions). C14, C13 and C5 tests still pass. Typecheck and lint clean. **Not yet seen in the browser** (the dev server was off).

### C7 — Smart hours ✅ (2026-10-30)

- **Scope (decided 2026-10-30): the full C7.** One-click hour changes are Meta only. Google (bid adjustment) and TikTok (dayparting) get exact manual steps, because Advertix doesn't write to those platforms anywhere else yet and neither has a test account (Google's developer token isn't set).
- **Data** (`services/hours.service.ts`):
  - **Once a day per ad account** (hourly check, 4 minutes after start; `SMART_HOURS_ENABLED=false` turns it off), for active accounts with spend in the last 45 days.
  - **Meta:** one insights call with `hourly_stats_aggregated_by_advertiser_time_zone` and daily rows over 45 days, purchases counted as in the daily sync.
  - **Google:** GAQL by `segments.day_of_week` × `segments.hour`.
  - **TikTok:** `stat_time_hour`, a day per call, the last 14 days.
  - Each campaign's week is stored as up to 168 `HourlyStat` rows (weekday × hour, account time zone), rebuilt each day. A failed account is retried the next day, not every hour.
- **Analysis:**
  - cost per result (purchases; clicks when there are none) against the average;
  - a cell needs 3 conversions (an hour row 10) or it's hatched "too few to judge";
  - spending 3× the average cost with nothing back counts as expensive.
- **Gate:** suggestions only after **14 days with spend and 300 conversions**. Before that the tab shows progress bars and the heatmap is for reading.
- **The suggestion:**
  - the run of 2–8 hours (it can wrap past midnight) costing **40%+ more** than average;
  - no cheaper-than-average hour inside it;
  - enough spend to expect 10+ conversions, and a shortfall beyond normal variation;
  - never more than a third of the spend;
  - the biggest saving wins, shown as ≈ per week. Google gets a bid adjustment in 5% steps (−10 to −90%).
  - Otherwise: "Keep it running around the clock".
- **Acting:**
  - **Meta one-click** (Advertix-published campaign, total budget, active or paused) switches those hours off on the ad set (`adset_schedule`, advertiser time zone). It keeps any hours already off, and says so if they're already off.
  - It runs as a suggestion (`SET_AD_SCHEDULE`, source RULE, kind "Smart hours"). **A media buyer's apply or undo always goes to Approvals.**
  - Logged as `adset.schedule` ("Changed the hours it runs from around the clock to off 00:00–06:00 (smart hours)").
  - **Undo** restores the previous hours (all hours if there were none) and refuses if they were changed since.
  - **Daily budget, or not published from Advertix:** the steps for Ads Manager, because Meta can't switch an existing ad set from daily to lifetime.
- **Smart hours switch** (`Campaign.smartHours`):
  - on the Hours tab and in the wizard (step 2, with "Use $X in total" when the budget is daily and there's an end date);
  - when on, the daily run puts the suggestion in the suggestions feed and briefing;
  - turning it off expires its waiting suggestions.
- **UI:**
  - **Hours** tab on campaign detail: heatmap with an "All days" row (the suggested hours outlined), a readout on hover or focus, **click or tap a cell to pin it** (to compare, and for phones with no hover; Esc or Unpin clears it), a legend ("Around average (up to +40%)"), a screen-reader table, the Advertix suggests card and "What each platform allows";
  - **Budgets:** the client view (All / Meta / Google / TikTok, read only, mixed currencies explained);
  - the review step shows Smart hours.
- **API:** `GET /campaigns/:id/hours`, `PUT /campaigns/:id/smart-hours`, `POST /campaigns/:id/hours/suggest` (then the usual `/suggestions/:id/apply`), `GET /hours?clientId=&platform=`.
- **Schema:** `HourlyStat`, `Campaign.smartHours` / `hoursSyncedAt`, `AdAccount.hoursSyncedAt`. **Production needs `prisma db push`.**
- **Local test data:** the scratchpad script `seed-hours.ts <campaignId>` fills one campaign's week (~470 purchases, 00–06 about 2× the cost) on a **local** database only; `--undo` removes it.
- **Checks:**
  - **API test** (8 groups): analysis and gate; schedule grid; Meta hourly sync; Hours API; Smart hours → suggestion → media buyer to Approvals → approve → Meta; Undo and its refusal; tab apply, daily-budget refusal, already off; permissions.
  - **Still pass:** C1, B2, B3, C13, C14, C6, C5.
  - Typecheck and lint clean. A seeded local campaign gave 00–06, +64%, ≈166/week. **Not yet seen in the browser.**

### C9a — Experiments (reading A/B tests) ✅ (2026-10-30)

- **Decisions (2026-10-30):**
  - **Meta's own A/B test** (ad studies: a randomised split, so each person sees one version), creatives first, built in phases C9a → C9b → C9c;
  - **Google, TikTok, LinkedIn (and Snapchat) experiments are added the same way once Advertix writes to them**;
  - **C8 Snapchat stays "coming soon"**.
- **Reading tests:**
  - **When:** after each Meta sync, non-fatal (`services/experiments.service.ts`).
  - **Where from:** the ad account's `act_…/ad_studies` first (not documented by Meta, but it covers accounts without a Business), then `/{business_id}/ad_studies` (Meta's documented edge). The Business id is looked up once and saved as `AdAccount.metaBusinessId`.
  - **What's kept:** split tests (`SPLIT_TEST` / `SPLIT_TEST_V2`, not lift studies) with 2+ versions on this account (by the cells' ad accounts, or their campaigns, ad sets or ads). They're stored as `Experiment` rows; cells keep the platform's ids, and `ads` is asked for with a fallback for API versions without it.
- **Results:** each version's totals over the test window (from its start day to its end or now). They come from ad-level results for ad-set or ad versions, and campaign results for campaign versions.
- **How sure (`lib/ab-stats.ts`):** Bayesian chance each version is best, from 20,000 samples with a fixed seed, so it doesn't jump between page loads.
  - **Cost goals:** results per unit of spend, Gamma–Poisson.
  - **CTR:** Beta.
  - **Conclusive** at 95%. While running, Advertix estimates when it will be clear (at today's pace, up to 8× the data); beyond that it's "too close to call".
  - Once clear, it shows **the saving by ending early**: the other versions' remaining spend at their pace.
  - **The goal** is cost per purchase when there are 10+ purchases, otherwise cost per click. **Judge by** overrides it per test (`PUT /experiments/:id/goal`).
- **Experiments page** (`/experiments`, sidebar after Calendar, follows the client switcher), the mockup's F3 card:
  - name; client · Meta · split · day x of y · goal; the confidence pill;
  - each version's cost per result, purchases or clicks, CTR, spend and "chance it's best" bar; the leader outlined green once conclusive;
  - the Advertix note; Judge by; a link to Ads Manager;
  - the empty state links to Meta Experiments.
- **API:** `GET /experiments?clientId=` (view), `PUT /experiments/:id/goal` (edit).
- **Next, C9b:** create creative tests from Advertix (`SPLIT_TEST_V2` on `/{business_id}/ad_studies`, 2–5 cells with one ad each; Meta's examples use Graph v21+, so check whether the C16 upgrade is needed first), end a test, and **Scale the winner** through Approvals with Undo. That needs the Live app locally (or production), since the test app can't create ads.
- **Schema:** `Experiment`, `AdAccount.metaBusinessId`. **Production needs `prisma db push`.**
- **Checks:** API test with 5 groups (stats; sync via the account then the Business, filtering and no duplicates; results in the window with confidence, lift and saving; client scope, goal switch, close race; permissions). B4 sync still passes. Typecheck and lint clean. **Not yet seen in the browser**, and not yet run against real Meta A/B tests.

### C9b + C9c — Starting tests, Scale the winner, lessons ✅ (2026-10-30)

- **C9b, New test** (Experiments header, `POST /campaigns/:id/experiments`):
  - **What it needs:** a Meta campaign published from Advertix (Advertix knows its ad set, ad and Page), a name, 1–4 **images or videos from Creatives**, 3–30 days, and a test budget a day (at least the account's daily minimum per version).
  - **What Advertix does:** the current ad is version A. Each creative becomes a new ad in the same ad set with the same text, headline, link, call to action and Page. Images are uploaded if they only have a URL; videos must already be on Meta. Then Meta's creative test is started (`SPLIT_TEST_V2` on `/{business_id}/ad_studies`, one ad per cell, an even split, `creative_test_config.daily_budget`), beginning in 10 minutes.
  - **If any step fails,** the ads, creatives and test it made are deleted.
  - **Where the test is created:** under the account's Business; for a **personal ad account** (no Business), under the person who connected it (`me/ad_studies`, Meta's user edge). Reading tests falls back the same way. A failed Business lookup is logged (`[experiments] business of …`) and treated as personal.
  - **Synced campaigns:** when Advertix didn't publish the campaign, the Page is read from its current ad's creative and saved.
  - **Approvals:** held for media buyers on Ask first clients, like publishing. Logged as `experiment.create`.
- **End test** (`POST /experiments/:id/end`): moves the end time on Meta to a minute from now. Logged.
- **Scale the winner** (`POST /experiments/:id/scale` → a suggestion, then `/suggestions/:id/apply`, actionType `SCALE_WINNER`):
  - **What it does:** pauses the other versions' active ads, ad sets or campaigns. For ad-set tests it adds their daily budgets to the winner's ad set.
  - **Approvals and Undo:** a media buyer's click always goes to Approvals. Undo resumes them and restores the budget, and refuses if anything was changed since. Logged as `experiment.scale` ("Scaled the winner of “…”: kept …, paused 1 other version and raised its daily budget from $100 to $180").
- **Meta version:** ad study calls use `META_STUDIES_API_VERSION` (default **v25.0**) while the rest stays on v19, because Meta documents creative tests with current versions only. One app may call several versions.
- **C9c, lessons:**
  - when a test ends, Advertix pre-fills "What it showed" ("Founder hook beat UGC hook: 23% cheaper per purchase (Lumen hooks, Nov 2026)", or "No clear difference …"); people edit and save it (`PUT /experiments/:id/lesson`);
  - "What your tests showed" lists them at the top of Experiments (`GET /experiments/lessons`);
  - **the AI Planner** gets the client's last 5 in its account data and is told to build on what won and not repeat what lost.
- **Schema:** `Experiment.createdById` / `createdAds` / `lesson`.
- **Checks:** API test with 8 groups:
  - validation; rollback when Meta refuses; start (copy, split, budget, log); Ask first → Approvals;
  - End (once); Scale through Approvals with the budget move and Undo; no re-proposal right after an Undo;
  - lessons (suggested, saved, listed, in the planner prompt).
  - **Still pass:** C9a, C1, B2, B3, C7, A12 (planner). Typecheck and lint clean. **Not yet seen in the browser, and not yet run against Meta.**
