import { uxOptimizer, SelfOptimizingUXEngine } from '../SelfOptimizingUXEngine';
import { OPTIMIZATION_PROFILES } from '../constants';

describe('SelfOptimizingUXEngine', () => {
  beforeEach(() => {
    uxOptimizer.reset();
    jest.useFakeTimers();
  });

  afterEach(() => {
    uxOptimizer.stopMonitoring();
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
  });

  it('should initialize with peak profile', () => {
    const metrics = uxOptimizer.getMetrics();
    expect(metrics.profile.level).toBe('peak');
    expect(metrics.vitals.fps).toBe(60);
  });

  it('should switch to balanced when FPS drops below 55', () => {
    uxOptimizer.updateVitals({ fps: 50 });
    const metrics = uxOptimizer.getMetrics();
    expect(metrics.profile.level).toBe('balanced');
    expect(metrics.profile.animationComplexity).toBe('reduced');
  });

  it('should switch to power-saver when FPS drops below 30', () => {
    uxOptimizer.updateVitals({ fps: 25 });
    const metrics = uxOptimizer.getMetrics();
    expect(metrics.profile.level).toBe('power-saver');
    expect(metrics.profile.animationComplexity).toBe('minimal');
  });

  it('should switch to critical when FPS drops below 15', () => {
    uxOptimizer.updateVitals({ fps: 10 });
    const metrics = uxOptimizer.getMetrics();
    expect(metrics.profile.level).toBe('critical');
    expect(metrics.profile.animationComplexity).toBe('none');
  });

  it('should switch to power-saver when battery is low', () => {
    uxOptimizer.updateVitals({ batteryLevel: 0.15, isCharging: false });
    const metrics = uxOptimizer.getMetrics();
    expect(metrics.profile.level).toBe('power-saver');
  });

  it('should switch to critical when battery is critical', () => {
    uxOptimizer.updateVitals({ batteryLevel: 0.05, isCharging: false });
    const metrics = uxOptimizer.getMetrics();
    expect(metrics.profile.level).toBe('critical');
  });

  it('should stay peak if battery is low but charging', () => {
    uxOptimizer.updateVitals({ batteryLevel: 0.05, isCharging: true, fps: 60 });
    const metrics = uxOptimizer.getMetrics();
    expect(metrics.profile.level).toBe('peak');
  });

  it('should switch to balanced on fair thermal state', () => {
    uxOptimizer.updateVitals({ thermalState: 'fair' });
    const metrics = uxOptimizer.getMetrics();
    expect(metrics.profile.level).toBe('balanced');
  });

  it('should switch to power-saver on serious thermal state', () => {
    uxOptimizer.updateVitals({ thermalState: 'serious' });
    const metrics = uxOptimizer.getMetrics();
    expect(metrics.profile.level).toBe('power-saver');
  });

  it('should switch to critical on critical thermal state', () => {
    uxOptimizer.updateVitals({ thermalState: 'critical' });
    const metrics = uxOptimizer.getMetrics();
    expect(metrics.profile.level).toBe('critical');
  });

  it('should notify listeners on update', () => {
    const listener = jest.fn();
    const unsubscribe = uxOptimizer.subscribe(listener);

    // Initial call
    expect(listener).toHaveBeenCalledTimes(1);

    uxOptimizer.updateVitals({ fps: 10 });
    expect(listener).toHaveBeenCalledTimes(2);
    expect(listener).toHaveBeenLastCalledWith(
      expect.objectContaining({
        profile: OPTIMIZATION_PROFILES.critical,
      })
    );

    unsubscribe();
    uxOptimizer.updateVitals({ fps: 60 });
    expect(listener).toHaveBeenCalledTimes(2); // No more calls
  });
});
