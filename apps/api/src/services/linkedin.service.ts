/**
 * LinkedIn Marketing API v2 wrapper.
 *
 * LinkedIn uses URNs (`urn:li:sponsoredAccount:123`) to identify resources,
 * date ranges are structured as `{year, month, day}` objects, and requests
 * require both `Authorization: Bearer ...` and a `LinkedIn-Version` header.
 */

const LINKEDIN_BASE = "https://api.linkedin.com/v2";
const LINKEDIN_AUTH_URL = "https://www.linkedin.com/oauth/v2/authorization";
const LINKEDIN_TOKEN_URL = "https://www.linkedin.com/oauth/v2/accessToken";
const LINKEDIN_API_VERSION = "202401";
const SCOPES = ["r_ads", "r_ads_reporting", "w_organization_social"];

export interface LinkedInAdAccount {
  id: string;
  name: string;
  currency: string;
  status: string;
  type: string;
}

export interface LinkedInBudget {
  amount: string;
  currencyCode: string;
}

export interface LinkedInCampaign {
  id: string;
  name: string;
  status: string;
  objectiveType: string;
  costType?: string;
  dailyBudget?: LinkedInBudget;
  totalBudget?: LinkedInBudget;
  runSchedule: { start: number; end?: number };
}

export interface LinkedInCampaignAnalytic {
  pivotValue: string; // urn:li:sponsoredCampaign:{id}
  campaignId: string; // extracted from pivotValue
  dateStart: string; // YYYY-MM-DD
  impressions: number;
  clicks: number;
  costInLocalCurrency: string;
  externalWebsiteConversions: number;
}

interface LinkedInErrorResponse {
  message?: string;
  status?: number;
  serviceErrorCode?: number;
  code?: string;
}

class LinkedInAdsService {
  private get clientId(): string {
    const v = process.env.LINKEDIN_CLIENT_ID;
    if (!v) throw new Error("LINKEDIN_CLIENT_ID is not configured");
    return v;
  }

  private get clientSecret(): string {
    const v = process.env.LINKEDIN_CLIENT_SECRET;
    if (!v) throw new Error("LINKEDIN_CLIENT_SECRET is not configured");
    return v;
  }

  private get redirectUri(): string {
    const v = process.env.LINKEDIN_REDIRECT_URI;
    if (!v) throw new Error("LINKEDIN_REDIRECT_URI is not configured");
    return v;
  }

  /* ───────────────────────────────── */
  /* OAuth                             */
  /* ───────────────────────────────── */

  getOAuthUrl(userId: string): string {
    const params = new URLSearchParams({
      response_type: "code",
      client_id: this.clientId,
      redirect_uri: this.redirectUri,
      scope: SCOPES.join(" "),
      state: userId,
    });
    return `${LINKEDIN_AUTH_URL}?${params.toString()}`;
  }

