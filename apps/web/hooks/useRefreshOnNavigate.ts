"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

/** When each shared count was last refreshed (per key, across every component using it). */
const lastRun = new Map<string, number>();

/**
 * Refresh a shared count (sidebar badges, the bell) when the page changes,
 * once per key no matter how many components show it, and not again within
 * `minGapMs`. The first mount is skipped: the data's own first fetch covers it.
 */
export function useRefreshOnNavigate(key: string, refetch: () => Promise<void>, minGapMs = 20_000) {
  const pathname = usePathname();
  useEffect(() => {
    const now = Date.now();
    const last = lastRun.get(key);
    if (last === undefined) {
      lastRun.set(key, now);
      return;
    }
    if (now - last < minGapMs) return;
    lastRun.set(key, now);
    void refetch();
  }, [pathname, key, refetch, minGapMs]);
}
