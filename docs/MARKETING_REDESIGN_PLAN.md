# Marketing site redesign — implementation plan

**Status (2026-10-20):** phases 1–10 implemented in the working copy, not yet committed. Production build, type-check and lint pass. Remaining before launch: the open ⚠️ copy decisions in [§ 2](#2-decisions-needed-before-we-start), and the env vars for the contact form ([§ 8](#8-progress)).

**Goal:** replace the current marketing site (`advertix.io`) with the new "Option C" design from the mockups, page by page, without breaking anything Meta App Review depends on and without touching the dashboard.

**Mockups (source of truth for visuals):** `F:\prev-desktop\proexe\advertix-repo\Advertix UI Redesign mockup\marketing\`

This is part 1 of the larger UI update. Order: **marketing site (this plan)**, then dashboard redesign, then new and updated features. Those get their own plans.

---

## 1. What we're building

### Pages

| Page | Mockup | Route | Today |
|---|---|---|---|
| Home | `Home.dc.html` | `/` | Rebuild ([page.tsx](../apps/web/app/(marketing)/page.tsx)) |
| How it works | `How It Works.dc.html` | `/how-it-works` | **New** |
| Product | `Features.dc.html` | `/product` (301 from `/features`) | Rebuild ([features/page.tsx](../apps/web/app/(marketing)/features/page.tsx)) |
| For agencies | `Agencies.dc.html` | `/agencies` | **New** |
| Pricing | `Pricing.dc.html` | `/pricing` | **New** |
| About | `About.dc.html` | `/about` | Rebuild |
| Contact | `Contact.dc.html` | `/contact` | Rebuild |
| Privacy, Terms | — (no mockup; see note) | `/privacy`, `/terms` (unchanged URLs) | **Restyle only** — same text, new look |

**Legal (decided 2026-10-20):** the `Legal.dc.html` mockup is **not** used, so there's no tabbed legal template, no plain-English summary and no deletion form. The current Privacy and Terms pages keep their content exactly as it is and only get the new visual style (paper background, new type, eyebrow plus serif-accent title, readable text column). `/data-deletion` is out of scope and keeps its content. It sits inside the new header and footer automatically.

Ignore: `Legal.dc.html`, `Home v1.dc.html`, `_archive/`, `Mobile.dc.html` (a phone-frame preview of the other pages, not a page).

> The mockup `README.md` is partly out of date. It mentions a particle network, 3D tilt, magnetic buttons, count-ups and a dark-mode toggle, and none of these exist in the current mockups. `REDESIGN-PLAN.md` and the `.dc.html` files are what count.

### Design language (shared by every page)

- **Colours:** paper `#f8f6f1`, paper-2 `#fffdf8`, surfaces `#f1eee6` / `#e7e3d8`, ink `#15131a` / `#5a5664` / `#8e8a97`, brand `#6448f2` (ink `#4428d6`, soft `#efeafd`), status pos `#0b7d50` / neg `#c23a3f` / warn `#9a5c00`, logo gradient `115deg #8a3ffc → #5d5cff → #2d8cff`, dark bands `#15131a` / `#0d0b17`.
- **Type:** Geist (500 headings), an **Instrument Serif italic** accent on the last phrase of each headline, and Geist Mono uppercase eyebrows.
- **Shapes:** pill buttons, 2px rules at 12% ink between sections, dark rounded product panels with a dot grid and glow, dark CTA band at the bottom of every page.
- **Light theme only.** The marketing mockups have no dark mode.
- **Motion:** Lenis smooth scroll, GSAP + ScrollTrigger reveals (line rise, fade up, staggered rise), and on Home and How it works, pinned scroll scenes.

### Interactive pieces (each one is a client component)

| Page | Interactive demos |
|---|---|
| Home | Live allocation engine (animated budget flow across 5 platforms, Even vs Advertix toggle), live tour (6 tabs, auto-advance), "night shift" horizontal scroll with clock, AI chain with typewriter + approve toggle, per-client autonomy demo, release board, FAQ, ROI estimator slider |
| How it works | 4-step pinned scroller (connect → read → decide → control) incl. 7×24 heatmap, setup checklist with time left |
| Product | Sticky module index with scroll-spy, 6 mini product UIs, platform coverage matrix |
| For agencies | Client book switcher, hours-saved calculator (slider), per-client autonomy cards, white-label portal toggle |
| Pricing | Monthly/yearly toggle, plan finder (spend + clients sliders → best-fit plan), compare table, FAQ |
| About | Role explorer (11 roles) |
| Contact | Book a demo (day + time slots) / send a message, sent states |

---

## 2. Decisions needed before we start

Recommended answer first. Items marked ⚠️ are claims on a public website, so a wrong answer is a real problem, not a cosmetic one.

**Decided 2026-10-20:**
- **#1 Start free** → `app.advertix.io/sign-up`; "Book a demo" → `/contact#demo`.
- **#2 / #3 Contact** → "Send a message" via `/api/contact` + Resend; "Book a demo" via a Cal.com embed styled like the mockup.
- **#7 Live ticker** → keep it as in the mockup (static text).
- **#11 Release** → changes are made in the working copy; the owner verifies locally and pushes straight to `main`. No feature branch.
- Until the remaining ⚠️ items are confirmed, the mockup copy is used as-is.

1. **Where does "Start free" go?** The mockup sends every CTA to `Contact#demo`. **Recommend:** "Start free" → `app.advertix.io/sign-up`, and "Book a demo" → `/contact#demo`.
2. **Demo booking.** The mockup's day and time slots are fake. **Recommend:** a Cal.com (or Calendly) embed inside the mockup's card styling. Building our own availability, invites and timezones is days of work. Alternative: ship "Send a message" only and add booking later.
3. **Contact and deletion forms need a backend.** Today the contact form opens `mailto:` ([ContactForm.tsx:31-39](../apps/web/app/(marketing)/contact/ContactForm.tsx#L31-L39)). **Recommend:** a Next.js route `/api/contact` that sends email through **Resend** (needs an account plus `RESEND_API_KEY` and `CONTACT_TO`), with a honeypot field and rate limiting.
4. ~~Legal text~~: **decided.** The Legal mockup is ignored; Privacy and Terms keep their text and get a restyle only.
5. ~~Data-deletion form~~: **decided.** Out of scope. The compliance gaps in [§ 6](#6-compliance-gaps-found-outside-the-marketing-site) still exist but no longer block this redesign.
6. ⚠️ **Company name.** The mockup footer says "© 2026 Advertix, Inc." The current legal pages say the service is operated by an individual in Pakistan. Use the real legal entity.
7. ⚠️ **Fake live data.** The header ticker "LIVE · 23 ACCOUNTS · CHECKED 4 MIN AGO" is hard-coded. **Recommend:** drop it, or label it as an example.
8. ⚠️ **Numbers and promises to confirm:**
   - Pricing: Founder $79, Team $199, Agency $499, Enterprise custom; yearly = 2 months free; "free during beta, 30% off for the first year"; per-plan limits; refund policy.
   - Agencies: hours-saved table, $85/h, "5 to 50 clients" (Pricing caps Agency at 10 clients).
   - Trust stats: AES-256, MFA, "7-day undo", "0 models trained on your data", "15% daily guardrail".
   - "Synced hourly" / "checked every six hours", "first briefing at 08:00".
   - Snapchat shown as supported or "Soon". It isn't integrated today.
   - About timeline (mockup says 2025 start; current page says May 2026), the founder card (dropped in the mockup), e-mail addresses (`sales@`, `security@`, `privacy@` must exist).
   - Naming **Claude** as the AI vendor on the site.
9. **Live tour on Home.** The mockup embeds the dashboard mockups in iframes. The real redesigned dashboard doesn't exist yet. **Recommend:** use screenshots now (taken from the dashboard mockups), switch to short screen recordings once the new dashboard ships, and never embed the live app.
10. **`/features` → `/product`.** **Recommend:** a 301 redirect so old links and search rankings keep working.
11. **Release approach.** **Recommend:** build on a `marketing-redesign` branch and review on Vercel preview URLs (the middleware already serves every route on `*.vercel.app`), then merge when every page is done. That way the live site never shows a mix of old and new pages.

---

## 3. Technical approach

### 3.1 Scope the new styles to marketing only

The dashboard currently loads Plus Jakarta Sans globally ([globals.css:1](../apps/web/app/globals.css#L1)), and the root `<body>` is hard-coded to `bg-white` ([layout.tsx](../apps/web/app/layout.tsx)). The dashboard redesign comes later and uses different tokens with the same names (`--ink`, `--brand`, `--line`). So:

- **Fonts:** load Geist, Geist Mono and Instrument Serif with `next/font/google` **in the marketing layout only**, exposed as CSS variables.
- **Tokens:** define them as `--mk-*` CSS variables on a `.mk` wrapper in [(marketing)/layout.tsx](../apps/web/app/(marketing)/layout.tsx), and map them in Tailwind under an `mk` colour key (`bg-mk-paper`, `text-mk-ink`, `border-mk-rule`, …). Nothing named `--ink` / `--brand` at root level, so the dashboard redesign can claim those later.
- **Breakpoints:** the mockups pick layouts in JavaScript from `window.innerWidth`, which causes hydration mismatches in Next.js. Replace that with CSS: add Tailwind screens `mk-sm 600`, `mk-md 760`, `mk-lg 960`, `mk-xl 1100`, `mk-2xl 1320` and use responsive classes everywhere. Header nav vs hamburger is CSS too.

### 3.2 Server vs client components

Pages stay **Server Components** (good for SEO and for the Meta-reviewed legal URLs). Each interactive demo is a small `"use client"` island. Copy and data live in typed config files (`lib/marketing/*.ts`) instead of being mixed into JSX. This also lets Agencies and Pricing share one `lib/marketing/pricing.ts`, so "$499" can't drift between pages.

### 3.3 Motion

- **Dependencies:** `gsap` (ScrollTrigger is included and free), `@gsap/react` (`useGSAP` gives automatic cleanup), `lenis`. Load them from npm, not a CDN. `framer-motion` is installed but unused; remove it during cleanup if it's still unused.
- **`<SmoothScroll>`** in the marketing layout: one Lenis instance tied to the GSAP ticker. It's destroyed when leaving marketing routes, so it never runs in the dashboard. Hash links use `scroll-margin-top` rather than click interception, which plays nicer with `next/link`.
- **`<Reveal variant="line|up|rise">`** replaces the mockup's `data-line` / `data-up` / `data-rise` attributes. Content must **stay visible without JavaScript**: the hidden "before" state only applies once a `mk-motion` class is set on `<html>`, and never under `prefers-reduced-motion`.
- **Pinned scenes** (Home hero, Home night shift, How it works steps) use `gsap.matchMedia()`. They're desktop only. On mobile they become normal stacked sections, including the night shift, which the mockup scroll-jacks at all widths.
- Kill all ScrollTriggers and timelines on unmount and route change. Replace the mockup's "refresh every 700 ms" workaround with fixed aspect ratios plus one refresh after fonts load.
- Write high-frequency animation values (the allocation engine) to refs, not React state.

### 3.4 Accessibility fixes over the mockups

The mockups have gaps we'll fix while porting:

- `--mk-ink3` `#8e8a97` on paper is about 3.2:1, which fails AA for the 12px mono labels. Darken it slightly (to ≥ 4.5:1).
- Proper ARIA for tabs, segmented controls (radiogroup), toggles (`aria-pressed`), the FAQ accordion (`aria-expanded`, collapsed content hidden), the mobile menu (`aria-expanded`, Esc to close, focus trap), and `aria-current` on the active nav link.
- Range sliders get `<label>` and `aria-valuetext` ("$60k per month"). Coverage and compare matrices become real `<table>` markup with text alternatives for the dots.
- Live tour auto-advance gets a pause control (WCAG 2.2.2). Typewriter text has the full string in `aria-label`.
- Forms use real `<label>`, `type="email"`, `required`, `autocomplete`, visible focus rings, inline errors, disabled submit with a reason, and an `aria-live` success message.

### 3.5 Routing, SEO, housekeeping

- [middleware.ts](../apps/web/middleware.ts): add `/how-it-works`, `/agencies`, `/pricing`, `/product` to `isPublicRoute` **and** `MARKETING_ONLY_PATHS`.
- `next.config` redirect `/features` → `/product` (301).
- Add `app/sitemap.ts` and `app/robots.ts` (neither exists today), plus per-page `metadata` (title, description, OG).
- Replace the marketing [loading.tsx](../apps/web/app/(marketing)/loading.tsx) skeleton (it mimics the old dark hero).
- Delete once unused: `MarketingNav`, `MarketingFooter`, `GradientMesh`, `DashboardMockup`, and the old page sections.

---

## 4. Shared building blocks (built once in phase 1)

`components/marketing/` (new folder layout; old files removed at the end):

| Group | Components |
|---|---|
| Shell | `SiteHeader`, `MobileMenu`, `SiteFooter`; nav and footer links in `lib/marketing/nav.ts` |
| Layout | `Section` (padding clamp, 1280 container, `tone="paper | band | dark"`, top rule), `SectionHead` (eyebrow + heading left, lede right) |
| Type | `Eyebrow`, `AccentHeading` (sans text + serif-italic `accent`), `HeroTitle` (two masked lines) |
| Controls | `PillButton` (brand, ink, outline, on-dark, ghost-on-dark; 42/50/56 heights), `SegmentedControl`, `Chip`, `RangeField`, `TextField`, `TextArea` |
| Display | `PlatformMark`, `StatusChip`, `StatBlock`, `ProgressBar`, `RuledList`, `RuledGrid`, `DarkPanel` (dot grid + glow), `BrowserFrame`, `AiNote` |
| Sections | `CtaBand`, `FaqAccordion`, `ComparisonTable` (coverage matrix + pricing compare), `TrustStats` |
| Motion | `SmoothScroll`, `Reveal`, `useMarketingMotion` helpers |

---

## 5. Phases

One PR per phase, all into the `marketing-redesign` branch. Each PR includes screenshots at **390 / 768 / 1024 / 1440**, passes `tsc --noEmit` and `next lint`, and is checked with reduced motion on.

| # | Phase | Contents | Rough size |
|---|---|---|---|
| 0 | **Decisions** | Answers to [§ 2](#2-decisions-needed-before-we-start); final copy for prices and claims | — |
| 1 | **Foundations** | Dependencies, fonts, `mk` tokens and screens, motion kit, all shared blocks in [§ 4](#4-shared-building-blocks-built-once-in-phase-1), new header, mobile menu and footer, layout swap, middleware, redirect, sitemap and robots | 2–3 days |
| 2 | **Home** | 2a: static sections (hero copy, problem, AI chain, agencies, release board, trust, FAQ, CTA, ROI). 2b: allocation engine, live tour (screenshots), night shift, hero pin | 3–4 days |
| 3 | **How it works** (new) | Hero + fact strip, pinned 4-step scroller with 4 panes, pipeline, setup checklist | 1.5 days |
| 4 | **Product** | Module index, sticky scroll-spy nav, 6 module chapters with mini UIs, coverage matrix, trust stats | 1.5 days |
| 5 | **For agencies** (new) | Client book, hours calculator, autonomy cards, white-label portal, pillars, onboarding timeline | 2 days |
| 6 | **Pricing** (new) | Billing toggle, plan finder, plan cards, compare table, FAQ; `lib/marketing/pricing.ts` | 1.5 days |
| 7 | **About** | Mission and vision (verbatim), role explorer, four rules, timeline | 1 day |
| 8 | **Contact** | Book a demo (embed) / message form, sent states, call agenda; `/api/contact` + Resend | 1.5–2 days |
| 9 | **Privacy + Terms restyle** | Same content, new look: a shared `LegalPage` wrapper (hero with eyebrow + serif-accent title + "effective" date, readable prose column, styled headings, lists and links). No tabs, no form. | 0.5–1 day |
| 10 | **QA and launch** | Cross-browser, mobile, a11y and Lighthouse pass, no-JS check, metadata and OG, verify Meta URLs return 200, delete old components, merge to `main` | 1–2 days |

**Total: about 16–19 working days** for one developer, not counting the compliance work in § 6.

Mockup page order (`REDESIGN-PLAN.md`) puts How it works first. This plan does **Home first** after foundations: it's the most-visited page, and it's the hardest, so it proves the motion kit early.

### Definition of done (per page)

- [ ] Matches the mockup at 390 / 768 / 1024 / 1440
- [ ] Copy matches the mockup, except where § 2 decided otherwise
- [ ] Works with JavaScript disabled (content visible, links work) and with reduced motion
- [ ] Keyboard: sensible tab order, visible focus, Esc closes menus
- [ ] No hard-coded colours outside the `mk` tokens
- [ ] Page `metadata` set; page listed in the sitemap
- [ ] No fake "live" data presented as real

---

## 6. Compliance gaps found outside the marketing site

These came up while comparing the Legal mockup with today's code. The Legal mockup is out of scope now, so they **don't block this redesign**, but they still matter for **Meta App Review** and for honesty in the published policy. Track them separately.

1. **"Delete my account" does nothing.** [data-deletion/page.tsx](../apps/web/app/(marketing)/data-deletion/page.tsx) (Option A) tells users to go to Settings → Danger Zone → Delete my account, but that button only shows a "disabled in demo" toast ([settings/page.tsx](../apps/web/app/(dashboard)/settings/page.tsx), Danger Zone). Workspace reset and data export are toast-only too.
2. **No Meta data-deletion callback.** The policy says "Meta will notify us automatically". There's no deauthorize or data-deletion callback endpoint in `apps/api/src`.
Options: build items 1–2 (about 2–3 days of backend work), or reword the data-deletion page to match what exists today (deletion handled manually by e-mail) until they're built.

---

## 7. Gotchas

- **Meta-reviewed URLs** `advertix.io/privacy`, `/terms`, `/data-deletion` must keep returning 200 with server-rendered content. The restyle must not change their URLs or remove any text.
- **Host routing:** marketing pages only live on the apex domain; `app.advertix.io/<marketing path>` redirects to the apex. New pages must be added to the middleware lists, or they'll be auth-gated or bounce.
- **Lenis must not leak into the dashboard.** Mount it in the marketing layout only and destroy it on unmount.
- **GSAP `from()` flashes:** without the `mk-motion` gate, content renders visible, then hides, then animates. Gate it so there's no flash and no hidden content without JS.
- **Mockup typos and inconsistencies:** "snapchat" lower-case in the Home hero; TikTok mark colour differs between pages; footer link sets differ slightly; Agencies portal chips ("Campaign names", "Internal notes", "AI summary") don't change anything. Fix or cut them while porting.

---

## 8. Progress

| Phase | State | Notes |
|---|---|---|
| 1 Foundations | ✅ | `mk` tokens and screens, Geist (`geist` package) + Instrument Serif, `MarketingMotion` (Lenis + `data-reveal="line \| up \| rise \| grow"`), shared blocks in `components/marketing/ui/`, new header and footer, sitemap and robots |
| 2 Home | ✅ | Live tour uses 2× screenshots of the dashboard mockups in `public/marketing/tour/`. Copy softened from "THE REAL WORKSPACE · NOT A MOCKUP VIDEO" until the redesigned dashboard ships (`TODO(dashboard-redesign)` in `LiveTour.tsx`) |
| 3 How it works | ✅ | |
| 4 Product | ✅ | `/features` redirects permanently to `/product` |
| 5 For agencies | ✅ | The portal's visibility chips all work now (the mockup only wired "Show spend") |
| 6 Pricing | ✅ | Prices live in `lib/marketing/pricing.ts` (shared with /agencies) |
| 7 About | ✅ | Founder card from the old page dropped, as in the mockup |
| 8 Contact | ✅ | `/api/contact` sends through Resend. "Book a demo" embeds Cal.com when `NEXT_PUBLIC_CAL_LINK` is set; otherwise a demo-request form emails you a preferred day and time |
| 9 Privacy + Terms | ✅ | Restyle only: `LegalLayout` + `.mk-legal` styles; legal text unchanged |
| 10 QA | ✅ | Checked at 390 / 768 / 1024 / 1440: no horizontal overflow, no console errors, content visible with JS off and with reduced motion. Old marketing components and the unused `framer-motion` dependency removed |

**To switch the contact form on** (Vercel env vars, see `apps/web/.env.production.example`): `RESEND_API_KEY`, `CONTACT_TO`, `CONTACT_FROM` (a sender on a domain verified in Resend), and optionally `NEXT_PUBLIC_CAL_LINK`. Without `RESEND_API_KEY` the form shows "email us instead".

**Deliberate deviations from the mockups:** muted text darkened for WCAG AA; "Start free" → `/sign-up`; demo-request copy says "we'll confirm by email" rather than claiming a booking; mobile night-shift uses native horizontal swipe instead of scroll-jacking; "snapchat" typo fixed; real `<table>` markup with screen-reader labels for the coverage and compare tables; pause button on the auto-advancing tour.
