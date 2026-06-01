import { syncStores } from '../sync';
import { createStore } from 'zustand';

interface SourceState {
  user: { id: string; name: string } | null;
  settings: { theme: string };
  setUser: (user: { id: string; name: string } | null) => void;
}

interface TargetState {
  currentUserId: string | null;
  setCurrentUserId: (id: string | null) => void;
}

describe('syncStores', () => {
  it('synchronizes initial state correctly', () => {
    const sourceStore = createStore<SourceState>((set) => ({
      user: { id: 'u1', name: 'Alice' },
      settings: { theme: 'dark' },
      setUser: (user) => set({ user }),
    }));

    const targetStore = createStore<TargetState>((set) => ({
      currentUserId: null,
      setCurrentUserId: (currentUserId) => set({ currentUserId }),
    }));

    const unsub = syncStores(
      sourceStore,
      targetStore,
      (state) => state.user?.id ?? null,
      (targetState, userId) => {
        if (targetState.currentUserId !== userId) {
          return { currentUserId: userId };
        }
        return null;
      }
    );

    // Initial sync should have occurred
    expect(targetStore.getState().currentUserId).toBe('u1');

    unsub();
  });

  it('synchronizes subsequent state updates', () => {
    const sourceStore = createStore<SourceState>((set) => ({
      user: { id: 'u1', name: 'Alice' },
      settings: { theme: 'dark' },
      setUser: (user) => set({ user }),
    }));

    const targetStore = createStore<TargetState>((set) => ({
      currentUserId: null,
      setCurrentUserId: (currentUserId) => set({ currentUserId }),
    }));

    const unsub = syncStores(
      sourceStore,
      targetStore,
      (state) => state.user?.id ?? null,
      (targetState, userId) => {
        if (targetState.currentUserId !== userId) {
          return { currentUserId: userId };
        }
        return null;
      }
    );

    // Initial sync checked
    expect(targetStore.getState().currentUserId).toBe('u1');

    // Update source
    sourceStore.getState().setUser({ id: 'u2', name: 'Bob' });
    expect(targetStore.getState().currentUserId).toBe('u2');

    // Update source to null
    sourceStore.getState().setUser(null);
    expect(targetStore.getState().currentUserId).toBeNull();

    unsub();
  });

  it('does not update target if the mapped state is the same', () => {
    const sourceStore = createStore<SourceState>((set) => ({
      user: { id: 'u1', name: 'Alice' },
      settings: { theme: 'dark' },
      setUser: (user) => set({ user }),
    }));

    const targetStore = createStore<TargetState>((set) => ({
      currentUserId: null,
      setCurrentUserId: (currentUserId) => set({ currentUserId }),
    }));

    let setterCallCount = 0;

    const unsub = syncStores(
      sourceStore,
      targetStore,
      (state) => state.user?.id ?? null,
      (targetState, userId) => {
        setterCallCount++;
        if (targetState.currentUserId !== userId) {
          return { currentUserId: userId };
        }
        return null;
      }
    );

    // Initial sync => setterCallCount = 1
    expect(setterCallCount).toBe(1);

    // Unrelated update in source
    sourceStore.getState().setUser({ id: 'u1', name: 'Alice Updated' });
    // Selector extracts `u1`. It's equal to previous slice `u1`.
    // So setter should NOT be called.
    expect(setterCallCount).toBe(1);

    unsub();
  });

  it('stops synchronizing after unsub is called', () => {
    const sourceStore = createStore<SourceState>((set) => ({
      user: { id: 'u1', name: 'Alice' },
      settings: { theme: 'dark' },
      setUser: (user) => set({ user }),
    }));

    const targetStore = createStore<TargetState>((set) => ({
      currentUserId: null,
      setCurrentUserId: (currentUserId) => set({ currentUserId }),
    }));

    const unsub = syncStores(
      sourceStore,
      targetStore,
      (state) => state.user?.id ?? null,
      (targetState, userId) => {
        if (targetState.currentUserId !== userId) {
          return { currentUserId: userId };
        }
        return null;
      }
    );

    expect(targetStore.getState().currentUserId).toBe('u1');

    unsub();

    sourceStore.getState().setUser({ id: 'u2', name: 'Bob' });

    // Target should not be updated
    expect(targetStore.getState().currentUserId).toBe('u1');
  });

  it('handles setter returning undefined/void correctly without errors', () => {
    const sourceStore = createStore<SourceState>((set) => ({
      user: { id: 'u1', name: 'Alice' },
      settings: { theme: 'dark' },
      setUser: (user) => set({ user }),
    }));

    const targetStore = createStore<TargetState>((set) => ({
      currentUserId: 'u1',
      setCurrentUserId: (currentUserId) => set({ currentUserId }),
    }));

    const unsub = syncStores(
      sourceStore,
      targetStore,
      (state) => state.user?.id ?? null,
      (targetState, userId) => {
        if (targetState.currentUserId !== userId) {
          return { currentUserId: userId };
        }
        // Returns undefined explicitly
        return undefined;
      }
    );

    expect(targetStore.getState().currentUserId).toBe('u1');

    // Make an update that triggers a change but we pretend setter returns undefined instead of updating
    sourceStore.getState().setUser({ id: 'u2', name: 'Bob' });

    unsub();
  });
});
