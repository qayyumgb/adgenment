"use client";

import { useMemo } from "react";
import { useAuth } from "@clerk/nextjs";

/* ───────────────────────────── */
/* Types — mirror Prisma schema  */
/* ───────────────────────────── */

export type Platform =
  | "META"
  | "GOOGLE"
  | "TIKTOK"
  | "LINKEDIN"
  | "YOUTUBE"
  | "SNAPCHAT"
  | "PINTEREST"
  | "X";

export type PlanType = "FREE" | "STARTER" | "PRO" | "ENTERPRISE";
export type WorkspaceRole = "OWNER" | "ADMIN" | "EDITOR" | "VIEWER";
export type CampaignStatus = "DRAFT" | "ACTIVE" | "PAUSED" | "ENDED";
export type BudgetType = "DAILY" | "LIFETIME";
export type CreativeType = "IMAGE" | "VIDEO" | "CAROUSEL" | "TEXT";
export type CreativeStatus = "DRAFT" | "APPROVED" | "REJECTED" | "ARCHIVED";

export interface User {
  id: string;
  clerkId: string;
  email: string;
  name: string | null;
  plan: PlanType;
  createdAt: string;
}

export interface Workspace {
  id: string;
  name: string;
  slug: string | null;
  industry: string | null;
  companySize: string | null;
  ownerId: string;
  plan: PlanType;
  createdAt: string;
}

export interface Member {
  id: string;
  workspaceId: string;
  userId: string;
  role: WorkspaceRole;
  user: { id: string; name: string | null; email: string; plan?: PlanType };
}

export interface AdAccount {
  id: string;
  platform: Platform;
  accountId: string;
  accountName: string;
  /** ISO 4217 code captured from the ad platform. Null until first sync. */
  currency?: string | null;
  /** IANA tz name. Null until first sync. */
  timezone?: string | null;
  isActive: boolean;
  createdAt: string;
}

export interface Campaign {
  id: string;
  workspaceId: string;
  adAccountId: string;
  platform: Platform;
  name: string;
  status: CampaignStatus;
  objective: string;
  budget: string | number;
  budgetType: BudgetType;
  externalId?: string | null;
  externalAdSetId?: string | null;
  externalAdId?: string | null;
  externalCreativeId?: string | null;
  externalPageId?: string | null;
  publishedAt?: string | null;
  publishError?: string | null;
  startDate: string | null;
  endDate: string | null;
  targeting: unknown;
  createdAt: string;
  updatedAt: string;
  adAccount?: {
    platform: Platform;
    accountName: string;
    currency?: string | null;
    timezone?: string | null;
  };
  _count?: { metrics: number };
  /** Populated when `includeLatestMetrics=true` was passed to /campaigns. */
  metrics?: CampaignMetric[];
  /**
   * Lifetime totals — sum of every `CampaignMetric` row for this campaign.
   * Always returned by `/campaigns` and `/campaigns/:id` (it's just zeroes
   * when no metric rows exist).
   */
  totals?: {
    spend: number;
    impressions: number;
    clicks: number;
    conversions: number;
    revenue: number;
  };
}

export interface CampaignMetric {
  id: string;
  campaignId: string;
  date: string;
  impressions: number;
  clicks: number;
  spend: string | number;
  conversions: number;
  revenue: string | number;
  ctr: number;
  cpc: number;
  cpm: number;
  roas: number;
  updatedAt: string;
}

export interface Creative {
  id: string;
  workspaceId: string;
  campaignId: string | null;
  name: string;
  type: CreativeType;
  content: unknown;
  status: CreativeStatus;
  aiGenerated: boolean;
  createdAt: string;
  campaign?: { name: string; platform: Platform } | null;
}

/* ───────────────────────────── */
/* Request / Response types       */
/* ───────────────────────────── */

export interface CampaignsResponse {
  campaigns: Campaign[];
  total: number;
  page: number;
  totalPages: number;
}

