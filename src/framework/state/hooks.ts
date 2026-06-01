/**
 * @module framework/state/hooks
 * React hooks for interacting with governed state and hydration.
 */
import { useState, useEffect } from 'react';
import { StoreApi, UseBoundStore } from 'zustand';

/**
 * Interface describing the persist API injected by Zustand's persist middleware.
 */
export interface PersistApi<T> {
  persist?: {
    hasHydrated: () => boolean;
    onFinishHydration: (fn: (state: T) => void) => () => void;
  };
}

/**
 * A React hook that tracks the hydration status of a persistent Zustand store.
 * Useful for delaying rendering until MMKV has hydrated the state.
 *
 * @param useStore The bound Zustand store hook created with persist middleware.
 * @returns A boolean indicating if the store has finished hydrating.
 */
export function useHydration<T>(useStore: UseBoundStore<StoreApi<T>> & PersistApi<T>): boolean {
  const [hydrated, setHydrated] = useState(() => {
    if (!useStore.persist) return true;
    return useStore.persist.hasHydrated();
  });

  useEffect(() => {
    if (!useStore.persist) {
      setHydrated(true);
      return;
    }

    // Check again in case it hydrated before the effect ran
    if (useStore.persist.hasHydrated()) {
      setHydrated(true);
      return;
    }

    const unsub = useStore.persist.onFinishHydration(() => {
      setHydrated(true);
    });

    return () => {
      if (typeof unsub === 'function') {
        unsub();
      }
    };
  }, [useStore]);

  return hydrated;
}
