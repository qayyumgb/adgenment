# Marketing site — claims audit (2026-10-27)

Every feature claim on advertix.io (Home, Product, How it works, Agencies, Pricing, About, header and footer), checked against what the app does today and the plan (`DASHBOARD_REDESIGN_PLAN.md` Track C).

**Status (2026-10-27): copy fixed** with the recommendations accepted for all of section 4.
- **Item 5 (Night shift):** now "What Advertix found while you slept"; the automatic versions are planned as C12 morning briefing, C13 guarded auto-apply and C14 safety rules.
- **Snapchat:** "coming soon" everywhere; illustrative demos keep it, with a note.
- **When C12–C14 ship:** restore the stronger Night shift, AiChain and autonomy copy.

**Key:**
- ✅ **Live:** works today.
- 🟡 **Partial:** works with limits; reword the claim.
- 🔜 **Coming soon:** in Track C; label it as coming.
- ❌ **Not planned / doesn't add up:** decide whether to remove it or add it to the plan (section 4).

Pages are abbreviated as: H Home · P Product · HIW How it works · A Agencies · PR Pricing · AB About.

---

## 1. Live (keep as is)

| Claim | Where |
|---|---|
| AI Planner: describe a goal and get campaigns, a budget split and a forecast; refine in plain English; created as paused drafts | H tour, P, PR |
| Suggestions you apply, snooze ("Not now") or undo, each with the numbers behind it; written by Claude | H, P, HIW |
| 7-day undo, and a full history of who or what changed what | H, P, HIW, A, PR |
| Client switcher on every page | A |
| Monthly cap per client, with pacing and run-out warnings | H, P, A, HIW |
| Budget allocator on response curves: drag a budget and see the projected result, with the recommended split marked | H tour, P |
| Creative studio: drafts from the best-performing hook, image or carousel, with tone and format | H, P, PR |
| Fatigue bar on every creative | H tour, P |
| Roles: buyers, analysts, client viewers. Free client viewer seats on Agency | A, PR |
| OAuth tokens encrypted with AES-256, disconnect any time, no model training on your data | H, P, AB |
| Advertix suggests which client an account belongs to, from its name | HIW |
| Campaigns grid: sort, columns, row height, pause/resume toggle, bulk actions | H tour |
| Email alerts (access expiring, sync failures, budget pacing, weekly summary) | PR (Founder: "Email alerts") |
| Free during beta, flat price, not a cut of spend | PR |

## 2. Partial (true in part, so reword)

| Claim today | Reality | Suggested wording |
|---|---|---|
| "Meta, Google, TikTok and LinkedIn connect … with **two-way sync**" (H FAQ, AB timeline, HIW "in sync both ways") | Only **Meta** is two-way (publish, pause, budgets). Google, TikTok and LinkedIn are **read-only**: campaigns and results sync in, but changes are made on the platform. | "Meta: full two-way. Google, TikTok, LinkedIn: campaigns and results sync in; publishing from Advertix is coming." |
| Platform coverage table (P): Google, TikTok and LinkedIn **Full** for publish, apply, budget moves and creative upload | Read-only for those three | Mark them Partial ("sync and insights") or Coming |
| "Synced **hourly**" / "every hour" (HIW) | The scheduler syncs every **6 hours**; Sync now is instant | "every few hours, or on demand" |
| "Read **90 days** of history" (HIW) | True for Meta's first sync; check the other platforms | Keep for Meta, or say "up to 90 days" |
| "Cross-platform budget moves" / "the AI decides which platform gets each dollar" (H hero, P) | The allocator **suggests** cross-platform splits; budgets are applied on **Meta** only | "Advertix shows where the next dollar earns most; Meta budgets apply in one click" |
| Alerts: "Broken pixels, CPA spikes, expiring tokens, pacing … within the hour, grouped per campaign; Email, **Slack** or **in-app**; fix from the alert" (P, A) | Email only, for expiring/expired access, sync failures, pacing and the weekly summary. No CPA spikes, no grouping, no Slack or in-app. | Keep the email events as Live; the rest as Coming (C2) |
| "Learns from 'not now': declined ideas stop coming back" (P) | Not now snoozes a suggestion for 7 days; there's no learning | "Not now hides it for a week" |
| "Approvals and history" (A, PR Team) | History ✅, approvals ❌ (C1) | "History and undo" now; "Approvals" coming |
| Setup "Create your workspace: agency name, **logo** and default **currency**" (HIW) | Name, website and industry, yes; logo upload and default currency, no | Drop "logo and default currency", or mark as coming |
| Setup "Choose AI autonomy: suggest only, small changes or autopilot" (HIW), autonomy cards (A, H) | Only **Suggest only** works; Auto-apply and Autopilot show as coming soon in Settings | Show "Suggest only" as live and the others as coming |
| "Every account is checked every **six** hours" (P, HIW) | Matches the 6-hour sync, and suggestions refresh with it | ✅ fine, once "hourly" above is fixed |
| Plan limits: "Creative studio · **40** drafts/mo" (Founder), "**200**" (Team) | No draft limits exist or are enforced | Remove the numbers, or build limits with billing (C11) |

