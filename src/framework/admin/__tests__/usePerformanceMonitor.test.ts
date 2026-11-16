import { renderHook, act } from '@testing-library/react-native';
import { usePerformanceMonitor } from '../hooks/usePerformanceMonitor';

describe('usePerformanceMonitor', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2024-01-01T00:00:00Z'));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('should initialize with empty metrics', () => {
    const { result } = renderHook(() => usePerformanceMonitor());
    expect(result.current.metrics).toEqual([]);
  });

  it('should record a metric successfully', () => {
    const { result } = renderHook(() => usePerformanceMonitor());

    act(() => {
      result.current.recordMetric('TestTask', 150);
    });

    expect(result.current.metrics.length).toBe(1);
    expect(result.current.metrics[0].name).toBe('TestTask');
    expect(result.current.metrics[0].duration).toBe(150);
    expect(result.current.metrics[0].timestamp).toBe(Date.now());
  });

  it('should clear metrics when clearMetrics is called', () => {
    const { result } = renderHook(() => usePerformanceMonitor());

    act(() => {
      result.current.recordMetric('Task1', 100);
      result.current.recordMetric('Task2', 200);
    });

    expect(result.current.metrics.length).toBe(2);

    act(() => {
      result.current.clearMetrics();
    });

    expect(result.current.metrics).toEqual([]);
  });
});