export interface CreativesResponse {
  creatives: Creative[];
  total: number;
  page: number;
  totalPages: number;
}

export interface CreateCampaignInput {
  name: string;
  platform: Platform;
  objective: string;
  budget: number;
  budgetType?: BudgetType;
  startDate?: string | null;
  endDate?: string | null;
  adAccountId: string;
  targeting?: unknown;
}

export interface CreateCreativeInput {
  name: string;
  type: CreativeType;
  content: unknown;
  campaignId?: string | null;
  aiGenerated?: boolean;
  status?: CreativeStatus;
}

export interface ConnectAdAccountInput {
  platform: Platform;
  accountId: string;
  accountName: string;
  accessToken: string;
  refreshToken?: string;
}

export interface UpdateWorkspaceInput {
  name?: string;
  slug?: string;
  industry?: string;
  companySize?: string;
}

export interface AnalyticsOverview {
  spend: number;
  revenue: number;
  impressions: number;
  clicks: number;
  conversions: number;
  roas: number;
  ctr: number;
  changes: {
    spend: number;
    revenue: number;
    roas: number;
    impressions: number;
    clicks: number;
    conversions: number;
  };
}

export interface TimeseriesPoint {
  date: string;
  value: number;
}

export interface PlatformBreakdown {
  platform: Platform;
  spend: number;
  revenue: number;
  impressions: number;
  clicks: number;
  conversions: number;
  roas: number;
  ctr: number;
}

export interface AnalyticsCampaignRow {
  id: string;
  name: string;
  platform: Platform;
  status: CampaignStatus;
  spend: number;
  revenue: number;
  roas: number;
  impressions: number;
  clicks: number;
  ctr: number;
  conversions: number;
  cpa: number;
}

export interface AnalyticsCampaignsResponse {
  campaigns: AnalyticsCampaignRow[];
  total: number;
  page: number;
  totalPages: number;
}

export interface MeResponse {
  user: User;
  workspace:
    | (Workspace & { _count: { members: number } })
    | null;
}

export interface WorkspaceResponse extends Workspace {
  members: Member[];
  _count: { adAccounts: number };
}

export interface SuccessResponse {
  success: boolean;
  message?: string;
}

/* ───────────────────────────── */
/* Hook                           */
/* ───────────────────────────── */

const API_BASE =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

function buildQuery(params?: Record<string, string | number | undefined>) {
  if (!params) return "";
  const usp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null || v === "") continue;
    usp.set(k, String(v));
  }
  const s = usp.toString();
  return s ? `?${s}` : "";
}

