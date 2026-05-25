/**
 * TikTok Marketing API v1.3 wrapper.
 *
 * TikTok's API wraps every response in `{ code, message, data, ... }` —
 * we treat any `code !== 0` as a failure. Most GET endpoints expect JSON
 * arrays passed as query parameters (URL-encoded JSON strings).
 */

const TIKTOK_BASE = "https://business-api.tiktok.com/open_api/v1.3";
const TIKTOK_TOKEN_URL =
  "https://business-api.tiktok.com/open_api/v2/oauth2/access_token";
const TIKTOK_AUTH_URL = "https://www.tiktok.com/v2/auth/authorize";
const SCOPES = ["tt.advertiser.read", "tt.advertiser.write"];

export interface TikTokAdvertiser {
  id: string;
  name: string;
  currency: string;
  status: string;
  timezone?: string;
}

export interface TikTokCampaign {
  campaign_id: string;
  campaign_name: string;
  status: string;
  objective_type: string;
  budget: number;
  budget_mode: string;
  create_time?: string;
}

export interface TikTokCampaignMetric {
  campaign_id: string;
  stat_time_day: string;
  impressions: string;
  clicks: string;
  spend: string;
  conversions: string;
  real_time_conversion_rate?: string;
}

interface TikTokEnvelope<T> {
  code: number;
  message?: string;
  request_id?: string;
  data: T;
}

class TikTokAdsService {
  private get appId(): string {
    const v = process.env.TIKTOK_APP_ID;
    if (!v) throw new Error("TIKTOK_APP_ID is not configured");
    return v;
  }

  private get appSecret(): string {
    const v = process.env.TIKTOK_APP_SECRET;
    if (!v) throw new Error("TIKTOK_APP_SECRET is not configured");
    return v;
  }

  private get redirectUri(): string {
    const v = process.env.TIKTOK_REDIRECT_URI;
    if (!v) throw new Error("TIKTOK_REDIRECT_URI is not configured");
    return v;
  }

  /* ───────────────────────────────── */
  /* OAuth                             */
  /* ───────────────────────────────── */

  getOAuthUrl(userId: string): string {
    const params = new URLSearchParams({
      app_id: this.appId,
      redirect_uri: this.redirectUri,
      state: userId,
      scope: SCOPES.join(","),
      response_type: "code",
    });
    return `${TIKTOK_AUTH_URL}?${params.toString()}`;
  }

  async exchangeCodeForToken(code: string): Promise<{
    access_token: string;
    advertiser_ids: string[];
    expires_in: number;
    scope?: string[];
  }> {
    const body = {
      app_id: this.appId,
      secret: this.appSecret,
      auth_code: code,
      grant_type: "authorization_code",
    };
    const data = await this.tiktokFetch<
      TikTokEnvelope<{
        access_token: string;
        advertiser_ids: string[];
        expires_in?: number;
        scope?: string[];
      }>
    >(TIKTOK_TOKEN_URL, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });

