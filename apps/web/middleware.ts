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

export default clerkMiddleware(
  (auth, req) => {
    // ── Host-based routing ─────────────────────────────────────────────────
    // `app.advertix.io` is the product. `advertix.io` / `www.advertix.io`
    // are marketing. Same Next.js app serves both; we split traffic here.
    const host = (req.headers.get("host") || "").toLowerCase();
    const pathname = req.nextUrl.pathname;
    const isAppSubdomain = host.startsWith("app.");

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
