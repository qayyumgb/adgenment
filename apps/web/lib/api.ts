"use client";

import { useMemo } from "react";
import { useAuth } from "@clerk/nextjs";
import toast from "react-hot-toast";

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

/* ── Approvals (C1) ─────────────────────────────────────────────── */

export type ApprovalStatus = "PENDING" | "APPROVED" | "REJECTED" | "FAILED" | "CANCELLED";
export type ApprovalTimeout = "KEEP" | "APPROVE" | "REJECT";
export interface Approval {
  id: string;
  status: ApprovalStatus;
  summary: string;
  reason: string;
  campaignId: string | null;
  campaignName: string;
  clientId: string | null;
  clientName: string | null;
  requestedById: string;
  requestedBy: string | null;
  decidedBy: string | null;
  decidedAt: string | null;
  /** "manual" | "timeout" */
  decidedVia: string | null;
  note: string | null;
  error: string | null;
  createdAt: string;
}
export interface ApprovalSummary {
  pending: number;
  overdue: number;
  oldestAt: string | null;
  timeout: ApprovalTimeout;
  /** True for owners: the waiting ones are theirs to decide. */
  decides: boolean;
}
export interface ApprovalSettings {
  budgetPct: number | null;
  timeout: ApprovalTimeout;
  clients: { id: string; name: string; askFirst: boolean; isDefault: boolean }[];
}
/** C13 auto-apply, C14 safety rules and the workspace's automation switches. */
export interface SafetySettings {
  maxCutPct: number;
  autoApplyMaxPct: number;
  automationPaused: boolean;
  clients: { id: string; name: string; pixel: boolean; cap: boolean; autoApply: boolean; askFirst: boolean; hasMonthlyBudget: boolean }[];
}

/* Flight calendar (C5) */
export type FlightPhase = "live" | "scheduled" | "paused" | "draft" | "ended";
export interface Flight {
  id: string;
  name: string;
  platform: Platform;
  status: CampaignStatus;
  phase: FlightPhase;
  objective: string;
  budget: number;
  budgetType: "DAILY" | "LIFETIME";
  currency: string;
  clientId: string | null;
  adAccountId: string;
  adAccountName: string;
  start: string;
  /** Null = runs until it's stopped. */
  end: string | null;
  startEstimated: boolean;
  endEstimated: boolean;
  audienceId: string | null;
}
export interface FlightOverlap {
  clientId: string | null;
  platform: Platform;
  objective: string;
  adAccountName: string;
  campaignIds: string[];
  from: string;
  to: string | null;
  sameAudience: boolean;
}
export interface KeyDate {
  date: string;
  name: string;
  group: "retail" | "seasonal" | "cultural";
  approx?: boolean;
  peak?: boolean;
}
export interface FlightCalendar {
  from: string;
  to: string;
  now: string;
  clients: { id: string; name: string }[];
  flights: Flight[];
  overlaps: FlightOverlap[];
  peakLaunches: { campaignId: string; keyDate: string; from: string; to: string }[];
  keyDates: KeyDate[];
  undatedDrafts: number;
  truncated: boolean;
}

/* Alerts inbox (C2) */
export type AlertSeverity = "CRITICAL" | "WARNING" | "INFO";
export type AlertAction =
  | { type: "link"; label: string; href: string }
  | { type: "sync"; label: string; adAccountId: string }
  | { type: "pause"; label: string; campaignId: string }
  | { type: "undo"; label: string; changeId: string };
export interface AppAlert {
  id: string;
  /** ACCESS | ACCOUNT | SYNC_FAILED | PACING | CPA_SPIKE | TRACKING | AUTOMATION */
  kind: string;
  severity: AlertSeverity;
  title: string;
  detail: string;
  groupLabel: string;
  clientId: string | null;
  campaignId: string | null;
  adAccountId: string | null;
  actions: AlertAction[];
  firstSeenAt: string;
  resolvedAt: string | null;
  dismissedAt: string | null;
  unread: boolean;
}
export interface AlertSummary {
  open: number;
  unread: number;
  critical: number;
}

/* Client portal (C4) */
export interface ClientShare {
  id: string;
  clientId: string;
  url: string;
  showSpend: boolean;
  showRevenue: boolean;
  showCampaigns: boolean;
  createdAt: string;
  expiresAt: string | null;
  lastViewedAt: string | null;
  viewCount: number;
}
/** Numbers a portal link shows; spend / revenue fields are absent when the link hides them. */
export interface PortalKpis {
  impressions: number;
  clicks: number;
  ctr: number | null;
  conversions: number;
  spend?: number;
  cpa?: number | null;
  revenue?: number;
  roas?: number | null;
}
/* Scheduled client reports (C4b) */
export type ReportFrequency = "WEEKLY" | "MONTHLY";
export interface ReportScheduleInput {
  clientId: string;
  frequency: ReportFrequency;
  recipients: string[];
  showSpend: boolean;
  showRevenue: boolean;
  showCampaigns: boolean;
  attachPdf: boolean;
  active: boolean;
}
export interface ReportScheduleInfo {
  schedule: (Omit<ReportScheduleInput, "clientId"> & { id: string; lastSentAt: string | null; lastError: string | null; nextDate: string | null }) | null;
  hasShareLink: boolean;
  timezone: string;
  /** 0 = Sunday, 1 = Monday. */
  weekStartsOn: number;
  emailConfigured: boolean;
}
/* Getting-started checklist (C11) */
export type SetupStepId = "connect" | "clients" | "budget" | "ai" | "team" | "share" | "briefing";
export interface SetupChecklist {
  /** The client the steps are for (null = the whole workspace). */
  client: { id: string; name: string } | null;
  steps: { id: SetupStepId; title: string; body: string; done: boolean; skipped: boolean; optional: boolean; href: string; cta: string }[];
  complete: number;
  total: number;
  /** All clients (agencies): each client's own progress. */
  clients: { id: string; name: string; complete: number; total: number }[];
  dismissed: boolean;
  /** Keep the sidebar link (until hidden from the page). */
  show: boolean;
  /** Every step done or skipped. */
  done: boolean;
}
export interface PortalReport {
  agency: string;
  client: string;
  currency: string | null;
  days: 7 | 30 | 90;
  from: string;
  to: string;
  shows: { spend: boolean; revenue: boolean; campaigns: boolean };
  kpis: PortalKpis;
  previous: PortalKpis;
  series: { date: string; conversions: number; clicks: number; spend?: number; revenue?: number }[];
  campaigns: (PortalKpis & { name: string; platform: string; status: string })[] | null;
  pacing: { month: string; monthlyBudget: number; spent: number; projected: number; status: string } | null;
  updatedAt: string | null;
}

/** The message a held change fails with; the API client already showed a notice for it. */
export const APPROVAL_PENDING_MESSAGE = "Sent to an owner for approval.";
/** Fired when approvals change (one was requested here); badges refetch. */
export const APPROVALS_CHANGED_EVENT = "advertix:approvals-changed";

