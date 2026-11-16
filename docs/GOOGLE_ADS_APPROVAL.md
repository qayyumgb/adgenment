# Google Ads approval — step by step

> Rules checked on **2026-11-13** against Google's own pages (Google Ads API access levels, sunset dates, developer token FAQ). Google changed this a lot in 2026, so if a screen looks different from what's written here, trust the screen and tell Claude.

Goal: real Google Ads accounts can connect to Advertix, sync campaigns and results, and (later) be changed from Advertix. Two separate approvals:

1. **Google Ads API access** for our Google Cloud project (how many API calls we may make, and on which accounts).
2. **OAuth app verification** (Google checks that Advertix is a real product that handles people's Google data properly, so users don't see the "Google hasn't verified this app" warning).

---

## What changed in 2026 (read this first)

- **Developer tokens are gone.** Google retired them on **9 September 2026**. Access now belongs to the **Google Cloud project** that owns our OAuth client (`GOOGLE_CLIENT_ID`). You no longer apply from the Google Ads "API Center"; you apply in the **Cloud Console**.
- **You don't need a Google Ads manager (MCC) account to apply** any more. You only need one to manage several client accounts through it (agencies do, and that's handled in the code).
- **Access levels now:**

| Level | Real (production) accounts? | Daily limit | How you get it |
|---|---|---|---|
| Test | No, test accounts only | 15,000 operations | Automatic when the API is enabled |
| **Explorer** | Yes | 2,880 operations on real accounts | Apply; automated, usually approved quickly |
| **Basic** | Yes | 15,000 operations | Apply; needs **brand verification** first, then automated review "within minutes" |
| Standard | Yes | Unlimited (per-service limits apply) | Apply; manual audit, about 10 business days, demo login for reviewers |

  Explorer blocks account creation, user management, keyword planning and billing services. Advertix doesn't use those, so Explorer is enough to **test** with real accounts. **Basic** is what we need before customers connect (the daily limit is shared by every connected account). **Standard** later, when many clients are connected.

---

## Part 0 — Code work first (Claude does this, ~1–2 days)

**Advertix's Google connection is currently broken, whatever the approval status:**

- It calls **Google Ads API v17**, which Google has switched off. Only **v23–v26** exist now (v26 is the newest).
- It refuses to start without `GOOGLE_DEVELOPER_TOKEN`, which no longer exists.

Before you test anything with a real account (Part D), ask Claude to do Part 0:

1. Upgrade to **Google Ads API v26** and check every query and change we send against the v18–v26 changes (for example, new campaigns now have to declare whether they contain EU political advertising).
2. Stop requiring and sending the developer token.
3. Agencies: when a client account is reached through a manager account, send the **manager's** id as `login-customer-id` (today the code sends the client's own id, which only works with direct access).
4. Privacy Policy: add the Google API Services **User Data Policy / Limited Use** statement (see Part B, step 2).

Parts A–C below are paperwork you can start any time, before or after Part 0. Only Part D (testing) needs Part 0 to be done and deployed.

---

## What you need before starting

