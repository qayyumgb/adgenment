import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

const isPublicRoute = createRouteMatcher([
  "/",
  "/sign-in(.*)",
  "/sign-up(.*)",
  "/onboarding(.*)",
  "/api/webhooks(.*)",
]);

const isOnboardingRoute = createRouteMatcher(["/onboarding(.*)"]);

export default clerkMiddleware((auth, req) => {
  const { userId, sessionClaims } = auth();

  // 1. Public routes — let through.
  if (isPublicRoute(req) && !isOnboardingRoute(req)) {
    return;
  }

  // 2. Anything non-public requires sign-in.
  if (!userId && !isPublicRoute(req)) {
    return auth().redirectToSignIn({ returnBackUrl: req.url });
  }

  // 3. Signed-in users without completed onboarding go to /onboarding.
  // TODO: Wire up real publicMetadata.onboardingComplete via Clerk's
  //       session JWT template (Dashboard → Sessions → Customize session
  //       token → add { "metadata": "{{user.public_metadata}}" }), then
  //       remove the `false &&` short-circuit below.
  const claims = sessionClaims as
    | { metadata?: { onboardingComplete?: boolean } }
    | undefined;
  const onboardingComplete = claims?.metadata?.onboardingComplete === true;

  if (
    false && // <-- remove once Clerk metadata is wired
    userId &&
    !onboardingComplete &&
    !isOnboardingRoute(req)
  ) {
    return NextResponse.redirect(new URL("/onboarding", req.url));
  }
});

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