/** A Media buyer's change is waiting for an owner instead of being applied (HTTP 202). */
export class ApprovalPendingError extends ApiError {
  constructor(readonly approval: Approval) {
    super(APPROVAL_PENDING_MESSAGE, { status: 202 });
    this.name = "ApprovalPendingError";
  }
}

/* AI credits (C11) */
export interface CreditStatus {
  plan: PlanType;
  used: number;
  /** null = unlimited. */
  limit: number | null;
  remaining: number | null;
  share: number | null;
  warn: boolean;
  exhausted: boolean;
  periodStart: string;
  resetsAt: string;
  byFeature: { feature: string; label: string; credits: number }[];
  enforced: boolean;
  /** TRIAL credits cover the whole trial (they don't reset monthly). */
  billingState?: "TRIAL" | "ACTIVE" | "PAST_DUE" | "EXPIRED";
}
/** The message an out-of-credits call fails with; the upgrade dialog already explains it. */
export const CREDITS_EXHAUSTED_MESSAGE = "Out of AI credits.";
/** Fired with `{ detail: { message, credits } }` when an AI action is refused for credits. */
export const CREDITS_EXHAUSTED_EVENT = "advertix:credits-exhausted";
/** Fired after an AI action succeeds; the credit meter refetches. */
export const CREDITS_CHANGED_EVENT = "advertix:credits-changed";
const AI_ACTION = /^\/(ai\/(?!planner\/context|health)|insights\/generate|suggestions\/refresh|budget-optimizer\/analyze)/;

export class CreditsExhaustedError extends ApiError {
  constructor(readonly reason: string) {
    super(CREDITS_EXHAUSTED_MESSAGE, { status: 402 });
    this.name = "CreditsExhaustedError";
  }
}

/** 402 out of credits → open the upgrade dialog and fail the call quietly. */
function throwIfOutOfCredits(status: number, body: { code?: string; error?: string; credits?: unknown } | null) {
  if (status !== 402 || body?.code !== "CREDITS_EXHAUSTED") return;
  window.dispatchEvent(new CustomEvent(CREDITS_EXHAUSTED_EVENT, { detail: { message: body.error, credits: body.credits } }));
  throw new CreditsExhaustedError(body.error ?? CREDITS_EXHAUSTED_MESSAGE);
}

// Callers show `err.message` with toast.error; the API client already showed
// a calmer notice for a held change (or the out-of-credits dialog), so don't
// stack a red error on top of it.
if (typeof window !== "undefined" && !(toast.error as { __approvals?: boolean }).__approvals) {
  const original = toast.error;
  const patched = ((message: Parameters<typeof toast.error>[0], opts?: Parameters<typeof toast.error>[1]) =>
    message === APPROVAL_PENDING_MESSAGE || message === CREDITS_EXHAUSTED_MESSAGE ? "" : original(message, opts)) as typeof toast.error & { __approvals?: boolean };
  patched.__approvals = true;
  toast.error = patched;
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

/** FREE = no paid plan (on the trial, or it ended); STARTER = Team, PRO = Agency. */
export type PlanType = "FREE" | "FOUNDER" | "STARTER" | "PRO" | "ENTERPRISE";

/* Billing (C11) */
export type PaidTier = "FOUNDER" | "TEAM" | "AGENCY";
export type BillingInterval = "month" | "year";
export interface BillingStatus {
  /** Billing works on this server (STRIPE_SECRET_KEY). */
  configured: boolean;
  state: "TRIAL" | "ACTIVE" | "PAST_DUE" | "EXPIRED";
  tier: PaidTier | "ENTERPRISE" | null;
  interval: BillingInterval | null;
  trialEndsAt: string | null;
  trialDaysLeft: number;
  renewsAt: string | null;
  cancelAtPeriodEnd: boolean;
  hasCustomer: boolean;
  limits: { clients: number | null; seats: number | null; credits: number | null };
}
/** Team roles (B6). The API reads legacy ADMIN / EDITOR / VIEWER rows as MEDIA_BUYER / ANALYST. */
export type WorkspaceRole = "OWNER" | "MEDIA_BUYER" | "ANALYST" | "CLIENT_VIEWER";
export type Capability = "view" | "export" | "edit" | "connect" | "clients" | "team" | "workspace";
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
  website?: string | null;
  /** IANA time zone; null = UTC. */
  timezone?: string | null;
  /** 1 = Monday, 0 = Sunday. */
  weekStartsOn?: number;
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
  /** Last successful platform sync. Null = never. */
  lastSyncedAt?: string | null;
  /** Agency client this account belongs to. Null = not assigned. */
  clientId?: string | null;
  /** When the user has to reconnect (Meta ≈ 60 days, LinkedIn ≈ 1 year). Null = no known expiry. */
  tokenExpiresAt?: string | null;
  /** Summary of the last stored health check. Null when none has run. */
  health?: AdAccountHealth | null;
  /** Spend over the last 30 days, in the account's currency. */
  spend30d?: number;
}

export interface AdAccountHealth {
  overall: "healthy" | "degraded" | "blocked";
  issues: number;
  topIssue: string | null;
  checkedAt: string | null;
}

/* ── Agency clients (docs/DASHBOARD_REDESIGN_PLAN.md, B1) ── */

export interface Client {
  id: string;
  name: string;
  /** 1–3 letter avatar mark. */
  short: string;
  vertical: string | null;
  logoUrl: string | null;
  monthlyBudget: number | null;
  currency: string | null;
  /** Auto-created client for single-brand workspaces. */
  isDefault: boolean;
  adAccountCount: number;
  platforms: Platform[];
  campaignCount: number;
  createdAt: string;
}

export interface ClientsResponse {
  clients: Client[];
  unassignedAdAccounts: number;
}

export interface ClientInput {
  name?: string;
  short?: string | null;
  vertical?: string | null;
  logoUrl?: string | null;
  monthlyBudget?: number | null;
  currency?: string | null;
}

export type PacingStatus = "ON_TRACK" | "AHEAD" | "BEHIND" | "NO_BUDGET" | "NO_SPEND";

export interface ClientPacing {
  clientId: string;
  name: string;
  short: string;
  monthlyBudget: number | null;
  currency: string | null;
  /** The client's accounts use more than one currency (spend is a raw sum). */
  mixedCurrency: boolean;
  spent: number;
  spentPct: number | null;
  projected: number;
  projectedPct: number | null;
  status: PacingStatus;
  /** Day of month the budget runs out at the current rate (AHEAD only). */
  runOutDay: number | null;
  /** Budget projected to go unspent (BEHIND only). */
  unspentProjected: number | null;
  platforms: Platform[];
}

export interface PacingResponse {
  /** YYYY-MM */
  month: string;
  daysInMonth: number;
  dayOfMonth: number;
  /** Share of the month elapsed, in % (the "today" marker). */
  expectedPct: number;
  clients: ClientPacing[];
}

