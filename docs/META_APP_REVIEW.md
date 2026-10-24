# Meta App Review: advanced access for Advertix

**Status (2026-10-23):** paused on purpose. The submission is drafted in Meta for Developers but **not submitted**. We first finish and test the connection flow on the live app (Connections, A13), then record the screencast and submit.

- **Meta app:** Advertix, App ID `1663240968336277`, Live mode.
- **Business portfolio:** Advertix (`3481156955370315`), verified.

---

## 1. Why we need this

People without a role on the Meta app (testers, clients) get Facebook's **"Feature Unavailable: Facebook Login is currently unavailable for this app…"** screen when they connect Meta. Admins of the app can connect; nobody else can.

**Cause:** our permissions only have **Standard access**. In the dashboard, Use case "Create & manage ads" → Permissions and features shows them as "Ready for testing". Standard access lets only people with a role on the app grant them.

| Item | Status |
|---|---|
| Marketing API Access Tier | **Full access**: approved in the 2 July 2026 submission (rate limits and ad-account limits only) |
| `ads_management` | Standard access, needs advanced access |
| `ads_read` | Standard access, needs advanced access |
| `business_management` | Standard access, needs advanced access |
| `pages_show_list` | Standard access, needs advanced access |
| `public_profile` | Granted with Facebook Login |

The July submission approved **only** the Marketing API Access Tier; the permissions weren't part of it. Once they're approved, their status changes to **Advanced access** and any Facebook user can connect.

### Until then: how people can connect

1. **Agency-side connect (no review needed):**
   - The client shares their ad account with our Business Manager (Business Settings → Partners).
   - An app admin connects Meta in Advertix and picks the client's account in the Connect dialog.
2. **Testers:** add the person under **App roles → Roles** as Tester. They accept at developers.facebook.com/requests, then connect.

---

## 2. Before submitting (gate)

- [ ] **Connection flow tested on app.advertix.io** with a non-admin tester and with an admin:
  - Connect ad account → Meta → Facebook dialog → pick accounts (with clients) → Connect;
  - Renew access;
  - Archive / Restore;
  - Disconnect;
  - Sync now;
  - first sync shows campaigns.
- [ ] **The unassigned-count fix is deployed:** the Connections "Unassigned" tab counts every account without a client.
- [ ] **Reviewer test account works on production**, with a Meta ad account connected and campaigns synced (credentials go in Meta, not in this file).
- [ ] **New screencast recorded** (section 6) on the live app, as an MP4 file.
- [ ] **Public pages load without signing in:** https://advertix.io/privacy, /terms, /data-deletion.
- [x] **US-only Claude processing:** done 2026-10-25. Every Claude call sends `inference_geo: "us"` (1.1x token pricing; `ANTHROPIC_INFERENCE_GEO=global` turns it off). Confirmed live on both models. Deploy before submitting.

---

## 3. Submission steps (Meta for Developers)

1. **Permissions and features** (use case "Create & manage ads"): `ads_management`, `ads_read`, `business_management` and `pages_show_list` are already added to App Review. `public_profile` comes with them.
   - **Don't include `pages_read_engagement`.** Advertix never requests it at login, so it can't be shown in the screencast and would be rejected.
2. **App Review → Requests → Next** opens "Submit for App Review", which has five sections:
   - **Verification:** done (green).
   - **App settings:** done (green).
   - **Data handling:** reviewed; Anthropic added (section 4).
   - **Reviewer instructions:** drafted. Use the text in section 5.
   - **Allowed usage:** to do. For each permission, paste the description (section 7), attach the MP4, and tick the agreement.
3. **Submit for review.** Review takes a few days to two weeks. If a permission is rejected, read Meta's note, fix exactly that, and resubmit.

---

## 4. Data handling answers

- **Processors with access to Meta data:** Yes.
  - **Railway Corporation:** API and database hosting (synced ad data is stored here). Country: United States.
  - **Vercel Inc:** web app hosting. Country: United States.
  - **Clerk Inc.:** login. It doesn't receive Meta data; listing it is harmless.
  - **Anthropic, PBC:** AI processing of campaign names and results, used by the AI Planner, insights, budget review and "Ask about this campaign".
    - Category: *IT solutions and services, including cloud storage and processing*.
    - Country: *United States*.
    - Advertix pins every Claude request to US infrastructure (`inference_geo: "us"`), so "United States" is exact. If `ANTHROPIC_INFERENCE_GEO=global` is ever set, this answer must change.
  - **OpenAI isn't a processor of Meta data.** Image generation only gets the user's typed brief and headline and an optional reference image.
- **Responsible entity:** "Abdul Qayyum, sole proprietor operating as Advertix". Must match the legal name used for Business Verification.
- **Country:** Pakistan.
- **Shared data with public authorities in the last 12 months:** No.
- **Policies for public-authority requests:**
  - legality review;
  - challenging unlawful requests;
  - data minimisation;
  - documenting requests.

  Keep only what we follow, and state it in the privacy policy.

---

## 5. Reviewer instructions (paste into "instructions-web-2")

Written for Meta reviewers; matches the live app with the Connections page.

