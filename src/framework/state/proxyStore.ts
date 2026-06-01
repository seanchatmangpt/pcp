import { create, StoreApi, UseBoundStore } from 'zustand';
import { MembraneContext } from '@/src/lib/membrane/context';
import { ProxyableBridge } from '@/src/lib/membrane/proxyableBridge';

export interface ProxyStoreConfig<TTarget extends object, TStore extends object> {
  /** The plain target object that will hold the actual state values under proxy protection. */
  target: TTarget;
  /** The membrane context governing the proxy mutations. */
  context: MembraneContext;
  /** Synchronizes a mutation from the proxy into the Zustand store. */
  syncToStore: (prop: keyof TTarget, value: any, set: StoreApi<TStore>['setState']) => void;
  /** Factory to create the Zustand store state, given the proxy and store mutators. */
  createStore: (
    set: StoreApi<TStore>['setState'],
    get: StoreApi<TStore>['getState'],
    proxy: TTarget
  ) => TStore;
  /** Optional flow name for telemetry tracking. */
  flowName?: string;
}

export interface ProxyStoreResult<TTarget extends object, TStore extends object> {
  proxy: TTarget;
  useStore: UseBoundStore<StoreApi<TStore>>;
}

/**
 * Creates a reactive Zustand store backed by a Membrane-governed proxy.
 * Mutations on the proxy automatically sync to the Zustand store.
 *
 * @param config Configuration for the proxy and store.
 * @returns The governed proxy and the bound Zustand store hook.
 */
export function createProxyStore<TTarget extends object, TStore extends object>(
  config: ProxyStoreConfig<TTarget, TStore>
): ProxyStoreResult<TTarget, TStore> {
  let storeSet: StoreApi<TStore>['setState'] | undefined;

  const proxy = ProxyableBridge.wrap(config.target, config.context, {
    flowName: config.flowName,
    onMutation: (prop, value) => {
      if (storeSet) {
        config.syncToStore(prop as keyof TTarget, value, storeSet);
      }
    },
  });

  const useStore = create<TStore>((set, get) => {
    storeSet = set;
    return config.createStore(set, get, proxy as TTarget);
  });

  return {
    proxy: proxy as TTarget,
    useStore,
  };
}
