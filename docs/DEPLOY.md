# AdGenius AI — Deployment Guide

End-to-end deploy: **Frontend → Vercel**, **Backend → Railway**, **Database → Supabase**.

> ⚠ **Never paste real secrets into git-tracked files**, including `.env.example` /
> `.env.production.example`. Those are templates; real values go in Vercel / Railway
> dashboards only. If you accidentally commit a secret, rotate it immediately.

---

## 0. Prerequisites

- GitHub repo with the `main` branch up-to-date
- **Supabase** project (Postgres ready)
- **Vercel** account (free tier is fine)
- **Railway** account (Hobby plan or higher)
- **Clerk** production instance (separate from your dev instance)
- Production OAuth apps for **Meta**, **Google Ads**, **TikTok**, **LinkedIn** — or a plan to add their production callback URLs to your existing dev apps

You should already have:

- `npx tsc --noEmit` clean in both `apps/api` and `apps/web`
- `npm run build` working locally for both apps (see § 7)

---

## 1. Generate production secrets

Before you touch a dashboard, generate the values you'll paste in.

```bash
# AES-256 token-encryption key (used by apps/api/src/lib/crypto.ts)
openssl rand -hex 32
```

Other secrets are obtained from each platform's dashboard — record them somewhere safe (e.g. 1Password) but **never** put them in a tracked file.

---

## 2. Deploy the API to Railway

The repo is a **pnpm/npm workspaces monorepo** with a single `package-lock.json`
at the root. The `apps/api/Dockerfile` reflects that — its build context must
be the **repo root**, not `apps/api`.

### 2.1 Create the service

1. railway.app → **New Project** → **Deploy from GitHub repo**
2. Pick the `adgenius-ai` repo
3. After the empty service is created, open **Settings**:
   - **Root Directory**: leave **blank** (or set to `/`). Do **not** set it to `apps/api` — the Dockerfile needs visibility into the repo root.
   - **Build Method**: **Dockerfile**
   - Set the env var **`RAILWAY_DOCKERFILE_PATH=apps/api/Dockerfile`** (Variables tab) — this tells Railway where the Dockerfile lives inside the (root-level) build context.

### 2.2 Set environment variables

In **Variables**, paste every key from
[`apps/api/.env.production.example`](../apps/api/.env.production.example).
Replace the placeholder values:

| Variable | Where to get it |
|---|---|
| `DATABASE_URL` | Supabase → Project Settings → Database → **Connection string** (URI / Session-pooler, port 5432). For PgBouncer (6543), append `?pgbouncer=true&connection_limit=1` |
| `CLERK_SECRET_KEY` | Clerk Dashboard → **Production** instance → API Keys |
| `ANTHROPIC_API_KEY` | console.anthropic.com → API Keys |
| `ENCRYPTION_KEY` | The `openssl rand -hex 32` value from § 1 |
| `CORS_ORIGIN` | Your Vercel URL — **fill in after § 3** (`https://your-app.vercel.app`) |
| `FRONTEND_URL` | Same Vercel URL |
| `META_APP_ID`/`SECRET` | developers.facebook.com → your app → Settings → Basic |
| `META_REDIRECT_URI` | `https://<your-railway-host>/api/meta/callback` |
| `GOOGLE_CLIENT_ID`/`SECRET` | Google Cloud Console → OAuth 2.0 Client IDs |
| `GOOGLE_REDIRECT_URI` | `https://<your-railway-host>/api/google/callback` |
| `GOOGLE_DEVELOPER_TOKEN` | Google Ads → API Center |
| `TIKTOK_APP_ID`/`SECRET` | TikTok Marketing API portal → your app |
| `TIKTOK_REDIRECT_URI` | `https://<your-railway-host>/api/tiktok/callback` |
| `LINKEDIN_CLIENT_ID`/`SECRET` | LinkedIn Developer Portal → your app → Auth |
| `LINKEDIN_REDIRECT_URI` | `https://<your-railway-host>/api/linkedin/callback` |
| `NODE_ENV` | `production` |
| `PORT` | leave unset — Railway injects its own |

### 2.3 First deploy

Push to `main` (or trigger a deploy in the Railway UI). After build:

1. Railway → your service → **Settings** → **Networking** → **Generate Domain**. Copy the URL (`https://adgenius-api.up.railway.app` or similar).
2. Visit `https://<railway-host>/health` — you should see `{ "status": "ok", … }`.
3. Check logs: you should see `[adgenius-api] database connected` and `[adgenius-api] listening on …`.

### 2.4 Push the Prisma schema to Supabase

Railway → your service → **+ New Tab** → **Shell**:

