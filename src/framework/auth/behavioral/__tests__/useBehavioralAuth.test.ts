import { renderHook, act } from '@testing-library/react-native';
import { useBehavioralAuth } from '../useBehavioralAuth';

describe('useBehavioralAuth', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.spyOn(Date, 'now');
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it('should initialize with default values', () => {
    const { result } = renderHook(() => useBehavioralAuth());

    expect(result.current.trustScore).toBe(1.0);
    expect(result.current.isActive).toBe(true);
    expect(result.current.metrics.typingSpeed).toBe(0);
    expect(result.current.metrics.navigationRhythm).toBe(0);
  });

  it('should calculate typing speed based on recorded keystrokes', () => {
    const { result } = renderHook(() => useBehavioralAuth({ updateInterval: 1000 }));

    const now = 1000000;
    (Date.now as jest.Mock).mockReturnValue(now);

    act(() => {
      result.current.recordKeystroke();
    });

    (Date.now as jest.Mock).mockReturnValue(now + 100);

    act(() => {
      result.current.recordKeystroke();
    });

    act(() => {
      jest.advanceTimersByTime(1000);
    });

    expect(result.current.metrics.typingSpeed).toBe(100);
  });

  it('should calculate navigation rhythm based on recorded interactions', () => {
    const { result } = renderHook(() => useBehavioralAuth({ updateInterval: 1000 }));

    act(() => {
      result.current.recordInteraction();
      result.current.recordInteraction();
    });

    act(() => {
      jest.advanceTimersByTime(1000);
    });

    expect(result.current.metrics.navigationRhythm).toBe(2);
  });

  it('should decrease trust score for extremely fast typing (bot-like)', () => {
    const { result } = renderHook(() =>
      useBehavioralAuth({ updateInterval: 1000, sensitivity: 1.0 })
    );

    const now = 1000000;
    (Date.now as jest.Mock).mockReturnValue(now);

    act(() => {
      result.current.recordKeystroke();
    });

    (Date.now as jest.Mock).mockReturnValue(now + 20); // 20ms interval is very fast

    act(() => {
      result.current.recordKeystroke();
    });

    act(() => {
      jest.advanceTimersByTime(1000);
    });

    expect(result.current.trustScore).toBeLessThan(1.0);
    expect(result.current.trustScore).toBe(0.7); // 1.0 - 1.0 * 0.3
  });

  it('should decrease trust score for excessive navigation bursts', () => {
    const { result } = renderHook(() =>
      useBehavioralAuth({ updateInterval: 1000, sensitivity: 0.5 })
    );

    act(() => {
      for (let i = 0; i < 150; i++) {
        result.current.recordInteraction();
      }
    });

    act(() => {
      jest.advanceTimersByTime(1000);
    });

    expect(result.current.trustScore).toBeLessThan(1.0);
    expect(result.current.trustScore).toBe(0.8); // 1.0 - 0.5 * 0.4
  });

  it('should handle window event listeners if window exists', () => {
    const addSpy = jest.fn();
    const removeSpy = jest.fn();
    const eventListeners: Record<string, Function> = {};

    addSpy.mockImplementation((event, callback) => {
      eventListeners[event] = callback;
    });

    // Temporarily mock global window
    const originalWindow = global.window;
    (global as any).window = {
      addEventListener: addSpy,
      removeEventListener: removeSpy,
    };

    const { unmount } = renderHook(() => useBehavioralAuth());

    expect(addSpy).toHaveBeenCalledWith('keydown', expect.any(Function));
    expect(addSpy).toHaveBeenCalledWith('mousedown', expect.any(Function));
    expect(addSpy).toHaveBeenCalledWith('touchstart', expect.any(Function));

    // Call the listeners to ensure they are covered
    act(() => {
      eventListeners['keydown']();
      eventListeners['mousedown']();
      eventListeners['touchstart']();
    });

    unmount();

    expect(removeSpy).toHaveBeenCalledWith('keydown', expect.any(Function));

    // Restore original window
    (global as any).window = originalWindow;
  });
});
