import { useCallback } from 'react';
import { useResilientContext } from './ResilientBoundary';
import { ActorSupervisor } from '@/src/lib/actor/supervision';
import { SupervisionPolicy } from '@/src/lib/actor/types';

/**
 * A hook that wraps business logic in a resilient orchestration layer.
 * Executes through:
 * 1. ActorSupervisor (Exponential backoff & retry)
 * 2. Operational Membrane (Admissibility & Trajectory checks)
 * 3. Self-Healing Manager (Auto-restoration on persistent failure)
 */
export function useResilientCallback<T, Args extends any[]>(
  callback: (...args: Args) => Promise<T>,
  capabilityId: string,
  policy?: SupervisionPolicy
) {
  const { membrane, selfHealing } = useResilientContext();

  return useCallback(
    async (...args: Args): Promise<T> => {
      const commandId = `resilient_${Date.now()}`;

      try {
        return await ActorSupervisor.execute(async () => {
          const result = await membrane.run(capabilityId, commandId, { args }, () =>
            callback(...args)
          );
          if (!result.success) {
            throw new Error(result.error || 'Membrane execution failed');
          }
          return result.result as T;
        }, policy);
      } catch (error) {
        // Automatic heuristic: if a failure persists through supervision, attempt self-healing
        await selfHealing.heal();
        throw error;
      }
    },
    [membrane, selfHealing, callback, capabilityId, policy]
  );
}
