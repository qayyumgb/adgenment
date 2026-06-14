# Production Launch Guide

End-to-end runbook for taking Advertix from "Vercel + Railway prototype" to "real customers can sign up and run real Facebook ads."

> Estimated total time: **3-4 hours of your active work** + **2-3 weeks of waiting** (Meta App Review, Business Verification). Most steps can run in parallel â€” start the things with external clocks first.

---

## Phases at a glance

| # | Phase | Your active time | Wait time | Blocks what |
|---|---|---|---|---|
| 1 | Buy domain + set up DNS | ~30 min | 1-24h (DNS propagation) | Everything else |
| 2 | Attach domain to Vercel + update env vars | ~20 min | Instant | Production traffic |
| 3 | Create production Facebook Business Manager + Page | ~30 min | None | Meta integrations |
| 4 | Set up production Meta App (separate from dev) | ~30 min | None | App Review |
| 5 | Business Verification (Meta) | ~20 min to submit | 1-3 days | App Review approval |
| 6 | Privacy Policy + Terms pages on the new domain | ~10 min review | None | App Review |
| 7 | Move Clerk to a production instance | ~20 min | Instant | Real user signups |
| 8 | Submit Meta App Review for Marketing API tier upgrade | ~1 hour | 5-14 days | Real ad publishing |
| 9 | Test end-to-end with real Meta ad | ~30 min | None | Done |

Phases 5, 7, and 8 can all be in-flight in parallel.

---

## Phase 1 â€” Buy the domain + DNS

### 1.1 Buy at Cloudflare Domains

1. Open [cloudflare.com/products/registrar](https://cloudflare.com/products/registrar)
2. Sign in / create a Cloudflare account
3. Search your candidate (e.g. `getadvertix.com`, `adcopilot.ai`)
4. Buy. Cloudflare charges at-cost (no markup, no upsell). WHOIS privacy is free.

> **Why Cloudflare**: cheapest, free privacy, DNS is included (no separate service), auto-renew. Avoid GoDaddy/Squarespace â€” they double the price at renewal.

### 1.2 Set up DNS records

After purchase, Cloudflare auto-creates the zone. You need two records:

| Type | Name | Content | Proxy |
|---|---|---|---|
| CNAME | `@` (apex) | `cname.vercel-dns.com` | DNS only (gray cloud) |
| CNAME | `app` | `cname.vercel-dns.com` | DNS only (gray cloud) |

> **Important**: Set "Proxy status" to **DNS only** (gray cloud) â€” not "Proxied" (orange cloud). Vercel handles SSL itself; Cloudflare proxying causes 525 errors during cert handshake.

If your TLD doesn't accept CNAME on the apex (some still don't), use:

