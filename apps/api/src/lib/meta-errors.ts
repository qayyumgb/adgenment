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
 * Map a Meta error to an HTTP status + a friendly message, plus a `detail`
 * string carrying exactly what Meta said.
 *
 * `detail` exists because the friendly message is a *guess at the cause* for
 * several codes — most notably code 3, which Meta uses for every "your app
 * can't do this" situation. Discarding Meta's own wording (as this function
 * used to) made those failures undiagnosable: the UI confidently stated one
 * cause while the real one stayed invisible. Always surface both.
 */
export function friendlyMetaError(err: MetaError): {
  status: number;
  message: string;
  detail: string;
} {
  const code = err.metaCode;
  const raw = err.metaUserMessage?.trim();
  const subcode = err.metaSubcode ? `/${err.metaSubcode}` : "";
  const detail = `Meta code ${code}${subcode}${raw ? `: ${raw}` : ""}`;
  const withDetail = (status: number, message: string) => ({
    status,
    message,
    detail,
  });

  switch (code) {
    case 3:
      // Code 3 is Meta's catch-all capability error. The usual cause is an app
      // still on Development/Limited Marketing API access, where write
      // endpoints are blocked while reads succeed — which is why connecting
      // and syncing work but publishing doesn't. It also fires when the app is
      // missing the Marketing API product, or when ads_management wasn't
      // granted. Meta's own wording distinguishes them, so lead with it.
      return withDetail(
        403,
        raw
          ? `Meta refused this call: ${raw} — this usually means the Meta app doesn't have write access to the Marketing API yet (Development/Limited tier allows reading but not creating ads).`
          : "Your Meta app doesn't have permission to create ads. This usually means it's still on Development/Limited Marketing API access, which allows reading campaigns but not creating them."
      );
    case 10:
    case 200:
      return withDetail(
        403,
        raw
          ? `Meta denied permission: ${raw} — check your role on the ad account (Advertiser or Admin; Analyst is read-only).`
          : "You don't have permission for this on the connected ad account. You need Advertiser or Admin access — an Analyst role is read-only."
      );
    case 190:
      return withDetail(
        401,
        "Your Meta connection has expired. Reconnect your account in Settings → Integrations."
      );
    case 4:
    case 17:
    case 32:
    case 613:
      return withDetail(
        429,
        "Meta is rate-limiting requests right now. Wait a minute and try again."
      );
    case 100:
      // Subcode 1885183 — "Ads creative post was created by an app that is in
      // development mode." Meta blocks AD CREATIVE creation (not campaigns, not
      // ad sets) when the calling app is in Development mode, because the
      // creative implies a Page post authored by a non-public app.
      //
      // This is the trap that makes a Meta *test app* useless for publishing:
      // test apps are permanently in Development mode, so steps 1-3 of publish
      // succeed and step 4 always fails. Confirmed empirically 2026-08-05.
      if (err.metaSubcode === 1885183) {
        return withDetail(
          403,
          "The connected Meta app is in Development mode, and Meta won't let a development-mode app create ads. Connect using a Live app (Settings → Integrations) — Meta test apps can never publish, because they can't leave Development mode."
        );
      }
      // Funding/payment problems often arrive as code 100. Otherwise the raw
      // user message is already field-specific — surface it.
      if (raw && /payment|funding|billing|spend limit/i.test(raw)) {
        return withDetail(
          402,
          "Your Meta ad account can't run ads yet — add a payment method (and check any spend limit) in Meta Business settings."
        );
      }
      return withDetail(
        400,
        raw || "Meta rejected the request — please check the campaign details."
      );
    case 2:
      return withDetail(502, "Meta had a temporary error. Please try again.");
    default:
      return withDetail(
        502,
        raw || "Something went wrong talking to Meta. Please try again."
      );
  }
}
