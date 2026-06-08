# Meta Ads — Local End-to-End Test Guide

Connect your real Meta ad account locally, sync an existing campaign, and confirm it appears in your AdGenius dashboard.

> What this guide covers: **Option 1** — OAuth connect + read/sync.
> What this guide does NOT cover: publishing campaigns from AdGenius to Meta. That requires `metaService.createCampaign()` to be wired into a `POST /api/campaigns/:id/publish` route — separate work, separate doc.

---

## TL;DR

1. Set up an AdGenius Business Manager + Page + App (one-time, ~30 min)
2. Add yourself as Tester on the Meta App
3. Confirm local `.env` has the Meta vars
4. Start the API + Web dev servers
5. UI → Settings → Integrations → Connect Meta → OAuth popup
6. Create a draft campaign manually in Facebook Ads Manager
7. UI → Settings → Sync → see it appear in /campaigns

If it works, the entire dev integration is verified. If any step breaks, jump to [Troubleshooting](#troubleshooting).

---

## 0. Account strategy — read this first

Don't use your personal Facebook brand to send test ads. Here's the correct identity stack:

| Layer | Owner / Identity | Why |
|---|---|---|
| Your personal FB account (`Shahrukh`) | You | The human admin. Meta's TOS requires real-person admins. **Do not create a second "AdGenius" personal account** — bannable offense. |
| AdGenius Business Manager | Created **by** your personal account | Holds Pages, ad accounts, App. Transferable to teammates / future co-founders. |
| AdGenius Facebook Page | Owned by the BM | The "From" name on ads. Required for `ads_management` scope to actually publish. |
| AdGenius Meta App (developers.facebook.com) | Owned by the BM | The OAuth client your AdGenius code talks to. Same App used for Dev and Prod. |
| Test ad account | Inside the BM (System Users) | $0/day. Free test sandbox. |
| Real ad account | Inside the BM (when going live) | Real card, real targeting, real spend. |

Same BM, same App, same Page for both dev and prod. The only thing that changes is:
- Meta App **mode**: Development → Live
- Which **ad account** you connect: Test → Real

---

## 1. One-time setup (Facebook side)

### 1.1 Create the Business Manager

1. Open **[business.facebook.com](https://business.facebook.com)** while logged in as your personal FB.
2. Click **Create Account** (top-right or in the setup flow).
3. Name: `AdGenius`. Business email: your real email. Submit.
4. After creation, **Business Settings** opens. Your personal account is the admin.

### 1.2 Create the Facebook Page

1. Business Settings → **Accounts** → **Pages** → **Add** → **Create a new Page**.
2. Page name: `AdGenius`. Category: `Software` or `App Page`.
3. Save. You can leave the Page mostly empty for now — add logo/cover later.

> **Why a Page?** Meta refuses to publish ads with the `ads_management` scope unless your token holder has admin rights on a real Page. Even for testing, you need the Page to exist.

### 1.3 Create the Meta App

1. **[developers.facebook.com](https://developers.facebook.com)** → **My Apps** → **Create App**.
2. Use case: **Other**.
3. App type: **Business**.
4. App name: `AdGenius Dev` (or `AdGenius` — your call). Contact email: real.
5. **Business Account**: pick the `AdGenius` BM you just created.
6. Submit. You land in the App Dashboard.

### 1.4 Add the products

In the left sidebar:

- **Add Product** → **Facebook Login for Business** → Set Up
- **Add Product** → **Marketing API** → Set Up

### 1.5 Configure Facebook Login

1. Facebook Login for Business → **Settings**.
2. **Valid OAuth Redirect URIs** — add:
   ```
   http://localhost:4000/api/meta/callback
   https://adgeniusapi-production.up.railway.app/api/meta/callback
   ```
   (Local for dev, prod for when you deploy. No trailing slashes.)
3. Save Changes.

### 1.6 Confirm scopes

App Dashboard → **App Review** → **Permissions and Features**. Confirm these three appear (even unapproved is fine for dev):

- `ads_read`
- `ads_management`
- `business_management`

In Development mode they auto-grant to App Roles (testers/devs). For Live mode you'd need Meta's review process — separate concern.

### 1.7 Add yourself as a Tester

App Dashboard → **App Roles** → **Roles** → **Add People** → pick **Developer** or **Tester** → add your personal Facebook account.

> **Critical step.** If you skip this, the OAuth popup will silently refuse — "App Not Set Up" or just bounce you back without a token. This is the single most common Meta dev gotcha.

### 1.8 Grab the credentials

App Dashboard → **Settings** → **Basic**:

- **App ID** → copy
- **App Secret** → click **Show**, enter your password, copy

Keep these somewhere safe (password manager). NEVER paste them in chat, screenshots, commits, or `.env.example` files.

---

## 2. Local environment config

Open `apps/api/.env` (already gitignored). Confirm these lines exist with real values:

```bash
META_APP_ID=<your App ID from step 1.8>
META_APP_SECRET=<your App Secret from step 1.8>
META_REDIRECT_URI=http://localhost:4000/api/meta/callback
FRONTEND_URL=http://localhost:3000
WEB_ORIGIN=http://localhost:3000
CORS_ORIGIN=http://localhost:3000
```

> If you already had Meta vars from earlier setup, double-check `META_REDIRECT_URI` matches **exactly** what's in step 1.5 — Meta does byte-level string comparison.

Open `apps/web/.env.local`. Confirm:

```bash
NEXT_PUBLIC_API_URL=http://localhost:4000
```

---

## 3. Start the dev stack

Two terminals.

### Terminal 1 — API

```powershell
cd c:\Users\Shahr\OneDrive\Desktop\review_test\adgenius-ai\apps\api
npx prisma generate
npm run dev
```

Wait for:

```
[adgenius-api] database connected
[adgenius-api] listening on http://localhost:4000 (development)
[adgenius-api] CORS allowed origins: http://localhost:3000
```

If you see `DATABASE_URL is required` — your `.env` is missing it. If `database connected` never prints — Postgres isn't running locally. Fix Postgres before continuing.

### Terminal 2 — Web

```powershell
cd c:\Users\Shahr\OneDrive\Desktop\review_test\adgenius-ai\apps\web
npm run dev
```

Wait for:

```
▲ Next.js 14.2.35
- Local: http://localhost:3000
- Ready in Xs
```

Open **http://localhost:3000** in a browser.

---

## 4. Connect Meta in the AdGenius UI

1. Sign in (use whatever Clerk dev account you've been testing with).
2. Get past onboarding to the dashboard.
3. Sidebar → **Settings** → **Integrations** tab.
4. **Meta** card → **Connect Meta** button.
5. A Facebook OAuth popup opens.
6. Log in with your **personal** FB account (the one added as Tester in step 1.7).
7. Review permissions screen → **Continue** → **Continue as Shahrukh**.
8. Popup closes after ~3 seconds.

### What success looks like

- Toast in the bottom-right: **"Meta account connected"**
- Meta card flips to **"Connected"** with the account name shown
- Sidebar's connected-platforms strip shows the Meta logo

### What it logs (API terminal)

```
GET /api/meta/oauth-url 200 12ms
GET /api/meta/callback 302 245ms
GET /api/ad-accounts 200 18ms
```

---

## 5. Create a test campaign on Meta side

This step proves the sync path works. We create the campaign manually in Ads Manager, then pull it down through our app.

1. **business.facebook.com/adsmanager** → log in with the same FB account.
2. Top-left account selector → pick your ad account (the one connected in step 4).
3. **Create** → **Campaign**.
4. Buying type: **Auction**.
5. Objective: **Awareness** (cheapest, no audience required).
6. Campaign name: `AdGenius Test 1`.
7. **Special Ad Categories** → none.
8. Budget at campaign level: $1/day.
9. **Save as Draft** at the top — DO NOT click Publish. We just need a row to sync.

> ⚠ Save as Draft. If you publish, Meta starts charging the moment the campaign goes live.

The campaign now exists in your ad account as `DRAFT` status.

---

## 6. Sync it back into AdGenius

1. AdGenius → Settings → Integrations → Meta card → click **Sync**.
2. Loading toast: "Syncing Meta campaigns…"
3. Wait 5-15 seconds (Meta's Insights API is slow).
4. Success toast: `Synced 1 campaigns · 0 metric rows` (0 metrics because the campaign was never published — no impressions).

### Verify in the UI

- **Sidebar → Campaigns** — your `AdGenius Test 1` campaign appears with platform `META`, status `DRAFT`, budget `$1`.
- Click the campaign → metrics page loads (chart will be empty since no published data).
- **Sidebar → Dashboard** — total campaigns count includes the new one.

### What it logs

```
POST /api/meta/sync/<id> 200 8200ms
GET /api/campaigns?... 200 22ms
```

---

## 7. Clean up

Don't forget:

1. **Facebook Ads Manager** → delete or pause the test campaign so it can never accidentally publish or charge.
2. (Optional) Disconnect the Meta integration in AdGenius if you want a clean slate: Settings → Meta card → Disconnect.

---

## Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| Popup doesn't open at all | Browser pop-up blocker | Allow popups for `localhost:3000` |
| Popup says "Cannot load URL: the domain of this URL isn't included in the app's domains" | `META_REDIRECT_URI` in `.env` doesn't match Facebook Login's Valid OAuth Redirect URIs **byte-for-byte** | Re-copy the exact string to both places. No trailing slash. `http://` not `https://` for local. |
| Popup says "App Not Set Up: This app is still in development mode, and you do not have access to it" | Your FB account isn't a Tester | Step 1.7 — add yourself as Developer or Tester |
| Popup says "Invalid Scopes" | Marketing API product not added | Step 1.4 |
| Popup closes but toast says "Meta connect failed. Please try again." | API errored during code exchange. Check API terminal for `[meta/callback] error:` | Common: `META_APP_SECRET` wrong, or `META_REDIRECT_URI` mismatch |
| Toast says "Finish onboarding before connecting Meta" | Your AdGenius user has no workspace | Complete the onboarding wizard first |
| Sync button → toast says "Sync failed: Meta API: Error validating access token..." | Stored token expired (60-day cap) or you revoked it on Facebook side | Disconnect + reconnect Meta |
| Sync succeeds but `Synced 0 campaigns` | Campaign in FB is in a state we don't see (e.g. archived) or the wrong ad account is connected | Confirm in Ads Manager that the campaign is in the same ad account that's listed in the AdGenius Meta card |

### Where the relevant code lives

- OAuth flow: [apps/api/src/routes/meta.ts](../apps/api/src/routes/meta.ts)
- Token encrypt/decrypt: [apps/api/src/lib/crypto.ts](../apps/api/src/lib/crypto.ts)
- Graph API client: [apps/api/src/services/meta.service.ts](../apps/api/src/services/meta.service.ts)
- Sync logic: [apps/api/src/services/sync.service.ts](../apps/api/src/services/sync.service.ts)
- UI connect card: [apps/web/components/settings/MetaConnect.tsx](../apps/web/components/settings/MetaConnect.tsx)

---

## What's next (publishing)

Today's flow proves **OAuth + read/sync**. To actually create a campaign in AdGenius and have it appear in Facebook Ads Manager, we need to wire:

1. `POST /api/campaigns/:id/publish` — calls `metaService.createCampaign()` (already exists, currently dead code)
2. UI "Publish to Meta" button on `/campaigns/[id]` for DRAFT campaigns
3. Objective mapping (`Conversions` → `OUTCOME_SALES`, `Awareness` → `OUTCOME_AWARENESS`, etc.)

Even after that's wired, the published campaign is just a **container** on Meta — it won't run real ads until you create ad sets, creatives, and ads. That's separate work (~1 week to build a real authoring flow).

Realistic phased plan:
- **Phase A** (1 evening): Publish campaign + flip status. Campaign exists in Ads Manager, but empty.
- **Phase B** (~1 week): Create ad set, upload creative image, create ad — so the campaign actually runs.

When you're ready for Phase A, ping me and I'll build it.

---

## Going to production (later)

Same Meta App, same Business Manager, same Page. Just three switches:

1. App Dashboard → toggle from **Development** to **Live** (requires Meta business verification — multi-day review process)
2. App Review → submit `ads_read`, `ads_management`, `business_management` for review with use-case justifications
3. Replace test ad account with real ad account (add payment method)

The OAuth URLs, the code, the encryption — all unchanged. The `META_REDIRECT_URI` is already configured for production (see step 1.5).

See [docs/DEPLOY.md](DEPLOY.md) for the deploy-side checklist.
