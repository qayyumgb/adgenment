"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useState, useEffect } from "react";
import { useUser } from "@clerk/nextjs";
import { Plus } from "lucide-react";
import { useApi } from "@/hooks/useApi";
import { cn } from "@/lib/cn";
import { ConnectDialog } from "@/components/app/connections/ConnectDialog";
import { PlatformBadge, type PlatformKey } from "@/components/app/ui";
import { useClientScope } from "./ClientContext";
import { ClientSwitcherMenu } from "./ClientSwitcher";
import { ACCOUNT_NAV, WORKSPACE_NAV, isActive, type NavItem } from "./nav";
import { ROLE_LABEL } from "@/components/app/team/access";

/**
 * Sidebar content (guide §3.1): logo, client switcher, workspace nav,
 * Connections + Settings, ad-accounts box, user row. Rendered in the desktop
 * sidebar and inside the mobile drawer.
 */

const BOX_PLATFORMS: PlatformKey[] = ["META", "GOOGLE", "TIKTOK", "SNAPCHAT", "LINKEDIN"];
// Platforms without a connector yet are always "coming soon" (plan decision 8).
const COMING_SOON = new Set<PlatformKey>(["SNAPCHAT"]);

function NavLink({ item, count, onNavigate }: { item: NavItem; count?: number; onNavigate?: () => void }) {
  const pathname = usePathname();
  const { scoped } = useClientScope();
  const active = isActive(pathname, item);
  const Icon = item.icon;
  return (
    <Link
      href={scoped(item.href)}
      onClick={onNavigate}
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex items-center gap-3 rounded-ctl px-2.5 py-[9px] no-underline transition-colors",
        "focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-brand-soft",
        active ? "bg-brand-soft font-semibold text-brand-ink" : "font-medium text-ink-2 hover:bg-surface-2 hover:text-ink"
      )}
    >
      <Icon size={18} strokeWidth={2} className={cn("flex-none", item.brandIcon && !active && "text-brand")} aria-hidden="true" />
      <span className="flex-1">{item.label}</span>
      {count !== undefined && (
        <span className="rounded-full bg-surface-3 px-[7px] text-xs tabular-nums text-ink-2">{count}</span>
      )}
    </Link>
  );
}

const PLATFORM_LABEL: Record<string, string> = { META: "Meta", GOOGLE: "Google Ads", TIKTOK: "TikTok", LINKEDIN: "LinkedIn" };

function AdAccountsBox({ onNavigate }: { onNavigate?: () => void }) {
  const { scoped, hasMultiple, unassignedAdAccounts } = useClientScope();
  const accounts = useApi((api) => api.getAdAccounts(), [], { key: "ad-accounts" });
  const [connectOpen, setConnectOpen] = useState(false);
  const active = (accounts.data ?? []).filter((a) => a.isActive);
  const connected = new Set(active.map((a) => a.platform as PlatformKey));
  // The soonest platform access to expire within a week (A13), for the warn line.
  const expiring = active
    .filter((a) => a.tokenExpiresAt && new Date(a.tokenExpiresAt).getTime() - Date.now() < 7 * 86_400_000)
    .sort((a, b) => new Date(a.tokenExpiresAt!).getTime() - new Date(b.tokenExpiresAt!).getTime())[0];
  const expiringDays = expiring ? Math.ceil((new Date(expiring.tokenExpiresAt!).getTime() - Date.now()) / 86_400_000) : null;

  if (accounts.error) {
    return (
      <div className="flex flex-col gap-2 rounded-menu bg-surface-2 p-3.5 text-xs text-ink-2">
        Couldn’t load ad accounts.
        <button
          type="button"
          onClick={() => void accounts.refetch()}
          className="self-start font-semibold text-brand hover:text-brand-hover focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-brand-soft"
        >
          Try again
        </button>
      </div>
    );
  }

  if (!accounts.loading && active.length === 0) {
    return (
      <div className="flex flex-col gap-2.5 rounded-menu bg-surface-2 p-3.5">
        <div className="text-xs text-ink-2">No ad accounts connected yet.</div>
        <button
          type="button"
          onClick={() => setConnectOpen(true)}
          className="inline-flex h-8 items-center justify-center gap-1.5 rounded-lg bg-brand text-[13px] font-semibold text-white hover:bg-brand-hover focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-brand-soft"
        >
          <Plus size={14} strokeWidth={2.5} /> Connect an account
        </button>
        <ConnectDialog open={connectOpen} onClose={() => setConnectOpen(false)} />
      </div>
    );
  }

  return (
    <Link
      href={scoped(hasMultiple && unassignedAdAccounts > 0 && !expiring ? "/connections?filter=unassigned" : expiring ? "/connections?filter=attention" : "/connections")}
      onClick={onNavigate}
      className="flex flex-none flex-col gap-2.5 rounded-menu bg-surface-2 p-3.5 text-inherit no-underline transition-colors hover:bg-surface-3 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-brand-soft"
    >
      <div className="flex justify-between text-xs text-ink-2">
        <span>Ad accounts</span>
        <span className="font-semibold text-ink">{accounts.loading ? "…" : `${active.length} connected`}</span>
      </div>
      <div className="flex gap-[5px]">
        {BOX_PLATFORMS.map((p) => {
          const on = connected.has(p);
          const soon = COMING_SOON.has(p) && !on;
          return (
            <span key={p} title={soon ? `${p === "SNAPCHAT" ? "Snapchat" : p} · coming soon` : on ? undefined : "Not connected"} className={cn(!on && "opacity-35")}>
              <PlatformBadge platform={p} size={24} />
            </span>
          );
        })}
      </div>
      {expiring && expiringDays !== null && (
        <div className="text-xs font-medium text-warn">
          {PLATFORM_LABEL[expiring.platform] ?? expiring.platform} access {expiringDays <= 0 ? "has expired · Reconnect" : `expires in ${expiringDays} day${expiringDays === 1 ? "" : "s"} · Renew`}
        </div>
      )}
      {!expiring && hasMultiple && unassignedAdAccounts > 0 && (
        <div className="text-xs font-medium text-warn">
          {unassignedAdAccounts} account{unassignedAdAccounts === 1 ? "" : "s"} not assigned to a client · Assign
        </div>
      )}
    </Link>
  );
}