## 3. Coming soon (in Track C; label clearly)

| Claim | Track C item | Where |
|---|---|---|
| Command palette, "⌘K in two keystrokes" | C3 | H board, A |
| Approvals above a guardrail | C1 | H, A, PR (Team) |
| Alerts inbox: CPA spikes, pixel/tracking health, grouped per campaign, fix from the alert | C2 | H board, P, A |
| White-label client portal + scheduled weekly PDF reports with an AI summary | C4 | H board, P, A, PR (Agency) |
| Smart hours / hour-of-day scheduling | C7 (and C6) | H board, P, PR (Team), coverage table |
| Experiments that call a winner with confidence | C9 | H board, HIW ("significance tests") |
| Snapchat | C8 ("or keep it coming soon") | everywhere, see 4.1 |
| Warehouse / Shopify / GA4 revenue | C11 | H board, PR (Enterprise) |
| Scheduled budget changes ("new budgets go live at midnight") | C10 (scheduled budgets) | P |

## 4. Not planned or doesn't add up: please decide each (keep and plan it, reword, or remove)

1. **Snapchat as the fifth live platform.** "Five platforms", "one AI that sees all of them" (hero), the coverage table column, Snapchat in every demo, "Snapchat, fully live · rolling out" (board), "Snapchat leaves beta" (AB timeline). There's no Snapchat integration yet; the app shows it as coming soon.
   *Options:* plan C8 and say "Snapchat coming soon" everywhere, **or** drop Snapchat from the site until it's built ("four platforms").
2. **Fake live indicator in the header:** "LIVE · 23 ACCOUNTS · CHECKED 4 MIN AGO" is static text that looks like real-time status. *Recommend removing it.*
3. **Release board claims:** "updated weekly", "Every item was requested by an agency in the beta", and progress bars per item. These are invented. *Recommend:* keep a simple "What's coming" list, without fake progress or claims.
4. **About timeline:** "Google, TikTok and LinkedIn joined Meta with two-way sync" (they're read-only), plus "Snapchat and client portal" written as shipped. *Recommend:* correct the past items and move the future ones to "Next".
5. **Autopilot / autonomous actions (the "Night shift" section on Home).** Overnight it "paused campaigns on a broken pixel", "moved $310 a day to TikTok inside your 15% limit", and "applied automatically". The **15% daily guardrail** and "inside the guardrail it applies on its own" also appear on H, P, HIW and A. Auto-apply and Autopilot aren't built, and they **aren't on the Track C list** (only C1 approvals relates). *Decide:* add "Auto-apply + guardrails" to the plan (a real but sizeable feature), **or** rewrite Night shift as "What Advertix found overnight" (suggestions waiting for you) and drop "applies on its own".
6. **"First briefing tomorrow at 08:00" / a daily morning briefing** (HIW setup, A onboarding). There's no daily briefing email, only the in-app Overview and a **weekly** summary email. *Options:* build a small daily briefing email (cheap, since the A14 alert system already exists), **or** reword to "your briefing is waiting on the Overview".
7. **Enterprise plan list:** SSO / SAML and SCIM, audit **export**, dedicated success manager, uptime SLA and DPA. None are built or planned (the audit log exists but there's no export). *Recommend:* say "Enterprise: tailored limits and support; talk to sales", or keep them only once you'd really offer them.
8. **White-label "on your domain" / "Your logo and domain, not ours"** (P, A). C4 plans share links; a custom domain isn't planned. *Decide:* "your logo on reports" (realistic within C4) vs a custom domain (extra work).
9. **"Lead forms" row in the coverage table.** No lead form support, and it isn't planned. *Recommend removing the row.*
10. **"Upload checks: text coverage and safe zones"** (P, Creative studio). Not built or planned. *Recommend removing it*, or plan it as a small creative feature.
11. **"Quiet hours, except money-burning issues"** (P alerts). Not planned. *Recommend removing it*, or folding it into C2.
12. **"Per-platform cuts" of creatives** (P, H tour). The studio picks one format and shape per run; there are no automatic per-platform versions. *Recommend:* reword to "pick the shape for each placement (1:1, 9:16, 16:9)".
13. **Response curves, fatigue, anomalies and "significance tests" all called live statistical models** (HIW pipeline). Fatigue and response curves are real; anomaly detection is C2 and significance tests are C9. *Reword* so only the live ones are listed as running today.

## 5. Fine as is (illustrative or estimates)

Demo data (Halden & Pike, Lumen, $50,000/month, "23 accounts across five platforms") is fine where it's labelled "Example data" or "Illustrative account". The ROI estimator and hours calculator are framed as estimates. Check that each demo keeps that label, and drop Snapchat from the demos if you choose option 4.1.

---

## Next

1. You decide on each item in section 4.
2. I then change the **marketing copy only**:
   - reword section 2;
   - add "Coming soon" labels for section 3;
   - apply your section 4 decisions.
3. The marketing theme (dashboard colours + dark mode) follows as a separate step.
