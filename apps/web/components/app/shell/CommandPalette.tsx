"use client";

import { useEffect, useId, useMemo, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Building2, CornerDownLeft, Moon, Plug, Plus, Search, SlidersHorizontal, Sparkles, Sun, UserPlus, Upload, X } from "lucide-react";
import { useAppRouter } from "@/hooks/useAppRouter";
import { useApi } from "@/hooks/useApi";
import { cn } from "@/lib/cn";
import { IconButton, PlatformBadge, type PlatformKey } from "@/components/app/ui";
import { useEscape, useFocusTrap, useScrollLock } from "@/components/app/ui/overlay-hooks";
import { useTheme } from "@/components/app/theme/ThemeProvider";
import { useAccess } from "@/components/app/team/access";
import { useClientScope } from "./ClientContext";
import { ACCOUNT_NAV, WORKSPACE_NAV } from "./nav";

/**
 * ⌘K command palette (plan C3): jump to any page, client or campaign, or run
 * a quick action. Opens with ⌘K / Ctrl+K anywhere in the app, or from the
 * top-bar search (`openCommandPalette()`). Actions follow the role (B6).
 */

const OPEN_EVENT = "advertix:command-palette";
/** Opens the palette from anywhere (the top-bar search, the mobile search button). */
export const openCommandPalette = () => window.dispatchEvent(new Event(OPEN_EVENT));

type Item = { id: string; group: string; label: string; sub?: string; icon: ReactNode; keywords?: string; run: () => void };

const SETTINGS_TABS = [
  { tab: "general", label: "Settings · General", keywords: "workspace profile delete time zone" },
  { tab: "team", label: "Settings · Team", keywords: "members invite roles seats" },
  { tab: "ai", label: "Settings · AI & automation", keywords: "autonomy autopilot" },
  { tab: "notifications", label: "Settings · Notifications", keywords: "alerts email" },
  { tab: "billing", label: "Settings · Billing", keywords: "plan usage" },
];

/** Higher is better; 0 = no match. Every word of the query must appear. */
function score(query: string, label: string, extra = "") {
  const q = query.trim().toLowerCase();
  if (!q) return 1;
  const l = label.toLowerCase();
  const hay = `${l} ${extra.toLowerCase()}`;
  const words = q.split(/\s+/);
  if (!words.every((w) => hay.includes(w))) return 0;
  if (l.startsWith(q)) return 4;
  if (l.split(/[\s·—\-/]+/).some((w) => w.startsWith(words[0]))) return 3;
  return l.includes(q) ? 2 : 1;
}

