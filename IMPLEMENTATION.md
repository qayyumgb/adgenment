# AdGenius AI — Implementation Log

A multi-platform AI-powered ad management dashboard. Premium SaaS UI, Claude-powered campaign planning and creative generation, real backend with Prisma + Postgres + Clerk.

> **Maintain this file.** Update the [Change Log](#change-log) (newest first) and the relevant sections any time files change, features land, or setup steps shift.

---

## Tech Stack

| Layer | Stack |
|---|---|
| Frontend | Next.js 14 (App Router) · React 18 · TypeScript · Tailwind CSS · Plus Jakarta Sans |
| Charts / icons | recharts · lucide-react |
| State / UX | clsx · react-hot-toast · framer-motion |
| Auth | Clerk (`@clerk/nextjs` on web, `@clerk/backend` on api) |
| Backend | Express 4 · TypeScript · Helmet · express-rate-limit |
| ORM / DB | Prisma 5 · PostgreSQL |
| AI | Anthropic Claude Sonnet 4 (`claude-sonnet-4-20250514`) via native `fetch` |
| Ad platforms | Meta Marketing API v19.0 (OAuth 2.0 + AES-256-CBC encrypted tokens) |
| Monorepo | Turborepo |

---

## Project Structure

```
adgenius-ai/
├── apps/
│   ├── api/                          # Express backend
│   │   ├── prisma/schema.prisma      # Data model
│   │   └── src/
│   │       ├── index.ts              # Server entry (helmet, rate-limit, graceful shutdown)
│   │       ├── lib/
│   │       │   ├── prisma.ts         # Singleton PrismaClient
│   │       │   └── workspace.ts      # getUserWorkspace / requireWorkspace / role helpers
│   │       ├── middleware/
│   │       │   ├── auth.ts           # Clerk JWT → User auto-create → req.user
│   │       │   └── errorHandler.ts   # Prisma + custom error mapping
│   │       ├── routes/
│   │       │   ├── index.ts          # Mounts all routers under /api
│   │       │   ├── auth.ts           # /auth/me, /complete-onboarding, /workspace
│   │       │   ├── campaigns.ts      # /campaigns CRUD + metrics
│   │       │   ├── ad-accounts.ts    # /ad-accounts CRUD + toggle
│   │       │   ├── analytics.ts      # /overview /timeseries /by-platform /campaigns
│   │       │   ├── creatives.ts      # /creatives CRUD
│   │       │   ├── workspace.ts      # /members, /invite, role updates
│   │       │   ├── meta.ts           # Meta OAuth + sync + ad accounts
│   │       │   └── ai.ts             # /plan-campaign /generate-copy /health
│   │       ├── services/
│   │       │   ├── ai.service.ts     # Anthropic Messages API wrapper
│   │       │   ├── meta.service.ts   # Meta Marketing API + AES-256-CBC token crypto
│   │       │   └── sync.service.ts   # Pull campaigns + insights into DB (Meta today)
│   │       └── types/
│   │           └── express.d.ts      # Augments Request with userId/dbUserId/user
│   │
│   └── web/                          # Next.js frontend
│       ├── middleware.ts             # Clerk auth + onboarding redirect
│       ├── lib/
│       │   └── api.ts                # Typed useApiClient() hook
│       ├── components/
│       │   ├── layout/               # Sidebar (with Connect modal), Header
│       │   ├── dashboard/            # MetricCard, SpendChart, CampaignTable, PlatformBreakdown
│       │   ├── campaigns/            # CreateCampaignModal
│       │   ├── connect/              # ConnectModal (lists all platforms, opens OAuth popup)
│       │   └── settings/             # MetaConnect (inline card variant)
│       ├── lib/
│       │   ├── api.ts                # useApiClient() — typed REST hook
│       │   └── oauth-popup.ts        # openOAuthPopup() / openMetaOAuthPopup()
│       └── app/
│           ├── layout.tsx
│           ├── page.tsx              # Landing
│           ├── globals.css           # Design tokens + utility classes
│           ├── (auth)/               # /sign-in /sign-up (Clerk)
│           ├── (onboarding)/         # /onboarding (4-step wizard)
│           ├── (dashboard)/          # Authed app shell
│           │   ├── layout.tsx        # Sidebar + Header + Toaster
│           │   ├── dashboard/        # Main dashboard
│           │   ├── campaigns/        # List + detail
│           │   ├── audiences/        # Audiences + AI build modal
│           │   ├── creatives/        # Creative library + AI copy modal
│           │   ├── analytics/        # Full analytics
│           │   ├── ai-planner/       # Claude chat + plan preview
│           │   ├── insights/         # AI insights + floating chat widget
│           │   ├── billing/          # Plans + usage + history
│           │   └── settings/         # 7-tab settings
│           └── api/                  # Next.js route handlers (proxy to backend)
│               ├── ai/
│               │   ├── plan-campaign/route.ts
│               │   └── generate-copy/route.ts
│               └── meta/
│                   └── connect/route.ts    # Forwards Clerk session, returns Meta OAuth URL
└── packages/
    └── shared/                       # Cross-app shared code
```

---

## Frontend Pages

| Route | File | Notes |
|---|---|---|
| `/` | [apps/web/app/page.tsx](apps/web/app/page.tsx) | Landing |
| `/sign-in` | [apps/web/app/(auth)/sign-in/[[...sign-in]]/page.tsx](apps/web/app/(auth)/sign-in/[[...sign-in]]/page.tsx) | Clerk `<SignIn />` |
| `/sign-up` | [apps/web/app/(auth)/sign-up/[[...sign-up]]/page.tsx](apps/web/app/(auth)/sign-up/[[...sign-up]]/page.tsx) | Clerk `<SignUp />` |
| ~~`/onboarding`~~ | _removed_ | Workspace is now auto-created on first authenticated request (see [auth.ts](apps/api/src/middleware/auth.ts)) |
| `/connect/done` | [apps/web/app/connect/done/page.tsx](apps/web/app/connect/done/page.tsx) | Popup-close page hit by OAuth callbacks. If opened in a popup, posts message to parent + closes; otherwise redirects to Settings |
| `/dashboard` | [apps/web/app/(dashboard)/dashboard/page.tsx](apps/web/app/(dashboard)/dashboard/page.tsx) | Greeting, AI insight banner, 4 metric cards, spend + platform charts, campaign table, AI activity + quick actions |
| `/campaigns` | [apps/web/app/(dashboard)/campaigns/page.tsx](apps/web/app/(dashboard)/campaigns/page.tsx) | Filters, grid/list toggle (localStorage), 12 mock campaigns, pagination, Create modal |
| `/campaigns/[id]` | [apps/web/app/(dashboard)/campaigns/[id]/page.tsx](apps/web/app/(dashboard)/campaigns/[id]/page.tsx) | Detail page · 5 tabs: Overview, Ad Sets, Creatives, Audience, Settings |
| `/audiences` | [apps/web/app/(dashboard)/audiences/page.tsx](apps/web/app/(dashboard)/audiences/page.tsx) | 12 audiences, type-colored cards, AI Build Audience modal |
| `/creatives` | [apps/web/app/(dashboard)/creatives/page.tsx](apps/web/app/(dashboard)/creatives/page.tsx) | 12 creatives w/ distinct previews per type, AI Generate Copy modal (real API) |
| `/analytics` | [apps/web/app/(dashboard)/analytics/page.tsx](apps/web/app/(dashboard)/analytics/page.tsx) | 4 metric cards, 6-metric chart, platform bars, funnel, sortable campaign table, AI insights |
| `/ai-planner` | [apps/web/app/(dashboard)/ai-planner/page.tsx](apps/web/app/(dashboard)/ai-planner/page.tsx) | Real Claude chat + structured plan preview (donut, audience chips, ad formats, expected results, insights) |
| `/insights` | [apps/web/app/(dashboard)/insights/page.tsx](apps/web/app/(dashboard)/insights/page.tsx) | 8 typed insight cards (opportunity/warning/optimization/alert), dismiss + restore, floating Ask-AI chat widget |
| `/billing` | [apps/web/app/(dashboard)/billing/page.tsx](apps/web/app/(dashboard)/billing/page.tsx) | Current plan, 3 usage meters, 4-plan comparison table w/ monthly/annual toggle, empty history, CSS credit card |
| `/settings` | [apps/web/app/(dashboard)/settings/page.tsx](apps/web/app/(dashboard)/settings/page.tsx) | 7 tabs: General · Workspace · Integrations · Notifications · API Keys · Security · Danger Zone |

### Shared components

- [components/layout/Sidebar.tsx](apps/web/components/layout/Sidebar.tsx) — Dark sidebar (#0f172a), workspace selector, AI planner quick-action, 4 nav groups w/ badges, connected platforms strip, user profile. Collapsible (72px / 260px).
- [components/layout/Header.tsx](apps/web/components/layout/Header.tsx) — Search w/ ⌘K, New Campaign, notifications popover, plan pill, Clerk `UserButton`.
- [components/dashboard/MetricCard.tsx](apps/web/components/dashboard/MetricCard.tsx) — Title, value, trend pill, sparkline.
- [components/dashboard/SpendChart.tsx](apps/web/components/dashboard/SpendChart.tsx) — ComposedChart (Area spend + Line ROAS, dual axes).
- [components/dashboard/PlatformBreakdown.tsx](apps/web/components/dashboard/PlatformBreakdown.tsx) — Donut + interactive list.
- [components/dashboard/CampaignTable.tsx](apps/web/components/dashboard/CampaignTable.tsx) — Filter tabs + table.
- [components/campaigns/CreateCampaignModal.tsx](apps/web/components/campaigns/CreateCampaignModal.tsx) — 4-step modal: Platform → Objective → Budget → Review.

---

## Backend Routes

All routes mounted under `/api`. Auth-gated routes use `requireAuth` (Bearer token from Clerk).

### Auth — [auth.ts](apps/api/src/routes/auth.ts)
| Method | Path | Notes |
|---|---|---|
| GET | `/api/auth/me` | Returns user + workspace + member count |
| POST | `/api/auth/complete-onboarding` | Creates Workspace + OWNER member (refuses if user already has one) |
| POST | `/api/auth/workspace` | Creates additional workspace |
| GET | `/api/auth/workspace` | Workspace with members + ad-account count |

### Campaigns — [campaigns.ts](apps/api/src/routes/campaigns.ts)
| Method | Path | Notes |
|---|---|---|
| GET | `/api/campaigns` | Filters: `platform`, `status`, `search`. Paginated. |
| POST | `/api/campaigns` | Validates ad account ownership + matching platform |
| GET | `/api/campaigns/:id` | Includes adAccount + last 30 metrics |
| PUT | `/api/campaigns/:id` | Whitelisted partial update |
| DELETE | `/api/campaigns/:id` | Cascade deletes metrics + creatives |
| GET | `/api/campaigns/:id/metrics` | Trailing N days (default 30) |
| POST | `/api/campaigns/:id/metrics` | Upsert on (campaignId, date); auto-derives ctr/cpc/cpm/roas |

### Ad Accounts — [ad-accounts.ts](apps/api/src/routes/ad-accounts.ts)
| Method | Path | Notes |
|---|---|---|
| GET | `/api/ad-accounts` | Tokens are never returned |
| POST | `/api/ad-accounts` | Upsert on (workspaceId, platform, accountId) |
| DELETE | `/api/ad-accounts/:id` | Cascade deletes related campaigns |
| PATCH | `/api/ad-accounts/:id/toggle` | Flip `isActive` |

### Analytics — [analytics.ts](apps/api/src/routes/analytics.ts)
| Method | Path | Notes |
|---|---|---|
| GET | `/api/analytics/overview` | Current + previous period sums w/ % change |
| GET | `/api/analytics/timeseries` | Daily groupBy on `date`, pick metric |
| GET | `/api/analytics/by-platform` | Aggregated per platform with derived ROAS/CTR |
| GET | `/api/analytics/campaigns` | Per-campaign totals, sortable, paginated |

### Creatives — [creatives.ts](apps/api/src/routes/creatives.ts)
| Method | Path | Notes |
|---|---|---|
| GET | `/api/creatives` | Filters: `type`, `platform` (via campaign), `status`, `search` |
| POST | `/api/creatives` | Validates type enum + campaign ownership |
| PUT | `/api/creatives/:id` | Update name/content/status |
| DELETE | `/api/creatives/:id` | |

### Workspace — [workspace.ts](apps/api/src/routes/workspace.ts)
| Method | Path | Notes |
|---|---|---|
| GET | `/api/workspace/members` | With user details |
| POST | `/api/workspace/invite` | OWNER/ADMIN only — currently no-op + TODO for Resend integration |
| PUT | `/api/workspace/members/:memberId/role` | Forbid changing OWNER |
| DELETE | `/api/workspace/members/:memberId` | OWNER-only, forbid removing OWNER |
| PATCH | `/api/workspace` | OWNER-only. Only `name` persists today; slug/industry/companySize accepted but ignored (schema TODO) |

### AI — [ai.ts](apps/api/src/routes/ai.ts)
| Method | Path | Notes |
|---|---|---|
| GET | `/api/ai/health` | Reports model |
| POST | `/api/ai/plan-campaign` | Validates 10–1000 char prompt → calls Anthropic → parses JSON plan |
| POST | `/api/ai/generate-copy` | Validates brief/platform/objective → returns headlines/primary_texts/descriptions/ctas |

Rate-limited at 20 req / 15min per IP (vs 100 for the rest of `/api`).

### Meta — [meta.ts](apps/api/src/routes/meta.ts)
| Method | Path | Notes |
|---|---|---|
| GET | `/api/meta/oauth-url` | Auth required. Returns Facebook OAuth URL with `state=dbUserId` |
| GET | `/api/meta/callback` | **No auth** — Meta redirects user's browser here. Exchanges code → short-lived → long-lived token, encrypts, upserts AdAccount per Meta ad account, redirects to `/settings?tab=integrations&connected=meta` |
| POST | `/api/meta/sync/:adAccountId` | Auth required. Calls `syncService.syncMetaAccount` → upserts Campaign + 30-day CampaignMetrics |
| GET | `/api/meta/ad-accounts` | Auth required. Returns stored Meta ad accounts enriched with fresh Graph API data (tokens never returned) |

### Next.js proxies — [app/api/](apps/web/app/api/)
Server-side proxies that hide the backend URL + add Clerk auth forwarding + validation:
- [ai/plan-campaign/route.ts](apps/web/app/api/ai/plan-campaign/route.ts) — POST `/api/ai/plan-campaign`
- [ai/generate-copy/route.ts](apps/web/app/api/ai/generate-copy/route.ts) — POST `/api/ai/generate-copy`
- [meta/connect/route.ts](apps/web/app/api/meta/connect/route.ts) — GET returns `{ url }` for Meta OAuth (uses `auth()` to attach Bearer token to backend call)

### Health
- `GET /health` → `{ status, timestamp, uptime, version }`

---

## Frontend API Client

[apps/web/lib/api.ts](apps/web/lib/api.ts) exports `useApiClient()` — a typed hook that pulls a Clerk Bearer token via `useAuth().getToken()` and exposes:

```ts
const api = useApiClient();
const overview = await api.getAnalyticsOverview(30);
const { campaigns } = await api.getCampaigns({ status: "ACTIVE" });
await api.createCampaign({ name, platform, objective, budget, adAccountId });
```

All Prisma model types and request/response shapes are declared in the same file.

---

## Database Schema

Defined in [apps/api/prisma/schema.prisma](apps/api/prisma/schema.prisma). 8 tables:

| Table | Purpose |
|---|---|
| `User` | Mirrors Clerk users; created on first authenticated request |
| `Workspace` | Top-level tenant; owned by a User. Fields: `name`, `slug` (unique, nullable), `industry`, `companySize`, `plan` |
| `WorkspaceMember` | Many-to-many User↔Workspace with role (OWNER/ADMIN/EDITOR/VIEWER) |
| `AdAccount` | Connected ad platform credentials (Meta/Google/TikTok/etc.). `accessToken` is **AES-256-CBC encrypted at rest** and never returned to clients |
| `Campaign` | Per ad-account campaign. `externalId` stores the platform's native campaign ID; unique on `(adAccountId, externalId)` so sync is idempotent |
| `CampaignMetrics` | Daily metrics per campaign, unique on `(campaignId, date)`, auto-derived CTR/CPC/CPM/ROAS |
| `Creative` | Image/Video/Carousel/Text creatives, optionally bound to a campaign |
| `AiSession` | Persisted AI prompt/response history for audit + future analytics |

Indexes added for query patterns: `Campaign(workspaceId, status)`, `Campaign(workspaceId, platform)`, `Campaign(externalId)`.

Enums: `Platform`, `PlanType`, `WorkspaceRole`, `CampaignStatus`, `BudgetType`, `CreativeType`, `CreativeStatus`, `AiSessionType`.

---

## Setup

### Prerequisites

- Node.js 18+
- PostgreSQL 16+ running locally (or hosted)
- Clerk account ([dashboard.clerk.com](https://dashboard.clerk.com))
- Anthropic API key ([console.anthropic.com](https://console.anthropic.com/settings/keys))

### Environment files

**apps/api/.env** (not committed — gitignored)

```
DATABASE_URL=postgresql://postgres:PASSWORD@localhost:5432/adgenius
ANTHROPIC_API_KEY=sk-ant-api03-...
CLERK_SECRET_KEY=sk_test_...
CLERK_PUBLISHABLE_KEY=pk_test_...
META_APP_ID=...
META_APP_SECRET=...
META_REDIRECT_URI=http://localhost:4000/api/meta/callback
ENCRYPTION_KEY=...           # hashed to 32 bytes via SHA-256 at runtime; any string works
FRONTEND_URL=http://localhost:3000
WEB_ORIGIN=http://localhost:3000
PORT=4000
NODE_ENV=development
```

Generate a strong `ENCRYPTION_KEY` with `openssl rand -hex 32`.

**apps/web/.env.local** (not committed — gitignored)

```
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...
NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in
NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up
NEXT_PUBLIC_CLERK_SIGN_IN_FALLBACK_REDIRECT_URL=/dashboard
NEXT_PUBLIC_CLERK_SIGN_UP_FALLBACK_REDIRECT_URL=/dashboard
NEXT_PUBLIC_API_URL=http://localhost:4000
```

⚠️ **Security:** `.env.example` files in both apps were briefly populated with real Clerk secret keys. They have been scrubbed to placeholders, but if those files were ever committed to git, **rotate your Clerk secret key**.

### One-time database setup

```powershell
# Create the database (or use pgAdmin)
psql -U postgres -c "CREATE DATABASE adgenius;"

# Push schema → creates 8 tables
cd apps/api
npx prisma db push

# (optional) Browse the empty tables
npx prisma studio    # http://localhost:5555
```

### Running the apps

```powershell
# Terminal 1 — backend (Express on :4000)
cd apps/api && npm run dev

# Terminal 2 — frontend (Next.js on :3000)
cd apps/web && npm run dev
```

Or from the repo root: `npm run dev` (turbo runs both in parallel).

### Quick health checks

- API liveness: <http://localhost:4000/health>
- AI route: <http://localhost:4000/api/ai/health>
- Frontend: <http://localhost:3000> → sign in → `/dashboard`

---

## Design System

| Token | Value |
|---|---|
| Brand | `#6366f1` (indigo) |
| Sidebar bg | `#0f172a` |
| Font | Plus Jakarta Sans (Google Fonts) |
| Card | `bg-white rounded-2xl border-slate-200/70 shadow-card` |
| Hover lift | `hover:-translate-y-0.5 hover:shadow-card-hover` |
| Brand button | `.btn-brand` — indigo bg, glow on hover |
| Status dots | `.status-dot.{active,paused,ended,draft}` |
| Animations | `.animate-in` + `.stagger-1` … `.stagger-6` |

All tokens live in [apps/web/app/globals.css](apps/web/app/globals.css) and [apps/web/tailwind.config.ts](apps/web/tailwind.config.ts).

---

## Known TODOs / Pending Work

| Area | Item |
|---|---|
| Auth | Onboarding wizard removed. Workspace is auto-provisioned in `requireAuth` middleware on first authenticated request. The Clerk-metadata-driven redirect path in middleware was also removed; reintroduce if/when we add a paid-tier or compliance-gated step that must come before dashboard access |
| Invites | Wire `POST /api/workspace/invite` to Resend (email) + a pending `Invite` model |
| AI / Audiences | "Build with AI" modal still uses `setTimeout` mock — add `/api/ai/build-audience` proxy + route |
| AI / Insights | Floating chat widget uses hardcoded response — add `/api/ai/chat` for context-aware responses |
| Data wiring | Most UI pages still display mock data (campaigns/analytics/audiences/creatives/billing). Swap to `useApiClient()` once tables have rows. Settings → Integrations is wired to live data for Meta. |
| Meta OAuth state | Currently `state = dbUserId` — change to a short-lived random nonce stored server-side to prevent state-forging attacks (`SECURITY TODO` in [routes/meta.ts](apps/api/src/routes/meta.ts)) |
| Meta sync schedule | `/api/meta/sync/:id` is currently manual via "Sync Now" button. Add a cron/queue (e.g. BullMQ) to refresh every workspace nightly |
| Rate limit | In-memory store works for single-process dev; switch to Redis (`rate-limit-redis`) for production |
| Security | AI + Meta sync routes are auth-gated on backend; Meta `/callback` is intentionally public (Meta redirects browser there). All other routes require Clerk JWT |
| `.env.example` | Confirm both files don't contain real secrets before any commit |

---

## Change Log

> Most recent first. Add a new dated entry for every significant change.

### 2026-05-25 — Popup OAuth fixes: COOP, BroadcastChannel, no fallback redirect

Three real bugs surfaced when the user actually ran Meta OAuth in a popup:

- **COOP severed `window.opener`.** Helmet on the API was sending `Cross-Origin-Opener-Policy: same-origin` by default. When the popup transited through `/api/meta/callback`, the browser cut the opener relationship between popup and parent — even though the parent and `/connect/done` are same-origin. Fix in [apps/api/src/index.ts](apps/api/src/index.ts): set `crossOriginOpenerPolicy: { policy: "same-origin-allow-popups" }`.
- **`/connect/done` fell back to `/settings` redirect** when it couldn't detect a popup (because of the COOP issue). User saw the entire app load inside the small popup window. Fix in [apps/web/app/connect/done/page.tsx](apps/web/app/connect/done/page.tsx): removed `router.replace("/settings?...")` entirely. The page now always shows a "Connected — closing this window" UI, attempts `window.close()`, and falls back to a manual "Close window" button if the browser blocks programmatic close.
- **`postMessage` alone was fragile.** Added `BroadcastChannel("platform-oauth")` as a second messaging path. Now `/connect/done` posts to BOTH `window.opener.postMessage` AND `BroadcastChannel`, and [apps/web/lib/oauth-popup.ts](apps/web/lib/oauth-popup.ts) listens on BOTH. Works even if any future security header severs the opener.

Net effect: clicking Connect Meta now opens a real popup, runs OAuth, posts the result back, and closes itself. Main window's modal flips to "Connected" without any navigation.

### 2026-05-25 — useApiClient memoization (fixes ConnectModal infinite render loop)

- [apps/web/lib/api.ts](apps/web/lib/api.ts) — wrapped the returned client object in `useMemo([getToken])` so consumers can safely list it in `useEffect` / `useCallback` dependency arrays. Previously a new object was returned every render, which combined with `useCallback(refresh, [api])` + `useEffect(..., [refresh])` caused an infinite render loop in `ConnectModal` (firing `GET /api/ad-accounts` until the rate-limiter started returning 429s).
- Root cause: returning a fresh closure object from a hook makes that hook impossible to depend on safely. Fix is at the source — every consumer benefits without per-component workarounds.

### 2026-05-25 — Connect UX rework: no onboarding wizard, popup OAuth, sidebar Connect menu

- **Removed onboarding wizard.** Deleted [apps/web/app/(onboarding)/](apps/web/app/(onboarding)/) and removed the `/onboarding` exception from [middleware.ts](apps/web/middleware.ts). Workspace creation moved into the backend `requireAuth` middleware ([auth.ts](apps/api/src/middleware/auth.ts)) — every authenticated user now auto-gets a default workspace (`<FirstName>'s Workspace`) + OWNER membership on first request. Zero-friction onboarding.
- **Security fix:** `/onboarding` was incorrectly listed as a public route in middleware. Anyone could load the form without being signed in. Removed alongside the onboarding feature.
- **Popup OAuth for Meta.** [apps/web/lib/oauth-popup.ts](apps/web/lib/oauth-popup.ts) — generic `openOAuthPopup()` + `openMetaOAuthPopup()` helpers that open the Facebook dialog in a centered 600×720 popup, listen for a `postMessage({ type: 'platform-connect-done', ... })` from the child, and resolve when the popup closes. No more full-page redirect to Facebook.
- **New popup-close page** [apps/web/app/connect/done/page.tsx](apps/web/app/connect/done/page.tsx) — backend OAuth callback now redirects here. Detects `window.opener`, posts the result message, closes itself. Falls back to a `router.replace('/settings')` navigation if hit directly (not in a popup).
- **Backend Meta callback redirect changed** ([routes/meta.ts](apps/api/src/routes/meta.ts)) — success now goes to `/connect/done?connected=meta`, errors to `/connect/done?error=meta_failed|meta_cancelled|meta_no_workspace`.
- **Sidebar Connect menu.** Added a new nav item "Connect Apps" (Plug icon) under the Advertising group. Clicking it opens a `ConnectModal` overlay on the same page — no navigation. The existing "+" button at the bottom of the sidebar (under CONNECTED) now opens the same modal.
- **`ConnectModal`** ([apps/web/components/connect/ConnectModal.tsx](apps/web/components/connect/ConnectModal.tsx)) — lists all 6 platforms with Connect/Disconnect actions. Meta uses the popup helper; the other 5 show "Coming Soon". Refreshes the ad-account list after every action.
- **`MetaConnect`** ([apps/web/components/settings/MetaConnect.tsx](apps/web/components/settings/MetaConnect.tsx)) — Settings/Integrations card also switched from `window.location.href = url` to `openMetaOAuthPopup()`. No more full-page navigation; settings page stays put.
- **Sidebar `NavItem` shape** ([Sidebar.tsx](apps/web/components/layout/Sidebar.tsx)) — now a discriminated union of `{ kind: "link", href }` and `{ kind: "action", action }` so nav entries can be either router links or in-page modal triggers.

### 2026-05-25 — Onboarding wizard now persists workspace (later removed)

- [/onboarding](apps/web/app/(onboarding)/onboarding/page.tsx) "Go to Dashboard" button now calls `POST /api/auth/complete-onboarding` via `useApiClient().completeOnboarding(...)` before navigating. Previously it was a TODO that just routed without saving.
- Loading state on the final button while the workspace is created. Toast on error. Idempotent: if the workspace already exists (409 from backend), still navigates to `/dashboard`.
- Fixes a UX dead-end where users would finish the wizard but no Workspace row was created, blocking Meta connect with `?error=meta_no_workspace`.

### 2026-05-25 — Meta OAuth scope fix

- Dropped `instagram_basic` (deprecated by Meta) and `pages_read_engagement` (now requires use-case review) from the Meta OAuth scope list in [meta.service.ts](apps/api/src/services/meta.service.ts). The three Marketing API scopes (`ads_read`, `ads_management`, `business_management`) cover ad management for both Facebook and Instagram placements.
- Fixed a runtime "Invalid Scopes: instagram_basic" error that blocked the OAuth dialog.

### 2026-05-25 — Meta Ads API integration (first ad platform connection)

- **Schema migration** ([apps/api/prisma/schema.prisma](apps/api/prisma/schema.prisma)) — added `Workspace.slug` (unique), `Workspace.industry`, `Workspace.companySize`, `Campaign.externalId`, `@@unique([adAccountId, externalId])`, and indexes `Campaign(workspaceId, status)`, `Campaign(workspaceId, platform)`, `Campaign(externalId)`. Ran `prisma generate && prisma db push`.
- **New backend services:**
  - [apps/api/src/services/meta.service.ts](apps/api/src/services/meta.service.ts) — Meta Marketing API v19.0 wrapper. OAuth URL builder, code↔short-lived↔long-lived token exchange, `getAdAccounts`, `getCampaigns`, `getCampaignInsights` (daily breakdown via `time_increment=1`), `createCampaign`, `updateCampaignStatus`. AES-256-CBC `encryptToken`/`decryptToken` with SHA-256 key derivation from `ENCRYPTION_KEY`. Centralized error handling that surfaces Meta's `error.message`/`error.code`.
  - [apps/api/src/services/sync.service.ts](apps/api/src/services/sync.service.ts) — `syncMetaAccount(adAccount)` upserts Campaigns by `(adAccountId, externalId)` then upserts daily CampaignMetrics, calculating conversions from `actions[purchase]`, revenue from `purchase_roas`, and the standard derived metrics. Returns `{ campaignsSynced, metricsSynced, platform: 'META' }`.
- **New backend routes** ([apps/api/src/routes/meta.ts](apps/api/src/routes/meta.ts)):
  - `GET /api/meta/oauth-url` (auth) — returns Facebook dialog URL
  - `GET /api/meta/callback` (no auth — browser redirect) — exchanges code, encrypts long-lived token, upserts AdAccount per Meta ad account, redirects to `/settings?tab=integrations&connected=meta` (or `?error=meta_*` on failure)
  - `POST /api/meta/sync/:adAccountId` (auth) — runs `syncService`
  - `GET /api/meta/ad-accounts` (auth) — returns stored accounts enriched with fresh Graph API data, tokens never returned
- **Mounted** in [routes/index.ts](apps/api/src/routes/index.ts) under `/meta`.
- **`PATCH /api/workspace`** now persists `slug` (slugified server-side), `industry`, `companySize` — previously TODO.
- **Frontend proxy** [apps/web/app/api/meta/connect/route.ts](apps/web/app/api/meta/connect/route.ts) — `GET` reads Clerk session via `auth()`, forwards Bearer token to `/api/meta/oauth-url`, returns `{ url }`.
- **Frontend component** [apps/web/components/settings/MetaConnect.tsx](apps/web/components/settings/MetaConnect.tsx) — handles both connected and not-connected states. "Connect Meta Ads" → fetches `/api/meta/connect` → `window.location.href = data.url`. "Sync Now" → POSTs to `/api/meta/sync/:id` with Clerk bearer. "Disconnect" → confirmation card → `disconnectAdAccount`. All actions toast via `react-hot-toast`.
- **Settings → Integrations tab rewired** to live data: `useApiClient().getAdAccounts()` on mount + after Meta callback/sync/disconnect. The Meta card is now `<MetaConnect />`; other 5 platforms remain as "Coming Soon" disabled placeholders. URL params `?connected=meta`/`?error=meta_*` surface as toasts and get cleaned from the address bar via `history.replaceState`.
- **`.env.example`** ([apps/api/.env.example](apps/api/.env.example)) updated with `META_APP_ID`, `META_APP_SECRET`, `META_REDIRECT_URI`, `ENCRYPTION_KEY`, `FRONTEND_URL`.
- Result: `tsc --noEmit` passes clean on both apps on first run.

### 2026-05-25 — Database created, Prisma Studio running

- Created local Postgres database `adgenius` (port `1233` confirmed by user)
- Updated `apps/api/.env` with `DATABASE_URL=postgresql://postgres:***@localhost:1233/adgenius`
- Ran `npx prisma db push` → 8 tables created in `public` schema
- Verified via raw query: `User`, `Workspace`, `WorkspaceMember`, `AdAccount`, `Campaign`, `CampaignMetrics`, `Creative`, `AiSession`
- Started Prisma Studio at <http://localhost:5555> (background process, ID `blt15eomy`)

### 2026-05-25 — Backend rebuild (real Prisma-powered API)

- Replaced all placeholder backend routes with production-quality Prisma CRUD endpoints
- Installed `helmet`, `express-rate-limit`, `@clerk/backend` (+29 transitive deps)
- New files:
  - [apps/api/src/lib/prisma.ts](apps/api/src/lib/prisma.ts) — singleton client
  - [apps/api/src/lib/workspace.ts](apps/api/src/lib/workspace.ts) — workspace helpers
  - [apps/api/src/types/express.d.ts](apps/api/src/types/express.d.ts) — Request augmentation
  - [apps/api/src/routes/ad-accounts.ts](apps/api/src/routes/ad-accounts.ts)
  - [apps/api/src/routes/creatives.ts](apps/api/src/routes/creatives.ts)
  - [apps/api/src/routes/workspace.ts](apps/api/src/routes/workspace.ts)
  - [apps/web/lib/api.ts](apps/web/lib/api.ts) — typed `useApiClient()` hook
- Rewrote: `middleware/auth.ts`, `middleware/errorHandler.ts`, `routes/auth.ts`, `routes/campaigns.ts`, `routes/analytics.ts`, `routes/index.ts`, `src/index.ts`
- Server now has Helmet, request logging, 100/15min global + 20/15min AI rate limits, graceful SIGTERM/SIGINT shutdown
- Fix: `verifyToken` is a top-level export in `@clerk/backend`, not a `ClerkClient` method
- Result: `tsc --noEmit` passes clean on both apps

### 2026-05-25 — Audiences, Billing, Settings, Onboarding, Insights pages

- New pages:
  - [/audiences](apps/web/app/(dashboard)/audiences/page.tsx) — 12 audiences, type-colored cards, AI Build Audience modal
  - [/billing](apps/web/app/(dashboard)/billing/page.tsx) — current plan, 3 usage meters, 4-plan comparison, history, payment method
  - [/settings](apps/web/app/(dashboard)/settings/page.tsx) — 7 tabs (General/Workspace/Integrations/Notifications/API Keys/Security/Danger Zone)
  - [/insights](apps/web/app/(dashboard)/insights/page.tsx) — 8 insight cards + floating Ask-AI chat widget
  - [/onboarding](apps/web/app/(onboarding)/onboarding/page.tsx) — 4-step wizard
  - [(onboarding)/layout.tsx](apps/web/app/(onboarding)/layout.tsx) — minimal centered layout
- Updated [middleware.ts](apps/web/middleware.ts) — `/onboarding` public, TODO for metadata-based redirect
- Result: `tsc --noEmit` passes clean on first run

### 2026-05-25 — AI Planner error message improvements

- Surfaced real backend error message in [/ai-planner](apps/web/app/(dashboard)/ai-planner/page.tsx) catch block (was: generic "Sorry, I encountered an error", now: actual server message + helpful examples)
- Discussed UX of "non-campaign" prompts returning $0/0-0 placeholder plans — left as is (model behavior); options A/B/C documented for future tightening

### 2026-05-25 — Analytics + Creatives pages, AI wiring

- Built [/analytics](apps/web/app/(dashboard)/analytics/page.tsx) — 4 metric cards, 6-metric ComposedChart, platform BarChart, CSS funnel, sortable campaign table, brand-gradient AI insights card
- Built [/creatives](apps/web/app/(dashboard)/creatives/page.tsx) — 12 creatives w/ per-type previews + AI Generate Copy modal with copy-to-clipboard + react-hot-toast feedback
- Wired AI Planner + Creatives modal to real Claude API:
  - Backend: [ai.service.ts](apps/api/src/services/ai.service.ts), [routes/ai.ts](apps/api/src/routes/ai.ts) — model `claude-sonnet-4-20250514`, defensive JSON extraction
  - Frontend proxies: [app/api/ai/plan-campaign/route.ts](apps/web/app/api/ai/plan-campaign/route.ts), [generate-copy/route.ts](apps/web/app/api/ai/generate-copy/route.ts)
- Added `<Toaster>` to dashboard layout for clipboard feedback
- Resolved auth loop caused by 15-minute system clock skew (Windows time sync)

### 2026-05-25 — Campaigns section + AI Planner UI

- [/campaigns](apps/web/app/(dashboard)/campaigns/page.tsx) — list with filters, grid/list toggle (localStorage), 12 mock campaigns, pagination, empty state
- [/campaigns/[id]](apps/web/app/(dashboard)/campaigns/[id]/page.tsx) — detail with 5 tabs (Overview, Ad Sets, Creatives, Audience, Settings)
- [CreateCampaignModal.tsx](apps/web/components/campaigns/CreateCampaignModal.tsx) — 4-step wizard (Platform → Objective → Budget → Review)
- [/ai-planner](apps/web/app/(dashboard)/ai-planner/page.tsx) — first iteration with mock 1.5s response

### 2026-05-25 — Dashboard scaffold

- Tailwind config + globals.css with full design system (CSS vars, utility classes, animations, stagger classes)
- [Sidebar.tsx](apps/web/components/layout/Sidebar.tsx), [Header.tsx](apps/web/components/layout/Header.tsx), [(dashboard)/layout.tsx](apps/web/app/(dashboard)/layout.tsx) — collapsible sidebar, sticky header, search, notifications popover, Clerk `UserButton`
- Dashboard cards/components: [MetricCard](apps/web/components/dashboard/MetricCard.tsx), [SpendChart](apps/web/components/dashboard/SpendChart.tsx), [PlatformBreakdown](apps/web/components/dashboard/PlatformBreakdown.tsx), [CampaignTable](apps/web/components/dashboard/CampaignTable.tsx)
- [/dashboard](apps/web/app/(dashboard)/dashboard/page.tsx) — full page composition with AI insight banner, 4 metric cards, charts row, campaign table, AI activity + quick actions
- Required `"use client"` on `/dashboard/page.tsx` due to RSC boundary (icon components can't be passed from server to client)
- Resolved Clerk auth setup: env keys, blank sign-in caused by clock skew, dashboard route 404 caused by stale `.next` cache
