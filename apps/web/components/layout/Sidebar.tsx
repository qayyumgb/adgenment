"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useMemo, useState } from "react";
import clsx from "clsx";
import {
  ChevronLeft,
  ChevronDown,
  Bot,
  LayoutDashboard,
  Megaphone,
  Target,
  Palette,
  BarChart3,
  TrendingUp,
  Wallet,
  CreditCard,
  Settings,
  Bell,
  HelpCircle,
  Plus,
  Plug,
  type LucideIcon,
} from "lucide-react";
import ConnectModal from "@/components/connect/ConnectModal";
import { useApi } from "@/hooks/useApi";
import { useUser } from "@clerk/nextjs";

type NavLink = {
  kind: "link";
  label: string;
  href: string;
  icon: LucideIcon;
  badge?: { text: string; variant: "count" | "new" };
};

type NavAction = {
  kind: "action";
  label: string;
  action: "connect";
  icon: LucideIcon;
  badge?: { text: string; variant: "count" | "new" };
};

type NavItem = NavLink | NavAction;

type NavGroup = {
  label: string;
  items: NavItem[];
};

const NAV_GROUPS: NavGroup[] = [
  {
    label: "Overview",
    items: [
      {
        kind: "link",
        label: "Dashboard",
        href: "/dashboard",
        icon: LayoutDashboard,
      },
    ],
  },
  {
    label: "Advertising",
    items: [
      {
        kind: "link",
        label: "Campaigns",
        href: "/campaigns",
        icon: Megaphone,
        badge: { text: "12", variant: "count" },
      },
      { kind: "link", label: "Audiences", href: "/audiences", icon: Target },
      { kind: "link", label: "Creatives", href: "/creatives", icon: Palette },
      {
        kind: "action",
        label: "Connect Apps",
        action: "connect",
        icon: Plug,
      },
    ],
  },
  {
    label: "Intelligence",
    items: [
      {
        kind: "link",
        label: "Analytics",
        href: "/analytics",
        icon: BarChart3,
      },
      {
        kind: "link",
        label: "AI Planner",
        href: "/ai-planner",
        icon: Bot,
        badge: { text: "NEW", variant: "new" },
      },
      {
        kind: "link",
        label: "Budget Optimizer",
        href: "/budget-optimizer",
        icon: Wallet,
        badge: { text: "AI", variant: "new" },
      },
      {
        kind: "link",
        label: "Insights",
        href: "/insights",
        icon: TrendingUp,
      },
    ],
  },
  {
    label: "Account",
    items: [
      {
        kind: "link",
        label: "Billing",
        href: "/billing",
        icon: CreditCard,
      },
      {
        kind: "link",
        label: "Settings",
        href: "/settings",
        icon: Settings,
      },
    ],
  },
];

const PLATFORM_META: Record<
  string,
  { name: string; color: string; initial: string }
> = {
  META: { name: "Meta", color: "#1877F2", initial: "M" },
  GOOGLE: { name: "Google", color: "#EA4335", initial: "G" },
  TIKTOK: { name: "TikTok", color: "#010101", initial: "T" },
  LINKEDIN: { name: "LinkedIn", color: "#0A66C2", initial: "in" },
  YOUTUBE: { name: "YouTube", color: "#FF0000", initial: "Y" },
  SNAPCHAT: { name: "Snapchat", color: "#FFFC00", initial: "S" },
  PINTEREST: { name: "Pinterest", color: "#E60023", initial: "P" },
  X: { name: "X", color: "#0f172a", initial: "X" },
};

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
}

