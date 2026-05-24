# AdGenius AI

Multi-platform AI-powered ad management SaaS.

## Stack

- **Frontend:** Next.js 14 (App Router), TypeScript, Tailwind CSS, shadcn/ui
- **Backend:** Node.js + Express + TypeScript
- **Database:** PostgreSQL (Supabase) via Prisma ORM
- **Auth:** Clerk
- **Monorepo:** npm workspaces + Turborepo

## Project Structure

```
adgenius-ai/
├── apps/
│   ├── web/    # Next.js 14 frontend
│   └── api/    # Express + TypeScript backend
└── packages/
    └── shared/ # Shared TypeScript types & constants
```

## Setup

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment variables

```bash
cp apps/web/.env.local.example apps/web/.env.local
cp apps/api/.env.example apps/api/.env
```

Fill in the values:

- **Clerk:** Get keys from https://dashboard.clerk.com
- **Supabase / Postgres:** Set `DATABASE_URL` in `apps/api/.env`
- **Anthropic:** Set `ANTHROPIC_API_KEY` in `apps/api/.env`

### 3. Generate Prisma client & push schema

```bash
cd apps/api
npx prisma generate
npx prisma db push
cd ../..
```

### 4. Run both apps

```bash
npm run dev
```

- Web: http://localhost:3000
- API: http://localhost:4000

## Scripts

- `npm run dev` — start both apps via Turbo
- `npm run build` — build all packages
- `npm run lint` — lint all packages
