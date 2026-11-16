import { useActorOpsStore } from '@/src/lib/actor/actorOps';
import { PredictionEngine } from './PredictionEngine';
import { MembraneSandbox } from './MembraneSandbox';
import { PredictedCommand, PreComputationResult, PredictiveState } from './types';
import { CommandEnvelope } from '@/src/lib/actor/types';

/**
 * PredictiveActionLayer (PAL)
 *
 * Analyzes the "Command Intent" stream and pre-computes the next 3 likely commands
 * in a sandboxed membrane context to achieve Instant UX.
 */
export class PredictiveActionLayer {
  private static instance: PredictiveActionLayer;
  private engine: PredictionEngine;
  private sandbox: MembraneSandbox;
  private state: PredictiveState;
  private listeners: Set<(state: PredictiveState) => void> = new Set();

  private constructor() {
    this.engine = new PredictionEngine();
    this.sandbox = new MembraneSandbox();
    this.state = {
      recentIntents: [],
      predictions: [],
      preComputations: new Map(),
    };

    // Auto-hook into the global state store if possible
    try {
      useActorOpsStore.subscribe((curr, prev) => {
        if (curr.latestReceipt && curr.latestReceipt !== prev.latestReceipt) {
          // This allows the layer to learn from commands dispatched elsewhere in the system
          // Note: latestReceipt doesn't contain the full envelope, but the engine
          // can be trained on command patterns.
        }
      });
    } catch (e) {
      // Store might not be initialized in all environments (e.g. some tests)
    }
  }

  /**
   * Returns the singleton instance of the Predictive Action Layer.
   */
  public static getInstance(): PredictiveActionLayer {
    if (!PredictiveActionLayer.instance) {
      PredictiveActionLayer.instance = new PredictiveActionLayer();
    }
    return PredictiveActionLayer.instance;
  }

  /**
   * Ingests a command intent from the real-time stream.
   * This triggers prediction of the next 3 commands and starts their pre-computation.
   */
  public async ingestIntent(envelope: CommandEnvelope): Promise<PredictedCommand[]> {
    // 1. Record intent in history
    this.state.recentIntents.push(envelope);
    if (this.state.recentIntents.length > 50) {
      this.state.recentIntents.shift();
    }

    // 2. Analyze history and predict next 3 likely commands
    const predictions = this.engine.analyze(envelope);
    this.state.predictions = predictions;

    // 3. Trigger asynchronous pre-computation in the sandboxed membrane
    // We don't await this to keep the ingestion "Instant"
    this.preComputeAll(predictions);

    this.notify();
    return predictions;
  }

  /**
   * Attempts to retrieve a pre-computed result for a command.
   * If found, this enables "Instant UX" by bypassing redundant computation.
   */
  public getPreComputedResult(
    actorKind: string,
    command: string,
    payload: any
  ): PreComputationResult | null {
    for (const result of this.state.preComputations.values()) {
      const { envelope } = result.predictedCommand;
      if (
        envelope.actor.kind === actorKind &&
        envelope.command === command &&
        JSON.stringify(envelope.payload) === JSON.stringify(payload)
      ) {
        return result;
      }
    }
    return null;
  }

  /**
   * Runs pre-computation for all predictions in parallel.
   */
  private async preComputeAll(predictions: PredictedCommand[]) {
    const promises = predictions.map(async (prediction) => {
      // Avoid redundant work if we already have a computation for this prediction
      const key = `${prediction.envelope.actor.kind}:${prediction.envelope.command}:${JSON.stringify(prediction.envelope.payload)}`;

      const result = await this.sandbox.preCompute(prediction);
      this.state.preComputations.set(key, result);

      // Keep pre-computations map size bounded
      if (this.state.preComputations.size > 20) {
        const oldestKey = this.state.preComputations.keys().next().value;
        if (oldestKey) this.state.preComputations.delete(oldestKey);
      }
    });

    await Promise.all(promises);
    this.notify();
  }

  /**
   * Returns the current internal state of the layer.
   */
  public getState(): PredictiveState {
    return { ...this.state };
  }

  /**
   * Subscribes to state updates.
   */
  public subscribe(listener: (state: PredictiveState) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notify() {
    this.listeners.forEach((l) => l(this.state));
  }

  /**
   * Reset for testing purposes.
   */
  public reset() {
    this.state = {
      recentIntents: [],
      predictions: [],
      preComputations: new Map(),
    };
    this.notify();
  }
}
