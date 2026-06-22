import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

/**
 * Truly public routes — accessible without a Clerk session.
 *
 * - `/`                     marketing landing (on apex only — on app subdomain
 *                           we redirect `/` to `/dashboard` BEFORE Clerk runs)
 * - `/sign-in/*`            Clerk sign-in pages
 * - `/sign-up/*`            Clerk sign-up pages
 * - `/api/webhooks/*`       external services posting to us (Stripe, Clerk, etc.)
 * - marketing pages         /privacy, /terms, /features, /about, /contact
 *
 * Signed-in but workspace-less users land on `/onboarding`. That route
 * REQUIRES auth (so it stays out of this matcher) but does NOT require a
 * workspace — the workspace gate lives in the dashboard layout
 * (`apps/web/app/(dashboard)/layout.tsx`) which redirects to `/onboarding`
 * when `getMe()` returns `workspace: null`.
 */
const isPublicRoute = createRouteMatcher([
  "/",
  "/sign-in(.*)",
  "/sign-up(.*)",
  "/api/webhooks(.*)",
  "/privacy",
  "/terms",
  "/features",
  "/about",
  "/contact",
  "/data-deletion",
]);

// Paths that exist only on the marketing site. Hitting these on `app.` should
// send the visitor over to the apex (where they're meant to live).
const MARKETING_ONLY_PATHS = [
  "/features",
  "/about",
  "/contact",
  "/privacy",
  "/terms",
  "/data-deletion",
];

// Paths that ONLY belong on `app.advertix.io`. If a visitor hits one of these
// on the apex (`advertix.io`) or `www.advertix.io`, redirect to the `app.`
// subdomain. This matters for the OAuth popup flow: the backend's
// FRONTEND_URL is `https://app.advertix.io`, so the popup's `/connect/done`
// page must live on the same origin as its opener — otherwise `postMessage`
// is blocked cross-origin and the parent never refreshes after OAuth.
const APP_ONLY_PREFIXES = [
  "/dashboard",
  "/campaigns",
  "/analytics",
  "/audiences",
  "/creatives",
  "/insights",
  "/ai-planner",
  "/billing",
  "/settings",
  "/onboarding",
  "/connect", // /connect/done — popup callback page
  "/sign-in",
  "/sign-up",
];

export default clerkMiddleware(
  (auth, req) => {
    // ── Host-based routing ─────────────────────────────────────────────────
    // `app.advertix.io` is the product. `advertix.io` / `www.advertix.io`
    // are marketing. Same Next.js app serves both; we split traffic here.
    //
    // Local dev and preview deploys are intentionally exempt — `localhost:3000`
    // and `*.vercel.app` need to serve every route on the same host so we can
    // test the full surface without bouncing to production.
    const host = (req.headers.get("host") || "").toLowerCase();
    const pathname = req.nextUrl.pathname;
    const isAppSubdomain = host.startsWith("app.");
    const isProductionHost =
      host === "advertix.io" ||
      host === "www.advertix.io" ||
      host === "app.advertix.io";

    if (isAppSubdomain) {
      // Root on `app.` → dashboard (auth gate below will bounce signed-out
      // users to sign-in).
      if (pathname === "/") {
        const url = req.nextUrl.clone();
        url.pathname = "/dashboard";
        return NextResponse.redirect(url);
      }

      // Marketing routes on `app.` → bounce to apex.
      if (MARKETING_ONLY_PATHS.some((p) => pathname === p)) {
        const url = new URL(pathname, `https://advertix.io`);
        return NextResponse.redirect(url);
      }
    } else if (isProductionHost) {
      // On apex (`advertix.io`) or `www.advertix.io`: if the path belongs to
      // the product, send the visitor to `app.advertix.io`. Keeps the OAuth
      // popup origin consistent with FRONTEND_URL on the backend, and gives
      // users / reviewers a single canonical product URL.
      //
      // Skipped on localhost / vercel.app / any other non-production host so
      // dev environments serve the whole surface from one origin.
      const isAppOnly = APP_ONLY_PREFIXES.some(
        (p) => pathname === p || pathname.startsWith(`${p}/`)
      );
      if (isAppOnly) {
        const url = new URL(
          `${pathname}${req.nextUrl.search}`,
          "https://app.advertix.io"
        );
        return NextResponse.redirect(url);
      }
    }

    // ── Auth gate ──────────────────────────────────────────────────────────
    if (isPublicRoute(req)) return;
    auth().protect();
  },
  {
    // 60-second tolerance for clock skew. Without this, even small drift
    // (laptop sleeps, NTP fails for a minute, container starts before
    // chrony stabilizes) causes Clerk to reject the session cookie and
    // boomerang the user into a sign-in redirect loop with "token-iat-
    // in-the-future". The security cost of 60s is negligible since Clerk
    // session tokens have a short lifetime anyway.
    clockSkewInMs: 60_000,
  }
);

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
