import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useLWWMap } from '../../../sync/crdt/hooks';
import { createStorageAdapter } from '../../../state/storage';
import { usePredictivePrefetch } from '../../../data/predictive/usePredictivePrefetch';

/**
 * Options for the AutoSyncState hook.
 */
export interface AutoSyncOptions<V> {
  /** Unique key for this state slice. Used for MMKV caching. */
  key: string;
  /** Initial value if no state is found in cache or CRDT. */
  initialValue: V;
  /** Unique identifier for the local peer. Required for CRDT resolution. */
  peerId: string;
  /** Optional URI for semantic proximity pre-fetching. */
  uri?: string;
  /** Optional depth for predictive pre-fetching. */
  depth?: number;
}

/**
 * Autonomous State Hook.
 * Automatically negotiates between CRDT maps (for consistency),
 * MMKV caching (for persistence), and predictive pre-fetching
 * based on the semantic proximity of the rendered view.
 *
 * @param options Configuration for the autonomous state.
 * @returns A tuple containing the current value, a setter function, and the underlying CRDT merge function.
 */
export function useAutoSyncState<V>(options: AutoSyncOptions<V>) {
  const { key, initialValue, peerId, uri, depth } = options;

  // 1. Predictive Pre-fetching
  // Uses semantic proximity if a URI is provided, otherwise defaults to a pcp-schema URI.
  const proximityUri = useMemo(() => uri || `pcp://auto/state/${key}`, [uri, key]);
  usePredictivePrefetch(proximityUri, { depth });

  // 2. CRDT Map for multi-peer consistency
  // We use LWWMap internally to handle conflict resolution.
  const [crdtState, ops, merge] = useLWWMap<V>(peerId);

  // 3. MMKV Persistence Adapter
  const storageAdapter = useMemo(() => createStorageAdapter(`auto-sync-${key}`), [key]);
  const isHydrated = useRef(false);

  // Hydrate CRDT from MMKV on mount
  useEffect(() => {
    if (isHydrated.current) return;

    const saved = storageAdapter.storage.getItem(`state`) as string | null;
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        merge(parsed);
      } catch (e) {
        // Fallback to initial value if parsing fails
        ops.set('value', initialValue);
      }
    } else {
      // Initialize with initialValue if no cache exists
      ops.set('value', initialValue);
    }
    isHydrated.current = true;
  }, [storageAdapter, merge, ops, initialValue]);

  // Persist CRDT state to MMKV on every change
  useEffect(() => {
    if (!isHydrated.current) return;
    storageAdapter.storage.setItem(`state`, JSON.stringify(crdtState));
  }, [crdtState, storageAdapter]);

  const value = useMemo(() => {
    const val = ops.get('value');
    return val !== undefined ? val : initialValue;
  }, [ops, initialValue, crdtState]);

  const setValue = useCallback(
    (val: V) => {
      ops.set('value', val);
    },
    [ops]
  );

  return [value, setValue, merge] as const;
}
