/**
 * Meta connection health check. Runs after OAuth (and on demand) to detect
 * every blocking state up front — expired token, missing permissions, no ad
 * account, disabled/unsettled account, no payment method, our pending App
 * Review — so beta users get plain-English guidance instead of a cryptic
 * failure mid-flow. All checks are read-only and work at our current access
 * tier.
 */

import { metaService } from "./meta.service";

export interface HealthCheck {
  status: "ok" | "warning" | "error";
  code: string;
  title: string;
  message: string;
  action: string;
  actionUrl?: string;
  blocking: boolean;
}

export interface MetaHealthReport {
  overall: "healthy" | "degraded" | "blocked";
  checks: HealthCheck[];
  canSync: boolean;
  canPublish: boolean;
  readyForBeta: boolean;
}

const REQUIRED_PERMISSIONS = [
  "ads_read",
  "ads_management",
  "business_management",
] as const;

const ADS_MANAGER_URL = "https://business.facebook.com/adsmanager";
const BUSINESS_URL = "https://business.facebook.com";
const RECONNECT_URL = "/settings?tab=integrations";

function metaCodeOf(err: unknown): number | undefined {
  return err instanceof Error
    ? (err as Error & { metaCode?: number }).metaCode
    : undefined;
}

class MetaHealthService {
  /**
   * Run all checks for a connected Meta ad account.
   * @param token  decrypted access token
   * @param adAccountId  Meta numeric account id (without the `act_` prefix)
   */
  async runAllChecks(
    token: string,
    adAccountId: string
  ): Promise<MetaHealthReport> {
    const checks: HealthCheck[] = [];
    // App Review is OUR limitation — always surfaced, never blocking for beta.
    const appReviewCheck: HealthCheck = {
      status: "warning",
      code: "PENDING_APP_REVIEW",
      title: "Meta App Review in progress",
      message:
        "Advertix is awaiting Meta's approval to publish ads on your behalf. You can sync and view existing campaigns now. Publishing new ads will be available once approved (usually 5–14 days).",
      action: "Learn what's available now",
      blocking: false,
    };

    // ── CHECK 1 — Token valid ──────────────────────────────────────────────
    try {
      await metaService.getMe(token);
    } catch (err) {
      const code = metaCodeOf(err);
      checks.push(this.tokenError(code));
      checks.push(appReviewCheck);
      return this.report(checks, { syncTestPassed: false });
    }

    // ── CHECK 2 — Required permissions ─────────────────────────────────────
    try {
      const perms = await metaService.getPermissions(token);
      const granted = new Set(
        perms.filter((p) => p.status === "granted").map((p) => p.permission)
      );
      for (const perm of REQUIRED_PERMISSIONS) {
        if (!granted.has(perm)) {
          checks.push({
            status: "error",
            code: `MISSING_PERMISSION_${perm.toUpperCase()}`,
            title: `Missing permission: ${perm}`,
            message: `Advertix needs the '${perm}' permission to manage your ads. Please reconnect and make sure to approve all requested permissions.`,
            action: "Reconnect Meta with all permissions",
            actionUrl: RECONNECT_URL,
            blocking: true,
          });
        }
      }
    } catch {
      // Non-fatal — if the permissions edge is unavailable, downstream calls
      // will surface the real problem.
    }

    // ── CHECK 3 — Ad account exists ────────────────────────────────────────
    let accountStatus: number | null = null;
    try {
      const accounts = await metaService.getAdAccounts(token);
      const match = accounts.find((a) => {
        const raw = a.id.startsWith("act_") ? a.id.slice(4) : a.id;
        return raw === adAccountId;
      });
      if (!match) {
        // The list came back but this account isn't in it (or list is empty).
        if (accounts.length === 0) {
          checks.push({
            status: "error",
            code: "NO_AD_ACCOUNT",
            title: "No Meta ad account found",
            message:
              "You don't have a Meta ad account yet. You need one to run ads through Advertix.",
            action: "Create a Meta Ad Account",
            actionUrl: ADS_MANAGER_URL,
            blocking: true,
          });
          checks.push(appReviewCheck);
          return this.report(checks, { syncTestPassed: false });
        }
      } else {
        accountStatus = match.accountStatus;
      }
    } catch {
      // Treat an ad-account read failure like a sync problem below.
    }

    // ── CHECK 4 — Ad account status ────────────────────────────────────────
    if (accountStatus !== null) {
      const statusCheck = this.accountStatusCheck(accountStatus);
      if (statusCheck) checks.push(statusCheck);
    }

    // ── CHECK 5 — Payment method ───────────────────────────────────────────
    try {
      const funding = await metaService.getFundingSource(token, adAccountId);
      if (!funding.hasFunding && !funding.isPrepay) {
        checks.push({
          status: "warning",
          code: "NO_PAYMENT_METHOD",
          title: "No payment method on Meta account",
          message:
            "Your Meta ad account doesn't have a payment method. You can sync existing campaigns but won't be able to run new ads until you add one.",
          action: "Add a payment method in Meta Ads Manager",
          actionUrl: ADS_MANAGER_URL,
          blocking: false,
        });
      }
    } catch {
      // best-effort — funding read can fail without blocking the whole report
    }

    // ── CHECK 6 — App Review (our limitation) ──────────────────────────────
    checks.push(appReviewCheck);

    // ── CHECK 7 — Sync test ────────────────────────────────────────────────
    let syncTestPassed = false;
    try {
      await metaService.testReadCampaigns(token, adAccountId);
      syncTestPassed = true;
    } catch {
      checks.push({
        status: "error",
        code: "SYNC_FAILED",
        title: "Couldn't read your campaigns",
        message:
          "We connected to Meta but couldn't read your campaigns. This may be a temporary Meta issue.",
        action: "Try syncing again in a few minutes",
        blocking: false,
      });
    }

    return this.report(checks, { syncTestPassed });
  }

