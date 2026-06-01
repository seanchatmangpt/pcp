import { useState, useCallback } from 'react';
import { HyperDB } from './HyperDB';

// Global shared instance for the hook (using 10,000 dimensions for semantic power)
export const globalHyperDB = new HyperDB(10000);

/**
 * A React Hook for managing state within the Hyper-Dimensional Vector Database.
 *
 * It synchronizes a local React state with the global `HyperDB` instance,
 * automatically projecting updates into the 10,000-dimensional vector space.
 *
 * @param id A unique identifier for this state node.
 * @param initialState The default initial state if none exists in the DB.
 * @returns A tuple of `[state, setState, searchSimilar]`.
 */
export function useHyperState<T>(id: string, initialState: T) {
  const [state, setReactState] = useState<T>(() => {
    const existing = globalHyperDB.get(id);
    if (existing !== undefined) {
      return existing;
    }
    globalHyperDB.insert(id, initialState);
    return initialState;
  });

  const setState = useCallback(
    (newState: T | ((prev: T) => T)) => {
      setReactState((prev) => {
        const nextState = typeof newState === 'function' ? (newState as Function)(prev) : newState;
        globalHyperDB.update(id, nextState);
        return nextState;
      });
    },
    [id]
  );

  /**
   * Search the HyperDB for states similar to the provided query state.
   */
  const searchSimilar = useCallback((queryState: any, topK: number = 5) => {
    return globalHyperDB.search(queryState, topK);
  }, []);

  return [state, setState, searchSimilar] as const;
}
