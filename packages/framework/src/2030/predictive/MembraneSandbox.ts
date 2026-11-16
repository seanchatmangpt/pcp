import { MembraneContext } from '@/src/lib/membrane/context';
import { PredictedCommand, PreComputationResult } from './types';
import { ActorRegistry } from '@/src/lib/actor/registry';
import { ActorSupervisor } from '@/src/lib/actor/supervision';

export class MembraneSandbox {
  private context: MembraneContext;

  constructor() {
    this.context = new MembraneContext({
      mode: 'strict',
      tenantId: 'predictive-sandbox',
      authorityRole: 'volunteer',
    });
  }

  /**
   * Pre-computes a predicted command in a sandboxed membrane.
   */
  public async preCompute(predicted: PredictedCommand): Promise<PreComputationResult> {
    const startTime = Date.now();
    const { envelope } = predicted;

    try {
      // Resolve actor behavior
      const behavior = ActorRegistry.getInstance().resolve(envelope.actor.kind);
      const spec = behavior.commands[envelope.command];

      if (!spec) {
        throw new Error(`Command ${envelope.command} not found`);
      }

      // Execute within membrane context
      const membraneResult = await this.context.run(
        envelope.actor.kind,
        envelope.id,
        envelope.payload,
        async () => {
          // We use the 'construct' method of the actor spec to see what delta it generates
          // but we don't apply it to the VKG.
          return await spec.construct(envelope.payload, envelope.actor);
        }
      );

      return {
        predictedCommand: predicted,
        success: membraneResult.success,
        result: membraneResult.result,
        error: membraneResult.error,
        executionTimeMs: Date.now() - startTime,
      };
    } catch (err: any) {
      return {
        predictedCommand: predicted,
        success: false,
        result: null,
        error: err.message,
        executionTimeMs: Date.now() - startTime,
      };
    }
  }
}
