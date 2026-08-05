"use client";

import { useMemo } from "react";
import { useAuth } from "@clerk/nextjs";

/**
 * An error from our API that preserves the server's diagnostic fields.
 *
 * A plain `Error` keeps only the friendly message, which for Meta failures is
 * a *guess at the cause* for several error codes. `detail` carries Meta's
 * verbatim response and `step` names which of the five publish calls failed —
 * without them, a wrong guess is indistinguishable from a right one and the
 * only way to diagnose is to read server logs.
 */
export class ApiError extends Error {
  readonly status: number;
  /** Verbatim upstream detail, e.g. "Meta code 3: (#3) Application does not…". */
  readonly detail?: string;
  /** Which server-side step failed, e.g. "create ad set". */
  readonly step?: string;

  constructor(
    message: string,
    opts: { status: number; detail?: string; step?: string }
  ) {
    super(message);
    this.name = "ApiError";
    this.status = opts.status;
    this.detail = opts.detail;
    this.step = opts.step;
  }
}

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
  /** Platform minimum daily budget in the account currency (e.g. 1.00).
   *  Null until first sync. Grounds budget recommendations without FX. */
  minDailyBudget?: number | null;
  /** Meta account_status (1 = active). Null until first sync. */
  accountStatus?: number | null;
  isActive: boolean;
  createdAt: string;
}

/** One item in the Meta health report — a connection/account check result. */
export interface HealthCheck {
  status: "ok" | "warning" | "error";
  code: string;
  title: string;
  message: string;
  action: string;
  actionUrl?: string;
  blocking: boolean;
}