> Advertix is a web app for advertisers and agencies to manage paid campaigns. It uses Facebook Login (with the ads_management, ads_read, business_management and pages_show_list permissions) so a user can connect their Meta ad accounts, see their campaigns and results, and create and manage campaigns.
>
> ACCESS
> 1. Go to https://app.advertix.io and sign in with the test credentials below. This account already has a Meta ad account connected, with campaign data.
> 2. To test the login flow yourself, sign up with any email at https://app.advertix.io/sign-up and continue from step 3.
>
> CONNECT META (Facebook Login; ads_management, ads_read, business_management)
> 3. Click **Connections** in the left menu, then **Connect ad account** (top right) → **Meta → Connect**. Allow pop-ups. In the Facebook dialog, approve the requested permissions.
> 4. Back in Advertix, the dialog lists the ad accounts available to your Facebook user, including ones shared with you through Business Manager (business_management). Tick the ones to add and click **Connect**.
> 5. The accounts appear on the Connections page and their first sync starts. Campaigns and results appear within a few minutes.
>
> SEE CAMPAIGNS AND RESULTS (ads_read)
> 6. Open **Campaigns** in the left menu. Meta campaigns appear with status, budget, spend and results. Use **Sync** to refresh.
> 7. Open any campaign to see its performance, ad sets, ads and change history.
>
> CREATE A CAMPAIGN (pages_show_list, ads_management)
> 8. On **Campaigns**, click **New campaign**. Choose a goal, then Meta and a daily budget, then an audience.
> 9. On the **Ads** step, choose the **Facebook Page** the ad runs from. The list shows the Pages you manage (pages_show_list). Add an image and the ad text.
> 10. On **Review & launch**, choose **Publish paused** and publish. The campaign, ad set and ad are created on Meta, paused, so nothing spends. Use the Ads Manager link to see it on Meta. (ads_management)
>
> MANAGE A CAMPAIGN (ads_management)
> 11. On a campaign, change the daily budget or pause or resume it. The change is applied on Meta and recorded in the campaign's change log, with Undo.
>
> REVOKE AND DELETE
> 12. To disconnect: **Connections** → click the account's row button (e.g. **Open**) → **Disconnect** at the bottom of the panel → confirm.
> 13. To delete data: see https://advertix.io/data-deletion, or email support@advertix.io.
>
> Privacy Policy: https://advertix.io/privacy · Terms: https://advertix.io/terms · Data deletion: https://advertix.io/data-deletion · Contact: support@advertix.io

**Other fields:**
- **Facebook Login integrated:** Yes.
- **Test credentials:** the reviewer account, kept in Meta only.
- **Gift codes:** not applicable.
- **Geo restrictions:** none.
- **Supporting documentation:** replace the old `advertix.mp4` with the new recording.

---

## 6. Screencast

**Format:**
- MP4 uploaded as a file. A Loom link isn't enough: download the MP4 from Loom (… → Download) or record locally.
- English UI, cursor visible, 2–4 minutes, 1080p.
- Silent is fine. Add on-screen captions naming each permission as it's used.

**Before recording:**
1. Disconnect Meta in Advertix (Connections → row → Disconnect).
2. Remove Advertix from the Facebook account at facebook.com/settings?tab=business_tools (or Apps and websites). This is the app authorisation, **not** the Advertix Page.
3. Do one test run to make sure the full permission screen appears, then record.

**Order (one video for all permissions):**
1. Advertix sign-in.
2. **Connections → Connect ad account → Meta** → Facebook permission screen. Hold it a few seconds, then approve. Caption: *Facebook Login: ads_management, ads_read, business_management, pages_show_list*.
3. Pick the account(s) → **Connect**. Caption: *business_management*.
4. **Campaigns** with spend and results; open a campaign. Caption: *ads_read*.
5. **New campaign** → goal → budget → audience → **Ads step: pick the Facebook Page** (caption: *pages_show_list*) → **Publish paused**.
6. **Ads Manager:** show the new paused campaign. Caption: *ads_management: created on Meta*.
7. Change the daily budget (or pause / resume) in Advertix, then show it in Ads Manager and in the Advertix change log. Caption: *ads_management*.

---

## 7. Allowed usage: descriptions (one per permission)

**ads_management**
> Advertix is a campaign management tool for advertisers and agencies. After a user connects their Meta ad account, Advertix uses ads_management to act on that account at the user's request:
> - create campaigns, ad sets and ads from the New campaign wizard (uploading the user's images and videos to the ad account);
> - pause and resume campaigns;
> - change daily budgets (from the Budgets page and from suggestions the user applies);
> - create custom and lookalike audiences on the Audiences page.
>
> Every change is started by the user, shown in a change log, and can be undone.

**ads_read**
> Advertix uses ads_read to read the campaigns, ad sets, ads and Ads Insights (spend, impressions, clicks, conversions, revenue) of the ad accounts the user connects. It uses this data for the user's own dashboards, campaign pages, analytics, budget pacing and recommendations, and to check account health (for example, whether the pixel is firing). Data is synced for the user's connected accounts only and is shown only to members of the user's workspace.

**business_management**
> Advertix uses business_management to list the ad accounts the user can access through their Business Manager, including client ad accounts shared with an agency's business, so the user can choose which ones to add to Advertix. It also reads the pixels on those ad accounts, so the user can pick a conversion pixel when creating a campaign.

**pages_show_list**
> When creating ads, the user must choose the Facebook Page the ads run from. Advertix uses pages_show_list to list the Pages the user manages so they can pick one in the New campaign wizard. Advertix doesn't post to or change the Page.

**public_profile** (if asked)
> Granted with Facebook Login. Advertix only uses the Facebook user ID returned at login to link the ad-account connection to the person who connected it. It doesn't display or store other profile data.

**Marketing API Access Tier** (renewal): re-use the July 2026 answer.

---

## 8. Related notes

- **Graph API version:** the code calls v19.0, which Meta has likely retired by now. "Marketing API version auto-upgrade" is on in the app settings, so calls still work. Move to a current version before launch.
- **Marketing Messages terms** (app settings): not needed for Advertix.