/** One platform in the Budgets allocator (A11). */
export interface AllocatorPlatform {
  platform: Platform;
  name: string;
  /** Sum of the platform's active daily-budget campaigns. */
  currentDaily: number;
  /** value(b) = A · (1 − e^(−b/k)); null when it couldn't be fitted. */
  curve: { A: number; k: number } | null;
  fit: { r2: number; points: number; observedMax: number } | null;
  noCurveReason: string | null;
  /** Safe range for this platform's daily total (fixed when there's no curve). */
  bounds: { min: number; max: number };
  avgDaily: { spend: number; value: number };
  /** Meta changes go to the platform; the others are read-only syncs. */
  writable: boolean;
  campaigns: { id: string; name: string; budget: number; blocker: string | null; minDailyBudget: number | null }[];
}

export interface AllocatorData {
  clients: { id: string; name: string }[];
  clientId: string | null;
  windowDays: number;
  currency: string | null;
  mixedCurrency: boolean;
  /** Revenue when recorded, otherwise conversions. */
  metric: "revenue" | "conversions";
  platforms: AllocatorPlatform[];
  month: { budget: number; spent: number; daysLeft: number; daysInMonth: number } | null;
}

export interface AllocationResult {
  results: { campaignId: string; name: string; platform: Platform; from: number; to: number; status: "applied" | "skipped" | "failed"; reason: string | null }[];
  applied: number;
  skipped: number;
  failed: number;
}

export interface ClientBreakdown {
  /** Null = ad accounts not assigned to a client. */
  clientId: string | null;
  name: string;
  short: string;
  spend: number;
  revenue: number;
  impressions: number;
  clicks: number;
  conversions: number;
  roas: number;
  ctr: number;
  cpa: number;
  platforms: Platform[];
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
    /** Client the campaign's ad account belongs to (B1). */
    clientId?: string | null;
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
  /** Meta learning phase from its ad sets (B4, /campaigns list): an active ad set still learning, or stuck ("learning limited"). */
  learning?: "LEARNING" | "LIMITED" | null;
}

/** Results of one ad or ad set over the requested period (B4). */
export interface StructureTotals {
  spend: number;
  impressions: number;
  clicks: number;
  conversions: number;
  revenue: number;
  landingPageViews: number;
  addToCart: number;
}

export interface CampaignAdSet {
  id: string;
  externalId: string;
  name: string;
  status: CampaignStatus;
  /** Meta delivery state, e.g. ACTIVE, CAMPAIGN_PAUSED, WITH_ISSUES. */
  effectiveStatus: string | null;
  dailyBudget: number | null;
  lifetimeBudget: number | null;
  optimizationGoal: string | null;
  /** LEARNING | SUCCESS | FAIL (learning limited) | null */
  learningStage: string | null;
  /** Plain targeting line, e.g. "Women 25–44 · US, CA · Skincare +2". */
  audience: string;
  reach30d: number;
  frequency30d: number;
  adCount: number;
  totals: StructureTotals;
  /** Its own on / off switch (it can be on while the campaign is off). */
  switchOn: boolean;
  /** Why the budget / status can't be changed from Advertix, or null. */
  budgetBlocker: string | null;
  statusBlocker: string | null;
}

export interface CampaignAd {
  id: string;
  adSetId: string;
  externalId: string;
  name: string;
  status: CampaignStatus;
  effectiveStatus: string | null;
  format: "IMAGE" | "VIDEO" | "CAROUSEL" | "UNKNOWN";
  imageUrl: string | null;
  headline: string | null;
  body: string | null;
  callToAction: string | null;
  linkUrl: string | null;
  reach30d: number;
  frequency30d: number;
  totals: StructureTotals;
  /** Frequency (30 days) + week-on-week CTR read. */
  fatigue: { level: "ok" | "watch" | "fatigued"; reason: string | null };
  /** Its own on / off switch (it can be on while its ad set or campaign is off). */
  switchOn: boolean;
  statusBlocker: string | null;
}

export interface CampaignStructure {
  platform: Platform;
  syncedAt: string | null;
  days: number;
  /** One budget for the whole campaign (campaign budget optimisation). */
  campaignBudget: boolean;
  adSets: CampaignAdSet[];
  ads: CampaignAd[];
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
  /** Owning client (B1); null = shared across clients. */
  clientId?: string | null;
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
  /** The saved audience the targeting came from (A9); null clears it. */
  audienceId?: string | null;
}

export interface CreateCreativeInput {
  name: string;
  type: CreativeType;
  content: unknown;
  campaignId?: string | null;
  aiGenerated?: boolean;
  status?: CreativeStatus;
  /** Owning client (B1); null / omitted = shared library item. */
  clientId?: string | null;
}

export type CreativeBoardStatus = "Live" | "Learning" | "Fatigued" | "Paused" | "In review" | "Rejected" | "Ended" | "Draft" | "Archived";

/** One card on the Creatives board (A8): a library creative or a synced Meta ad. */
export interface CreativeBoardItem {
  key: string;
  source: "library" | "meta";
  creativeId: string | null;
  adId: string | null;
  campaignId: string | null;
  campaignName: string | null;
  name: string;
  format: "IMAGE" | "VIDEO" | "CAROUSEL" | "TEXT" | "UNKNOWN";
  imageUrl: string | null;
  videoId: string | null;
  headline: string | null;
  body: string | null;
  callToAction: string | null;
  linkUrl: string | null;
  cardCount: number;
  status: CreativeBoardStatus;
  platform: Platform;
  clientId: string | null;
  currency: string | null;
  aiGenerated: boolean;
  createdAt: string;
  /** Library item with no image / video yet. */
  needsMedia: boolean;
  totals: StructureTotals;
  frequency: number;
  fatigue: { level: "ok" | "watch" | "fatigued"; reason: string | null };
  adCount: number;
  /** Meta ads only: its own on / off switch, and why it can't be changed. */
  switchOn: boolean | null;
  statusBlocker: string | null;
  /** Library items: the raw content (for the edit dialog). */
  content: unknown;
}

export interface CreativeBoard {
  days: number;
  items: CreativeBoardItem[];
  /** Best-returning item with copy: the studio builds on its hook. */
  bestHook: { key: string; name: string; text: string; roas: number; ctr: number | null } | null;
}

/** AI copy variants (POST /ai/generate-copy). Carousel requests return `cards` instead of headlines. */
export interface GeneratedCopy {
  headlines?: string[];
  primary_texts: string[];
  descriptions?: string[];
  ctas: string[];
  cards?: { headline: string; description?: string }[];
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
  /** Owning client (B1); null = shared across clients. */
  clientId?: string | null;
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
  /** Owning client (B1); null = shared. */
  clientId?: string | null;
}

export type AudienceBoardStatus = "Ready" | "Unused" | "Building" | "Learning limited" | "Underperforming";

