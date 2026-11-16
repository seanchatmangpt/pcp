import { renderHook, act } from '@testing-library/react-native';
import { useHydration, PersistApi } from '../hooks';
import { UseBoundStore, StoreApi } from 'zustand';

describe('useHydration', () => {
  it('returns true immediately if store does not have persist API', () => {
    const mockStore: any = {};
    const { result } = renderHook(() =>
      useHydration(mockStore as UseBoundStore<StoreApi<any>> & PersistApi<any>)
    );
    expect(result.current).toBe(true);
  });

  it('returns true if already hydrated', () => {
    const mockStore: any = {
      persist: {
        hasHydrated: jest.fn().mockReturnValue(true),
        onFinishHydration: jest.fn(),
      },
    };

    const { result } = renderHook(() =>
      useHydration(mockStore as UseBoundStore<StoreApi<any>> & PersistApi<any>)
    );
    expect(result.current).toBe(true);
    expect(mockStore.persist.onFinishHydration).not.toHaveBeenCalled();
  });

  it('subscribes to hydration finish if not hydrated yet', () => {
    let hydrationCallback: (state: any) => void = () => {};
    const unsubMock = jest.fn();
    let hasHydrated = false;

    const mockStore: any = {
      persist: {
        hasHydrated: jest.fn().mockImplementation(() => hasHydrated),
        onFinishHydration: jest.fn((cb) => {
          hydrationCallback = cb;
          return unsubMock;
        }),
      },
    };

    const { result, unmount } = renderHook(() =>
      useHydration(mockStore as UseBoundStore<StoreApi<any>> & PersistApi<any>)
    );

    // Initially false
    expect(result.current).toBe(false);
    expect(mockStore.persist.onFinishHydration).toHaveBeenCalled();

    // Trigger hydration
    act(() => {
      hasHydrated = true;
      hydrationCallback({});
    });

    // Should be true now
    expect(result.current).toBe(true);

    // Unmount to test cleanup
    unmount();
    expect(unsubMock).toHaveBeenCalled();
  });
});
