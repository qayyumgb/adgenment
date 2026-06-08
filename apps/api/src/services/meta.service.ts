/**
 * Meta Marketing API v19.0 wrapper.
 *
 * OAuth 2.0 flow, ad-account + campaign + insights fetching, campaign
 * creation, and AES-256-CBC encryption of stored access tokens.
 */

import { encryptToken, decryptToken } from "../lib/crypto";

const GRAPH_BASE = "https://graph.facebook.com/v19.0";
const FB_DIALOG = "https://www.facebook.com/v19.0/dialog/oauth";

// Meta deprecated `instagram_basic` and gated `pages_read_engagement` behind
// specific use-case review. The three scopes below cover both Facebook and
// Instagram ad campaign management via the Marketing API.
const SCOPES = ["ads_read", "ads_management", "business_management"];

export interface MetaAdAccount {
  id: string;
  name: string;
  currency: string;
  timezone: string;
  accountStatus: number;
}

export interface MetaCampaign {
  id: string;
  name: string;
  /** Toggle state: ACTIVE | PAUSED | DELETED | ARCHIVED */
  status: string;
  /**
   * Delivery state. More accurate than `status` because it accounts for
   * budget exhaustion, end_time passing, ad set issues, etc.
   *
   * Possible values: ACTIVE, PAUSED, DELETED, PENDING_REVIEW, DISAPPROVED,
   * PREAPPROVED, PENDING_BILLING_INFO, CAMPAIGN_PAUSED, ARCHIVED,
   * ADSET_PAUSED, IN_PROCESS, WITH_ISSUES.
   *
   * Note: Meta doesn't return a literal "COMPLETED" — once delivery ends
   * via stop_time or budget cap, `status` stays ACTIVE but the campaign
   * stops serving. Use `stop_time < now` as a secondary signal.
   */
  effective_status?: string;
  objective: string;
  daily_budget?: string;
  lifetime_budget?: string;
  start_time?: string;
  stop_time?: string;
  created_time?: string;
}

export interface MetaInsight {
  campaign_id: string;
  campaign_name: string;
  date_start: string;
  date_stop: string;
  impressions: string;
  clicks: string;
  spend: string;
  actions?: Array<{ action_type: string; value: string }>;
  purchase_roas?: Array<{ action_type: string; value: string }>;
}

interface MetaErrorResponse {
  error?: {
    message?: string;
    type?: string;
    code?: number;
    error_subcode?: number;
    fbtrace_id?: string;
  };
}

class MetaAdsService {
  private get appId(): string {
    const v = process.env.META_APP_ID;
    if (!v) throw new Error("META_APP_ID is not configured");
    return v;
  }

  private get appSecret(): string {
    const v = process.env.META_APP_SECRET;
    if (!v) throw new Error("META_APP_SECRET is not configured");
    return v;
  }

  private get redirectUri(): string {
    const v = process.env.META_REDIRECT_URI;
    if (!v) throw new Error("META_REDIRECT_URI is not configured");
    return v;
  }

  /* ───────────────────────────────── */
  /* OAuth URL                         */
  /* ───────────────────────────────── */

  getOAuthUrl(userId: string): string {
    const params = new URLSearchParams({
      client_id: this.appId,
      redirect_uri: this.redirectUri,
      scope: SCOPES.join(","),
      state: userId,
      response_type: "code",
    });
    return `${FB_DIALOG}?${params.toString()}`;
  }

  /* ───────────────────────────────── */
  /* Token exchange                    */
  /* ───────────────────────────────── */

  async exchangeCodeForToken(code: string): Promise<{
    accessToken: string;
    tokenType: string;
    expiresIn: number;
  }> {
    const params = new URLSearchParams({
      client_id: this.appId,
      client_secret: this.appSecret,
      redirect_uri: this.redirectUri,
      code,
    });
    const data = await this.graphFetch<{
      access_token: string;
      token_type?: string;
      expires_in?: number;
    }>(`${GRAPH_BASE}/oauth/access_token?${params.toString()}`);

    return {
      accessToken: data.access_token,
      tokenType: data.token_type ?? "bearer",
      expiresIn: data.expires_in ?? 0,
    };
  }

  async getLongLivedToken(shortToken: string): Promise<{
    accessToken: string;
    expiresIn: number;
  }> {
    const params = new URLSearchParams({
      grant_type: "fb_exchange_token",
      client_id: this.appId,
      client_secret: this.appSecret,
      fb_exchange_token: shortToken,
    });
    const data = await this.graphFetch<{
      access_token: string;
      expires_in?: number;
    }>(`${GRAPH_BASE}/oauth/access_token?${params.toString()}`);

    return {
      accessToken: data.access_token,
      expiresIn: data.expires_in ?? 5_184_000, // ~60 days
    };
  }

  /* ───────────────────────────────── */
  /* Data fetching                     */
  /* ───────────────────────────────── */

  async getAdAccounts(accessToken: string): Promise<MetaAdAccount[]> {
    const params = new URLSearchParams({
      fields: "id,name,currency,timezone_name,account_status",
      access_token: accessToken,
    });
    const data = await this.graphFetch<{
      data: Array<{
        id: string;
        name: string;
        currency: string;
        timezone_name: string;
        account_status: number;
      }>;
    }>(`${GRAPH_BASE}/me/adaccounts?${params.toString()}`);

    return data.data.map((a) => ({
      id: a.id,
      name: a.name,
      currency: a.currency,
      timezone: a.timezone_name,
      accountStatus: a.account_status,
    }));
  }