/** One row on the Audiences board (A9): a saved audience or one on the client's Meta account. */
export interface AudienceBoardItem {
  key: string;
  source: "library" | "meta-custom" | "meta-saved";
  id: string;
  name: string;
  typeLabel: string;
  summary: string;
  description: string | null;
  sizeLower: number | null;
  sizeUpper: number | null;
  clientId: string | null;
  /** Meta items: the ad account (our id) it lives on. */
  adAccountId: string | null;
  aiGenerated: boolean;
  updatedAt: string | null;
  ready: boolean;
  /** Campaigns using it; null when Meta doesn't say (saved audiences on Meta). */
  usedIn: number | null;
  campaigns: { id: string; name: string }[];
  totals: StructureTotals;
  status: AudienceBoardStatus;
  /** Verified only: lookalike next to its seed, shared ad sets, near-duplicates. */
  warnings: { kind: "lookalike-seed" | "shared-ad-sets" | "duplicate"; text: string; campaignId: string | null }[];
  lookalikeOf: string[];
  canSeedLookalike: boolean;
  library: { type: AudienceType; targeting: MetaTargetingSpec } | null;
}

export interface AudienceBoardTip {
  key: string;
  kind: "warning" | "lookalike";
  title: string;
  detail: string;
  audienceKey: string;
  campaignId: string | null;
  seedId: string | null;
}

