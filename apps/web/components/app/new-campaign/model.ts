import type { LucideIcon } from "lucide-react";
import { Eye, Heart, MousePointerClick, ShoppingBag, UserPlus } from "lucide-react";
import type { AnalyticsOverview, Platform } from "@/lib/api";
import { initialState, isCreativeReady, validateAudience, type WizardState } from "@/components/app/new-campaign/metaSteps";
import { autoPauseCheck, emptyAutoPause, type AutoPauseForm } from "@/components/app/campaign/AutoPauseFields";

/** What the campaign is for. `value` is the string stored on the Campaign row (unchanged from the old create flow). */
export type GoalId = "traffic" | "leads" | "conversions" | "awareness" | "video";

export const GOALS: { id: GoalId; value: string; name: string; desc: string; icon: LucideIcon; explainer: string; needsPixel?: boolean }[] = [
  {
    id: "traffic",
    value: "Traffic",
    name: "Website visits",
    desc: "Send people to your site",
    icon: MousePointerClick,
    explainer: "Shown to people most likely to click through. Works without any tracking set up — the safest place to start.",
  },
  {
    id: "leads",
    value: "Lead Generation",
    name: "Leads",
    desc: "Collect enquiries and contact details",
    icon: UserPlus,
    explainer: "Looks for people likely to fill in your form, not just click. Needs the Meta Pixel on your site.",
    needsPixel: true,
  },
  {
    id: "conversions",
    value: "Conversions",
    name: "Sales",
    desc: "Drive purchases and sign-ups",
    icon: ShoppingBag,
    explainer: "Finds people likely to buy, learning from past purchasers. The Pixel must be installed and recording purchases.",
    needsPixel: true,
  },
  {
    id: "awareness",
    value: "Awareness",
    name: "Awareness",
    desc: "Reach as many people as possible",
    icon: Eye,
    explainer: "The most people for your money. Judge it on reach, not sales — for launches and brand-building.",
  },
  {
    id: "video",
    value: "Video Views",
    name: "Engagement",
    desc: "Video plays, likes, comments and shares",
    icon: Heart,
    explainer: "Optimizes for people who watch and react. Builds social proof and an audience to retarget later.",
  },
];

/** Platforms the wizard can create campaigns for. Only Meta publishes from Advertix today. */
export const WIZARD_PLATFORMS: { id: Platform; name: string; sub: string }[] = [
  { id: "META", name: "Meta", sub: "Facebook + Instagram" },
  { id: "GOOGLE", name: "Google Ads", sub: "Search · YouTube · Display" },
  { id: "TIKTOK", name: "TikTok", sub: "For You feed · Spark Ads" },
  { id: "LINKEDIN", name: "LinkedIn", sub: "Sponsored content" },
];

export type LaunchMode = "paused" | "start" | "draft";

export type Draft = {
  goal: GoalId | null;
  name: string;
  /** User typed a name (stop auto-naming). */
  nameTouched: boolean;
  platforms: Platform[];
  /** Ad account per platform. */
  accountIds: Partial<Record<Platform, string>>;
  budgetType: "DAILY" | "LIFETIME";
  /** Raw text so the field can be emptied (a number state snaps back to 0). */
  budgetInput: string;
  startDate: string;
  endDate: string;
  runContinuously: boolean;
  /** The budget's ad account time zone (kept in step by the page): Meta counts a total budget's minimum by the hour there. */
  budgetTz?: string | null;
  /** Auto-pause (C6), Meta only: spend cap, blackout dates, tracking stops. */
  autoPause: AutoPauseForm;
  /** Smart hours (C7): Advertix watches its hours and suggests changes (Meta one-click needs a total budget). */
  smartHours: boolean;
  launch: LaunchMode;
  meta: WizardState;
  /** Campaign rows already created by a launch attempt that failed at publish — reused on retry (no duplicates). */
  createdIds: Partial<Record<Platform, string>>;
};

/** Today in the viewer's own calendar (toISOString would give the UTC date, a day off near midnight). */
export const todayStr = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