export default function Sidebar({ collapsed, onToggle }: SidebarProps) {
  const pathname = usePathname();
  const { user } = useUser();
  const [connectOpen, setConnectOpen] = useState(false);

  const displayName =
    user?.fullName ||
    [user?.firstName, user?.lastName].filter(Boolean).join(" ") ||
    user?.username ||
    user?.primaryEmailAddress?.emailAddress?.split("@")[0] ||
    "Account";
  const displayEmail = user?.primaryEmailAddress?.emailAddress ?? "";
  const initials = (() => {
    const src = displayName;
    return (
      src
        .split(/\s+|@/)
        .filter(Boolean)
        .slice(0, 2)
        .map((p) => p[0]?.toUpperCase())
        .join("") || "?"
    );
  })();

  // Live counts + connected platforms — fed into nav badges + bottom strip.
  // We depend on `pathname` so the counts auto-refresh whenever the user
  // navigates between routes. Cheap (limit=1) so re-firing every nav is fine.
  // This is also how the sidebar picks up new campaigns after a Sync or
  // Create from the campaigns page.
  const campaignsQ = useApi(
    (client) => client.getCampaigns({ limit: "1" }),
    [pathname]
  );
  const adAccountsQ = useApi(
    (client) => client.getAdAccounts(),
    [pathname]
  );

  const campaignBadge = campaignsQ.data?.total ?? 0;
  const connectedPlatforms = useMemo(() => {
    const seen = new Set<string>();
    return (adAccountsQ.data ?? [])
      .filter((a) => a.isActive)
      .filter((a) => {
        if (seen.has(a.platform)) return false;
        seen.add(a.platform);
        return true;
      });
  }, [adAccountsQ.data]);

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
          {collapsed ? (
            // Just the icon when collapsed
            <div className="relative">
              <Image
                src="/brand/advertix-icon.png"
                alt="Advertix"
                width={36}
                height={36}
                className="h-9 w-9 rounded-xl"
              />
              <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full border-2 border-[#0f172a] bg-emerald-400" />
            </div>
          ) : (
            // Full horizontal wordmark when expanded — sidebar bg is dark so use white
            <Image
              src="/brand/advertix-logo-white.png"
              alt="Advertix"
              width={140}
              height={32}
              className="h-7 w-auto"
              priority
            />
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
                  const Icon = item.icon;
                  const active = item.kind === "link" && isActive(item.href);
                  const key =
                    item.kind === "link" ? item.href : `action:${item.action}`;

                  const inner = (
                    <>
                      <Icon
                        className={clsx(
                          "h-[18px] w-[18px] shrink-0",
                          active ? "text-white" : "text-slate-400"
                        )}
                        strokeWidth={active ? 2.25 : 2}
                      />
                      {!collapsed && (
                        <>
                          <span className="flex-1 truncate">{item.label}</span>
                          {item.badge &&
                            (() => {
                              // Live override: Campaigns badge shows real count.
                              const text =
                                item.kind === "link" &&
                                item.href === "/campaigns" &&
                                item.badge.variant === "count"
                                  ? String(campaignBadge)
                                  : item.badge.text;
                              return item.badge.variant === "new" ? (
                                <span className="rounded-md bg-primary/20 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-primary-300">
                                  {text}
                                </span>
                              ) : (
                                <span className="rounded-md bg-white/10 px-1.5 py-0.5 text-[10px] font-semibold text-slate-300">
                                  {text}
                                </span>
                              );
                            })()}
                        </>
                      )}
                    </>
                  );

                  return (
                    <li key={key} className="relative group">
                      {item.kind === "link" ? (
                        <Link
                          href={item.href}
                          className={clsx(
                            "nav-item",
                            active && "active",
                            collapsed && "justify-center px-0"
                          )}
                          title={collapsed ? item.label : undefined}
                        >
                          {inner}
                        </Link>
                      ) : (
                        <button
                          type="button"
                          onClick={() => {
                            if (item.action === "connect") {
                              setConnectOpen(true);
                            }
                          }}
                          className={clsx(
                            "nav-item w-full text-left",
                            collapsed && "justify-center px-0"
                          )}
                          title={collapsed ? item.label : undefined}
                        >
                          {inner}
                        </button>
                      )}
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
            {adAccountsQ.loading ? (
              <span className="text-[10px] font-medium text-slate-500">
                Loading…
              </span>
            ) : connectedPlatforms.length === 0 ? (
              <button
                type="button"
                onClick={() => setConnectOpen(true)}
                className="text-[10px] font-semibold text-slate-500 transition hover:text-primary"
              >
                No platforms connected — connect now →
              </button>
            ) : (
              connectedPlatforms.map((acc) => {
                const meta = PLATFORM_META[acc.platform] ?? {
                  name: acc.platform,
                  color: "#475569",
                  initial: acc.platform.charAt(0),
                };
                return (
                  <button
                    key={acc.id}
                    type="button"
                    title={`${meta.name} · ${acc.accountName}`}
                    onClick={() => setConnectOpen(true)}
                    className="flex h-7 w-7 items-center justify-center rounded-md text-[10px] font-bold text-white shadow-sm transition hover:scale-110"
                    style={{
                      backgroundColor: meta.color,
                      color:
                        acc.platform === "SNAPCHAT" ? "#0f172a" : "#ffffff",
                    }}
                  >
                    {meta.initial}
                  </button>
                );
              })
            )}
            {connectedPlatforms.length < 6 && (
              <button
                type="button"
                title="Connect platform"
                onClick={() => setConnectOpen(true)}
                className="flex h-7 w-7 items-center justify-center rounded-md border border-dashed border-white/15 text-slate-500 transition hover:border-primary hover:text-primary"
              >
                <Plus className="h-3.5 w-3.5" />
              </button>
            )}
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
            <UserAvatar initials={initials} avatarUrl={user?.imageUrl} />
          </div>
        ) : (
          <div className="flex items-center gap-2.5 rounded-xl px-2 py-1.5 transition hover:bg-white/[0.04]">
            <UserAvatar initials={initials} avatarUrl={user?.imageUrl} />
            <div className="min-w-0 flex-1 leading-tight">
              <div className="truncate text-xs font-semibold text-white">
                {displayName}
              </div>
              <div className="truncate text-[10px] text-slate-400">
                {displayEmail}
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

      <ConnectModal
        open={connectOpen}
        onClose={() => setConnectOpen(false)}
      />
    </aside>
  );
}

function UserAvatar({
  initials,
  avatarUrl,
}: {
  initials: string;
  avatarUrl?: string;
}) {
  return (
    <div className="relative flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 text-xs font-bold text-white shadow-md ring-2 ring-white/10">
      {avatarUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={avatarUrl}
          alt={initials}
          className="h-full w-full object-cover"
        />
      ) : (
        initials
      )}
      <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-[#0f172a] bg-emerald-400" />
    </div>
  );
}
