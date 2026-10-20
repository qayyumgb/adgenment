/**
 * Marketing pricing — single source for the Pricing page and every other
 * page that quotes a price (e.g. "Agency plan · $499/mo" on /agencies).
 *
 * TODO(copy): tiers, limits and the beta offer are proposals from the
 * mockup; confirm before launch (docs/MARKETING_REDESIGN_PLAN.md § 2, item 8).
 */

export type Plan = {
  name: "Founder" | "Team" | "Agency" | "Enterprise";
  for: string;
  /** Monthly price in USD; null = custom (Enterprise). */
  monthly: number | null;
  limits: string;
  items: string[];
  /** Managed spend ceiling per month (USD). */
  spendLimit: number;
  /** Brands / clients ceiling. */
  clientLimit: number;
};

export const PLANS: Plan[] = [
  {
    name: "Founder",
    for: "One brand, run by you",
    monthly: 79,
    limits: "1 BRAND · $25K/MO · 2 SEATS",
    items: [
      "All five platforms",
      "AI Planner and decision feed",
      "Budget allocator and pacing",
      "Creative studio · 40 drafts/mo",
      "Email alerts",
      "7-day undo and history",
    ],
    spendLimit: 25_000,
    clientLimit: 1,
  },
  {
    name: "Team",
    for: "In-house growth teams",
    monthly: 199,
    limits: "5 BRANDS · $100K/MO · 5 SEATS",
    items: [
      "Everything in Founder",
      "Approvals and guardrails",
      "Smart hours scheduling",
      "Experiments",
      "Slack alerts",
      "200 creative drafts/mo",
    ],
    spendLimit: 100_000,
    clientLimit: 5,
  },
  {
    name: "Agency",
    for: "Agencies with many clients",
    monthly: 499,
    limits: "10 CLIENTS · $250K/MO · 10 SEATS",
    items: [
      "Everything in Team",
      "Per-client autonomy",
      "White-label client portal",
      "Scheduled client reports",
      "Free client viewer seats",
      "Priority support",
    ],
    spendLimit: 250_000,
    clientLimit: 10,
  },
  {
    name: "Enterprise",
    for: "Large agencies and groups",
    monthly: null,
    limits: "UNLIMITED",
    items: [
      "Everything in Agency",
      "SSO / SAML and SCIM",
      "Audit export",
      "Warehouse revenue",
      "Dedicated success manager",
      "Uptime SLA and DPA",
    ],
    spendLimit: Infinity,
    clientLimit: Infinity,
  },
];

/** Yearly billing = two months free, shown as a per-month figure. */
export const yearlyMonthly = (monthly: number) => Math.round((monthly * 10) / 12);

export const planByName = (name: Plan["name"]) => PLANS.find((p) => p.name === name)!;

/** Compact money for spend figures: $60k, $5k, $600. */
export const kMoney = (n: number) => "$" + (n >= 1000 ? `${n / 1000}k` : n);
