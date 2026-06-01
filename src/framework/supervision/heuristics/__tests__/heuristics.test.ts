import { HeuristicEngine } from '../engine';
import {
  FrequencyHeuristic,
  ValueDeltaHeuristic,
  VarianceHeuristic,
  CompositeHeuristic,
} from '../implementations';
import { HeuristicContext } from '../types';
import { HookActorRef, HookMessage } from '@/src/lib/truex/hook-otp/types';

describe('HeuristicEngine', () => {
  const ref: HookActorRef = { tenantId: 't1', packId: 'p1', hookId: 'h1', instanceId: 'i1' };
  const message: HookMessage = { id: 'm1', type: 'graph_delta', payload: {} };
  const timestamp = Date.now();

  it('should run multiple heuristics and return anomalies', () => {
    const freqH = new FrequencyHeuristic({ threshold: 1, windowMs: 1000 });
    const deltaH = new ValueDeltaHeuristic('value', 10);
    const engine = new HeuristicEngine({ heuristics: [freqH, deltaH] });

    const context: HeuristicContext = {
      ref,
      message,
      previousState: { value: 10 },
      nextState: { value: 30 }, // Delta 20 > 10
      timestamp,
    };

    // First call for FrequencyHeuristic (threshold 1, so 2nd call triggers)
    engine.evaluate(context);
    const results = engine.evaluate(context);

    expect(results.length).toBe(2);
    expect(results.some((r) => r.heuristicName === 'frequency_heuristic')).toBe(true);
    expect(results.some((r) => r.heuristicName === 'value_delta_heuristic')).toBe(true);
  });

  it('should allow adding heuristics dynamically', () => {
    const engine = new HeuristicEngine({ heuristics: [] });
    const deltaH = new ValueDeltaHeuristic('value', 10);
    engine.addHeuristic(deltaH);

    const context: HeuristicContext = {
      ref,
      message,
      previousState: { value: 10 },
      nextState: { value: 30 },
      timestamp,
    };

    const results = engine.evaluate(context);
    expect(results.length).toBe(1);
    expect(results[0].heuristicName === 'value_delta_heuristic').toBe(true);
  });
});

describe('FrequencyHeuristic', () => {
  const ref: HookActorRef = { tenantId: 't1', packId: 'p1', hookId: 'h1', instanceId: 'i1' };
  const message: HookMessage = { id: 'm1', type: 'graph_delta', payload: {} };

  it('should detect frequency anomaly', () => {
    const heuristic = new FrequencyHeuristic({ threshold: 2, windowMs: 1000 });
    const timestamp = 1000;

    const context: HeuristicContext = { ref, message, timestamp };

    expect(heuristic.evaluate({ ...context, timestamp: 1000 }).isAnomaly).toBe(false);
    expect(heuristic.evaluate({ ...context, timestamp: 1100 }).isAnomaly).toBe(false);
    const result = heuristic.evaluate({ ...context, timestamp: 1200 });

    expect(result.isAnomaly).toBe(true);
    expect(result.reason).toContain('Frequency exceeded');
  });

  it('should reset after window expires', () => {
    const heuristic = new FrequencyHeuristic({ threshold: 1, windowMs: 1000 });

    expect(heuristic.evaluate({ ref, message, timestamp: 1000 }).isAnomaly).toBe(false);
    expect(heuristic.evaluate({ ref, message, timestamp: 2100 }).isAnomaly).toBe(false); // Window expired
    expect(heuristic.evaluate({ ref, message, timestamp: 2200 }).isAnomaly).toBe(true); // Now 2 in window
  });

  it('should support custom grouping', () => {
    const heuristic = new FrequencyHeuristic({
      threshold: 1,
      windowMs: 1000,
      groupBy: (ctx) => ctx.message.type,
    });

    expect(
      heuristic.evaluate({ ref, message: { ...message, type: 'A' as any }, timestamp: 1000 })
        .isAnomaly
    ).toBe(false);
    expect(
      heuristic.evaluate({ ref, message: { ...message, type: 'B' as any }, timestamp: 1000 })
        .isAnomaly
    ).toBe(false);
    expect(
      heuristic.evaluate({ ref, message: { ...message, type: 'A' as any }, timestamp: 1100 })
        .isAnomaly
    ).toBe(true);
  });
});

