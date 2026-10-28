/**
 * Marketing pricing — single source for the Pricing page and every other
 * page that quotes a price (e.g. "Agency plan · $199/mo" on /agencies).
 *
 * Prices confirmed 2026-10-28: Founder $22, Team $79, Agency $199,
 * Enterprise custom. Stripe billing (C11) charges these.
 * Every plan starts with a 14-day free trial (no card; Team limits, 100 AI
 * credits). Limits mirror the API's lib/plans.ts.
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
    monthly: 22,
    limits: "1 BRAND · $25K/MO · 2 SEATS",
    items: [
      "Meta, Google, TikTok and LinkedIn",
      "100 AI credits a month",
      "AI Planner and decision feed",
      "Budget allocator and pacing",
      "Creative studio",
      "Email alerts",
      "7-day undo and history",
    ],
    spendLimit: 25_000,
    clientLimit: 1,
  },
  {
    name: "Team",
    for: "In-house growth teams",
    monthly: 79,
    limits: "5 BRANDS · $100K/MO · 5 SEATS",
    items: [
      "Everything in Founder",
      "400 AI credits a month",
      "Roles for your team",
      "Approvals for big budget changes",
      "Smart hours scheduling · coming soon",
      "Experiments · coming soon",
      "Slack alerts · coming soon",
    ],
    spendLimit: 100_000,
    clientLimit: 5,
  },
  {
    name: "Agency",
    for: "Agencies with many clients",
    monthly: 199,
    limits: "10 CLIENTS · $250K/MO · 10 SEATS",
    items: [
      "Everything in Team",
      "Unlimited AI credits",
      "Free client viewer seats",
      "Priority support",
      "Auto-apply and safety rules per client",
      "Client portal links",
      "Scheduled client reports with PDF",
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
      "Tailored limits for clients and spend",
      "Onboarding with our team",
      "Shopify and GA4 revenue · coming soon",
      "Talk to us about security reviews",
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