    return {
      access_token: data.data.access_token,
      advertiser_ids: data.data.advertiser_ids ?? [],
      expires_in: data.data.expires_in ?? 0,
      scope: data.data.scope,
    };
  }

  /* ───────────────────────────────── */
  /* Advertisers                       */
  /* ───────────────────────────────── */

  async getAdvertiserInfo(
    accessToken: string,
    advertiserIds: string[]
  ): Promise<TikTokAdvertiser[]> {
    if (advertiserIds.length === 0) return [];

    const params = new URLSearchParams({
      advertiser_ids: JSON.stringify(advertiserIds),
      fields: JSON.stringify([
        "id",
        "name",
        "currency",
        "status",
        "timezone",
      ]),
    });

    const data = await this.tiktokFetch<
      TikTokEnvelope<{
        list?: Array<{
          advertiser_id?: string;
          id?: string;
          name?: string;
          currency?: string;
          status?: string;
          timezone?: string;
        }>;
      }>
    >(`${TIKTOK_BASE}/advertiser/info/?${params.toString()}`, {
      method: "GET",
      headers: { "Access-Token": accessToken },
    });

    return (data.data.list ?? []).map((a) => ({
      id: String(a.advertiser_id ?? a.id ?? ""),
      name: a.name ?? "",
      currency: a.currency ?? "USD",
      status: a.status ?? "STATUS_UNKNOWN",
      timezone: a.timezone,
    }));
  }

  /* ───────────────────────────────── */
  /* Campaigns                         */
  /* ───────────────────────────────── */

  async getCampaigns(
    accessToken: string,
    advertiserId: string
  ): Promise<TikTokCampaign[]> {
    const params = new URLSearchParams({
      advertiser_id: advertiserId,
      fields: JSON.stringify([
        "campaign_id",
        "campaign_name",
        "status",
        "objective_type",
        "budget",
        "budget_mode",
        "create_time",
      ]),
      page_size: "1000",
    });

    const data = await this.tiktokFetch<
      TikTokEnvelope<{ list?: TikTokCampaign[] }>
    >(`${TIKTOK_BASE}/campaign/get/?${params.toString()}`, {
      method: "GET",
      headers: { "Access-Token": accessToken },
    });
    return data.data.list ?? [];
  }

  async getCampaignMetrics(
    accessToken: string,
    advertiserId: string,
    startDate: string,
    endDate: string
  ): Promise<TikTokCampaignMetric[]> {
    // TikTok reporting endpoint accepts query params for filtering; we use
    // GET with the parameters in the URL for simplicity (the platform also
    // accepts POST with JSON, but GET is documented and friendlier to test).
    const params = new URLSearchParams({
      advertiser_id: advertiserId,
      start_date: startDate,
      end_date: endDate,
      page_size: "1000",
      report_type: "BASIC",
      data_level: "AUCTION_CAMPAIGN",
      dimensions: JSON.stringify(["campaign_id", "stat_time_day"]),
      metrics: JSON.stringify([
        "impressions",
        "clicks",
        "spend",
        "conversions",
        "real_time_conversion_rate",
      ]),
    });

    const data = await this.tiktokFetch<
      TikTokEnvelope<{
        list?: Array<{
          dimensions?: {
            campaign_id?: string;
            stat_time_day?: string;
          };
          metrics?: {
            impressions?: string;
            clicks?: string;
            spend?: string;
            conversions?: string;
            real_time_conversion_rate?: string;
          };
        }>;
      }>
    >(`${TIKTOK_BASE}/report/integrated/get/?${params.toString()}`, {
      method: "GET",
      headers: { "Access-Token": accessToken },
    });

    return (data.data.list ?? []).map((row) => ({
      campaign_id: row.dimensions?.campaign_id ?? "",
      stat_time_day: row.dimensions?.stat_time_day ?? "",
      impressions: row.metrics?.impressions ?? "0",
      clicks: row.metrics?.clicks ?? "0",
      spend: row.metrics?.spend ?? "0",
      conversions: row.metrics?.conversions ?? "0",
      real_time_conversion_rate: row.metrics?.real_time_conversion_rate,
    }));
  }

  /* ───────────────────────────────── */
  /* Mutations                         */
  /* ───────────────────────────────── */

  async createCampaign(
    accessToken: string,
    advertiserId: string,
    data: {
      name: string;
      objective_type: string;
      budget_mode: "BUDGET_MODE_DAY" | "BUDGET_MODE_TOTAL";
      budget: number;
      status?: string;
    }
  ): Promise<{ campaign_id: string }> {
    const res = await this.tiktokFetch<
      TikTokEnvelope<{ campaign_id?: string }>
    >(`${TIKTOK_BASE}/campaign/create/`, {
      method: "POST",
      headers: {
        "Access-Token": accessToken,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        advertiser_id: advertiserId,
        campaign_name: data.name,
        objective_type: data.objective_type,
        budget_mode: data.budget_mode,
        budget: data.budget,
        operation_status: data.status ?? "DISABLE",
      }),
    });
    const id = res.data.campaign_id;
    if (!id) throw new Error("TikTok API: campaign create returned no id");
    return { campaign_id: id };
  }

  async updateCampaignStatus(
    accessToken: string,
    advertiserId: string,
    campaignId: string,
    status: "ENABLE" | "DISABLE" | "DELETE"
  ): Promise<{ campaign_id: string }> {
    await this.tiktokFetch<TikTokEnvelope<unknown>>(
      `${TIKTOK_BASE}/campaign/status/update/`,
      {
        method: "POST",
        headers: {
          "Access-Token": accessToken,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          advertiser_id: advertiserId,
          campaign_ids: [campaignId],
          operation_status: status,
        }),
      }
    );
    return { campaign_id: campaignId };
  }

  /* ───────────────────────────────── */
  /* Internals                         */
  /* ───────────────────────────────── */

  private async tiktokFetch<T extends TikTokEnvelope<unknown>>(
    url: string,
    init: RequestInit
  ): Promise<T> {
    let res: Response;
    try {
      res = await fetch(url, init);
    } catch (err) {
      const reason = err instanceof Error ? err.message : "network error";
      throw new Error(`TikTok API: ${reason} (code: NETWORK)`);
    }

    const text = await res.text();
    let parsed: unknown;
    try {
      parsed = text ? JSON.parse(text) : {};
    } catch {
      throw new Error(
        `TikTok API: invalid JSON response (status: ${res.status})`
      );
    }

    const env = parsed as TikTokEnvelope<unknown>;
    if (env.code !== 0) {
      const err = new Error(
        `TikTok API: ${env.message ?? "Unknown error"} (code: ${env.code ?? res.status})`
      );
      (err as Error & { httpStatus?: number; tiktokCode?: number }).httpStatus =
        res.status;
      (err as Error & { httpStatus?: number; tiktokCode?: number }).tiktokCode =
        env.code;
      throw err;
    }
    if (!res.ok) {
      throw new Error(`TikTok API: HTTP ${res.status}`);
    }
    return parsed as T;
  }
}

export const tiktokService = new TikTokAdsService();
