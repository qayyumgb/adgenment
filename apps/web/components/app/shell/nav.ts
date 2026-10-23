import {
  BarChart3,
  Image as ImageIcon,
  LayoutDashboard,
  Megaphone,
  Plug,
  SlidersHorizontal,
  Sparkles,
  Users,
  Wallet,
  type LucideIcon,
} from "lucide-react";

/**
 * App navigation (guide §3.1 + §2.4 icon mapping).
 *
 * One destination points at today's route until its rebuilt page exists
 * (docs/DASHBOARD_REDESIGN_PLAN.md § 5.3): Connections → Settings ›
 * Integrations (A13). /insights now redirects to Analytics, which absorbed it (A10), and
 * /budget-optimizer to Budgets (A11).
 */
export type NavItem = {
  label: string;
  href: string;
  icon: LucideIcon;
  /** Extra path prefixes that mark this item active. */
  match?: string[];
  /** Live count shown as a pill (resolved by the sidebar). */
  count?: "campaigns";
  /** Brand-coloured icon (AI Planner's sparkle). */
  brandIcon?: boolean;
};

export const WORKSPACE_NAV: NavItem[] = [
  { label: "Overview", href: "/dashboard", icon: LayoutDashboard },
  { label: "Campaigns", href: "/campaigns", icon: Megaphone, count: "campaigns" },
  { label: "Creatives", href: "/creatives", icon: ImageIcon },
  { label: "Audiences", href: "/audiences", icon: Users },
  { label: "Analytics", href: "/analytics", icon: BarChart3, match: ["/insights"] },
  { label: "Budgets", href: "/budgets", icon: Wallet, match: ["/budget-optimizer"] },
  { label: "AI Planner", href: "/ai-planner", icon: Sparkles, brandIcon: true },
];

export const ACCOUNT_NAV: NavItem[] = [
  // TODO(A13): → /connections
  { label: "Connections", href: "/settings?tab=integrations", icon: Plug, match: ["/connections"] },
  { label: "Settings", href: "/settings", icon: SlidersHorizontal, match: ["/billing"] },
];

/** Mobile bottom tab bar (guide §3.2): Overview, Campaigns, Plan, Analytics, More. */
export const MOBILE_TABS: NavItem[] = [
  { label: "Overview", href: "/dashboard", icon: LayoutDashboard },
  { label: "Campaigns", href: "/campaigns", icon: Megaphone },
  { label: "Plan", href: "/ai-planner", icon: Sparkles },
  { label: "Analytics", href: "/analytics", icon: BarChart3, match: ["/insights"] },
];

export function isActive(pathname: string, item: NavItem): boolean {
  // Links with a query (Connections → /settings?tab=…) only match their
  // explicit routes, so Settings and Connections don't both light up.
  const base = item.href.includes("?") ? [] : [item.href];
  const prefixes = [...base, ...(item.match ?? [])];
  return prefixes.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}