export function useApiClient() {
  const { getToken } = useAuth();

  // Memoize the returned client object so consumers can safely list it in
  // useEffect / useCallback dependency arrays without causing infinite loops.
  // `getToken` from Clerk is itself stable across renders.
  return useMemo(() => {
    async function apiFetch<T>(
      path: string,
      options: RequestInit = {}
    ): Promise<T> {
      const token = await getToken();
      const res = await fetch(`${API_BASE}/api${path}`, {
        ...options,
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          ...options.headers,
        },
      });
      if (!res.ok) {
        const err = await res
          .json()
          .catch(() => ({ error: `Request failed (${res.status})` }));
        throw new Error(err.error ?? `HTTP ${res.status}`);
      }
      if (res.status === 204) return undefined as T;
      return res.json() as Promise<T>;
    }

    return {
    /* Campaigns */
    getCampaigns: (params?: Record<string, string | number | undefined>) =>
      apiFetch<CampaignsResponse>(
        `/campaigns${buildQuery({ includeLatestMetrics: "true", ...params })}`
      ),
    getCampaign: (id: string) =>
      apiFetch<Campaign>(`/campaigns/${id}`),
    createCampaign: (data: CreateCampaignInput) =>
      apiFetch<Campaign>("/campaigns", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    updateCampaign: (id: string, data: Partial<CreateCampaignInput & { status: CampaignStatus }>) =>
      apiFetch<Campaign>(`/campaigns/${id}`, {
        method: "PUT",
        body: JSON.stringify(data),
      }),
    deleteCampaign: (id: string) =>
      apiFetch<SuccessResponse>(`/campaigns/${id}`, { method: "DELETE" }),
    getCampaignMetrics: (id: string, days = 30) =>
      apiFetch<CampaignMetric[]>(`/campaigns/${id}/metrics?days=${days}`),

    /* Analytics */
    getAnalyticsOverview: (days = 30, platform?: Platform) =>
      apiFetch<AnalyticsOverview>(
        `/analytics/overview${buildQuery({ days, platform })}`
      ),
    getTimeseries: (
      days = 30,
      metric: "spend" | "revenue" | "roas" | "impressions" | "clicks" | "conversions" = "spend",
      platform?: Platform
    ) =>
      apiFetch<TimeseriesPoint[]>(
        `/analytics/timeseries${buildQuery({ days, metric, platform })}`
      ),
    getPlatformBreakdown: (days = 30) =>
      apiFetch<PlatformBreakdown[]>(
        `/analytics/by-platform${buildQuery({ days })}`
      ),
    getAnalyticsCampaigns: (params?: {
      days?: number;
      sortBy?: string;
      sortOrder?: "asc" | "desc";
      page?: number;
      limit?: number;
    }) =>
      apiFetch<AnalyticsCampaignsResponse>(
        `/analytics/campaigns${buildQuery(params)}`
      ),

    /* Ad Accounts */
    getAdAccounts: () => apiFetch<AdAccount[]>("/ad-accounts"),
    connectAdAccount: (data: ConnectAdAccountInput) =>
      apiFetch<AdAccount>("/ad-accounts", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    disconnectAdAccount: (id: string) =>
      apiFetch<SuccessResponse>(`/ad-accounts/${id}`, { method: "DELETE" }),
    toggleAdAccount: (id: string) =>
      apiFetch<AdAccount>(`/ad-accounts/${id}/toggle`, { method: "PATCH" }),

    /* Workspace */
    getMe: () => apiFetch<MeResponse>("/auth/me"),
    completeOnboarding: (data: {
      workspaceName: string;
      industry?: string;
      companySize?: string;
      plan?: PlanType;
    }) =>
      apiFetch<{ workspace: Workspace; member: Member }>(
        "/auth/complete-onboarding",
        { method: "POST", body: JSON.stringify(data) }
      ),
    getWorkspace: () => apiFetch<WorkspaceResponse>("/auth/workspace"),
    updateWorkspace: (data: UpdateWorkspaceInput) =>
      apiFetch<Workspace>("/workspace", {
        method: "PATCH",
        body: JSON.stringify(data),
      }),
    getMembers: () => apiFetch<Member[]>("/workspace/members"),
    inviteMember: (email: string, role: WorkspaceRole) =>
      apiFetch<SuccessResponse>("/workspace/invite", {
        method: "POST",
        body: JSON.stringify({ email, role }),
      }),
    updateMemberRole: (memberId: string, role: WorkspaceRole) =>
      apiFetch<Member>(`/workspace/members/${memberId}/role`, {
        method: "PUT",
        body: JSON.stringify({ role }),
      }),
    removeMember: (memberId: string) =>
      apiFetch<SuccessResponse>(`/workspace/members/${memberId}`, {
        method: "DELETE",
      }),

    /* Creatives */
    getCreatives: (params?: Record<string, string | number | undefined>) =>
      apiFetch<CreativesResponse>(`/creatives${buildQuery(params)}`),
    createCreative: (data: CreateCreativeInput) =>
      apiFetch<Creative>("/creatives", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    updateCreative: (id: string, data: Partial<CreateCreativeInput>) =>
      apiFetch<Creative>(`/creatives/${id}`, {
        method: "PUT",
        body: JSON.stringify(data),
      }),
    deleteCreative: (id: string) =>
      apiFetch<SuccessResponse>(`/creatives/${id}`, { method: "DELETE" }),

    /* ───────────────────────────────── */
    /* Phase 1A — Meta publish wizard    */
    /* ───────────────────────────────── */
    getMetaPages: () => apiFetch<MetaPage[]>("/meta/pages"),
    getMetaCustomAudiences: () =>
      apiFetch<MetaCustomAudience[]>("/meta/custom-audiences"),
    getMetaSavedAudiences: () =>
      apiFetch<MetaSavedAudience[]>("/meta/saved-audiences"),
    searchMetaInterests: (q: string) =>
      apiFetch<MetaTargetingSuggestion[]>(
        `/meta/interests${buildQuery({ q })}`
      ),
    searchMetaLocations: (
      q: string,
      types?: ReadonlyArray<"country" | "region" | "city" | "zip">
    ) =>
      apiFetch<MetaGeoLocation[]>(
        `/meta/locations${buildQuery({
          q,
          types: types && types.length > 0 ? types.join(",") : undefined,
        })}`
      ),
    createMetaLookalike: (data: {
      name: string;
      seedAudienceId: string;
      countryCode: string;
      ratio?: number;
    }) =>
      apiFetch<{ id: string }>("/meta/lookalike", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    publishCampaignToMeta: (id: string, payload: PublishCampaignPayload) =>
      apiFetch<PublishCampaignResult>(`/campaigns/${id}/publish`, {
        method: "POST",
        body: JSON.stringify(payload),
      }),
    /**
     * Upload an image file to Meta (forwarded to /adimages by our API).
     * Bypasses apiFetch because that's JSON-only — multipart needs FormData.
     */
    uploadMetaImage: async (file: File): Promise<{ hash: string; url: string }> => {
      const token = await getToken();
      const form = new FormData();
      form.append("image", file);
      const res = await fetch(`${API_BASE}/api/meta/upload-image`, {
        method: "POST",
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          // NB: don't set Content-Type — browser sets multipart boundary
        },
        body: form,
      });
      if (!res.ok) {
        const err = await res
          .json()
          .catch(() => ({ error: `Upload failed (${res.status})` }));
        throw new Error(err.error ?? `HTTP ${res.status}`);
      }
      return res.json();
    },
    /**
     * Upload a video file to Meta (forwarded to /advideos by our API).
     * Returns `{ id }` — Meta's `video_id`. Note: the video isn't usable in
     * an ad immediately — call `getMetaVideoStatus(id)` until `status === "ready"`.
     */
    uploadMetaVideo: async (
      file: File,
      opts?: { onProgress?: (pct: number) => void }
    ): Promise<{ id: string }> => {
      const token = await getToken();
      const form = new FormData();
      form.append("video", file);
      // Use XHR (not fetch) so we can report upload progress — videos are
      // large enough that an indeterminate spinner is a bad UX. fetch()
      // doesn't expose upload progress events on browsers yet.
      return new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open("POST", `${API_BASE}/api/meta/upload-video`, true);
        if (token) xhr.setRequestHeader("Authorization", `Bearer ${token}`);
        // Don't set Content-Type — XHR fills in the multipart boundary.
        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable && opts?.onProgress) {
            opts.onProgress(Math.round((e.loaded / e.total) * 100));
          }
        };
        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            try {
              resolve(JSON.parse(xhr.responseText) as { id: string });
            } catch {
              reject(new Error("Invalid response from upload endpoint"));
            }
            return;
          }
          let msg = `Upload failed (${xhr.status})`;
          try {
            const body = JSON.parse(xhr.responseText) as { error?: string };
            if (body.error) msg = body.error;
          } catch {
            // ignore
          }
          reject(new Error(msg));
        };
        xhr.onerror = () => reject(new Error("Network error during upload"));
        xhr.send(form);
      });
    },
    /**
     * Poll a Meta video's transcode status. Returns:
     *   - status: "processing" | "ready" | "error" | null (not populated yet)
     *   - thumbnailUrl: Meta-generated poster (only present once ready)
     */
    getMetaVideoStatus: (videoId: string) =>
      apiFetch<{
        status: "processing" | "ready" | "error" | null;
        thumbnailUrl: string | null;
      }>(`/meta/video-status/${encodeURIComponent(videoId)}`),
    /**
     * Fetch a fresh signed MP4 URL for a previously-uploaded video. Don't
     * cache the result — the URL rotates. Call this on demand right before
     * playback (eg. when the user clicks the play overlay).
     */
    getMetaVideoSource: (videoId: string) =>
      apiFetch<{ source: string | null; permalinkUrl: string | null }>(
        `/meta/video-source/${encodeURIComponent(videoId)}`
      ),
    launchCampaign: (id: string, status: "ACTIVE" | "PAUSED" = "ACTIVE") =>
      apiFetch<{ success: boolean; campaign: Campaign }>(
        `/campaigns/${id}/launch`,
        { method: "POST", body: JSON.stringify({ status }) }
      ),
    };
  }, [getToken]);
}