/** Full Meta connection health report (post-OAuth + on demand). */
export interface MetaHealthReport {
  overall: "healthy" | "degraded" | "blocked";
  checks: HealthCheck[];
  canSync: boolean;
  canPublish: boolean;
  readyForBeta: boolean;
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
  /** Range-level unique reach (last 30d) from Meta. NOT summed from daily
   *  metrics (reach is de-duplicated) — matches the figure Ads Manager shows. */
  reach?: number;
  createdAt: string;
  updatedAt: string;
  adAccount?: {
    platform: Platform;
    accountName: string;
    /** The PLATFORM's account id (Meta's numeric id, no `act_` prefix) — not
     *  our internal `adAccountId` cuid. Deep links into Ads Manager need this
     *  one. */
    accountId?: string;
    currency?: string | null;
    timezone?: string | null;
    minDailyBudget?: number | null;
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

/* ───────────────────────────── */
/* Audiences (saved targeting)    */
/* ───────────────────────────── */

export type AudienceType =
  | "LOOKALIKE"
  | "INTEREST"
  | "RETARGETING"
  | "CUSTOM"
  | "BEHAVIORAL"
  | "SAVED";

export interface Audience {
  id: string;
  workspaceId: string;
  name: string;
  description: string | null;
  type: AudienceType;
  platforms: Platform[];
  /** The Meta targeting spec — same shape the publish wizard sends. */
  targeting: MetaTargetingSpec;
  aiGenerated: boolean;
  /** Best-effort approx size (null when unknown). Real reach range later. */
  approxSize: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface AudiencesResponse {
  audiences: Audience[];
  total: number;
  page: number;
  totalPages: number;
}

export interface CreateAudienceInput {
  name: string;
  description?: string | null;
  type?: AudienceType;
  platforms?: Platform[];
  targeting: MetaTargetingSpec;
  aiGenerated?: boolean;
  approxSize?: number | null;
}

/* ───────────────────────────── */
/* AI Insights                    */
/* ───────────────────────────── */

export interface Insight {
  id: string;
  type: "OPPORTUNITY" | "WARNING" | "OPTIMIZATION" | "ALERT";
  status: "ACTIVE" | "APPLIED" | "DISMISSED" | "EXPIRED";
  title: string;
  message: string;
  impact?: string | null;
  impactType?: string | null;
  affectedCampaigns?: string[] | null;
  platform?: string | null;
  priority: number;
  confidence: "HIGH" | "MEDIUM" | "LOW";
  createdAt: string;
  appliedAt?: string | null;
  dismissedAt?: string | null;
}

export interface InsightsResponse {
  insights: Insight[];
  lastGeneratedAt: string | null;
  total: number;
  /** Present on POST /insights/generate — false when the 1-hour gate held. */
  generated?: boolean;
}

/* ───────────────────────────── */
/* Budget optimizer               */
/* ───────────────────────────── */

export interface BudgetRecommendationItem {
  campaignId: string;
  campaignName: string;
  platform: string;
  currentBudget: number;
  recommendedBudget: number;
  budgetChange: number;
  budgetChangePercent: number;
  action: "INCREASE" | "DECREASE" | "PAUSE" | "MAINTAIN";
  reason: string;
  expectedImpact: string;
  confidence: "HIGH" | "MEDIUM" | "LOW";
  priority: number;
}

export interface OptimizationAnalysis {
  /** True + non-actionable when there isn't enough revenue data to optimize. */
  insufficientData?: boolean;
  /** Saved recommendation id (absent when insufficientData). */
  recommendationId?: string;
  currency: string;
  summary: string;
  totalCurrentBudget: number;
  totalRecommendedBudget: number;
  estimatedRoasImprovement: number;
  estimatedRevenueIncrease: number;
  topOpportunity: string;
  biggestRisk: string;
  insights: string[];
  recommendations: BudgetRecommendationItem[];
}

export type BudgetRecommendationStatus =
  | "PENDING"
  | "APPLIED"
  | "PARTIAL"
  | "DISMISSED";

export interface BudgetRecommendationRow {
  id: string;
  workspaceId: string;
  status: BudgetRecommendationStatus;
  totalBudget: string | number;
  currency: string;
  analysisData: unknown;
  recommendations: BudgetRecommendationItem[];
  appliedAt: string | null;
  dismissedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

/** Response from POST /ai/generate-audience — AI proposal with names already
 *  resolved to real Meta IDs, ready to render as editable chips. */
export interface GeneratedAudience {
  name: string;
  type: AudienceType;
  description: string;
  targeting: MetaTargetingSpec;
  resolved: {
    interests: Array<{ id: string; name: string }>;
    countries: MetaGeoLocation[];
    cities: MetaGeoLocation[];
  };
  approxSize: number | null;
}

/* ───────────────────────────── */
/* AI Campaign Planner            */
/* ───────────────────────────── */

/** One turn of the planner conversation. */
export interface PlannerTurn {
  role: "user" | "assistant";
  content: string;
}

/** Real account facts the planner grounded its numbers in. Shown in the UI so
 *  the user can see the advice is about THEIR account, not a generic one. */
export interface PlannerContext {
  currency: string | null;
  minDailyBudget: number | null;
  connectedPlatforms: string[];
  hasPixel?: boolean;
}

export interface PlanScenario {
  label: string;
  detail: string;
  metric: string;
}

export interface PlanMistake {
  title: string;
  detail: string;
  fix: string;
}

export interface CampaignPlan {
  strategy: {
    platform: string[];
    objective: string;
    duration_days: number;
    daily_budget?: number;
    total_budget: number;
    currency: string;
    summary: string;
  };
  budget_recommendation?: {
    amount: number;
    period: string;
    rationale: string;
  };
  budget_allocation: Array<{
    channel: string;
    percentage: number;
    amount: number;
    rationale: string;
  }>;
  target_audience: {
    age_range: string;
    genders: string[];
    interests: string[];
    locations: string[];
    behaviors: string[];
    estimated_reach: string;
    persona?: string;
  };
  ad_formats: Array<{
    format: string;
    count: number;
    placement: string;
    rationale: string;
  }>;
  expected_results: {
    primary_metric: string;
    estimated_min: number;
    estimated_max: number;
    estimated_reach_min: number;
    estimated_reach_max: number;
    estimated_cpl_min: number;
    estimated_cpl_max: number;
    confidence: "low" | "medium" | "high";
  };
  realistic_expectations?: {
    assumption: string;
    best_case: PlanScenario;
    realistic_case: PlanScenario;
    worst_case: PlanScenario;
  };
  common_mistakes?: PlanMistake[];
  next_steps?: {
    first_24h: string[];
    first_48h: string[];
    first_7d: string[];
  };
  ai_insights: string[];
  recommended_campaign_name: string;
}

/** Discriminated union — Alex either asks for more detail or produces a plan. */
export type PlannerResponse =
  | {
      mode: "clarify";
      reply: string;
      questions: string[];
      context: PlannerContext;
    }
  | {
      mode: "plan";
      reply: string;
      plan: CampaignPlan;
      context: PlannerContext;
    };

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
        throw new ApiError(err.error ?? `HTTP ${res.status}`, {
          status: res.status,
          detail: typeof err.detail === "string" ? err.detail : undefined,
          step: typeof err.step === "string" ? err.step : undefined,
        });
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

    /* Audiences — saved targeting templates (our DB) */
    getAudiences: (params?: Record<string, string | number | undefined>) =>
      apiFetch<AudiencesResponse>(`/audiences${buildQuery(params)}`),
    createAudience: (data: CreateAudienceInput) =>
      apiFetch<Audience>("/audiences", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    updateAudience: (id: string, data: Partial<CreateAudienceInput>) =>
      apiFetch<Audience>(`/audiences/${id}`, {
        method: "PUT",
        body: JSON.stringify(data),
      }),
    deleteAudience: (id: string) =>
      apiFetch<SuccessResponse>(`/audiences/${id}`, { method: "DELETE" }),
    duplicateAudience: (id: string) =>
      apiFetch<Audience>(`/audiences/${id}/duplicate`, { method: "POST" }),
    /** AI-build: plain-English description → resolved, editable targeting. */
    generateAudienceTargeting: (description: string) =>
      apiFetch<GeneratedAudience>("/ai/generate-audience", {
        method: "POST",
        body: JSON.stringify({ description }),
      }),

    /* Budget optimizer (DB-only planning in v1; no auto-mode) */
    analyzeBudget: () =>
      apiFetch<OptimizationAnalysis>("/budget-optimizer/analyze", {
        method: "POST",
      }),
    applyBudgetRecommendations: (
      recommendationId: string,
      campaignIds?: string[]
    ) =>
      apiFetch<{ applied: number; skipped: number }>(
        "/budget-optimizer/apply",
        {
          method: "POST",
          body: JSON.stringify({ recommendationId, campaignIds }),
        }
      ),
    dismissBudgetRecommendation: (recommendationId: string) =>
      apiFetch<BudgetRecommendationRow>("/budget-optimizer/dismiss", {
        method: "POST",
        body: JSON.stringify({ recommendationId }),
      }),
    getBudgetHistory: () =>
      apiFetch<BudgetRecommendationRow[]>("/budget-optimizer/history"),
    getLatestRecommendation: () =>
      apiFetch<BudgetRecommendationRow | null>("/budget-optimizer/latest"),

    /* AI Insights */
    getInsights: () => apiFetch<InsightsResponse>("/insights"),
    generateInsights: () =>
      apiFetch<InsightsResponse>("/insights/generate", { method: "POST" }),
    dismissInsight: (id: string) =>
      apiFetch<Insight>(`/insights/${id}/dismiss`, { method: "POST" }),
    applyInsight: (id: string) =>
      apiFetch<Insight>(`/insights/${id}/apply`, { method: "POST" }),
    restoreInsight: (id: string) =>
      apiFetch<Insight>(`/insights/${id}/restore`, { method: "POST" }),
    getDismissedInsights: () =>
      apiFetch<{ insights: Insight[] }>("/insights/dismissed"),

    /* ───────────────────────────────── */
    /* Phase 1A — Meta publish wizard    */
    /* ───────────────────────────────── */
    getMetaPages: () => apiFetch<MetaPage[]>("/meta/pages"),
    /** Full Meta connection health report (cached 5 min on the server). */
    getMetaHealth: (adAccountId: string) =>
      apiFetch<MetaHealthReport>(`/meta/health/${adAccountId}`),
    /** Force a fresh Meta health report (bypass the server cache). */
    refreshMetaHealth: (adAccountId: string) =>
      apiFetch<MetaHealthReport>(`/meta/health/${adAccountId}/refresh`, {
        method: "POST",
      }),
    /** Re-sync all active Meta ad accounts in the workspace (the "Sync now"
     *  button). Imports new campaigns + refreshes metrics/reach. */
    syncMeta: () =>
      apiFetch<{
        success: boolean;
        accounts: number;
        campaignsSynced: number;
        metricsSynced: number;
        /** Per-account failures. Present (possibly empty) on partial success —
         *  one bad account no longer aborts the whole run. */
        errors?: Array<{ accountName: string; message: string }>;
      }>("/meta/sync", { method: "POST" }),
    /** Meta Pixels on the connected ad account. Empty = conversion objectives
     *  (Sales / Leads) can't be published yet. */
    getMetaPixels: () => apiFetch<MetaPixel[]>("/meta/pixels"),
    /**
     * Talk to Alex, the AI media buyer. Send the WHOLE transcript every turn —
     * that's what lets the reply reference what the user said earlier.
     */
    planCampaign: (messages: PlannerTurn[]) =>
      apiFetch<PlannerResponse>("/ai/plan-campaign", {
        method: "POST",
        body: JSON.stringify({ messages }),
      }),
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
    generateAdImage: async (params: {
      brief?: string;
      headline?: string;
      description?: string;
      /** Aspect ratio hint that selects the OpenAI image `size`. Defaults
       *  to square (1:1 Feed) when omitted. */
      aspect?: "square" | "portrait" | "landscape";
      /** Optional reference product image. When present, generation routes
       *  to OpenAI's /images/edits (image-guided) instead of text-to-image,
       *  and we must send multipart FormData (apiFetch is JSON-only). */
      image?: File | null;
    }): Promise<{ url: string; hash: string; dataUrl: string }> => {
      // `dataUrl` is a base64 data URI for browser preview; `url`/`hash`
      // are the Meta /adimages handles used at publish time.
      if (params.image) {
        // Multipart path — mirror uploadMetaImage: Authorization header
        // only, never set Content-Type (the browser fills the boundary).
        const token = await getToken();
        const form = new FormData();
        if (params.brief) form.append("brief", params.brief);
        if (params.headline) form.append("headline", params.headline);
        if (params.description) form.append("description", params.description);
        if (params.aspect) form.append("aspect", params.aspect);
        form.append("image", params.image);
        const res = await fetch(`${API_BASE}/api/ai/generate-image`, {
          method: "POST",
          headers: {
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: form,
        });
        if (!res.ok) {
          const err = await res
            .json()
            .catch(() => ({ error: `Image generation failed (${res.status})` }));
          throw new Error(err.error ?? `HTTP ${res.status}`);
        }
        return res.json();
      }
      const { image: _omit, ...jsonParams } = params;
      return apiFetch<{ url: string; hash: string; dataUrl: string }>(
        "/ai/generate-image",
        {
          method: "POST",
          body: JSON.stringify(jsonParams),
        }
      );
    },
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

export interface MetaPixel {
  id: string;
  name: string;
  /** Null = the pixel exists but has never received an event, i.e. it isn't
   *  installed on the site yet. */
  lastFiredTime: string | null;
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
  /** Advantage+ audience opt-in. Meta requires an explicit 1 or 0 on every ad
   *  set. Leave unset — the API defaults it to 0 (deliver strictly inside the
   *  targeting above) so the wizard's audience step means what it says. */
  targeting_automation?: { advantage_audience?: 0 | 1 };
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