| Type | Name | Content |
|---|---|---|
| A | `@` | `76.76.21.21` (Vercel's IP) |
| CNAME | `app` | `cname.vercel-dns.com` |

### 1.3 Verify DNS propagation

After saving, wait 5-30 minutes. Then:

```powershell
nslookup yourdomain.com
nslookup app.yourdomain.com
```

Both should resolve to Vercel-controlled IPs. If they don't, wait longer (up to 24h, rare).

---

## Phase 2 â€” Attach domain to Vercel + update env vars

### 2.1 Add domains to Vercel

1. Vercel â†’ your project â†’ **Settings** â†’ **Domains**
2. Click **Add** â†’ enter `yourdomain.com` â†’ Add
3. Click **Add** again â†’ enter `app.yourdomain.com` â†’ Add
4. Vercel will show DNS instructions. Since you already configured DNS in Phase 1.2, both should show **âœ“ Valid Configuration** within minutes.
5. Vercel auto-provisions SSL certificates via Let's Encrypt â€” completes in ~1-2 min.

### 2.2 Decide which domain serves which content

Two options for now:

**Option A (simplest, recommended for launch)** â€” both domains serve the same Next.js app:
- `yourdomain.com` â†’ Marketing landing (your current `/` page) + Privacy + Terms
- `app.yourdomain.com` â†’ Same app, users naturally land here after sign-in
- No code change needed; Next.js doesn't differentiate by host out of the box

**Option B (more advanced)** â€” split marketing site (apex) from app (subdomain):
- Run two Vercel projects, one Next.js for marketing, one for the dashboard
- More setup, deferred until you have real content for the marketing site

**Go with Option A now.** Revisit if/when you build a real marketing site.

### 2.3 Update env vars across Vercel + Railway

**On Vercel** â†’ Project Settings â†’ Environment Variables:

| Var | New value |
|---|---|
| `NEXT_PUBLIC_API_URL` | (no change â€” still your Railway URL) |
| `NEXT_PUBLIC_CLERK_*` | (no change yet â€” we move Clerk to prod in Phase 7) |

**On Railway** â†’ `@advertix/api` â†’ Variables:

| Var | New value |
|---|---|
| `CORS_ORIGIN` | `https://yourdomain.com,https://app.yourdomain.com` (comma-separated, both) |
| `FRONTEND_URL` | `https://app.yourdomain.com` |
| `WEB_ORIGIN` | `https://app.yourdomain.com` |

Railway auto-redeploys when env vars change. Wait ~30s.

### 2.4 Smoke test

1. Visit `https://yourdomain.com` â†’ marketing landing should load (currently the simple "Advertix" page)
2. Visit `https://app.yourdomain.com/dashboard` â†’ should redirect through sign-in and land you on the dashboard
3. DevTools â†’ Network tab â†’ confirm `api/auth/me` returns 200 from Railway (no CORS errors)

If all green, the domain swap is done.

---

## Phase 3 â€” Create production Facebook Business Manager + Page

> **Why a separate one from your dev?** Your dev BM + Page are fine for testing. For real customers, Meta wants to see a clearly-separate production identity that holds the real Page, real ad accounts, and (eventually) real customer-connected accounts.

### 3.1 Decision â€” reuse dev BM or create a new one?

| Reuse dev "Advertix" BM | Create separate "Advertix Production" BM |
|---|---|
| âœ… Less setup | âœ… Clean separation â€” dev mistakes don't risk prod |
| âœ… Already known to your FB account | âœ… Standard practice for SaaS |
| âŒ Mixing dev + prod state | âŒ Slightly more setup |

**Recommendation:** Reuse your existing BM. Add a new Page if you want a separate "Advertix Production" identity, but the BM itself doesn't need to be split â€” you've only got one company.

### 3.2 Set up the production Facebook Page

If you don't have a dedicated "Advertix" Page yet (or want a fresh one):

1. business.facebook.com â†’ **Business Settings** â†’ **Accounts** â†’ **Pages** â†’ **+ Add** â†’ **Create a new Page**
2. Page name: `Advertix`
3. Category: `Software` or `Internet Marketing Service`
4. Save

Add some basic content so Meta's reviewer sees a real Page:
- Profile picture (your logo)
- Cover photo
- About section: 1-2 sentences about what Advertix does
- A link to your new domain in the "Website" field
- Optionally publish 1-2 posts so it doesn't look empty

### 3.3 Assign yourself Advertiser role on the Page

Business Settings â†’ **People** â†’ your name â†’ **Assets** tab â†’ **Pages** â†’ **+ Add Assets** â†’ select the new Advertix Page â†’ toggle **Advertise** ON â†’ Save.

---

## Phase 4 â€” Production Meta App (separate from dev)

### 4.1 Create the new app

1. developers.facebook.com â†’ My Apps â†’ **Create App**
2. Use case: **Other**
3. App type: **Business**
4. App name: `Advertix` (no "Dev" suffix this time)
5. Business Account: your Advertix Business Manager
6. Create

### 4.2 Add the Use Case + permissions

1. New app dashboard â†’ **Add Use Cases** â†’ **Create & manage ads with Marketing API**
2. After adding, go to **Use Cases** â†’ click into it â†’ **Permissions and features**
3. Confirm these are added (click **+ Add** on any missing):
   - `ads_management`
   - `ads_read`
   - `business_management`
   - `pages_show_list`
4. (Note: do NOT add `pages_manage_ads` â€” Meta rejects it as invalid in the OAuth dialog despite it appearing here)

### 4.3 Configure Facebook Login for Business

1. Left sidebar â†’ **Add Product** â†’ **Facebook Login for Business** â†’ Set Up
2. Settings:
   - **Valid OAuth Redirect URIs** â†’ add:
     - `https://yourdomain.com/api/meta/callback` (in case you use apex later)
     - `https://app.yourdomain.com/api/meta/callback` â€” but wait, the callback goes to Railway, not Vercel
     - **Use this instead**: `https://advertixapi-production.up.railway.app/api/meta/callback`
     - Also keep `http://localhost:4000/api/meta/callback` for dev
3. **Enforce HTTPS**: ON
4. **Use Strict Mode for redirect URIs**: ON
5. Save

### 4.4 Settings â†’ Basic

1. **App Domains**: add `yourdomain.com`, `app.yourdomain.com`, `advertixapi-production.up.railway.app`
2. **Privacy Policy URL**: `https://yourdomain.com/privacy` (we'll create the page in Phase 6)
3. **Terms of Service URL**: `https://yourdomain.com/terms`
4. **Category**: `Business and Pages`
5. **App Icon**: upload a 1024Ã—1024 PNG (you'll need this â€” can be a simple gradient with the Advertix wordmark; Canva works)
6. Save

### 4.5 Add Roles

App Roles â†’ Roles â†’ add your FB account as **Administrator**.

### 4.6 Replace dev App ID/Secret in Railway

âš  This switches your production API from talking to dev Meta App â†’ production Meta App. Any user who's connected Meta via the dev app will need to reconnect.

For now, if you're not yet at the "real users" stage, **wait on this swap** â€” keep using the dev Meta App on Railway until you're ready for Phase 9 (real-customer testing). The dev app is fine for your own testing.

When ready:
- Railway â†’ `@advertix/api` â†’ Variables â†’ swap:
  - `META_APP_ID` â†’ new app's App ID
  - `META_APP_SECRET` â†’ new app's App Secret
- Railway auto-redeploys
- Reconnect Meta in Advertix UI

---

## Phase 5 â€” Business Verification (Meta side)

Meta requires this before they'll approve Marketing API Standard Access in Phase 8. Start the clock now.

### 5.1 Start verification

1. business.facebook.com â†’ **Security Center**
2. Find **Business Verification** â†’ **Start Verification**
3. Fill in:
   - Legal business name (your registered company name, or your personal name if you operate as a sole proprietor)
   - Business address (real address â€” Meta sends a postcard sometimes)
   - Business phone (may receive an automated verification call)
   - Tax ID (EIN, NTN â€” varies by country)
   - Country
   - Business website: `https://yourdomain.com`
4. Upload documents Meta asks for:
   - **For a registered company**: business registration certificate, articles of incorporation
   - **For a sole proprietor**: tax certificate, utility bill at the business address, business bank statement
5. Submit

### 5.2 Wait

- Typical turnaround: **1-3 business days**
- Meta will email you about approval or requests for additional info
- Status visible in Security Center â†’ Business Verification

You CAN start Phase 6 (Privacy + Terms) and Phase 7 (Clerk prod) while waiting.

---

## Phase 6 â€” Privacy Policy + Terms pages

These live on your new domain at `/privacy` and `/terms`. I (Claude) will generate them in code once you confirm:

- Legal entity name (e.g. `Advertix`, `Advertix Pvt. Ltd.`, or your personal name)
- Contact email for privacy notices (will be publicly displayed â€” recommend `legal@yourdomain.com` once you set up email forwarding at Cloudflare, or use your real email for now)
- Country whose laws govern the terms (e.g. Pakistan, USA)

After generation:
1. Files live at `apps/web/app/privacy/page.tsx` and `apps/web/app/terms/page.tsx`
2. Middleware updated to add `/privacy` and `/terms` to public routes
3. Footer added to landing page linking to both
4. Push to git â†’ Vercel auto-deploys

**For Meta App Review**, the reviewer reads both URLs. Without explicit disclosures about OAuth token storage and Marketing API usage, App Review rejects. The pages I generate will include these disclosures by default.

---

## Phase 7 â€” Clerk â†’ Production instance

While Meta processes Business Verification, switch Clerk.

### 7.1 Create the production instance

1. clerk.com/dashboard â†’ top dropdown â†’ **Create production instance**
2. Name: `Advertix Production` (or similar)
3. Verify the email if asked

### 7.2 Configure the domain

1. Production instance â†’ **Domains** â†’ add `app.yourdomain.com`
2. Clerk may require a DNS TXT record for verification â€” add it in Cloudflare
3. Wait for verification (usually < 5 min)
4. Add another domain entry: `yourdomain.com` (for the marketing site to access Clerk's hosted components)

### 7.3 Copy keys

Production instance â†’ **API Keys** â†’ copy:
- `pk_live_...`
- `sk_live_...`

### 7.4 Update env vars

**Vercel**:
- `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` â†’ `pk_live_...`
- `CLERK_SECRET_KEY` â†’ `sk_live_...`

**Railway** â†’ `@advertix/api`:
- `CLERK_SECRET_KEY` â†’ `sk_live_...`

### 7.5 Redeploy Vercel with cleared build cache

Vercel â†’ Deployments â†’ latest â†’ **â‹¯** â†’ **Redeploy** â†’ **uncheck** "Use existing Build Cache" â†’ Redeploy.

(`NEXT_PUBLIC_*` is baked into the JS bundle at build time â€” without a cache-cleared rebuild, the browser keeps the old `pk_test_...`.)

### 7.6 Test

Hard-refresh `app.yourdomain.com`:
1. Console should NO LONGER show "Clerk has been loaded with development keys"
2. Sign up with a brand new email
3. Confirm welcome email arrives from a `clerk.yourdomain.com`-style address (not `clerk.accounts.dev`)
4. Reach the dashboard

âš  **Your existing dev users (including yourself) won't carry over.** Production instance starts fresh. You'll need to sign up again with the new keys. This is one-way; once you switch to live keys, dev test accounts are gone (you can switch back to dev mid-development if needed).

---

## Phase 8 â€” Submit Meta App Review for Marketing API

After Phase 5 (Business Verification) is approved AND Phase 6 (Privacy + Terms) is live AND Phase 7 (Clerk prod) is done, you're ready.

### 8.1 Confirm App Settings are complete

App Dashboard â†’ Settings â†’ Basic:
- Display name: `Advertix`
- App icon: âœ… uploaded
- App domains: âœ… contain your prod domains
- Privacy Policy URL: âœ… resolves to a real page
- Terms of Service URL: âœ… resolves to a real page
- Business Use: filled in
- Business Account: âœ… verified BM

### 8.2 Record the screencast

Meta requires a video showing exactly how your app uses each permission. Record:

1. Sign up at `app.yourdomain.com` with a fresh test account
2. Reach dashboard â†’ Settings â†’ Integrations
3. Click Connect Meta â†’ OAuth popup â†’ grant permissions â†’ connect succeeds
4. Show the Meta card now reads "Connected" with an ad account name
5. Settings â†’ Sync Now â†’ campaigns appear in the Campaigns list
6. Click a campaign â†’ show metrics + chart populated by Meta sync
7. Click "New Campaign" â†’ walk through wizard â†’ click "Publish to Meta"
8. (At this stage you'll get the "code 3" error since you haven't been approved yet â€” that's fine, just narrate "this is the call we're requesting approval for")

Upload to YouTube as **unlisted** (don't make public). Use the URL in App Review.

### 8.3 Submit App Review

1. App Dashboard â†’ **App Review** â†’ **Requests**
2. Add each permission you need:
   - `ads_read` â€” "Read user's ad campaign data from connected Meta ad accounts to display performance metrics in our SaaS dashboard"
   - `ads_management` â€” "Create, edit, and pause ad campaigns on behalf of the user from within our SaaS"
   - `business_management` â€” "List Business Managers and ad accounts so users can pick which one to connect"
   - `pages_show_list` â€” "List the user's Facebook Pages so they can choose which Page to attach ads to"
3. For each, attach the screencast URL + 2-3 sentences of use-case context
4. Also under **Use Cases** â†’ click into Marketing API â†’ submit it for **Marketing API Access Tier upgrade** (this gets you out of "Limited access")
5. Submit

### 8.4 Wait

- Typical turnaround: **5-14 business days**
- Meta will email you about approval or requests for additional info
- If rejected with specific feedback, address it and resubmit

---

## Phase 9 â€” Real Meta ad end-to-end test

After Meta approves you, test with real ad spend (small).

### 9.1 Connect a real ad account

1. Sign in to `app.yourdomain.com` with your production user
2. Settings â†’ Integrations â†’ **Connect Meta**
3. Use a personal FB account that admins a real ad account with payment method
4. Grant the new (broader) permissions
5. Confirm the real ad account appears

### 9.2 Use a $1/day budget

1. Campaigns â†’ **+ New Campaign**
2. Walk the wizard:
   - Platform: Meta
   - Objective: Awareness (cheapest)
   - Budget: $1 daily
   - End date: tomorrow (so it auto-stops)
3. Click **Publish to Meta**
4. Wait ~30 seconds â€” should succeed this time (no "code 3")
5. Open business.facebook.com/adsmanager â†’ confirm a new PAUSED campaign appears with your ad
6. Flip the toggle in Advertix to launch it

### 9.3 Verify the ad serves

1. Wait 1-4 hours (Meta's review of your specific ad creative is automatic and quick for normal content)
2. Check Ads Manager â†’ your ad should show â–¶ Active and start collecting impressions
3. Wait ~1 day â†’ come back to Advertix â†’ Sync Now â†’ confirm impressions/spend pull through
4. Stop the campaign before it spends more than ~$5

### 9.4 If it works

Congratulations â€” you have a real, working SaaS that can run Facebook ads for real customers.

### 9.5 Clean up

- Delete or pause the test campaign in Ads Manager
- Disconnect the test ad account if you don't want it lingering in production users' lists
- Document any rough edges you hit so they're on the backlog

---

## Cost summary

| Item | Cost |
|---|---|
| Domain | $10-100/year (varies by TLD) |
| Cloudflare DNS | Free |
| Vercel (Hobby plan) | Free (until you hit limits) |
| Railway (Hobby plan) | $5/mo |
| Clerk (Free tier) | Free up to 10K MAU |
| Meta Business Verification | Free |
| Meta App Review | Free |
| Test ad spend | ~$5-10 to fully verify |
| **Total to launch** | **~$20-100** |

---

## What you need decisions / actions on RIGHT NOW

In rough order:

1. **Pick + buy the domain** (Phase 1)
2. **Reply to me with**: the domain you bought + legal entity name + privacy contact email
3. I'll generate Privacy + Terms pages and the public-route middleware update
4. I'll also keep building the Phase 1A wizard while you handle the Meta side
5. You start Business Verification (Phase 5) â€” clock starts ticking
6. You record the screencast (Phase 8.2) â€” easier once the wizard is built
7. You submit Meta App Review when ready

The wizard work is independent of Meta approval. We can ship + demo it before Phase 9 happens.

---

## Rough timeline if you start today

| Day | What happens |
|---|---|
| **Day 0** (today) | Buy domain, attach to Vercel, env vars updated. Start Business Verification submission. I generate Privacy + Terms pages. |
| **Day 1-3** | Business Verification approves. I build + ship the Phase 1A wizard. You record screencast against the wizard. |
| **Day 3** | Submit Meta App Review. |
| **Day 8-17** | Meta approves Marketing API tier upgrade. |
| **Day 8-17** | Phase 9 â€” first real ad test. Live to customers. |

You're looking at ~2-3 weeks to "real customer launch ready" if nothing blocks. Most of that is external waiting.

---

## When something goes wrong

- **Domain DNS shows "Invalid Configuration" in Vercel** â†’ wait longer (up to 24h); try `dig yourdomain.com NS` to confirm Cloudflare nameservers are active
- **Clerk Production instance won't verify domain** â†’ confirm the TXT record is added in Cloudflare; sometimes takes 10-15 min
- **Business Verification rejected** â†’ check the rejection email; usually the issue is unclear documents or address mismatches â€” re-upload and resubmit
- **Meta App Review rejected** â†’ re-read the rejection notes carefully; common issues are missing Privacy Policy disclosures or insufficient use-case justification. Address each and resubmit (no penalty for resubmission)

This guide will be updated as we learn from your specific journey.
