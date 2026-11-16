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
});
