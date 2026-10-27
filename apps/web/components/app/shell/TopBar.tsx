"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useRef, useState, useEffect } from "react";
import { UserButton } from "@clerk/nextjs";
import { Bell, CircleHelp, Menu as MenuIcon, Moon, MoreHorizontal, Search, ShieldCheck, Sparkles, Sun } from "lucide-react";
import { useApi } from "@/hooks/useApi";
import { cn } from "@/lib/cn";
import { IconButton } from "@/components/app/ui";
import { useEscape, useFocusTrap, useScrollLock } from "@/components/app/ui/overlay-hooks";
import { useTheme } from "@/components/app/theme/ThemeProvider";
import { useClientScope } from "./ClientContext";
import { ClientSwitcherMenu } from "./ClientSwitcher";
import { SidebarContent } from "./Sidebar";
import { MOBILE_TABS, isActive } from "./nav";
import { openCommandPalette } from "./CommandPalette";
import { ROLE_LABEL } from "@/components/app/team/access";

const HELP_HREF = "mailto:support@advertix.io";

function ThemeButton({ size = 36 }: { size?: 36 | 38 }) {
  const { resolved, toggle } = useTheme();
  return (
    <IconButton label={resolved === "dark" ? "Switch to light theme" : "Switch to dark theme"} size={size} onClick={toggle}>
      {resolved === "dark" ? <Moon size={18} /> : <Sun size={18} />}
    </IconButton>
  );
}

/** No alerts backend yet (Track C, F1): visibly disabled with the reason. */
function AlertsButton({ size = 36 }: { size?: 36 | 38 }) {
  return (
    <IconButton label="Alerts inbox — coming soon" size={size} disabled aria-disabled="true">
      <Bell size={18} />
    </IconButton>
  );
}

function RolePill() {
  const { client, hasMultiple } = useClientScope();
  const me = useApi((api) => api.getMe(), [], { key: "me" });
  if (!me.data?.workspace) return null;
  const role = me.data.access?.role ?? (me.data.user && me.data.workspace.ownerId === me.data.user.id ? "OWNER" : null);
  const viewOnly = role === "ANALYST" || role === "CLIENT_VIEWER";
  const scope = client ? client.name : hasMultiple ? "all clients" : "workspace";
  return (
    <span
      title={viewOnly ? "You can view and export; changes need a Media buyer or Owner." : "Your access level"}
      className="mr-2 hidden h-9 flex-none items-center gap-[7px] whitespace-nowrap rounded-full border border-brand-soft-2 bg-brand-soft px-3.5 text-[13px] font-semibold text-brand-ink min-[1100px]:inline-flex"
    >
      <ShieldCheck size={15} aria-hidden="true" />
      {role ? ROLE_LABEL[role] : "Member"} · {viewOnly ? "view only" : scope}
    </span>
  );
}

/** Desktop top bar (guide §3.1): 64px, search, role pill, alerts, theme, help, avatar. */
export function TopBar() {
  return (
    <header className="flex h-16 flex-none items-center gap-1 border-b border-line bg-surface px-6">
      {/* Opens the ⌘K command palette (C3). */}
      <button
        type="button"
        onClick={openCommandPalette}
        aria-label="Search pages, clients, campaigns and actions"
        className="flex h-10 min-w-0 max-w-[440px] flex-[0_1_440px] items-center gap-2.5 rounded-ctl border border-line-2 bg-surface px-3 text-left text-ink-3 transition-colors hover:border-line-2 hover:bg-surface-2 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-brand-soft"
      >
        <Search size={16} className="flex-none" aria-hidden="true" />
        <span className="min-w-0 flex-1 truncate">Search campaigns, clients, pages</span>
        <span className="rounded-md border border-line-2 px-1.5 text-xs text-ink-2">⌘K</span>
      </button>
      <div className="flex-1" />
      <RolePill />
      <AlertsButton />
      <ThemeButton />
      <a
        href={HELP_HREF}
        aria-label="Help — email support"
        title="Help — email support"
        className="inline-flex h-9 w-9 flex-none items-center justify-center rounded-ctl text-ink-2 transition-colors hover:bg-surface-2 hover:text-ink focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-brand-soft"
      >
        <CircleHelp size={18} />
      </a>
      <span className="ml-1.5 flex flex-none items-center">
        <UserButton appearance={{ elements: { avatarBox: "h-[34px] w-[34px]" } }} />
      </span>
    </header>
  );
}

