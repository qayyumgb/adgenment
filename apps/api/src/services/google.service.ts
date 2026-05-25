/**
 * Google Ads API v17 wrapper.
 *
 * OAuth via Google Identity, then GAQL (Google Ads Query Language) over
 * the Google Ads search endpoint. Tokens stored encrypted via the shared
 * `lib/crypto`.
 *
 * Why two tokens: Google issues short-lived access tokens (~1h) plus a
 * long-lived refresh token. Calling code refreshes the access token via
 * `refreshAccessToken` when it gets a 401.
 */

const ADS_API_BASE = "https://googleads.googleapis.com/v17";
const OAUTH_TOKEN_URL = "https://oauth2.googleapis.com/token";
const OAUTH_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const SCOPES = ["https://www.googleapis.com/auth/adwords"];

export interface GoogleCustomerAccount {
  id: string;
  resourceName: string;
  name: string;
  currencyCode: string;
  timeZone: string;
  status: string;
  managerLinkExists?: boolean;
}

export interface GoogleCampaign {
  id: string;
  resourceName: string;
  name: string;
  status: string;
  advertisingChannelType: string;
  budgetAmountMicros: string | null;
  startDate: string | null;
  endDate: string | null;
}

export interface GoogleCampaignMetric {
  campaignId: string;
  campaignName: string;
  date: string;
  impressions: string;
  clicks: string;
  costMicros: string;
  conversions: string;
  conversionValue: string;
}

interface GoogleErrorResponse {
  error?: {
    code?: number;
    message?: string;
    status?: string;
    details?: unknown;
  };
}

class GoogleAdsService {
  private get clientId(): string {
    const v = process.env.GOOGLE_CLIENT_ID;
    if (!v) throw new Error("GOOGLE_CLIENT_ID is not configured");
    return v;
  }

  private get clientSecret(): string {
    const v = process.env.GOOGLE_CLIENT_SECRET;
    if (!v) throw new Error("GOOGLE_CLIENT_SECRET is not configured");
    return v;
  }

  private get redirectUri(): string {
    const v = process.env.GOOGLE_REDIRECT_URI;
    if (!v) throw new Error("GOOGLE_REDIRECT_URI is not configured");
    return v;
  }

  private get developerToken(): string {
    const v = process.env.GOOGLE_DEVELOPER_TOKEN;
    if (!v) throw new Error("GOOGLE_DEVELOPER_TOKEN is not configured");
    return v;
  }

  /* ───────────────────────────────── */
  /* OAuth                             */
  /* ───────────────────────────────── */

  getOAuthUrl(userId: string): string {
    const params = new URLSearchParams({
      client_id: this.clientId,
      redirect_uri: this.redirectUri,
      response_type: "code",
      scope: SCOPES.join(" "),
      access_type: "offline",
      prompt: "consent",
      include_granted_scopes: "true",
      state: userId,
    });
    return `${OAUTH_AUTH_URL}?${params.toString()}`;
  }

  async exchangeCodeForTokens(code: string): Promise<{
    access_token: string;
    refresh_token: string;
    expires_in: number;
    token_type: string;
    scope?: string;
  }> {
    const body = new URLSearchParams({
      code,
      client_id: this.clientId,
      client_secret: this.clientSecret,
      redirect_uri: this.redirectUri,
      grant_type: "authorization_code",
    });

    return this.googleFetch<{
      access_token: string;
      refresh_token: string;
      expires_in: number;
      token_type: string;
      scope?: string;
    }>(OAUTH_TOKEN_URL, {
      method: "POST",
      headers: {
        "content-type": "application/x-www-form-urlencoded",
      },
      body,
    });
  }

  async refreshAccessToken(refreshToken: string): Promise<{
    access_token: string;
    expires_in: number;
    token_type: string;
    scope?: string;
  }> {
    const body = new URLSearchParams({
      refresh_token: refreshToken,
      client_id: this.clientId,
      client_secret: this.clientSecret,
      grant_type: "refresh_token",
    });

    return this.googleFetch<{
      access_token: string;
      expires_in: number;
      token_type: string;
      scope?: string;
    }>(OAUTH_TOKEN_URL, {
      method: "POST",
      headers: {
        "content-type": "application/x-www-form-urlencoded",
      },
      body,
    });
  }

  /* ───────────────────────────────── */
  /* Accounts                          */
  /* ───────────────────────────────── */

