"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useApi } from "@/hooks/useApi";
import type { Client } from "@/lib/api";

/**
 * The selected agency client (guide principle 4: "the client is the
 * context"). Every page reads `clientId` and passes it to the API.
 *
 * Stored in the URL as `?client=<id>` (shareable) and in localStorage, so
 * the choice survives navigation through links that don't carry the param.
 * `null` = all clients.
 */

const STORAGE_KEY = "advertix.client";

type ClientScope = {
  /** Selected client id, or null for all clients. */
  clientId: string | null;
  client: Client | null;
  clients: Client[];
  loading: boolean;
  /** More than one client: show the switcher (single-brand workspaces hide it). */
  hasMultiple: boolean;
  unassignedAdAccounts: number;
  setClient: (id: string | null) => void;
  refreshClients: () => Promise<void>;
  /** Append `?client=` to an in-app href when a client is selected. */
  scoped: (href: string) => string;
};

const Ctx = createContext<ClientScope | null>(null);

function readUrlClient(): string | null {
  if (typeof window === "undefined") return null;
  return new URLSearchParams(window.location.search).get("client");
}

export function ClientProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const res = useApi((api) => api.getClients(), [], { key: "clients" });
  const clients = useMemo(() => res.data?.clients ?? [], [res.data]);
  const [wanted, setWanted] = useState<string | null>(null);

  // URL wins; otherwise the last choice from localStorage. Re-read on
  // navigation (links that drop the param keep the stored choice).
  useEffect(() => {
    let id = readUrlClient();
    if (!id) {
      try {
        id = localStorage.getItem(STORAGE_KEY);
      } catch {
        id = null;
      }
    }
    setWanted(id);
  }, [pathname]);

  // Ignore ids that aren't (or are no longer) in this workspace.
  const client = clients.find((c) => c.id === wanted) ?? null;
  const clientId = clients.length > 1 ? client?.id ?? null : null;

  const setClient = useCallback(
    (id: string | null) => {
      setWanted(id);
      try {
        if (id) localStorage.setItem(STORAGE_KEY, id);
        else localStorage.removeItem(STORAGE_KEY);
      } catch {
        /* private mode */
      }
      const params = new URLSearchParams(window.location.search);
      if (id) params.set("client", id);
      else params.delete("client");
      const qs = params.toString();
      router.replace(`${pathname}${qs ? `?${qs}` : ""}`, { scroll: false });
    },
    [pathname, router]
  );

  const scoped = useCallback(
    (href: string) => {
      if (!clientId || !href.startsWith("/")) return href;
      const [path, hash = ""] = href.split("#");
      const sep = path.includes("?") ? "&" : "?";
      return `${path}${sep}client=${encodeURIComponent(clientId)}${hash ? `#${hash}` : ""}`;
    },
    [clientId]
  );

  const value: ClientScope = {
    clientId,
    client: clientId ? client : null,
    clients,
    loading: res.loading,
    hasMultiple: clients.length > 1,
    unassignedAdAccounts: res.data?.unassignedAdAccounts ?? 0,
    setClient,
    refreshClients: res.refetch,
    scoped,
  };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useClientScope(): ClientScope {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useClientScope must be used inside <ClientProvider>");
  return ctx;
}