/** Mobile drawer (guide §3.2): the full sidebar in a left sheet over a 42% overlay. */
function MobileDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  useEscape(open, onClose);
  useScrollLock(open);
  useFocusTrap(open, ref);
  if (!open) return null;
  return (
    <>
      <div className="fixed inset-0 z-[60] bg-[rgba(12,11,18,.42)]" onClick={onClose} aria-hidden="true" />
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-label="Navigation"
        className="fixed inset-y-0 left-0 z-[61] w-[min(300px,86vw)] overflow-y-auto border-r border-line bg-surface shadow-pop"
      >
        <SidebarContent onNavigate={onClose} />
      </div>
    </>
  );
}

/** Mobile app bar (guide §3.2): 56px — menu, client chip, alerts, theme. */
export function MobileAppBar() {
  const [drawer, setDrawer] = useState(false);
  const pathname = usePathname();
  useEffect(() => setDrawer(false), [pathname]);
  return (
    <>
      <header className="relative flex h-14 flex-none items-center gap-1 border-b border-line bg-surface px-2">
        <IconButton label="Open navigation" size={38} onClick={() => setDrawer(true)}>
          <MenuIcon size={20} />
        </IconButton>
        <ClientSwitcherMenu variant="chip" />
        <IconButton label="Search" size={38} onClick={openCommandPalette}>
          <Search size={19} />
        </IconButton>
        <AlertsButton size={38} />
        <ThemeButton size={38} />
      </header>
      <MobileDrawer open={drawer} onClose={() => setDrawer(false)} />
      <BottomTabBar onMore={() => setDrawer(true)} />
    </>
  );
}

/** Bottom tab bar (guide §3.2): 66px, Plan as a raised gradient tile. */
function BottomTabBar({ onMore }: { onMore: () => void }) {
  const pathname = usePathname();
  const { scoped } = useClientScope();
  const inBar = MOBILE_TABS.some((t) => isActive(pathname, t));
  return (
    <nav
      aria-label="Primary"
      className="fixed inset-x-0 bottom-0 z-50 grid h-[66px] grid-cols-5 items-center border-t border-line bg-surface px-1.5 pb-[env(safe-area-inset-bottom)]"
    >
      {MOBILE_TABS.map((t) => {
        const active = isActive(pathname, t);
        const Icon = t.icon;
        if (t.label === "Plan") {
          return (
            <Link key={t.href} href={scoped(t.href)} aria-current={active ? "page" : undefined} className="flex flex-col items-center gap-0.5 text-[11px] font-semibold text-ink-2 no-underline">
              <span className="-mt-3.5 flex h-10 w-10 items-center justify-center rounded-menu bg-[image:var(--grad)] shadow-[0_6px_16px_rgba(100,72,242,.35)]">
                <Sparkles size={18} strokeWidth={2.25} className="text-white" aria-hidden="true" />
              </span>
              Plan
            </Link>
          );
        }
        return (
          <Link
            key={t.href}
            href={scoped(t.href)}
            aria-current={active ? "page" : undefined}
            className={cn("flex flex-col items-center gap-[3px] text-[11px] no-underline", active ? "font-semibold text-brand" : "font-medium text-ink-3")}
          >
            <Icon size={21} aria-hidden="true" />
            {t.label}
          </Link>
        );
      })}
      <button
        type="button"
        onClick={onMore}
        className={cn("flex flex-col items-center gap-[3px] text-[11px]", inBar ? "font-medium text-ink-3" : "font-semibold text-brand")}
      >
        <MoreHorizontal size={21} aria-hidden="true" />
        More
      </button>
    </nav>
  );
}
