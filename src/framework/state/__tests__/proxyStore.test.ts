import { createProxyStore } from '../proxyStore';
import { MembraneContext } from '@/src/lib/membrane/context';

interface TestTarget {
  count: number;
  message: string;
}

interface TestStore {
  count: number;
  message: string;
  setCount: (val: number) => void;
  setMessage: (val: string) => void;
}

describe('createProxyStore', () => {
  it('should create a governed proxy and a bound store that syncs mutations', () => {
    const context = new MembraneContext({
      mode: 'strict',
      tenantId: 'test',
      authorityRole: 'admin',
    });
    const target: TestTarget = { count: 0, message: 'hello' };

    const { proxy, useStore } = createProxyStore<TestTarget, TestStore>({
      target,
      context,
      syncToStore: (prop, value, set) => {
        if (prop === 'count') set({ count: value as number });
        if (prop === 'message') set({ message: value as string });
      },
      createStore: (set, get, proxyObj) => ({
        count: proxyObj.count,
        message: proxyObj.message,
        setCount: (val) => {
          proxyObj.count = val;
          set({ count: val });
        },
        setMessage: (val) => {
          proxyObj.message = val;
          set({ message: val });
        },
      }),
    });

    expect(proxy.count).toBe(0);
    expect(useStore.getState().count).toBe(0);
    expect(proxy.message).toBe('hello');

    // Mutate proxy directly
    proxy.count = 5;
    expect(proxy.count).toBe(5);
    // Since proxy mutation is synchronous to store in our setup
    expect(useStore.getState().count).toBe(5);

    // Mutate via store actions
    useStore.getState().setMessage('world');
    expect(proxy.message).toBe('world');
    expect(useStore.getState().message).toBe('world');
  });

  it('handles mutations before the store is fully initialized (edge case with storeSet)', () => {
    const context = new MembraneContext({
      mode: 'strict',
      tenantId: 'test',
      authorityRole: 'admin',
    });
    const target: TestTarget = { count: 0, message: 'hello' };

    let capturedSet: any;
    const { proxy } = createProxyStore<TestTarget, TestStore>({
      target,
      context,
      syncToStore: (prop, value, set) => {
        capturedSet = set;
      },
      createStore: (set, get, proxyObj) => {
        proxyObj.count = 10;
        return {
          count: proxyObj.count,
          message: proxyObj.message,
          setCount: () => {},
          setMessage: () => {},
        };
      },
    });

    expect(proxy.count).toBe(10);
    expect(capturedSet).toBeDefined();
  });

  it('safely ignores mutations if storeSet is not yet assigned', () => {
    const context = new MembraneContext({
      mode: 'strict',
      tenantId: 'test',
      authorityRole: 'admin',
    });
    const target = { test: 1 };

    // We spy on ProxyableBridge.wrap to capture the onMutation callback and call it immediately
    // BEFORE create() is invoked, so storeSet will be undefined.
    const wrapSpy = jest
      .spyOn(require('../../../lib/membrane/proxyableBridge').ProxyableBridge, 'wrap')
      .mockImplementationOnce((tgt, ctx, options: any) => {
        if (options && options.onMutation) {
          options.onMutation('test', 2);
        }
        return tgt;
      });

    let syncCalled = false;
    createProxyStore<any, any>({
      target,
      context,
      syncToStore: () => {
        syncCalled = true;
      },
      createStore: () => ({}),
    });

    expect(syncCalled).toBe(false);
    wrapSpy.mockRestore();
  });
});
