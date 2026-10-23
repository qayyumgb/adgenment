"use client";

import { useRef, useState } from "react";
import { Check, ChevronDown, ChevronsUpDown } from "lucide-react";
import { useApi } from "@/hooks/useApi";
import { cn } from "@/lib/cn";
import { useEscape, useOutsideClick } from "@/components/app/ui/overlay-hooks";
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
 * name, sub-line, chevron); "chip" = mobile app bar. Single-brand
 * workspaces (one client) get a static card and no menu.
 */
export function ClientSwitcherMenu({ variant }: { variant: "card" | "chip" }) {
  const { clients, client, clientId, hasMultiple, setClient } = useClientScope();
  const me = useApi((api) => api.getMe(), [], { key: "me" });
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  useEscape(open, () => setOpen(false));
  useOutsideClick(open, [wrapRef], () => setOpen(false));

  const workspaceName = me.data?.workspace?.name ?? "Workspace";
  const scope = client
    ? { mark: client.short, name: client.name, sub: client.vertical || `${client.adAccountCount} ad accounts` }
    : hasMultiple
      ? { mark: initials(workspaceName), name: workspaceName, sub: `Agency · ${clients.length} clients` }
      : { mark: initials(clients[0]?.name ?? workspaceName), name: clients[0]?.name ?? workspaceName, sub: "Workspace" };
  const title = client ? client.name : hasMultiple ? "All clients" : scope.name;

  // Members limited to some clients (B6) don't get "All clients".
  const limited = Boolean(me.data?.access?.clientIds);
  const items = [
    ...(limited ? [] : [{ id: null as string | null, mark: initials(workspaceName), label: "All clients", sub: String(clients.length) }]),
    ...clients.map((c) => ({ id: c.id as string | null, mark: c.short, label: c.name, sub: `${c.campaignCount}` })),
  ];

  const pick = (id: string | null) => {
    setClient(id);
    setOpen(false);
  };

  const trigger =
    variant === "card" ? (
      <button
        type="button"
        disabled={!hasMultiple}
        onClick={() => setOpen((o) => !o)}
        aria-haspopup={hasMultiple ? "menu" : undefined}
        aria-expanded={hasMultiple ? open : undefined}
        aria-label={hasMultiple ? `Client: ${title}. Switch client` : undefined}
        className={cn(
          "flex w-full items-center gap-2.5 rounded-xl border border-line bg-surface-2 p-2 text-left transition-colors",
          "focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-brand-soft",
          hasMultiple ? "hover:border-line-2" : "cursor-default",
          open && "border-brand"
        )}
      >
        <span className="flex h-9 w-9 flex-none items-center justify-center rounded-ctl bg-[image:var(--grad)] text-xs font-bold text-white">{scope.mark}</span>
        <span className="flex min-w-0 flex-1 flex-col leading-tight">
          <span className="truncate font-semibold">{scope.name}</span>
          <span className="truncate text-xs text-ink-2">{scope.sub}</span>
        </span>
        {hasMultiple && <ChevronsUpDown size={16} className="flex-none text-ink-3" aria-hidden="true" />}
      </button>
    ) : (
      <button
        type="button"
        disabled={!hasMultiple}
        onClick={() => setOpen((o) => !o)}
        aria-haspopup={hasMultiple ? "menu" : undefined}
        aria-expanded={hasMultiple ? open : undefined}
        aria-label={hasMultiple ? `Client: ${title}. Switch client` : undefined}
        className="flex h-[38px] min-w-0 flex-1 items-center gap-2 rounded-ctl border border-line bg-surface-2 pl-1 pr-2.5 text-left focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-brand-soft"
      >
        <span className="flex h-[30px] w-[30px] flex-none items-center justify-center rounded-lg bg-[image:var(--grad)] text-[10px] font-bold text-white">{scope.mark}</span>
        <span className="min-w-0 flex-1 truncate text-[13px] font-semibold">{title}</span>
        {hasMultiple && <ChevronDown size={14} strokeWidth={2.25} className="flex-none text-ink-3" aria-hidden="true" />}
      </button>
    );

  return (
    <div ref={wrapRef} className={cn("relative", variant === "card" ? "flex-none" : "flex min-w-0 flex-1")}>
      {trigger}
      {open && hasMultiple && (
        <div
          role="menu"
          aria-label="Switch client"
          className={cn(
            "z-40 rounded-menu border border-line bg-surface p-1.5 shadow-pop",
            variant === "card" ? "absolute left-0 top-[calc(100%+8px)] w-[calc(100%+110px)]" : "fixed left-2 right-2 top-[60px]"
          )}
        >
          <div className="px-2.5 pb-1.5 pt-2 text-xs text-ink-3">Switch client</div>
          {items.map((s) => {
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
                <span className="flex h-7 w-7 flex-none items-center justify-center rounded-lg bg-surface-3 text-[11px] font-semibold">{s.mark}</span>
                <span className="min-w-0 flex-1 truncate">{s.label}</span>
                {on ? (
                  <Check size={15} strokeWidth={2.5} className="text-brand-ink" aria-hidden="true" />
                ) : (
                  <span className="text-xs tabular-nums text-ink-3">{s.sub}</span>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