describe('ValueDeltaHeuristic', () => {
  const ref: HookActorRef = { tenantId: 't1', packId: 'p1', hookId: 'h1', instanceId: 'i1' };
  const message: HookMessage = { id: 'm1', type: 'graph_delta', payload: {} };

  it('should detect large delta', () => {
    const heuristic = new ValueDeltaHeuristic('stats.count', 5);
    const context: HeuristicContext = {
      ref,
      message,
      previousState: { stats: { count: 10 } },
      nextState: { stats: { count: 16 } },
      timestamp: Date.now(),
    };

    const result = heuristic.evaluate(context);
    expect(result.isAnomaly).toBe(true);
    expect(result.reason).toContain('Value delta for stats.count exceeded');
  });

  it('should ignore missing states or values', () => {
    const heuristic = new ValueDeltaHeuristic('value', 5);
    expect(heuristic.evaluate({ ref, message, timestamp: Date.now() }).isAnomaly).toBe(false);
    expect(
      heuristic.evaluate({
        ref,
        message,
        previousState: {},
        nextState: {},
        timestamp: Date.now(),
      }).isAnomaly
    ).toBe(false);
  });
});

describe('VarianceHeuristic', () => {
  const ref: HookActorRef = { tenantId: 't1', packId: 'p1', hookId: 'h1', instanceId: 'i1' };
  const message: HookMessage = { id: 'm1', type: 'graph_delta', payload: {} };

  it('should detect statistical anomaly after enough samples', () => {
    const heuristic = new VarianceHeuristic('val', 2, 3); // minSamples: 3, zScoreThreshold: 2

    // Fill history with stable values: 10, 11, 10, 11
    heuristic.evaluate({ ref, message, nextState: { val: 10 }, timestamp: 1 });
    heuristic.evaluate({ ref, message, nextState: { val: 11 }, timestamp: 2 });
    heuristic.evaluate({ ref, message, nextState: { val: 10 }, timestamp: 3 });

    // Mean: 10.33, StdDev: ~0.47
    // A value of 20 should be an anomaly
    const result = heuristic.evaluate({ ref, message, nextState: { val: 20 }, timestamp: 4 });
    expect(result.isAnomaly).toBe(true);
    expect(result.reason).toContain('Statistical variance anomaly');
  });

  it('should handle zero standard deviation', () => {
    const heuristic = new VarianceHeuristic('val', 2, 2);
    heuristic.evaluate({ ref, message, nextState: { val: 10 }, timestamp: 1 });
    heuristic.evaluate({ ref, message, nextState: { val: 10 }, timestamp: 2 });

    const result = heuristic.evaluate({ ref, message, nextState: { val: 10 }, timestamp: 3 });
    expect(result.isAnomaly).toBe(false);
  });
});

describe('CompositeHeuristic', () => {
  const ref: HookActorRef = { tenantId: 't1', packId: 'p1', hookId: 'h1', instanceId: 'i1' };
  const message: HookMessage = { id: 'm1', type: 'graph_delta', payload: {} };

  it('should support OR mode', () => {
    const h1 = new ValueDeltaHeuristic('a', 10);
    const h2 = new ValueDeltaHeuristic('b', 10);
    const composite = new CompositeHeuristic('Comp', [h1, h2], 'OR');

    const ctx = {
      ref,
      message,
      previousState: { a: 0, b: 0 },
      nextState: { a: 20, b: 0 },
      timestamp: 1,
    };
    const result = composite.evaluate(ctx);
    expect(result.isAnomaly).toBe(true);
    expect(result.heuristicName).toBe('Comp(value_delta_heuristic)');
  });

  it('should support AND mode', () => {
    const h1 = new ValueDeltaHeuristic('a', 10);
    const h2 = new ValueDeltaHeuristic('b', 10);
    const composite = new CompositeHeuristic('Comp', [h1, h2], 'AND');

    const ctx1 = {
      ref,
      message,
      previousState: { a: 0, b: 0 },
      nextState: { a: 20, b: 0 },
      timestamp: 1,
    };
    expect(composite.evaluate(ctx1).isAnomaly).toBe(false);

    const ctx2 = {
      ref,
      message,
      previousState: { a: 0, b: 0 },
      nextState: { a: 20, b: 20 },
      timestamp: 2,
    };
    expect(composite.evaluate(ctx2).isAnomaly).toBe(true);
  });
});
