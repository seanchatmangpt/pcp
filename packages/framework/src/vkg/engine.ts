import { VkgHookEngine as BaseVkgHookEngine, GraphDelta } from '@/src/lib/vkg/hooks/engine';
import { VkgHook } from '@/src/lib/vkg/hooks/types';
import { SupervisorHook, PropagationMetrics } from '@/src/lib/vkg/supervisors';
import { OutboxManager } from '@/src/lib/vkg/sync/outbox';

/**
 * Architectural wrapper for VkgHookEngine.
 * Exposes a streamlined API for executing graph deltas.
 */
export class VKGEngineFacade {
  private readonly engine: BaseVkgHookEngine;

  constructor(outboxManager: OutboxManager) {
    this.engine = new BaseVkgHookEngine(outboxManager);
  }

  registerHook(hook: VkgHook): void {
    this.engine.registerHook(hook);
  }

  registerSupervisor(supervisor: SupervisorHook): void {
    this.engine.registerSupervisor(supervisor);
  }

  processDelta(delta: GraphDelta): void {
    this.engine.processDelta(delta);
  }

  getMetrics(): PropagationMetrics {
    return this.engine.getMetrics();
  }

  reset(): void {
    this.engine.reset();
  }

  /**
   * DX Utility: Process a batch of graph deltas sequentially.
   */
  processMultiple(deltas: GraphDelta[]): void {
    for (const delta of deltas) {
      this.processDelta(delta);
    }
  }
}

export {
  BaseVkgHookEngine as VkgHookEngine,
  GraphDelta,
  VkgHook,
  SupervisorHook,
  PropagationMetrics,
};
