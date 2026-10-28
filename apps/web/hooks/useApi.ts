"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import useSWR from "swr";
import { useApiClient } from "@/lib/api";

type ApiClient = ReturnType<typeof useApiClient>;

export type UseApiResult<T> = {
  data: T | null;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
};

export type UseApiOptions = {
  /**
   * Cache key. When set, the request goes through SWR: identical keys share
   * one in-flight request and a cache (e.g. `getMe` used by the layout, the
   * header and the sidebar is fetched once). The key is combined with
   * `deps`, so include every value the fetcher depends on in `deps`.
   * Without a key the hook behaves as before (fetch per mount).
   */
  key?: string;
  /** Keyed only: keep showing the last data while new deps load (paging through dates). */
  keepPrevious?: boolean;
};

/**
 * Generic data fetching hook. Pass a fetcher that receives the typed API
 * client and returns a promise. Re-fetches when any of `deps` change.
 *
 * Example:
 *   const { data, loading, error, refetch } = useApi(
 *     (api) => api.getCampaigns({ page: '1' }),
 *     [pageNumber]
 *   );
 *   // Shared + cached:
 *   const { data: me } = useApi((api) => api.getMe(), [], { key: "me" });
 */
export function useApi<T>(
  fetcher: (client: ApiClient) => Promise<T>,
  deps: ReadonlyArray<unknown> = [],
  options: UseApiOptions = {}
): UseApiResult<T> {
  const api = useApiClient();
  // Hold the fetcher in a ref so deps doesn't need to include it (callers
  // would otherwise have to memoize their lambdas).
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;
  const keyed = typeof options.key === "string";

  // ── Cached path (SWR) ────────────────────────────────────────────────
  const swr = useSWR<T>(
    keyed ? [options.key, ...deps] : null,
    () => fetcherRef.current(api),
    { revalidateOnFocus: false, dedupingInterval: 5_000, shouldRetryOnError: false, keepPreviousData: options.keepPrevious ?? false }
  );

  // ── Uncached path (original behaviour) ───────────────────────────────
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState<boolean>(!keyed);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await fetcherRef.current(api);
      setData(result);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Request failed";
      setError(msg);
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [api]);

  useEffect(() => {
    if (keyed) return;
    void fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  // `swr` is a new object every render; its bound `mutate` is stable per key.
  // Depending on `swr` made `refetch` change each render, so callers that
  // refetch in an effect looped whenever a request failed (each error
  // re-rendered → new refetch → effect → request → error …).
  const { mutate } = swr;
  const swrRefetch = useCallback(async () => {
    await mutate();
  }, [mutate]);

  if (keyed) {
    return {
      data: swr.data ?? null,
      loading: swr.isLoading,
      error: swr.error ? (swr.error instanceof Error ? swr.error.message : "Request failed") : null,
      refetch: swrRefetch,
    };
  }
  return { data, loading, error, refetch: fetchData };
}
