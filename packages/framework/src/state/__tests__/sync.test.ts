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
});
