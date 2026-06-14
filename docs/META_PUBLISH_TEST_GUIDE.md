# Meta Publish — Post-Approval Test Guide

The day Meta approves your App Review submission, run this exact playbook to verify the **entire publish path works end-to-end with a real running ad**. Designed to take ~15-20 minutes and cost no more than **$1-2** in test spend.

> **Prerequisite**: Meta has approved your App Review submission (Marketing API access tier upgraded from "Limited" → "Standard"). If you still see error code 3 ("Application does not have the capability"), approval hasn't propagated yet — wait an hour and retry.

---

## What you're verifying

| Layer | What "working" means |
|---|---|
| OAuth + scopes | The right permissions are granted to your fresh production token |
| Image upload | Files forwarded to Meta's `/adimages` return a usable `image_hash` |
| Publish orchestrator | All 4 Meta API calls (campaign → ad set → creative → ad) succeed in order |
| Rollback | If something fails mid-chain, no orphan objects are left in Ads Manager |
| Launch toggle | Flipping ACTIVE in our UI actually moves Meta from PAUSED → ACTIVE |
| Live delivery | The ad actually serves on Facebook (impressions tick up in Ads Manager) |
| Sync feedback | After the ad runs, sync pulls real metrics back into AdGenius |

---

## Step 0 — Prereqs check

Confirm these in this order:

### 0.1 Confirm Meta approval landed

1. developers.facebook.com → your production app → **Use Cases** → **Customize "Create & manage ads with Marketing API"** → **Permissions and features**
2. **Marketing API Access Tier** row should show **"Standard access"** (not "Limited access")
3. If still "Limited", wait — don't run the test yet

### 0.2 Reconnect Meta in AdGenius

The token you got under "Limited" tier may not have the upgraded capabilities. Get a fresh one:

1. localhost:3000 (or your prod URL) → Settings → Integrations
2. Meta card → **Disconnect**
3. Click **Connect Meta** → OAuth popup → grant permissions
4. Card flips to "Connected"

### 0.3 Confirm you have an FB Page with ADVERTISE role

Test in browser console (signed in):

```javascript
const token = await window.Clerk.session.getToken();
const pages = await fetch(`${location.origin.includes('localhost') ? 'http://localhost:4000' : 'https://adgeniusapi-production.up.railway.app'}/api/meta/pages`, {
  headers: { Authorization: `Bearer ${token}` }
}).then(r => r.json());
console.log('Pages:', pages.length, pages.map(p => p.name));
```

Should return ≥1 Page. If empty, fix in Business Manager → People → assign Advertiser role on a Page.

### 0.4 Confirm your ad account has a payment method

Open business.facebook.com/adsmanager → top-left ad account → if you see "Add Payment Method" anywhere, add a card. **Required before any real ad can serve.**

---

## Step 1 — Create the test DRAFT campaign

In AdGenius UI:

1. Sidebar → **Campaigns** → **+ New Campaign**
2. Walk through the existing create wizard:
   - **Platform**: Meta (only Meta works for publish today)
   - **Objective**: Awareness (cheapest; ~$0.01 CPM at low end)
   - **Budget**: $1 daily (small enough to test without burning money)
   - **Start**: today
   - **End**: tomorrow (campaign auto-stops after 24h)
   - **Name**: `MetaPublish E2E Test` (so it's obvious in Ads Manager)
3. Click **Save as Draft** — NOT Launch. We want it in our DB as `DRAFT` with no Meta `externalId`.

After save you'll land on `/campaigns/<id>`. The status pill shows **DRAFT** and there's a new **🚀 Publish to Meta** gradient button at the top right.

---

## Step 2 — Walk the publish wizard

### Step 2.1 — Click "Publish to Meta"

The 6-step wizard opens.

### Step 2.2 — Step 1: Page

- Your Pages load in a 2-column grid
- Pick whichever Page you want the ad to "come from"
- Click **Continue**

### Step 2.3 — Step 2: Objective

- Shows your campaign's objective + Meta's mapped `OUTCOME_AWARENESS`
- Just read it and click **Continue**

### Step 2.4 — Step 3: Audience (FULL targeting)

Test each section briefly:

- **Countries** — click one chip (your home country)
- **Cities** — type your city → pick from typeahead → see it added as a chip
- **Age** — leave default (18-65)
- **Gender** — leave at "All"
- **Interests** — type "fitness" → pick "Fitness and wellness" from results → see it chip
- **Custom audiences** — likely empty (skip)
- **Saved audiences** — likely empty (skip)

Click **Continue**. The wizard should accept this and move forward.

### Step 2.5 — Step 4: Schedule

Read-only confirmation. Just click **Continue**.

### Step 2.6 — Step 5: Creative

Three sub-tests — at minimum do **(b) Upload**:

**(a) Library pick**
- Click **Pick from library**
- If you have creatives, pick one (its image URL gets used)
- If empty, skip to (b)

**(b) Upload (recommended)**
- Click **Upload new** → file picker
- Pick any 1200×630 image from your machine (a screenshot of anything works for a test ad)
- Upload progress shows
- Image preview appears with the message "Uploaded to Meta — image hash abc12345…"

**(c) URL paste**
- Click **Paste URL**
- Paste `https://placehold.co/1200x630/png?text=AdGenius+Test`
- Preview renders

Then fill the copy fields:

- **Body**: `Quick test ad from AdGenius. Please ignore.`
- **Headline**: `Test`
- **Destination URL**: `https://example.com`
- **CTA**: `Learn More`

Click **Continue**.

### Step 2.7 — Step 6: Review

- Full summary card shows everything you picked
- Image preview at the bottom
- Click **🚀 Publish to Meta**
- Spinner: "Publishing to Meta…"
- Wait 10-30 seconds (4 sequential Meta API calls)

**Expected outcome**: Toast says **"Campaign published to Meta — Paused until you launch"**. Modal closes. Detail page now shows:
- Status pill: **PAUSED**
- Top-right: green **"Live on Meta ↗"** badge that links to Ads Manager
- Pause button replaced by **"Launch on Meta"** green button

If you see a red error banner instead, jump to [Troubleshooting](#troubleshooting).

---

## Step 3 — Verify in Facebook Ads Manager

1. Click the **"Live on Meta ↗"** badge — opens Ads Manager in a new tab
2. You should see **`MetaPublish E2E Test`** in the campaigns list with:
   - Status toggle: **OFF** (paused — matches what we sent)
   - Objective: **Awareness**
   - Budget: **$1 / day**
   - Delivery: **In review** OR **Eligible** (Meta auto-reviews creative for policy — usually < 1 min)
3. Click into the campaign → Ad Sets tab → 1 ad set named `MetaPublish E2E Test — Ad Set`
4. Click into ad set → Ads tab → 1 ad named `MetaPublish E2E Test — Ad`
5. Click into the ad → see your uploaded image + your copy + CTA

✅ If all 4 levels exist with the right content, the publish chain works end-to-end.

---

## Step 4 — Launch the ad and verify it serves

Back in AdGenius:

1. Detail page → click **Launch on Meta** (green button)
2. Spinner → toast "Launched on Meta"
3. Status pill flips to **ACTIVE**
4. Refresh Ads Manager → toggle should be **ON**

Wait 5-30 minutes for Meta's policy review to complete + ad to start serving.

After ~30 min, check Ads Manager → Results column on the campaign should show **non-zero Reach** (people seeing your ad). If it stays at 0 after an hour:
- Ad policy may have rejected it (rare for an Awareness/Learn More test ad — check ad-level status for any flagged issues)
- Your audience might be too small (broad targeting reduces this risk)
- Budget might be too low (rare at $1/day for Awareness)

---

## Step 5 — Verify sync pulls metrics back

Once the ad has been running for 1+ hours:

1. AdGenius → Settings → Integrations → Meta → **Sync Now**
2. Wait ~10s for completion
3. Open the campaign detail in AdGenius
4. **Spend** card should be non-zero (probably $0.01-$0.50)
5. **Impressions** card should show a real count
6. Spend chart should render data points

✅ If metrics flow back through sync, the full round-trip works.

---

## Step 6 — Clean up (IMPORTANT)

**Stop the test ad before it burns more money:**

1. AdGenius detail page → click **Pause** (was Launch — now flips back)
   - This calls `/api/campaigns/:id/launch` with `PAUSED` → Meta flips campaign + ad set + ad all to PAUSED
2. Confirm in Ads Manager: status should flip to OFF within seconds
3. **(Optional)** In Ads Manager, right-click the campaign → **Delete** → confirm

If you skip cleanup, the campaign auto-stops at the end date you set (tomorrow). But cleaner to kill it explicitly so it doesn't appear in your future sync results.

---

## Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| `(#3) Application does not have the capability` on publish | App Review approval hasn't landed yet, OR token is from before approval | Wait an hour, then Disconnect + Reconnect Meta to get a fresh token. Retry. |
| `(#100) Page is not authorized to access this app` | You picked a Page the connected token can't manage | Step 1 — pick a different Page; if no Pages work, recheck Business Manager Page → People assignment |
| Image upload fails: `File too large` | Image > 10MB | Resize to under 10MB. Meta enforces 30MB hard cap; we cap at 10MB for safety |
| Image upload fails: `Invalid image` | Format unsupported by Meta | Use JPG or PNG. WebP/HEIC sometimes rejected |
| `(#368) Image dimensions invalid` | Image not within Meta's accepted ratio (recommended 1200×630) | Re-export at 1200×630 or any 1.91:1 ratio |
| `Special ad categories required` | Some Meta objectives require declaring (housing, employment, credit) | Our payload sends `special_ad_categories: []` — if you're advertising regulated content, that's a different code path we haven't built yet |
| Publish succeeds but ad shows "In review" forever | Meta policy review stuck — usually only happens for borderline creative | Wait 24h; if still stuck, edit the ad in Ads Manager to trigger re-review |
| Sync shows 0 metrics 4+ hours after ad serves | Your test ad spent less than Meta's reporting threshold | This is normal for $1-budget Awareness ads. Bump to $5/day for cleaner test data |

---

## What this guide doesn't cover

These are intentionally out of scope for Phase 1A and will get their own playbooks when built:

- **Phase 1B**: carousel + video ads (multi-asset creatives)
- **Phase 1C**: A/B testing (multiple creatives per ad set + variation reporting)
- **Phase 1D**: catalog / dynamic product ads
- **Webhook subscriptions** for real-time status updates (currently you Sync manually)
- **Real-customer test** with a paying user's connected account (App Review unlocks this — your verification is the foundation)

---

## Success criteria — full Phase 1A green light

Mark Phase 1A as production-ready when ALL of these are true:

- ✅ Wizard walks all 6 steps without UI errors
- ✅ Publish succeeds and creates real Campaign + AdSet + Creative + Ad on Meta
- ✅ All 4 Meta IDs are persisted on the local Campaign row
- ✅ Launch button flips Meta status PAUSED → ACTIVE
- ✅ Pause button flips back ACTIVE → PAUSED
- ✅ Sync pulls real spend + impressions back
- ✅ Delete in Ads Manager doesn't break our app (campaign just shows ENDED next sync)

When all green, post a screenshot of the real ad running in Ads Manager + the AdGenius campaign page with real metrics — that's the "shipped" milestone for Phase 1A.
