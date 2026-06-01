import { CommandEnvelope, Receipt } from '@/src/lib/actor/types';

/**
 * Represents a predicted command that might be executed in the future.
 */
export interface PredictedCommand {
  envelope: CommandEnvelope;
  probability: number;
  reason: string;
}

/**
 * Results of a pre-computation in the membrane sandbox.
 */
export interface PreComputationResult {
  predictedCommand: PredictedCommand;
  success: boolean;
  result: any;
  error?: string;
  executionTimeMs: number;
}

/**
 * The predictive action layer state.
 */
export interface PredictiveState {
  recentIntents: CommandEnvelope[];
  predictions: PredictedCommand[];
  preComputations: Map<string, PreComputationResult>;
}

/**
 * Listener for prediction events.
 */
export type PredictionListener = (predictions: PredictedCommand[]) => void;
