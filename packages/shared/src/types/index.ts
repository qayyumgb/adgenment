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

export type AiSessionType =
  | "CAMPAIGN_PLANNER"
  | "CREATIVE_GEN"
  | "AUDIENCE_BUILDER"
  | "BUDGET_OPTIMIZER"
  | "REPORT";

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

export interface WorkspaceMember {
  id: string;
  workspaceId: string;
  userId: string;
  role: WorkspaceRole;
}

export interface AdAccount {
  id: string;
  workspaceId: string;
  platform: Platform;
  accountId: string;
  accountName: string;
  accessToken: string;
  refreshToken: string | null;
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
  budget: number;
  budgetType: BudgetType;
  startDate: string | null;
  endDate: string | null;
  targeting: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
}

export interface CampaignMetrics {
  id: string;
  campaignId: string;
  date: string;
  impressions: number;
  clicks: number;
  spend: number;
  conversions: number;
  revenue: number;
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
  content: Record<string, unknown>;
  status: CreativeStatus;
  aiGenerated: boolean;
  createdAt: string;
}

export interface AiSession {
  id: string;
  workspaceId: string;
  userId: string;
  type: AiSessionType;
  prompt: string;
  response: string;
  tokensUsed: number;
  createdAt: string;
}

export interface ApiError {
  error: {
    message: string;
    stack?: string;
  };
}
