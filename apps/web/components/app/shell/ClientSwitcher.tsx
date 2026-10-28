"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { Check, ChevronDown, ChevronsUpDown, Layers, Plus, Settings2 } from "lucide-react";
import { useApi } from "@/hooks/useApi";
import { cn } from "@/lib/cn";
import { useEscape, useOutsideClick } from "@/components/app/ui/overlay-hooks";
import { useAccess } from "@/components/app/team/access";
import { ClientDialog } from "@/components/app/clients/ClientDialog";
import { useClientScope } from "./ClientContext";

const initials = (name: string) =>
  name
    .trim()
    .split(/\s+/)
    .map((w) => w[0] ?? "")
    .join("")
    .slice(0, 3)
    .toUpperCase() || "AX";

/**
 * Client switcher (guide §3.1 / §3.2). "card" = sidebar (gradient avatar,
 * name, sub-line, chevron); "chip" = mobile app bar. With one client there
 * is nothing to switch: owners still get a menu to add and manage clients,
 * everyone else a static card.
 */
export function ClientSwitcherMenu({ variant }: { variant: "card" | "chip" }) {
  const { clients, client, clientId, hasMultiple, setClient } = useClientScope();
  const me = useApi((api) => api.getMe(), [], { key: "me" });
  const access = useAccess();
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  // The sidebar clips overflow, so the card menu is placed against the viewport, under the trigger.
  const [place, setPlace] = useState<{ top: number; left: number; width: number } | null>(null);
  useEffect(() => {
    if (!open || variant !== "card") return setPlace(null);
    const update = () => {
      const r = wrapRef.current?.getBoundingClientRect();
      // As wide as the card, so the menu stays over the sidebar instead of covering the page.
      if (r) setPlace({ top: r.bottom + 8, left: r.left, width: Math.min(Math.max(r.width, 232), window.innerWidth - r.left - 8) });
    };
    update();
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
    };
  }, [open, variant]);
  useEscape(open, () => setOpen(false));
  useOutsideClick(open, [wrapRef], () => setOpen(false));

  const workspaceName = me.data?.workspace?.name ?? "Workspace";
  const count = (n: number, one: string) => `${n} ${one}${n === 1 ? "" : "s"}`;
  // "All clients" gets its own icon: the workspace and its first client often share a name (and initials).
  const allMark = <Layers size={15} aria-hidden="true" />;
  const scope = client
    ? { mark: client.short as ReactNode, name: client.name, sub: client.vertical || count(client.adAccountCount, "ad account") }
    : hasMultiple
      ? { mark: allMark, name: "All clients", sub: `${workspaceName} · ${count(clients.length, "client")}` }
      : { mark: initials(clients[0]?.name ?? workspaceName) as ReactNode, name: clients[0]?.name ?? workspaceName, sub: "Workspace" };
  const title = client ? client.name : hasMultiple ? "All clients" : scope.name;

  // Members limited to some clients (B6) don't get "All clients".
  const limited = Boolean(me.data?.access?.clientIds);
  const items = [
    ...(limited ? [] : [{ id: null as string | null, mark: allMark as ReactNode, label: "All clients", sub: count(clients.length, "client") }]),
    ...clients.map((c) => ({ id: c.id as string | null, mark: c.short as ReactNode, label: c.name, sub: `${count(c.adAccountCount, "account")} · ${count(c.campaignCount, "campaign")}` })),
  ];

  // Owners always get the menu (Add client / Manage clients), even with one client.
  const manage = access.can("clients");
  const menu = hasMultiple || manage;
  const [adding, setAdding] = useState(false);

  const pick = (id: string | null) => {
    setClient(id);
    setOpen(false);
  };

  const trigger =
    variant === "card" ? (
      <button
        type="button"
        disabled={!menu}
        onClick={() => setOpen((o) => !o)}
        aria-haspopup={menu ? "menu" : undefined}
        aria-expanded={menu ? open : undefined}
        aria-label={menu ? `Client: ${title}. ${hasMultiple ? "Switch client" : "Add or manage clients"}` : undefined}
        className={cn(
          "flex w-full items-center gap-2.5 rounded-xl border border-line bg-surface-2 p-2 text-left transition-colors",
          "focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-brand-soft",
          menu ? "hover:border-line-2" : "cursor-default",
          open && "border-brand"
        )}
      >
        <span className="flex h-9 w-9 flex-none items-center justify-center rounded-ctl bg-[image:var(--grad)] text-xs font-bold text-white">{scope.mark}</span>
        <span className="flex min-w-0 flex-1 flex-col leading-tight">
          <span className="truncate font-semibold">{scope.name}</span>
          <span className="truncate text-xs text-ink-2">{scope.sub}</span>
        </span>
        {menu && <ChevronsUpDown size={16} className="flex-none text-ink-3" aria-hidden="true" />}
      </button>
    ) : (
      <button
        type="button"
        disabled={!menu}
        onClick={() => setOpen((o) => !o)}
        aria-haspopup={menu ? "menu" : undefined}
        aria-expanded={menu ? open : undefined}
        aria-label={menu ? `Client: ${title}. ${hasMultiple ? "Switch client" : "Add or manage clients"}` : undefined}
        className="flex h-[38px] min-w-0 flex-1 items-center gap-2 rounded-ctl border border-line bg-surface-2 pl-1 pr-2.5 text-left focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-brand-soft"
      >
        <span className="flex h-[30px] w-[30px] flex-none items-center justify-center rounded-lg bg-[image:var(--grad)] text-[10px] font-bold text-white">{scope.mark}</span>
        <span className="min-w-0 flex-1 truncate text-[13px] font-semibold">{title}</span>
        {menu && <ChevronDown size={14} strokeWidth={2.25} className="flex-none text-ink-3" aria-hidden="true" />}
      </button>
    );

  return (
    <div ref={wrapRef} className={cn("relative", variant === "card" ? "flex-none" : "flex min-w-0 flex-1")}>
      {trigger}
      {open && menu && (variant !== "card" || place) && (
        <div
          role="menu"
          aria-label="Switch client"
          className={cn(
            "z-40 rounded-menu border border-line bg-surface p-1.5 shadow-pop",
            variant === "card" ? "fixed max-h-[60vh] overflow-y-auto" : "fixed left-2 right-2 top-[60px]"
          )}
          style={variant === "card" && place ? { top: place.top, left: place.left, width: place.width } : undefined}
        >
          {hasMultiple && <div className="px-2.5 pb-1.5 pt-2 text-xs text-ink-3">Switch client</div>}
          {(hasMultiple ? items : []).map((s) => {
            const on = s.id === clientId;
            return (
              <button
                key={s.id ?? "all"}
                type="button"
                role="menuitemradio"
                aria-checked={on}
                onClick={() => pick(s.id)}
                className={cn(
                  "flex w-full items-center gap-2.5 rounded-ctl px-2.5 py-2 text-left transition-colors hover:bg-surface-2 focus-visible:bg-surface-2 focus-visible:outline-none",
                  on && "bg-brand-soft hover:bg-brand-soft"
                )}
              >
                <span className="flex h-8 w-8 flex-none items-center justify-center rounded-lg bg-surface-3 text-[11px] font-semibold">{s.mark}</span>
                <span className="flex min-w-0 flex-1 flex-col leading-tight">
                  <span className="truncate">{s.label}</span>
                  <span className="truncate text-xs text-ink-3">{s.sub}</span>
                </span>
                {on && <Check size={15} strokeWidth={2.5} className="flex-none text-brand-ink" aria-hidden="true" />}
              </button>
            );
          })}
          {manage && (
            <>
              {hasMultiple && <div className="my-1 border-t border-line" role="separator" />}
              <button
                type="button"
                role="menuitem"
                onClick={() => (setOpen(false), setAdding(true))}
                className="flex w-full items-center gap-2.5 rounded-ctl px-2.5 py-2 text-left font-medium text-brand-ink transition-colors hover:bg-surface-2 focus-visible:bg-surface-2 focus-visible:outline-none"
              >
                <span className="flex h-7 w-7 flex-none items-center justify-center rounded-lg bg-brand-soft" aria-hidden="true">
                  <Plus size={15} />
                </span>
                Add client
              </button>
              <Link
                href="/settings?tab=clients"
                role="menuitem"
                onClick={() => setOpen(false)}
                className="flex w-full items-center gap-2.5 rounded-ctl px-2.5 py-2 text-left text-ink no-underline transition-colors hover:bg-surface-2 focus-visible:bg-surface-2 focus-visible:outline-none"
              >
                <span className="flex h-7 w-7 flex-none items-center justify-center rounded-lg bg-surface-3" aria-hidden="true">
                  <Settings2 size={15} />
                </span>
                Manage clients
              </Link>
            </>
          )}
        </div>
      )}
      {manage && <ClientDialog open={adding} editing={null} onClose={() => setAdding(false)} />}
    </div>
  );
}
