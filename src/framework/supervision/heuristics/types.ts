import { HookActorRef, HookMessage, HookState } from '@/src/lib/truex/hook-otp/types';

/**
 * Result of a heuristic evaluation.
 */
export interface HeuristicResult {
  /** Whether an anomaly was detected. */
  isAnomaly: boolean;
  /** Suggested action if an anomaly is detected. */
  suggestedAction?: 'quarantine' | 'suppress' | 'allow';
  /** Reason for the anomaly. */
  reason?: string;
  /** The heuristic name that triggered the result. */
  heuristicName: string;
}

/**
 * Context provided to heuristics for evaluation.
 */
export interface HeuristicContext {
  ref: HookActorRef;
  message: HookMessage;
  previousState?: HookState;
  nextState?: HookState;
  timestamp: number;
}

/**
 * Interface for a heuristic.
 */
export interface Heuristic {
  name: string;
  evaluate(context: HeuristicContext): HeuristicResult;
}

/**
 * Configuration for the Heuristic Engine.
 */
export interface HeuristicEngineConfig {
  heuristics: Heuristic[];
}