function UserRow() {
  const { user } = useUser();
  const me = useApi((api) => api.getMe(), [], { key: "me" });
  const name = user?.fullName || me.data?.user?.name || user?.primaryEmailAddress?.emailAddress || "You";
  const initials = name
    .split(/\s+/)
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
  const isOwner = me.data?.workspace && me.data.user && me.data.workspace.ownerId === me.data.user.id;
  return (
    <div className="flex flex-none items-center gap-2.5 px-1.5">
      {user?.imageUrl ? (
        <Image src={user.imageUrl} alt="" width={34} height={34} className="h-[34px] w-[34px] rounded-full" />
      ) : (
        <span className="flex h-[34px] w-[34px] items-center justify-center rounded-full bg-surface-3 text-xs font-semibold">{initials}</span>
      )}
      <span className="flex min-w-0 flex-col leading-tight">
        <span className="truncate font-semibold">{name}</span>
        {me.data?.workspace && <span className="text-xs text-ink-2">{me.data.access ? ROLE_LABEL[me.data.access.role] : isOwner ? "Owner" : "Member"}</span>}
      </span>
    </div>
  );
}

export function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  const { clientId } = useClientScope();
  const campaigns = useApi((api) => api.getCampaigns({ limit: 1, clientId: clientId ?? undefined, includeLatestMetrics: "false" }), [clientId], {
    key: "campaign-count",
  });
  // The sidebar stays mounted across pages, so recount on every page change
  // (campaigns are added by syncs, connects and the wizard elsewhere).
  const pathname = usePathname();
  const { refetch: recount } = campaigns;
  useEffect(() => {
    void recount();
  }, [pathname, recount]);

  return (
    <div className="flex h-full flex-col gap-[22px] px-4 py-[22px]">
      <Link href="/dashboard" onClick={onNavigate} className="flex h-[34px] flex-none items-center px-2" aria-label="Advertix home">
        <Image src="/brand/advertix-logo-black.png" alt="Advertix" width={103} height={30} priority className="h-[30px] w-auto dark:hidden" />
        <Image src="/brand/advertix-logo-white.png" alt="Advertix" width={103} height={30} priority className="hidden h-[30px] w-auto dark:block" />
      </Link>

      <ClientSwitcherMenu variant="card" />

      <nav aria-label="Workspace" className="flex flex-col gap-0.5">
        <div className="px-2.5 pb-1.5 text-xs text-ink-3">Workspace</div>
        {WORKSPACE_NAV.map((item) => (
          <NavLink
            key={item.href}
            item={item}
            onNavigate={onNavigate}
            count={item.count === "campaigns" ? campaigns.data?.total : undefined}
          />
        ))}
      </nav>
      <nav aria-label="Account" className="flex flex-col gap-0.5 border-t border-line pt-3.5">
        {ACCOUNT_NAV.map((item) => (
          <NavLink key={item.href} item={item} onNavigate={onNavigate} />
        ))}
      </nav>

      <div className="flex-1" />
      <AdAccountsBox onNavigate={onNavigate} />
      <UserRow />
    </div>
  );
}
