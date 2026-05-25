# Ad Platform Integration Setup

This document walks you through connecting each ad platform end-to-end. **Everything in this guide is one-time setup by you (the platform owner)** — your end users never see any of this. They click "Connect Meta" / "Connect Google Ads" in the dashboard and authorize with their own account in three clicks.

---

## Table of Contents

- [Overview: what's actually required](#overview)
- [Generate an ENCRYPTION_KEY (do this first)](#encryption-key)
- [Meta (Facebook + Instagram) integration](#meta-integration)
- [Google Ads integration](#google-ads-integration)
- [Production: verification & launch checklist](#production)
- [Troubleshooting](#troubleshooting)

---

## Overview

### What end users see

1. They sign in to AdGenius.
2. They click **Connect Apps** in the sidebar.
3. A popup opens with the ad platform's sign-in screen (Facebook / Google).
4. They approve permissions.
5. Popup closes, modal updates: **Connected** with their account name.

That's it. No env vars, no developer tokens, no Google Cloud Console.

### What you (the developer) need to set up — once, ever

| Platform | Cost | One-time setup time | Production gating |
|---|---|---|---|
| Meta | Free | ~15 min | App review for some scopes |
| Google Ads | Free (if you use a Manager account) | ~30 min | OAuth verification + developer token tier upgrade |

### Environment variables this guide will set

All of these go in **[apps/api/.env](../apps/api/.env)** (gitignored, never committed):

```
# Token encryption
ENCRYPTION_KEY=

# Meta
META_APP_ID=
META_APP_SECRET=
META_REDIRECT_URI=http://localhost:4000/api/meta/callback

# Google Ads
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_REDIRECT_URI=http://localhost:4000/api/google/callback
GOOGLE_DEVELOPER_TOKEN=

# Where OAuth callbacks redirect after success/failure
FRONTEND_URL=http://localhost:3000
```

> 💡 You can leave any platform's vars empty — the **Connect [Platform]** button will throw a helpful error in the API terminal but the rest of the app keeps working.

---

## Encryption key

Both Meta and Google access tokens are encrypted at rest with AES-256-CBC. The key is shared across all integrations and **must be set before either integration works**.

**Generate one (Windows PowerShell):**
```powershell
-join ((1..32) | ForEach-Object { '{0:x2}' -f (Get-Random -Max 256) })
```

**Or macOS / Linux:**
```bash
openssl rand -hex 32
```

You'll get a 64-character hex string like `a1b2c3...`. Paste it as `ENCRYPTION_KEY=...` in `apps/api/.env`. Any non-empty string works (we hash it to 32 bytes via SHA-256 internally), but a 64-hex-char value is the recommended strength.

> ⚠️ **Once you have encrypted tokens stored**, changing this key breaks decryption for every stored ad account. Treat it like a database password — rotate only with a planned migration.

---

## Meta integration

### Prerequisites

- A personal Facebook account (used to administer the Meta app)
- About 15 minutes

### Step 1 — Create a Meta App

1. Go to <https://developers.facebook.com/apps>
2. Click the green **Create App** button (top-right)
3. **What do you want your app to do?** → select **Other** at the bottom of the list → **Next**
4. **Select an app type** → pick **Business** → **Next**
5. Fill in:
   - **App name**: `AdGenius AI Dev` (any name; users won't see this until production)
   - **App contact email**: your email
   - **Business portfolio**: leave blank for now
6. Click **Create App**

You'll land on the App Dashboard.

### Step 2 — Add the products you need

On the App Dashboard:

1. Scroll down to "Add products to your app"
2. Find **Marketing API** → click **Set up**
3. Find **Facebook Login for Business** (or "Facebook Login" if that's the only one) → click **Set up**

### Step 3 — Configure the OAuth redirect URI

1. Left sidebar → **Facebook Login** → **Settings**
2. Find **Valid OAuth Redirect URIs** → paste:
   ```
   http://localhost:4000/api/meta/callback
   ```
3. Click **Save Changes** at the bottom

### Step 4 — Grab your credentials

1. Left sidebar → **App settings** → **Basic** (sometimes shown as just "Basic" under Settings)
2. Copy the **App ID** (visible)
3. **App Secret** → click **Show** → re-enter your Facebook password → copy the value

### Step 5 — Add test users (development only)

While the app is in development mode, only people you've added as App Roles can authenticate.

1. Left sidebar → **App Roles** → **Roles** (or "Roles" depending on the UI version)
2. Add yourself as an **Administrator** (usually already added since you created the app)
3. To let teammates test: **Add People** → enter their Facebook URL or email → assign a role

### Step 6 — Update `apps/api/.env`

```
META_APP_ID=<your App ID>
META_APP_SECRET=<your App Secret>
META_REDIRECT_URI=http://localhost:4000/api/meta/callback
```

Don't forget `ENCRYPTION_KEY` and `FRONTEND_URL` from above.

### Step 7 — Test

1. **Restart the API**: in the API terminal, `Ctrl+C` → `npm run dev`
2. Sign into the dashboard at <http://localhost:3000>
3. Sidebar → **Connect Apps** → click **Connect** next to Meta
4. A popup opens with Facebook
5. Click **Continue as [Your Name]** → grant permissions
6. Popup auto-closes; modal updates to show your Meta ad account with the green **Connected** badge

### Meta scopes used

We request these scopes (configured in `apps/api/src/services/meta.service.ts`):

- `ads_read` — list ad accounts and campaigns
- `ads_management` — create/pause/update campaigns and ad sets
- `business_management` — access Business Manager assets

> `instagram_basic` was previously included but is **deprecated** in newer Meta API versions. Ad management already covers Instagram placements (Instagram ads run on Meta's ad infrastructure).

### Meta common errors

| Error you see | Cause | Fix |
|---|---|---|
| "Invalid Scopes: instagram_basic" | Deprecated scope was sent | Already removed in current code; pull latest |
| "URL Blocked: redirect URI not whitelisted" | Redirect URI mismatch | Check Step 3 — must be exact match |
| Popup shows Facebook login screen instead of consent | Already authorized, just click Continue | Normal flow |
| "Sorry, this feature isn't available right now" | App not approved for `ads_management` (dev only) | Add yourself as test user (Step 5) |

---

## Google Ads integration

### Prerequisites

- A Google account
- A Google Ads Manager (MCC) account — **don't try with a regular Ads account**, the regular flow forces campaign creation + billing
- About 30 minutes (most of it waiting for the developer token approval, which is usually instant for Basic access)

### Step 1 — Create a Google Cloud project

1. Go to <https://console.cloud.google.com/>
2. Top-left dropdown → **New Project**
3. Name it `AdGenius AI Dev` → **Create**
4. Wait ~10 seconds, then make sure the new project is selected in the dropdown

### Step 2 — Enable the Google Ads API

1. Hamburger menu → **APIs & Services** → **Library**
2. Search for **Google Ads API**
3. Click the result → **Enable**

Wait ~30 seconds for activation.

### Step 3 — Configure the OAuth consent screen

In newer Google Cloud UI this is under "Google Auth Platform":

1. Left sidebar → **APIs & Services** → **OAuth consent screen** (or **Google Auth Platform** in the new UI)
2. Click **Get started**
3. Wizard:
   - **App name**: `AdGenius AI Dev`
   - **User support email**: pick your email
   - **Audience**: **External**
   - **Contact information**: your email
   - **Agree to API Services User Data Policy** → **Continue** / **Create**

### Step 4 — Add yourself as a test user

While the app is in Testing mode, only listed test users can complete OAuth.

1. Left sidebar → **Audience** (inside Google Auth Platform)
2. Scroll to **Test users** → **+ Add Users**
3. Add the Gmail you'll use to test → **Save**

### Step 5 — Create an OAuth 2.0 Client

1. Left sidebar → **Clients** (or **Credentials** in the older UI)
2. Click **+ Create OAuth client** (or **+ Create Credentials → OAuth client ID**)
3. **Application type**: **Web application**
4. **Name**: `AdGenius AI Dev`
5. Under **Authorized redirect URIs** → **+ Add URI**:
   ```
   http://localhost:4000/api/google/callback
   ```
6. Click **Create**

A dialog shows your **Client ID**. The newer UI no longer shows the **Client Secret** inline — click **Download JSON**, open the file, and copy the `client_secret` value (starts with `GOCSPX-`).

### Step 6 — Get the developer token (Manager account)

Developer tokens come from Google **Ads**, not Google **Cloud**. You need a Google Ads Manager (MCC) account for this — it avoids the regular Ads signup's forced campaign + billing.

1. Go to <https://ads.google.com/home/tools/manager-accounts/>
2. Click **Create a manager account**
3. Fill in:
   - **Account name**: `AdGenius Dev`
   - **Account type**: **Manage my own multiple accounts**
   - **Country**, **Time zone**, **Currency**: your values
4. **Submit** — no billing, no campaign step. You're now inside the MCC dashboard.
5. Top-right wrench icon → **Tools & Settings** → **Setup** → **API Center**
6. Fill the developer token application:
   - **Company name**: `AdGenius AI`
   - **Website URL**: any URL (your landing page or `http://localhost:3000` works for dev)
   - **API access level**: request **Basic** (auto-approved for most accounts within minutes)
   - **Use case**: "Manage Google Ads accounts I own / clients consent to"
7. Submit → check email; usually approved within 5 minutes
8. Back in API Center → copy the **Developer token**

> ⚠️ **In some regions** Google has tightened policies and even MCC creation may require verification with a card. If you hit this, you can skip Google integration entirely — Meta alone fully demos the product, and Google can be added later for a paying customer who needs it.

### Step 7 — Update `apps/api/.env`

```
GOOGLE_CLIENT_ID=<your Client ID>.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-...
GOOGLE_REDIRECT_URI=http://localhost:4000/api/google/callback
GOOGLE_DEVELOPER_TOKEN=<your developer token>
```

### Step 8 — Test

1. Restart the API: `Ctrl+C` → `npm run dev`
2. In the dashboard → **Connect Apps** → click **Connect** next to Google Ads
3. A popup opens with Google sign-in
4. Sign in with the Google account you added as a test user (Step 4)
5. Click **Continue** on the consent screen
6. Popup auto-closes; modal updates to show your Google Ads customer with the green **Connected** badge

### Testing without a developer token

If you don't have a developer token yet (e.g. you're waiting on MCC approval), you can still test the OAuth half:

- Set `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI` — leave `GOOGLE_DEVELOPER_TOKEN` empty
- Click **Connect Google Ads** in the dashboard
- The popup will load Google sign-in ✓
- You'll see the consent screen ✓
- Click Continue → popup closes with a **toast error** ("Google connect failed")
- API terminal shows: `Error: GOOGLE_DEVELOPER_TOKEN is not configured`

That confirms the popup + OAuth half works. To complete the integration, finish Step 6.

### Google scopes used

- `https://www.googleapis.com/auth/adwords` — full read + write access to Google Ads accounts the user owns / manages

### Google common errors

| Error | Cause | Fix |
|---|---|---|
| "Access blocked: AdGenius has not completed verification" | App in testing mode, but you're not on the test users list | Step 4 |
| `error=google_no_customers` toast | Authorized successfully but the Google account has no Ads accounts | Switch to a Google account that's a manager or member of a Google Ads customer |
| `DEVELOPER_TOKEN_NOT_APPROVED` | Developer token in test mode trying to access a production Google Ads account | Either upgrade token to Basic, or test against a Google Ads test account |
| `redirect_uri_mismatch` | The redirect URI in your code doesn't exactly match what's in Google Cloud Console | Make sure the URI matches Step 5 exactly (no trailing slash, http vs https) |
| MCC asks for billing during creation | Region-specific Google policy | See note in Step 6 — skip Google integration for now |

---

## Production

### Before going live, both platforms require verification

| Step | Meta | Google |
|---|---|---|
| App review for sensitive scopes | Required for `ads_management`, `business_management` | Required for `adwords` |
| Time | 1–4 weeks | 4–8 weeks |
| What you submit | Privacy policy URL, ToS, demo video, app icon, screencast | Same + DNS-verified domain ownership |
| In the meantime | Up to ~25 users via Test Users list | Up to ~100 users via Test Users list |

### Developer token tier (Google only)

| Tier | What it does | When to apply |
|---|---|---|
| Test access | Only works with Google Ads test accounts | Default when you apply |
| **Basic access** | Production-ready, ~15k ops/day per customer | Day 1 of any real users — apply immediately, auto-approved usually |
| Standard access | Unlimited | Only when you outgrow Basic (~thousands of users) — 1–3 week manual review |

### Production environment variables

In your production `apps/api/.env` (managed in your hosting provider's secret manager, not committed to git):

```
META_REDIRECT_URI=https://api.adgenius.ai/api/meta/callback
GOOGLE_REDIRECT_URI=https://api.adgenius.ai/api/google/callback
FRONTEND_URL=https://app.adgenius.ai
```

Then go back to Meta App Dashboard / Google Cloud Console and add the production URLs to the authorized redirect lists (alongside the localhost ones — keep both for parallel dev access).

### Production launch checklist

- [ ] Privacy policy hosted on your production domain
- [ ] Terms of service hosted on your production domain
- [ ] DNS-verified domain ownership in Google Cloud Console
- [ ] Meta App submitted for review (`ads_management`, `business_management`, `ads_read`)
- [ ] Google Ads developer token at **Basic access** tier
- [ ] Production `GOOGLE_REDIRECT_URI` + `META_REDIRECT_URI` added to authorized lists
- [ ] `ENCRYPTION_KEY` is a fresh 64-hex-char value (not reused from dev)
- [ ] Database `DATABASE_URL` points at your production Postgres
- [ ] Rate limiter switched from in-memory to Redis (see [IMPLEMENTATION.md → Known TODOs](../IMPLEMENTATION.md))
- [ ] OAuth `state` parameter is a server-side random nonce, not the user ID (see SECURITY TODO in `routes/meta.ts` and `routes/google.ts`)

---

## Troubleshooting

### Popup blocks / doesn't open

- Modern browsers block popups not triggered by a direct user click. Our "Connect" button calls `window.open` synchronously inside the click handler — should be fine. If still blocked:
  - Check browser address bar for a blocked-popup icon
  - Whitelist `localhost:3000` (or your prod domain) in browser settings

### Popup opens but never closes

- Cause: COOP (Cross-Origin-Opener-Policy) header severed the parent ↔ popup relationship
- We've already set `crossOriginOpenerPolicy: same-origin-allow-popups` in `apps/api/src/index.ts` — if you somehow turned this off, popup messaging breaks
- Fallback: BroadcastChannel works regardless of opener — already wired

### Token expired errors during sync

- **Meta**: long-lived tokens last ~60 days. After expiry, the user has to reconnect (no automatic refresh path yet).
- **Google**: access tokens last ~1 hour but we store the refresh token. The sync service auto-refreshes on 401 in [sync.service.ts](../apps/api/src/services/sync.service.ts).

### "GOOGLE_DEVELOPER_TOKEN is not configured"

- The OAuth flow worked but the next Ads API call needs the token
- See [Google Step 6](#step-6--get-the-developer-token-manager-account) or just leave Google connect alone if you're focusing on Meta

### Encryption errors when sync runs

- "Invalid encrypted token format" usually means the `ENCRYPTION_KEY` env var changed between when the token was encrypted and when it was decrypted
- Re-connect the platform to re-encrypt with the new key

### Where to find logs

- API server terminal — every request logs `METHOD PATH STATUS MS`
- Errors are logged to the same terminal with full stack traces in dev mode
- Frontend errors → browser DevTools Console
- For OAuth-specific issues: check the **Network** tab in DevTools, filter by `meta` or `google`, look at the response of the `/callback` request
