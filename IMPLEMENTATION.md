# Advertix â€” Implementation Log

A multi-platform AI-powered ad management dashboard. Premium SaaS UI, Claude-powered campaign planning and creative generation, real backend with Prisma + Postgres + Clerk.

> **Maintain this file.** Update the [Change Log](#change-log) (newest first) and the relevant sections any time files change, features land, or setup steps shift.

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