/* ───────────────────────────────── */
/* Phase 1A — Meta publish types     */
/* ───────────────────────────────── */

export interface MetaPage {
  id: string;
  name: string;
  category?: string;
  pictureUrl?: string;
}

export interface MetaCustomAudience {
  id: string;
  name: string;
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

export type MetaCallToAction =
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

export interface MetaTargetingSpec {
  age_min?: number;
  age_max?: number;
  genders?: number[];
  geo_locations?: {
    countries?: string[];
    regions?: Array<{ key: string }>;
    cities?: Array<{ key: string; radius?: number; distance_unit?: "mile" | "kilometer" }>;
    zips?: Array<{ key: string }>;
  };
  excluded_geo_locations?: MetaTargetingSpec["geo_locations"];
  interests?: Array<{ id: string; name?: string }>;
  custom_audiences?: Array<{ id: string }>;
  excluded_custom_audiences?: Array<{ id: string }>;
  saved_audiences?: Array<{ id: string }>;
  publisher_platforms?: Array<"facebook" | "instagram" | "messenger" | "audience_network">;
  /** Position picks per platform — required when publisher_platforms is set.
   *  Omit both arrays for Meta's "automatic placements" (recommended). */
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
}

export interface PublishCampaignPayload {
  pageId: string;
  targeting: MetaTargetingSpec;
  creative: {
    message: string;
    headline?: string;
    description?: string;
    linkUrl: string;
    callToAction?: MetaCallToAction;
    /** Image-ad inputs — choose ONE: imageUrl (public URL Meta will
     *  download) OR imageHash (pre-uploaded to Meta). */
    imageUrl?: string;
    imageHash?: string;
    /** Video-ad inputs — choose ONE: videoUrl (Meta downloads it) OR
     *  videoId (pre-uploaded via /meta/upload-video). When using a video
     *  the backend also needs a thumbnail; if you don't pass thumbnailUrl
     *  it falls back to Meta's auto-generated poster. */
    videoUrl?: string;
    videoId?: string;
    thumbnailUrl?: string;
    /** Carousel cards (2-10). Each card has its own image (URL or hash)
     *  plus optional headline / description / link. The ad-level message
     *  + callToAction are shared across all cards. */
    cards?: Array<{
      imageHash?: string;
      imageUrl?: string;
      headline?: string;
      description?: string;
      link?: string;
    }>;
    /** Library reference — one of our Creative rows, image / video /
     *  carousel. The backend reads the row's type to pick the right asset
     *  path. */
    libraryCreativeId?: string;
  };
}

export interface PublishCampaignResult {
  success: boolean;
  campaign: Campaign;
  meta: {
    campaignId: string;
    adSetId: string;
    creativeId: string;
    adId: string;
  };
}
