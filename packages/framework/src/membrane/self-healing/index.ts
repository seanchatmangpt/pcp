import { Membrane } from '../membrane';
import { MembraneConfig, ExecutionResult } from '../types';
import { SelfHealingConfig } from './types';
import { SelfHealingManager } from './manager';

export * from './types';
export * from './manager';

/**
 * SelfHealingMembrane extends the standard Pcp Membrane with autonomous
 * self-healing capabilities. It automatically captures state snapshots
 * and rolls back on corruption or deadlocks.
 */
export class SelfHealingMembrane extends Membrane {
  public readonly selfHealing: SelfHealingManager;

  constructor(config: MembraneConfig, target: any, shConfig?: SelfHealingConfig) {
    super(config);
    this.selfHealing = new SelfHealingManager(this, target, shConfig);
  }

  /**
   * Overrides the run method to capture snapshots after successful execution.
   */
  public override async run<T>(
    capabilityId: string,
    commandId: string,
    input: any,
    executionBlock: () => Promise<T>
  ): Promise<ExecutionResult<T>> {
    const result = await super.run(capabilityId, commandId, input, executionBlock);

    if (result.success) {
      this.selfHealing.captureSnapshot(result.receipt.deltaHash);
    }

    return result;
  }

  /**
   * Clean up resources.
   */
  public dispose() {
    this.selfHealing.dispose();
  }
}