  /**
   * Returns all customers the OAuth user has access to. The list endpoint
   * itself only returns resource names; we then fetch details for each via
   * `customer.descriptive_name / currency_code / time_zone / status`.
   */
  async getCustomerAccounts(
    accessToken: string
  ): Promise<GoogleCustomerAccount[]> {
    // Step 1 — list accessible customer resource names.
    const list = await this.googleFetch<{ resourceNames?: string[] }>(
      `${ADS_API_BASE}/customers:listAccessibleCustomers`,
      {
        method: "GET",
        headers: this.adsHeaders(accessToken),
      }
    );

    const resourceNames = list.resourceNames ?? [];
    if (resourceNames.length === 0) return [];

    // Step 2 — fetch details for each customer in parallel. Each customer
    // is queried individually because Ads API requires `login-customer-id`
    // and a customer-scoped URL for the `customer` resource.
    const enriched = await Promise.all(
      resourceNames.map(async (rn) => {
        const id = rn.replace(/^customers\//, "");
        try {
          const result = await this.googleFetch<{
            results?: Array<{
              customer?: {
                resourceName?: string;
                id?: string;
                descriptiveName?: string;
                currencyCode?: string;
                timeZone?: string;
                status?: string;
              };
            }>;
          }>(`${ADS_API_BASE}/customers/${id}/googleAds:search`, {
            method: "POST",
            headers: {
              ...this.adsHeaders(accessToken),
              "login-customer-id": id,
              "content-type": "application/json",
            },
            body: JSON.stringify({
              query:
                "SELECT customer.id, customer.descriptive_name, customer.currency_code, customer.time_zone, customer.status FROM customer LIMIT 1",
            }),
          });
          const row = result.results?.[0]?.customer;
          return {
            id,
            resourceName: rn,
            name: row?.descriptiveName ?? `Customer ${id}`,
            currencyCode: row?.currencyCode ?? "USD",
            timeZone: row?.timeZone ?? "UTC",
            status: row?.status ?? "UNKNOWN",
          } satisfies GoogleCustomerAccount;
        } catch {
          // Manager accounts and some special customer types fail the
          // `customer` query — fall back to bare metadata.
          return {
            id,
            resourceName: rn,
            name: `Customer ${id}`,
            currencyCode: "USD",
            timeZone: "UTC",
            status: "UNKNOWN",
          } satisfies GoogleCustomerAccount;
        }
      })
    );

    return enriched;
  }

  /* ───────────────────────────────── */
  /* Campaigns                         */
  /* ───────────────────────────────── */

  async getCampaigns(
    accessToken: string,
    customerId: string
  ): Promise<GoogleCampaign[]> {
    const cid = this.normalizeCustomerId(customerId);
    const query = `
      SELECT
        campaign.id,
        campaign.resource_name,
        campaign.name,
        campaign.status,
        campaign.advertising_channel_type,
        campaign_budget.amount_micros,
        campaign.start_date,
        campaign.end_date
      FROM campaign
      WHERE campaign.status != 'REMOVED'
      ORDER BY campaign.name
    `.trim();

    const data = await this.googleFetch<{
      results?: Array<{
        campaign?: {
          id?: string;
          resourceName?: string;
          name?: string;
          status?: string;
          advertisingChannelType?: string;
          startDate?: string;
          endDate?: string;
        };
        campaignBudget?: { amountMicros?: string };
      }>;
    }>(`${ADS_API_BASE}/customers/${cid}/googleAds:search`, {
      method: "POST",
      headers: {
        ...this.adsHeaders(accessToken),
        "login-customer-id": cid,
        "content-type": "application/json",
      },
      body: JSON.stringify({ query }),
    });

    return (data.results ?? []).map((row) => ({
      id: row.campaign?.id ?? "",
      resourceName: row.campaign?.resourceName ?? "",
      name: row.campaign?.name ?? "",
      status: row.campaign?.status ?? "UNKNOWN",
      advertisingChannelType: row.campaign?.advertisingChannelType ?? "UNKNOWN",
      budgetAmountMicros: row.campaignBudget?.amountMicros ?? null,
      startDate: row.campaign?.startDate ?? null,
      endDate: row.campaign?.endDate ?? null,
    }));
  }

  async getCampaignMetrics(
    accessToken: string,
    customerId: string,
    startDate: string,
    endDate: string
  ): Promise<GoogleCampaignMetric[]> {
    const cid = this.normalizeCustomerId(customerId);
    const query = `
      SELECT
        campaign.id,
        campaign.name,
        segments.date,
        metrics.impressions,
        metrics.clicks,
        metrics.cost_micros,
        metrics.conversions,
        metrics.conversions_value
      FROM campaign
      WHERE segments.date BETWEEN '${startDate}' AND '${endDate}'
        AND campaign.status != 'REMOVED'
      ORDER BY segments.date DESC
    `.trim();

    const data = await this.googleFetch<{
      results?: Array<{
        campaign?: { id?: string; name?: string };
        segments?: { date?: string };
        metrics?: {
          impressions?: string;
          clicks?: string;
          costMicros?: string;
          conversions?: string;
          conversionsValue?: string;
        };
      }>;
    }>(`${ADS_API_BASE}/customers/${cid}/googleAds:search`, {
      method: "POST",
      headers: {
        ...this.adsHeaders(accessToken),
        "login-customer-id": cid,
        "content-type": "application/json",
      },
      body: JSON.stringify({ query }),
    });

    return (data.results ?? []).map((row) => ({
      campaignId: row.campaign?.id ?? "",
      campaignName: row.campaign?.name ?? "",
      date: row.segments?.date ?? "",
      impressions: row.metrics?.impressions ?? "0",
      clicks: row.metrics?.clicks ?? "0",
      costMicros: row.metrics?.costMicros ?? "0",
      conversions: row.metrics?.conversions ?? "0",
      conversionValue: row.metrics?.conversionsValue ?? "0",
    }));
  }

  /* ───────────────────────────────── */
  /* Mutations                         */
  /* ───────────────────────────────── */

  async createCampaign(
    accessToken: string,
    customerId: string,
    data: {
      name: string;
      budgetAmountMicros: number;
      advertisingChannelType: string;
      status: string;
      startDate: string;
      endDate?: string;
    }
  ): Promise<{ resourceName: string }> {
    const cid = this.normalizeCustomerId(customerId);
    const headers = {
      ...this.adsHeaders(accessToken),
      "login-customer-id": cid,
      "content-type": "application/json",
    };

    // 1. Create a campaign budget. Random shared name to avoid collisions
    // on retries.
    const budgetName = `${data.name} Budget · ${Date.now()}`;
    const budgetRes = await this.googleFetch<{
      results?: Array<{ resourceName?: string }>;
    }>(`${ADS_API_BASE}/customers/${cid}/campaignBudgets:mutate`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        operations: [
          {
            create: {
              name: budgetName,
              amountMicros: String(data.budgetAmountMicros),
              deliveryMethod: "STANDARD",
              explicitlyShared: false,
            },
          },
        ],
      }),
    });
    const budgetResourceName = budgetRes.results?.[0]?.resourceName;
    if (!budgetResourceName) {
      throw new Error("Google Ads API: budget creation failed");
    }

    // 2. Create the campaign pointing at that budget.
    const campaignRes = await this.googleFetch<{
      results?: Array<{ resourceName?: string }>;
    }>(`${ADS_API_BASE}/customers/${cid}/campaigns:mutate`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        operations: [
          {
            create: {
              name: data.name,
              status: data.status,
              advertisingChannelType: data.advertisingChannelType,
              campaignBudget: budgetResourceName,
              startDate: data.startDate,
              ...(data.endDate ? { endDate: data.endDate } : {}),
            },
          },
        ],
      }),
    });
    const resourceName = campaignRes.results?.[0]?.resourceName;
    if (!resourceName) {
      throw new Error("Google Ads API: campaign creation failed");
    }
    return { resourceName };
  }

  async updateCampaignStatus(
    accessToken: string,
    customerId: string,
    campaignResourceName: string,
    status: "ENABLED" | "PAUSED" | "REMOVED"
  ): Promise<{ resourceName: string }> {
    const cid = this.normalizeCustomerId(customerId);
    const data = await this.googleFetch<{
      results?: Array<{ resourceName?: string }>;
    }>(`${ADS_API_BASE}/customers/${cid}/campaigns:mutate`, {
      method: "POST",
      headers: {
        ...this.adsHeaders(accessToken),
        "login-customer-id": cid,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        operations: [
          {
            update: { resourceName: campaignResourceName, status },
            updateMask: "status",
          },
        ],
      }),
    });
    const rn = data.results?.[0]?.resourceName ?? campaignResourceName;
    return { resourceName: rn };
  }

  /* ───────────────────────────────── */
  /* Internals                         */
  /* ───────────────────────────────── */

  /** Customer IDs are 10 digits; the human-readable form is `123-456-7890`. */
  normalizeCustomerId(customerId: string): string {
    return customerId.replace(/\D/g, "");
  }

  private adsHeaders(accessToken: string): Record<string, string> {
    return {
      Authorization: `Bearer ${accessToken}`,
      "developer-token": this.developerToken,
    };
  }

  private async googleFetch<T>(url: string, init: RequestInit): Promise<T> {
    let res: Response;
    try {
      res = await fetch(url, init);
    } catch (err) {
      const reason = err instanceof Error ? err.message : "network error";
      throw new Error(`Google Ads API: ${reason} (code: NETWORK)`);
    }

    const text = await res.text();
    let parsed: unknown;
    try {
      parsed = text ? JSON.parse(text) : {};
    } catch {
      throw new Error(
        `Google Ads API: invalid JSON response (status: ${res.status})`
      );
    }

    // Google Ads/Identity errors come back as { error: { code, message, ... } }.
    const errResp = parsed as GoogleErrorResponse;
    if (errResp.error) {
      const message = errResp.error.message ?? "Unknown error";
      const code = errResp.error.code ?? errResp.error.status ?? "unknown";
      const err = new Error(`Google Ads API: ${message} (code: ${code})`);
      // Mark HTTP status on the error so callers can distinguish 401 (refresh).
      (err as Error & { httpStatus?: number }).httpStatus = res.status;
      throw err;
    }
    if (!res.ok) {
      const err = new Error(`Google Ads API: HTTP ${res.status}`);
      (err as Error & { httpStatus?: number }).httpStatus = res.status;
      throw err;
    }

    return parsed as T;
  }
}

export const googleService = new GoogleAdsService();

export function isGoogleAuthError(err: unknown): boolean {
  if (!(err instanceof Error)) return false;
  const status = (err as Error & { httpStatus?: number }).httpStatus;
  return status === 401 || status === 403;
}
