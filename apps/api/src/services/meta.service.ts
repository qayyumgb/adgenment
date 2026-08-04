/**
 * Meta Marketing API v19.0 wrapper.
 *
 * OAuth 2.0 flow, ad-account + campaign + insights fetching, campaign
 * creation, and AES-256-CBC encryption of stored access tokens.
 */

import { encryptToken, decryptToken } from "../lib/crypto";

const GRAPH_BASE = "https://graph.facebook.com/v19.0";
const FB_DIALOG = "https://www.facebook.com/v19.0/dialog/oauth";

// `pages_show_list` lets us list the user's Pages via /me/accounts (the
//   getPages endpoint). Without it, /me/accounts returns empty even for
//   users who do admin Pages.
// `ads_management` is already enough to actually USE the Page as the
//   sender when publishing (Meta's ad creation accepts any page_id the
//   user has permission on, gated by ads_management — NOT by a separate
//   Page-scoped permission).
// `business_management` covers Pages owned by a Business Manager.
const SCOPES = [
  "ads_read",
  "ads_management",
  "business_management",
  "pages_show_list",
];

export interface MetaAdAccount {
  id: string;
  name: string;
  currency: string;
  timezone: string;
  accountStatus: number;
  /** Why the account is disabled (Meta disable_reason), when applicable. */
  disableReason?: number | null;
  /** Minimum daily budget in the account currency (e.g. 1.00 = PKR 1.00).
   *  Meta returns it in minor units; we divide by 100. Null if absent. */
  minDailyBudget: number | null;
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
  /** Monetary value per action type — the real purchase revenue lives here
   *  (e.g. action_type "purchase" / "...fb_pixel_purchase"). */
  action_values?: Array<{ action_type: string; value: string }>;
  purchase_roas?: Array<{ action_type: string; value: string }>;
}

interface MetaErrorResponse {
  error?: {
    message?: string;
    type?: string;
    code?: number;
    error_subcode?: number;
    /** Human-readable specifics — for code 100 ("Invalid parameter") these
     *  name the exact field/reason. We were dropping them, which made publish
     *  failures undebuggable. */
    error_user_title?: string;
    error_user_msg?: string;
    fbtrace_id?: string;
  };
}

/* ──────────────────────────────────────── */
/* Phase 1A — Publish-flow types             */
/* ──────────────────────────────────────── */

export type MetaObjective =
  | "OUTCOME_SALES"
  | "OUTCOME_AWARENESS"
  | "OUTCOME_TRAFFIC"
  | "OUTCOME_LEADS"
  | "OUTCOME_ENGAGEMENT"
  | "OUTCOME_APP_PROMOTION";

export type MetaCallToActionType =
  | "LEARN_MORE"
  | "SIGN_UP"
  | "SHOP_NOW"
  | "DOWNLOAD"
  | "GET_QUOTE"
  | "SUBSCRIBE"
  | "CONTACT_US"
  | "APPLY_NOW"
  | "BOOK_TRAVEL"
  | "WATCH_MORE"
  | "ORDER_NOW";

export interface MetaPage {
  id: string;
  name: string;
  category?: string;
  pictureUrl?: string;
  /** Page-scoped access token. Some Marketing API calls require this
   *  rather than the user's token. */
  accessToken?: string;
}

export interface MetaPixel {
  id: string;
  name: string;
  /** ISO timestamp of the last event Meta received. Null = never fired, which
   *  means the pixel exists but isn't installed on the site yet. */
  lastFiredTime: string | null;
}

/**
 * What Meta requires on an ad set for a given campaign objective. Each
 * `optimization_goal` has a mandatory `promoted_object` shape — getting it
 * wrong is the single most common publish failure (Meta answers with a bare
 * "Invalid parameter (code 100)").
 *
 *   - "none"  → omit promoted_object entirely
 *   - "page"  → { page_id }
 *   - "pixel" → { pixel_id, custom_event_type }
 */
export interface MetaOptimizationSpec {
  optimizationGoal: string;
  billingEvent: string;
  promotedObject: "none" | "page" | "pixel";
  /** Only meaningful when promotedObject === "pixel". */
  pixelEvent?: "PURCHASE" | "LEAD" | "COMPLETE_REGISTRATION";
}

export interface MetaCustomAudience {
  id: string;
  name: string;
  /** CUSTOM | LOOKALIKE | WEBSITE | APP | ENGAGEMENT | etc. */
  subtype: string;
  isLookalike: boolean;
  approxSize: number | null;
  description?: string;
  ready: boolean;
}

export interface MetaSavedAudience {
  id: string;
  name: string;
  description?: string;
  approxSize: number | null;
}

export interface MetaTargetingSuggestion {
  id: string;
  name: string;
  audienceSize: number | null;
  path?: string[];
}

export interface MetaGeoLocation {
  key: string;
  name: string;
  type: "country" | "region" | "city" | "zip";
  countryCode?: string;
  countryName?: string;
  region?: string;
}

/**
 * Meta's targeting spec JSON. We only model the fields we set — Meta
 * supports many more (behaviors, demographics, family statuses, etc.)
 * that we'll expose iteratively.
 */
