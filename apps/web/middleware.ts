import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

/**
 * Truly public routes — accessible without a Clerk session.
 *
 * - `/`                     marketing landing
 * - `/sign-in/*`            Clerk sign-in pages
 * - `/sign-up/*`            Clerk sign-up pages
 * - `/api/webhooks/*`       external services posting to us (Stripe, Clerk, etc.)
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
]);

export default clerkMiddleware((auth, req) => {
  if (isPublicRoute(req)) return;
  auth().protect();
});

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
