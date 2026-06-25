/**
 * Client-side Meta error translator. The API already returns friendly messages
 * for most failures (server-side `friendlyMetaError`), but when a Meta error
 * code is available we can also attach the right *action* (retry / reconnect /
 * open Business Manager). Used by <MetaErrorCard> to render a consistent,
 * actionable error anywhere in the app.
 */

export interface TranslatedMetaError {
  title: string;
  message: string;
  action: string;
  actionUrl?: string;
}

const META_ERROR_MAP: Record<number, TranslatedMetaError> = {
  3: {
    title: "Feature not available yet",
    message: "This feature requires Meta App Review approval. Coming soon!",
    action: "Check what's available now",
  },
  10: {
    title: "Permission not granted",
    message: "You haven't granted Advertix permission to perform this action.",
    action: "Reconnect Meta with full permissions",
    actionUrl: "/settings?tab=integrations",
  },
  17: {
    title: "Too many requests",
    message: "Meta's rate limit reached. Please wait an hour and try again.",
    action: "Try again later",
  },
  100: {
    title: "Invalid request",
    message: "Something went wrong with this Meta request. Please try again.",
    action: "Retry",
  },
  190: {
    title: "Session expired",
    message: "Your Meta session has expired. Please reconnect.",
    action: "Reconnect Meta",
    actionUrl: "/settings?tab=integrations",
  },
  200: {
    title: "Permission denied",
    message: "Missing required Meta permissions. Please reconnect.",
    action: "Reconnect Meta",
    actionUrl: "/settings?tab=integrations",
  },
  368: {
    title: "Ad account disabled",
    message:
      "Your Meta ad account has been disabled. Check Meta Business Manager.",
    action: "Open Meta Business Manager",
    actionUrl: "https://business.facebook.com",
  },
  2635: {
    title: "Ad account not active",
    message: "Your Meta ad account isn't active yet.",
    action: "Activate in Meta Business Manager",
    actionUrl: "https://business.facebook.com",
  },
};

export function translateMetaError(
  code: number | undefined,
  fallbackMessage: string
): TranslatedMetaError {
  if (code != null && META_ERROR_MAP[code]) return META_ERROR_MAP[code];
  return {
    title: "Meta error",
    message: fallbackMessage || "An unexpected error occurred with Meta.",
    action: "Try again or contact support",
  };
}