  async getCampaigns(
    accessToken: string,
    adAccountId: string
  ): Promise<MetaCampaign[]> {
    const accountPath = this.accountPath(adAccountId);
    const params = new URLSearchParams({
      fields:
        "id,name,status,effective_status,objective,daily_budget,lifetime_budget,start_time,stop_time,created_time",
      access_token: accessToken,
    });
    const data = await this.graphFetch<{ data: MetaCampaign[] }>(
      `${GRAPH_BASE}/${accountPath}/campaigns?${params.toString()}`
    );
    return data.data;
  }

  async getCampaignInsights(
    accessToken: string,
    adAccountId: string,
    datePreset: string = "last_30d"
  ): Promise<MetaInsight[]> {
    const accountPath = this.accountPath(adAccountId);
    const params = new URLSearchParams({
      fields:
        "campaign_id,campaign_name,date_start,date_stop,impressions,clicks,spend,actions,purchase_roas",
      date_preset: datePreset,
      level: "campaign",
      time_increment: "1",
      access_token: accessToken,
    });
    const data = await this.graphFetch<{ data: MetaInsight[] }>(
      `${GRAPH_BASE}/${accountPath}/insights?${params.toString()}`
    );
    return data.data;
  }

  /* ───────────────────────────────── */
  /* Mutations                         */
  /* ───────────────────────────────── */

  async createCampaign(
    accessToken: string,
    adAccountId: string,
    data: {
      name: string;
      objective: string;
      status: string;
      daily_budget?: number;
      lifetime_budget?: number;
      start_time?: string;
      stop_time?: string;
    }
  ): Promise<{ id: string }> {
    const accountPath = this.accountPath(adAccountId);
    const body = new URLSearchParams({
      name: data.name,
      objective: data.objective,
      status: data.status,
      special_ad_categories: "[]",
      access_token: accessToken,
    });
    if (data.daily_budget !== undefined) {
      body.set("daily_budget", String(Math.round(data.daily_budget * 100)));
    }
    if (data.lifetime_budget !== undefined) {
      body.set("lifetime_budget", String(Math.round(data.lifetime_budget * 100)));
    }
    if (data.start_time) body.set("start_time", data.start_time);
    if (data.stop_time) body.set("stop_time", data.stop_time);

    const created = await this.graphFetch<{ id: string }>(
      `${GRAPH_BASE}/${accountPath}/campaigns`,
      { method: "POST", body }
    );
    return { id: created.id };
  }

  async updateCampaignStatus(
    accessToken: string,
    metaCampaignId: string,
    status: "ACTIVE" | "PAUSED" | "DELETED"
  ): Promise<{ success: boolean }> {
    const body = new URLSearchParams({
      status,
      access_token: accessToken,
    });
    await this.graphFetch<{ success?: boolean }>(
      `${GRAPH_BASE}/${metaCampaignId}`,
      { method: "POST", body }
    );
    return { success: true };
  }

  /* ───────────────────────────────── */
  /* Encryption — delegated to shared  */
  /* lib/crypto so Google reuses it.   */
  /* ───────────────────────────────── */

  encryptToken(token: string): string {
    return encryptToken(token);
  }

  decryptToken(encrypted: string): string {
    return decryptToken(encrypted);
  }

  /* ───────────────────────────────── */
  /* Internals                         */
  /* ───────────────────────────────── */

  /**
   * Meta's REST conventions accept either `act_123` or `123` depending on the
   * endpoint; we always normalize to `act_<digits>` for sub-resource calls.
   */
  private accountPath(adAccountId: string): string {
    return adAccountId.startsWith("act_") ? adAccountId : `act_${adAccountId}`;
  }

  /**
   * Single fetch + error-handling wrapper. Throws
   * `Error("Meta API: <message> (code: <code>)")` on any Graph-side problem.
   */
  private async graphFetch<T>(url: string, init?: RequestInit): Promise<T> {
    let res: Response;
    try {
      res = await fetch(url, {
        ...init,
        headers: {
          accept: "application/json",
          ...(init?.headers ?? {}),
        },
      });
    } catch (err) {
      const reason = err instanceof Error ? err.message : "network error";
      throw new Error(`Meta API: ${reason} (code: NETWORK)`);
    }

    const text = await res.text();
    let parsed: unknown;
    try {
      parsed = text ? JSON.parse(text) : {};
    } catch {
      throw new Error(
        `Meta API: invalid JSON response (status: ${res.status})`
      );
    }

    const errResp = parsed as MetaErrorResponse;
    if (errResp.error) {
      const message = errResp.error.message ?? "Unknown error";
      const code = errResp.error.code ?? "unknown";
      throw new Error(`Meta API: ${message} (code: ${code})`);
    }
    if (!res.ok) {
      throw new Error(`Meta API: HTTP ${res.status}`);
    }

    return parsed as T;
  }
}

export const metaService = new MetaAdsService();
