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
});
