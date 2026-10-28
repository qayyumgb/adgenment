import {
  BarChart3,
  CalendarRange,
  ClipboardCheck,
  Rocket,
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
 * Old routes redirect to their rebuilt pages (docs/DASHBOARD_REDESIGN_PLAN.md
 * § 5.3): /insights → Analytics (A10), /budget-optimizer → Budgets (A11),
 * /settings?tab=integrations → Connections (A13).
 */
export type NavItem = {
  label: string;
  href: string;
  icon: LucideIcon;
  /** Extra path prefixes that mark this item active. */
  match?: string[];
  /** Live count shown as a pill (resolved by the sidebar). */
  count?: "campaigns" | "approvals";
  /** Brand-coloured icon (AI Planner's sparkle). */
  brandIcon?: boolean;
};

export const WORKSPACE_NAV: NavItem[] = [
  { label: "Overview", href: "/dashboard", icon: LayoutDashboard },
  { label: "Campaigns", href: "/campaigns", icon: Megaphone, count: "campaigns" },
  { label: "Calendar", href: "/calendar", icon: CalendarRange },
  { label: "Creatives", href: "/creatives", icon: ImageIcon },
  { label: "Audiences", href: "/audiences", icon: Users },
  { label: "Analytics", href: "/analytics", icon: BarChart3, match: ["/insights"] },
  { label: "Budgets", href: "/budgets", icon: Wallet, match: ["/budget-optimizer"] },
  { label: "AI Planner", href: "/ai-planner", icon: Sparkles, brandIcon: true },
];

/** Getting started (C11): shown above the nav for owners until it's hidden from the page. */
export const SETUP_NAV: NavItem = { label: "Get started", href: "/setup", icon: Rocket };

export const ACCOUNT_NAV: NavItem[] = [
  { label: "Activity", href: "/activity", icon: ClipboardCheck, count: "approvals" },
  { label: "Connections", href: "/connections", icon: Plug },
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
  // Links with a query only match their explicit `match` routes.
  const base = item.href.includes("?") ? [] : [item.href];
  const prefixes = [...base, ...(item.match ?? [])];
  return prefixes.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}
