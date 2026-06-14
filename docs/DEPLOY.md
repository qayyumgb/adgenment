# Advertix â€” Deployment Guide

End-to-end deploy: **Frontend â†’ Vercel**, **Backend â†’ Railway**, **Database â†’ Supabase**.

> âš  **Never paste real secrets into git-tracked files**, including `.env.example` /
> `.env.production.example`. Those are templates; real values go in Vercel / Railway
> dashboards only. If you accidentally commit a secret, rotate it immediately.

---

## 0. Prerequisites

- GitHub repo with the `main` branch up-to-date
- **Supabase** project (Postgres ready)
- **Vercel** account (free tier is fine)
- **Railway** account (Hobby plan or higher)
- **Clerk** production instance (separate from your dev instance)
- Production OAuth apps for **Meta**, **Google Ads**, **TikTok**, **LinkedIn** â€” or a plan to add their production callback URLs to your existing dev apps

You should already have:

- `npx tsc --noEmit` clean in both `apps/api` and `apps/web`
- `npm run build` working locally for both apps (see Â§ 7)

---

## 1. Generate production secrets

Before you touch a dashboard, generate the values you'll paste in.

```bash
# AES-256 token-encryption key (used by apps/api/src/lib/crypto.ts)
openssl rand -hex 32
```

Other secrets are obtained from each platform's dashboard â€” record them somewhere safe (e.g. 1Password) but **never** put them in a tracked file.

---

## 2. Deploy the API to Railway

The repo is a **pnpm/npm workspaces monorepo** with a single `package-lock.json`
at the root. The `apps/api/Dockerfile` reflects that â€” its build context must
be the **repo root**, not `apps/api`.

### 2.1 Create the service

1. railway.app â†’ **New Project** â†’ **Deploy from GitHub repo**
2. Pick the `advertix` repo
3. After the empty service is created, open **Settings**:
   - **Root Directory**: leave **blank** (or set to `/`). Do **not** set it to `apps/api` â€” the Dockerfile needs visibility into the repo root.
   - **Build Method**: **Dockerfile**
   - Set the env var **`RAILWAY_DOCKERFILE_PATH=apps/api/Dockerfile`** (Variables tab) â€” this tells Railway where the Dockerfile lives inside the (root-level) build context.

### 2.2 Set environment variables

In **Variables**, paste every key from
[`apps/api/.env.production.example`](../apps/api/.env.production.example).
Replace the placeholder values:

| Variable | Where to get it |
|---|---|
| `DATABASE_URL` | Supabase â†’ Project Settings â†’ Database â†’ **Connection string** (URI / Session-pooler, port 5432). For PgBouncer (6543), append `?pgbouncer=true&connection_limit=1` |
| `CLERK_SECRET_KEY` | Clerk Dashboard â†’ **Production** instance â†’ API Keys |
| `ANTHROPIC_API_KEY` | console.anthropic.com â†’ API Keys |
| `ENCRYPTION_KEY` | The `openssl rand -hex 32` value from Â§ 1 |
| `CORS_ORIGIN` | Your Vercel URL â€” **fill in after Â§ 3** (`https://your-app.vercel.app`) |
| `FRONTEND_URL` | Same Vercel URL |
| `META_APP_ID`/`SECRET` | developers.facebook.com â†’ your app â†’ Settings â†’ Basic |
| `META_REDIRECT_URI` | `https://<your-railway-host>/api/meta/callback` |
| `GOOGLE_CLIENT_ID`/`SECRET` | Google Cloud Console â†’ OAuth 2.0 Client IDs |
| `GOOGLE_REDIRECT_URI` | `https://<your-railway-host>/api/google/callback` |
| `GOOGLE_DEVELOPER_TOKEN` | Google Ads â†’ API Center |
| `TIKTOK_APP_ID`/`SECRET` | TikTok Marketing API portal â†’ your app |
| `TIKTOK_REDIRECT_URI` | `https://<your-railway-host>/api/tiktok/callback` |
| `LINKEDIN_CLIENT_ID`/`SECRET` | LinkedIn Developer Portal â†’ your app â†’ Auth |
| `LINKEDIN_REDIRECT_URI` | `https://<your-railway-host>/api/linkedin/callback` |
| `NODE_ENV` | `production` |
| `PORT` | leave unset â€” Railway injects its own |

### 2.3 First deploy

Push to `main` (or trigger a deploy in the Railway UI). After build:

1. Railway â†’ your service â†’ **Settings** â†’ **Networking** â†’ **Generate Domain**. Copy the URL (`https://advertix-api.up.railway.app` or similar).
2. Visit `https://<railway-host>/health` â€” you should see `{ "status": "ok", â€¦ }`.
3. Check logs: you should see `[advertix-api] database connected` and `[advertix-api] listening on â€¦`.

### 2.4 Push the Prisma schema to Supabase

Railway â†’ your service â†’ **+ New Tab** â†’ **Shell**:

```bash
npx prisma db push
```

