/**
 * Translate raw Meta Graph API errors into plain, actionable messages for the
 * UI. Meta's error codes are cryptic ("(#3) Application does not have the
 * capability…"); beta users need to know what to actually DO. Errors thrown by
 * metaService.graphFetch carry `metaCode` / `metaSubcode` / `metaUserMessage`
 * so we can map without brittle string parsing.
 */

/** A Meta Graph API error, tagged by metaService.graphFetch. `metaCode` is
 *  required so the type guard narrows cleanly (an optional field would let any
 *  Error structurally match). */
export type MetaError = Error & {
  metaCode: number;
  metaSubcode?: number;
  /** The human-readable part Meta returned (error_user_msg / message). */
  metaUserMessage?: string;
};

/** Does this error originate from a Meta API call? */
export function isMetaError(err: unknown): err is MetaError {
  return err instanceof Error && typeof (err as MetaError).metaCode === "number";
}

/**
 * Map a Meta error to an HTTP status + a friendly message. Falls back to the
 * raw user message (which is often already specific, e.g. for code 100) or a
 * generic line.
 */
export function friendlyMetaError(err: MetaError): {
  status: number;
  message: string;
} {
  const code = err.metaCode;
  const raw = err.metaUserMessage?.trim();

  switch (code) {
    case 3:
      return {
        status: 403,
        message:
          "Publishing isn't available yet — your app is awaiting Meta Standard Access (Marketing API review). You can manage existing campaigns, but creating new ones unlocks once approved.",
      };
    case 10:
    case 200:
      return {
        status: 403,
        message:
          "You don't have permission for this on the connected ad account. You need Advertiser or Admin access — an Analyst role is read-only.",
      };
    case 190:
      return {
        status: 401,
        message:
          "Your Meta connection has expired. Reconnect your account in Settings → Integrations.",
      };
    case 4:
    case 17:
    case 32:
    case 613:
      return {
        status: 429,
        message: "Meta is rate-limiting requests right now. Wait a minute and try again.",
      };
    case 100:
      // Funding/payment problems often arrive as code 100. Otherwise the raw
      // user message is already field-specific — surface it.
      if (raw && /payment|funding|billing|spend limit/i.test(raw)) {
        return {
          status: 402,
          message:
            "Your Meta ad account can't run ads yet — add a payment method (and check any spend limit) in Meta Business settings.",
        };
      }
      return {
        status: 400,
        message: raw || "Meta rejected the request — please check the campaign details.",
      };
    case 2:
      return { status: 502, message: "Meta had a temporary error. Please try again." };
    default:
      return {
        status: 502,
        message: raw || "Something went wrong talking to Meta. Please try again.",
      };
  }
}
