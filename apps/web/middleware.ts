import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

/**
 * Truly public routes — accessible without a Clerk session.
 *
 * - `/`             marketing landing
 * - `/sign-in/*`    Clerk sign-in pages
 * - `/sign-up/*`    Clerk sign-up pages
 * - `/api/webhooks` external services posting to us (Stripe, Clerk, etc.)
 *
 * Everything else (including /onboarding if we ever reintroduce it,
 * /connect/done, /dashboard, etc.) requires a signed-in user. Workspaces
 * are auto-created by the API on first authenticated request, so there is
 * no separate onboarding step today.
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
