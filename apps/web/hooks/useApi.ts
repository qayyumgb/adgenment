"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useApiClient } from "@/lib/api";

type ApiClient = ReturnType<typeof useApiClient>;

export type UseApiResult<T> = {
  data: T | null;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
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
 */
export function useApi<T>(
  fetcher: (client: ApiClient) => Promise<T>,
  deps: ReadonlyArray<unknown> = []
): UseApiResult<T> {
  const api = useApiClient();
  // Hold the fetcher in a ref so deps doesn't need to include it (callers
  // would otherwise have to memoize their lambdas).
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;

  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
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
    let cancelled = false;
    (async () => {
      await fetchData();
      if (cancelled) return;
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return { data, loading, error, refetch: fetchData };
}