  private tokenError(code: number | undefined): HealthCheck {
    if (code === 190) {
      return {
        status: "error",
        code: "TOKEN_EXPIRED",
        title: "Meta session expired",
        message: "Your Meta login session has expired.",
        action: "Reconnect Meta Account",
        actionUrl: RECONNECT_URL,
        blocking: true,
      };
    }
    if (code === 200) {
      return {
        status: "error",
        code: "PERMISSION_DENIED",
        title: "Missing Meta permissions",
        message:
          "Advertix doesn't have permission to access your Meta account. This usually happens when not all permissions were granted during login.",
        action: "Reconnect and allow all permissions",
        actionUrl: RECONNECT_URL,
        blocking: true,
      };
    }
    return {
      status: "error",
      code: "TOKEN_INVALID",
      title: "Meta connection failed",
      message:
        "We couldn't verify your Meta connection. Please try reconnecting.",
      action: "Reconnect Meta",
      actionUrl: RECONNECT_URL,
      blocking: true,
    };
  }

  private accountStatusCheck(status: number): HealthCheck | null {
    switch (status) {
      case 1:
        return null; // active
      case 2:
        return {
          status: "error",
          code: "ACCOUNT_DISABLED",
          title: "Meta ad account is disabled",
          message:
            "Your Meta ad account has been disabled by Facebook. This is usually due to a policy violation or suspicious activity.",
          action: "Appeal in Meta Business Manager",
          actionUrl: BUSINESS_URL,
          blocking: true,
        };
      case 3:
        return {
          status: "error",
          code: "ACCOUNT_UNSETTLED",
          title: "Meta ad account has unpaid balance",
          message:
            "Your Meta ad account has an outstanding balance. Pay it in Ads Manager to continue running ads.",
          action: "Pay balance in Meta Ads Manager",
          actionUrl: ADS_MANAGER_URL,
          blocking: true,
        };
      case 7:
        return {
          status: "warning",
          code: "ACCOUNT_UNDER_REVIEW",
          title: "Meta ad account under review",
          message:
            "Your Meta ad account is being reviewed by Facebook. This usually takes 1–2 business days.",
          action: "Check Meta Business Manager for updates",
          actionUrl: BUSINESS_URL,
          blocking: false,
        };
      case 8:
        return {
          status: "warning",
          code: "PENDING_SETTLEMENT",
          title: "Meta account pending settlement",
          message:
            "Your account is pending payment settlement. Ads may be limited.",
          action: "Check payment settings",
          actionUrl: ADS_MANAGER_URL,
          blocking: false,
        };
      case 9:
        return {
          status: "warning",
          code: "GRACE_PERIOD",
          title: "Meta account in grace period",
          message:
            "Your Meta account has a payment issue but is still active for now. Update your payment method to avoid interruption.",
          action: "Update payment method",
          actionUrl: BUSINESS_URL,
          blocking: false,
        };
      default:
        return {
          status: "warning",
          code: "ACCOUNT_STATUS_UNKNOWN",
          title: "Meta ad account isn't fully active",
          message: `Your Meta ad account is in an unexpected state (status ${status}). Some actions may be limited.`,
          action: "Review your account in Meta Business Manager",
          actionUrl: BUSINESS_URL,
          blocking: false,
        };
    }
  }

  private report(
    checks: HealthCheck[],
    opts: { syncTestPassed: boolean }
  ): MetaHealthReport {
    const hasBlocking = checks.some((c) => c.blocking);
    const hasWarning = checks.some((c) => c.status === "warning");
    const overall: MetaHealthReport["overall"] = hasBlocking
      ? "blocked"
      : hasWarning
        ? "degraded"
        : "healthy";

    // canSync: no blocking errors on the connection/account checks AND we could
    // actually read campaigns.
    const canSync = !hasBlocking && opts.syncTestPassed;
    // canPublish: requires sync to work AND no pending App Review (so always
    // false until Meta approves us — remove the PENDING_APP_REVIEW check then).
    const hasPendingAppReview = checks.some(
      (c) => c.code === "PENDING_APP_REVIEW"
    );
    const canPublish = canSync && !hasPendingAppReview;

    return {
      overall,
      checks,
      canSync,
      canPublish,
      readyForBeta: !hasBlocking,
    };
  }
}

export const metaHealthService = new MetaHealthService();
