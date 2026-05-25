"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import clsx from "clsx";
import {
  Sparkles,
  ChevronLeft,
  ChevronDown,
  Bot,
  LayoutDashboard,
  Megaphone,
  Target,
  Palette,
  BarChart3,
  TrendingUp,
  CreditCard,
  Settings,
  Bell,
  HelpCircle,
  Plus,
  type LucideIcon,
} from "lucide-react";

type NavItem = {
  label: string;
  href: string;
  icon: LucideIcon;
  badge?: { text: string; variant: "count" | "new" };
};

type NavGroup = {
  label: string;
  items: NavItem[];
};

const NAV_GROUPS: NavGroup[] = [
  {
    label: "Overview",
    items: [{ label: "Dashboard", href: "/dashboard", icon: LayoutDashboard }],
  },
  {
    label: "Advertising",
    items: [
      {
        label: "Campaigns",
        href: "/campaigns",
        icon: Megaphone,
        badge: { text: "12", variant: "count" },
      },
      { label: "Audiences", href: "/audiences", icon: Target },
      { label: "Creatives", href: "/creatives", icon: Palette },
    ],
  },
  {
    label: "Intelligence",
    items: [
      { label: "Analytics", href: "/analytics", icon: BarChart3 },
      {
        label: "AI Planner",
        href: "/ai-planner",
        icon: Bot,
        badge: { text: "NEW", variant: "new" },
      },
      { label: "Insights", href: "/insights", icon: TrendingUp },
    ],
  },
  {
    label: "Account",
    items: [
      { label: "Billing", href: "/billing", icon: CreditCard },
      { label: "Settings", href: "/settings", icon: Settings },
    ],
  },
];

const PLATFORMS = [
  { name: "Meta", color: "#1877F2", initial: "M" },
  { name: "Google", color: "#EA4335", initial: "G" },
  { name: "TikTok", color: "#010101", initial: "T" },
  { name: "LinkedIn", color: "#0A66C2", initial: "in" },
];

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
}