- [ ] The **Advertix Google Cloud project**: the one you used for Clerk Google sign-in (C16b). Use the **same project**: our Google Ads connection's OAuth client must live in the project that gets the access level.
- [ ] Sign in as an **Owner** of that project (Owner or Editor has the permissions needed).
- [ ] A **billing account** on the project that is **paid (not Free Trial) and active**. The Google Ads API itself is free; Google rejects Explorer / Basic applications from Free Trial or suspended-billing projects.
- [ ] **advertix.io verified** in Google Search Console with the same Google account (you may have done this for Clerk).
- [ ] Live pages: `https://advertix.io` (homepage), `https://advertix.io/privacy`, `https://advertix.io/terms`.
- [ ] The support email for the consent screen (e.g. `admin@advertix.io`).
- [ ] A real **Google Ads account with some spend** for testing (yours or a friend's), and optionally a manager account to test the agency case.

---

## Part A — Turn on the Google Ads API and apply for access

1. **console.cloud.google.com** → pick the Advertix project (top bar).
2. **APIs & Services → Library** → search **Google Ads API** → **Enable**. The project now has **Test** access.
3. Open the **Google Ads API Overview** page: `https://console.cloud.google.com/google/ads-apis/overview` (or search "Google Ads API" in the console search bar and open its Overview).
4. **Apply for Explorer access.** Fill in the form (use the texts in "Ready-made texts" below). It's usually approved automatically.
   - If it's refused because of billing, check that the billing account is paid and active (see above), then apply again.
5. Later (after Part B's brand verification): on the same page, **Apply for Basic access**. It's reviewed automatically within minutes once brand verification is done.
6. Much later (many clients, or limits hit): **Standard access**, see Part E.

> Known issue Google lists: projects upgraded after 9 Sept 2026 can get `AUTHORIZATION_ERROR` on real accounts while a fix rolls out; Google's workaround is a new project. If that happens, tell Claude before making a new project (the OAuth client and Clerk sign-in would have to move too).

---

## Part B — Consent screen, branding and verification

In the Cloud Console the consent screen lives in **Google Auth Platform** (older UI: **APIs & Services → OAuth consent screen**).

1. **Branding:**
   - app name **Advertix**, the logo, the support email;
   - homepage `https://advertix.io`, privacy `https://advertix.io/privacy`, terms `https://advertix.io/terms`;
   - authorised domain `advertix.io`.

   Then submit **brand verification** if it isn't verified yet (Branding page → verification status). **Basic access needs it.**
2. **Privacy Policy wording** (Claude adds this in Part 0, check it's live before submitting). Google expects the privacy policy to:
   - say what Google data Advertix reads (Google Ads accounts, campaigns, ads, budgets and results) and what for (showing results, suggestions, and changes the user approves);
   - say that Advertix's use and transfer of information received from Google APIs follows the **Google API Services User Data Policy, including the Limited Use requirements**;
   - say that Google user data isn't used to train AI models, and isn't sold.
3. **Data Access (scopes):**
   - add `https://www.googleapis.com/auth/adwords` (the only scope the Google Ads connection uses);
   - keep `openid`, `email`, `profile` for sign-in;
   - check the label Google shows next to the Ads scope (sensitive or restricted). Restricted scopes need a paid security assessment. Tell Claude if it says restricted.
4. **Audience:** publishing status **In production**. Until verification passes, people connecting Google see an "unverified app" warning and there's a 100-user cap. That's fine for testing.
5. **Submit for verification** with the scope justification and the demo video (below). Google usually answers sensitive-scope reviews in days, sometimes weeks. They reply by email, often with questions: answer from the same account.

### GA4 (for C18): now or later?

Google asks the demo video to show **every scope in use**, and expects only the scopes the product needs today. So:

- **Recommended:** submit the Google Ads scope now. Add `analytics.readonly` later, when the GA4 connection exists in Advertix (C18), as a second review. Adding a scope re-opens verification, but a second review is usually quicker.
- Only bundle GA4 now if C18's "Connect GA4" screen is already built when you record the video.

---

## Part C — Record the demo video

An **unlisted YouTube video**, 2–4 minutes, recorded on **production** (advertix.io), in English, at 1080p.

**Script:**

1. **(0:00)** Show `https://advertix.io` with the URL bar visible. Say: "Advertix is an advertising workspace for agencies and businesses. It shows Meta, Google, TikTok and LinkedIn results in one place and suggests budget changes that the user approves."
2. **(0:20)** Sign in, open **Connections**, click **Connect** on Google Ads.
3. **(0:35)** On Google's consent screen, **pause and show it clearly**: the app name Advertix, and the Google Ads permission being requested. Say: "Advertix requests the Google Ads scope to read the user's campaigns and results, and to make changes only when the user approves them." Click **Allow**.
4. **(1:00)** Back in Advertix: the Google Ads account shows as connected. Pick the account (and show a manager account's client list, if you have one).
5. **(1:20)** Show where the data appears: Campaigns with Google rows, a Google campaign's results, Overview totals, Analytics.
6. **(2:00)** Show a change only if it works with Google by then (pausing a campaign, through Approvals with Undo). Otherwise say: "Today Advertix reads Google Ads data; changes to Google campaigns will always need the user's approval."
7. **(2:20)** Show **Disconnect** on the connection and say the stored access is deleted, and point to the Privacy Policy's data deletion section.

Tips: don't show other people's personal data; use your own or a friend's account (with permission), or blur names. Keep the consent screen on screen for at least 3 seconds.

---

## Part D — Test with a real account (after Part 0 is deployed)

1. Production → **Connections → Google Ads → Connect** with the real account.
2. Check that accounts are listed (including the clients under a manager account), and that campaigns and the last 30 days of results appear after a sync.
3. Compare 2–3 campaigns' spend, clicks and conversions with Google Ads itself (allow for time zone and attribution differences).
4. Report anything wrong to Claude with the screen and the time.

---

## Part E — Standard access (later)

When to apply: before roughly **20+ connected Google accounts**, or when sync hits the daily limit.

- Apply from the same Overview page ("Start application").
- Expect a manual audit (about 10 business days) by email. Reviewers can ask what the tool does and who uses it, and want **demo sign-in access** to Advertix: create a reviewer login, like the Meta reviewer account.
- Advertix must meet Google's **Required Minimum Functionality** (RMF) for the features it offers (Claude checks this before you apply).
- Permissible use to request: **Ad creation / management** and **Reporting**.

---

## Ready-made texts

**What Advertix does (forms, brand verification, Standard application):**

> Advertix (advertix.io) is a web workspace for advertising agencies and businesses. Users connect their own Meta, Google Ads, TikTok and LinkedIn ad accounts with OAuth. Advertix shows spend, results and pacing for every account and client in one dashboard, flags problems (tracking, pacing, cost spikes), and suggests budget changes. Changes to campaigns are made only when the user approves them, are logged, and can be undone for 7 days. Agencies use it to manage many client accounts, including accounts under a Google Ads manager account.

**How Advertix uses the Google Ads API:**

> We read accounts the user has access to (customer list, and clients under a manager account), campaigns, ad groups, ads, budgets and performance metrics (daily and hourly) to show reporting and generate suggestions. With the user's approval we change campaign status and budgets. We don't create Google Ads accounts, manage account users, plan keywords or handle billing.

**Scope justification for `https://www.googleapis.com/auth/adwords`:**

> Advertix needs the Google Ads scope to read the user's Google Ads accounts, campaigns and performance data so it can show them in the user's reporting dashboard alongside their other ad platforms, and to apply campaign status and budget changes that the user explicitly approves in Advertix. There is no narrower scope for the Google Ads API. Data is used only to provide these features to the user, is not sold, is not used to train AI models, and is deleted when the user disconnects or deletes their workspace.

**Expected traffic (if asked):** regular background syncs per connected account (a few times a day); a handful of read queries per account per sync; occasional user-approved changes.

---

## Checklist

- [ ] Part 0 done and deployed (Claude)
- [ ] Google Ads API enabled on the Advertix project
- [ ] Explorer access approved
- [ ] Brand verification done
- [ ] Privacy Policy has the Google Limited Use wording (live)
- [ ] Consent screen: Ads scope added, In production, verification submitted with video
- [ ] Verification approved
- [ ] Basic access approved
- [ ] Real account tested (Part D)
- [ ] Later: GA4 scope added (C18), Standard access
