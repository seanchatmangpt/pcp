export type PredictionHorizon = 
  | "FullCase" 
  | { Events: bigint } 
  | { TimeUnits: bigint };

export type PredictionTarget = 
  | "NextActivity" 
  | "OutcomeLabel" 
  | "RemainingTime" 
  | "DriftSignal" 
  | "Risk" 
  | "ComplianceConstraint";

export interface PredictionProblem {
  prefix: string[];
  target: PredictionTarget;
  horizon: bigint | null;
}

export type PredictionRefusal = 
  | "MissingPrefix" 
  | "MissingTarget" 
  | "EmptyPrefix" 
  | "TargetUnsupported" 
  | "NonPrefixTrace" 
  | "ConstraintNotNamed";

export type PredictionResultValue = 
  | { type: "NextActivity"; activity: string }
  | { type: "OutcomeLabel"; label: string }
  | { type: "RemainingTime"; milliseconds: bigint }
  | { type: "DriftSignal"; detected: boolean; score: number }
  | { type: "Risk"; score: number; factors: string[] }
  | { type: "ComplianceConstraint"; satisfied: boolean; constraint: string };

export interface PredictionResult {
  problem: PredictionProblem;
  confidence: number;
  value: PredictionResultValue;
  timestamp: number;
}

export type Result<T, E> = 
  | { ok: true; value: T } 
  | { ok: false; error: E };

export class PredictionEngine {
  
  public validate(problem: Partial<PredictionProblem>): Result<PredictionProblem, PredictionRefusal> {
    if (!problem.prefix) {
      return { ok: false, error: "MissingPrefix" };
    }
    if (problem.prefix.length === 0) {
      return { ok: false, error: "EmptyPrefix" };
    }
    if (!problem.target) {
      return { ok: false, error: "MissingTarget" };
    }

    const target = problem.target;
    switch (target) {
      case "NextActivity":
      case "OutcomeLabel":
      case "RemainingTime":
      case "DriftSignal":
      case "Risk":
        break;
      case "ComplianceConstraint":
        if (problem.horizon === null || problem.horizon === undefined) {
          // A compliance constraint without a specified horizon/name maps to ConstraintNotNamed
          return { ok: false, error: "ConstraintNotNamed" };
        }
        break;
      default:
        // Exhaustive boundary check
        const _exhaustiveCheck: never = target;
        return { ok: false, error: "TargetUnsupported" };
    }

    for (const ev of problem.prefix) {
      if (typeof ev !== "string" || ev.trim() === "") {
        return { ok: false, error: "NonPrefixTrace" };
      }
    }

    return { 
      ok: true, 
      value: {
        prefix: problem.prefix,
        target: problem.target,
        horizon: problem.horizon ?? null
      } 
    };
  }

  public execute(rawProblem: Partial<PredictionProblem>): Result<PredictionResult, PredictionRefusal> {
    const validation = this.validate(rawProblem);
    if (!validation.ok) {
      return validation;
    }

    const problem = validation.value;
    const value = this.computePrediction(problem);

    return {
      ok: true,
      value: {
        problem,
        confidence: this.computeConfidence(problem),
        value,
        timestamp: Date.now()
      }
    };
  }

  private computePrediction(problem: PredictionProblem): PredictionResultValue {
    const target = problem.target;
    const prefixLength = problem.prefix.length;
    const lastEvent = problem.prefix[prefixLength - 1];

    if (!lastEvent) {
      throw new Error("Unreachable: prefix is validated to be non-empty.");
    }

    switch (target) {
      case "NextActivity":
        return { type: "NextActivity", activity: `${lastEvent}_followup` };
      
      case "OutcomeLabel":
        return { type: "OutcomeLabel", label: prefixLength > 5 ? "Complex" : "Simple" };
      
      case "RemainingTime":
        const baseTime = 100000n;
        const remaining = baseTime / BigInt(prefixLength);
        return { type: "RemainingTime", milliseconds: remaining };
      
      case "DriftSignal":
        const driftScore = Math.min(prefixLength * 0.05, 1.0);
        return { type: "DriftSignal", detected: driftScore > 0.5, score: driftScore };
      
      case "Risk":
        const riskScore = prefixLength > 10 ? 0.85 : 0.15;
        return { type: "Risk", score: riskScore, factors: ["PrefixLength"] };
      
      case "ComplianceConstraint":
        return { 
          type: "ComplianceConstraint", 
          satisfied: prefixLength % 2 === 0, 
          constraint: `Constraint_${problem.horizon?.toString() ?? "default"}` 
        };
      
      default:
        const _exhaustiveCheck: never = target;
        throw new Error(`Unreachable: unhandled prediction target '${_exhaustiveCheck}'`);
    }
  }

  private computeConfidence(problem: PredictionProblem): number {
    const baseConfidence = 0.95;
    const penalty = problem.prefix.length * 0.01;
    return Math.max(0.1, baseConfidence - penalty);
  }
}
