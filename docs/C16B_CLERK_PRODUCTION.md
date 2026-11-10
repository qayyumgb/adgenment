# C16b — Switching Clerk to production keys

Advertix still signs people in through Clerk's **development** instance (keys starting `pk_test_` / `sk_test_`). That's where the "Development mode" badge comes from, and development instances have usage limits and aren't meant for real customers. This guide moves the live site to a **production** instance. Local development keeps using the development instance.

**Time:** about 1 hour of setup, plus waiting for DNS (minutes to a few hours). **Downtime:** a few minutes while the new keys deploy. Do it at a quiet time.

## What happens to existing users

- Clerk does **not** copy users or passwords from development to production.
- **Google sign-in users:** sign in with Google as usual.
- **Email + password users:** choose **Sign up** with the same email and verify it. A note under the sign-in box tells them (shown only on production keys, until 15 Jan 2027).
- Either way, the API recognises the **verified email** and reconnects them to their existing Advertix account (`userForClerkId` in `apps/api/src/middleware/auth.ts`, built 2026-11-03): same workspaces, roles, plan, ad accounts and data. An unverified email is never linked.
- Someone who signs up with a **different** email gets a new, empty workspace.

## Step 1 — Create the production instance (Clerk dashboard)

1. dashboard.clerk.com → the Advertix application → the instance switcher at the top (**Development**) → **Create production instance**.
2. Choose **Clone development instance settings**. Sign-in methods, required fields and session settings are copied; social login credentials and users are not.
3. **Domain:** `advertix.io`. The app runs on `app.advertix.io`, a subdomain, which Clerk allows.

## Step 2 — DNS records

Clerk then lists DNS records, usually five CNAMEs:

| Name | Purpose |
|---|---|
| `clerk` | Frontend API (sign-in requests) |
| `accounts` | Account Portal |
| `clkmail` | Email sending |
| `clk._domainkey`, `clk2._domainkey` | Email signatures (DKIM) |

- Add them exactly as shown at your DNS provider (wherever `advertix.io` is managed).
- **Cloudflare:** set each one to **DNS only** (grey cloud). Proxied records break Clerk's certificates.
- Back in Clerk → **Domains**, wait until every record shows **Verified** and the SSL certificates are issued. Don't switch keys before that.

## Step 3 — Google sign-in (required on production)

Development uses Clerk's shared Google credentials. Production needs your own:

1. console.cloud.google.com → the Advertix project (the one used for Google Ads is fine) → **APIs & Services → OAuth consent screen**: app name "Advertix", support email, logo, authorised domain `advertix.io`, Privacy Policy `https://advertix.io/privacy`, Terms `https://advertix.io/terms`. Sign-in only needs the basic scopes (email, profile, openid).
2. **Credentials → Create credentials → OAuth client ID → Web application.**
   - Authorised JavaScript origin: `https://app.advertix.io`
   - Authorised redirect URI: copy it from Clerk → **Configure → SSO connections → Google** (looks like `https://clerk.advertix.io/v1/oauth_callback`).
3. Paste the **Client ID** and **Client secret** into that Clerk Google connection and enable it.
4. If any other sign-in method was enabled in development (Apple, Microsoft, Facebook…), set up its credentials the same way, or turn it off.

## Step 4 — Copy the production keys

Clerk → production instance → **Configure → API keys**:
- Publishable key `pk_live_…`
- Secret key `sk_live_…`

Keep them out of chat, email and the repo.

## Step 5 — Switch the keys (both at once)

The web app and the API must use the **same** instance, or every request fails with 401 until both match.

1. **Railway** → @adgenius/api → **Variables**: `CLERK_SECRET_KEY` = `sk_live_…`. Railway redeploys.
2. **Vercel** → adgenment-web → **Settings → Environment Variables**, **Production** environment only:
   - `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` = `pk_live_…`
   - `CLERK_SECRET_KEY` = `sk_live_…`
   - Leave Preview / Development on the `pk_test_` keys.
3. Vercel → **Deployments** → latest Production deployment → **⋯ → Redeploy**. `NEXT_PUBLIC_…` values are baked in at build time, so a redeploy is required.

Local `.env` files stay on the development keys.

## Step 6 — Check right after the deploy

1. Open `https://app.advertix.io` in an incognito window: no "Development mode" badge, and the move note under the sign-in box.
2. **Continue with Google** with your own account: you land in **your existing workspace**, with ad accounts, campaigns and plan unchanged.
3. With a second, email-based account: **Sign up** with the same email → verify → existing workspace.
4. Railway → API logs: `[auth] relinked user … to a new Clerk id` for each returning person.
5. Superadmin: `/admin` still opens for you.
   - `SUPERADMIN_EMAILS` keeps working as is.
   - `SUPERADMIN_CLERK_IDS`, if set, holds **old** ids: replace them with the new ones (Clerk → Users) or remove the variable and rely on emails.
   - Remove the temporary yopmail address from `SUPERADMIN_EMAILS` (a public inbox must never be superadmin).

## If something goes wrong

Put the old `pk_test_` / `sk_test_` values back on Railway and Vercel and redeploy. Nothing in the database depends on the instance: users who already relinked are relinked again by email when they next sign in.

## Afterwards

- The Meta App Review reviewer login lived on the development instance. If Meta reviews the app again, re-create that login on production first (sign up with the same email).
- The move note under the sign-in box retires itself on 15 Jan 2027; delete it from `apps/web/app/(auth)/sign-in/[[...sign-in]]/page.tsx` any time after.
