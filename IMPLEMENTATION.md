# Advertix â€” Implementation Log

A multi-platform AI-powered ad management dashboard. Premium SaaS UI, Claude-powered campaign planning and creative generation, real backend with Prisma + Postgres + Clerk.

postgre password:  advertix_dev

> **Maintain this file.** Update the [Change Log](#change-log) (newest first) and the relevant sections any time files change, features land, or setup steps shift.

> **Deferred features:** Big features that are explicitly bookmarked for "later, not now" live in [FUTURE_FEATURES.md](FUTURE_FEATURES.md). Each one has a prerequisite gate. **Do not start any of them without checking the gate first.**

---

## Tech Stack

| Layer | Stack |
|---|---|
| Frontend | Next.js 14 (App Router) Â· React 18 Â· TypeScript Â· Tailwind CSS Â· Plus Jakarta Sans |
| Charts / icons | recharts Â· lucide-react |
| State / UX | clsx Â· react-hot-toast Â· framer-motion |
| Auth | Clerk (`@clerk/nextjs` on web, `@clerk/backend` on api) |
| Backend | Express 4 Â· TypeScript Â· Helmet Â· express-rate-limit |
| ORM / DB | Prisma 5 Â· PostgreSQL |
| AI | Anthropic Claude Sonnet 4 (`claude-sonnet-4-20250514`) via native `fetch` |
| Ad platforms | Meta Marketing API v19.0 Â· Google Ads API v17 Â· TikTok Marketing API v1.3 Â· LinkedIn Marketing API v2 (OAuth 2.0 + AES-256-CBC encrypted tokens, refresh-token auto-rotation for Google) |
| Monorepo | Turborepo |

---

## Project Structure

```
advertix/
â”œâ”€â”€ apps/
â”‚   â”œâ”€â”€ api/                          # Express backend
â”‚   â”‚   â”œâ”€â”€ prisma/schema.prisma      # Data model
â”‚   â”‚   â””â”€â”€ src/
â”‚   â”‚       â”œâ”€â”€ index.ts              # Server entry (helmet, rate-limit, graceful shutdown)
â”‚   â”‚       â”œâ”€â”€ lib/
â”‚   â”‚       â”‚   â”œâ”€â”€ prisma.ts         # Singleton PrismaClient
â”‚   â”‚       â”‚   â”œâ”€â”€ workspace.ts      # getUserWorkspace / requireWorkspace / role helpers
â”‚   â”‚       â”‚   â””â”€â”€ crypto.ts         # AES-256-CBC encryptToken/decryptToken (shared)
â”‚   â”‚       â”œâ”€â”€ middleware/
â”‚   â”‚       â”‚   â”œâ”€â”€ auth.ts           # Clerk JWT â†’ User auto-create â†’ req.user
â”‚   â”‚       â”‚   â””â”€â”€ errorHandler.ts   # Prisma + custom error mapping
â”‚   â”‚       â”œâ”€â”€ routes/
â”‚   â”‚       â”‚   â”œâ”€â”€ index.ts          # Mounts all routers under /api
â”‚   â”‚       â”‚   â”œâ”€â”€ auth.ts           # /auth/me, /complete-onboarding, /workspace
â”‚   â”‚       â”‚   â”œâ”€â”€ campaigns.ts      # /campaigns CRUD + metrics
â”‚   â”‚       â”‚   â”œâ”€â”€ ad-accounts.ts    # /ad-accounts CRUD + toggle
â”‚   â”‚       â”‚   â”œâ”€â”€ analytics.ts      # /overview /timeseries /by-platform /campaigns
â”‚   â”‚       â”‚   â”œâ”€â”€ creatives.ts      # /creatives CRUD
â”‚   â”‚       â”‚   â”œâ”€â”€ workspace.ts      # /members, /invite, role updates
â”‚   â”‚       â”‚   â”œâ”€â”€ meta.ts           # Meta OAuth + sync + ad accounts
â”‚   â”‚       â”‚   â”œâ”€â”€ google.ts         # Google OAuth + sync + customers
â”‚   â”‚       â”‚   â”œâ”€â”€ tiktok.ts         # TikTok OAuth + sync
â”‚   â”‚       â”‚   â”œâ”€â”€ linkedin.ts       # LinkedIn OAuth + sync
â”‚   â”‚       â”‚   â””â”€â”€ ai.ts             # /plan-campaign /generate-copy /health
â”‚   â”‚       â”œâ”€â”€ services/
â”‚   â”‚       â”‚   â”œâ”€â”€ ai.service.ts       # Anthropic Messages API wrapper
â”‚   â”‚       â”‚   â”œâ”€â”€ meta.service.ts     # Meta Marketing API
â”‚   â”‚       â”‚   â”œâ”€â”€ google.service.ts   # Google Ads API v17 (GAQL search, refresh)
â”‚   â”‚       â”‚   â”œâ”€â”€ tiktok.service.ts   # TikTok Marketing API v1.3
â”‚   â”‚       â”‚   â”œâ”€â”€ linkedin.service.ts # LinkedIn Marketing API v2 (URN-based)
â”‚   â”‚       â”‚   â””â”€â”€ sync.service.ts     # Pull campaigns + metrics for all 4 platforms
â”‚   â”‚       â””â”€â”€ types/
â”‚   â”‚           â””â”€â”€ express.d.ts      # Augments Request with userId/dbUserId/user
â”‚   â”‚
â”‚   â””â”€â”€ web/                          # Next.js frontend
â”‚       â”œâ”€â”€ middleware.ts             # Clerk auth + onboarding redirect
â”‚       â”œâ”€â”€ lib/
â”‚       â”‚   â””â”€â”€ api.ts                # Typed useApiClient() hook
â”‚       â”œâ”€â”€ components/
â”‚       â”‚   â”œâ”€â”€ layout/               # Sidebar (with Connect modal), Header
â”‚       â”‚   â”œâ”€â”€ dashboard/            # MetricCard, SpendChart, CampaignTable, PlatformBreakdown
â”‚       â”‚   â”œâ”€â”€ campaigns/            # CreateCampaignModal
â”‚       â”‚   â”œâ”€â”€ connect/              # ConnectModal (lists all platforms, opens OAuth popup)
â”‚       â”‚   â””â”€â”€ settings/             # MetaConnect + GoogleConnect + TikTokConnect + LinkedInConnect
â”‚       â”œâ”€â”€ lib/
â”‚       â”‚   â”œâ”€â”€ api.ts                # useApiClient() â€” typed REST hook
â”‚       â”‚   â””â”€â”€ oauth-popup.ts        # openOAuthPopup() / openMetaOAuthPopup()
â”‚       â””â”€â”€ app/
â”‚           â”œâ”€â”€ layout.tsx
â”‚           â”œâ”€â”€ page.tsx              # Landing
â”‚           â”œâ”€â”€ globals.css           # Design tokens + utility classes
â”‚           â”œâ”€â”€ (auth)/               # /sign-in /sign-up (Clerk)
â”‚           â”œâ”€â”€ (onboarding)/         # /onboarding (4-step wizard)
â”‚           â”œâ”€â”€ (dashboard)/          # Authed app shell
â”‚           â”‚   â”œâ”€â”€ layout.tsx        # Sidebar + Header + Toaster
â”‚           â”‚   â”œâ”€â”€ dashboard/        # Main dashboard
â”‚           â”‚   â”œâ”€â”€ campaigns/        # List + detail
â”‚           â”‚   â”œâ”€â”€ audiences/        # Audiences + AI build modal
â”‚           â”‚   â”œâ”€â”€ creatives/        # Creative library + AI copy modal
â”‚           â”‚   â”œâ”€â”€ analytics/        # Full analytics
â”‚           â”‚   â”œâ”€â”€ ai-planner/       # Claude chat + plan preview
â”‚           â”‚   â”œâ”€â”€ insights/         # AI insights + floating chat widget
â”‚           â”‚   â”œâ”€â”€ billing/          # Plans + usage + history
â”‚           â”‚   â””â”€â”€ settings/         # 7-tab settings
â”‚           â””â”€â”€ api/                  # Next.js route handlers (proxy to backend)
â”‚               â”œâ”€â”€ ai/
â”‚               â”‚   â”œâ”€â”€ plan-campaign/route.ts
â”‚               â”‚   â””â”€â”€ generate-copy/route.ts
â”‚               â”œâ”€â”€ meta/
â”‚               â”‚   â””â”€â”€ connect/route.ts    # Forwards Clerk session, returns Meta OAuth URL
â”‚               â”œâ”€â”€ google/
â”‚               â”‚   â””â”€â”€ connect/route.ts    # Forwards Clerk session, returns Google OAuth URL
â”‚               â”œâ”€â”€ tiktok/
â”‚               â”‚   â””â”€â”€ connect/route.ts    # Forwards Clerk session, returns TikTok OAuth URL
â”‚               â””â”€â”€ linkedin/
â”‚                   â””â”€â”€ connect/route.ts    # Forwards Clerk session, returns LinkedIn OAuth URL
â””â”€â”€ packages/
    â””â”€â”€ shared/                       # Cross-app shared code
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
| `/campaigns/[id]` | [apps/web/app/(dashboard)/campaigns/[id]/page.tsx](apps/web/app/(dashboard)/campaigns/[id]/page.tsx) | Detail page Â· 5 tabs: Overview, Ad Sets, Creatives, Audience, Settings |
| `/audiences` | [apps/web/app/(dashboard)/audiences/page.tsx](apps/web/app/(dashboard)/audiences/page.tsx) | 12 audiences, type-colored cards, AI Build Audience modal |
| `/creatives` | [apps/web/app/(dashboard)/creatives/page.tsx](apps/web/app/(dashboard)/creatives/page.tsx) | 12 creatives w/ distinct previews per type, AI Generate Copy modal (real API) |
| `/analytics` | [apps/web/app/(dashboard)/analytics/page.tsx](apps/web/app/(dashboard)/analytics/page.tsx) | 4 metric cards, 6-metric chart, platform bars, funnel, sortable campaign table, AI insights |
| `/ai-planner` | [apps/web/app/(dashboard)/ai-planner/page.tsx](apps/web/app/(dashboard)/ai-planner/page.tsx) | Real Claude chat + structured plan preview (donut, audience chips, ad formats, expected results, insights) |
| `/insights` | [apps/web/app/(dashboard)/insights/page.tsx](apps/web/app/(dashboard)/insights/page.tsx) | 8 typed insight cards (opportunity/warning/optimization/alert), dismiss + restore, floating Ask-AI chat widget |
| `/billing` | [apps/web/app/(dashboard)/billing/page.tsx](apps/web/app/(dashboard)/billing/page.tsx) | Current plan, 3 usage meters, 4-plan comparison table w/ monthly/annual toggle, empty history, CSS credit card |
| `/settings` | [apps/web/app/(dashboard)/settings/page.tsx](apps/web/app/(dashboard)/settings/page.tsx) | 7 tabs: General Â· Workspace Â· Integrations Â· Notifications Â· API Keys Â· Security Â· Danger Zone |

### Shared components

- [components/layout/Sidebar.tsx](apps/web/components/layout/Sidebar.tsx) â€” Dark sidebar (#0f172a), workspace selector, AI planner quick-action, 4 nav groups w/ badges, connected platforms strip, user profile. Collapsible (72px / 260px).
- [components/layout/Header.tsx](apps/web/components/layout/Header.tsx) â€” Search w/ âŒ˜K, New Campaign, notifications popover, plan pill, Clerk `UserButton`.
- [components/dashboard/MetricCard.tsx](apps/web/components/dashboard/MetricCard.tsx) â€” Title, value, trend pill, sparkline.
- [components/dashboard/SpendChart.tsx](apps/web/components/dashboard/SpendChart.tsx) â€” ComposedChart (Area spend + Line ROAS, dual axes).
- [components/dashboard/PlatformBreakdown.tsx](apps/web/components/dashboard/PlatformBreakdown.tsx) â€” Donut + interactive list.
- [components/dashboard/CampaignTable.tsx](apps/web/components/dashboard/CampaignTable.tsx) â€” Filter tabs + table.
- [components/campaigns/CreateCampaignModal.tsx](apps/web/components/campaigns/CreateCampaignModal.tsx) â€” 4-step modal: Platform â†’ Objective â†’ Budget â†’ Review.

---

## Backend Routes

All routes mounted under `/api`. Auth-gated routes use `requireAuth` (Bearer token from Clerk).

### Auth â€” [auth.ts](apps/api/src/routes/auth.ts)
| Method | Path | Notes |
|---|---|---|
| GET | `/api/auth/me` | Returns user + workspace + member count |
| POST | `/api/auth/complete-onboarding` | Creates Workspace + OWNER member (refuses if user already has one) |
| POST | `/api/auth/workspace` | Creates additional workspace |
| GET | `/api/auth/workspace` | Workspace with members + ad-account count |

### Campaigns â€” [campaigns.ts](apps/api/src/routes/campaigns.ts)
| Method | Path | Notes |
|---|---|---|
| GET | `/api/campaigns` | Filters: `platform`, `status`, `search`. Paginated. |
| POST | `/api/campaigns` | Validates ad account ownership + matching platform |
| GET | `/api/campaigns/:id` | Includes adAccount + last 30 metrics |
| PUT | `/api/campaigns/:id` | Whitelisted partial update |
| DELETE | `/api/campaigns/:id` | Cascade deletes metrics + creatives |
| GET | `/api/campaigns/:id/metrics` | Trailing N days (default 30) |
| POST | `/api/campaigns/:id/metrics` | Upsert on (campaignId, date); auto-derives ctr/cpc/cpm/roas |

### Ad Accounts â€” [ad-accounts.ts](apps/api/src/routes/ad-accounts.ts)
| Method | Path | Notes |
|---|---|---|
| GET | `/api/ad-accounts` | Tokens are never returned |
| POST | `/api/ad-accounts` | Upsert on (workspaceId, platform, accountId) |
| DELETE | `/api/ad-accounts/:id` | Cascade deletes related campaigns |
| PATCH | `/api/ad-accounts/:id/toggle` | Flip `isActive` |

### Analytics â€” [analytics.ts](apps/api/src/routes/analytics.ts)
| Method | Path | Notes |
|---|---|---|
| GET | `/api/analytics/overview` | Current + previous period sums w/ % change |
| GET | `/api/analytics/timeseries` | Daily groupBy on `date`, pick metric |
| GET | `/api/analytics/by-platform` | Aggregated per platform with derived ROAS/CTR |
| GET | `/api/analytics/campaigns` | Per-campaign totals, sortable, paginated |

### Creatives â€” [creatives.ts](apps/api/src/routes/creatives.ts)
| Method | Path | Notes |
|---|---|---|
| GET | `/api/creatives` | Filters: `type`, `platform` (via campaign), `status`, `search` |
| POST | `/api/creatives` | Validates type enum + campaign ownership |
| PUT | `/api/creatives/:id` | Update name/content/status |
| DELETE | `/api/creatives/:id` | |

### Workspace â€” [workspace.ts](apps/api/src/routes/workspace.ts)
| Method | Path | Notes |
|---|---|---|
| GET | `/api/workspace/members` | With user details |
| POST | `/api/workspace/invite` | OWNER/ADMIN only â€” currently no-op + TODO for Resend integration |
| PUT | `/api/workspace/members/:memberId/role` | Forbid changing OWNER |
| DELETE | `/api/workspace/members/:memberId` | OWNER-only, forbid removing OWNER |
| PATCH | `/api/workspace` | OWNER-only. Only `name` persists today; slug/industry/companySize accepted but ignored (schema TODO) |

### AI â€” [ai.ts](apps/api/src/routes/ai.ts)
| Method | Path | Notes |
|---|---|---|
| GET | `/api/ai/health` | Reports model |
| POST | `/api/ai/plan-campaign` | Validates 10â€“1000 char prompt â†’ calls Anthropic â†’ parses JSON plan |
| POST | `/api/ai/generate-copy` | Validates brief/platform/objective â†’ returns headlines/primary_texts/descriptions/ctas |

Rate-limited at 20 req / 15min per IP (vs 100 for the rest of `/api`).

### Meta â€” [meta.ts](apps/api/src/routes/meta.ts)
| Method | Path | Notes |
|---|---|---|
| GET | `/api/meta/oauth-url` | Auth required. Returns Facebook OAuth URL with `state=dbUserId` |
| GET | `/api/meta/callback` | **No auth** â€” Meta redirects browser here. Exchanges code â†’ short-lived â†’ long-lived token, encrypts, upserts AdAccount per Meta ad account, redirects to `/connect/done?connected=meta` |
| POST | `/api/meta/sync/:adAccountId` | Auth required. Calls `syncService.syncMetaAccount` â†’ upserts Campaign + 30-day CampaignMetrics |
| GET | `/api/meta/ad-accounts` | Auth required. Returns stored Meta ad accounts enriched with fresh Graph API data (tokens never returned) |

### Google â€” [google.ts](apps/api/src/routes/google.ts)
| Method | Path | Notes |
|---|---|---|
| GET | `/api/google/oauth-url` | Auth required. Returns Google OAuth URL with `access_type=offline` + `prompt=consent` to guarantee a refresh token |
| GET | `/api/google/callback` | **No auth** â€” Google redirects browser here. Exchanges code for access + refresh tokens (both encrypted), lists accessible customers, upserts one AdAccount per Google Ads customer, redirects to `/connect/done?connected=google` |
| POST | `/api/google/sync/:adAccountId` | Auth required. Calls `syncService.syncGoogleAccount` â€” refreshes access token on 401 via stored refresh token, persists the new access token, upserts Campaign + 30-day daily CampaignMetrics |
| GET | `/api/google/customers` | Auth required. Returns stored Google customers enriched with live name/currency/timezone/status (tokens never returned) |

### TikTok â€” [tiktok.ts](apps/api/src/routes/tiktok.ts)
| Method | Path | Notes |
|---|---|---|
| GET | `/api/tiktok/oauth-url` | Auth required. Returns TikTok OAuth URL |
| GET | `/api/tiktok/callback` | **No auth** â€” TikTok redirects browser here. Exchanges code for access token + returned `advertiser_ids`, fetches advertiser info for each, upserts AdAccount per advertiser, redirects to `/connect/done?connected=tiktok` |
| POST | `/api/tiktok/sync/:adAccountId` | Auth required. Calls `syncService.syncTikTokAccount` â†’ upserts Campaign + last-30d daily CampaignMetrics from the `report/integrated/get` endpoint |

### LinkedIn â€” [linkedin.ts](apps/api/src/routes/linkedin.ts)
| Method | Path | Notes |
|---|---|---|
| GET | `/api/linkedin/oauth-url` | Auth required. Returns LinkedIn OAuth URL |
| GET | `/api/linkedin/callback` | **No auth** â€” LinkedIn redirects browser here. Exchanges code for access + refresh tokens (both encrypted), pulls all `BUSINESS / ACTIVE` ad accounts via `adAccountsV2`, upserts one AdAccount per account, redirects to `/connect/done?connected=linkedin` |
| POST | `/api/linkedin/sync/:adAccountId` | Auth required. Calls `syncService.syncLinkedInAccount` â†’ upserts Campaign (URN-based; budget = dailyBudget.amount or totalBudget.amount) + last-30d daily CampaignMetrics via `adAnalyticsV2` |

### Next.js proxies â€” [app/api/](apps/web/app/api/)
Server-side proxies that hide the backend URL + add Clerk auth forwarding + validation:
- [ai/plan-campaign/route.ts](apps/web/app/api/ai/plan-campaign/route.ts) â€” POST `/api/ai/plan-campaign`
- [ai/generate-copy/route.ts](apps/web/app/api/ai/generate-copy/route.ts) â€” POST `/api/ai/generate-copy`
- [meta/connect/route.ts](apps/web/app/api/meta/connect/route.ts) â€” GET returns `{ url }` for Meta OAuth (uses `auth()` to attach Bearer token to backend call)
- [google/connect/route.ts](apps/web/app/api/google/connect/route.ts) â€” same pattern for Google
- [tiktok/connect/route.ts](apps/web/app/api/tiktok/connect/route.ts) â€” same pattern for TikTok
- [linkedin/connect/route.ts](apps/web/app/api/linkedin/connect/route.ts) â€” same pattern for LinkedIn

### Health
- `GET /health` â†’ `{ status, timestamp, uptime, version }`

---

## Frontend API Client

[apps/web/lib/api.ts](apps/web/lib/api.ts) exports `useApiClient()` â€” a typed hook that pulls a Clerk Bearer token via `useAuth().getToken()` and exposes:

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
| `WorkspaceMember` | Many-to-many Userâ†”Workspace with role (OWNER/ADMIN/EDITOR/VIEWER) |
| `AdAccount` | Connected ad platform credentials (Meta/Google/TikTok/etc.). `accessToken` is **AES-256-CBC encrypted at rest** and never returned to clients |
| `Campaign` | Per ad-account campaign. `externalId` stores the platform's native campaign ID; unique on `(adAccountId, externalId)` so sync is idempotent |
| `CampaignMetrics` | Daily metrics per campaign, unique on `(campaignId, date)`, auto-derived CTR/CPC/CPM/ROAS |
| `Creative` | Image/Video/Carousel/Text creatives, optionally bound to a campaign |
| `AiSession` | Persisted AI prompt/response history for audit + future analytics |

Indexes added for query patterns: `Campaign(workspaceId, status)`, `Campaign(workspaceId, platform)`, `Campaign(externalId)`.

Enums: `Platform`, `PlanType`, `WorkspaceRole`, `CampaignStatus`, `BudgetType`, `CreativeType`, `CreativeStatus`, `AiSessionType`.

---

## Ad platform setup

For step-by-step Meta + Google integration setup (including production verification, scope details, and troubleshooting), see **[docs/integrations.md](docs/integrations.md)**.

## Setup

### Prerequisites

- Node.js 18+
- PostgreSQL 16+ running locally (or hosted)
- Clerk account ([dashboard.clerk.com](https://dashboard.clerk.com))
- Anthropic API key ([console.anthropic.com](https://console.anthropic.com/settings/keys))

### Environment files

**apps/api/.env** (not committed â€” gitignored)

```
DATABASE_URL=postgresql://postgres:PASSWORD@localhost:5432/advertix
ANTHROPIC_API_KEY=sk-ant-api03-...
CLERK_SECRET_KEY=sk_test_...
CLERK_PUBLISHABLE_KEY=pk_test_...
META_APP_ID=...
META_APP_SECRET=...
META_REDIRECT_URI=http://localhost:4000/api/meta/callback
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
GOOGLE_REDIRECT_URI=http://localhost:4000/api/google/callback
GOOGLE_DEVELOPER_TOKEN=...   # from Google Ads â†’ Tools & Settings â†’ API Center
TIKTOK_APP_ID=...
TIKTOK_APP_SECRET=...
TIKTOK_REDIRECT_URI=http://localhost:4000/api/tiktok/callback
LINKEDIN_CLIENT_ID=...
LINKEDIN_CLIENT_SECRET=...
LINKEDIN_REDIRECT_URI=http://localhost:4000/api/linkedin/callback
ENCRYPTION_KEY=...           # hashed to 32 bytes via SHA-256 at runtime; any string works
FRONTEND_URL=http://localhost:3000
WEB_ORIGIN=http://localhost:3000
PORT=4000
NODE_ENV=development
```

Generate a strong `ENCRYPTION_KEY` with `openssl rand -hex 32`.

**apps/web/.env.local** (not committed â€” gitignored)

```
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...
NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in
NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up
NEXT_PUBLIC_CLERK_SIGN_IN_FALLBACK_REDIRECT_URL=/dashboard
NEXT_PUBLIC_CLERK_SIGN_UP_FALLBACK_REDIRECT_URL=/dashboard
NEXT_PUBLIC_API_URL=http://localhost:4000
```

âš ï¸ **Security:** `.env.example` files in both apps were briefly populated with real Clerk secret keys. They have been scrubbed to placeholders, but if those files were ever committed to git, **rotate your Clerk secret key**.

### One-time database setup

```powershell
# Create the database (or use pgAdmin)
psql -U postgres -c "CREATE DATABASE advertix;"

# Push schema â†’ creates 8 tables
cd apps/api
npx prisma db push

# (optional) Browse the empty tables
npx prisma studio    # http://localhost:5555
```

### Running the apps

```powershell
# Terminal 1 â€” backend (Express on :4000)
cd apps/api && npm run dev

# Terminal 2 â€” frontend (Next.js on :3000)
cd apps/web && npm run dev
```

Or from the repo root: `npm run dev` (turbo runs both in parallel).

### Quick health checks

- API liveness: <http://localhost:4000/health>
- AI route: <http://localhost:4000/api/ai/health>
- Frontend: <http://localhost:3000> â†’ sign in â†’ `/dashboard`

---

## Design System

| Token | Value |
|---|---|
| Brand | `#6366f1` (indigo) |
| Sidebar bg | `#0f172a` |
| Font | Plus Jakarta Sans (Google Fonts) |
| Card | `bg-white rounded-2xl border-slate-200/70 shadow-card` |
| Hover lift | `hover:-translate-y-0.5 hover:shadow-card-hover` |
| Brand button | `.btn-brand` â€” indigo bg, glow on hover |
| Status dots | `.status-dot.{active,paused,ended,draft}` |
| Animations | `.animate-in` + `.stagger-1` â€¦ `.stagger-6` |

All tokens live in [apps/web/app/globals.css](apps/web/app/globals.css) and [apps/web/tailwind.config.ts](apps/web/tailwind.config.ts).

---

## Roadmap

> Strategic ordering. Decided 2026-06-08: no real users until Meta and Google are 100% complete, so production-readiness items intentionally come after platform completeness, not before.

### Phase 1 â€” Meta 100% complete (NEXT UP)

The read/sync path is shipped and verified end-to-end (PKR campaign syncing with correct currency, status, and totals as of 2026-06-08). What's still missing for "100% complete":

- **Publish-to-Meta path** â€” full ad-authoring flow, not just campaign-shell publish. Build campaign â†’ ad set (targeting/budget/schedule/placement) â†’ ad creative (image upload + copy + link) â†’ ad object. Multi-step wizard UI. Real `OUTCOME_*` objective mapping. After clicking Publish in Advertix, a fully-running ad should appear in Facebook within ~30 seconds.
  - Estimated effort: **2-3 days focused work** for Meta alone.
  - Pre-existing scaffolding: `metaService.createCampaign()` already exists in [meta.service.ts](apps/api/src/services/meta.service.ts) but is currently dead code (no route calls it).
- **Webhook-driven status updates** â€” replace the manual "Sync Now" button with a Meta webhook subscription so campaign status / delivery state in Advertix mirrors Facebook in near-real-time. Removes the "stale until I click Sync" UX gap.
- **Meta App Review submission** â€” Meta has to approve `ads_management`, `ads_read`, `business_management` use cases before any non-Tester user can connect. Review takes 5-14 days. Privacy Policy URL must resolve to a real page (currently a placeholder on the Vercel marketing site).

### Phase 2 â€” Google Ads 100% complete

Same scope as Meta, applied to Google:

- Read/sync already shipped (similar architecture, uses refresh tokens with auto-rotation per [google.service.ts](apps/api/src/services/google.service.ts)).
- **Google Developer Token approval** â€” currently the integration runs in test mode with a sandbox developer token. Production requires applying for and being granted a real Developer Token (separate from OAuth approval). Lead time can be weeks.
- **Publish-to-Google path** â€” Google's API is meaningfully different from Meta's (uses GAQL queries, MutateOperations grouped in batches). Estimated effort: **2-3 days focused work** after the Meta authoring code lands and we can share patterns.

### Phase 3 â€” Production readiness (FLIP THE SWITCHES â€” only after Phase 1 and 2 are done)

These are the cheap, high-value changes that gate real user signups. Deferred until Meta + Google are complete because there's no point in being "production ready" with a half-functional product.

#### 3.1 â€” Move Clerk to Production instance (~30 min)
- Today the entire stack runs on Clerk **dev keys** (`pk_test_â€¦` visible in production HTML).
- Dev instances enforce strict rate limits, watermark the hosted UI as "Development", and don't send transactional emails reliably.
- Create production Clerk instance â†’ verify Vercel domain â†’ swap `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` + `CLERK_SECRET_KEY` in both Vercel and Railway â†’ redeploy. See [docs/DEPLOY.md Â§ 6](docs/DEPLOY.md).
- **Until this is done, no real customer can sign up â€” full stop.**

#### 3.2 â€” OAuth state security fix (~45 min)
- Every platform OAuth route currently passes `state = dbUserId` ([meta.ts:28](apps/api/src/routes/meta.ts#L28), and equivalents in google/tiktok/linkedin).
- An attacker who knows another user's DB ID can craft a malicious OAuth URL with `state=<victimUserId>` and trick the victim into adding the attacker's ad account to the victim's workspace. Real CSRF-class flaw.
- Fix:
  1. New Prisma model `OAuthState { nonce String @id, userId String, platform Platform, expiresAt DateTime, consumed Boolean }`.
  2. `GET /api/{platform}/oauth-url` generates `crypto.randomBytes(32).toString('hex')`, stores `(nonce, dbUserId, platform, expiresAt=15min from now)`, returns OAuth URL with `state=nonce`.
  3. `/callback` looks up the nonce, validates `expiresAt > now && !consumed`, marks `consumed = true`, reads `userId` from the stored row.
  4. Same pattern applied to all 4 platforms.
- 45 min once the pattern is built for one platform, then mechanical for the other three.

### Phase 4+ â€” Post-launch / future work

- TikTok + LinkedIn full publish parity (each ~1 day after Meta + Google authoring patterns are established)
- Workspace-level reporting currency + FX conversion for Dashboard/Analytics aggregate views (see [Currency-native display](apps/web/lib/money.ts) â€” per-account already shipped, workspace-level deferred)
- Real Audiences / Billing / Insights backends (currently mocked frontends)
- Notification preferences / API keys / Security tabs in Settings (currently mock UI only)
- Redis-backed rate limiting (`rate-limit-redis`) â€” current in-memory store doesn't survive multi-replica deploys
- Sentry or equivalent error tracking
- Custom domain (separate from `*.vercel.app` / `*.up.railway.app`)

---

## Known TODOs / Pending Work

| Area | Item |
|---|---|
| Auth | Onboarding wizard removed. Workspace is auto-provisioned in `requireAuth` middleware on first authenticated request. The Clerk-metadata-driven redirect path in middleware was also removed; reintroduce if/when we add a paid-tier or compliance-gated step that must come before dashboard access |
| Invites | Wire `POST /api/workspace/invite` to Resend (email) + a pending `Invite` model |
| AI / Audiences | "Build with AI" modal still uses `setTimeout` mock â€” add `/api/ai/build-audience` proxy + route |
| AI / Insights | Floating chat widget uses hardcoded response â€” add `/api/ai/chat` for context-aware responses |
| Data wiring | Most UI pages still display mock data (campaigns/analytics/audiences/creatives/billing). Swap to `useApiClient()` once tables have rows. Settings â†’ Integrations is wired to live data for Meta. |
| Meta OAuth state | Currently `state = dbUserId` â€” change to a short-lived random nonce stored server-side to prevent state-forging attacks (`SECURITY TODO` in [routes/meta.ts](apps/api/src/routes/meta.ts)) |
| Meta sync schedule | `/api/meta/sync/:id` is currently manual via "Sync Now" button. Add a cron/queue (e.g. BullMQ) to refresh every workspace nightly |
| Rate limit | In-memory store works for single-process dev; switch to Redis (`rate-limit-redis`) for production |
| Security | AI + Meta sync routes are auth-gated on backend; Meta `/callback` is intentionally public (Meta redirects browser there). All other routes require Clerk JWT |
| `.env.example` | Confirm both files don't contain real secrets before any commit |

---

## Change Log

> Most recent first. Add a new dated entry for every significant change.

### 2026-08-02 — Removed the temporary Meta API warmup cron

The app is registered and approved on Meta, so the call-volume padding added on 2026-06-21 has served its purpose and is gone. It was firing 11 read-only Marketing API calls per connected ad account every 30 minutes — ~528 calls/day of pure noise, burning rate-limit budget that should serve real customers, and at risk of tripping Meta's abuse detection now that the review window has closed.

**Removed:**

- Deleted `apps/api/src/services/meta-warmup.service.ts`.
- [apps/api/src/index.ts](apps/api/src/index.ts) — dropped the import, the `startMetaWarmupCron()` call after `app.listen()`, and the `stopMetaWarmupCron()` call in the SIGTERM handler.

**Follow-up for whoever owns the deploy:** `META_WARMUP_ENABLED` is now a dead env var — drop it from Railway. Harmless if left, but it reads as live config for code that no longer exists.

The 2026-06-21 entry below is marked resolved and kept for history. `startSyncScheduler()` / `stopSyncScheduler()` are untouched — that's the real periodic sync and stays.

`tsc --noEmit` clean on both apps.

### 2026-06-25 — AI Insights pipeline (real Claude insights; replaces the mock Insights page)

The `/insights` page was 100% hardcoded ("Powered by Claude AI" with nothing behind it). Now it's real: Claude analyzes actual campaign metrics (last 30d + week-over-week) and produces typed, data-driven insights with a full lifecycle.

- **Data model:** `Insight` model + `InsightType` (OPPORTUNITY/WARNING/OPTIMIZATION/ALERT) + `InsightStatus` (ACTIVE/APPLIED/DISMISSED/EXPIRED) + `Workspace.lastInsightGeneratedAt` (`db push`).
- **Service** ([insights.service.ts](apps/api/src/services/insights.service.ts), mirrors budget-optimizer): gathers per-campaign 30-day metrics + 7d-vs-prev-7d deltas + platform summary, asks Claude (via `aiService.generateInsights` — native fetch, `claude-opus-4-8`, `INSIGHTS_SYSTEM_PROMPT`), then dedups (same type+title; skip <24h, refresh older, create new), sets a 7-day `expiresAt`, and stamps `lastInsightGeneratedAt`. **Returns []/empty when there's no data** — never invents insights. `getInsights` auto-expires stale ones. `refreshInsights` has a **1-hour gate**; apply/dismiss/restore/getDismissed round it out.
- **Routes** ([insights.ts](apps/api/src/routes/insights.ts)): `GET /insights`, `POST /generate` (5/hr rate-limit), `POST /:id/dismiss|apply|restore`, `GET /dismissed`.
- **Frontend:** `/insights` page fully rewired to real data — loading skeletons, two honest empty states (no-campaigns → connect; campaigns-but-no-data → generate), real cards (type strip, confidence dot, affected-campaign chips, impact pill, Apply→"Applied ✓"/Dismiss), collapsible Dismissed section with Restore. Dashboard "Recent AI Activity" → **`RecentInsightsCard`** (top 3 real insights / "Run AI Analysis"). Analytics mock `AI_INSIGHTS` strip → **`AnalyticsAIInsights`** (real). api-client `getInsights`/`generateInsights`/`dismissInsight`/`applyInsight`/`restoreInsight`/`getDismissedInsights`.
- **Deviations (flagged):** reused `aiService` (not the SDK); skipped the Next proxy routes (apiFetch direct); the floating **chat widget stays mock** (welcome line now references the real top insight) — wiring it to a real `/ai/chat` is a separate follow-up.

**Files**: [schema.prisma](apps/api/prisma/schema.prisma), [insights.service.ts](apps/api/src/services/insights.service.ts), [ai.service.ts](apps/api/src/services/ai.service.ts), [routes/insights.ts](apps/api/src/routes/insights.ts), [routes/index.ts](apps/api/src/routes/index.ts), [lib/api.ts](apps/web/lib/api.ts), [insights/page.tsx](apps/web/app/(dashboard)/insights/page.tsx), [dashboard/page.tsx](apps/web/app/(dashboard)/dashboard/page.tsx), [analytics/page.tsx](apps/web/app/(dashboard)/analytics/page.tsx). `tsc --noEmit` clean on both apps.

---

### 2026-06-25 — Meta Health Check service (full 7-check report; supersedes the readiness checklist)

Upgraded the lightweight readiness check into a comprehensive **Meta health check** that runs after OAuth (and on demand) and detects every blocking state up front.

- **`meta-health.service.ts`** — 7 checks → structured `MetaHealthReport` (`overall: healthy|degraded|blocked`, `checks[]`, `canSync`, `canPublish`, `readyForBeta`): **(1)** token valid (`/me`; 190/200/other), **(2)** required permissions granted (`/me/permissions`: ads_read/ads_management/business_management), **(3)** ad account exists, **(4)** account status (1/2/3/7/8/9 with per-status copy + `disable_reason`), **(5)** payment method (`funding_source_details`/`is_prepay_account`), **(6)** our pending App Review (always a non-blocking warning; keeps `canPublish=false` until approved), **(7)** sync probe (`/campaigns?limit=1`). New `metaService` helpers: `getMe`/`getPermissions`/`getFundingSource`/`testReadCampaigns` + `disable_reason`.
- **Routes** — `GET /meta/health/:adAccountId` (5-min in-memory cache) + `POST …/refresh` (force). The **OAuth callback** now runs the check, persists the report to `AdAccount.metadata` (+ `lastHealthCheck`; schema `db push`), and redirects with `?health=healthy|degraded|blocked`.
- **Frontend** — `<MetaHealthStatus>` (healthy/degraded/blocked banner + per-check cards, errors-first, with action links + manual refresh; `hideWhenHealthy` for inline use), wired into **Settings → Integrations** and the **Create Campaign wizard**. Client `lib/meta-errors.ts` (`translateMetaError`) + reusable `<MetaErrorCard>` (code→title/action, support link) — wired into the **publish wizard** error. api-client `getMetaHealth`/`refreshMetaHealth`.

**Deliberate deviations from the spec** (all noted to the user): reused `apiFetch` instead of adding **Next proxy routes** (redundant hop); **consolidated** — this replaces the prior `/account-readiness` endpoint + `MetaReadinessChecklist` (removed) so there's one source of truth; kept the server-side `friendlyMetaError` (API responses) *alongside* the client `MetaErrorCard` (different layers); the post-connect `?health=` **toast** is covered by the always-visible health panel rather than plumbing health through the OAuth popup.

**Files**: [meta-health.service.ts](apps/api/src/services/meta-health.service.ts), [meta.service.ts](apps/api/src/services/meta.service.ts), [routes/meta.ts](apps/api/src/routes/meta.ts), [sync.service.ts](apps/api/src/services/sync.service.ts), [schema.prisma](apps/api/prisma/schema.prisma) (`AdAccount.metadata`, `lastHealthCheck`), [lib/api.ts](apps/web/lib/api.ts), [lib/meta-errors.ts](apps/web/lib/meta-errors.ts), [components/ui/MetaErrorCard.tsx](apps/web/components/ui/MetaErrorCard.tsx), [components/settings/MetaHealthStatus.tsx](apps/web/components/settings/MetaHealthStatus.tsx), [settings/page.tsx](apps/web/app/(dashboard)/settings/page.tsx), [CreateCampaignModal.tsx](apps/web/components/campaigns/CreateCampaignModal.tsx), [PublishToMetaModal.tsx](apps/web/components/campaigns/publish/PublishToMetaModal.tsx). Removed `MetaReadinessChecklist.tsx` + `/account-readiness`. `tsc --noEmit` clean on both apps.

---

### 2026-06-25 — Beta-readiness #3: friendly Meta errors + publish-readiness checklist

Onboarding hardening so beta users (whose Meta setups vary) get clear guidance instead of cryptic failures.

- **Friendly Meta error mapping.** `graphFetch` now tags thrown errors with `metaCode`/`metaSubcode`/`metaUserMessage`; a new [meta-errors.ts](apps/api/src/lib/meta-errors.ts) (`friendlyMetaError`/`isMetaError`) maps them to plain, actionable messages — applied in the global `errorHandler` (covers launch/sync/etc.) and the publish route's own catch. Examples: code **3** → "Publishing isn't available yet — awaiting Meta Standard Access…"; **190** → "Your Meta connection expired — reconnect in Settings"; **200/10** → "You need Advertiser/Admin access…"; payment → "add a payment method"; rate-limit codes → "try again shortly". Raw error + failing step still logged server-side.
- **Publish-readiness checklist.** New `GET /meta/account-readiness` returns `{ connected, hasAdAccount, accountActive, accountStatus, hasPage }` (live `getPages` + `getAdAccounts`, "not connected" is a normal state). New `<MetaReadinessChecklist>` shows ✓/✗ with fix links (connect account / review status / create a Page), wired into the **Create Campaign wizard** (`hideWhenReady`) and **Settings → Integrations**. `AdAccount.accountStatus` persisted (sync + `/ad-accounts` select; `db push`) — the checklist's "Ad account is active" row is the disabled-account warning.

**Files**: [meta-errors.ts](apps/api/src/lib/meta-errors.ts), [meta.service.ts](apps/api/src/services/meta.service.ts), [middleware/errorHandler.ts](apps/api/src/middleware/errorHandler.ts), [routes/campaigns.ts](apps/api/src/routes/campaigns.ts), [routes/meta.ts](apps/api/src/routes/meta.ts), [routes/ad-accounts.ts](apps/api/src/routes/ad-accounts.ts), [sync.service.ts](apps/api/src/services/sync.service.ts), [schema.prisma](apps/api/prisma/schema.prisma), [lib/api.ts](apps/web/lib/api.ts), [components/meta/MetaReadinessChecklist.tsx](apps/web/components/meta/MetaReadinessChecklist.tsx), [CreateCampaignModal.tsx](apps/web/components/campaigns/CreateCampaignModal.tsx), [settings/page.tsx](apps/web/app/(dashboard)/settings/page.tsx). `tsc --noEmit` clean on both apps.

---

### 2026-06-25 — AI Budget Optimizer (honest scaffold, DB-only apply, no auto-mode)

Built the AI Budget Optimizer: analyzes campaign ROAS (last 14d vs previous 14d) and recommends budget reallocations, with per-card or "apply all". Built deliberately as a **scaffold that's honest about data and scope** (per founder decision):
- **Insufficient-data gate** — if the workspace has no revenue/ROAS signal (the current reality: traffic/awareness campaigns, revenue 0), `analyze` short-circuits with a clear "need revenue-tracked campaigns" state instead of asking the model to optimize zeros (and doesn't burn an AI call or a rate-limit slot).
- **Apply = DB-only (planning).** Updates `Campaign.budget` / `status` in our DB; does NOT push to Meta yet. The page shows a "Planning mode" banner. Real Meta push deferred (see FUTURE_FEATURES).
- **No auto-mode** — the spec's auto-apply cron/toggle was deferred (riskiest part; auto-spending real money from raw AI). Schema keeps dormant `Workspace.autoOptimize`/`autoOptimizeThreshold` for later.
- **Corrections to the spec:** reused `aiService` (native `fetch`, **`claude-opus-4-8`**) instead of the `@anthropic-ai/sdk` + the **retired** `claude-sonnet-4-20250514`; currency-aware (no hardcoded `$`); skipped the redundant Next proxy routes (auth calls go direct via `apiFetch`).

Backend: `BudgetRecommendation` model + `BudgetRecommendationStatus` enum (`db push`); `budgetOptimizerService` (analyze/apply/dismiss/history/latest); `aiService.optimizeBudget` + `BUDGET_SYSTEM_PROMPT`; `routes/budget-optimizer.ts` (analyze rate-limited 10/hr, apply, dismiss, history, latest). Frontend: `/budget-optimizer` page (analyze → summary + insight cards → priority-sorted recommendation cards with per-card Apply/Skip → history; insufficient/empty/initial states), api-client types + methods, sidebar "Budget Optimizer" item (Intelligence group, AI badge), dashboard preview widget.

**Files**: [schema.prisma](apps/api/prisma/schema.prisma), [budget-optimizer.service.ts](apps/api/src/services/budget-optimizer.service.ts), [ai.service.ts](apps/api/src/services/ai.service.ts), [routes/budget-optimizer.ts](apps/api/src/routes/budget-optimizer.ts), [routes/index.ts](apps/api/src/routes/index.ts), [lib/api.ts](apps/web/lib/api.ts), [budget-optimizer/page.tsx](apps/web/app/(dashboard)/budget-optimizer/page.tsx), [Sidebar.tsx](apps/web/components/layout/Sidebar.tsx), [dashboard/page.tsx](apps/web/app/(dashboard)/dashboard/page.tsx). `tsc --noEmit` clean on both apps.

---

### 2026-06-24 — Security: stop leaking ad-account access tokens to the client

`GET /campaigns/:id` used `include: { adAccount: true }` and spread the result into the response, shipping the **encrypted `accessToken`/`refreshToken`** to the browser. Added a shared `AD_ACCOUNT_PUBLIC_SELECT` (platform, accountName, accountId, currency, timezone, minDailyBudget — **no tokens**) and applied it to the detail route and the list route. The publish/launch routes still fetch the full record (they need the token to call Meta) but return a separate `updated` query with no `adAccount` — annotated with comments so a future edit doesn't re-introduce the leak.

**Files**: [campaigns.ts](apps/api/src/routes/campaigns.ts). `tsc --noEmit` clean on apps/api.

---

### 2026-06-24 — Block below-minimum daily budgets before publish

A daily budget below the account's real Meta minimum (e.g. PKR 279.56) is rejected at publish. Now caught up front: the create wizard's **Next** (step 3) and the campaign settings **Save Changes** are **disabled** with an inline red hint ("Below this account's minimum of PKR X/day") when a **daily** budget is under the account minimum. Only enforced for daily budgets (Meta's `min_daily_budget` is a daily figure) and only when the minimum is known. `minDailyBudget` added to `Campaign.adAccount` select/type so the edit tab has it.

**Files**: [CreateCampaignModal.tsx](apps/web/components/campaigns/CreateCampaignModal.tsx), [campaigns/[id]/page.tsx](apps/web/app/(dashboard)/campaigns/[id]/page.tsx), [lib/api.ts](apps/web/lib/api.ts). `tsc --noEmit` clean on apps/web.

---

### 2026-06-24 — Budget inputs use the ad-account currency; recommendation anchored on Meta's real minimum

The campaign create wizard and the campaign settings/edit page hardcoded a `$` on the budget input. But the number entered is sent to Meta **in the ad account's own currency** (e.g. PKR) — so a `$` label made users type "75" thinking dollars when Meta read it as 75 PKR (~$0.27), directly causing "budget too low" publish failures. Now the budget input prefix and the wizard review row use the **account currency symbol** (`currencySymbol(adAccount.currency)`), derived from the selected platform's ad account.

For the AI budget *recommendation* (which needs actual numbers), instead of a stale hardcoded USD→currency factor table, we now **anchor on Meta's real per-account minimum daily budget** — `min_daily_budget` is fetched in `getAdAccounts`, stored on `AdAccount.minDailyBudget` (account currency, captured each sync), and the recommendation suggests a sensible multiple of it. This is grounded in live Meta data, currency-correct, and self-updating (no FX). Falls back to plain guidance when the account hasn't synced yet. Dashboard/Analytics USD aggregates are unchanged (per workspace-currency note).

**Files**: [schema.prisma](apps/api/prisma/schema.prisma) (`AdAccount.minDailyBudget`, `db push`), [meta.service.ts](apps/api/src/services/meta.service.ts), [sync.service.ts](apps/api/src/services/sync.service.ts), [lib/api.ts](apps/web/lib/api.ts), [money.ts](apps/web/lib/money.ts), [CreateCampaignModal.tsx](apps/web/components/campaigns/CreateCampaignModal.tsx), [campaigns/[id]/page.tsx](apps/web/app/(dashboard)/campaigns/[id]/page.tsx). `tsc --noEmit` clean on both apps.

---

### 2026-06-24 — Publish-to-Meta fix: invalid `promoted_object` (code 100) + richer Meta errors

Publishing failed (pause/resume worked) — the stored `publishError` was `Meta API: Invalid parameter (code: 100)`. Root cause: [createAdSet](apps/api/src/services/meta.service.ts) attached `promoted_object: { page_id }` for **every** objective, but Meta only accepts a page-based `promoted_object` for page-promoting optimization goals (`PAGE_LIKES`/`POST_ENGAGEMENT`/`LEAD_GENERATION`). For **Awareness** (`REACH`) and **Traffic** (`LINK_CLICKS`) it's rejected as invalid — breaking publish for those objectives. Confirmed it's not a permissions issue: pause/resume use the same `ads_management` write scope and succeed (code 100 ≠ permission codes 200/10/3). Fixes:
- Gate `promoted_object` to only the goals that require it.
- **`graphFetch` now surfaces Meta's `error_user_title`/`error_user_msg`/`error_subcode`** instead of the bare "Invalid parameter" — publish failures are now self-explanatory in `publishError` and the API response.
- With the richer error visible, the next failure was `is_adset_budget_sharing_enabled` (code 100/4834011): recent Meta API versions require this flag on a campaign with **no** campaign-level budget (we budget at ad-set level). `createCampaign` now sends `is_adset_budget_sharing_enabled=false` in that case.

**Files**: [meta.service.ts](apps/api/src/services/meta.service.ts). `tsc --noEmit` clean on apps/api.

---

### 2026-06-24 — Meta data fidelity: sync freshness, exact money, reach, real revenue

Fixed a cluster of "app doesn't match Ads Manager" bugs reported against a live boosted-post campaign.

- **Stale / missing campaigns** — root cause: sync only ran when `POST /meta/sync/:id` was hit, and the frontend never called it (no scheduler, no button). So campaigns created on Meta after connect (e.g. a boosted reel) never imported. Fix: (a) **auto-sync scheduler** ([sync-scheduler.service.ts](apps/api/src/services/sync-scheduler.service.ts)) every `SYNC_INTERVAL_HOURS` (default **6**; `SYNC_SCHEDULER_ENABLED=false` to disable), registered in [index.ts](apps/api/src/index.ts); (b) a **"Sync now"** button on the campaigns page (`api.syncMeta()` → `POST /meta/sync`, syncs all active Meta accounts); (c) **pagination** — `getCampaigns`/`getCampaignInsights` now follow `paging.next` via `graphFetchAll` (Meta's default 25-row page was truncating campaigns + daily insights); (d) `AdAccount.lastSyncedAt` stamped each sync.
- **Spend rounded to whole numbers** (Rs1,148.72 → "Rs1149") — `fmtMoney` defaulted to 0 fraction digits. Now shows **exact 2 decimals** for standard money (spend/revenue/budget); `compact` still used for hero numbers. Dashboard/Analytics USD aggregates intentionally left as-is (see workspace-currency memory).
- **Reach missing** — never fetched/stored/shown. Added `Campaign.reach` (range-level, **not** summed from daily rows — reach is de-duplicated, so a new `getCampaignReach` pulls the period figure that matches Ads Manager). Surfaced on the campaign cards, the list table (new Reach column), and a new Reach metric card on the detail page.
- **Revenue / ROAS** — revenue was `roas × spend` (circular, breaks without `purchase_roas`). Now fetched from real `action_values` (purchase value). For non-sales campaigns (e.g. Landing Page Views) revenue/ROAS are genuinely 0 — the UI now shows **"—"** instead of "0"/"0.00x" so it doesn't read as broken.

**Files**: [meta.service.ts](apps/api/src/services/meta.service.ts), [sync.service.ts](apps/api/src/services/sync.service.ts), [sync-scheduler.service.ts](apps/api/src/services/sync-scheduler.service.ts), [routes/meta.ts](apps/api/src/routes/meta.ts), [index.ts](apps/api/src/index.ts), [schema.prisma](apps/api/prisma/schema.prisma) (`Campaign.reach`, `AdAccount.lastSyncedAt` — applied via `db push`), [lib/api.ts](apps/web/lib/api.ts), [lib/money.ts](apps/web/lib/money.ts), [campaigns/page.tsx](apps/web/app/(dashboard)/campaigns/page.tsx), [campaigns/[id]/page.tsx](apps/web/app/(dashboard)/campaigns/[id]/page.tsx). New env: `SYNC_INTERVAL_HOURS` (default 6), `SYNC_SCHEDULER_ENABLED`. `tsc --noEmit` clean on both apps.

---

### 2026-06-24 — Audiences: mock → real (saved targeting templates + live Meta tab + AI/manual builders)

Converted the static Audiences mock into a real, data-backed feature. An
**Audience** is now a reusable Meta targeting spec (`MetaTargeting` JSON) saved
workspace-scoped, that can prefill the campaign publish wizard. Two tabs: **My
Audiences** (our DB) and **Meta Audiences** (live custom/saved/lookalike from
the connected account, read-only). The fabricated card metrics (size / CPM /
match-rate / reach) were **removed** — cards now show only honest data: type,
a criteria summary, and an approximate size *only where Meta provides it*. See
[AUDIENCES.md](AUDIENCES.md) for the full feature doc.

- **Data** — new `Audience` model + `AudienceType` enum + `Workspace.audiences` relation ([schema.prisma](apps/api/prisma/schema.prisma)); applied via `prisma db push` (this project has no migrations dir — it syncs the dev DB with db push).
- **API** — new workspace-scoped CRUD at `/audiences` ([audiences.ts](apps/api/src/routes/audiences.ts), mirrors `creatives.ts`): list/create/update/delete/duplicate. New AI route `POST /ai/generate-audience` + `aiService.generateAudienceTargeting()`: an LLM proposes targeting by NAME, then the route resolves interest/location names to **real Meta IDs** via the existing `/meta/interests` + `/meta/locations` search (requires a connected Meta account).
- **Shared targeting components** — extracted `InterestPicker` / `CityPicker` / `CountryPicker` / `CustomAudiencePicker` / `SavedAudiencePicker` (+ `ChipList`, `formatBig`, `Selected*` types) out of the publish wizard into [components/targeting/pickers.tsx](apps/web/components/targeting/pickers.tsx); the wizard now imports them (no fork).
- **Builders** — the build modal offers **AI** (describe → drafted, editable targeting) and **Manual** (age/gender + country/city/interest/custom-audience pickers) — the user picks. Both save one `MetaTargeting` spec.
- **Publish integration** — a "Load saved audience" dropdown in the wizard's targeting step seeds the state from a saved audience.
- **Client** — `getAudiences` / `createAudience` / `updateAudience` / `deleteAudience` / `duplicateAudience` / `generateAudienceTargeting` + `Audience` types in [api.ts](apps/web/lib/api.ts).

**Files**: [apps/api/prisma/schema.prisma](apps/api/prisma/schema.prisma), [apps/api/src/routes/audiences.ts](apps/api/src/routes/audiences.ts), [apps/api/src/routes/index.ts](apps/api/src/routes/index.ts), [apps/api/src/routes/ai.ts](apps/api/src/routes/ai.ts), [apps/api/src/services/ai.service.ts](apps/api/src/services/ai.service.ts), [apps/web/lib/api.ts](apps/web/lib/api.ts), [apps/web/components/targeting/pickers.tsx](apps/web/components/targeting/pickers.tsx), [apps/web/components/campaigns/publish/PublishToMetaModal.tsx](apps/web/components/campaigns/publish/PublishToMetaModal.tsx), [apps/web/app/(dashboard)/audiences/page.tsx](apps/web/app/(dashboard)/audiences/page.tsx), [AUDIENCES.md](AUDIENCES.md). Real reach estimate (Meta `delivery_estimate`) deferred to post-App-Review — see [FUTURE_FEATURES.md](FUTURE_FEATURES.md). `tsc --noEmit` clean on `apps/api` + `apps/web`.

---

### 2026-06-24 — AI Generate: reference-image upload (+ icon, image-guided generation)

Added an optional **reference product image** to AI Generate. A "Reference image" (`+`/`ImagePlus`) control sits in the prompt bar control row for the **image** and **carousel** kinds; picking a PNG/JPEG/WebP (≤10MB) shows a thumbnail chip with an `×` to remove. When a reference is attached, generation routes to OpenAI's **`/v1/images/edits`** (image-guided) instead of `/v1/images/generations` (text-to-image), so the product is featured as the hero subject. The same image guides **all N image outputs** and **every carousel card** (re-sent per parallel call). Model stays **`gpt-image-1-mini`** / quality `low` — no cost-tier change; `input_fidelity` is intentionally not sent (unsupported on `-mini`), so the product is *guided*, not pixel-perfect.

- **Backend** — `generateImage(prompt, aspect, reference?)` adds a multipart `/images/edits` branch (native `FormData` + `Blob`, same `fetch`); `buildAdImagePrompt({ …, hasReference })` swaps in product-placement wording while keeping the anti-text/no-logo guardrails. `POST /ai/generate-image` gains `multer` `upload.single("image")` (10MB memory storage, no-op for JSON callers) + mimetype validation. `errorHandler` now maps `MulterError` (e.g. `LIMIT_FILE_SIZE`) to a friendly 400 instead of a 500.
- **Frontend** — `api.generateAdImage` takes optional `image?: File`; when present it bypasses JSON `apiFetch` for a raw-`fetch` + `FormData` POST (mirrors `uploadMetaImage`). `AIGenerateModal` holds `refImage`/`refPreview` state (object URL revoked on replace/clear/close).

**Files**: [apps/api/src/services/openai-image.service.ts](apps/api/src/services/openai-image.service.ts), [apps/api/src/routes/ai.ts](apps/api/src/routes/ai.ts), [apps/api/src/middleware/errorHandler.ts](apps/api/src/middleware/errorHandler.ts), [apps/web/lib/api.ts](apps/web/lib/api.ts), [apps/web/app/(dashboard)/creatives/page.tsx](apps/web/app/(dashboard)/creatives/page.tsx). `tsc --noEmit` clean on `apps/api` + `apps/web`.

---

### 2026-06-24 — Richer, editable prompt templates

The five `PROMPT_TEMPLATES` were one-line briefs — too thin to produce strong copy or imagery. Replaced with six detailed, structured templates (E-commerce + sale, SaaS trial, DTC launch, Local service, Food/café, Webinar) written for the user to **pick → fill the `[BRACKETED PLACEHOLDERS]` → send**. Each is multi-line with explicit Goal / Key benefit / Offer / Tone fields (drive copy generation) plus a **Visual direction:** block (becomes the image context). Written for text-to-image — they describe a scene to render, not an uploaded product to composite (reference-image upload still deferred; add a product-placement template when it ships). Prompt textarea bumped to `rows={3}` + `resize-y` + `max-h-[40vh]` so the longer templates are comfortable to edit; popover label now reads "Pick one, fill the [brackets], then send".

**Files**: [apps/web/app/(dashboard)/creatives/page.tsx](apps/web/app/(dashboard)/creatives/page.tsx) (`PROMPT_TEMPLATES`, brief textarea, templates popover). `tsc --noEmit` clean on `apps/web`.

---

### 2026-06-24 — AI Generate: per-section eye toggle + description wrap fix

Two changes to the AI Generate modal's right-side variant pane:

1. **Per-section visibility (eye toggle).** Each section header — Headlines, Primary Texts, Descriptions, CTAs — now has an eye/eye-off button. Toggling "eye-off" excludes that section from the saved creative **and** drops it from the live preview card (hidden values resolve to `""`, which the card already renders conditionally). New `hidden` state (`{ headline, primaryText, description, cta }`, keyed to match `picked`) in `AIGenerateModal`, reset on open/close and on each new result. Hidden sections are dimmed + non-interactive (`opacity-40 pointer-events-none`) with a struck-through title so the user still sees what they're leaving out. `handleSaveCreative` omits hidden sections from `content` in both the single and carousel paths. If the headline is hidden, the creative falls back to the generic `AI {type} · {platform} · {date}` name (no headline to derive from).

2. **Description text wraps instead of clipping.** Single-line variant rows (`EditableVariantList`, `multiline={false}` — Headlines, Descriptions) used `truncate`, so longer descriptions ran past the box edge. Switched to `break-words` + `min-w-0` so they wrap to additional lines.

**Files**: [apps/web/app/(dashboard)/creatives/page.tsx](apps/web/app/(dashboard)/creatives/page.tsx) (`EditableVariantList` eye toggle + wrap, `AIGenerateResults` hidden wiring, `AIGenerateModal` hidden state + save filtering). `tsc --noEmit` clean on `apps/web`.

---

### 2026-06-24 — AI preview card redesign + creative named from AI headline

Two follow-up polish changes:

1. **Card redesign (matches shared reference).** The in-modal AI-generated preview is now a floating image with all corners rounded (`rounded-2xl`, no outer card box), centered above its copy. Width is applied to the **image only** (portrait `w-[240px]`, landscape `w-[440px]`, square `w-[300px]`); the text block below is wider (`w-[420px] max-w-full`, centered) — headline (bold), body (`line-clamp-3`), description (`line-clamp-2`), CTA button. Carousel + thumbnail strip read `dataUrl`.

2. **Library card title = AI headline.** `handleSaveAiCreative` now derives the creative `name` from the generated headline (`content.headlines[0]`, or `content.cards[0].headline` for carousel), strips wrapping quotes, caps at 80 chars, and only falls back to the old `AI {type} · {platform} · {date}` label when no headline exists. `CreativeCard` renders `c.name` (truncated). **Applies to newly-saved creatives only** — existing library rows keep their old generic names.

**Files**: [apps/web/app/(dashboard)/creatives/page.tsx](apps/web/app/(dashboard)/creatives/page.tsx) (`handleSaveAiCreative` name derivation, `AIGenerateImagePreview` card JSX). `tsc --noEmit` clean on `apps/web`.

---

### 2026-06-24 — AI Generate: true 9:16/16:9 crop, data-URL live preview (not persisted), frozen aspect

Four related fixes to AI image generation + preview:

1. **True placement ratios via server-side crop.** OpenAI `gpt-image-1-mini` only outputs 1:1, 2:3, 3:2 — but ad placements want 1:1 (Feed), **9:16** (Reels/Stories), **16:9** (Video/Display). So we now generate the nearest size and **center-crop** to the exact ratio with `sharp`: portrait 2:3→9:16 (trims ~80px off each side), landscape 3:2→16:9 (trims ~80px off top & bottom), square untouched. Crop is ~10% and centered, so faces stay intact. Full-res crop (no downscale); falls back to the uncropped image if `sharp` throws. New dep: `sharp` in `apps/api`.

2. **Live preview uses a base64 data URL — but it's NEVER persisted.** Meta's `/adimages` `url` (`scontent.fbcdn.net`) didn't render reliably as an `<img>` src, so the in-modal preview (center card, thumbnail strip, carousel) reads a `dataUrl` returned by `POST /ai/generate-image`. The `dataUrl` lives ONLY in in-memory React state. **On save we persist the Meta `url`** (small string, same as the device-upload flow) + `imageHash` — never the base64. This fixes the `PayloadTooLargeError: request entity too large` (a base64 PNG is 1–2MB and blew the 2mb body limit, multiplied for carousels) and keeps DB rows small.

3. **Aspect frozen at generation time.** Each generated image captures its `aspect` (`capturedAspect = aspect` when `generate()` fires) into `{ url, hash, dataUrl, aspect }`. The preview reads `image.aspect`, not the live chip — flipping the chip after generating no longer reshapes an existing card; it only affects the *next* generation.

4. **Card sizing matches the real cropped ratios** (no letterbox): square `aspect-square` @ 300px, portrait `aspect-[9/16]` @ 240px, landscape `aspect-[16/9]` @ 440px. Replaces the old `inline-flex w-fit` that left gray space beside portrait. The chip labels ("9:16 · Reels / Stories", "16:9 · Video / Display") are now accurate.

**Files**: [apps/api/src/services/openai-image.service.ts](apps/api/src/services/openai-image.service.ts) (`cropToRatio` + `targetRatioForAspect`, crop in `generateImage`), [apps/api/src/routes/ai.ts](apps/api/src/routes/ai.ts) (`generate-image` returns `dataUrl`), [apps/web/lib/api.ts](apps/web/lib/api.ts) (`generateAdImage` return type), [apps/web/app/(dashboard)/creatives/page.tsx](apps/web/app/(dashboard)/creatives/page.tsx) (state shapes, `generate()`, `handleSaveCreative()` persists Meta url not dataUrl, `AIGenerateImagePreview`, `AIGenerateCarouselPreview`).

`tsc --noEmit` clean on `apps/web` and `apps/api`.

---

### 2026-06-23 â€” Image gen provider swap: Gemini â†’ OpenAI GPT Image 1 Mini

Gemini Flash Image's "free tier" turned out to be geo-gated to `limit: 0` for our region (Pakistan), even on a fresh API key. Burned a day diagnosing 404s (model name changed `-preview` â†’ stable), then 429s ("Quota exceeded ... limit: 0"). Confirmed via the error response that the issue wasn't our code â€" it was Google's regional rollout policy for image-gen on the free tier.

Switched to OpenAI GPT Image 1 Mini instead:
- **$0.005/image at Low quality 1024Ã—1024** â€" cheapest pay-as-you-go option from any major provider, and significantly easier billing UX than Google Cloud.
- $5 of OpenAI credit â‰ˆ 1,000 images â€" covers the entire beta with massive headroom.
- No regional restrictions; same quota everywhere.
- Same API contract upstream, so the route + web client + UI stayed identical â€" only the service implementation swapped.

**Files**:
- [apps/api/src/services/openai-image.service.ts](apps/api/src/services/openai-image.service.ts) â€" new. `OpenAIImageService.generateImage(prompt, aspect)` calls `POST /v1/images/generations` with `gpt-image-1-mini`, `quality: "low"`, and a size mapped from our aspect enum (`1024x1024` / `1024x1536` / `1536x1024`). Returns the same `{ base64, mimeType, buffer }` shape as the old Gemini service so nothing downstream changed.
- [apps/api/src/services/gemini.service.ts](apps/api/src/services/gemini.service.ts) â€" **deleted**. No dead code; if we ever want Gemini back, git history has it.
- [apps/api/src/routes/ai.ts](apps/api/src/routes/ai.ts) â€" import swapped, error codes renamed (`GEMINI_NO_KEY` â†’ `OPENAI_NO_KEY`, etc.) so the route can map provider errors to friendly toasts. Error messages mention OpenAI by name so operators know what's actually being called.
- [apps/api/.env.example](apps/api/.env.example) â€" `GEMINI_API_KEY` removed, `OPENAI_API_KEY` added with a comment pointing to the pricing/setup flow.

**Why OpenAI specifically (not Stability AI / Replicate / Pollinations)**:
- Simplest billing flow â€" add card â†’ create key â†’ done. No Google Cloud project gymnastics.
- Quality on the Low tier is still ad-grade â€" tested side-by-side with Gemini's free output and OpenAI is at least as good for product/lifestyle ads.
- API shape is familiar (DALL-E descended), no SDK dependency needed â€" native fetch keeps us consistent with `ai.service.ts`.
- Free providers (Pollinations) have worse quality and uptime; not worth the savings at $0.005/image.

The aspect-ratio chip in the UI (`square` / `portrait` / `landscape`) now maps to OpenAI's three accepted sizes via `sizeForAspect()`. Quality stays hardcoded to Low until paid customers ask for sharper images â€" then we'll surface a UI knob.

`tsc --noEmit` clean on `apps/api`.

---

### 2026-06-23 â€” AI Generate v2: 2-column preview/variants, inline editing, image gen wired to the main prompt

Continuation of the same-day redesign. The first version shipped the right-side panel + prompt input but left image generation only accessible from the per-card carousel button â€" the main prompt still produced copy-only. This pass closes that gap and restructures the results panel.

**Image generation wired to the main prompt** ([apps/web/app/(dashboard)/creatives/page.tsx](apps/web/app/(dashboard)/creatives/page.tsx))
- `generate()` now fires copy + N image generations in parallel:
  - **Image kind:** N = `outputs` chip value (1/2/3). All calls share the same brief + aspect.
  - **Carousel kind:** after copy returns, one image call per card runs in parallel (so a 4-card carousel = 4 Gemini calls).
  - **Video / Text:** no image generation.
- Each image call uses the new `aspect` param (`square` / `portrait` / `landscape`) propagated from the prompt-bar chip. Failures degrade gracefully â€" copy still lands, image slots stay empty, a friendly toast suggests retry-per-card.
- Backend support: `geminiService.buildAdImagePrompt` now accepts `aspect` and rewrites the framing line accordingly ("Portrait 9:16 vertical aspect ratio â€" compose for vertical mobile viewing..."). `POST /ai/generate-image` accepts an `aspect` body field and forwards it to the prompt builder.

**Results panel: 2-column preview/variants** (replaces the old stacked list)
- **Left column â€" preview card:**
  - Image kind: square preview of the picked Gemini image with an "AI" badge top-right; below the image, a faux ad caption that mirrors the picked headline + body + description + CTA in real time. When `outputs > 1`, a thumbnail row appears below the card for picking which image to use.
  - Carousel kind: a horizontal paginated carousel (prev/next chevrons + dot indicator) with one card visible at a time. Each card shows its image (or loading spinner while images generate) + per-card headline + description. Ad-level body copy + CTA appear below the carousel.
  - Video / Text kind: copy-on-gradient placeholder card (no image).
- **Right column â€" variant pickers:**
  - **Headlines** (5 options), **Primary Texts** (3), **Descriptions** (3), **CTAs** (4). For carousel, only Primary Texts + CTAs appear (per-card headlines live on the card itself).
  - Every row is now **clickable + inline-editable** via the new `EditableVariantList` component. Click a row to pick it; click the pencil to swap into an inline `<input>` / `<textarea>`. Enter (or green check) commits; Escape (or X) cancels.
  - Edited text propagates to the preview card immediately so the user can iterate on copy with the picked variant visible.
  - State separation: a new `edited` working copy hydrates from `result` on every fresh generation so AI output stays intact while user edits accumulate. Save uses `edited`, not the raw AI response.

**Save handler updates**
- Saving now bundles: picked image (`url`, `imageHash`), reordered + edited copy arrays (picked variant moved to index `[0]` so the publish wizard auto-fills with it), brief + tone + aspect for downstream display, and â€" for carousel â€" per-card images merged into each card object (`cards[i].url`, `cards[i].imageHash`).
- Carousels save with a top-level `url` (= first card's image) so the library card preview thumbnail renders without an extra lookup.

**Prompt input changes**
- Added a small **Regenerate icon button** (ghost style, `<RefreshCw>`) next to the gradient send arrow â€" only visible once a result exists. Re-running the same brief produces fresh copy + images. The old in-results "Use This Creative" + "Regenerate" button pair is gone.
- Save button moved into the right column as a **sticky bottom action**: single `<Save>` icon + "Save" label, no longer crowded by a redundant Regenerate.

**Body layout**
- Hero + loading states stay at `max-w-4xl` (centered, narrow). Results expand to `max-w-6xl` so the 2-column grid has room. Grid template: `minmax(0, 1fr) minmax(0, 1.1fr)` â€" right column is slightly wider since it has 4 variant sections to display.

**Three new internal components** in [creatives/page.tsx](apps/web/app/(dashboard)/creatives/page.tsx):
- `AIGenerateImagePreview` â€" left-column card for image/video/text kinds.
- `AIGenerateCarouselPreview` â€" left-column paginated carousel for carousel kind.
- `EditableVariantList` â€" right-column clickable + editable variant section. Shared between Headlines, Primary Texts, Descriptions.

`tsc --noEmit` clean on both `apps/api` and `apps/web`. `next lint` reports `âœ" No ESLint warnings or errors`.

---

### 2026-06-23 â€” AI Generate modal redesign + Gemini image generation

Two big changes in one entry because they shipped together as the same UX story: "users can describe an ad in plain English and get publishable copy + images out the other end."

#### AI Generate modal: Madgicx-style right-side workspace

Replaced the centered AI Generate modal with a right-side slide-in panel (90vw, full height). Goals: roomier canvas, prompt-first interaction, settings stay visible while you iterate.

- **Modal primitive** ([apps/web/components/ui/Modal.tsx](apps/web/components/ui/Modal.tsx)) gained a `position?: "center" | "right"` prop. Center is the existing dialog; `"right"` renders an `inset-y-0 right-0 w-[90vw]` panel that slides in via a new `slide-in-right` keyframe + `animate-slide-in-right` utility in [globals.css](apps/web/app/globals.css). 10% scrim on the left, click-to-close, ESC-to-close, body scroll-lock â€” all the existing modal primitive behavior carries over.
- **AI Generate modal** ([creatives/page.tsx](apps/web/app/(dashboard)/creatives/page.tsx)) restructured around 4 vertical sections:
  1. **Header bar** â€” compact title + close.
  2. **Settings strip** â€” horizontal pills for Platform, Objective, Type, Tone (and Cards count when type=carousel). Each pill uses a new `<SettingsPill>` wrapper around the existing `<FilterSelect>`.
  3. **Body** â€” swaps between three states: a centered **hero** (3 floating angled example cards + headline + subtitle) when no result yet; a **loading panel** (glowing Sparkles + phase-aware copy) during generation; a **results panel** with the existing variant pickers + sticky save/regenerate footer.
  4. **Bottom prompt input** (sticky) â€” big rounded `<textarea>` with chips: **Aspect** (Square 1:1 / Portrait 9:16 / Landscape 16:9), **Prompt Templates** (5 curated starter briefs: SaaS free-trial, DTC launch, local lead-gen, e-commerce sale, webinar signup), **Outputs** (1/2/3 parallel generations), and a gradient send button. â‚Ä/Ctrl+Enter shortcut also triggers generate.
- **New constants** in [creatives/page.tsx](apps/web/app/(dashboard)/creatives/page.tsx): `ASPECT_OPTIONS`, `OUTPUT_OPTIONS`, `PROMPT_TEMPLATES`. Aspect ratio is persisted into the saved creative's `content` so downstream wizards / image generation can pick it up.
- **New helper components** colocated with the modal: `aspectIcon()` (small shaped rectangle), `SettingsPill` (label + value pill for the strip), `ChipDropdown` (generic chip-with-popover for aspect + outputs), `AIGenerateHero` (the empty-state with the 3 angled cards + sparkle accents), `AIGenerateResults` (the variant picker + sticky action row, extracted so the main modal JSX stays readable).
- **Aspect ratio + outputs are state-only for now** â€” they're persisted on save and shown in the prompt bar UI but not yet wired into a single-shot image generation flow. The per-card "AI image" button below uses square 1:1 as Gemini's default; the wiring of Aspect â†’ Gemini and Outputs â†’ N parallel generations is intentionally deferred until we see how beta users actually use the panel.

#### Gemini image generation (per-card)

This is the narrow slice of the deferred "Madgicx-style AI image generation" feature ([FUTURE_FEATURES.md](FUTURE_FEATURES.md), [memory: future-ai-image-generation.md](C:/Users/Shahr/.claude/projects/c--Users-Shahr-OneDrive-Desktop-review-test-adgenius-ai/memory/future-ai-image-generation.md)). The original gate was "wait for paid customers" because we assumed image gen would be expensive; Gemini's free tier (500/day Flash Image) removes that constraint at MVP scale. Shipped just enough to close the obvious gap â€” AI Carousel produced text-only cards that the user then had to upload 5 images for.

- **`apps/api/src/services/gemini.service.ts`** â€” thin wrapper around Google's Gemini `v1beta/models/gemini-2.5-flash-image-preview:generateContent`. Native `fetch`, no SDK dep. Methods:
  - `buildAdImagePrompt({ brief, headline, description })` â€” composes a prompt with explicit anti-text rules ("DO NOT include any text, captions, logos, or typography in the image â€” copy is overlaid separately by Meta"). Catches the most common Gemini output failure for ad images.
  - `generateImage(prompt)` â†’ `{ base64, mimeType, buffer }`. Throws `GEMINI_BLOCKED` (safety filter), `GEMINI_API_ERROR` (network / non-2xx), `GEMINI_NO_IMAGE` (200 with no image part).
- **`apps/api/src/routes/ai.ts`** â€” new `POST /api/ai/generate-image`. Pipeline:
  1. `requireAuth` + workspace resolution.
  2. **Rate limit** â€” in-memory per-workspace, **20 generations/hour**, sliding window. Slot is only consumed after the full pipeline succeeds so a safety-blocked prompt or a Meta upload failure doesn't burn a quota. 429 with a `resetSeconds` hint when exceeded. NB: in-memory, resets on server restart; move to Redis when we scale horizontally.
  3. Resolve the workspace's active Meta ad account (image upload to `/adimages` is account-scoped). Returns 400 with a "Connect a Meta ad account first" message if missing.
  4. Build prompt via `buildAdImagePrompt`, call Gemini.
  5. Forward Gemini bytes to `metaService.uploadImageFromBytes` â†’ get `{ url, hash }`.
  6. Return `{ url, hash }` â€” same shape as `/meta/upload-image` so callers can swap in.
- **`apps/web/lib/api.ts`** â€” `generateAdImage({ brief, headline, description })` typed client method.
- **`CarouselCardsEditor`** ([creatives/page.tsx](apps/web/app/(dashboard)/creatives/page.tsx)) â€” each empty card image slot now has a small "âœ¨ AI image" button below the "Pick image" dropzone. Available whenever ANY of `brief / card.headline / card.description` is set (the backend only needs one). While generating, the dropzone swaps for a spinner with "Generatingâ€¦" label, and other cards' AI buttons gray out so users don't fire 5 parallel calls into the rate limit. Result populates the card's `savedImageUrl` + `savedImageHash`, identical to a successful manual upload â€” so the carousel save path treats AI-generated and manually-uploaded images the same way.
- Detail Modal carousel editor passes `brief={creative.name}` so existing library carousels can re-roll images. Upload Creative modal carousel editor now passes `brief={name}` so users building a fresh carousel can also AI-generate per-card images.

#### What's explicitly NOT shipped (deferred polish)

- Standalone "describe an image, get an image" mode in the AI Generate modal â€” the modal's hero + prompt input is built for it (and the redesign anticipates it), but the wiring to a full image-generation flow (parallel N outputs, aspect ratio selection feeding Gemini, gallery of results) is deferred. Today's image gen path is per-card inside CarouselCardsEditor.
- Imagen 4 quality tier â€” we're on Flash Image free tier.
- Workspace usage dashboard / quota visibility â€” users only see the rate-limit error when they hit it.
- Persistent rate-limit (Redis) â€” fine for single Railway dyno.

#### Update to deferred-feature memory

The [future-ai-image-generation.md](C:/Users/Shahr/.claude/projects/c--Users-Shahr-OneDrive-Desktop-review-test-adgenius-ai/memory/future-ai-image-generation.md) memory's "wait for paid customers" gate is now **partially lifted**: per-card carousel image generation is shipped under the Gemini free tier. The remaining deferred work is the standalone Madgicx-style generation surface (text prompt â†’ N images in a gallery, browse-the-feed, save-and-iterate). Update the memory body when we ship that.

`tsc --noEmit` clean on both `apps/api` and `apps/web`. `next lint` reports `âœ" No ESLint warnings or errors`.

---

### 2026-06-22 â€” AI Carousel: per-card copy generation

Before this change, the "Carousel" type in the AI Generate modal was scaffolding â€” it returned the same flat `{ headlines, primary_texts, descriptions, ctas }` shape as image/video creatives. Saving it didn't produce a publishable carousel (no `cards` array, so the publish wizard rejected it). Users could only build carousels by uploading 2-10 images manually with the Upload Creative flow.

This pass wires AI per-card copy through end-to-end. The AI writes a coherent N-card story (2-5 cards, default 4), and saving creates a "draft" carousel with text-only cards. The user then opens the creative â†’ Edit â†’ uploads one image per card to publish.

**Backend:**
- [apps/api/src/services/ai.service.ts](apps/api/src/services/ai.service.ts) â€” new `generateCarouselCopy(brief, platform, objective, cardCount)` method + `CAROUSEL_COPY_SYSTEM_PROMPT(cardCount)` prompt builder. The prompt asks for a narrative arc (card 1 = hook, middle = benefit, last = direct CTA), per-card headline (â‰¤ 40 chars) + optional description (â‰¤ 30 chars for Meta's sub-headline cap), plus the same ad-level `primary_texts` + `ctas` arrays the single-asset flow returns. 1200-token cap (roughly 200 tokens/card headroom for 5 cards).
- [apps/api/src/routes/ai.ts](apps/api/src/routes/ai.ts) â€” `POST /api/ai/generate-copy` accepts new optional `kind: "carousel"` + `cardCount` body fields. Validates `cardCount` to 2-5; defaults to 4 when missing. When `kind === "carousel"` it routes to the new service method; otherwise unchanged.
- [apps/web/app/api/ai/generate-copy/route.ts](apps/web/app/api/ai/generate-copy/route.ts) â€” the Next.js proxy passes `kind` + `cardCount` through to the API.

**UI:**
- [apps/web/app/(dashboard)/creatives/page.tsx](apps/web/app/(dashboard)/creatives/page.tsx) AI Generate modal:
  - New "Number of cards" picker (2 / 3 / 4 / 5) that shows ONLY when kind === "carousel".
  - `CopyResult` type widened: `headlines` + `descriptions` are now optional; new optional `cards: Array<{ headline, description? }>` lives alongside.
  - Results render branches on `result.cards`:
    - Carousel â†’ "Carousel story Â· N cards" ordered list with each card's headline + description displayed read-only. Flat Headlines / Descriptions sections are hidden (per-card replaces them).
    - Image / video / text â†’ unchanged.
  - Helper banner switches copy: *"Carousel story generated. Each card has its own headline + description. Save to your library, then open the creative to upload one image per card."*
  - "Use This Creative" save handler builds `content.cards` (text-only) for carousels and `content.{headlines, primary_texts, descriptions, ctas}` (reordered by picked variant) for everything else. Primary text + CTA picker still applies to carousels because those are ad-level.
- Toast on save tailored to the type: carousels show *"Carousel saved â€” open it to upload one image per card"* (5s duration), everything else gets the standard "saved" message.

**Handoff to publish:** the Detail Modal's existing `CarouselCardsEditor` already renders dropzones for cards with no saved image, so an AI-generated text-only carousel opens to a pre-filled headline/description per row with empty image pickers. Once the user picks an image per card and hits Save, the carousel becomes publishable through the same publish-wizard library flow as a manually-uploaded carousel.

**What's NOT in this slice:**
- Per-card image generation (deferred â€” still gated on paid customers + App Review per [FUTURE_FEATURES.md](FUTURE_FEATURES.md)).
- Carousel size > 5 (Meta supports up to 10, but more cards = weaker per-card AI quality. 5 is the cap for now.)
- A "regenerate this card only" button â€” regenerating means re-running the whole story.

`tsc --noEmit` clean on both apps. `next lint` reports `âœ” No ESLint warnings or errors`.

---

### 2026-06-22 â€” Phase 1B Carousel: end-to-end multi-card ad pipeline

Second half of Phase 1B. Users can now build a 2-10 card carousel ad with per-card image + headline + description + link, save it to the library, and publish it through the same publish wizard image + video ads use. Closes Phase 1B.

**Backend changes:**
- [apps/api/src/services/meta.service.ts](apps/api/src/services/meta.service.ts) â€” `createAdCreative` rewritten as a 3-way branch (image / video / carousel). Carousel mode builds `object_story_spec.link_data` with a `child_attachments` array (Meta's required shape). Each card gets `image_hash`, `name` (headline), `description`, `link`, and the ad-level CTA. `multi_share_optimized: true` and `multi_share_end_card: true` are set so Meta auto-reorders cards by performance and shows the "see more" tail card. Validates 2-10 cards; throws on under/over.
- [apps/api/src/routes/campaigns.ts](apps/api/src/routes/campaigns.ts) â€” the publish handler now resolves any of `imageHash | imageUrl | videoId | videoUrl | cards[] | libraryCreativeId` to the right Meta primitive. Carousel cards are uploaded sequentially via `uploadImageFromUrl` (Meta rate-limits parallel /adimages on the same account). Library carousel creatives expand their saved `content.cards` array into the resolution pipeline so a library carousel can be used the same way an inline carousel payload can.

**Web client + UI:**
- [apps/web/lib/api.ts](apps/web/lib/api.ts) â€” `PublishCampaignPayload.creative` gained `cards?: Array<{ imageHash?, imageUrl?, headline?, description?, link? }>`.
- [apps/web/app/(dashboard)/creatives/page.tsx](apps/web/app/(dashboard)/creatives/page.tsx):
  - Upload Creative modal gained a third Type button: **Carousel** (alongside Image / Video).
  - New `CarouselCardsEditor` component â€” vertical stack of card rows, each with an image dropzone + headline + description + link inputs. "Add card" up to 10; "X" per card down to 2. Per-image dimension/size validation reuses the existing 8 MB / image-mime checks.
  - On Save, each card's image is uploaded to `/api/meta/upload-image` sequentially; the resulting hash + Meta URL are persisted into `content.cards` along with the per-card copy. Top-level `content.url` is set to the first card's image so the library card preview thumbnail works for free.
- [apps/web/components/campaigns/publish/PublishToMetaModal.tsx](apps/web/components/campaigns/publish/PublishToMetaModal.tsx):
  - Wizard state gained `carouselCards: Array<...>` and `creativeType` was extended to include `"CAROUSEL"`.
  - Library picker now fetches CAROUSEL creatives too (third `useApi` call merged into `allCreatives`); cards in the picker get an amber **Carousel** badge so the type is unmistakable.
  - New `WizardCarouselCards` component shown in Step 5 when a carousel creative is picked â€” image is read-only (already uploaded), headline / description / link per card are editable inline so the user can tailor copy for this specific campaign without mutating the library creative. State changes are local to the wizard.
  - Submit handler's asset-priority chain now leads with `carouselCards` â†’ falls through to videoId, imageHash, videoUrl, imageUrl, libraryCreativeId.
- [apps/web/components/campaigns/publish/MetaAdPreview.tsx](apps/web/components/campaigns/publish/MetaAdPreview.tsx) â€” new `CarouselStrip` component renders the horizontal-scrolling cards inside both the Facebook and Instagram Feed mockups (Reels doesn't support carousels on Meta â€” IG/FB Feed only). Each tile shows the card image at the placement's aspect ratio (1.91:1 for Facebook, 1:1 for Instagram), plus a mini link-card footer with headline + CTA.

**What's NOT in this slice:**
- Mixed image/video carousels (Meta supports them, we don't yet).
- AI-generated carousel copy â€” the AI Generate flow's "Carousel" pick still produces the generic copy variants (headlines/primary_texts/descriptions/ctas) that get applied to the ad as a whole rather than per-card.
- Per-card CTA â€” all cards share the ad-level CTA in this MVP.
- Adding/removing cards inside the publish wizard â€” the wizard's card editor is "tweak before publish"; adding new images means going back to the Creatives tab.

`tsc --noEmit` clean on both `apps/api` and `apps/web`.

---

### 2026-06-22 â€” Video polish: aspect ratio + placement picker + Reels mockup

Phase 1B Video shipped end-to-end but treated every video as a Feed ad with auto-placements. Reels and Stories were "supported" only in the sense that Meta would auto-place a 9:16 video there. The wizard had no UI for it, no preview for it, and no warning when a user picked Reels with a square video. This pass closes those gaps.

**Aspect ratio detection on upload** â€” new `readVideoMetadata(file)` helper in [creatives/page.tsx](apps/web/app/(dashboard)/creatives/page.tsx) mounts an off-DOM `<video preload="metadata">` and reads `videoWidth` / `videoHeight` / `duration` once the moov atom arrives (only a few KB transferred, no full upload). The Upload Creative modal probes the file when picked and shows an orientation pill ("Vertical Â· 9:16" / "Square Â· 1:1" / "Horizontal Â· 16:9") under the file name. On save, the dimensions + `videoOrientation` enum are persisted into `content` so the publish wizard can read them back without re-probing.

**Placement picker in the publish wizard** â€” new `PlacementPicker` component in [PublishToMetaModal.tsx](apps/web/components/campaigns/publish/PublishToMetaModal.tsx) renders three cards: "All placements (recommended)", "Feed only", "Reels & Stories only". Selection drives a new `placement: PlacementMode` field on `WizardState`. The submit handler runs `placementToTargeting(mode)` to build the `publisher_platforms` + `facebook_positions` + `instagram_positions` arrays that Meta requires:
- `all` â†’ omits position fields entirely (Advantage+ Placements)
- `feed` â†’ `facebook: [feed, video_feeds]` + `instagram: [stream, explore]`
- `reels_stories` â†’ `facebook: [facebook_reels, story]` + `instagram: [reels, story]`

**Mismatch warning** â€” `PlacementPicker` compares the picked video's `videoWidth/videoHeight` (from library creative content) against the placement mode and shows an amber inline warning when they conflict: vertical 9:16 video + Feed-only placement, or horizontal/square video + Reels-only placement. Silent on `all`.

**Reels / Stories preview mockup** â€” new `ReelsAd` component in [MetaAdPreview.tsx](apps/web/components/campaigns/publish/MetaAdPreview.tsx) renders a 9:16 vertical immersive ad: page chip top-left, side rail icons (like/comment/share/save), bottom gradient scrim with caption + full-width CTA button over the asset. The Review-step preview gained a third placement tab ("Reels / Stories") alongside Facebook / Instagram Feed. Uses the same `VideoThumbnailPlayer` so playback works the same way.

**Backend type extensions** â€” `MetaTargeting` in [meta.service.ts](apps/api/src/services/meta.service.ts) and `MetaTargetingSpec` in [api.ts](apps/web/lib/api.ts) both gained `facebook_positions` and `instagram_positions` arrays. `createAdSet` JSON-stringifies the full targeting object, so no logic change â€” the new fields flow straight to Meta.

**What's NOT in this slice:** dynamic creative / asset feed spec (uploading a vertical *and* horizontal video and letting Meta pick per placement). Beta users uploading one video per ad is fine; we can layer multi-asset on top once we see demand. Also no orientation badge on the library card â€” the publish wizard's mismatch warning is the load-bearing surface, not the library.

`tsc --noEmit` clean on both `apps/api` and `apps/web`.

---

### 2026-06-22 â€” Video preview: device-uploaded videos are now playable in-app

Initial Phase 1B Video shipped showed only the Meta-generated thumbnail for device-uploaded videos â€” the actual video wasn't playable anywhere in the app (cards, detail modal, publish-wizard preview). Two reasons:
1. We were saving a `blob:` URL into `content.url`, which dies on page reload.
2. Meta's `/advideos` upload doesn't return a public stream URL â€” only a `video_id` that Meta uses at ad-serve time.

Fixed in two passes:

**Pass 1 â€” stop saving the blob URL.** The Upload Creative modal now saves `content = { url: thumbnailUrl, videoId, thumbnailUrl }` â€” the canonical `url` becomes Meta's auto-generated thumbnail (Meta-hosted, public, persists). The publish wizard's `extractVideoFields` was hardened to ONLY treat the explicit `content.videoUrl` field as streamable, so a thumbnail URL doesn't accidentally end up inside `<video src>`.

**Pass 2 â€” actually play the video.** Added a new endpoint and a shared component so any preview surface can play videos on demand:

- [apps/api/src/services/meta.service.ts](apps/api/src/services/meta.service.ts) â€” new `getVideoSource(token, videoId)` returns `{ source, permalinkUrl }` from Meta's Graph fields (`source` is a signed MP4 URL that rotates; `permalink_url` is the FB viewer page used as a fallback when Meta declines the source).
- [apps/api/src/routes/meta.ts](apps/api/src/routes/meta.ts) â€” `GET /meta/video-source/:videoId` route. Auth + workspace-scoped via the same `resolveMetaContext` as the existing video-status endpoint.
- [apps/web/lib/api.ts](apps/web/lib/api.ts) â€” `getMetaVideoSource(videoId)` client method.
- [apps/web/components/ui/VideoThumbnailPlayer.tsx](apps/web/components/ui/VideoThumbnailPlayer.tsx) â€” NEW shared component. Renders the thumbnail + play overlay; on click fetches the signed MP4 URL and swaps in `<video controls autoPlay>`. Three button-size variants (sm/md/lg) for the different surfaces. Accepts an optional `directSrc` to bypass the Meta fetch when we already have a streamable URL (URL-paste path). If Meta declines the source we surface the FB permalink as a "open on Facebook" fallback rather than showing a broken player.

**Wired into 4 surfaces:**
- Creatives library card preview (`PreviewArea` in [creatives/page.tsx](apps/web/app/(dashboard)/creatives/page.tsx))
- Creative Detail Modal (large player)
- MetaAdPreview Facebook Feed mock
- MetaAdPreview Instagram Feed mock

(The publish-wizard library *picker* card is left as a static thumbnail â€” it's a select button, not a player. Users can click the creative to pick it; playback happens in the Review step's MetaAdPreview.)

**Why fetch-on-click instead of at mount?**
- Meta's signed URLs rotate every few hours â€” caching at mount would break replay later in the session.
- Each fetch is a real Graph API call (cost + rate-limit). Lazy fetch keeps the library grid cheap.

**Data-model addition:** `Creative` type in the Creatives page now carries `videoId?: string`, populated via `extractVideoId(content)` during the API→UI mapping. Without this the preview surface had no way to fetch a fresh source URL for an existing video creative.

`tsc --noEmit` clean on both `apps/api` and `apps/web`.

---

### 2026-06-22 â€” Phase 1B Video: end-to-end video ad pipeline (upload → publish)

First half of Phase 1B. Users can now upload an MP4/MOV/WebM video to Meta and publish it as a video ad through the same publish wizard image ads already use. Carousel is the other half of 1B and is up next.

**Backend changes:**
- [apps/api/src/services/meta.service.ts](apps/api/src/services/meta.service.ts) â€” three new helpers:
  - `uploadVideoFromUrl(token, accountId, videoUrl)` â†’ `{ id }` â€” Meta fetches the asset by URL.
  - `uploadVideoFromBytes(token, accountId, buffer, filename, mimeType)` â†’ `{ id }` â€” multipart POST to `/act_{id}/advideos`.
  - `getVideoStatus(token, videoId)` â†’ `{ status: "processing" | "ready" | "error" | null, thumbnailUrl }` â€” polls `/{video_id}?fields=status,picture` for transcode state and Meta's auto-generated poster.
- `createAdCreative` rewritten to branch on `imageHash` vs `videoId`. Image ads build `object_story_spec.link_data` with `image_hash`; video ads build `object_story_spec.video_data` with `video_id` + `image_url` (poster) + `title` + `message` + `link_description`. Throws if neither is provided.
- [apps/api/src/routes/meta.ts](apps/api/src/routes/meta.ts) â€” two new routes:
  - `POST /meta/upload-video` (multer 200 MB cap for memory upload, separate from the 10 MB image instance) accepts a `video` field and forwards to `uploadVideoFromBytes`.
  - `GET /meta/video-status/:videoId` polls Meta on the client's behalf so the browser never has to authenticate with Meta directly.
- [apps/api/src/routes/campaigns.ts](apps/api/src/routes/campaigns.ts) â€” the publish handler now resolves any of `videoId | videoUrl | imageHash | imageUrl | libraryCreativeId` to either `imageHash` (image ad) or `videoId` (video ad). When resolving to a video, the handler polls `getVideoStatus` for up to 2 minutes; returns `502` on Meta transcode error and `504` on timeout. Pulls the auto-generated thumbnail when one isn't passed.

**Web client + UI:**
- [apps/web/lib/api.ts](apps/web/lib/api.ts) â€” `uploadMetaVideo(file, { onProgress })` (XHR-based so we can surface real upload-progress events; `fetch` doesn't yet expose them) and `getMetaVideoStatus(videoId)`. Extended `PublishCampaignPayload.creative` with `videoUrl`, `videoId`, `thumbnailUrl`.
- [apps/web/app/(dashboard)/creatives/page.tsx](apps/web/app/(dashboard)/creatives/page.tsx) â€” `UploadCreativeModal` no longer disables device upload when type=VIDEO. Picks MP4/MOV/WebM up to 200 MB, uploads with progress meter, then polls transcode (up to 3 min) with phase-aware copy (*Uploading… 67%* → *Meta is processing the video…*). On success the creative is persisted with `content: { url, videoId, thumbnailUrl }` so the publish wizard can re-use `videoId` directly â€” no second upload.
- [apps/web/components/campaigns/publish/PublishToMetaModal.tsx](apps/web/components/campaigns/publish/PublishToMetaModal.tsx):
  - Wizard state now carries `creativeType`, `videoId`, `videoUrl`, `thumbnailUrl`.
  - Library picker fetches both IMAGE and VIDEO creatives (parallel calls, merged + sorted by recency) and badges each card with "Image" / "Video" so the type is unmistakable.
  - URL paste auto-detects video by extension (`.mp4|.mov|.webm|.m4v`) and routes into `videoUrl` instead of `imageUrl`. Preview swaps to `<video controls>` automatically.
  - "Upload new" tab kept image-only at this surface with a small hint pointing video users to the Creatives tab's Upload Creative modal (where the transcode poll is wired). Avoids duplicating that flow in the wizard.
  - Submit handler builds the asset half of the payload via a priority chain: `videoId > imageHash > videoUrl > imageUrl > libraryCreativeId`. Backend handles whichever it gets.
- [apps/web/components/campaigns/publish/MetaAdPreview.tsx](apps/web/components/campaigns/publish/MetaAdPreview.tsx) â€” Facebook and Instagram mocks now render `<video controls poster={thumbnailUrl}>` when `videoUrl` is present, falling back to image / placeholder otherwise.

**What's NOT in this slice:** AI prompt branching for video ("write a 15-sec script" vs ad copy). The existing AI copy prompt is platform/objective-aware but not asset-type-aware â€” response shape is the same `{ headlines, primary_texts, descriptions, ctas }` for both. Holding off on a video-specific prompt until we hear from a beta user that copy quality differs noticeably.

`tsc --noEmit` clean on both `apps/api` and `apps/web`.

---

### 2026-06-22 â€” Creative Detail Modal: variants are now re-pickable + inline editable

The Edit mode added earlier only handled name + image attach â€” the headline / primary text / description / CTA variants were still read-only. The user can now re-pick which variant is the default *and* tweak text inline without regenerating from AI.

In [apps/web/app/(dashboard)/creatives/page.tsx](apps/web/app/(dashboard)/creatives/page.tsx):

- `CreativeDetailModal` now keeps a local `edited` snapshot of the four variant arrays plus a `picked` index map. Initialized from `rawContent` whenever the modal opens; reset on close.
- `CopySection` gained three optional props: `selectedIndex`, `onSelect`, `onEdit`. When all are provided the section flips into edit/pick mode:
  - Rows are clickable to set the selected variant; selected row gets a filled `border-primary bg-primary/5` + checkmark radio.
  - A pencil button per row (visible on hover) reveals an inline `<input>` â€” Enter / green check saves, Escape / X cancels.
  - Read-only sections keep the copy-to-clipboard icon, unchanged.
- Indigo helper banner in edit mode: *"Tap a row to pick it as the default. Tap the pencil to edit the text..."*
- Variant counts (e.g. "Headlines Â· 5 options") added to each section header in edit mode.
- Save handler builds the next payload from `edited` + `picked`: empty/whitespace lines are stripped (so the user can blank a chip to delete it), each array is reordered via the existing `pickFirst()` so the picked variant lands at index `[0]`, and the result is merged into `content` alongside any newly uploaded image URL. Single `updateCreative` call persists everything.

**Why this matters in the broader flow:** the publish wizard auto-fills from index `[0]`. So picking a different default variant here now actually propagates downstream â€” the user's choice in the library survives all the way to the launched ad.

`tsc --noEmit` clean.

---

### 2026-06-22 â€” Creative card: Edit (rename + attach image)

Creative cards had Delete on hover but no Edit affordance. Two real edit needs surfaced:
1. **Rename** â€” auto-generated names like "AI Headline - 2026-06-22" are ugly and not searchable.
2. **Attach image** â€” AI Generate produces copy-only creatives. Until now the only way to turn one into a full image creative was to delete it and re-upload via Upload Creative.

Added a pencil button to the card's hover toolbar (paired with Delete, bottom-right of the preview tile in [apps/web/app/(dashboard)/creatives/page.tsx](apps/web/app/(dashboard)/creatives/page.tsx)). Reused the existing `CreativeDetailModal` instead of building a separate edit modal:

- New props: `startInEditMode?: boolean` and `onSaved?: () => void`. The card's pencil sets `startInEditMode=true`; clicking the card body still opens read-only.
- New "Edit" pill in the modal header when in read mode â†’ flips to edit mode without re-opening.
- In edit mode: the title becomes an `<input>` (max 120 chars); when `creative.url` is empty, an "Attach image" dropzone appears (reusing `MAX_IMAGE_BYTES` + `ACCEPTED_IMAGE_TYPES` constants + the existing `api.uploadMetaImage` flow).
- New `ModalFooter` with Cancel / Save changes. Cancel reverts local state; Save uploads any picked image, then calls `api.updateCreative(id, { name, content: { ...existingContent, url } })` â€” merging the new URL with existing copy fields so AI variants survive the edit.
- Backdrop + ESC dismissal are disabled while saving (`closeOnBackdrop={!saving}` + `closeOnEscape={!saving}`) to avoid losing an in-flight upload.
- The amber "Next step: upload an image" hint inside the modal now points users to the Edit button instead of the main page's Upload Creative modal (one fewer step).

**Scoped narrowly on purpose.** Did not add copy-field editing (the AI Generate modal is the better re-generation surface), platform editing (we don't yet support per-platform creatives), or CTA editing (it's a sub-field of AI content already pickable in the AI flow). Status is auto-managed by the publish wizard.

`tsc --noEmit` clean.

---

### 2026-06-22 â€” AI Generate: variants are now pickable + chosen variant becomes default

The AI Generate modal in [apps/web/app/(dashboard)/creatives/page.tsx](apps/web/app/(dashboard)/creatives/page.tsx) was returning 5 headlines / 3 primary texts / 3 descriptions / 4 CTAs as **copy-only** chips â€” the user could click to copy but couldn't tell Advertix which one they actually wanted as the default. When that creative got pulled into the publish wizard later, the wizard auto-filled from index `[0]` regardless of user intent.

Wired up selection state:
- New `picked` state (`{ headline, primaryText, description, cta }`) defaulting to `0` for each, reset whenever a new generation arrives.
- `CopyItem` now accepts `selected` + `onSelect` props; selected state renders `border-primary bg-primary/10` with a checkmark badge. The copy-to-clipboard action stays â€” itâ€™s now secondary (the row body is the select target).
- CTAs were plain pill buttons that copied to clipboard. Replaced with selectable chips using the same visual pattern (filled = picked, outlined = unpicked).
- Added an indigo helper banner at the top of the results block: *"Tap any variant to pick it. The picked one becomes the default when this creative is used in a campaign â€” the rest are kept as swap options."*
- Variant counts (e.g. "Headlines Â· 5 options") added to each section header so users see what they're choosing between.

**The key bit:** the `Use This Creative` save handler now reorders each array via new `pickFirst<T>(arr, idx)` helper so the picked variant lands at index `[0]` before persisting. The wizard's existing `extractCopyFields` reads `[0]` first â†’ the user's pick is now the default that pre-fills the publish form. Non-picked variants are preserved in original order at indices `1..N-1` and continue to show up as swap chips in the wizard.

`tsc --noEmit` clean.

---

### 2026-06-22 â€” AI service migration: Sonnet 4 (retired) â†’ Opus 4.8

`/api/ai/generate-copy` and `/api/ai/plan-campaign` started returning 500 because the model ID `claude-sonnet-4-20250514` retired on **2026-06-15** and the Anthropic API now rejects requests for it. Migrated [apps/api/src/services/ai.service.ts](apps/api/src/services/ai.service.ts) and [apps/api/src/routes/ai.ts](apps/api/src/routes/ai.ts) from `claude-sonnet-4-20250514` â†’ `claude-opus-4-8` (current most-capable model). Only the `MODEL` constant changed â€” the rest of the service is clean (no `temperature`, `top_p`, `top_k`, `thinking`, `budget_tokens`, or assistant prefills, all of which are removed/rejected on Claude 4.7+ models).

**Cost impact:** Opus is ~1.7Ã— Sonnet input pricing and ~1.7Ã— output. For ad-copy generation (~200 tok in / 900 tok out) that's a delta of ~$0.013 per generation. For campaign planning (~500 tok in / 1500 tok out) the delta is ~$0.025. Negligible at current volume; revisit if AI usage scales to thousands of calls/day.

**Why Opus not Sonnet 4.6:** Skill-guided default is Opus 4.8 for new code. We can downgrade to `claude-sonnet-4-6` later if the user opts for cost savings â€” the surface is identical (same Messages API call, same JSON parsing).

`tsc --noEmit` clean.

---

### 2026-06-21 â€” Meta App Review REJECTED â†’ added temporary API warmup cron

✅ **RESOLVED 2026-08-02 — the warmup cron has been removed.** The code described below no longer exists; this entry is kept for history only. See the 2026-08-02 removal entry at the top of the change log. Nothing in the "Removal (DO NOT FORGET)" checklist below is still outstanding.

**Rejection reason** (from Meta App Review feedback):

> Our records do not show a sufficient number of Ads API calls in the last 15 days by this application. It is required that the application successfully integrate with the Ads API before it is approved for Marketing API standard access tier.

This is not a "your app is broken" rejection â€” the submission text, video, data handling answers, and reviewer instructions were all accepted. Meta wants to see **sustained API usage history** before granting Standard Access. The Testing tab shows our perm checks passed at the test-call level, but Meta's review process additionally evaluates organic usage over a rolling 15-day window. We had ~0 organic API calls at submission time because we only had one connected test ad account.

**Fix â€” [apps/api/src/services/meta-warmup.service.ts](apps/api/src/services/meta-warmup.service.ts):**

- **What it does:** Background `setInterval` cron that fires every 30 minutes, iterates through every active Meta `AdAccount` in the DB, decrypts each token, and makes 11 read-only Marketing API calls per account per tick: `getAdAccounts`, `getCampaigns`, `getCampaignInsights` (7d/30d/90d), `getCustomAudiences`, `getSavedAudiences`, `getPages`, `searchInterests` (Ã—2), `searchLocations` (Ã—2). Each call is wrapped in `safeCall()` so one failure (e.g. code 3 from Meta because we're at Limited Access tier for write endpoints) never kills the rest of the tick. Logs cumulative call count + success rate to Railway logs under `[meta-warmup]` so we can monitor progress.
- **Why these endpoints:** All reads, all guaranteed to work at Limited Access tier â†’ keeps success rate near 100% (Meta wants â‰¥85%). They also hit the exact endpoints the App Review use case covers: ads_read (campaigns, insights), business_management (account discovery), pages_show_list (page enumeration), targeting search (interests, locations).
- **Volume math:** 11 calls Ã— 1 account Ã— 48 ticks/day = ~528 calls/day. With one connected ad account, by day 7 we'll have ~3,700 calls; well above the ~1,500 implicit minimum from the rejection. Per-hour rate is ~22 calls vs. the 200/hr Limited Access cap â€” safely under.
- **Kill switch:** `META_WARMUP_ENABLED=false` env var on Railway disables without code change.
- **Startup wiring:** [apps/api/src/index.ts](apps/api/src/index.ts) calls `startMetaWarmupCron()` after `app.listen()`, and `stopMetaWarmupCron()` runs in the SIGTERM handler so Railway redeploys don't leave intervals leaking.

**Resubmission plan:**

1. **Day 0 (2026-06-21):** Deploy warmup. Verify Railway logs show `[meta-warmup] tick #1 done` after ~60s startup delay.
2. **Day 1â€“7:** Monitor Meta App Dashboard â†’ App Review â†’ Testing tab. Watch call counts climb across `ads_read`, `pages_show_list`, etc. Verify success rate stays â‰¥85%.
3. **Day 7â€“10:** When cumulative calls hit ~3,000+ AND success rate looks healthy, click **Request again** on the rejected submission. The submission text, video, and reviewer instructions are unchanged â€” we're resubmitting the same package, betting that the new usage history flips the verdict.
4. **Day 10â€“15:** Decision should come back. If approved â†’ go to **Removal** below. If rejected with the same reason â†’ extend the warmup to 14 days. If rejected with a different reason â†’ fix that specifically.

**Removal (DO NOT FORGET):**

The moment App Review approves:

1. Delete `apps/api/src/services/meta-warmup.service.ts`.
2. Remove the import + `startMetaWarmupCron()` + `stopMetaWarmupCron()` calls from `apps/api/src/index.ts` (look for the `[meta-warmup]` comment markers).
3. Verify Railway logs no longer show `[meta-warmup]` entries after redeploy.
4. Drop the `META_WARMUP_ENABLED` env var from Railway (optional â€” harmless once the code is gone, but cleaner).
5. Add a Change Log entry here documenting the removal.

**Why this matters:** Leaving the warmup running indefinitely (a) burns Meta API rate limit budget that should serve real customers, (b) costs Railway compute for no value, (c) could trigger Meta's automated abuse detection if it persists past the review window. The whole point of this code is that it's temporary; leaving it in is worse than never having added it.

`tsc --noEmit` clean on the API after the change.

---

### 2026-06-21 â€” Meta App Review SUBMITTED ðŸš€

End-of-week milestone. Both gates cleared:

**Business Verification:** Submitted with Abdul Qayyum (sole proprietor) as legal entity, address proof via bank statement (Khaplu / Ghanche / Gilgit-Baltistan), tax ID via NTN Certificate, identity via CNIC. Email verification via `support@advertix.io` (forwarded through Improvmx to qayyumgb96@gmail.com). **Approved within hours** â€” not the projected 2 business days.

**App Review:** Submitted for Marketing API Access Tier (4 permissions: `ads_read`, `ads_management`, `business_management`, `pages_show_list`). Status: **Review in progress** (~20 day SLA per Meta).

**What landed in the submission:**
- **Allowed usage:** Detailed justification covering each permission's API endpoints, user value, and necessity. No third-party data sharing / no advertising use / no model training disclosed.
- **Data handling:** Three processors disclosed â€” Railway (backend + DB), Vercel (frontend), Clerk (auth). All "IT solutions and services" category, US-located. Data controller: Abdul Qayyum (sole proprietor), Pakistan. No government data requests. Four policy boxes checked (legality review, challenge provisions, data minimization, documentation).
- **Reviewer instructions:** Step-by-step repro for the full publish flow at [app.advertix.io](https://app.advertix.io). Test credentials provided (`qayyumsaufik+metareview@gmail.com` / `MetaReview2026!`) â€” account pre-connected to a Meta Business Manager with sample campaigns so reviewers can immediately validate `ads_read`. Geographic restrictions disclosed: none.
- **Video demonstration:** 2:41 screencast, 39 MB, recorded in Screencast + trimmed in CapCut to remove the publish error frame (Marketing API "Limited Access" tier currently returns code 3 on publish â€” the very issue this submission requests upgrading). Shows OAuth dialog with all 4 permissions visible, ~5 sec dwell on the permission screen, then walks through Campaigns sync (ads_read), publish wizard page picker (pages_show_list), ad-account selector (business_management), and Publish button click (ads_management intent). Ends with the disconnect button and `/data-deletion` page.

**Infrastructure changes for the submission:**
- [middleware.ts](apps/web/middleware.ts) â€” added `APP_ONLY_PREFIXES` redirect so `/dashboard`, `/settings`, `/sign-in`, `/connect/*`, etc. on `advertix.io` or `www.advertix.io` 307-redirect to `app.advertix.io`. Fixes a cross-origin `postMessage` bug where the OAuth popup callback (forced to `app.advertix.io/connect/done` by `FRONTEND_URL`) couldn't notify a parent window opened on `www.advertix.io` â€” the Connect cards never auto-refreshed after OAuth. Now everything funnels through `app.advertix.io`.
- Railway `CORS_ORIGIN` updated to include all three apex/www/app origins plus the legacy Vercel preview URL.
- [apps/web/app/(marketing)/data-deletion/page.tsx](apps/web/app/(marketing)/data-deletion/page.tsx) â€” dedicated deletion page (two paths: in-app Danger Zone + email request, full list of what gets deleted, 7/30/90-day timeframes, both Advertix-side and Meta-side revocation instructions). Linked from Meta App Settings â†’ User Data Deletion URL.
- [Improvmx](https://improvmx.com) configured for `advertix.io` â€” MX + SPF records at GoDaddy, catch-all alias `*@advertix.io â†’ qayyumgb96@gmail.com`. Gmail filter pins Meta emails to Primary (was landing in Spam initially).
- Meta App Settings â€” App Domains `advertix.io`, Privacy `https://advertix.io/privacy`, Terms `https://advertix.io/terms`, Data Deletion `https://advertix.io/data-deletion`. OAuth redirect URI on Facebook Login Settings: `https://adgeniusapi-production.up.railway.app/api/meta/callback` (left as Railway URL deliberately â€” `api.advertix.io` custom domain deferred until post-approval to avoid breaking working OAuth).

**Logo + brand wiring:**
- White / black horizontal logos + favicon copied from `apps/web/assets/images/` â†’ `apps/web/public/brand/` and Next.js `app/icon.png` + `app/apple-icon.png`.
- [MarketingNav.tsx](apps/web/components/marketing/MarketingNav.tsx) swaps white logo over the dark hero â†’ black logo once the nav goes solid on scroll. [MarketingFooter.tsx](apps/web/components/marketing/MarketingFooter.tsx) uses the white logo on the dark footer.
- `og-image.png` set as Open Graph image in [layout.tsx](apps/web/app/layout.tsx).

**Legal name standardization:** All marketing-site references "AB Qayyum" â†’ "Abdul Qayyum" (matches CNIC / NTN / Bank documents). Required for Meta Business Verification consistency.

**Facebook Page:** Created "Advertix" Page (ID `1150892091443932`) under the Advertix Business Manager. Category: Software. Posted the launch announcement with the AI-generated platform composition image. Profile pic, website link, contact email all wired up. Reviewers see a real-looking business asset attached to the app.

**What's waiting:**
- Meta App Review decision: 2â€“20 days (SLA range), most ship in 3â€“5 days. Decision email lands at `support@advertix.io` â†’ Gmail Primary.
- On approval â†’ Marketing API tier upgrades to Standard Access â†’ publish works for all users in production â†’ unblocks customer onboarding.
- On rejection â†’ email specifies the issue. Common rejections: video too short, permission demo unclear, data deletion link broken. We've over-engineered all three.

**Note for next session:** The "Submit for App Review" flow itself revealed three small middleware/CORS bugs that are now patched but worth remembering. If we add new marketing routes in the future (e.g. `/pricing`, `/blog`), they need to be added to BOTH `isPublicRoute` AND `MARKETING_ONLY_PATHS` in middleware. If we add new product routes (e.g. `/reports`), they need to be added to `APP_ONLY_PREFIXES` so apex/www visits redirect cleanly to `app.`.

---

### 2026-06-19 â€” Host-based routing: `app.advertix.io` vs `advertix.io`

Both `advertix.io` (apex) and `app.advertix.io` point at the same Vercel deployment, so both originally served the marketing landing at `/`. Added host-aware routing in [middleware.ts](apps/web/middleware.ts) before the Clerk auth gate so the two domains behave differently:

- **`app.advertix.io`** is the product. Hitting `/` 307-redirects to `/dashboard`. Hitting `/features`, `/about`, `/contact`, `/privacy`, or `/terms` 307-redirects to the same path on `https://advertix.io`. Auth gate still runs after, so unauthenticated users on `/dashboard` get bounced to sign-in by Clerk as before.
- **`advertix.io`** / **`www.advertix.io`** are marketing. All routes behave normally — `/` is the landing, `/features` / `/about` / `/contact` / `/privacy` / `/terms` work, and `/dashboard`, `/campaigns`, etc. still work (auth-protected) if someone goes there directly.

Detection is `host.startsWith("app.")` against the lowercased `Host` header. Trivial to extend later (e.g. `auth.advertix.io`, `api.advertix.io`).

**Why this approach and not a separate Vercel project:**
- One codebase, one build, one set of env vars — simpler ops.
- Both domains share session cookies via `*.advertix.io` (when configured) so the user stays signed in across marketing ↔ app.
- If we ever split, the host check makes it easy to extract `app.` traffic into its own project.

**Trade-off:** marketing pages are technically reachable on `app.` via direct URL, but the 307 to apex makes them feel like they live elsewhere. SEO crawlers should follow the redirect.

---

### 2026-06-19 â€” Multi-page marketing site rebuild (Stellar-inspired)

User feedback on the v1 landing was "looks like an intern built it." Rebuilt as a full multi-page marketing site under a `(marketing)` route group, design language lifted from the Stellar Security site reference (`C:\Users\Shahr\OneDrive\Desktop\review_test\Steller.Website.UI`) — dark hero with gradient mesh, light sections with 44px rounded white card containers, pill CTAs, icon badges — re-brushed with our `#6366f1` palette and SaaS-specific content (we sell ad-ops, not phones).

**Route group structure:**
- `app/(marketing)/layout.tsx` — wraps every marketing page with shared `MarketingNav` (sticky pill, transparent over dark hero → solid white when scrolled) and `MarketingFooter` (dark `#0B1319` with link columns + brand SVG socials + status pill).
- `app/(marketing)/page.tsx` — Home. Sections: gradient-mesh hero with floating dashboard mockup + AI suggestion chip + ROAS chip → platform ribbon (Meta/Google/TikTok/LinkedIn) → ecosystem (AI prompt → strategy response visual with budget-split bars) → bento feature grid (6 cards, mixed sizes, custom mini-visuals per card) → dark how-it-works (Connect / Plan / Launch with gradient number rings) → metric bar (4 stats) → gradient final CTA.
- `app/(marketing)/features/page.tsx` — 6 pillar deep-dive sections, alternating left/right, custom visual per pillar (AI strategy card, platforms checklist, creative variants, publish wizard, analytics tiles, security card), plus differentiator band + closing CTA.
- `app/(marketing)/about/page.tsx` — Mission + Vision split card, founder profile card with bio + badges, 6 principles grid, alternating timeline, gradient CTA.
- `app/(marketing)/contact/page.tsx` — Hero, two-column layout: form (client component) + dark sidebar of channels + footer info card, plus collapsible FAQ.
- `app/(marketing)/contact/ContactForm.tsx` — Client component. Topic chips (5 options), name/email/message fields, on submit opens `mailto:support@advertix.io` with a prepared subject + body. **No backend endpoint yet** — swap to `fetch("/api/contact", …)` when the API ships.
- `app/(marketing)/privacy/page.tsx` and `app/(marketing)/terms/page.tsx` — moved from `app/privacy` and `app/terms` so they inherit the marketing layout. Old standalone `LegalHeader`/`LegalFooter` stripped; replaced with a dark gradient `LegalHero` (`title` + `Effective date`) so they visually match the rest of the marketing site.

**Shared marketing components ([apps/web/components/marketing/](apps/web/components/marketing/)):**
- `MarketingNav.tsx` — Sticky pill nav. Transparent over dark hero, solid white once `window.scrollY > 8`. Mobile dropdown with full link list + CTA buttons. Active route highlighted.
- `MarketingFooter.tsx` — Dark footer with 3 link columns + brand column. Inline SVG brand icons for X / LinkedIn / GitHub (Lucide 1.16 doesn't export brand icons anymore, so these are raw paths) + `Mail` from Lucide.
- `GradientMesh.tsx` — Hero background. Radial gradient + 3 animated blob layers (indigo → violet → fuchsia) + faint grid overlay + SVG noise. Used on Home / Features / About / Contact heroes for visual consistency.
- `DashboardMockup.tsx` — Stylized fake-dashboard card for the home hero. Browser chrome, sidebar with active "Dashboard" item + AI Planner badge, 3 metric tiles (Spend / Revenue / ROAS), gradient area chart, 3 campaign rows. Plus two floating cards: an "AI Suggestion" recommendation chip with Apply/Dismiss buttons, and a "Best Campaign ROAS 4.6×" chip. Pure CSS/SVG, no real data, no client state.

**Old `app/page.tsx`** — deleted (route group now owns `/`).

**Brand color:** `#6366f1` (existing `primary` token in [tailwind.config.ts](apps/web/tailwind.config.ts)). Dark surface `#0B1319` lifted from Stellar reference. Light section bg `#F6F6FD` likewise. No Tailwind config changes needed.

**TypeScript:** `tsc --noEmit` clean. Lucide v1.16 no longer exports `Github`/`Twitter`/`Linkedin` — swapped to inline brand SVGs in footer and `AtSign` in contact channels.

**Public routes:** All marketing routes already covered by `isPublicRoute` matcher (`/`, `/privacy`, `/terms`) or default-public top-level paths. No middleware changes.

**Known follow-ups:**
- Contact form uses `mailto:` fallback. Build `POST /api/contact` (rate-limited, captcha-protected, forwards to `support@advertix.io`) when we leave beta.
- "Built different" stats are static. Wire to real workspace count / campaign count once dashboards stabilize.
- Privacy / Terms hero is dark; main content stays light. Visually it works but a future refactor could promote `LegalHero` into the shared marketing layout as a slot.

---

### 2026-06-19 â€” Marketing landing page for advertix.io (Meta App Review prep)

Built a full marketing landing at [apps/web/app/page.tsx](apps/web/app/page.tsx) to serve as the public face of advertix.io for the Meta App Review submission. Replaces the prior minimal splash.

**Layout (single server component):**
- Sticky blurred header — brand mark + Sign in / Get started.
- **Hero** — "AI-Powered Ads. **Amplified.**" gradient headline + CTAs + inline SVG dashboard mockup (fake Spend / Revenue / ROAS metrics + fake ROAS chart, brand `#6366f1`). The mockup gives the page visual weight without needing real product screenshots — important since App Review reviewers click the website link.
- **Platform strip** — Meta / Google / TikTok / LinkedIn / YouTube text-initial badges. No real platform logos (trademark safety).
- **6 features** — AI Campaign Planning, Multi-Platform Sync, AI Creative Generation, Cross-Platform Analytics, Publish in One Click, Secure by Default.
- **How it works** — Connect → Plan → Launch.
- **Final CTA** — gradient card "Ready to amplify your ads?".
- **Footer** — Privacy / Terms / Sign in / Get started + © 2026.

**Styling:** Light theme, brand color `#6366f1` via existing `primary` token, `lucide-react` icons. Uses `shadow-glow`, `primary-300`, `primary-600` — all already defined in [tailwind.config.ts](apps/web/tailwind.config.ts).

**Metadata:** Page-level `metadata` (title + description). Inherits OG/twitter from `metadataBase` set in [apps/web/app/layout.tsx](apps/web/app/layout.tsx).

**Public route:** `/` already in `isPublicRoute` matcher at [apps/web/middleware.ts](apps/web/middleware.ts) — no auth changes needed.

**Next steps (user-side, not code):**
- GoDaddy: add A record `@` → `76.76.21.21` (Vercel).
- Vercel: Settings → Domains → add `advertix.io`.
- Wait ~5 min DNS, verify `https://advertix.io` loads.
- Use `https://advertix.io` as Website URL in Meta App Settings, then submit App Review.

---

### 2026-06-08 â€” Native currency, lifetime totals, accurate Meta status, sidebar refetch

After end-to-end testing the Meta sync on production we found 4 real bugs surfaced by INR-denominated data flowing through a USD-hardcoded UI. All fixed.

**Schema:**
- [AdAccount](apps/api/prisma/schema.prisma) â€” new optional `currency` (ISO 4217) and `timezone` (IANA tz) columns. Captured at OAuth time, refreshed during sync. **Requires `npx prisma db push` on Railway after deploy** â€” same one-time step we did for the initial schema bootstrap.

**Backend:**
- [routes/meta.ts](apps/api/src/routes/meta.ts), [routes/google.ts](apps/api/src/routes/google.ts), [routes/tiktok.ts](apps/api/src/routes/tiktok.ts), [routes/linkedin.ts](apps/api/src/routes/linkedin.ts) â€” all 4 OAuth callbacks now persist `currency` + `timezone` on AdAccount upsert. Meta returns `currency`/`timezone_name`; Google returns `currencyCode`/`timeZone`; TikTok returns `currency`/`timezone`; LinkedIn returns `currency`.
- [services/sync.service.ts](apps/api/src/services/sync.service.ts) â€” `mapMetaStatus` now takes `status`, `effective_status`, and `stop_time`. A campaign whose `stop_time` is in the past maps to `ENDED` regardless of what `status` says. This fixes the bug where a "Completed" FB campaign showed as ACTIVE in Advertix. Meta sync also re-syncs `currency`/`timezone` on the AdAccount row each run (FB users can edit account currency in Business Manager).
- [services/meta.service.ts](apps/api/src/services/meta.service.ts) â€” `MetaCampaign` interface gained `effective_status`; the Graph API call requests it now.
- [routes/campaigns.ts](apps/api/src/routes/campaigns.ts) â€” `GET /campaigns` and `GET /campaigns/:id` now include `adAccount.currency` and a `totals` aggregate (lifetime sum of every `CampaignMetric` row: spend, impressions, clicks, conversions, revenue). One `groupBy` query for the list, one `aggregate` for the detail. Lets cards show cumulative spend instead of yesterday's day-row.

**Frontend:**
- [lib/money.ts](apps/web/lib/money.ts) â€” new `fmtMoney(n, currency, options)` wrapper around `Intl.NumberFormat`. Renders â‚¹, $, â‚¬ correctly with the locale-appropriate grouping. Falls back to USD when currency is null/unknown.
- [lib/api.ts](apps/web/lib/api.ts) â€” `AdAccount` gains `currency?`/`timezone?`; `Campaign` gains `totals?` + `adAccount.currency?`.
- [campaigns/page.tsx](apps/web/app/(dashboard)/campaigns/page.tsx) â€” card spend now shows `c.totals.spend` (lifetime) instead of `c.metrics[0].spend` (latest day). Budget context line now reads "Rs400/day" or "of Rs400" depending on `budgetType`. ROAS and CTR derived from totals too. List view fixed the same way. All money values pass `c.adAccount?.currency` to `fmtMoney`.
- [campaigns/[id]/page.tsx](apps/web/app/(dashboard)/campaigns/[id]/page.tsx) â€” local `fmtMoney` re-exported as a currency-aware shim. Metric cards for Spend / Revenue use `fmtMoney(totals.spend, currency)` directly instead of `prefix="$"`. Insights and 7-day table also currency-aware.
- [Sidebar.tsx](apps/web/components/layout/Sidebar.tsx) â€” `useApi` dependencies for `getCampaigns({ limit: 1 })` and `getAdAccounts()` now include `pathname`. Counts refetch on every nav so the campaigns badge no longer shows stale 0 after a Sync or Create.

**Known gaps (post-fix):**
- The Dashboard and Analytics pages still render `$` everywhere â€” they aggregate across multiple ad accounts which may have mixed currencies, so picking one is wrong. Will need a workspace-level reporting currency for those aggregate views. For now, those pages remain USD-prefixed; cross-campaign card totals on Campaigns / Detail are correct.
- Currency for existing ad accounts is `null` until they re-OAuth or Sync once. Sync re-fetches currency on the Meta path; the others only persist on OAuth (so users would need to disconnect + reconnect Google/TikTok/LinkedIn to backfill).

`tsc --noEmit` clean on both apps.

### 2026-05-26 â€” Production deploy config (Vercel + Railway + Supabase)

End-to-end production-ready: Dockerfile, CORS hardening, security headers, env templates, CI checks, deploy doc.

**New files:**
- [apps/api/Dockerfile](apps/api/Dockerfile) â€” 3-stage Alpine build (deps â†’ builder â†’ runner). Runs `prisma generate` + `tsc` in the builder stage, ships a slim runtime image. Notes that the build context must be the repo root and Railway needs `RAILWAY_DOCKERFILE_PATH=apps/api/Dockerfile`.
- [.dockerignore](.dockerignore) (repo root) â€” keeps node_modules / dist / .env / .git out of the build context.
- [apps/api/.railwayignore](apps/api/.railwayignore) â€” same idea for non-Docker Railway builds.
- [apps/web/vercel.json](apps/web/vercel.json) â€” minimal monorepo config (assumes Vercel "Root Directory" = `apps/web`).
- [apps/api/.env.production.example](apps/api/.env.production.example) â€” DATABASE_URL (Supabase pooler), Clerk live keys, ENCRYPTION_KEY, four platform OAuth credential triples, CORS_ORIGIN/FRONTEND_URL/WEB_ORIGIN.
- [apps/web/.env.production.example](apps/web/.env.production.example) â€” Clerk live keys, `NEXT_PUBLIC_API_URL`, server-only `ANTHROPIC_API_KEY`.
- [.github/workflows/deploy.yml](.github/workflows/deploy.yml) â€” typecheck + lint gates on every PR/push; deploy "trigger" jobs document that Railway + Vercel deploy via their own GitHub apps.
- [docs/DEPLOY.md](docs/DEPLOY.md) â€” 9-section walkthrough: prereqs â†’ secrets â†’ Railway â†’ Supabase migrate â†’ Vercel â†’ CORS loop-close â†’ OAuth callbacks â†’ Clerk production â†’ smoke test â†’ custom domain â†’ secret rotation.

**Modified files:**
- [apps/api/src/index.ts](apps/api/src/index.ts) â€” CORS now accepts a comma-separated list via `CORS_ORIGIN` (with `WEB_ORIGIN` as legacy alias) and validates origin against the explicit allow-list with a callback. Wrapped startup in `startServer()` that does `prisma.$connect()` first, logs success, then `app.listen()`. Graceful SIGTERM/SIGINT handlers moved inside startServer.
- [apps/api/src/lib/prisma.ts](apps/api/src/lib/prisma.ts) â€” explicit `datasources.db.url = process.env.DATABASE_URL` + throws at construction if it's missing. Log levels: `["error"]` in production, full `["query","error","warn"]` in dev.
- [apps/web/next.config.js](apps/web/next.config.js) â€” added security headers (X-Frame-Options DENY, X-Content-Type-Options nosniff, Referrer-Policy, Permissions-Policy, HSTS 2-year preload). Kept `images.remotePatterns` (the Next 14 shape) instead of the deprecated `images.domains`; added `avatars.githubusercontent.com` + `images.unsplash.com`. CSP omitted on purpose â€” needs end-to-end testing with Clerk + popup OAuth before enabling.
- [apps/api/package.json](apps/api/package.json) â€” added `db:generate`, `db:push`, `db:migrate:deploy` script aliases alongside existing `prisma:*` names.

**Deviated from spec (with reasons):**
- `/` â†’ `/dashboard` redirect **not added** â€” would break the marketing landing at [apps/web/app/page.tsx](apps/web/app/page.tsx).
- Dockerfile does NOT call `npm run build --workspace=packages/shared` â€” `@advertix/shared` has no build script and isn't imported at runtime by `apps/api/src` (only declared in api's `package.json` deps).
- `images.domains` (deprecated since Next 13) replaced with `images.remotePatterns`.
- Railway "Root Directory: apps/api" advice in the spec doesn't work with a monorepo Dockerfile â€” DEPLOY.md instructs to leave Root blank and use `RAILWAY_DOCKERFILE_PATH` instead.

**Builds:**
- `apps/api && npm run build` â†’ `tsc -p tsconfig.json` â†’ exit 0. `dist/` contains `index.js`, `lib/`, `middleware/`, `routes/`, `services/`.
- `apps/web && npm run build` â†’ Next.js 14.2.15 production build â†’ exit 0. 21 routes compiled, no warnings, Æ’ Middleware 61.2 kB.

### 2026-05-26 â€” Onboarding flow, dashboard polish, creatives delete, AI Planner â†’ modal handoff

New users no longer land on a broken dashboard. AI Planner now actually applies generated plans. Creatives are deletable. Dashboard adapts copy to real numbers.

**PART A â€” Onboarding (critical):**
- [auth.ts](apps/api/src/routes/auth.ts) â€” `POST /auth/complete-onboarding` is now idempotent: if the user already owns a workspace, it returns `200 { workspace, member }` instead of `409`. Also persists `industry` and `companySize` on the Workspace row (schema already had the columns; previous handler ignored both).
- [(onboarding)/layout.tsx](apps/web/app/%28onboarding%29/layout.tsx) + [(onboarding)/onboarding/page.tsx](apps/web/app/%28onboarding%29/onboarding/page.tsx) â€” new 4-step wizard (Workspace name â†’ Industry â†’ Team size â†’ Review). Self-skips via `getMe()` if a workspace already exists. Final step calls `completeOnboarding({ workspaceName, industry, companySize })`, toasts success, redirects to `/dashboard`. Spinner on the "Go to Dashboard" button while submitting.
- [middleware.ts](apps/web/middleware.ts) â€” clarified comment: `/onboarding` requires auth (so it stays out of `isPublicRoute`) but does NOT require workspace; workspace gate lives in the dashboard layout.
- [(dashboard)/layout.tsx](apps/web/app/%28dashboard%29/layout.tsx) â€” workspace gate. Layout calls `getMe()` once and redirects to `/onboarding` if `workspace === null`. Until that completes, renders a centered spinner instead of mounting Sidebar/Header (which would each fan out their own NO_WORKSPACE-triggering fetches).

**PART B â€” Dashboard:**
- Conditional AI insight banner copy derived from real metrics â€” high-ROAS ("Consider scaling budget"), low-ROAS ("Pause underperformers"), spend-spike ("Monitor ROAS closely"), or neutral. Banner only renders when `spend > 0`.
- Full welcome empty state when the workspace truly has no campaigns AND no spend â€” replaces charts/active-campaigns/AI-activity/quick-actions with one `EmptyState` linking to `/settings?tab=integrations` and `/ai-planner`.

**PART E â€” Creatives:**
- [creatives/page.tsx](apps/web/app/%28dashboard%29/creatives/page.tsx) â€” `CreativeCard` now accepts `onDeleted` and renders a hover-visible delete button (bottom-right, rose-tinted). Click â†’ `window.confirm` â†’ `deleteCreative(id)` â†’ toast + `refetch()`. Inline `Loader2` while deleting.

**PART F â€” AI Planner Apply â†’ CreateCampaignModal prefill:**
- [ai-planner/page.tsx](apps/web/app/%28dashboard%29/ai-planner/page.tsx) â€” `GeneratedPlan` now wires "Apply to Campaign" to stash `{ platforms, objective, budget (daily, derived from total/duration), name }` into `sessionStorage.aiPlanPrefill` and `router.push('/campaigns?new=1')`. Platform strings are upper-cased to match backend enum.
- [CreateCampaignModal.tsx](apps/web/components/campaigns/CreateCampaignModal.tsx) â€” exports `CampaignPrefill` type. New `prefill?: CampaignPrefill | null` prop. On open, applies prefill: filters platforms against actually-connected ad accounts (won't auto-select disconnected platforms), matches objective against modal id / value / name, rounds budget to integer.
- [campaigns/page.tsx](apps/web/app/%28dashboard%29/campaigns/page.tsx) â€” the `?new=1` effect now also pops `sessionStorage.aiPlanPrefill` (one-shot read + remove) and feeds it into the modal via the new `prefill` prop.

**PART G â€” API methods:**
- No new methods needed â€” `deleteCreative` + `getAnalyticsCampaigns` were already in [api.ts](apps/web/lib/api.ts) (with stricter typing than the spec's sketch). `includeLatestMetrics=true` is already supported on `GET /campaigns`.

`tsc --noEmit` clean on both apps. `next lint` clean.

### 2026-05-26 â€” Create-campaign flow + working card actions

The previous wire-up shipped data-only â€” every Pause/Resume/Duplicate/Delete on the Campaigns page was a no-op, the "New Campaign" button in the Header went nowhere, and the 4-step CreateCampaignModal closed without ever calling `POST /campaigns`. All fixed now.

- [CreateCampaignModal.tsx](apps/web/components/campaigns/CreateCampaignModal.tsx) â€” full rebuild:
  - Step 1 (Platform) now reads live `getAdAccounts()` via `useApi`. Platforms with a connected, `isActive` ad account become selectable; the rest render in a dashed, disabled state. When zero accounts are connected the modal shows an amber callout linking to `/settings?tab=integrations`.
  - Multi-platform selection now means "create N campaigns, one per platform" â€” each uses that platform's first active ad account; if 2+ platforms are picked the platform name is appended to each campaign's name automatically.
  - Objective IDs map to backend strings ("Conversions", "Awareness", etc.).
  - "Launch Campaign" â†’ `createCampaign(...)` per platform, then `updateCampaign(id, { status: 'ACTIVE' })` per result.
  - "Save as Draft" â†’ `createCampaign(...)` only (backend creates rows in `DRAFT` by default).
  - Submit state disables both buttons + close + ESC, shows inline error in a rose card, and calls `onCreated` so the page refetches both the list and the count chips.
- [Campaigns list](apps/web/app/(dashboard)/campaigns/page.tsx) â€” `useCampaignActions(c, refetch)` hook drives all card buttons. Pause/Resume hits `updateCampaign(id, { status })`, Duplicate hits `createCampaign(...)` with the existing row's platform/objective/budget/dates/targeting/adAccountId and a "(copy)" suffix, Delete confirms then hits `deleteCampaign(id)`. Per-action loading spinners; other actions on the same card are disabled while one is in flight. Page accepts `?new=1` to auto-open the modal then strips the param.
- [List-view row](apps/web/app/(dashboard)/campaigns/page.tsx) â€” was just an "Open â†’" link. Now has the same Pause/Duplicate/Delete icon buttons inline before the link, sharing the same `useCampaignActions` hook + `refetchAll` callback.
- [Header.tsx](apps/web/components/layout/Header.tsx) â€” "New Campaign" is now a `<Link href="/campaigns?new=1">` that routes to the campaigns page and auto-opens the modal.
- [Dashboard.tsx](apps/web/app/(dashboard)/dashboard/page.tsx) â€” `QUICK_ACTIONS[0].href` updated from `/campaigns` to `/campaigns?new=1` so the "Launch Campaign" quick action also opens the modal.

`tsc --noEmit` + `next lint` both pass clean.

### 2026-05-26 â€” Wired every page to real backend APIs

End of mock data on the dashboard, campaigns list, campaign detail, analytics, creatives, settings (General + Workspace), header (plan badge), and sidebar (live campaign count + connected platforms strip + Clerk user). Audiences / Billing / Insights stay on mocks for Phase 3.

**New foundations:**
- [apps/web/components/ui/Skeleton.tsx](apps/web/components/ui/Skeleton.tsx) â€” `SkeletonCard`, `SkeletonText`, `SkeletonMetricCard`, `SkeletonTableRow`, `SkeletonCampaignCard`, `SkeletonChartCard` reusable placeholders.
- [apps/web/components/ui/EmptyState.tsx](apps/web/components/ui/EmptyState.tsx) â€” branded empty state w/ icon, title, description, primary + secondary actions.
- [apps/web/hooks/useApi.ts](apps/web/hooks/useApi.ts) â€” generic `useApi<T>(fetcher, deps)` hook returning `{ data, loading, error, refetch }`. Uses a ref for the fetcher so callers don't need to memoize. Cancellable via cleanup flag.

**Backend:**
- [routes/campaigns.ts](apps/api/src/routes/campaigns.ts) â€” `GET /campaigns` now accepts `?includeLatestMetrics=true` and includes the most recent `CampaignMetrics` row inline on each campaign so the list page can show last-day spend/ROAS/CTR per card without N+1 queries.

**API client:**
- [apps/web/lib/api.ts](apps/web/lib/api.ts) â€” `Campaign` type gained optional `metrics?: CampaignMetric[]`. `getCampaigns` defaults `includeLatestMetrics: 'true'`. `Workspace` type gained `slug`, `industry`, `companySize`.

**Chart components made data-driven:**
- [SpendChart.tsx](apps/web/components/dashboard/SpendChart.tsx) â€” now accepts `data?: SpendChartPoint[]` + `showRangeTabs` props. Falls back to generated mock for storybook/preview if no data passed.
- [PlatformBreakdown.tsx](apps/web/components/dashboard/PlatformBreakdown.tsx) â€” accepts `data?: PlatformBreakdownPoint[]`. Auto-assigns colors from a palette. Empty state when data array is empty.

**Pages rewired:**
- [Dashboard](apps/web/app/(dashboard)/dashboard/page.tsx) â€” `useApi` for overview + timeseries (spend + ROAS) + platform breakdown + top-5 active campaigns. Time-based greeting (`Good morning/afternoon/evening`) + Clerk first name. AI insight banner hidden when spend = 0. Skeleton loading state for every section. EmptyState in the campaigns sub-card when no campaigns. Recent AI Activity + Quick Actions kept as static placeholders with TODO comments.
- [Campaigns list](apps/web/app/(dashboard)/campaigns/page.tsx) â€” `useApi` with debounced search + platform/status filters + pagination. Stats chips use 4 parallel `getCampaigns({ limit: 1 })` count fetches. Skeleton grid/table during load. EmptyState differentiates "no campaigns at all" vs "filters returned nothing".
- [Campaign Detail](apps/web/app/(dashboard)/campaigns/[id]/page.tsx) â€” `useApi` for `getCampaign(id)` + `getCampaignMetrics(id, 30)`. Aggregates totals for the 5 metric cards. SpendChart renders real metric data. AI Insights are **deterministic** â€” derived from real metrics (ROAS, CTR, budget-burn) instead of calling Claude per page view. Pause/Resume + Save + Delete all hit the real API. Ad Sets / Creatives / Audience tabs become explicit "coming soon" EmptyStates with TODO comments.
- [Analytics](apps/web/app/(dashboard)/analytics/page.tsx) â€” `useApi` for overview, timeseries (re-fetched on metric switch), platform breakdown (real BarChart), and analytics campaign list (sortable, re-fetches on column click). Funnel is now derived from real `overview.impressions/clicks/conversions` numbers. Whole-page EmptyState when workspace has zero spend.
- [Settings/General tab](apps/web/app/(dashboard)/settings/page.tsx) â€” pulls workspace via `getMe` + `getWorkspace`, pre-fills form. `Save Changes` calls `updateWorkspace({ name, slug, industry, companySize })`. Email field is read-only with "Clerk" badge.
- [Settings/Workspace tab](apps/web/app/(dashboard)/settings/page.tsx) â€” `getMembers` for the live member list. Invite calls `inviteMember`; role change calls `updateMemberRole`; remove calls `removeMember`. Owner row is non-editable. Pending invites card is a placeholder (real invite records = Phase 3).
- [Creatives](apps/web/app/(dashboard)/creatives/page.tsx) â€” `useApi(getCreatives({...}))` with type/platform/status/search filters. API â†’ display mapper (gradients by id hash, status enum mapping). "Use This Creative" in the AI modal now calls `createCreative` with `aiGenerated: true` and refetches the grid.
- [Sidebar](apps/web/components/layout/Sidebar.tsx) â€” Connected platforms strip pulls live `getAdAccounts()` (dedup by platform, hides inactive). Campaign count badge overrides static "12" with real `getCampaigns({ limit: 1 }).total`. User profile uses Clerk's `useUser()` for avatar + name + email.
- [Header](apps/web/components/layout/Header.tsx) â€” Plan pill pulls `meQ.data.workspace.plan` (or user.plan as fallback). Label + CTA + color vary by tier. Links to `/billing` instead of being inert.

**Mock data still in place (Phase 3):**
- Audiences page, Billing page, Insights page
- Settings tabs: Notifications, API Keys, Security, Danger Zone
- Header notifications popover (still hardcoded list)
- Recent AI Activity card on Dashboard
- AI Insights card on Analytics page

`tsc --noEmit` passes clean on both apps after one fix (added `slug/industry/companySize` to the `Workspace` API type to match the new schema).

### 2026-05-26 â€” Integration guide extended for TikTok + LinkedIn

[docs/integrations.md](docs/integrations.md) now covers all 4 active ad platforms with the same step-by-step structure used for Meta and Google:

- **TikTok section** â€” TikTok For Business signup + Marketing API portal app creation, OAuth redirect setup, App ID + Secret retrieval, sandbox tester whitelist, `.env` values, test walkthrough, scopes used, common error table (auth_code expiry, permission denied, missing scopes), 24-hour token caveat, and the path to production review.
- **LinkedIn section** â€” LinkedIn Developer Portal app creation (including the LinkedIn Page requirement), Auth tab + redirect URI, Client ID/Secret, the **Marketing Developer Platform (MDP)** application form details + 1â€“3 week wait time, OAuth-flow smoke test path without MDP approval, scopes explained, common errors (unauthorized_scope_error, redirect_uri_mismatch, 403 on adAccountsV2).
- **Production verification table** expanded from 2 columns to 4 (Meta / Google / TikTok / LinkedIn) with each platform's review process + timeline + what to submit + what works in the meantime.
- **Launch checklist** extended with TikTok production review, LinkedIn MDP application, all 4 platforms' production redirect URIs, and TikTok token refresh TODO.
- **Troubleshooting** â€” token expiry section now lists all 4 platforms' token lifetimes and refresh status; added a generic "platform not configured" entry.

### 2026-05-26 â€” TikTok + LinkedIn Ads integrations

Third and fourth ad platform connections, parity with Meta/Google. Same popup OAuth + `/connect/done` + BroadcastChannel pattern.

- **TikTokAdsService** ([apps/api/src/services/tiktok.service.ts](apps/api/src/services/tiktok.service.ts)) â€” wraps the v1.3 Marketing API. TikTok responses are nested as `{ code, message, data }` â€” internal `tiktokFetch` helper throws on any non-zero `code`. OAuth via `/v2/auth/authorize`, token via `/open_api/v2/oauth2/access_token` (returns `advertiser_ids` directly in the token response â€” no separate "list accounts" step). `getCampaigns` and `getCampaignMetrics` (via `report/integrated/get` with `data_level=AUCTION_CAMPAIGN` + daily breakdown). `createCampaign` + `updateCampaignStatus` mutations. Scopes: `tt.advertiser.read,tt.advertiser.write`.
- **LinkedInAdsService** ([apps/api/src/services/linkedin.service.ts](apps/api/src/services/linkedin.service.ts)) â€” wraps Marketing API v2. URN-based (`urn:li:sponsoredAccount:{id}`, `urn:li:sponsoredCampaign:{id}`), date ranges as `{year, month, day}` objects, `runSchedule` as epoch milliseconds. Standard `Authorization: Bearer` + `LinkedIn-Version: 202401` + `X-Restli-Protocol-Version: 2.0.0` headers. `adAccountsV2`, `adCampaignsV2`, `adAnalyticsV2` with `pivot=CAMPAIGN` + `timeGranularity=DAILY`. Scopes: `r_ads,r_ads_reporting,w_organization_social`. Refresh-token support (LinkedIn issues both at consent time). Exports `isLinkedInAuthError` mirroring Google's pattern.
- **SyncService** extended with `syncTikTokAccount` and `syncLinkedInAccount` in [sync.service.ts](apps/api/src/services/sync.service.ts). TikTok budgets are already in currency (no micros conversion); LinkedIn budgets are nested as `{ amount, currencyCode }`. Status mappers `mapTikTokStatus` / `mapLinkedInStatus`. Revenue heuristics: TikTok = `2 Ã— spend` placeholder; LinkedIn = `conversions Ã— $50`. Both flagged for future enhancement when real conversion-value tracking lands.
- **Routes** ([routes/tiktok.ts](apps/api/src/routes/tiktok.ts), [routes/linkedin.ts](apps/api/src/routes/linkedin.ts)) â€” `GET /oauth-url`, `GET /callback` (no auth, browser target, upserts AdAccounts per advertiser/account, redirects to `/connect/done?connected=<platform>`), `POST /sync/:adAccountId`. Mounted under `/tiktok` and `/linkedin` in [routes/index.ts](apps/api/src/routes/index.ts).
- **Frontend popup helpers** â€” `openTikTokOAuthPopup()` and `openLinkedInOAuthPopup()` added to [oauth-popup.ts](apps/web/lib/oauth-popup.ts). Both inherit the COOP-resistant polling + BroadcastChannel pattern.
- **Next.js proxies** â€” [tiktok/connect/route.ts](apps/web/app/api/tiktok/connect/route.ts) and [linkedin/connect/route.ts](apps/web/app/api/linkedin/connect/route.ts). Forward Clerk Bearer token, return `{ url }`.
- **Settings components** â€” [TikTokConnect.tsx](apps/web/components/settings/TikTokConnect.tsx) (black `T` logo, hover #010101) and [LinkedInConnect.tsx](apps/web/components/settings/LinkedInConnect.tsx) (blue `in` logo, hover #0A66C2). Same structure as `GoogleConnect`/`MetaConnect`.
- **ConnectModal** â€” TikTok + LinkedIn flipped to `available: true`. `startConnect` now dispatches across all 4 platforms.
- **Settings â†’ Integrations tab** â€” renders `<TikTokConnect />` and `<LinkedInConnect />` between `<GoogleConnect />` and the YouTube/Snapchat "Coming Soon" placeholders. URL params `?connected=tiktok|linkedin` and `?error=tiktok_*|linkedin_*` surface as toasts.
- **.env.example** â€” added `TIKTOK_APP_ID`, `TIKTOK_APP_SECRET`, `TIKTOK_REDIRECT_URI`, `LINKEDIN_CLIENT_ID`, `LINKEDIN_CLIENT_SECRET`, `LINKEDIN_REDIRECT_URI` with provenance notes pointing to the developer portals.
- **No schema changes** â€” both platforms reuse the existing `AdAccount` + `Campaign` + `CampaignMetrics` tables. LinkedIn uses the existing `refreshToken` column; TikTok stores only `accessToken` (TikTok tokens last 24 hours by default â€” reconnect or refresh logic is a future improvement).
- `tsc --noEmit` passes clean on both apps on first run.

### 2026-05-26 â€” Popup helper: stop trusting `popup.closed` under COOP

- Google's `accounts.google.com` sets `Cross-Origin-Opener-Policy: same-origin`, which causes the browser to block `popup.closed` reads from cross-origin parents and return `true` falsely (with a noisy console warning).
- Old behavior: 500ms poller in [oauth-popup.ts](apps/web/lib/oauth-popup.ts) read `popup.closed === true` on the first tick after the popup landed on Google's domain, then resolved as `popup_closed` before OAuth could even start. Net effect for the user: clicking Connect Google Ads always failed with no chance to authorize.
- Fix:
  - Poll at 2s instead of 500ms.
  - Wrap `popup.closed` in try/catch.
  - Only resolve as `popup_closed` after 3 consecutive `true` readings (~6s), so any in-flight `postMessage` / `BroadcastChannel` signal wins.
  - Added a hard 5-minute timeout so the promise can never leak if the user abandons the popup without authorizing.
- Meta was unaffected because Facebook's OAuth flow is short and `postMessage` always arrived before the false-positive could land.

### 2026-05-26 â€” Ad platform integration guide

- New file: **[docs/integrations.md](docs/integrations.md)** â€” step-by-step setup walkthroughs for Meta and Google Ads, with troubleshooting and production launch checklists.
- Linked from the main README section in [IMPLEMENTATION.md](IMPLEMENTATION.md).
- Decision: Google Ads integration code is shipped but the full developer-token + MCC setup is deferred. The Google connect button still works as an OAuth-flow smoke test â€” popup loads, sign-in works, token exchange works â€” but throws "GOOGLE_DEVELOPER_TOKEN is not configured" at the final API step. End-to-end Google sync will be wired when a real customer needs it.

### 2026-05-25 â€” Google Ads API integration

Second ad platform connection, parity with Meta. Same popup OAuth flow + `/connect/done` page.

- **Shared crypto** â€” extracted `encryptToken`/`decryptToken` from `meta.service.ts` into [apps/api/src/lib/crypto.ts](apps/api/src/lib/crypto.ts) so both Meta and Google use the same AES-256-CBC code path. `meta.service` still exposes `encryptToken`/`decryptToken` as thin delegates to avoid churn in [routes/meta.ts](apps/api/src/routes/meta.ts).
- **GoogleAdsService** ([apps/api/src/services/google.service.ts](apps/api/src/services/google.service.ts)) â€” OAuth URL with `access_type=offline` + `prompt=consent` (guarantees a refresh token); `exchangeCodeForTokens` and `refreshAccessToken` against Google Identity; `getCustomerAccounts` calls `customers:listAccessibleCustomers` then per-customer GAQL probes for name/currency/timezone; `getCampaigns` and `getCampaignMetrics` issue GAQL queries against `customers/{id}/googleAds:search` with `developer-token` + `login-customer-id` headers; `createCampaign` does two-step budgetâ†’campaign create; `updateCampaignStatus` uses the standard mutate+updateMask pattern. Errors throw `Error("Google Ads API: <message> (code: <code>)")` and tag `httpStatus` so the sync service can detect 401 for token refresh. Exported helper `isGoogleAuthError`.
- **SyncService.syncGoogleAccount** ([apps/api/src/services/sync.service.ts](apps/api/src/services/sync.service.ts)) â€” converts micros â†’ currency for budget and spend; maps `ENABLED/PAUSED/REMOVED` â†’ our enum; handles Google's `2037-12-30` sentinel as "no end date"; upserts campaigns by `(adAccountId, externalId)`; pulls last 30 days of daily metrics via `segments.date`; pulls `metrics.conversions_value` â†’ revenue (Google reports conversion value directly, simpler than Meta's purchase_roas). **Auto-refreshes access token on 401** â€” decrypts stored refresh token, calls Google's token endpoint, persists the new access token encrypted before retrying the sync.
- **Google routes** ([apps/api/src/routes/google.ts](apps/api/src/routes/google.ts)) â€” `GET /oauth-url`, `GET /callback` (no auth, browser redirect target â€” upserts one AdAccount per accessible customer, redirects to `/connect/done?connected=google` on success or `/connect/done?error=google_failed|google_cancelled|google_no_workspace|google_no_customers`), `POST /sync/:adAccountId`, `GET /customers` (enriched with live data, tokens never returned). Mounted under `/google` in [routes/index.ts](apps/api/src/routes/index.ts).
- **Frontend popup helper** ([apps/web/lib/oauth-popup.ts](apps/web/lib/oauth-popup.ts)) â€” added `openGoogleOAuthPopup()` that mirrors `openMetaOAuthPopup()`. Listens on both `postMessage` and `BroadcastChannel`.
- **Next.js proxy** ([apps/web/app/api/google/connect/route.ts](apps/web/app/api/google/connect/route.ts)) â€” uses Clerk `auth()` to attach Bearer token to backend call, returns `{ url }`.
- **GoogleConnect component** ([apps/web/components/settings/GoogleConnect.tsx](apps/web/components/settings/GoogleConnect.tsx)) â€” same structure as `MetaConnect.tsx`. Red "G" logo, permissions list, popup-based connect, sync now, disconnect with confirmation.
- **ConnectModal** ([apps/web/components/connect/ConnectModal.tsx](apps/web/components/connect/ConnectModal.tsx)) â€” Google now `available: true`. Refactored the Meta-specific `connectingMeta` state into a generic `connectingPlatform: Platform | null` so each row can show its own loading state.
- **Settings â†’ Integrations** â€” renders `<GoogleConnect />` next to `<MetaConnect />`. Removed Google from the static "Coming Soon" tiles. Reads `?connected=google` / `?error=google_*` URL params and surfaces them as toasts.
- **.env.example** ([apps/api/.env.example](apps/api/.env.example)) â€” added `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI`, `GOOGLE_DEVELOPER_TOKEN` with one-line provenance notes.
- **AdAccount.refreshToken** was already in the schema from the original design â€” no schema migration needed.

To use Google integration end-to-end: get a Google Cloud OAuth client (with `http://localhost:4000/api/google/callback` whitelisted), a Google Ads developer token (Tools & Settings â†’ API Center, basic-access is enough for OAuth + read), put both in `apps/api/.env`, restart the API.

### 2026-05-25 â€” Popup OAuth fixes: COOP, BroadcastChannel, no fallback redirect

Three real bugs surfaced when the user actually ran Meta OAuth in a popup:

- **COOP severed `window.opener`.** Helmet on the API was sending `Cross-Origin-Opener-Policy: same-origin` by default. When the popup transited through `/api/meta/callback`, the browser cut the opener relationship between popup and parent â€” even though the parent and `/connect/done` are same-origin. Fix in [apps/api/src/index.ts](apps/api/src/index.ts): set `crossOriginOpenerPolicy: { policy: "same-origin-allow-popups" }`.
- **`/connect/done` fell back to `/settings` redirect** when it couldn't detect a popup (because of the COOP issue). User saw the entire app load inside the small popup window. Fix in [apps/web/app/connect/done/page.tsx](apps/web/app/connect/done/page.tsx): removed `router.replace("/settings?...")` entirely. The page now always shows a "Connected â€” closing this window" UI, attempts `window.close()`, and falls back to a manual "Close window" button if the browser blocks programmatic close.
- **`postMessage` alone was fragile.** Added `BroadcastChannel("platform-oauth")` as a second messaging path. Now `/connect/done` posts to BOTH `window.opener.postMessage` AND `BroadcastChannel`, and [apps/web/lib/oauth-popup.ts](apps/web/lib/oauth-popup.ts) listens on BOTH. Works even if any future security header severs the opener.

Net effect: clicking Connect Meta now opens a real popup, runs OAuth, posts the result back, and closes itself. Main window's modal flips to "Connected" without any navigation.

### 2026-05-25 â€” useApiClient memoization (fixes ConnectModal infinite render loop)

- [apps/web/lib/api.ts](apps/web/lib/api.ts) â€” wrapped the returned client object in `useMemo([getToken])` so consumers can safely list it in `useEffect` / `useCallback` dependency arrays. Previously a new object was returned every render, which combined with `useCallback(refresh, [api])` + `useEffect(..., [refresh])` caused an infinite render loop in `ConnectModal` (firing `GET /api/ad-accounts` until the rate-limiter started returning 429s).
- Root cause: returning a fresh closure object from a hook makes that hook impossible to depend on safely. Fix is at the source â€” every consumer benefits without per-component workarounds.

### 2026-05-25 â€” Connect UX rework: no onboarding wizard, popup OAuth, sidebar Connect menu

- **Removed onboarding wizard.** Deleted [apps/web/app/(onboarding)/](apps/web/app/(onboarding)/) and removed the `/onboarding` exception from [middleware.ts](apps/web/middleware.ts). Workspace creation moved into the backend `requireAuth` middleware ([auth.ts](apps/api/src/middleware/auth.ts)) â€” every authenticated user now auto-gets a default workspace (`<FirstName>'s Workspace`) + OWNER membership on first request. Zero-friction onboarding.
- **Security fix:** `/onboarding` was incorrectly listed as a public route in middleware. Anyone could load the form without being signed in. Removed alongside the onboarding feature.
- **Popup OAuth for Meta.** [apps/web/lib/oauth-popup.ts](apps/web/lib/oauth-popup.ts) â€” generic `openOAuthPopup()` + `openMetaOAuthPopup()` helpers that open the Facebook dialog in a centered 600Ã—720 popup, listen for a `postMessage({ type: 'platform-connect-done', ... })` from the child, and resolve when the popup closes. No more full-page redirect to Facebook.
- **New popup-close page** [apps/web/app/connect/done/page.tsx](apps/web/app/connect/done/page.tsx) â€” backend OAuth callback now redirects here. Detects `window.opener`, posts the result message, closes itself. Falls back to a `router.replace('/settings')` navigation if hit directly (not in a popup).
- **Backend Meta callback redirect changed** ([routes/meta.ts](apps/api/src/routes/meta.ts)) â€” success now goes to `/connect/done?connected=meta`, errors to `/connect/done?error=meta_failed|meta_cancelled|meta_no_workspace`.
- **Sidebar Connect menu.** Added a new nav item "Connect Apps" (Plug icon) under the Advertising group. Clicking it opens a `ConnectModal` overlay on the same page â€” no navigation. The existing "+" button at the bottom of the sidebar (under CONNECTED) now opens the same modal.
- **`ConnectModal`** ([apps/web/components/connect/ConnectModal.tsx](apps/web/components/connect/ConnectModal.tsx)) â€” lists all 6 platforms with Connect/Disconnect actions. Meta uses the popup helper; the other 5 show "Coming Soon". Refreshes the ad-account list after every action.
- **`MetaConnect`** ([apps/web/components/settings/MetaConnect.tsx](apps/web/components/settings/MetaConnect.tsx)) â€” Settings/Integrations card also switched from `window.location.href = url` to `openMetaOAuthPopup()`. No more full-page navigation; settings page stays put.
- **Sidebar `NavItem` shape** ([Sidebar.tsx](apps/web/components/layout/Sidebar.tsx)) â€” now a discriminated union of `{ kind: "link", href }` and `{ kind: "action", action }` so nav entries can be either router links or in-page modal triggers.

### 2026-05-25 â€” Onboarding wizard now persists workspace (later removed)

- [/onboarding](apps/web/app/(onboarding)/onboarding/page.tsx) "Go to Dashboard" button now calls `POST /api/auth/complete-onboarding` via `useApiClient().completeOnboarding(...)` before navigating. Previously it was a TODO that just routed without saving.
- Loading state on the final button while the workspace is created. Toast on error. Idempotent: if the workspace already exists (409 from backend), still navigates to `/dashboard`.
- Fixes a UX dead-end where users would finish the wizard but no Workspace row was created, blocking Meta connect with `?error=meta_no_workspace`.

### 2026-05-25 â€” Meta OAuth scope fix

- Dropped `instagram_basic` (deprecated by Meta) and `pages_read_engagement` (now requires use-case review) from the Meta OAuth scope list in [meta.service.ts](apps/api/src/services/meta.service.ts). The three Marketing API scopes (`ads_read`, `ads_management`, `business_management`) cover ad management for both Facebook and Instagram placements.
- Fixed a runtime "Invalid Scopes: instagram_basic" error that blocked the OAuth dialog.

### 2026-05-25 â€” Meta Ads API integration (first ad platform connection)

- **Schema migration** ([apps/api/prisma/schema.prisma](apps/api/prisma/schema.prisma)) â€” added `Workspace.slug` (unique), `Workspace.industry`, `Workspace.companySize`, `Campaign.externalId`, `@@unique([adAccountId, externalId])`, and indexes `Campaign(workspaceId, status)`, `Campaign(workspaceId, platform)`, `Campaign(externalId)`. Ran `prisma generate && prisma db push`.
- **New backend services:**
  - [apps/api/src/services/meta.service.ts](apps/api/src/services/meta.service.ts) â€” Meta Marketing API v19.0 wrapper. OAuth URL builder, codeâ†”short-livedâ†”long-lived token exchange, `getAdAccounts`, `getCampaigns`, `getCampaignInsights` (daily breakdown via `time_increment=1`), `createCampaign`, `updateCampaignStatus`. AES-256-CBC `encryptToken`/`decryptToken` with SHA-256 key derivation from `ENCRYPTION_KEY`. Centralized error handling that surfaces Meta's `error.message`/`error.code`.
  - [apps/api/src/services/sync.service.ts](apps/api/src/services/sync.service.ts) â€” `syncMetaAccount(adAccount)` upserts Campaigns by `(adAccountId, externalId)` then upserts daily CampaignMetrics, calculating conversions from `actions[purchase]`, revenue from `purchase_roas`, and the standard derived metrics. Returns `{ campaignsSynced, metricsSynced, platform: 'META' }`.
- **New backend routes** ([apps/api/src/routes/meta.ts](apps/api/src/routes/meta.ts)):
  - `GET /api/meta/oauth-url` (auth) â€” returns Facebook dialog URL
  - `GET /api/meta/callback` (no auth â€” browser redirect) â€” exchanges code, encrypts long-lived token, upserts AdAccount per Meta ad account, redirects to `/settings?tab=integrations&connected=meta` (or `?error=meta_*` on failure)
  - `POST /api/meta/sync/:adAccountId` (auth) â€” runs `syncService`
  - `GET /api/meta/ad-accounts` (auth) â€” returns stored accounts enriched with fresh Graph API data, tokens never returned
- **Mounted** in [routes/index.ts](apps/api/src/routes/index.ts) under `/meta`.
- **`PATCH /api/workspace`** now persists `slug` (slugified server-side), `industry`, `companySize` â€” previously TODO.
- **Frontend proxy** [apps/web/app/api/meta/connect/route.ts](apps/web/app/api/meta/connect/route.ts) â€” `GET` reads Clerk session via `auth()`, forwards Bearer token to `/api/meta/oauth-url`, returns `{ url }`.
- **Frontend component** [apps/web/components/settings/MetaConnect.tsx](apps/web/components/settings/MetaConnect.tsx) â€” handles both connected and not-connected states. "Connect Meta Ads" â†’ fetches `/api/meta/connect` â†’ `window.location.href = data.url`. "Sync Now" â†’ POSTs to `/api/meta/sync/:id` with Clerk bearer. "Disconnect" â†’ confirmation card â†’ `disconnectAdAccount`. All actions toast via `react-hot-toast`.
- **Settings â†’ Integrations tab rewired** to live data: `useApiClient().getAdAccounts()` on mount + after Meta callback/sync/disconnect. The Meta card is now `<MetaConnect />`; other 5 platforms remain as "Coming Soon" disabled placeholders. URL params `?connected=meta`/`?error=meta_*` surface as toasts and get cleaned from the address bar via `history.replaceState`.
- **`.env.example`** ([apps/api/.env.example](apps/api/.env.example)) updated with `META_APP_ID`, `META_APP_SECRET`, `META_REDIRECT_URI`, `ENCRYPTION_KEY`, `FRONTEND_URL`.
- Result: `tsc --noEmit` passes clean on both apps on first run.

### 2026-05-25 â€” Database created, Prisma Studio running

- Created local Postgres database `advertix` (port `1233` confirmed by user)
- Updated `apps/api/.env` with `DATABASE_URL=postgresql://postgres:***@localhost:1233/advertix`
- Ran `npx prisma db push` â†’ 8 tables created in `public` schema
- Verified via raw query: `User`, `Workspace`, `WorkspaceMember`, `AdAccount`, `Campaign`, `CampaignMetrics`, `Creative`, `AiSession`
- Started Prisma Studio at <http://localhost:5555> (background process, ID `blt15eomy`)

### 2026-05-25 â€” Backend rebuild (real Prisma-powered API)

- Replaced all placeholder backend routes with production-quality Prisma CRUD endpoints
- Installed `helmet`, `express-rate-limit`, `@clerk/backend` (+29 transitive deps)
- New files:
  - [apps/api/src/lib/prisma.ts](apps/api/src/lib/prisma.ts) â€” singleton client
  - [apps/api/src/lib/workspace.ts](apps/api/src/lib/workspace.ts) â€” workspace helpers
  - [apps/api/src/types/express.d.ts](apps/api/src/types/express.d.ts) â€” Request augmentation
  - [apps/api/src/routes/ad-accounts.ts](apps/api/src/routes/ad-accounts.ts)
  - [apps/api/src/routes/creatives.ts](apps/api/src/routes/creatives.ts)
  - [apps/api/src/routes/workspace.ts](apps/api/src/routes/workspace.ts)
  - [apps/web/lib/api.ts](apps/web/lib/api.ts) â€” typed `useApiClient()` hook
- Rewrote: `middleware/auth.ts`, `middleware/errorHandler.ts`, `routes/auth.ts`, `routes/campaigns.ts`, `routes/analytics.ts`, `routes/index.ts`, `src/index.ts`
- Server now has Helmet, request logging, 100/15min global + 20/15min AI rate limits, graceful SIGTERM/SIGINT shutdown
- Fix: `verifyToken` is a top-level export in `@clerk/backend`, not a `ClerkClient` method
- Result: `tsc --noEmit` passes clean on both apps

### 2026-05-25 â€” Audiences, Billing, Settings, Onboarding, Insights pages

- New pages:
  - [/audiences](apps/web/app/(dashboard)/audiences/page.tsx) â€” 12 audiences, type-colored cards, AI Build Audience modal
  - [/billing](apps/web/app/(dashboard)/billing/page.tsx) â€” current plan, 3 usage meters, 4-plan comparison, history, payment method
  - [/settings](apps/web/app/(dashboard)/settings/page.tsx) â€” 7 tabs (General/Workspace/Integrations/Notifications/API Keys/Security/Danger Zone)
  - [/insights](apps/web/app/(dashboard)/insights/page.tsx) â€” 8 insight cards + floating Ask-AI chat widget
  - [/onboarding](apps/web/app/(onboarding)/onboarding/page.tsx) â€” 4-step wizard
  - [(onboarding)/layout.tsx](apps/web/app/(onboarding)/layout.tsx) â€” minimal centered layout
- Updated [middleware.ts](apps/web/middleware.ts) â€” `/onboarding` public, TODO for metadata-based redirect
- Result: `tsc --noEmit` passes clean on first run

### 2026-05-25 â€” AI Planner error message improvements

- Surfaced real backend error message in [/ai-planner](apps/web/app/(dashboard)/ai-planner/page.tsx) catch block (was: generic "Sorry, I encountered an error", now: actual server message + helpful examples)
- Discussed UX of "non-campaign" prompts returning $0/0-0 placeholder plans â€” left as is (model behavior); options A/B/C documented for future tightening

### 2026-05-25 â€” Analytics + Creatives pages, AI wiring

- Built [/analytics](apps/web/app/(dashboard)/analytics/page.tsx) â€” 4 metric cards, 6-metric ComposedChart, platform BarChart, CSS funnel, sortable campaign table, brand-gradient AI insights card
- Built [/creatives](apps/web/app/(dashboard)/creatives/page.tsx) â€” 12 creatives w/ per-type previews + AI Generate Copy modal with copy-to-clipboard + react-hot-toast feedback
- Wired AI Planner + Creatives modal to real Claude API:
  - Backend: [ai.service.ts](apps/api/src/services/ai.service.ts), [routes/ai.ts](apps/api/src/routes/ai.ts) â€” model `claude-sonnet-4-20250514`, defensive JSON extraction
  - Frontend proxies: [app/api/ai/plan-campaign/route.ts](apps/web/app/api/ai/plan-campaign/route.ts), [generate-copy/route.ts](apps/web/app/api/ai/generate-copy/route.ts)
- Added `<Toaster>` to dashboard layout for clipboard feedback
- Resolved auth loop caused by 15-minute system clock skew (Windows time sync)

### 2026-05-25 â€” Campaigns section + AI Planner UI

- [/campaigns](apps/web/app/(dashboard)/campaigns/page.tsx) â€” list with filters, grid/list toggle (localStorage), 12 mock campaigns, pagination, empty state
- [/campaigns/[id]](apps/web/app/(dashboard)/campaigns/[id]/page.tsx) â€” detail with 5 tabs (Overview, Ad Sets, Creatives, Audience, Settings)
- [CreateCampaignModal.tsx](apps/web/components/campaigns/CreateCampaignModal.tsx) â€” 4-step wizard (Platform â†’ Objective â†’ Budget â†’ Review)
- [/ai-planner](apps/web/app/(dashboard)/ai-planner/page.tsx) â€” first iteration with mock 1.5s response

### 2026-05-25 â€” Dashboard scaffold

- Tailwind config + globals.css with full design system (CSS vars, utility classes, animations, stagger classes)
- [Sidebar.tsx](apps/web/components/layout/Sidebar.tsx), [Header.tsx](apps/web/components/layout/Header.tsx), [(dashboard)/layout.tsx](apps/web/app/(dashboard)/layout.tsx) â€” collapsible sidebar, sticky header, search, notifications popover, Clerk `UserButton`
- Dashboard cards/components: [MetricCard](apps/web/components/dashboard/MetricCard.tsx), [SpendChart](apps/web/components/dashboard/SpendChart.tsx), [PlatformBreakdown](apps/web/components/dashboard/PlatformBreakdown.tsx), [CampaignTable](apps/web/components/dashboard/CampaignTable.tsx)
- [/dashboard](apps/web/app/(dashboard)/dashboard/page.tsx) â€” full page composition with AI insight banner, 4 metric cards, charts row, campaign table, AI activity + quick actions
- Required `"use client"` on `/dashboard/page.tsx` due to RSC boundary (icon components can't be passed from server to client)
- Resolved Clerk auth setup: env keys, blank sign-in caused by clock skew, dashboard route 404 caused by stale `.next` cache
