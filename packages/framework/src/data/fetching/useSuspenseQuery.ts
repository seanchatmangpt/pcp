/**
 * @fileoverview Suspense-enabled data fetching utility
 */

// Extend globalThis to include our suspense cache
declare global {
  var __suspenseCache:
    | Map<string, { status: string; data?: any; error?: any; promise?: Promise<any> }>
    | undefined;
}

/**
 * A utility hook that integrates data fetching with React Suspense.
 * It will throw a Promise while the data is loading, throw an Error if it fails,
 * and return the resolved data when successful.
 *
 * @template T - The type of the data returned by the query function.
 * @param {string} queryKey - A unique key to identify the query in the cache.
 * @param {() => Promise<T>} queryFn - The function that fetches the data.
 * @returns {T} The resolved data.
 */
export function useSuspenseQuery<T>(queryKey: string, queryFn: () => Promise<T>): T {
  if (!globalThis.__suspenseCache) {
    globalThis.__suspenseCache = new Map();
  }
  const cache = globalThis.__suspenseCache;

  if (!cache.has(queryKey)) {
    const promise = queryFn()
      .then((data) => {
        cache.set(queryKey, { status: 'success', data });
      })
      .catch((error) => {
        cache.set(queryKey, { status: 'error', error });
      });
    cache.set(queryKey, { status: 'pending', promise });
  }

  const record = cache.get(queryKey)!;

  if (record.status === 'pending') {
    throw record.promise;
  }
  if (record.status === 'error') {
    throw record.error;
  }

  return record.data as T;
}

/**
 * Clears the suspense cache. If a queryKey is provided, only that key is cleared.
 * Otherwise, the entire cache is cleared.
 *
 * @param {string} [queryKey] - Optional key to clear from the cache.
 */
export function clearSuspenseCache(queryKey?: string) {
  if (globalThis.__suspenseCache) {
    if (queryKey) {
      globalThis.__suspenseCache.delete(queryKey);
    } else {
      globalThis.__suspenseCache.clear();
    }
  }
}