export interface MetaTargeting {
  age_min?: number;
  age_max?: number;
  /** Meta uses [1] for male, [2] for female, omit for "all". */
  genders?: number[];
  geo_locations?: {
    countries?: string[];
    regions?: Array<{ key: string }>;
    cities?: Array<{ key: string; radius?: number; distance_unit?: "mile" | "kilometer" }>;
    zips?: Array<{ key: string }>;
  };
  excluded_geo_locations?: MetaTargeting["geo_locations"];
  interests?: Array<{ id: string; name?: string }>;
  custom_audiences?: Array<{ id: string }>;
  excluded_custom_audiences?: Array<{ id: string }>;
  saved_audiences?: Array<{ id: string }>;
  /** Placement controls; omit for automatic placements (Meta's default
   *  recommendation). Set to e.g. `["facebook"]` for FB only. */
  publisher_platforms?: Array<"facebook" | "instagram" | "messenger" | "audience_network">;
  /** Per-platform position picks. Meta requires that every entry in
   *  `publisher_platforms` has a corresponding *_positions array. */
  facebook_positions?: Array<
    | "feed"
    | "right_hand_column"
    | "instant_article"
    | "instream_video"
    | "marketplace"
    | "story"
    | "search"
    | "facebook_reels"
    | "video_feeds"
  >;
  instagram_positions?: Array<
    | "stream"
    | "story"
    | "explore"
    | "reels"
    | "igtv"
    | "shop"
  >;
  flexible_spec?: Array<{ interests?: Array<{ id: string }>; behaviors?: Array<{ id: string }> }>;
  /**
   * Advantage+ audience opt-in. Meta now REQUIRES an explicit decision on every
   * new ad set — omitting it fails with "Advantage Audience Flag Required".
   *
   *   1 — Meta may deliver beyond the targeting below when it predicts better
   *       results (your interests/audiences become a suggestion).
   *   0 — deliver strictly inside the targeting below.
   *
   * `createAdSet` defaults this to 0 when the caller doesn't set it, so the
   * audience the user built in the wizard is the audience they get.
   */
  targeting_automation?: { advantage_audience?: 0 | 1 };
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
      fields:
        "id,name,currency,timezone_name,account_status,disable_reason,min_daily_budget",
      access_token: accessToken,
    });
    const data = await this.graphFetch<{
      data: Array<{
        id: string;
        name: string;
        currency: string;
        timezone_name: string;
        account_status: number;
        disable_reason?: number;
        min_daily_budget?: string;
      }>;
    }>(`${GRAPH_BASE}/me/adaccounts?${params.toString()}`);

    return data.data.map((a) => ({
      id: a.id,
      name: a.name,
      currency: a.currency,
      timezone: a.timezone_name,
      accountStatus: a.account_status,
      disableReason: a.disable_reason ?? null,
      // Meta returns min_daily_budget in the currency's minor units (×100),
      // matching how we send budgets elsewhere. Divide to get the display value.
      minDailyBudget:
        a.min_daily_budget !== undefined && a.min_daily_budget !== ""
          ? (parseInt(a.min_daily_budget, 10) || 0) / 100
          : null,
    }));
  }

  /** Basic identity check — used by the health check to validate the token. */
  async getMe(accessToken: string): Promise<{ id: string; name: string }> {
    const params = new URLSearchParams({
      fields: "id,name",
      access_token: accessToken,
    });
    return this.graphFetch<{ id: string; name: string }>(
      `${GRAPH_BASE}/me?${params.toString()}`
    );
  }

  /** Granted permissions, so we can verify ads_management etc. were approved. */
  async getPermissions(
    accessToken: string
  ): Promise<Array<{ permission: string; status: string }>> {
    const params = new URLSearchParams({ access_token: accessToken });
    const data = await this.graphFetch<{
      data: Array<{ permission: string; status: string }>;
    }>(`${GRAPH_BASE}/me/permissions?${params.toString()}`);
    return data.data ?? [];
  }

  /** Funding source — to detect "no payment method" before a launch fails. */
  async getFundingSource(
    accessToken: string,
    adAccountId: string
  ): Promise<{ hasFunding: boolean; isPrepay: boolean }> {
    const accountPath = this.accountPath(adAccountId);
    const params = new URLSearchParams({
      fields: "funding_source_details,is_prepay_account",
      access_token: accessToken,
    });
    const data = await this.graphFetch<{
      funding_source_details?: { id?: string; type?: number } | null;
      is_prepay_account?: boolean;
    }>(`${GRAPH_BASE}/${accountPath}?${params.toString()}`);
    return {
      hasFunding: !!data.funding_source_details?.id,
      isPrepay: data.is_prepay_account === true,
    };
  }

  /** Lightweight "can we read campaigns?" probe (limit 1) for the sync test. */
  async testReadCampaigns(
    accessToken: string,
    adAccountId: string
  ): Promise<void> {
    const accountPath = this.accountPath(adAccountId);
    const params = new URLSearchParams({
      fields: "id",
      limit: "1",
      access_token: accessToken,
    });
    await this.graphFetch<{ data: unknown[] }>(
      `${GRAPH_BASE}/${accountPath}/campaigns?${params.toString()}`
    );
  }

  async getCampaigns(
    accessToken: string,
    adAccountId: string
  ): Promise<MetaCampaign[]> {
    const accountPath = this.accountPath(adAccountId);
    const params = new URLSearchParams({
      fields:
        "id,name,status,effective_status,objective,daily_budget,lifetime_budget,start_time,stop_time,created_time",
      // Without an explicit limit Meta defaults to 25 — accounts with more
      // campaigns (e.g. several boosted posts) would silently truncate. We
      // page through everything via graphFetchAll regardless, but a larger
      // page size means fewer round-trips.
      limit: "200",
      access_token: accessToken,
    });
    return this.graphFetchAll<MetaCampaign>(
      `${GRAPH_BASE}/${accountPath}/campaigns?${params.toString()}`
    );
  }

  async getCampaignInsights(
    accessToken: string,
    adAccountId: string,
    datePreset: string = "last_30d"
  ): Promise<MetaInsight[]> {
    const accountPath = this.accountPath(adAccountId);
    const params = new URLSearchParams({
      fields:
        "campaign_id,campaign_name,date_start,date_stop,impressions,clicks,spend,actions,action_values,purchase_roas",
      date_preset: datePreset,
      level: "campaign",
      time_increment: "1",
      // Daily breakdown over 30 days yields up to ~30 rows PER campaign — far
      // past Meta's default 25-row page. Page through all of them, else
      // metrics undercount badly on multi-campaign accounts.
      limit: "500",
      access_token: accessToken,
    });
    return this.graphFetchAll<MetaInsight>(
      `${GRAPH_BASE}/${accountPath}/insights?${params.toString()}`
    );
  }

  /**
   * Range-level unique reach per campaign (NO time_increment). Reach is
   * de-duplicated across days, so it CANNOT be summed from daily rows — this
   * returns the single figure Ads Manager shows for the period. Keyed by
   * Meta campaign id.
   */
  async getCampaignReach(
    accessToken: string,
    adAccountId: string,
    datePreset: string = "last_30d"
  ): Promise<Record<string, number>> {
    const accountPath = this.accountPath(adAccountId);
    const params = new URLSearchParams({
      fields: "campaign_id,reach",
      date_preset: datePreset,
      level: "campaign",
      limit: "500",
      access_token: accessToken,
    });
    const rows = await this.graphFetchAll<{ campaign_id?: string; reach?: string }>(
      `${GRAPH_BASE}/${accountPath}/insights?${params.toString()}`
    );
    const map: Record<string, number> = {};
    for (const r of rows) {
      if (r.campaign_id) map[r.campaign_id] = parseInt(r.reach || "0", 10) || 0;
    }
    return map;
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
    // When a campaign carries NO budget (we put budget at the ad-set level for
    // OUTCOME_* objectives), recent Meta API versions REQUIRE an explicit
    // is_adset_budget_sharing_enabled flag — omitting it is code 100/4834011.
    // We send `false`: ad sets keep their own budgets, no auto 20% sharing.
    if (data.daily_budget === undefined && data.lifetime_budget === undefined) {
      body.set("is_adset_budget_sharing_enabled", "false");
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

  /**
   * Generic delete — used by the publish-rollback path when ad set / creative
   * / ad creation fails partway through. Best-effort: errors are swallowed
   * by the caller so the rollback continues.
   */
  async deleteObject(
    accessToken: string,
    metaObjectId: string
  ): Promise<{ success: boolean }> {
    const params = new URLSearchParams({ access_token: accessToken });
    await this.graphFetch<{ success?: boolean }>(
      `${GRAPH_BASE}/${metaObjectId}?${params.toString()}`,
      { method: "DELETE" }
    );
    return { success: true };
  }

  /* ───────────────────────────────── */
  /* Phase 1A — Publish discovery      */
  /* ───────────────────────────────── */

  /**
   * Facebook Pages the user manages. Required for ad creatives — every ad
   * has to "originate" from a Page. Returns `access_token` per page so
   * caller can switch contexts for Page-scoped Marketing API calls.
   */
  async getPages(accessToken: string): Promise<MetaPage[]> {
    const params = new URLSearchParams({
      fields: "id,name,category,picture{url},access_token,tasks",
      access_token: accessToken,
      limit: "100",
    });
    const data = await this.graphFetch<{
      data: Array<{
        id: string;
        name: string;
        category?: string;
        picture?: { data?: { url?: string } };
        access_token?: string;
        tasks?: string[];
      }>;
    }>(`${GRAPH_BASE}/me/accounts?${params.toString()}`);
    return data.data
      // Pages without ADVERTISE permission can't be used as ad senders
      .filter((p) => !p.tasks || p.tasks.includes("ADVERTISE"))
      .map((p) => ({
        id: p.id,
        name: p.name,
        category: p.category,
        pictureUrl: p.picture?.data?.url,
        accessToken: p.access_token,
      }));
  }

  /**
   * Meta Pixels on the ad account. Conversion objectives (Sales, Leads) can't
   * be published without one — we resolve it before creating the ad set and
   * tell the user to install the pixel when the list is empty.
   *
   * `lastFiredTime === null` means the pixel object exists but has never
   * received an event, i.e. it isn't actually installed on the site yet.
   */
  async getPixels(
    accessToken: string,
    adAccountId: string
  ): Promise<MetaPixel[]> {
    const accountPath = this.accountPath(adAccountId);
    const params = new URLSearchParams({
      fields: "id,name,last_fired_time",
      access_token: accessToken,
      limit: "50",
    });
    const data = await this.graphFetch<{
      data?: Array<{ id: string; name?: string; last_fired_time?: string }>;
    }>(`${GRAPH_BASE}/${accountPath}/adspixels?${params.toString()}`);
    return (data.data ?? []).map((p) => ({
      id: p.id,
      name: p.name || "Meta Pixel",
      lastFiredTime: p.last_fired_time ?? null,
    }));
  }

  /**
   * Custom audiences (including lookalikes). Filter `subtype === "LOOKALIKE"`
   * client-side to surface lookalikes separately in the wizard UI.
   */
  async getCustomAudiences(
    accessToken: string,
    adAccountId: string
  ): Promise<MetaCustomAudience[]> {
    const accountPath = this.accountPath(adAccountId);
    const params = new URLSearchParams({
      fields:
        "id,name,subtype,approximate_count_lower_bound,approximate_count_upper_bound,description,operation_status,delivery_status",
      access_token: accessToken,
      limit: "200",
    });
    const data = await this.graphFetch<{
      data: Array<{
        id: string;
        name: string;
        subtype?: string;
        approximate_count_lower_bound?: number;
        approximate_count_upper_bound?: number;
        description?: string;
        operation_status?: { code?: number; description?: string };
        delivery_status?: { code?: number; description?: string };
      }>;
    }>(
      `${GRAPH_BASE}/${accountPath}/customaudiences?${params.toString()}`
    );
    return data.data.map((a) => ({
      id: a.id,
      name: a.name,
      subtype: a.subtype ?? "CUSTOM",
      isLookalike: a.subtype === "LOOKALIKE",
      approxSize:
        a.approximate_count_upper_bound ??
        a.approximate_count_lower_bound ??
        null,
      description: a.description,
      ready: (a.operation_status?.code ?? 200) === 200,
    }));
  }

  /**
   * Saved audiences — Meta's older audience-template feature. Different
   * endpoint and shape from customaudiences.
   */
  async getSavedAudiences(
    accessToken: string,
    adAccountId: string
  ): Promise<MetaSavedAudience[]> {
    const accountPath = this.accountPath(adAccountId);
    const params = new URLSearchParams({
      fields: "id,name,description,approximate_count",
      access_token: accessToken,
      limit: "100",
    });
    const data = await this.graphFetch<{
      data: Array<{
        id: string;
        name: string;
        description?: string;
        approximate_count?: number;
      }>;
    }>(`${GRAPH_BASE}/${accountPath}/saved_audiences?${params.toString()}`);
    return data.data.map((a) => ({
      id: a.id,
      name: a.name,
      description: a.description,
      approxSize: a.approximate_count ?? null,
    }));
  }

  /**
   * Interest keyword search — type-ahead for the audience step.
   */
  async searchInterests(
    accessToken: string,
    query: string
  ): Promise<MetaTargetingSuggestion[]> {
    if (!query.trim()) return [];
    const params = new URLSearchParams({
      type: "adinterest",
      q: query.trim(),
      limit: "20",
      access_token: accessToken,
    });
    const data = await this.graphFetch<{
      data: Array<{
        id: string;
        name: string;
        audience_size_lower_bound?: number;
        audience_size_upper_bound?: number;
        path?: string[];
      }>;
    }>(`${GRAPH_BASE}/search?${params.toString()}`);
    return data.data.map((d) => ({
      id: d.id,
      name: d.name,
      path: d.path,
      audienceSize:
        d.audience_size_upper_bound ?? d.audience_size_lower_bound ?? null,
    }));
  }

  /**
   * Location search — type-ahead. `types` controls which kinds of places.
   */
  async searchLocations(
    accessToken: string,
    query: string,
    types: ReadonlyArray<"country" | "region" | "city" | "zip"> = [
      "city",
      "region",
      "country",
    ]
  ): Promise<MetaGeoLocation[]> {
    if (!query.trim()) return [];
    const params = new URLSearchParams({
      type: "adgeolocation",
      q: query.trim(),
      location_types: JSON.stringify(types),
      limit: "20",
      access_token: accessToken,
    });
    const data = await this.graphFetch<{
      data: Array<{
        key: string;
        name: string;
        type: string;
        country_code?: string;
        country_name?: string;
        region?: string;
        region_id?: number;
      }>;
    }>(`${GRAPH_BASE}/search?${params.toString()}`);
    return data.data.map((d) => ({
      key: d.key,
      name: d.name,
      type: d.type as MetaGeoLocation["type"],
      countryCode: d.country_code,
      countryName: d.country_name,
      region: d.region,
    }));
  }

  /* ───────────────────────────────── */
  /* Phase 1A — Asset management        */
  /* ───────────────────────────────── */

  /**
   * Upload by URL. Meta downloads from the URL and stores it. Best for
   * "pick from Creatives library" — our Creative rows already have a hosted
   * image URL we can hand over.
   *
   * Returns `image_hash` keyed by the (only) image. The Graph API responds
   * with `{ images: { <filename>: { hash, url } } }` — we flatten.
   */
  async uploadImageFromUrl(
    accessToken: string,
    adAccountId: string,
    imageUrl: string
  ): Promise<{ hash: string; url: string }> {
    const accountPath = this.accountPath(adAccountId);
    const body = new URLSearchParams({
      url: imageUrl,
      access_token: accessToken,
    });
    const data = await this.graphFetch<{
      images?: Record<string, { hash: string; url: string }>;
    }>(`${GRAPH_BASE}/${accountPath}/adimages`, {
      method: "POST",
      body,
    });
    const entry = Object.values(data.images ?? {})[0];
    if (!entry) {
      throw new Error("Meta API: adimages response had no image entry");
    }
    return { hash: entry.hash, url: entry.url };
  }

  /**
   * Upload by raw bytes. Used when the user uploads a fresh image from
   * their machine in the wizard. Multipart form-data POST.
   */
  async uploadImageFromBytes(
    accessToken: string,
    adAccountId: string,
    fileBuffer: Buffer,
    filename: string,
    mimeType: string
  ): Promise<{ hash: string; url: string }> {
    const accountPath = this.accountPath(adAccountId);
    const form = new FormData();
    const blob = new Blob([new Uint8Array(fileBuffer)], { type: mimeType });
    form.append("source", blob, filename);
    form.append("access_token", accessToken);
    const data = await this.graphFetch<{
      images?: Record<string, { hash: string; url: string }>;
    }>(`${GRAPH_BASE}/${accountPath}/adimages`, {
      method: "POST",
      body: form,
    });
    const entry = Object.values(data.images ?? {})[0];
    if (!entry) {
      throw new Error("Meta API: adimages response had no image entry");
    }
    return { hash: entry.hash, url: entry.url };
  }

  /**
   * Upload a video by URL. Meta fetches the asset itself and returns a
   * `video_id` — the handle we pass into the ad creative spec later.
   *
   * Used when a creative already has a hosted asset (URL paste, or a video
   * the user uploaded earlier and now reuses from the library).
   *
   * Note: videos transcode async — call `getVideoStatus(id)` and wait for
   * `video_status === "ready"` before using the id in `createAdCreative`.
   */
  async uploadVideoFromUrl(
    accessToken: string,
    adAccountId: string,
    videoUrl: string
  ): Promise<{ id: string }> {
    const accountPath = this.accountPath(adAccountId);
    const body = new URLSearchParams({
      file_url: videoUrl,
      access_token: accessToken,
    });
    const data = await this.graphFetch<{ id: string }>(
      `${GRAPH_BASE}/${accountPath}/advideos`,
      { method: "POST", body }
    );
    return { id: data.id };
  }

  /**
   * Upload a video by raw bytes. Multipart form-data POST to /advideos.
   * Returns a `video_id` — same transcode-and-poll caveat as uploadVideoFromUrl.
   */
  async uploadVideoFromBytes(
    accessToken: string,
    adAccountId: string,
    fileBuffer: Buffer,
    filename: string,
    mimeType: string
  ): Promise<{ id: string }> {
    const accountPath = this.accountPath(adAccountId);
    const form = new FormData();
    const blob = new Blob([new Uint8Array(fileBuffer)], { type: mimeType });
    form.append("source", blob, filename);
    form.append("access_token", accessToken);
    const data = await this.graphFetch<{ id: string }>(
      `${GRAPH_BASE}/${accountPath}/advideos`,
      { method: "POST", body: form }
    );
    return { id: data.id };
  }

  /**
   * Fetch a streamable MP4 URL for a previously-uploaded video so we can
   * play it back inside our app (not just at Meta ad-delivery time).
   *
   * The `source` field on a Graph video returns a signed URL — rotates
   * every few hours, so callers should NOT cache it; fetch fresh per play
   * session. `permalink_url` is the Facebook viewer URL we keep as a
   * last-resort "open in new tab" fallback.
   *
   * Returns `null` for either field if the video hasn't transcoded yet
   * (Meta omits `source` until status is "ready").
   */
  async getVideoSource(
    accessToken: string,
    videoId: string
  ): Promise<{ source: string | null; permalinkUrl: string | null }> {
    const url = `${GRAPH_BASE}/${videoId}?fields=source,permalink_url&access_token=${encodeURIComponent(accessToken)}`;
    const data = await this.graphFetch<{
      source?: string;
      permalink_url?: string;
    }>(url);
    return {
      source: data.source ?? null,
      permalinkUrl: data.permalink_url ?? null,
    };
  }

  /**
   * Poll a video's processing status. Meta transcodes uploads asynchronously
   * — values are "processing" | "ready" | "error". Returns `null` if the
   * field isn't present yet (Meta sometimes 200s before the status row exists).
   *
   * Also returns a thumbnail URL when available (Meta auto-generates one we
   * can use as the ad's poster image).
   */
  async getVideoStatus(
    accessToken: string,
    videoId: string
  ): Promise<{
    status: "processing" | "ready" | "error" | null;
    thumbnailUrl: string | null;
  }> {
    const url = `${GRAPH_BASE}/${videoId}?fields=status,picture&access_token=${encodeURIComponent(accessToken)}`;
    const data = await this.graphFetch<{
      status?: { video_status?: string };
      picture?: string;
    }>(url);
    const raw = data.status?.video_status;
    const status =
      raw === "ready" || raw === "processing" || raw === "error" ? raw : null;
    return { status, thumbnailUrl: data.picture ?? null };
  }

  /**
   * Create a Lookalike Custom Audience from an existing seed audience.
   * Meta runs this asynchronously — `delivery_status` will show "pending"
   * for several minutes/hours after creation.
   */
  async createLookalikeAudience(
    accessToken: string,
    adAccountId: string,
    params: {
      name: string;
      seedAudienceId: string;
      countryCode: string;
      ratio?: number; // 1-10, percent of country's population
    }
  ): Promise<{ id: string }> {
    const accountPath = this.accountPath(adAccountId);
    const body = new URLSearchParams({
      name: params.name,
      subtype: "LOOKALIKE",
      origin_audience_id: params.seedAudienceId,
      lookalike_spec: JSON.stringify({
        ratio: (params.ratio ?? 1) / 100,
        country: params.countryCode,
      }),
      access_token: accessToken,
    });
    const created = await this.graphFetch<{ id: string }>(
      `${GRAPH_BASE}/${accountPath}/customaudiences`,
      { method: "POST", body }
    );
    return { id: created.id };
  }

  /* ───────────────────────────────── */
  /* Phase 1A — Publishing             */
  /* ───────────────────────────────── */

  /**
   * Create an ad set under an existing campaign. `targeting` is Meta's
   * targeting JSON spec — built by `composeTargeting` from our wizard
   * data.
   */
  async createAdSet(
    accessToken: string,
    adAccountId: string,
    params: {
      name: string;
      campaignId: string;
      objective: MetaObjective;
      targeting: MetaTargeting;
      status?: "ACTIVE" | "PAUSED";
      dailyBudget?: number; // in account currency, e.g. 25.00
      lifetimeBudget?: number;
      startTime?: string;
      endTime?: string;
      promotedPageId?: string;
      /** Required for conversion objectives (Sales / Leads). Resolve it with
       *  `getPixels` before calling — Meta rejects OFFSITE_CONVERSIONS without
       *  a promoted_object naming the pixel. */
      promotedPixelId?: string;
    }
  ): Promise<{ id: string }> {
    const accountPath = this.accountPath(adAccountId);
    // Each campaign objective constrains the valid optimization_goal +
    // billing_event + promoted_object combo.
    const opt = this.optimizationFor(params.objective);

    // Meta rejects any ad set that doesn't state an Advantage+ audience
    // preference ("Advantage Audience Flag Required", code 100). It has to be
    // an explicit 1 or 0 — there is no server-side default. We choose 0 so the
    // audience the user assembled in the wizard is honoured exactly; letting
    // Meta expand past it would quietly make the targeting step decorative.
    const targeting: MetaTargeting = {
      ...params.targeting,
      targeting_automation: {
        advantage_audience:
          params.targeting.targeting_automation?.advantage_audience ?? 0,
      },
    };

    const body = new URLSearchParams({
      name: params.name,
      campaign_id: params.campaignId,
      status: params.status ?? "PAUSED",
      billing_event: opt.billingEvent,
      optimization_goal: opt.optimizationGoal,
      bid_strategy: "LOWEST_COST_WITHOUT_CAP",
      targeting: JSON.stringify(targeting),
      access_token: accessToken,
    });
    if (params.dailyBudget !== undefined) {
      body.set("daily_budget", String(Math.round(params.dailyBudget * 100)));
    }
    if (params.lifetimeBudget !== undefined) {
      body.set(
        "lifetime_budget",
        String(Math.round(params.lifetimeBudget * 100))
      );
    }
    if (params.startTime) body.set("start_time", params.startTime);
    if (params.endTime) body.set("end_time", params.endTime);

    // promoted_object must match the optimization goal EXACTLY. Sending a
    // page_id to a conversion goal — or omitting the pixel from one — is
    // rejected as a bare "Invalid parameter (code 100)". `optimizationFor`
    // is the single source of truth for which shape applies.
    if (opt.promotedObject === "page" && params.promotedPageId) {
      body.set(
        "promoted_object",
        JSON.stringify({ page_id: params.promotedPageId })
      );
    } else if (opt.promotedObject === "pixel") {
      if (!params.promotedPixelId) {
        throw new Error(
          `createAdSet: ${params.objective} optimizes for conversions and requires promotedPixelId`
        );
      }
      body.set(
        "promoted_object",
        JSON.stringify({
          pixel_id: params.promotedPixelId,
          custom_event_type: opt.pixelEvent ?? "PURCHASE",
        })
      );
    }

    const created = await this.graphFetch<{ id: string }>(
      `${GRAPH_BASE}/${accountPath}/adsets`,
      { method: "POST", body }
    );
    return { id: created.id };
  }

  /**
   * Create an ad creative (image, video, OR carousel + copy + link, owned
   * by a Page).
   *
   * Three shapes Meta accepts in `object_story_spec`:
   *   - Image:    `link_data` with `image_hash`
   *   - Video:    `video_data` with `video_id` (+ thumbnail)
   *   - Carousel: `link_data` with `child_attachments` (2-10 cards)
   *
   * Caller passes ONE of `imageHash` | `videoId` | `cards`. Carousel cards
   * each carry their own image_hash + name (headline) + description +
   * link; the top-level `message` and `callToAction` apply across all
   * cards.
   *
   * Video ads also need a thumbnail; if `thumbnailUrl` is omitted we fall
   * back to Meta's auto-generated picture (fetch it via `getVideoStatus`
   * and pass it in for predictable results).
   */
  async createAdCreative(
    accessToken: string,
    adAccountId: string,
    params: {
      name: string;
      pageId: string;
      message: string; // body copy (shared across carousel cards)
      headline?: string;
      description?: string;
      linkUrl: string;
      callToAction?: MetaCallToActionType;
      /** Provide ONE of imageHash | videoId | cards. */
      imageHash?: string;
      videoId?: string;
      cards?: Array<{
        imageHash: string;
        headline?: string;
        description?: string;
        link?: string;
      }>;
      /** Video poster — required by Meta for video ads. */
      thumbnailUrl?: string;
    }
  ): Promise<{ id: string }> {
    const hasCarousel = (params.cards?.length ?? 0) >= 2;
    if (!params.imageHash && !params.videoId && !hasCarousel) {
      throw new Error(
        "createAdCreative: provide imageHash (image), videoId (video), or cards[] (carousel, 2-10)"
      );
    }
    if (params.cards && (params.cards.length < 2 || params.cards.length > 10)) {
      throw new Error("createAdCreative: carousel needs 2-10 cards");
    }

    const accountPath = this.accountPath(adAccountId);
    const callToAction = params.callToAction
      ? {
          type: params.callToAction,
          value: { link: params.linkUrl },
        }
      : undefined;

    let storySpec: Record<string, unknown>;
    if (hasCarousel) {
      // Carousel: child_attachments at the top of link_data. Each card
      // can override the ad-level link with its own. Meta requires each
      // card to have a link (it falls back to the parent link_data.link
      // when omitted, but we pass it explicitly for clarity).
      const childAttachments = params.cards!.map((c) => {
        const attachment: Record<string, unknown> = {
          image_hash: c.imageHash,
          link: c.link ?? params.linkUrl,
        };
        if (c.headline) attachment.name = c.headline;
        if (c.description) attachment.description = c.description;
        if (callToAction) attachment.call_to_action = callToAction;
        return attachment;
      });
      const linkData: Record<string, unknown> = {
        message: params.message,
        link: params.linkUrl,
        child_attachments: childAttachments,
        // multi_share_optimized=true lets Meta reorder cards by performance
        // — best-practice default. Users who want a fixed order can override
        // with explicit per-card link/headline differences.
        multi_share_optimized: true,
        multi_share_end_card: true,
      };
      if (callToAction) linkData.call_to_action = callToAction;
      storySpec = { page_id: params.pageId, link_data: linkData };
    } else if (params.videoId) {
      // Video ads use `video_data`. `title` maps to the ad's headline,
      // `message` to the body copy. `image_url` is the poster shown before
      // playback starts — Meta rejects video_data without it.
      const videoData: Record<string, unknown> = {
        video_id: params.videoId,
        message: params.message,
        link_description: params.description ?? undefined,
        title: params.headline ?? undefined,
      };
      if (params.thumbnailUrl) videoData.image_url = params.thumbnailUrl;
      if (callToAction) videoData.call_to_action = callToAction;
      storySpec = { page_id: params.pageId, video_data: videoData };
    } else {
      const linkData: Record<string, unknown> = {
        message: params.message,
        link: params.linkUrl,
        image_hash: params.imageHash,
      };
      if (params.headline) linkData.name = params.headline;
      if (params.description) linkData.description = params.description;
      if (callToAction) linkData.call_to_action = callToAction;
      storySpec = { page_id: params.pageId, link_data: linkData };
    }

    const body = new URLSearchParams({
      name: params.name,
      object_story_spec: JSON.stringify(storySpec),
      access_token: accessToken,
    });
    const created = await this.graphFetch<{ id: string }>(
      `${GRAPH_BASE}/${accountPath}/adcreatives`,
      { method: "POST", body }
    );
    return { id: created.id };
  }

  /**
   * Create the ad itself — binds an ad set to an ad creative.
   * Defaults to PAUSED so the user reviews before flipping ACTIVE.
   */
  async createAd(
    accessToken: string,
    adAccountId: string,
    params: {
      name: string;
      adSetId: string;
      creativeId: string;
      status?: "ACTIVE" | "PAUSED";
    }
  ): Promise<{ id: string }> {
    const accountPath = this.accountPath(adAccountId);
    const body = new URLSearchParams({
      name: params.name,
      adset_id: params.adSetId,
      creative: JSON.stringify({ creative_id: params.creativeId }),
      status: params.status ?? "PAUSED",
      access_token: accessToken,
    });
    const created = await this.graphFetch<{ id: string }>(
      `${GRAPH_BASE}/${accountPath}/ads`,
      { method: "POST", body }
    );
    return { id: created.id };
  }

  /* ───────────────────────────────── */
  /* Objective + optimization mapping  */
  /* ───────────────────────────────── */

  /**
   * Map our internal objective string to Meta's new `OUTCOME_*` enum.
   * Meta deprecated their old objective values (CONVERSIONS, BRAND_AWARENESS,
   * etc.) in mid-2023; OUTCOME_* is the only accepted set on Marketing API
   * v18+ for new campaigns.
   */
  mapObjectiveToMeta(objective: string): MetaObjective {
    // Campaigns imported by sync already carry Meta's own enum. Pass those
    // straight through — normalizing them alongside our display labels used to
    // send every one of them to OUTCOME_TRAFFIC.
    const upper = objective.trim().toUpperCase();
    if (
      upper === "OUTCOME_SALES" ||
      upper === "OUTCOME_AWARENESS" ||
      upper === "OUTCOME_TRAFFIC" ||
      upper === "OUTCOME_LEADS" ||
      upper === "OUTCOME_ENGAGEMENT" ||
      upper === "OUTCOME_APP_PROMOTION"
    ) {
      return upper as MetaObjective;
    }

    const k = objective.toLowerCase().replace(/[^a-z]/g, "");
    switch (k) {
      case "conversions":
      case "sales":
      case "catalogsales":
        return "OUTCOME_SALES";
      case "awareness":
      case "brandawareness":
      case "reach":
        return "OUTCOME_AWARENESS";
      case "traffic":
        return "OUTCOME_TRAFFIC";
      case "leads":
      case "leadgeneration":
        return "OUTCOME_LEADS";
      case "engagement":
      case "videoviews":
      case "messages":
        return "OUTCOME_ENGAGEMENT";
      case "apppromotion":
      case "appinstalls":
        return "OUTCOME_APP_PROMOTION";
      default:
        return "OUTCOME_TRAFFIC";
    }
  }

  /**
   * Pick the optimization_goal + billing_event + promoted_object shape for an
   * objective. Every combination here is from Meta's valid-pairs matrix.
   *
   * Two mappings are deliberately NOT the "obvious" ones:
   *
   *   - OUTCOME_LEADS → OFFSITE_CONVERSIONS (not LEAD_GENERATION). Meta only
   *     accepts LEAD_GENERATION when the ad points at an on-Meta Instant Form,
   *     which we don't create. Every lead ad we publish sends traffic to the
   *     advertiser's own site, so the correct pairing is a pixel-optimized
   *     conversion ad with custom_event_type LEAD.
   *   - OUTCOME_APP_PROMOTION → APP_INSTALLS needs a registered app object we
   *     have no way to collect, so `publishable: false` marks it unsupported
   *     (see `isPublishableObjective`) and the UI never offers it.
   */
  optimizationFor(objective: MetaObjective): MetaOptimizationSpec {
    switch (objective) {
      case "OUTCOME_SALES":
        return {
          optimizationGoal: "OFFSITE_CONVERSIONS",
          billingEvent: "IMPRESSIONS",
          promotedObject: "pixel",
          pixelEvent: "PURCHASE",
        };
      case "OUTCOME_LEADS":
        return {
          optimizationGoal: "OFFSITE_CONVERSIONS",
          billingEvent: "IMPRESSIONS",
          promotedObject: "pixel",
          pixelEvent: "LEAD",
        };
      case "OUTCOME_AWARENESS":
        return {
          optimizationGoal: "REACH",
          billingEvent: "IMPRESSIONS",
          promotedObject: "none",
        };
      case "OUTCOME_TRAFFIC":
        return {
          optimizationGoal: "LINK_CLICKS",
          billingEvent: "IMPRESSIONS",
          promotedObject: "none",
        };
      case "OUTCOME_ENGAGEMENT":
        return {
          optimizationGoal: "POST_ENGAGEMENT",
          billingEvent: "IMPRESSIONS",
          promotedObject: "page",
        };
      case "OUTCOME_APP_PROMOTION":
        return {
          optimizationGoal: "APP_INSTALLS",
          billingEvent: "IMPRESSIONS",
          promotedObject: "none",
        };
    }
  }

  /**
   * Objectives we can actually publish end-to-end today. App Promotion needs a
   * registered app + store URL that the wizard has no way to collect, so we
   * exclude it rather than let a user reach the last step and fail.
   */
  isPublishableObjective(objective: MetaObjective): boolean {
    return objective !== "OUTCOME_APP_PROMOTION";
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
  /**
   * Fetch every page of a Graph API edge, following `paging.next` cursors and
   * concatenating the `data` arrays. Meta caps each page (default 25), so any
   * single-page fetch silently truncates large result sets. Hard cap of 50
   * pages is a runaway guard.
   */
  private async graphFetchAll<TItem>(url: string): Promise<TItem[]> {
    type Page = { data?: TItem[]; paging?: { next?: string } };
    const items: TItem[] = [];
    let next: string | undefined = url;
    let pages = 0;
    while (next && pages < 50) {
      const page: Page = await this.graphFetch<Page>(next);
      if (Array.isArray(page.data)) items.push(...page.data);
      next = page.paging?.next;
      pages++;
    }
    return items;
  }

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
      const e = errResp.error;
      const code = e.code ?? "unknown";
      // Prefer Meta's human-readable specifics. For code 100 ("Invalid
      // parameter") the bare message is useless — `error_user_msg` names the
      // actual field/reason (e.g. "Your daily budget is too low"). Build the
      // richest message we have so publish failures are debuggable.
      const detail = [e.error_user_title, e.error_user_msg]
        .filter(Boolean)
        .join(": ");
      const base = detail || e.message || "Unknown error";
      const subcode = e.error_subcode ? `/${e.error_subcode}` : "";
      // Carry structured fields so callers can map to a friendly message
      // (see lib/meta-errors.ts) instead of parsing this string.
      const error = new Error(
        `Meta API: ${base} (code: ${code}${subcode})`
      ) as Error & {
        metaCode?: number;
        metaSubcode?: number;
        metaUserMessage?: string;
      };
      if (typeof e.code === "number") error.metaCode = e.code;
      if (typeof e.error_subcode === "number") error.metaSubcode = e.error_subcode;
      error.metaUserMessage = base;
      throw error;
    }
    if (!res.ok) {
      throw new Error(`Meta API: HTTP ${res.status}`);
    }

    return parsed as T;
  }
}

export const metaService = new MetaAdsService();
