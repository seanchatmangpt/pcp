import { TokenReplayEngine, Transition } from './petri-net';

/**
 * Process Drift Detection Engine.
 * Detects structural or behavioral changes over time in log streams.
 * See [process-mining.md](file:///Users/sac/pcpapp/docs/vision2030/framework/process-mining.md) for details.
 */
export class ProcessDriftDetector {
  /**
   * Computes the Directly-Follows Relationship (DFR) distribution from a list of traces.
   * A trace is an array of transition strings.
   */
  public static computeDfrDistribution(traces: Transition[][]): Record<string, number> {
    const counts: Record<string, number> = {};
    let totalRelations = 0;

    for (const trace of traces) {
      for (let i = 0; i < trace.length - 1; i++) {
        const relation = `${trace[i]}->${trace[i + 1]}`;
        counts[relation] = (counts[relation] ?? 0) + 1;
        totalRelations += 1;
      }
    }

    const distribution: Record<string, number> = {};
    if (totalRelations > 0) {
      for (const [relation, count] of Object.entries(counts)) {
        distribution[relation] = count / totalRelations;
      }
    }

    return distribution;
  }

  /**
   * Detects process drift using Manhattan (L1) distance on Directly-Follows Relationships.
   * If the distance is greater than the threshold, we signal process drift.
   */
  public static detectDfrDrift(
    window1: Transition[][],
    window2: Transition[][],
    threshold = 0.3
  ): { driftDetected: boolean; distance: number; logs: string[] } {
    const dist1 = this.computeDfrDistribution(window1);
    const dist2 = this.computeDfrDistribution(window2);
    const absoluteDocLink =
      'See process mining guidelines at [process-mining.md](file:///Users/sac/pcpapp/docs/vision2030/framework/process-mining.md).';

    const allRelations = new Set([...Object.keys(dist1), ...Object.keys(dist2)]);
    let manhattanDistance = 0;

    for (const relation of allRelations) {
      const f1 = dist1[relation] ?? 0;
      const f2 = dist2[relation] ?? 0;
      manhattanDistance += Math.abs(f1 - f2);
    }

    // Normalized L1 distance bounded between 0 and 1
    const distance = manhattanDistance / 2;
    const driftDetected = distance > threshold;

    const logs: string[] = [];
    if (driftDetected) {
      logs.push(
        `[PROCESS DRIFT DETECTED] Structural drift detected. DFR distance: ${distance.toFixed(4)} (threshold: ${threshold}). ${absoluteDocLink}`
      );
    } else {
      logs.push(
        `[PROCESS MONITOR] No structural drift detected. DFR distance: ${distance.toFixed(4)} (threshold: ${threshold}). ${absoluteDocLink}`
      );
    }

    return {
      driftDetected,
      distance,
      logs,
    };
  }

  /**
   * Detects drift based on changes in average token-replay conformance fitness.
   * A drop in average fitness below a threshold signals governance drift.
   */
  public static detectFitnessDrift(
    window1: Transition[][],
    window2: Transition[][],
    engine: TokenReplayEngine,
    threshold = 0.15
  ): {
    driftDetected: boolean;
    fitnessDiff: number;
    window1Fitness: number;
    window2Fitness: number;
    logs: string[];
  } {
    const absoluteDocLink =
      'See process mining guidelines at [process-mining.md](file:///Users/sac/pcpapp/docs/vision2030/framework/process-mining.md).';

    const getAvgFitness = (traces: Transition[][]) => {
      if (traces.length === 0) return 1.0;
      let total = 0;
      for (const trace of traces) {
        total += engine.replayTrace(trace).fitness;
      }
      return total / traces.length;
    };

    const window1Fitness = getAvgFitness(window1);
    const window2Fitness = getAvgFitness(window2);
    const fitnessDiff = Math.abs(window1Fitness - window2Fitness);
    const driftDetected = fitnessDiff > threshold;

    const logs: string[] = [];
    if (driftDetected) {
      logs.push(
        `[PROCESS FITNESS DRIFT DETECTED] Governance/conformance drift detected. Fitness difference: ${fitnessDiff.toFixed(4)} (W1 Avg: ${window1Fitness.toFixed(4)}, W2 Avg: ${window2Fitness.toFixed(4)}, threshold: ${threshold}). ${absoluteDocLink}`
      );
    } else {
      logs.push(
        `[PROCESS MONITOR] Fitness variance stable. Difference: ${fitnessDiff.toFixed(4)} (W1 Avg: ${window1Fitness.toFixed(4)}, W2 Avg: ${window2Fitness.toFixed(4)}, threshold: ${threshold}). ${absoluteDocLink}`
      );
    }

    return {
      driftDetected,
      fitnessDiff,
      window1Fitness,
      window2Fitness,
      logs,
    };
  }
}
