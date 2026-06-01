/**
 * @module framework/state/sync
 * Zustand sync utilities to synchronize multiple stores or external state.
 */
import { StoreApi } from 'zustand';

/**
 * Synchronizes a specific slice of state from a source store to a target store.
 *
 * @param source The source Zustand store API.
 * @param target The target Zustand store API.
 * @param selector A function to extract the slice of state from the source.
 * @param setter A function to apply the extracted slice to the target. It should return the partial state to update, or void if no update is needed.
 * @returns An unsubscribe function to stop the synchronization.
 */
export function syncStores<TSource, TTarget, TSlice>(
  source: StoreApi<TSource>,
  target: StoreApi<TTarget>,
  selector: (state: TSource) => TSlice,
  setter: (targetState: TTarget, slice: TSlice) => Partial<TTarget> | void | null
): () => void {
  // Perform an initial sync immediately
  const initialSlice = selector(source.getState());
  const initialUpdate = setter(target.getState(), initialSlice);
  if (initialUpdate != null) {
    target.setState(initialUpdate);
  }

  // Subscribe to subsequent source changes
  const unsubscribe = source.subscribe((state, prevState) => {
    const currentSlice = selector(state);
    const prevSlice = selector(prevState);

    // Basic equality check to prevent unnecessary updates
    if (!Object.is(currentSlice, prevSlice)) {
      const update = setter(target.getState(), currentSlice);
      if (update != null) {
        target.setState(update);
      }
    }
  });

  return unsubscribe;
}