export function CommandPalette() {
  const router = useAppRouter();
  const access = useAccess();
  const { resolved, toggle } = useTheme();
  const { clients, clientId, hasMultiple, setClient, scoped } = useClientScope();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const panelRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const listId = useId();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    const onOpen = () => setOpen(true);
    window.addEventListener("keydown", onKey);
    window.addEventListener(OPEN_EVENT, onOpen);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener(OPEN_EVENT, onOpen);
    };
  }, []);
  useEffect(() => {
    if (open) {
      setQuery("");
      setActive(0);
    }
  }, [open]);

  const close = () => setOpen(false);
  useEscape(open, close);
  useScrollLock(open);
  useFocusTrap(open, panelRef);

  // Campaigns load the first time the palette opens, then come from the cache.
  const campaigns = useApi((c) => (open ? c.getCampaigns({ limit: 500, includeLatestMetrics: "false" }) : new Promise<never>(() => {})), [open], {
    key: "palette-campaigns",
  });

  const go = (href: string) => () => (close(), router.push(scoped(href)));

  const items = useMemo<Item[]>(() => {
    const clientName = (id: string | null | undefined) => (id ? clients.find((c) => c.id === id)?.name : undefined);
    const actions: Item[] = [
      ...(access.can("edit") ? [{ id: "a-new", group: "Actions", label: "New campaign", icon: <Plus size={16} />, keywords: "create launch publish", run: go("/campaigns/new") }] : []),
      { id: "a-plan", group: "Actions", label: "Plan a campaign with AI", icon: <Sparkles size={16} />, keywords: "planner brief forecast", run: go("/ai-planner") },
      ...(access.can("edit") ? [{ id: "a-upload", group: "Actions", label: "Upload or generate creatives", icon: <Upload size={16} />, keywords: "creative studio image video", run: go("/creatives") }] : []),
      ...(access.can("connect") ? [{ id: "a-connect", group: "Actions", label: "Connect an ad account", icon: <Plug size={16} />, keywords: "meta google tiktok linkedin oauth", run: go("/connections") }] : []),
      ...(access.can("team") ? [{ id: "a-invite", group: "Actions", label: "Invite a teammate", icon: <UserPlus size={16} />, keywords: "team member role", run: go("/settings?tab=team") }] : []),
      {
        id: "a-theme",
        group: "Actions",
        label: resolved === "dark" ? "Switch to light theme" : "Switch to dark theme",
        icon: resolved === "dark" ? <Sun size={16} /> : <Moon size={16} />,
        keywords: "theme dark light mode",
        run: () => (close(), toggle()),
      },
    ];
    const pages: Item[] = [
      ...[...WORKSPACE_NAV, ...ACCOUNT_NAV].map((n) => {
        const Icon = n.icon;
        return { id: `p-${n.href}`, group: "Pages", label: n.label, icon: <Icon size={16} />, run: go(n.href) };
      }),
      ...SETTINGS_TABS.map((t) => ({ id: `s-${t.tab}`, group: "Pages", label: t.label, keywords: t.keywords, icon: <SlidersHorizontal size={16} />, run: go(`/settings?tab=${t.tab}`) })),
    ];
    const clientItems: Item[] = hasMultiple
      ? [
          ...(clientId ? [{ id: "c-all", group: "Clients", label: "All clients", sub: "Show every client", icon: <Building2 size={16} />, run: () => (close(), setClient(null)) }] : []),
          ...clients
            .filter((c) => c.id !== clientId)
            .map((c) => ({ id: `c-${c.id}`, group: "Clients", label: c.name, sub: c.vertical ?? "Switch to this client", icon: <Building2 size={16} />, keywords: "client switch", run: () => (close(), setClient(c.id)) })),
        ]
      : [];
    const campaignItems: Item[] = (campaigns.data?.campaigns ?? []).map((c) => ({
      id: `k-${c.id}`,
      group: "Campaigns",
      label: c.name,
      sub: [clientName(c.adAccount?.clientId), c.status.charAt(0) + c.status.slice(1).toLowerCase()].filter(Boolean).join(" · "),
      icon: <PlatformBadge platform={c.platform as PlatformKey} size={20} />,
      keywords: `${c.platform} campaign`,
      run: () => (close(), router.push(`/campaigns/${c.id}`)),
    }));
    return [...actions, ...pages, ...clientItems, ...campaignItems];
    // eslint-disable-next-line react-hooks/exhaustive-deps -- go/close only close over stable setters and the router
  }, [access.role, resolved, clients, clientId, hasMultiple, campaigns.data, scoped]);

  // Empty query: actions, pages and clients (no campaign list). Typed: best matches, a few per group.
  const results = useMemo(() => {
    const q = query.trim();
    const LIMIT: Record<string, number> = { Actions: 6, Pages: q ? 6 : 7, Clients: q ? 5 : 6, Campaigns: 8 };
    const ranked = items
      .filter((i) => q || i.group !== "Campaigns")
      .map((i) => ({ i, s: score(q, i.label, `${i.keywords ?? ""} ${i.sub ?? ""}`) }))
      .filter((r) => r.s > 0);
    const order = q ? ["Campaigns", "Clients", "Pages", "Actions"] : ["Actions", "Pages", "Clients"];
    return order.flatMap((g) =>
      ranked
        .filter((r) => r.i.group === g)
        .sort((a, b) => b.s - a.s)
        .slice(0, LIMIT[g])
        .map((r) => r.i)
    );
  }, [items, query]);

  useEffect(() => setActive(0), [query]);
  useEffect(() => {
    listRef.current?.querySelector<HTMLElement>(`[data-index="${active}"]`)?.scrollIntoView({ block: "nearest" });
  }, [active]);

  if (!open) return null;

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      if (!results.length) return;
      setActive((a) => (a + (e.key === "ArrowDown" ? 1 : -1) + results.length) % results.length);
    } else if (e.key === "Enter") {
      e.preventDefault();
      results[active]?.run();
    }
  };

  let last = "";
  return createPortal(
    <div className="fixed inset-0 z-[80] flex items-start justify-center bg-[rgba(12,11,18,.42)] px-4 pt-[12vh] max-[599px]:pt-4" onMouseDown={(e) => e.target === e.currentTarget && close()}>
      <div ref={panelRef} role="dialog" aria-modal="true" aria-label="Command palette" className="flex max-h-[min(560px,80vh)] w-full max-w-[620px] flex-col overflow-hidden rounded-card border border-line bg-surface shadow-pop">
        <div className="flex items-center gap-3 border-b border-line px-4">
          <Search size={18} className="flex-none text-ink-3" aria-hidden="true" />
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Search pages, clients, campaigns or actions…"
            role="combobox"
            aria-expanded="true"
            aria-controls={listId}
            aria-activedescendant={results[active] ? `${listId}-${active}` : undefined}
            aria-autocomplete="list"
            className="h-14 min-w-0 flex-1 border-0 bg-transparent text-[15px] text-ink outline-none placeholder:text-ink-3"
          />
          <IconButton label="Close (Esc)" size={32} title="Close (Esc)" onClick={close} className="-mr-1.5 flex-none">
            <X size={17} />
          </IconButton>
        </div>
        <div ref={listRef} id={listId} role="listbox" aria-label="Results" className="min-h-0 flex-1 overflow-y-auto p-2">
          {results.length === 0 ? (
            <p className="px-3 py-8 text-center text-sm text-ink-2">{campaigns.loading && query ? "Searching campaigns…" : `Nothing matches “${query.trim()}”.`}</p>
          ) : (
            results.map((r, idx) => {
              const head = r.group !== last ? r.group : null;
              last = r.group;
              return (
                <div key={r.id}>
                  {head && <div className="px-3 pb-1 pt-2.5 text-[11px] font-semibold uppercase tracking-[.06em] text-ink-3">{head}</div>}
                  <div
                    id={`${listId}-${idx}`}
                    data-index={idx}
                    role="option"
                    aria-selected={idx === active}
                    onMouseMove={() => setActive(idx)}
                    onClick={r.run}
                    className={cn("flex cursor-pointer items-center gap-3 rounded-ctl px-3 py-2.5", idx === active ? "bg-brand-soft text-brand-ink" : "text-ink")}
                  >
                    <span className={cn("flex h-5 w-5 flex-none items-center justify-center", idx === active ? "text-brand-ink" : "text-ink-2")}>{r.icon}</span>
                    <span className="flex min-w-0 flex-1 flex-col leading-tight">
                      <span className="truncate text-sm font-medium">{r.label}</span>
                      {r.sub && <span className="truncate text-xs text-ink-2">{r.sub}</span>}
                    </span>
                    {idx === active && <CornerDownLeft size={14} className="flex-none text-brand-ink" aria-hidden="true" />}
                  </div>
                </div>
              );
            })
          )}
        </div>
        <div className="flex items-center gap-4 border-t border-line px-4 py-2 text-xs text-ink-3 max-[599px]:hidden">
          <span>↑↓ to move</span>
          <span>Enter to open</span>
          <span>Esc to close</span>
          <span className="ml-auto">⌘K / Ctrl+K anywhere</span>
        </div>
      </div>
    </div>,
    document.body
  );
}
