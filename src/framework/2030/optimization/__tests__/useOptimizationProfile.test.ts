import { renderHook, act } from '@testing-library/react-native';
import {
  useOptimizationProfile,
  useSyncFrequency,
  useAnimationComplexity,
  useZkpDepth,
} from '../useOptimizationProfile';
import { uxOptimizer } from '../SelfOptimizingUXEngine';

describe('Optimization Hooks', () => {
  afterEach(() => {
    uxOptimizer.reset();
  });

  it('useOptimizationProfile should return current metrics', async () => {
    const { result } = renderHook(() => useOptimizationProfile());
    expect(result.current.profile.level).toBe('peak');
  });

  it('useOptimizationProfile should update when vitals change', async () => {
    const { result } = renderHook(() => useOptimizationProfile());

    await act(async () => {
      uxOptimizer.updateVitals({ fps: 10 });
    });

    expect(result.current.profile.level).toBe('critical');
  });

  it('useSyncFrequency should return current frequency', async () => {
    const { result } = renderHook(() => useSyncFrequency());
    expect(result.current).toBe(1000);

    await act(async () => {
      uxOptimizer.updateVitals({ fps: 10 });
    });

    expect(result.current).toBe(60000);
  });

  it('useAnimationComplexity should return current complexity', async () => {
    const { result } = renderHook(() => useAnimationComplexity());
    expect(result.current).toBe('full');

    await act(async () => {
      uxOptimizer.updateVitals({ thermalState: 'serious' });
    });

    expect(result.current).toBe('minimal');
  });

  it('useZkpDepth should return current depth', async () => {
    const { result } = renderHook(() => useZkpDepth());
    expect(result.current).toBe('exhaustive');

    await act(async () => {
      uxOptimizer.updateVitals({ batteryLevel: 0.05, isCharging: false });
    });

    expect(result.current).toBe('minimal');
  });
});