export interface AudienceBoard {
  days: number;
  metaAccounts: { id: string; name: string; clientId: string | null }[];
  /** Why Meta audiences couldn't be loaded (expired connection, rate limit…). */
  metaError: string | null;
  items: AudienceBoardItem[];
  tips: AudienceBoardTip[];
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

export type SuggestionStatus = "OPEN" | "APPLIED" | "SNOOZED" | "DISMISSED" | "EXPIRED";

/** Something Advertix suggests (B2). `executable` = Apply really runs on the platform and Undo reverts it. */
export interface Suggestion {
  id: string;
  /** Card tag: "Budget shift", "Opportunity", "Warning", … */
  kind: string;
  clientId: string | null;
  clientName: string | null;
  campaignId: string | null;
  campaignName: string | null;
  title: string;
  reason: string;
  impact: string | null;
  priority: number;
  confidence: string | null;
  executable: boolean;
  actionType: "SET_DAILY_BUDGET" | "SET_STATUS" | null;
  actionPayload: { campaignId: string; dailyBudget?: number; status?: "ACTIVE" | "PAUSED" } | null;
  /** "Raise budget" (or "Review" when not executable). */
  actionLabel: string;
  /** Past tense after Apply: "Budget raised". */
  doneLabel: string | null;
  reviewHref: string | null;
  status: SuggestionStatus;
  snoozedUntil: string | null;
  appliedAt: string | null;
  canUndo: boolean;
  createdAt: string;
}

export interface SuggestionsResponse {
  suggestions: Suggestion[];
  /** When Advertix last checked the accounts (insight generation). */
  lastCheckedAt: string | null;
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

/** One platform as the planner read it (A12): last 30 days for the client. */
export interface PlannerPlatform {
  platform: Platform;
  name: string;
  minDailyBudget: number | null;
  currentDaily: number;
  spend: number;
  value: number;
  /** ROAS (revenue) or cost per result (conversions). */
  ratio: number | null;
  daysWithSpend: number;
}

export interface PlannerStarter {
  clientId: string;
  clientName: string;
  short: string;
  title: string;
  meta: string;
  brief: string;
  /** False = a fill-in brief: put it in the composer instead of sending. */
  send: boolean;
}

/** GET /ai/planner/context: what Advertix reads before planning. */
export interface PlannerContextData {
  clients: { id: string; name: string; short: string }[];
  client: { id: string; name: string; short: string } | null;
  currency: string | null;
  mixedCurrency: boolean;
  metric: "revenue" | "conversions";
  hasPixel: boolean | null;
  platforms: PlannerPlatform[];
  totals: { campaigns: number; spend: number; value: number };
  fatigued: { ad: string; campaign: string; reason: string }[];
  shared: { audience: string; campaigns: string[] }[];
  month: { name: string; budget: number; spent: number; daysLeft: number } | null;
  steps: PlannerSteps;
  starters: PlannerStarter[];
}

/** What each reasoning step found, in words. */
export interface PlannerSteps {
  performance: string;
  compare: string;
  checks: string;
}

export type PlanGoal = "Traffic" | "Lead Generation" | "Conversions" | "Awareness" | "Video Views";

export interface PlanCampaign {
  platform: Platform;
  name: string;
  objective: PlanGoal;
  audience: string;
  ageMin: number;
  ageMax: number;
  genders: "all" | "men" | "women";
  countries: string[];
  interests: string[];
  share: number;
  startDay: number;
  endDay: number;
  needs: string[];
  rationale: string;
  buildsOn: string;
  start: string;
  end: string;
  total: number;
  daily: number;
  blocker: string | null;
  warning: string | null;
  expected: { ratio: number; basis: "curve" | "average" } | null;
}

/** A plan (v2): the model's draft plus budgets and a forecast computed from the client's history. */
export interface AiPlan {
  version: 2;
  clientId: string | null;
  clientName: string;
  currency: string | null;
  metric: "revenue" | "conversions";
  title: string;
  budget: number;
  days: number;
  start: string;
  end: string;
  target: { metric: "roas" | "cpa" | "none"; value: number };
  phases: { name: string; startDay: number; endDay: number; start: string; end: string }[];
  campaigns: PlanCampaign[];
  forecast: {
    value: number;
    low: number | null;
    high: number | null;
    ratio: number;
    covered: number;
    uncovered: { budget: number; platforms: string[] };
    basis: string;
  } | null;
  forecastNote: string | null;
  meetsTarget: boolean | null;
  watchOuts: string[];
  assumptions: string[];
  checks: { first24h: string[]; first48h: string[]; first7d: string[] };
  /** The model's draft; sent back on follow-ups. */
  input: Record<string, unknown>;
}

export type PlannerResponse =
  | { mode: "clarify"; reply: string; questions: string[]; suggestions: string[]; steps: PlannerSteps }
  | { mode: "plan"; reply: string; plan: AiPlan; steps: PlannerSteps };

/** POST /plans/:id/drafts */
export interface PlanDraftsResult {
  created: { id: string; name: string; platform: Platform }[];
  skipped: { name: string; platform: string; reason: string }[];
}

/** Connections (A13): one account's state, most urgent first. */
export type ConnectionStatus = "CHECKING" | "HEALTHY" | "TOKEN_EXPIRING" | "TOKEN_EXPIRED" | "PIXEL_ISSUE" | "BLOCKED" | "UNASSIGNED" | "INACTIVE" | "ARCHIVED";

export interface ConnectionAccount {
  id: string;
  platform: Platform;
  accountId: string;
  accountName: string;
  currency: string | null;
  timezone: string | null;
  minDailyBudget: number | null;
  isActive: boolean;
  archivedAt: string | null;
  createdAt: string;
  lastSyncedAt: string | null;
  clientId: string | null;
  clientName: string | null;
  tokenExpiresAt: string | null;
  lastHealthCheck: string | null;
  campaigns: number;
  spend30d: number;
  status: ConnectionStatus;
  statusDetail: string | null;
  health: "healthy" | "degraded" | "blocked" | null;
}

export interface ConnectionPlatform {
  platform: Platform;
  name: string;
  api: string;
  available: boolean;
  accounts: number;
  /** Null when the accounts use different currencies. */
  spend30d: number | null;
  currency: string | null;
  status: "CONNECTED" | "ATTENTION" | "NOT_CONNECTED" | "COMING_SOON";
  lastSyncedAt: string | null;
  autoSync: boolean;
}

export interface ConnectionsData {
  platforms: ConnectionPlatform[];
  accounts: ConnectionAccount[];
  hasClients: boolean;
  syncIntervalHours: number;
}

/** Accounts an OAuth connect found that aren't in Advertix yet. */
export interface PendingConnectionData {
  id: string;
  platform: Platform;
  accounts: { accountId: string; accountName: string; currency: string | null; timezone: string | null; isActive: boolean }[];
  expiresAt: string;
}

export interface ConnectionSyncResult {
  synced: number;
  failed: number;
  results: { id: string; accountName: string; platform: Platform; ok: boolean; campaigns: number; error: string | null }[];
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
  slug?: string | null;
  industry?: string | null;
  companySize?: string | null;
  website?: string | null;
  timezone?: string | null;
  weekStartsOn?: number;
}

/** GET /workspace/billing (A14): the plan and usage. No invoices: Advertix doesn't bill in the app yet. */
export interface BillingUsage {
  plan: PlanType;
  clients: number;
  adAccounts: number;
  seats: { used: number; limit: number | null; clientViewersFree: boolean; plan: PlanType };
  spendThisMonth: { currency: string; amount: number }[];
  credits: CreditStatus;
}

export type NotificationEvent = "ACCESS" | "SYNC_FAILED" | "PACING" | "APPROVALS" | "SAFETY" | "MORNING_BRIEFING" | "WEEKLY_SUMMARY";

/** GET /auth/notifications (A14): my email alert choices. */
export interface MyNotifications {
  events: { id: NotificationEvent; label: string; sub: string; eligible: boolean; email: boolean }[];
  emailConfigured: boolean;
  recent: { event: string; status: "sent" | "failed"; error: string | null; createdAt: string }[];
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
  /** Previous-period totals (same length, immediately before). Absent on older API builds. */
  previous?: {
    spend: number;
    revenue: number;
    impressions: number;
    clicks: number;
    conversions: number;
  };
  /** Ad-level results for the same scope (B4, Meta only); null until synced. */
  adLevel?: {
    impressions: number;
    clicks: number;
    conversions: number;
    landingPageViews: number;
    addToCart: number;
  } | null;
}

/** Change log entry (B3). `canUndo`: budget / status / name changes within 7 days, not yet undone. */
export interface ChangeLogEntry {
  id: string;
  campaignId: string | null;
  campaignName: string;
  clientId: string | null;
  /** USER = a person; AI = an Advertix suggestion someone applied; RULE = automation; SYNC = changed outside Advertix. */
  actorType: "USER" | "AI" | "RULE" | "SYNC";
  actorUserId: string | null;
  actorName: string | null;
  action: string;
  summary: string;
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
  /** The change was made on the ad platform, not only in Advertix. */
  platformPushed: boolean;
  suggestionId: string | null;
  revertOfId: string | null;
  undoneAt: string | null;
  undoneByName: string | null;
  /** C1: the owner who approved it (approvalId set, approvedByName null = approved after 24 hours). */
  approvalId: string | null;
  approvedByName: string | null;
  canUndo: boolean;
  createdAt: string;
}

export type PlanStatus = "DRAFT" | "USED" | "ARCHIVED";

/** A saved AI plan (B5). `brief` is truncated in lists. */
export interface PlanSummary {
  id: string;
  title: string;
  brief: string;
  status: PlanStatus;
  latestVersion: number;
  clientId: string | null;
  clientName: string | null;
  createdById: string;
  createdAt: string;
  updatedAt: string;
}

export interface PlanVersion {
  id: string;
  planId: string;
  version: number;
  /** The planner's plan object (POST /ai/plan-campaign). */
  plan: Record<string, unknown>;
  note: string | null;
  createdAt: string;
}

export interface PlanDetail extends PlanSummary {
  versions: PlanVersion[];
  /** Drafts created from this plan (A12). */
  campaigns?: { id: string; name: string; platform: Platform; status: CampaignStatus; planVersion: number | null }[];
}

export interface TimeseriesPoint {
  date: string;
  value: number;
  /** Same day of the previous period; only with `compare: "previous"`. Null = no data that day. */
  previous?: number | null;
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
  /** Role and client access in the workspace (B6); clientIds null = all clients. */
  access?: { role: WorkspaceRole; clientIds: string[] | null } | null;
  /** Someone without a workspace who has been invited to one. */
  pendingInvite?: { token: string; workspaceName: string } | null;
}

export interface TeamMember {
  id: string;
  userId: string;
  name: string | null;
  email: string;
  role: WorkspaceRole;
  /** Empty = all clients. */
  clientIds: string[];
  joinedAt: string;
  isYou: boolean;
}

export interface TeamInvite {
  id: string;
  email: string;
  role: WorkspaceRole;
  clientIds: string[];
  expired: boolean;
  expiresAt: string;
  createdAt: string;
  invitedBy: string | null;
  emailSent: boolean;
  /** Why the email didn't go out; the link still works. */
  emailError: string | null;
  url: string;
}

export interface TeamSeats {
  used: number;
  /** null = unlimited. */
  limit: number | null;
  clientViewersFree: boolean;
  plan: PlanType;
}

export interface Team {
  you: { memberId: string; role: WorkspaceRole };
  seats: TeamSeats;
  clients: { id: string; name: string }[];
  members: TeamMember[];
  invites: TeamInvite[];
}

export interface InviteResult {
  email: string;
  ok: boolean;
  error?: string;
  inviteId?: string;
  url?: string;
  emailSent?: boolean;
}

export interface InviteInfo {
  workspaceName: string;
  inviterName: string | null;
  role: WorkspaceRole;
  email: string;
  status: "open" | "expired" | "accepted" | "revoked" | "member";
  emailMatches: boolean;
  signedInAs: string;
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

/** The public client portal (C4): no login, the token in the link is the key. */
export async function fetchPortal(token: string, days: number): Promise<PortalReport> {
  const res = await fetch(`${API_BASE}/api/portal/${encodeURIComponent(token)}?days=${days}`, { cache: "no-store" });
  const body = await res.json().catch(() => null);
  if (!res.ok) throw new ApiError(body?.error ?? "This report couldn't load. Try again in a moment.", { status: res.status });
  return body as PortalReport;
}

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
        throwIfOutOfCredits(res.status, err);
        throw new ApiError(err.error ?? `HTTP ${res.status}`, {
          status: res.status,
          detail: typeof err.detail === "string" ? err.detail : undefined,
          step: typeof err.step === "string" ? err.step : undefined,
        });
      }
      if ((options.method ?? "GET") !== "GET" && AI_ACTION.test(path)) window.dispatchEvent(new Event(CREDITS_CHANGED_EVENT));
      if (res.status === 204) return undefined as T;
      if (res.status === 202) {
        // A Media buyer's change held for an owner (C1): say so once, and
        // fail the call so no caller reports it as done.
        const body = await res.json().catch(() => null);
        if (body?.pendingApproval) {
          toast(`${APPROVAL_PENDING_MESSAGE} ${body.approval?.reason ? `${body.approval.reason}.` : ""}`, { icon: "⏳", duration: 6000 });
          window.dispatchEvent(new Event(APPROVALS_CHANGED_EVENT));
          throw new ApprovalPendingError(body.approval as Approval);
        }
        return body as T;
      }
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
    /** Copy as a local draft (B5). Nothing is created on the platform until it's published. */
    duplicateCampaign: (id: string, data?: { name?: string; budget?: number }) =>
      apiFetch<Campaign>(`/campaigns/${id}/duplicate`, { method: "POST", body: JSON.stringify(data ?? {}) }),
    /** "Ask about this campaign" (B5): answers from the campaign's own last-30-day data. */
    askCampaign: (id: string, question: string, history: { role: "user" | "assistant"; content: string }[] = []) =>
      apiFetch<{ answer: string; basedOn: { days: number; daysWithData: number } }>(`/ai/campaigns/${id}/ask`, {
        method: "POST",
        body: JSON.stringify({ question, history }),
      }),

