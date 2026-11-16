import { Heuristic, HeuristicContext, HeuristicResult, HeuristicEngineConfig } from './types';

export class HeuristicEngine {
  private heuristics: Heuristic[];

  constructor(config: HeuristicEngineConfig) {
    this.heuristics = config.heuristics;
  }

  /**
   * Evaluates a state mutation or message against all registered heuristics.
   * @param context The evaluation context.
   * @returns An array of heuristic results that flagged an anomaly.
   */
  public evaluate(context: HeuristicContext): HeuristicResult[] {
    const results: HeuristicResult[] = [];

    for (const heuristic of this.heuristics) {
      const result = heuristic.evaluate(context);
      if (result.isAnomaly) {
        results.push(result);
      }
    }

    return results;
  }

  /**
   * Adds a heuristic to the engine.
   * @param heuristic The heuristic to add.
   */
  public addHeuristic(heuristic: Heuristic): void {
    this.heuristics.push(heuristic);
  }
}
