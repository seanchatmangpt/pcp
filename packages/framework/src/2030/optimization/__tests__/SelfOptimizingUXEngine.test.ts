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
});
