# Advertix — AI-Powered Ad Management Platform

Manage campaigns across Facebook, Instagram, Google, TikTok, LinkedIn and more from one intelligent workspace.

## Stack

- **Frontend:** Next.js 14 → advertix.io (Vercel)
- **Backend:** Node.js / Express → api.advertix.io (Railway)
- **Database:** PostgreSQL (Supabase / Railway Postgres) via Prisma ORM
- **AI:** Claude Sonnet (Anthropic)
- **Auth:** Clerk
- **Monorepo:** npm workspaces + Turborepo

## Project Structure

```
advertix/
├── apps/
│   ├── web/    # Next.js 14 frontend
│   └── api/    # Express + TypeScript backend
└── packages/
    └── shared/ # Shared types + constants
```

## Quick Start

```powershell
# Install workspace deps
npm install

# Generate Prisma client
npx prisma generate -w apps/api

# Push schema to your local Postgres
npx prisma db push -w apps/api

# Start both apps in parallel
npm run dev
```

Then visit:
- **Web** → http://localhost:3000
- **API** → http://localhost:4000

Required env files (gitignored):
- `apps/api/.env` — copy from `apps/api/.env.example` and fill in values
- `apps/web/.env.local` — copy from `apps/web/.env.local.example`

## Live

- **App:** https://advertix.io
- **API:** https://api.advertix.io

## Docs

- [docs/DEPLOY.md](docs/DEPLOY.md) — full deployment guide (Vercel + Railway + Supabase)
- [docs/PRODUCTION_LAUNCH.md](docs/PRODUCTION_LAUNCH.md) — go-live runbook (domain, Business Verification, Meta App Review)
- [docs/META_TEST_GUIDE.md](docs/META_TEST_GUIDE.md) — local Meta connect + sync test
- [docs/META_PUBLISH_TEST_GUIDE.md](docs/META_PUBLISH_TEST_GUIDE.md) — post-approval publish test
- [docs/integrations.md](docs/integrations.md) — per-platform integration notes
- [IMPLEMENTATION.md](IMPLEMENTATION.md) — change log + architecture

© 2026 Advertix. All rights reserved.