export function emptyDraft(): Draft {
  return {
    goal: null,
    name: "",
    nameTouched: false,
    platforms: [],
    accountIds: {},
    budgetType: "DAILY",
    budgetInput: "",
    startDate: todayStr(),
    endDate: "",
    runContinuously: true,
    autoPause: emptyAutoPause(),
    smartHours: false,
    launch: "paused",
    meta: initialState(),
    createdIds: {},
  };
}

export const budgetOf = (d: Draft) => {
  const n = Number(d.budgetInput);
  return d.budgetInput.trim() !== "" && Number.isFinite(n) ? n : 0;
};

/** Minutes the zone is ahead of UTC at instant t. */
function offsetMinutes(t: number, tz: string) {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", { timeZone: tz, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" })
      .formatToParts(new Date(t))
      .map((x) => [x.type, x.value])
  );
  return Math.round((Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +p.second) - Math.floor(t / 1000) * 1000) / 60_000);
}
/** Midnight starting a calendar day in a time zone (UTC when unknown), as in the API's lib/schedule-time. */
function midnight(day: string, tz: string | null | undefined) {
  const [y, m, dd] = day.split("-").map(Number);
  const wall = Date.UTC(y, m - 1, dd);
  if (!tz) return wall;
  try {
    let t = wall - offsetMinutes(wall, tz) * 60_000;
    t = wall - offsetMinutes(t, tz) * 60_000;
    return t;
  } catch {
    return wall;
  }
}
/** Hours from 00:00 on the first day to the end of the last, in the zone (a clock change makes a day 23 or 25). */
export function scheduleHours(start: string, end: string, tz: string | null | undefined) {
  const next = new Date(`${end}T00:00:00Z`);
  next.setUTCDate(next.getUTCDate() + 1);
  return Math.round((midnight(next.toISOString().slice(0, 10), tz) - midnight(start, tz)) / 3_600_000);
}

/**
 * Everything Meta would reject about budget and schedule (moved from the old
 * create modal): the account's daily floor; a lifetime budget covering it for
 * every hour it runs (Meta counts by the hour, in the account's time zone, so
 * a day with a clock change counts 23 or 25 hours, and the total has to be
 * more than that, not equal); start not in the past; end on or after start;
 * a lifetime budget needs an end date.
 */
export function scheduleCheck(d: Draft, minDailyBudget: number | null, sym = "") {
  const amount = budgetOf(d);
  const dailyFloor = Math.max(1, minDailyBudget && minDailyBudget > 0 ? minDailyBudget : 1);
  const dated = !d.runContinuously && !!d.endDate && !!d.startDate && d.endDate >= d.startDate;
  const days = dated ? Math.max(1, Math.round((new Date(d.endDate).getTime() - new Date(d.startDate).getTime()) / 86_400_000) + 1) : null;
  const hours = dated ? scheduleHours(d.startDate, d.endDate, d.budgetTz) : null;
  const floor = d.budgetType === "DAILY" ? dailyFloor : Math.ceil((dailyFloor * (hours ?? 24)) / 24 * 100 + 1) / 100;
  const clockChange = !!days && !!hours && hours !== days * 24;
  let budget: string | null = null;
  if (!(amount > 0)) budget = "Enter a budget above zero.";
  else if (amount < floor)
    budget =
      d.budgetType === "DAILY"
        ? `The minimum for this account is ${sym}${dailyFloor.toLocaleString()} per day.`
        : `A ${days ?? 1}-day campaign needs at least ${sym}${floor.toLocaleString()} in total (${sym}${dailyFloor.toLocaleString()} a day${clockChange ? `, counted by the hour: it runs ${hours} hours because the clocks change` : ""}).`;
  let start: string | null = null;
  if (!d.startDate) start = "Pick a start date.";
  else if (d.startDate < todayStr()) start = "The start date can't be in the past.";
  let end: string | null = null;
  if (!d.runContinuously) {
    if (!d.endDate) end = "Pick an end date, or choose “Run continuously”.";
    else if (d.endDate < d.startDate) end = "The end date can't be before the start date.";
  }
  if (d.budgetType === "LIFETIME" && d.runContinuously) end = "A total budget needs an end date so the platform can spread it.";
  return { amount, budget, start, end, days, hours, clockChange, floor, dailyFloor, ok: !budget && !start && !end };
}