```bash
npx prisma db push
```

(Use `npx prisma migrate deploy` if you've adopted migration files.)

---

## 3. Deploy the web app to Vercel

### 3.1 Create the project

1. vercel.com → **Add New** → **Project** → import the `adgenius-ai` repo
2. **Framework Preset**: Next.js (auto-detected)
3. **Root Directory**: `apps/web` (this is correct — the `vercel.json` at that path is monorepo-aware)
4. Leave **Build Command** / **Output Directory** at defaults (`vercel.json` overrides them)

### 3.2 Environment variables

Paste every key from [`apps/web/.env.production.example`](../apps/web/.env.production.example).
At minimum:

| Variable | Value |
|---|---|
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | `pk_live_…` from Clerk |
| `CLERK_SECRET_KEY` | `sk_live_…` from Clerk |
| `NEXT_PUBLIC_API_URL` | The Railway URL from § 2.3 (no trailing slash) |
| `ANTHROPIC_API_KEY` | `sk-ant-…` (server-side only — Vercel automatically keeps non-`NEXT_PUBLIC_` vars off the client bundle) |

### 3.3 Deploy

Click **Deploy**. After it lands, copy the Vercel URL (e.g. `https://adgenius-ai.vercel.app`).

---

## 4. Close the loop on CORS + OAuth callback URLs

Back in **Railway → Variables**, fill in the Vercel URL:

```
CORS_ORIGIN=https://adgenius-ai.vercel.app
FRONTEND_URL=https://adgenius-ai.vercel.app
```

And triple-check the four callback URIs use your **Railway** host
(`https://adgenius-api.up.railway.app/api/<platform>/callback`).

Trigger a redeploy in Railway so the new env vars take effect.

---

## 5. Update the OAuth apps with production callbacks

For each platform, add the production callback URL to its allow-list. The dev URL (`http://localhost:4000/...`) can stay alongside — both work.

| Platform | Where |
|---|---|
| **Meta** | developers.facebook.com → your app → Facebook Login for Business → Settings → **Valid OAuth Redirect URIs** |
| **Google** | console.cloud.google.com → APIs & Services → Credentials → your OAuth client → **Authorized redirect URIs** |
| **TikTok** | TikTok Marketing API portal → your app → Auth tab → **Redirect URIs** |
| **LinkedIn** | linkedin.com/developers → your app → Auth tab → **Authorized redirect URLs** |

---

## 6. Switch Clerk to production

Clerk Dashboard → **Production** instance:

1. **Configure → Domains**: add your Vercel host (`adgenius-ai.vercel.app`).
2. **API Keys**: copy the `pk_live_` + `sk_live_` and paste into Vercel env vars (overwriting any placeholder values).
3. Vercel → **Deployments** → **Redeploy** so the new keys take effect.

---

## 7. Smoke test the production deploy

1. Visit `https://<vercel-host>` → marketing landing loads.
2. **Sign Up** with a new email.
3. Wizard at `/onboarding` → fill in workspace name → **Go to Dashboard**.
4. Settings → **Integrations** → **Connect Meta** (or Google/TikTok/LinkedIn) → OAuth popup completes → card flips to **Connected**.
5. Campaigns → **New Campaign** → 4-step wizard → **Launch** → row appears.
6. Open the campaign → metrics + chart render.
7. AI Planner → describe a campaign → **Apply to Campaign** → modal opens with prefilled platforms / objective / budget.
8. Creatives → **Generate with AI** → save → grid shows it → hover → **Delete** removes it.

If any step fails:

- Check Railway logs for backend errors.
- Check the browser console for `NEXT_PUBLIC_API_URL`-mismatch errors.
- Confirm `CORS_ORIGIN` on Railway exactly matches the browser origin (no trailing slash, https only).

---

## 8. Custom domain (optional)

- **Vercel** → Project Settings → **Domains** → **Add**. Update DNS as instructed.
- **Railway** → Service Settings → **Networking** → **Custom Domain**. Update DNS.
- After domain swap, update Railway `CORS_ORIGIN` + `FRONTEND_URL`, OAuth callback URLs, and Clerk domain allow-list.

---

## 9. Rotating secrets

Anything that ever appeared in a screenshot, chat, or commit needs to be
rotated. The full list:

- Clerk: regenerate keys in dashboard → update Vercel env vars
- Anthropic: revoke + create new key → update both Vercel + Railway
- Meta / Google / TikTok / LinkedIn: rotate the App Secret on each platform → update Railway
- `ENCRYPTION_KEY`: **changing this invalidates every stored OAuth token.** You'd have to re-connect every ad account. Only rotate if you suspect the key leaked.
