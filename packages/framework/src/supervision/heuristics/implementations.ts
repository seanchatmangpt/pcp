import { Heuristic, HeuristicContext, HeuristicResult } from './types';

/**
 * Heuristic that flags anomalies based on the frequency of messages/mutations.
 */
export class FrequencyHeuristic implements Heuristic {
  public readonly name = 'frequency_heuristic';
  private history: Map<string, number[]> = new Map();

  constructor(
    private readonly config: {
      threshold: number;
      windowMs: number;
      groupBy?: (context: HeuristicContext) => string;
    }
  ) {}

  public evaluate(context: HeuristicContext): HeuristicResult {
    const key = this.config.groupBy ? this.config.groupBy(context) : this.getKey(context);
    const now = context.timestamp;

    let timestamps = this.history.get(key) || [];
    timestamps = timestamps.filter((t) => now - t <= this.config.windowMs);
    timestamps.push(now);
    this.history.set(key, timestamps);

    if (timestamps.length > this.config.threshold) {
      return {
        isAnomaly: true,
        suggestedAction: 'quarantine',
        reason: `Frequency exceeded for ${key}: ${timestamps.length} events in ${this.config.windowMs}ms (threshold: ${this.config.threshold})`,
        heuristicName: this.name,
      };
    }

    return { isAnomaly: false, heuristicName: this.name };
  }

  private getKey(context: HeuristicContext): string {
    const { ref } = context;
    return `${ref.tenantId}:${ref.packId}:${ref.hookId}:${ref.instanceId}`;
  }
}

/**
 * Composite heuristic that combines multiple heuristics using AND/OR logic.
 */
export class CompositeHeuristic implements Heuristic {
  public readonly name: string;

  constructor(
    name: string,
    private readonly heuristics: Heuristic[],
    private readonly mode: 'AND' | 'OR' = 'OR'
  ) {
    this.name = name;
  }

  public evaluate(context: HeuristicContext): HeuristicResult {
    const results = this.heuristics.map((h) => h.evaluate(context));

    if (this.mode === 'OR') {
      const anomaly = results.find((r) => r.isAnomaly);
      return anomaly
        ? { ...anomaly, heuristicName: `${this.name}(${anomaly.heuristicName})` }
        : { isAnomaly: false, heuristicName: this.name };
    } else {
      const allAnomalies = results.every((r) => r.isAnomaly);
      if (allAnomalies) {
        return {
          isAnomaly: true,
          suggestedAction: 'quarantine',
          reason: `Composite AND triggered: [${results.map((r) => r.reason).join(', ')}]`,
          heuristicName: this.name,
        };
      }
      return { isAnomaly: false, heuristicName: this.name };
    }
  }
}

/**
 * Heuristic that flags anomalies based on the delta of a numeric value in the state.
 */
export class ValueDeltaHeuristic implements Heuristic {
  public readonly name = 'value_delta_heuristic';

  constructor(
    private readonly path: string,
    private readonly maxDelta: number
  ) {}

  public evaluate(context: HeuristicContext): HeuristicResult {
    const { previousState, nextState } = context;
    if (!previousState || !nextState) {
      return { isAnomaly: false, heuristicName: this.name };
    }

    const prevValue = this.getValue(previousState, this.path);
    const nextValue = this.getValue(nextState, this.path);

    if (typeof prevValue === 'number' && typeof nextValue === 'number') {
      const delta = Math.abs(nextValue - prevValue);
      if (delta > this.maxDelta) {
        return {
          isAnomaly: true,
          suggestedAction: 'quarantine',
          reason: `Value delta for ${this.path} exceeded: ${delta} (max: ${this.maxDelta})`,
          heuristicName: this.name,
        };
      }
    }

    return { isAnomaly: false, heuristicName: this.name };
  }

  private getValue(state: any, path: string): any {
    return path
      .split('.')
      .reduce((obj, key) => (obj && obj[key] !== undefined ? obj[key] : undefined), state);
  }
}

/**
 * Heuristic that flags anomalies based on statistical variance of a numeric value.
 */
export class VarianceHeuristic implements Heuristic {
  public readonly name = 'variance_heuristic';
  private values: Map<string, number[]> = new Map();

  constructor(
    private readonly path: string,
    private readonly zScoreThreshold: number,
    private readonly minSamples: number = 5
  ) {}

  public evaluate(context: HeuristicContext): HeuristicResult {
    const { nextState } = context;
    if (!nextState) return { isAnomaly: false, heuristicName: this.name };

    const value = this.getValue(nextState, this.path);
    if (typeof value !== 'number') return { isAnomaly: false, heuristicName: this.name };

    const key = this.getKey(context);
    const history = this.values.get(key) || [];

    if (history.length >= this.minSamples) {
      const mean = history.reduce((a, b) => a + b, 0) / history.length;
      const variance = history.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / history.length;
      const stdDev = Math.sqrt(variance);

      if (stdDev > 0) {
        const zScore = Math.abs(value - mean) / stdDev;
        if (zScore > this.zScoreThreshold) {
          return {
            isAnomaly: true,
            suggestedAction: 'quarantine',
            reason: `Statistical variance anomaly for ${this.path}: z-score ${zScore.toFixed(2)} (threshold: ${this.zScoreThreshold})`,
            heuristicName: this.name,
          };
        }
      }
    }

    history.push(value);
    // Keep last 100 samples
    if (history.length > 100) history.shift();
    this.values.set(key, history);

    return { isAnomaly: false, heuristicName: this.name };
  }

  private getKey(context: HeuristicContext): string {
    const { ref } = context;
    return `${ref.tenantId}:${ref.packId}:${ref.hookId}:${ref.instanceId}:${this.path}`;
  }

  private getValue(state: any, path: string): any {
    return path
      .split('.')
      .reduce((obj, key) => (obj && obj[key] !== undefined ? obj[key] : undefined), state);
  }
}
