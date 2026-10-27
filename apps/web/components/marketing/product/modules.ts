/** Product page content: six module chapters (mockup copy). */

export type MarkKey = "M" | "G" | "T" | "S" | "L" | "A" | "N" | "W" | "K";
export type Tone = "pos" | "brand" | "neg";

export type ModuleRow = {
  mark: MarkKey;
  label: string;
  value: string;
  /** Explicit value colour (the mockup derived this with a regex). */
  valueTone?: "pos" | "neg";
  /** Progress bar width in %, when the row has one. */
  bar?: number;
  sub?: string;
};

export type ProductModule = {
  id: string;
  name: string;
  kicker: string;
  lead: string;
  accent: string;
  body: string;
  dark: boolean;
  ui: { title: string; tag: string; tone: Tone; rows: ModuleRow[]; note: string };
  points: { t: string; b: string }[];
  /** Shown with a "Coming soon" tag: the module is planned, not live (Track C). */
  soon?: string;
};

export const MODULES: ProductModule[] = [
  {
    id: "planner",
    name: "AI Planner",
    kicker: "AI PLANNER",
    lead: "Describe the goal.",
    accent: "Get a launch plan.",
    body: "Advertix reads 30 days of history, splits the budget along each platform’s response curve and returns campaigns, audiences, creative direction and a forecast. Refine it in plain English; it’s created as paused drafts.",
    dark: true,
    ui: {
      title: "Holiday bundle · Lumen Skincare",
      tag: "FORECAST 4.9X",
      tone: "pos",
      rows: [
        { mark: "M", label: "Meta · Advantage+ prospecting", value: "$7,560", bar: 42 },
        { mark: "T", label: "TikTok · Spark Ads", value: "$5,400", bar: 30 },
        { mark: "G", label: "Google · Brand + Shopping", value: "$3,240", bar: 18 },
        { mark: "M", label: "Retarget · viewed bundle", value: "$1,800", bar: 10 },
      ],
      note: "Retargeting starts in week 2, once there are enough bundle viewers to reach.",
    },
    points: [
      { t: "Shows its working", b: "Reasoning steps, not just an answer" },
      { t: "One-click refinements", b: "More TikTok, less budget, longer flight" },
      { t: "Drafts, not launches", b: "Nothing spends until you publish" },
    ],
  },
  {
    id: "decide",
    name: "Decision feed",
    kicker: "DECISION FEED",
    lead: "Three decisions a morning.",
    accent: "Not forty charts.",
    body: "Every account is checked every six hours. Each suggestion names the numbers behind it and the impact, ranked by money at stake, and applies with one click.",
    dark: false,
    ui: {
      title: "Wednesday · all clients",
      tag: "3 OPEN",
      tone: "brand",
      rows: [
        { mark: "G", label: "Move $250/day to TikTok Spark Ads", value: "+$3.1K/WK", valueTone: "pos", sub: "CPA $14.20 vs $26.80 on Generic Search" },
        { mark: "M", label: "Rotate out “UGC v3”", value: "$460/DAY", sub: "Frequency 4.8 · CTR down 38% in five days" },
        { mark: "L", label: "Narrow to Director+ titles", value: "−$38 CPL", valueTone: "pos", sub: "72% of qualified leads come from these titles" },
      ],
      note: "Fieldhouse first: it has the most money at stake this week.",
    },
    points: [
      { t: "Apply, snooze or undo", b: "Every action is reversible for 7 days" },
      { t: "Grouped by client", b: "One feed for 20 clients" },
      { t: "“Not now” hides it", b: "For a week, then it’s checked again" },
    ],
  },
  {
    id: "budgets",
    name: "Budget allocator",
    kicker: "BUDGET ALLOCATOR",
    lead: "See where the next dollar",
    accent: "earns the most.",
    body: "Drag a platform’s daily budget and watch projected revenue update. Advertix marks its recommended split and shows each client’s pace against their monthly cap.",
    dark: true,
    ui: {
      title: "Fieldhouse · daily budget",
      tag: "+$412/DAY",
      tone: "pos",
      rows: [
        { mark: "T", label: "TikTok · $310 → $520", value: "$3.62", valueTone: "pos", bar: 74 },
        { mark: "M", label: "Meta · $487 → $455", value: "$2.71", bar: 62 },
        { mark: "G", label: "Google · $560 → $380", value: "$1.58", bar: 48 },
      ],
      note: "Generic Search is saturated: its next dollar earns less than half of TikTok’s.",
    },
    points: [
      { t: "Marginal return per platform", b: "Not just averages" },
      { t: "Monthly caps per client", b: "With run-out dates" },
      { t: "Apply in one click", b: "Meta budgets change straight away" },
    ],
  },
  {
    id: "creative",
    name: "Creative studio",
    kicker: "CREATIVE STUDIO",
    lead: "Variants from the hooks",
    accent: "that already convert.",
    body: "Brief a format and tone, and Advertix drafts copy and images from each client’s best openings. Fatigue is flagged before CTR collapses, and a fresh variant is one click away.",
    dark: false,
    ui: {
      title: "Lumen · Glow Serum",
      tag: "4 DRAFTS",
      tone: "brand",
      rows: [
        { mark: "M", label: "Founder story", value: "CTR 2.31%", valueTone: "pos", bar: 46, sub: "Frequency 2.4 · healthy" },
        { mark: "M", label: "Before / after", value: "CTR 1.97%", valueTone: "pos", bar: 54, sub: "Frequency 2.7 · healthy" },
        { mark: "M", label: "UGC v3 — Morning routine", value: "CTR 0.92%", valueTone: "neg", bar: 96, sub: "Frequency 4.8 · time to rotate" },
      ],
      note: "Two new variants reuse the founder hook in 9:16 for Reels and Stories.",
    },
    points: [
      { t: "A shape per placement", b: "1:1, 9:16 and 16:9" },
      { t: "Fatigue bar on every ad", b: "Pause tired Meta ads in place" },
      { t: "Image quality", b: "Low, medium or high" },
    ],
  },
  {
    id: "alerts",
    name: "Alerts",
    kicker: "ALERTS",
    lead: "Know when",
    accent: "something breaks.",
    body: "Today, email alerts tell the right people when platform access is about to expire, a sync fails or a client is off pace, plus a weekly summary. Coming soon: broken pixels and CPA spikes, grouped per campaign in one inbox, with the fix one click away.",
    soon: "Alerts inbox",
    dark: true,
    ui: {
      title: "Alerts · open",
      tag: "2 CRITICAL",
      tone: "neg",
      rows: [
        { mark: "N", label: "Mara · Meta pixel stopped", value: "12 MIN", valueTone: "neg", sub: "Spend continues at $85/day with nothing measured" },
        { mark: "N", label: "Orbit · LinkedIn CPL 2.4× normal", value: "1 H", valueTone: "neg", sub: "New placement on Audience Network" },
        { mark: "W", label: "Kobo · budget runs out 26 Oct", value: "06:00", sub: "Lower the daily cap by $430 to last the month" },
      ],
      note: "Pause Mara’s two sales campaigns until the pixel fires again?",
    },
    points: [
      { t: "Email alerts today", b: "Access, sync failures, pacing, weekly summary" },
      { t: "Each person chooses", b: "Per event type" },
      { t: "Inbox and fix from the alert", b: "Coming soon" },
    ],
  },
  {
    id: "reports",
    name: "Reports",
    kicker: "REPORTS & CLIENT PORTAL",
    lead: "Status updates",
    accent: "that write themselves.",
    body: "Coming soon: a live link per client and a weekly PDF with KPIs, the platform split, top ads and a plain-English summary your team edits before it sends. Today, export any report view to CSV or Excel.",
    soon: "Client portal & scheduled reports",
    dark: false,
    ui: {
      title: "Weekly report · Lumen Skincare",
      tag: "MONDAYS 09:00",
      tone: "brand",
      rows: [
        { mark: "K", label: "Revenue", value: "$241,101", sub: "↑ 14.6% vs last week" },
        { mark: "K", label: "ROAS", value: "4.60x", sub: "Best week this quarter" },
        { mark: "A", label: "Summary", value: "DRAFTED", sub: "Budget moved to TikTok creators; morning-routine video refreshed" },
      ],
      note: "Sara reviewed this summary; it sends automatically at 09:00.",
    },
    points: [
      { t: "Your logo on every report", b: "Coming soon" },
      { t: "Choose what clients see", b: "Coming soon" },
      { t: "Export today", b: "CSV or Excel from Campaigns, Analytics and Overview" },
    ],
  },
];

/**
 * Coverage per capability (Meta, Google, TikTok, Snapchat, LinkedIn):
 * F = works today, H = partly, C = coming soon, N = not offered by the platform.
 */
export const COVERAGE: { l: string; c: string }[] = [
  { l: "Campaigns and results sync in", c: "FFFCF" },
  { l: "Publish, pause and change budgets", c: "FCCCC" },
  { l: "AI suggestions", c: "FHHCH" },
  { l: "Apply suggestions in one click", c: "FCCCC" },
  { l: "Budget allocator and pacing", c: "FFFCF" },
  { l: "Creative studio drafts", c: "FFFCF" },
  { l: "Ads synced with fatigue tracking", c: "FCCCC" },
  { l: "Pixel and account health checks", c: "FCCCC" },
];
