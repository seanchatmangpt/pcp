import { renderHook, act } from '@testing-library/react-native';
import { useAppVitals } from '../useAppVitals';

// Mock Reanimated
const mockSharedValue = { value: 0 };
jest.mock('react-native-reanimated', () => {
  return {
    useSharedValue: jest.fn(() => mockSharedValue),
    useFrameCallback: jest.fn((cb, autostart) => {
      return {
        setActive: jest.fn(),
        isActive: autostart,
      };
    }),
  };
});

describe('useAppVitals', () => {
  let rafCallback: ((time: number) => void) | null = null;
  const originalRAF = global.requestAnimationFrame;
  const originalCAF = global.cancelAnimationFrame;

  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2024-01-01T00:00:00Z'));

    mockSharedValue.value = 0;

    // @ts-ignore
    global.requestAnimationFrame = jest.fn((cb) => {
      rafCallback = cb;
      return 123;
    });
    // @ts-ignore
    global.cancelAnimationFrame = jest.fn();

    // Mock Hermes
    // @ts-ignore
    global.HermesInternal = {
      getInstrumentedStats: jest.fn(() => ({
        jsHeapTotalMemory: 50 * 1024 * 1024, // 50MB
      })),
    };
  });

  afterEach(() => {
    jest.useRealTimers();
    // @ts-ignore
    global.requestAnimationFrame = originalRAF;
    // @ts-ignore
    global.cancelAnimationFrame = originalCAF;
    // @ts-ignore
    delete global.HermesInternal;
    // @ts-ignore
    delete global.performance;
  });

  it('should initialize with zeros when disabled', () => {
    const { result } = renderHook(() => useAppVitals({ enabled: false }));
    expect(result.current).toEqual({ jsFps: 0, uiFps: 0, memory: 0 });
  });

  it('should calculate vitals correctly after an interval', () => {
    const { result } = renderHook(() => useAppVitals({ updateInterval: 1000 }));

    // Simulate JS frames
    act(() => {
      for (let i = 0; i < 60; i++) {
        if (rafCallback) rafCallback(Date.now());
      }
    });

    // Simulate UI frames
    act(() => {
      mockSharedValue.value = 55;
    });

    // Advance time by 1 second
    act(() => {
      jest.advanceTimersByTime(1000);
    });

    expect(result.current.jsFps).toBe(60);
    expect(result.current.uiFps).toBe(55);
    expect(result.current.memory).toBe(50);
  });

  it('should handle different update intervals', () => {
    const { result } = renderHook(() => useAppVitals({ updateInterval: 500 }));

    // Simulate 30 JS frames in 500ms
    act(() => {
      for (let i = 0; i < 30; i++) {
        if (rafCallback) rafCallback(Date.now());
      }
    });

    act(() => {
      jest.advanceTimersByTime(500);
    });

    expect(result.current.jsFps).toBe(60); // 30 frames in 0.5s = 60fps
  });

  it('should use performance.memory fallback', () => {
    // @ts-ignore
    delete global.HermesInternal;
    // @ts-ignore
    Object.defineProperty(global, 'performance', {
      value: {
        memory: {
          usedJSHeapSize: 25 * 1024 * 1024,
        },
      },
      writable: true,
      configurable: true,
    });

    const { result } = renderHook(() => useAppVitals());

    act(() => {
      jest.advanceTimersByTime(1000);
    });

    expect(result.current.memory).toBe(25);
  });

  it('should handle missing memory APIs gracefully', () => {
    // @ts-ignore
    delete global.HermesInternal;
    // @ts-ignore
    delete global.performance;

    const { result } = renderHook(() => useAppVitals());

    act(() => {
      jest.advanceTimersByTime(1000);
    });

    expect(result.current.memory).toBe(0);
  });

  it('should cleanup on unmount', () => {
    const { unmount } = renderHook(() => useAppVitals());
    unmount();
    expect(global.cancelAnimationFrame).toHaveBeenCalled();
  });

  it('should reset vitals when disabled after being enabled', () => {
    const { result, rerender } = renderHook((props: { enabled: boolean }) => useAppVitals(props), {
      initialProps: { enabled: true },
    });

    act(() => {
      mockSharedValue.value = 60;
      jest.advanceTimersByTime(1000);
    });

    expect(result.current.uiFps).toBeGreaterThan(0);

    rerender({ enabled: false });
    expect(result.current).toEqual({ jsFps: 0, uiFps: 0, memory: 0 });
  });
});
