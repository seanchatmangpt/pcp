import { createProxyStore, ProxyStoreResult } from '../../state/proxyStore';
import { LWWMap } from '../../sync/crdt/map';
import { LWWMapState } from '../../sync/crdt/types';
import { MembraneContext } from '@/src/lib/membrane/context';

export interface CollaborativeWorkspaceConfig<T extends object> {
  /** Unique identifier for the workspace */
  id: string;
  /** Peer ID of the local user */
  peerId: string;
  /** Initial state of the workspace */
  initialState: T;
  /** Membrane context for state governance */
  context: MembraneContext;
  /** Callback triggered when local state changes and needs to be synced */
  onSync?: (state: LWWMapState<any>) => void;
}

/**
 * CollaborativeWorkspace provides a high-level abstraction for shared state.
 * It combines a reactive Zustand store with a CRDT engine (LWWMap) to handle
 * real-time synchronization and conflict resolution automatically.
 */
export class CollaborativeWorkspace<T extends object> {
  private crdt: LWWMap<any>;
  private proxy: T;
  private target: T;
  private useStore: ProxyStoreResult<T, any>['useStore'];
  private isRemoteUpdate = false;

  constructor(config: CollaborativeWorkspaceConfig<T>) {
    this.target = { ...config.initialState };
    this.crdt = new LWWMap(config.peerId);

    // Initialize CRDT with initial state values
    for (const [key, value] of Object.entries(this.target)) {
      this.crdt.set(key, value);
    }

    const { proxy, useStore } = createProxyStore({
      target: this.target,
      context: config.context,
      syncToStore: (prop, value, set) => {
        // If the update came from a remote source, we don't need to update CRDT or trigger onSync
        if (!this.isRemoteUpdate) {
          this.crdt.set(prop as string, value);
          if (config.onSync) {
            config.onSync(this.crdt.state);
          }
        }

        // Always update the Zustand store for reactivity
        set({ [prop]: value } as any);
      },
      createStore: (set, get, p) => {
        return { ...p } as any;
      },
      flowName: `collaborative-workspace-${config.id}`,
    });

    this.proxy = proxy;
    this.useStore = useStore;
  }

  /**
   * Returns the governed proxy state.
   * Mutations on this proxy will automatically sync to the CRDT and trigger onSync.
   */
  public get state(): T {
    return this.proxy;
  }

  /**
   * Returns the Zustand hook for reactive UI updates.
   */
  public get store() {
    return this.useStore;
  }

  /**
   * Returns the current CRDT state (LWWMapState).
   * This is what should be sent to peers.
   */
  public get crdtState(): LWWMapState<any> {
    return this.crdt.state;
  }

  /**
   * Merges a remote CRDT state into the local workspace.
   * Handles conflict resolution using Last-Write-Wins logic and updates the store.
   *
   * @param remoteState The CRDT state received from a peer.
   */
  public receiveUpdate(remoteState: LWWMapState<any>) {
    this.isRemoteUpdate = true;
    try {
      this.crdt.merge(remoteState);
      const newState = this.crdt.state;

      // Update the underlying target and the store for any values that changed
      for (const [key, register] of Object.entries(newState)) {
        const typedKey = key as keyof T;
        if (this.target[typedKey] !== register.value) {
          // Mutate target directly to avoid triggering proxy traps if possible,
          // though we still need to update the store.
          this.target[typedKey] = register.value;
          this.useStore.setState({ [typedKey]: register.value } as any);
        }
      }
    } finally {
      this.isRemoteUpdate = false;
    }
  }
}