export default function Sidebar({ collapsed, onToggle }: SidebarProps) {
  const pathname = usePathname();

  const isActive = (href: string) =>
    pathname === href || pathname?.startsWith(href + "/");

  return (
    <aside
      className={clsx(
        "fixed left-0 top-0 z-40 flex h-screen flex-col border-r transition-all duration-300 ease-out",
        collapsed ? "w-[72px]" : "w-[260px]"
      )}
      style={{
        backgroundColor: "var(--sidebar-bg)",
        borderColor: "var(--sidebar-border)",
      }}
    >
      {/* ── Logo ── */}
      <div
        className={clsx(
          "flex h-16 items-center border-b px-4",
          collapsed ? "justify-center" : "justify-between"
        )}
        style={{ borderColor: "var(--sidebar-border)" }}
      >
        <Link href="/dashboard" className="flex items-center gap-2.5">
          <div className="relative">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 via-indigo-600 to-purple-600 shadow-glow">
              <Sparkles className="h-5 w-5 text-white" strokeWidth={2.5} />
            </div>
            <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full border-2 border-[#0f172a] bg-emerald-400" />
          </div>
          {!collapsed && (
            <div className="leading-tight">
              <div className="text-sm font-bold tracking-tight text-white">
                AdGenius
              </div>
              <div className="text-[9px] font-bold uppercase tracking-[0.15em] text-primary-400">
                AI Platform
              </div>
            </div>
          )}
        </Link>
        {!collapsed && (
          <button
            type="button"
            onClick={onToggle}
            className="rounded-lg p-1.5 text-slate-400 transition hover:bg-white/5 hover:text-white"
            aria-label="Collapse sidebar"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
        )}
        {collapsed && (
          <button
            type="button"
            onClick={onToggle}
            className="absolute -right-3 top-20 hidden h-6 w-6 items-center justify-center rounded-full border border-white/10 bg-[#0f172a] text-slate-300 shadow-md transition hover:bg-primary hover:text-white"
            aria-label="Expand sidebar"
          />
        )}
      </div>

      {/* ── Workspace Selector ── */}
      {!collapsed && (
        <div className="px-3 pt-3">
          <button
            type="button"
            className="group flex w-full items-center gap-2.5 rounded-xl border border-white/5 bg-white/[0.03] px-2.5 py-2 transition hover:bg-white/[0.06]"
          >
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-fuchsia-500 via-pink-500 to-amber-400 text-xs font-bold text-white shadow-md">
              MW
            </div>
            <div className="flex-1 text-left leading-tight">
              <div className="text-xs font-semibold text-white">
                My Workspace
              </div>
              <div className="text-[10px] text-slate-400">Free Plan</div>
            </div>
            <ChevronDown className="h-4 w-4 text-slate-500 transition group-hover:text-slate-300 group-data-[open=true]:rotate-180" />
          </button>
        </div>
      )}

      {/* ── AI Planner Quick Action ── */}
      {!collapsed && (
        <div className="px-3 pt-3">
          <Link
            href="/ai-planner"
            className="group relative block overflow-hidden rounded-xl p-[1px]"
            style={{
              backgroundImage:
                "linear-gradient(135deg, #6366f1, #8b5cf6 50%, #ec4899)",
            }}
          >
            <div className="flex items-center gap-2.5 rounded-[11px] bg-[#0f172a] px-3 py-2.5 transition group-hover:bg-[#111d36]">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600">
                <Bot className="h-4 w-4 text-white" />
              </div>
              <div className="flex-1 leading-tight">
                <div className="text-xs font-semibold text-white">
                  AI Campaign Planner
                </div>
                <div className="text-[10px] text-slate-400 transition group-hover:text-primary-300">
                  Describe your goal →
                </div>
              </div>
            </div>
          </Link>
        </div>
      )}

      {/* ── Nav Groups ── */}
      <nav className="flex-1 overflow-y-auto px-3 py-4">
        <ul className="space-y-5">
          {NAV_GROUPS.map((group) => (
            <li key={group.label}>
              {!collapsed && (
                <div className="mb-1.5 px-3 text-[10px] font-bold uppercase tracking-[0.12em] text-slate-500">
                  {group.label}
                </div>
              )}
              <ul className="space-y-0.5">
                {group.items.map((item) => {
                  const active = isActive(item.href);
                  const Icon = item.icon;
                  return (
                    <li key={item.href} className="relative group">
                      <Link
                        href={item.href}
                        className={clsx(
                          "nav-item",
                          active && "active",
                          collapsed && "justify-center px-0"
                        )}
                        title={collapsed ? item.label : undefined}
                      >
                        <Icon
                          className={clsx(
                            "h-[18px] w-[18px] shrink-0",
                            active ? "text-white" : "text-slate-400"
                          )}
                          strokeWidth={active ? 2.25 : 2}
                        />
                        {!collapsed && (
                          <>
                            <span className="flex-1 truncate">
                              {item.label}
                            </span>
                            {item.badge &&
                              (item.badge.variant === "new" ? (
                                <span className="rounded-md bg-primary/20 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-primary-300">
                                  {item.badge.text}
                                </span>
                              ) : (
                                <span className="rounded-md bg-white/10 px-1.5 py-0.5 text-[10px] font-semibold text-slate-300">
                                  {item.badge.text}
                                </span>
                              ))}
                          </>
                        )}
                      </Link>
                      {collapsed && (
                        <div className="pointer-events-none absolute left-full top-1/2 z-50 ml-3 -translate-y-1/2 whitespace-nowrap rounded-md bg-slate-900 px-2 py-1 text-xs font-medium text-white opacity-0 shadow-lg ring-1 ring-white/10 transition-opacity duration-150 group-hover:opacity-100">
                          {item.label}
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            </li>
          ))}
        </ul>
      </nav>

      {/* ── Connected Platforms ── */}
      {!collapsed && (
        <div
          className="border-t px-4 py-3"
          style={{ borderColor: "var(--sidebar-border)" }}
        >
          <div className="mb-2 text-[10px] font-bold uppercase tracking-[0.12em] text-slate-500">
            Connected
          </div>
          <div className="flex items-center gap-1.5">
            {PLATFORMS.map((p) => (
              <button
                key={p.name}
                type="button"
                title={p.name}
                className="flex h-7 w-7 items-center justify-center rounded-md text-[10px] font-bold text-white shadow-sm transition hover:scale-110"
                style={{ backgroundColor: p.color }}
              >
                {p.initial}
              </button>
            ))}
            <button
              type="button"
              title="Connect platform"
              className="flex h-7 w-7 items-center justify-center rounded-md border border-dashed border-white/15 text-slate-500 transition hover:border-primary hover:text-primary"
            >
              <Plus className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* ── User Profile ── */}
      <div
        className="border-t p-3"
        style={{ borderColor: "var(--sidebar-border)" }}
      >
        {collapsed ? (
          <div className="flex justify-center">
            <UserAvatar />
          </div>
        ) : (
          <div className="flex items-center gap-2.5 rounded-xl px-2 py-1.5 transition hover:bg-white/[0.04]">
            <UserAvatar />
            <div className="min-w-0 flex-1 leading-tight">
              <div className="truncate text-xs font-semibold text-white">
                Alex Carter
              </div>
              <div className="truncate text-[10px] text-slate-400">
                alex@adgenius.ai
              </div>
            </div>
            <button
              type="button"
              aria-label="Notifications"
              className="relative rounded-md p-1.5 text-slate-400 transition hover:bg-white/5 hover:text-white"
            >
              <Bell className="h-4 w-4" />
              <span className="absolute right-1 top-1 h-1.5 w-1.5 rounded-full bg-rose-500" />
            </button>
            <button
              type="button"
              aria-label="Help"
              className="rounded-md p-1.5 text-slate-400 transition hover:bg-white/5 hover:text-white"
            >
              <HelpCircle className="h-4 w-4" />
            </button>
          </div>
        )}
      </div>
    </aside>
  );
}

function UserAvatar() {
  return (
    <div className="relative flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 text-xs font-bold text-white shadow-md ring-2 ring-white/10">
      AC
      <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-[#0f172a] bg-emerald-400" />
    </div>
  );
}