  async exchangeCodeForToken(code: string): Promise<{
    access_token: string;
    expires_in: number;
    refresh_token?: string;
    refresh_token_expires_in?: number;
    scope?: string;
  }> {
    const body = new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: this.redirectUri,
      client_id: this.clientId,
      client_secret: this.clientSecret,
    });

    return this.linkedinFetch<{
      access_token: string;
      expires_in: number;
      refresh_token?: string;
      refresh_token_expires_in?: number;
      scope?: string;
    }>(LINKEDIN_TOKEN_URL, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body,
    });
  }

  /* ───────────────────────────────── */
  /* Accounts                          */
  /* ───────────────────────────────── */

  async getAdAccounts(accessToken: string): Promise<LinkedInAdAccount[]> {
    const url = `${LINKEDIN_BASE}/adAccountsV2?q=search&search.type.values[0]=BUSINESS&search.status.values[0]=ACTIVE`;
    const data = await this.linkedinFetch<{
      elements?: Array<{
        id: number;
        name?: string;
        currency?: string;
        status?: string;
        type?: string;
      }>;
    }>(url, {
      method: "GET",
      headers: this.authHeaders(accessToken),
    });

    return (data.elements ?? []).map((a) => ({
      id: String(a.id),
      name: a.name ?? `Account ${a.id}`,
      currency: a.currency ?? "USD",
      status: a.status ?? "UNKNOWN",
      type: a.type ?? "BUSINESS",
    }));
  }

  /* ───────────────────────────────── */
  /* Campaigns                         */
  /* ───────────────────────────────── */

  async getCampaigns(
    accessToken: string,
    accountId: string
  ): Promise<LinkedInCampaign[]> {
    const accountUrn = encodeURIComponent(
      `urn:li:sponsoredAccount:${accountId}`
    );
    const url =
      `${LINKEDIN_BASE}/adCampaignsV2?q=search` +
      `&search.account.values[0]=${accountUrn}` +
      `&search.status.values[0]=ACTIVE` +
      `&search.status.values[1]=PAUSED` +
      `&search.status.values[2]=DRAFT`;

    const data = await this.linkedinFetch<{
      elements?: Array<{
        id: number;
        name?: string;
        status?: string;
        objectiveType?: string;
        costType?: string;
        dailyBudget?: LinkedInBudget;
        totalBudget?: LinkedInBudget;
        runSchedule?: { start?: number; end?: number };
      }>;
    }>(url, {
      method: "GET",
      headers: this.authHeaders(accessToken),
    });

    return (data.elements ?? []).map((c) => ({
      id: String(c.id),
      name: c.name ?? `Campaign ${c.id}`,
      status: c.status ?? "UNKNOWN",
      objectiveType: c.objectiveType ?? "UNKNOWN",
      costType: c.costType,
      dailyBudget: c.dailyBudget,
      totalBudget: c.totalBudget,
      runSchedule: {
        start: c.runSchedule?.start ?? 0,
        end: c.runSchedule?.end,
      },
    }));
  }

  async getCampaignAnalytics(
    accessToken: string,
    accountId: string,
    startDate: { year: number; month: number; day: number },
    endDate: { year: number; month: number; day: number }
  ): Promise<LinkedInCampaignAnalytic[]> {
    const accountUrn = encodeURIComponent(
      `urn:li:sponsoredAccount:${accountId}`
    );
    const params = new URLSearchParams({
      q: "analytics",
      pivot: "CAMPAIGN",
      timeGranularity: "DAILY",
      "dateRange.start.year": String(startDate.year),
      "dateRange.start.month": String(startDate.month),
      "dateRange.start.day": String(startDate.day),
      "dateRange.end.year": String(endDate.year),
      "dateRange.end.month": String(endDate.month),
      "dateRange.end.day": String(endDate.day),
      fields:
        "impressions,clicks,costInLocalCurrency,externalWebsiteConversions,pivotValue,dateRange",
    });
    const url = `${LINKEDIN_BASE}/adAnalyticsV2?${params.toString()}&accounts[0]=${accountUrn}`;

    const data = await this.linkedinFetch<{
      elements?: Array<{
        pivotValue?: string;
        dateRange?: {
          start?: { year?: number; month?: number; day?: number };
          end?: { year?: number; month?: number; day?: number };
        };
        impressions?: number;
        clicks?: number;
        costInLocalCurrency?: string;
        externalWebsiteConversions?: number;
      }>;
    }>(url, {
      method: "GET",
      headers: this.authHeaders(accessToken),
    });

    return (data.elements ?? []).map((row) => {
      const pivotValue = row.pivotValue ?? "";
      const campaignId = pivotValue.replace(/^urn:li:sponsoredCampaign:/, "");
      const s = row.dateRange?.start;
      const dateStart =
        s?.year && s.month && s.day
          ? `${s.year}-${String(s.month).padStart(2, "0")}-${String(
              s.day
            ).padStart(2, "0")}`
          : "";
      return {
        pivotValue,
        campaignId,
        dateStart,
        impressions: row.impressions ?? 0,
        clicks: row.clicks ?? 0,
        costInLocalCurrency: row.costInLocalCurrency ?? "0",
        externalWebsiteConversions: row.externalWebsiteConversions ?? 0,
      };
    });
  }

  /* ───────────────────────────────── */
  /* Internals                         */
  /* ───────────────────────────────── */

  private authHeaders(accessToken: string): Record<string, string> {
    return {
      Authorization: `Bearer ${accessToken}`,
      "LinkedIn-Version": LINKEDIN_API_VERSION,
      "X-Restli-Protocol-Version": "2.0.0",
    };
  }

  private async linkedinFetch<T>(
    url: string,
    init: RequestInit
  ): Promise<T> {
    let res: Response;
    try {
      res = await fetch(url, init);
    } catch (err) {
      const reason = err instanceof Error ? err.message : "network error";
      throw new Error(`LinkedIn API: ${reason} (code: NETWORK)`);
    }

    const text = await res.text();
    let parsed: unknown;
    try {
      parsed = text ? JSON.parse(text) : {};
    } catch {
      throw new Error(
        `LinkedIn API: invalid JSON response (status: ${res.status})`
      );
    }

    if (!res.ok) {
      const e = parsed as LinkedInErrorResponse;
      const message = e.message ?? `HTTP ${res.status}`;
      const code = e.serviceErrorCode ?? e.code ?? res.status;
      const err = new Error(`LinkedIn API: ${message} (code: ${code})`);
      (err as Error & { httpStatus?: number }).httpStatus = res.status;
      throw err;
    }
    return parsed as T;
  }
}

export const linkedinService = new LinkedInAdsService();

export function isLinkedInAuthError(err: unknown): boolean {
  if (!(err instanceof Error)) return false;
  const status = (err as Error & { httpStatus?: number }).httpStatus;
  return status === 401 || status === 403;
}
