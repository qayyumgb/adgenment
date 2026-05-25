"use client";

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
  startDate: string | null;
  endDate: string | null;
  targeting: unknown;
  createdAt: string;
  updatedAt: string;
  adAccount?: { platform: Platform; accountName: string };
  _count?: { metrics: number };
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
      apiFetch<CampaignsResponse>(`/campaigns${buildQuery(params)}`),
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
      industry: string;
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
  };
}