(Use `npx prisma migrate deploy` if you've adopted migration files.)

---

## 3. Deploy the web app to Vercel

### 3.1 Create the project

1. vercel.com â†’ **Add New** â†’ **Project** â†’ import the `advertix` repo
2. **Framework Preset**: Next.js (auto-detected)
3. **Root Directory**: `apps/web` (this is correct â€” the `vercel.json` at that path is monorepo-aware)
4. Leave **Build Command** / **Output Directory** at defaults (`vercel.json` overrides them)

### 3.2 Environment variables

Paste every key from [`apps/web/.env.production.example`](../apps/web/.env.production.example).
At minimum:

| Variable | Value |
|---|---|
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | `pk_live_â€¦` from Clerk |
| `CLERK_SECRET_KEY` | `sk_live_â€¦` from Clerk |
| `NEXT_PUBLIC_API_URL` | The Railway URL from Â§ 2.3 (no trailing slash) |
| `ANTHROPIC_API_KEY` | `sk-ant-â€¦` (server-side only â€” Vercel automatically keeps non-`NEXT_PUBLIC_` vars off the client bundle) |

### 3.3 Deploy

Click **Deploy**. After it lands, copy the Vercel URL (e.g. `https://advertix.vercel.app`).

---

## 4. Close the loop on CORS + OAuth callback URLs

Back in **Railway â†’ Variables**, fill in the Vercel URL:

```
CORS_ORIGIN=https://advertix.vercel.app
FRONTEND_URL=https://advertix.vercel.app
```

And triple-check the four callback URIs use your **Railway** host
(`https://advertix-api.up.railway.app/api/<platform>/callback`).

Trigger a redeploy in Railway so the new env vars take effect.

---

## 5. Update the OAuth apps with production callbacks

For each platform, add the production callback URL to its allow-list. The dev URL (`http://localhost:4000/...`) can stay alongside â€” both work.

| Platform | Where |
|---|---|
| **Meta** | developers.facebook.com â†’ your app â†’ Facebook Login for Business â†’ Settings â†’ **Valid OAuth Redirect URIs** |
| **Google** | console.cloud.google.com â†’ APIs & Services â†’ Credentials â†’ your OAuth client â†’ **Authorized redirect URIs** |
| **TikTok** | TikTok Marketing API portal â†’ your app â†’ Auth tab â†’ **Redirect URIs** |
| **LinkedIn** | linkedin.com/developers â†’ your app â†’ Auth tab â†’ **Authorized redirect URLs** |

---

## 6. Switch Clerk to production

Clerk Dashboard â†’ **Production** instance:

1. **Configure â†’ Domains**: add your Vercel host (`advertix.vercel.app`).
2. **API Keys**: copy the `pk_live_` + `sk_live_` and paste into Vercel env vars (overwriting any placeholder values).
3. Vercel â†’ **Deployments** â†’ **Redeploy** so the new keys take effect.

---

## 7. Smoke test the production deploy

1. Visit `https://<vercel-host>` â†’ marketing landing loads.
2. **Sign Up** with a new email.
3. Wizard at `/onboarding` â†’ fill in workspace name â†’ **Go to Dashboard**.
4. Settings â†’ **Integrations** â†’ **Connect Meta** (or Google/TikTok/LinkedIn) â†’ OAuth popup completes â†’ card flips to **Connected**.
5. Campaigns â†’ **New Campaign** â†’ 4-step wizard â†’ **Launch** â†’ row appears.
6. Open the campaign â†’ metrics + chart render.
7. AI Planner â†’ describe a campaign â†’ **Apply to Campaign** â†’ modal opens with prefilled platforms / objective / budget.
8. Creatives â†’ **Generate with AI** â†’ save â†’ grid shows it â†’ hover â†’ **Delete** removes it.

If any step fails:

- Check Railway logs for backend errors.
- Check the browser console for `NEXT_PUBLIC_API_URL`-mismatch errors.
- Confirm `CORS_ORIGIN` on Railway exactly matches the browser origin (no trailing slash, https only).

---

## 8. Custom domain (optional)

- **Vercel** â†’ Project Settings â†’ **Domains** â†’ **Add**. Update DNS as instructed.
- **Railway** â†’ Service Settings â†’ **Networking** â†’ **Custom Domain**. Update DNS.
- After domain swap, update Railway `CORS_ORIGIN` + `FRONTEND_URL`, OAuth callback URLs, and Clerk domain allow-list.

---

## 9. Rotating secrets

Anything that ever appeared in a screenshot, chat, or commit needs to be
rotated. The full list:

- Clerk: regenerate keys in dashboard â†’ update Vercel env vars
- Anthropic: revoke + create new key â†’ update both Vercel + Railway
- Meta / Google / TikTok / LinkedIn: rotate the App Secret on each platform â†’ update Railway
- `ENCRYPTION_KEY`: **changing this invalidates every stored OAuth token.** You'd have to re-connect every ad account. Only rotate if you suspect the key leaked.