export const hasMeta = (d: Draft) => d.platforms.includes("META");

/** Which steps are complete (1-based). */
export function stepValid(d: Draft, step: number, minDailyBudget: number | null): boolean {
  switch (step) {
    case 1:
      return d.goal !== null;
    case 2:
      return d.platforms.length > 0 && d.platforms.every((p) => !!d.accountIds[p]) && scheduleCheck(d, minDailyBudget).ok && (!hasMeta(d) || autoPauseCheck(d.autoPause).ok);
    case 3:
      return !hasMeta(d) || validateAudience(d.meta).ok;
    case 4:
      return !hasMeta(d) || (d.meta.pageId !== "" && isCreativeReady(d.meta));
    default:
      // Review & launch: the name is filled in automatically once a platform is picked.
      return d.name.trim().length > 0;
  }
}

/** Setup strength (0–100) and what's still missing, from the real fields. */
export function strength(d: Draft, minDailyBudget: number | null): { score: number; missing: string[] } {
  const m = d.meta;
  const meta = hasMeta(d);
  // Until a platform is picked, the Meta-only checks aren't "done" either.
  const none = d.platforms.length === 0;
  const ok = (v: boolean) => !none && (!meta || v);
  const checks: [boolean, number, string][] = [
    [d.goal !== null, 15, "Pick a goal"],
    [d.platforms.length > 0, 10, "Choose where it runs"],
    [scheduleCheck(d, minDailyBudget).ok, 15, "Set a valid budget and dates"],
    [ok(validateAudience(m).ok), 15, "Add a location or audience"],
    [ok(m.interests.length > 0 || m.customAudiences.length > 0 || m.savedAudiences.length > 0), 5, "Add interests or an audience (optional)"],
    [ok(m.pageId !== ""), 10, "Pick the Facebook Page"],
    [ok(isCreativeReady(m)), 20, "Add the ad: media, text and link"],
    [ok(m.headline.trim().length > 0 && m.headline.length <= 40), 5, "Write a headline under 40 characters"],
    [ok(m.description.trim().length > 0), 5, "Add a description (optional)"],
  ];
  const score = checks.reduce((n, [ok, w]) => n + (ok ? w : 0), 0);
  return { score: Math.min(100, score), missing: checks.filter(([ok]) => !ok).map(([, , label]) => label) };
}

/**
 * Forecast from the workspace's (or client's) last 30 days: CPM, CTR and
 * conversion rate applied to the daily budget. Without history there's no
 * honest estimate, so it says so instead of inventing one.
 */
export function forecast(d: Draft, minDailyBudget: number | null, history: AnalyticsOverview | null) {
  const s = scheduleCheck(d, minDailyBudget);
  const daily = d.budgetType === "LIFETIME" && s.days ? s.amount / s.days : s.amount;
  const days = d.runContinuously ? 30 : s.days ?? 30;
  const h = history;
  const based = !!h && h.impressions > 1000 && h.spend > 0;
  if (!based || !(daily > 0)) return { based: false as const, daily, days, total: daily * days };
  const cpm = (h.spend / h.impressions) * 1000;
  const ctr = h.clicks / h.impressions;
  const cvr = h.clicks > 0 ? h.conversions / h.clicks : 0;
  const impressions = (daily / cpm) * 1000;
  return {
    based: true as const,
    daily,
    days,
    total: daily * days,
    cpm,
    ctr,
    // Unique people per day, assuming an average frequency of ~1.6.
    reachPerDay: impressions / 1.6,
    clicksPerDay: impressions * ctr,
    conversionsPerDay: impressions * ctr * cvr,
    roas: h.spend > 0 && h.revenue > 0 ? h.revenue / h.spend : null,
  };
}

export const AUTOSAVE_KEY = "advertix.newCampaign.draft";