    /* Change log (B3) */
    getChangeLog: (params: { campaignId?: string; clientId?: string | null; limit?: number; before?: string }) =>
      apiFetch<{ entries: ChangeLogEntry[] }>(
        `/change-log${buildQuery({ campaignId: params.campaignId, clientId: params.clientId ?? undefined, limit: params.limit, before: params.before })}`
      ),
    undoChange: (id: string) => apiFetch<{ ok: boolean }>(`/change-log/${id}/undo`, { method: "POST" }),

    /* Client portal links (C4) */
    getShare: (clientId: string) => apiFetch<{ share: ClientShare | null }>(`/shares?clientId=${encodeURIComponent(clientId)}`),
    createShare: (data: { clientId: string; showSpend?: boolean; showRevenue?: boolean; showCampaigns?: boolean; expiresInDays?: number | null }) =>
      apiFetch<{ share: ClientShare }>("/shares", { method: "POST", body: JSON.stringify(data) }),
    updateShare: (id: string, data: { showSpend?: boolean; showRevenue?: boolean; showCampaigns?: boolean }) =>
      apiFetch<{ share: ClientShare }>(`/shares/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
    revokeShare: (id: string) => apiFetch<{ ok: boolean }>(`/shares/${id}`, { method: "DELETE" }),
    getReportSchedule: (clientId: string) => apiFetch<ReportScheduleInfo>(`/reports/schedule?clientId=${encodeURIComponent(clientId)}`),
    saveReportSchedule: (data: ReportScheduleInput) => apiFetch<ReportScheduleInfo>("/reports/schedule", { method: "PUT", body: JSON.stringify(data) }),
    sendTestReport: (data: ReportScheduleInput) => apiFetch<{ sentTo: string }>("/reports/schedule/test", { method: "POST", body: JSON.stringify(data) }),

    /* Alerts inbox (C2) */
    getAlerts: (state: "open" | "resolved" = "open", refresh = false) => apiFetch<{ alerts: AppAlert[]; refreshedAt: string }>(`/alerts?state=${state}${refresh ? "&refresh=1" : ""}`),
    getAlertSummary: () => apiFetch<AlertSummary>("/alerts/summary"),
    getCalendar: (from: string, to: string, clientId?: string | null) =>
      apiFetch<FlightCalendar>(`/calendar?from=${from}&to=${to}${clientId ? `&clientId=${encodeURIComponent(clientId)}` : ""}`),
    markAlertsSeen: () => apiFetch<{ ok: boolean }>("/alerts/seen", { method: "POST" }),
    dismissAlert: (id: string) => apiFetch<{ ok: boolean }>(`/alerts/${id}/dismiss`, { method: "POST" }),

    /* Approvals (C1) */
    getApprovals: (status: "pending" | "decided" | "all" = "pending") => apiFetch<{ approvals: Approval[] }>(`/approvals?status=${status}`),
    getApprovalSummary: () => apiFetch<ApprovalSummary>("/approvals/summary"),
    approve: (id: string, note?: string) => apiFetch<Approval>(`/approvals/${id}/approve`, { method: "POST", body: JSON.stringify({ note }) }),
    reject: (id: string, note?: string) => apiFetch<Approval>(`/approvals/${id}/reject`, { method: "POST", body: JSON.stringify({ note }) }),
    cancelApproval: (id: string) => apiFetch<Approval>(`/approvals/${id}/cancel`, { method: "POST" }),
    getApprovalSettings: () => apiFetch<ApprovalSettings>("/approvals/settings"),
    saveApprovalSettings: (data: { budgetPct?: number | null; timeout?: ApprovalTimeout; askFirstClientIds?: string[] }) =>
      apiFetch<ApprovalSettings>("/approvals/settings", { method: "PUT", body: JSON.stringify(data) }),

    /* Automation: auto-apply (C13) and safety rules (C14) */
    getSafetySettings: () => apiFetch<SafetySettings>("/automation/settings"),
    saveSafetySettings: (data: { maxCutPct?: number; autoApplyMaxPct?: number; automationPaused?: boolean; clients?: { id: string; pixel?: boolean; cap?: boolean; autoApply?: boolean }[] }) =>
      apiFetch<SafetySettings>("/automation/settings", { method: "PUT", body: JSON.stringify(data) }),

    /* Saved AI plans (B5) */
    getPlans: (params?: { clientId?: string | null; includeArchived?: boolean }) =>
      apiFetch<{ plans: PlanSummary[] }>(
        `/plans${buildQuery({ clientId: params?.clientId ?? undefined, include: params?.includeArchived ? "archived" : undefined })}`
      ),
    getPlan: (id: string) => apiFetch<PlanDetail>(`/plans/${id}`),
    createPlan: (data: { brief: string; plan: object; title?: string; clientId?: string | null; note?: string }) =>
      apiFetch<PlanDetail>("/plans", { method: "POST", body: JSON.stringify(data) }),
    addPlanVersion: (id: string, data: { plan: object; note?: string; title?: string }) =>
      apiFetch<PlanVersion>(`/plans/${id}/versions`, { method: "POST", body: JSON.stringify(data) }),
    updatePlan: (id: string, data: { title?: string; status?: PlanStatus; clientId?: string | null }) =>
      apiFetch<PlanSummary>(`/plans/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
    deletePlan: (id: string) => apiFetch<void>(`/plans/${id}`, { method: "DELETE" }),
    createPlanDrafts: (id: string, version: number) =>
      apiFetch<PlanDraftsResult>(`/plans/${id}/drafts`, { method: "POST", body: JSON.stringify({ version }) }),

    deleteCampaign: (id: string) =>
      apiFetch<SuccessResponse>(`/campaigns/${id}`, { method: "DELETE" }),
    getCampaignMetrics: (id: string, days = 30) =>
      apiFetch<CampaignMetric[]>(`/campaigns/${id}/metrics?days=${days}`),

    /* Ad sets and ads (B4, Meta) */
    getCampaignStructure: (id: string, days = 30) =>
      apiFetch<CampaignStructure>(`/campaigns/${id}/structure?days=${days}`),
    setAdSetStatus: (campaignId: string, adSetId: string, status: "ACTIVE" | "PAUSED") =>
      apiFetch<{ ok: boolean }>(`/campaigns/${campaignId}/adsets/${adSetId}/status`, { method: "POST", body: JSON.stringify({ status }) }),
    setAdSetBudget: (campaignId: string, adSetId: string, dailyBudget: number) =>
      apiFetch<{ ok: boolean }>(`/campaigns/${campaignId}/adsets/${adSetId}/budget`, { method: "POST", body: JSON.stringify({ dailyBudget }) }),
    setAdStatus: (campaignId: string, adId: string, status: "ACTIVE" | "PAUSED") =>
      apiFetch<{ ok: boolean }>(`/campaigns/${campaignId}/ads/${adId}/status`, { method: "POST", body: JSON.stringify({ status }) }),

    /* Analytics */
    getAnalyticsOverview: (days = 30, platform?: Platform, clientId?: string | null) =>
      apiFetch<AnalyticsOverview>(
        `/analytics/overview${buildQuery({ days, platform, clientId: clientId ?? undefined })}`
      ),
    getTimeseries: (
      days = 30,
      metric: "spend" | "revenue" | "roas" | "impressions" | "clicks" | "conversions" | "cpa" = "spend",
      platform?: Platform,
      clientId?: string | null,
      /** Adds `previous` (same day of the previous period) to each point. */
      compare?: "previous"
    ) =>
      apiFetch<TimeseriesPoint[]>(
        `/analytics/timeseries${buildQuery({ days, metric, platform, clientId: clientId ?? undefined, compare })}`
      ),
    getPlatformBreakdown: (days = 30, clientId?: string | null) =>
      apiFetch<PlatformBreakdown[]>(
        `/analytics/by-platform${buildQuery({ days, clientId: clientId ?? undefined })}`
      ),
    getAnalyticsByClient: (days = 30) =>
      apiFetch<ClientBreakdown[]>(`/analytics/by-client${buildQuery({ days })}`),
    getAnalyticsCampaigns: (params?: {
      days?: number;
      clientId?: string;
      sortBy?: string;
      sortOrder?: "asc" | "desc";
      page?: number;
      limit?: number;
    }) =>
      apiFetch<AnalyticsCampaignsResponse>(
        `/analytics/campaigns${buildQuery(params)}`
      ),

    /* Ad Accounts */
    getAdAccounts: (clientId?: string | null) =>
      apiFetch<AdAccount[]>(`/ad-accounts${buildQuery({ clientId: clientId ?? undefined })}`),
    assignAdAccountClient: (id: string, clientId: string | null) =>
      apiFetch<AdAccount>(`/ad-accounts/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ clientId }),
      }),

    /* Clients */
    getClients: () => apiFetch<ClientsResponse>("/clients"),
    createClient: (data: ClientInput & { name: string }) =>
      apiFetch<Client>("/clients", { method: "POST", body: JSON.stringify(data) }),
    updateClient: (id: string, data: ClientInput) =>
      apiFetch<Client>(`/clients/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
    /** Everything the client had (ad accounts, history, team access…) moves to `moveTo`. */
    deleteClient: (id: string, moveTo: string) => apiFetch<void>(`/clients/${id}?moveTo=${encodeURIComponent(moveTo)}`, { method: "DELETE" }),

    /* Budgets */
    /* Budgets allocator (A11) */
    getAllocator: (clientId?: string | null) => apiFetch<AllocatorData>(`/budgets/allocator${buildQuery({ clientId: clientId ?? undefined })}`),
    applyAllocation: (data: { clientId: string; targets: Record<string, number> }) =>
      apiFetch<AllocationResult>("/budgets/allocator/apply", { method: "POST", body: JSON.stringify(data) }),
    getPacing: (params?: { month?: string; clientId?: string | null }) =>
      apiFetch<PacingResponse>(
        `/budgets/pacing${buildQuery({ month: params?.month, clientId: params?.clientId ?? undefined })}`
      ),
    connectAdAccount: (data: ConnectAdAccountInput) =>
      apiFetch<AdAccount>("/ad-accounts", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    /* Connections (A13) */
    getConnections: (clientId?: string | null) => apiFetch<ConnectionsData>(`/connections${buildQuery({ clientId: clientId ?? undefined })}`),
    getPendingConnection: (id: string) => apiFetch<PendingConnectionData>(`/connections/pending/${id}`),
    acceptPendingConnection: (id: string, accounts: { accountId: string; clientId: string | null }[]) =>
      apiFetch<{ added: { id: string; accountName: string; platform: Platform; clientId: string | null; isActive: boolean }[] }>(`/connections/pending/${id}/accept`, { method: "POST", body: JSON.stringify({ accounts }) }),
    discardPendingConnection: (id: string) => apiFetch<{ success: boolean }>(`/connections/pending/${id}`, { method: "DELETE" }),
    syncConnections: (data: { platform?: Platform; clientId?: string | null } = {}) =>
      apiFetch<ConnectionSyncResult>(`/connections/sync${buildQuery({ clientId: data.clientId ?? undefined })}`, { method: "POST", body: JSON.stringify({ platform: data.platform }) }),
    syncAdAccount: (id: string) => apiFetch<{ ok: boolean; campaigns: number; metrics: number }>(`/connections/accounts/${id}/sync`, { method: "POST" }),
    archiveAdAccount: (id: string) => apiFetch<{ id: string; archivedAt: string | null }>(`/connections/accounts/${id}/archive`, { method: "POST" }),
    restoreAdAccount: (id: string) => apiFetch<{ id: string; archivedAt: string | null }>(`/connections/accounts/${id}/restore`, { method: "POST" }),
    disconnectPlatform: (platform: Platform, clientId?: string | null) =>
      apiFetch<{ platform: Platform; removed: number; campaigns: number }>(`/connections/disconnect${buildQuery({ clientId: clientId ?? undefined })}`, { method: "POST", body: JSON.stringify({ platform }) }),
    setAutoSync: (platform: Platform, enabled: boolean) => apiFetch<{ platform: Platform; autoSync: boolean }>("/connections/auto-sync", { method: "PATCH", body: JSON.stringify({ platform, enabled }) }),
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
    getBilling: () => apiFetch<BillingUsage>("/workspace/billing"),
    getSetup: (clientId?: string | null) => apiFetch<SetupChecklist>(`/workspace/setup${clientId ? `?clientId=${encodeURIComponent(clientId)}` : ""}`),
    getCredits: () => apiFetch<CreditStatus>("/workspace/credits"),
    getBillingStatus: () => apiFetch<BillingStatus>("/billing/status"),
    /** First plan: returns Stripe Checkout's URL. */
    startCheckout: (tier: PaidTier, interval: BillingInterval) => apiFetch<{ url: string }>("/billing/checkout", { method: "POST", body: JSON.stringify({ tier, interval }) }),
    /** Switch the existing subscription (prorated). */
    changePlan: (tier: PaidTier, interval: BillingInterval) => apiFetch<BillingStatus>("/billing/change", { method: "POST", body: JSON.stringify({ tier, interval }) }),
    /** Stripe's billing portal (invoices, card, cancel). */
    openBillingPortal: () => apiFetch<{ url: string }>("/billing/portal", { method: "POST" }),
    skipSetupStep: (step: SetupStepId, skip = true, clientId?: string | null) => apiFetch<SetupChecklist>("/workspace/setup/skip", { method: "POST", body: JSON.stringify({ step, skip, clientId }) }),
    dismissSetup: (dismissed = true, clientId?: string | null) => apiFetch<SetupChecklist>("/workspace/setup/dismiss", { method: "POST", body: JSON.stringify({ dismissed, clientId }) }),
    deleteWorkspace: (confirmName: string) =>
      apiFetch<{ deleted: boolean; accountDeleted: boolean; loginError: string | null }>("/workspace", { method: "DELETE", body: JSON.stringify({ confirmName }) }),
    getMyNotifications: () => apiFetch<MyNotifications>("/auth/notifications"),
    saveMyNotifications: (prefs: Partial<Record<NotificationEvent, boolean>>) =>
      apiFetch<MyNotifications>("/auth/notifications", { method: "PUT", body: JSON.stringify({ prefs }) }),
    sendTestNotification: () => apiFetch<{ success: boolean }>("/auth/notifications/test", { method: "POST" }),
    /** C12: today's morning briefing to me now. */
    sendBriefingNow: () => apiFetch<{ success: boolean }>("/auth/notifications/briefing", { method: "POST" }),
    updateWorkspace: (data: UpdateWorkspaceInput) =>
      apiFetch<Workspace>("/workspace", {
        method: "PATCH",
        body: JSON.stringify(data),
      }),
    getMembers: () => apiFetch<Member[]>("/workspace/members"),
    /* Team (B6) */
    getTeam: () => apiFetch<Team>("/workspace/team"),
    createInvites: (data: { emails: string[]; role: WorkspaceRole; clientIds: string[] }) =>
      apiFetch<{ results: InviteResult[]; seats: TeamSeats }>("/workspace/invites", { method: "POST", body: JSON.stringify(data) }),
    resendInvite: (id: string) => apiFetch<{ emailSent: boolean; url: string }>(`/workspace/invites/${id}/resend`, { method: "POST" }),
    revokeInvite: (id: string) => apiFetch<SuccessResponse>(`/workspace/invites/${id}`, { method: "DELETE" }),
    updateMember: (memberId: string, data: { role?: WorkspaceRole; clientIds?: string[] }) =>
      apiFetch<SuccessResponse>(`/workspace/members/${memberId}`, { method: "PUT", body: JSON.stringify(data) }),
    getInvite: (token: string) => apiFetch<InviteInfo>(`/invites/${encodeURIComponent(token)}`),
    acceptInvite: (token: string) =>
      apiFetch<{ workspaceId: string; alreadyMember: boolean }>(`/invites/${encodeURIComponent(token)}/accept`, { method: "POST" }),
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
    /** Library creatives + synced Meta ads with results (A8). */
    getCreativeBoard: (days = 30, clientId?: string | null) =>
      apiFetch<CreativeBoard>(`/creatives/board${buildQuery({ days, clientId: clientId ?? undefined })}`),
    /** AI copy variants. Carousel: `kind: "carousel"` with 2–5 cards. */
    generateCopy: (data: { brief: string; platform: string; objective: string; kind?: "carousel"; cardCount?: number }) =>
      apiFetch<{ success: boolean; copy: GeneratedCopy }>("/ai/generate-copy", { method: "POST", body: JSON.stringify(data) }),
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
    /** Saved + Meta audiences with usage, results, warnings and lookalike ideas (A9). */
    getAudienceBoard: (days = 30, clientId?: string | null) =>
      apiFetch<AudienceBoard>(`/audiences/board${buildQuery({ days, clientId: clientId ?? undefined })}`),
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

    /* Suggestions (B2) */
    getSuggestions: (params?: { clientId?: string | null; campaignId?: string; includeApplied?: boolean }) =>
      apiFetch<SuggestionsResponse>(
        `/suggestions${buildQuery({
          clientId: params?.clientId ?? undefined,
          campaignId: params?.campaignId,
          include: params?.includeApplied ? "applied" : undefined,
        })}`
      ),
    refreshSuggestions: () =>
      apiFetch<SuggestionsResponse & { generated: boolean }>("/suggestions/refresh", { method: "POST" }),
    applySuggestion: (id: string) => apiFetch<Suggestion>(`/suggestions/${id}/apply`, { method: "POST" }),
    snoozeSuggestion: (id: string, days?: number) =>
      apiFetch<Suggestion>(`/suggestions/${id}/snooze`, { method: "POST", body: JSON.stringify({ days }) }),
    undoSuggestion: (id: string) => apiFetch<Suggestion>(`/suggestions/${id}/undo`, { method: "POST" }),

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
    getPlannerContext: (clientId?: string | null) =>
      apiFetch<PlannerContextData>(`/ai/planner/context${buildQuery({ clientId: clientId ?? undefined })}`),
    planCampaign: (data: { messages: PlannerTurn[]; clientId: string | null; currentPlan?: Record<string, unknown> | null }) =>
      apiFetch<PlannerResponse>("/ai/plan-campaign", {
        method: "POST",
        body: JSON.stringify(data),
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
      /** The Meta ad account (our id) to create it on — the seed's account. */
      adAccountId?: string | null;
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
      /** OpenAI image quality; the API defaults to low. */
      quality?: "low" | "medium" | "high";
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
        if (params.quality) form.append("quality", params.quality);
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
          throwIfOutOfCredits(res.status, err);
          throw new Error(err.error ?? `HTTP ${res.status}`);
        }
        window.dispatchEvent(new Event(CREDITS_CHANGED_EVENT));
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
    cities?: Array<{ key: string; name?: string; radius?: number; distance_unit?: "mile" | "kilometer" }>;
    zips?: Array<{ key: string }>;
  };
  excluded_geo_locations?: MetaTargetingSpec["geo_locations"];
  interests?: Array<{ id: string; name?: string }>;
  custom_audiences?: Array<{ id: string; name?: string }>;
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
