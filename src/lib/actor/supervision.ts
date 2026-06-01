/**
 * @fileoverview Actor Supervisor managing execution fault boundaries, retries, and isolation.
 */

import { SupervisionPolicy } from './types';

const DEFAULT_SUPERVISION_POLICY: SupervisionPolicy = {
  maxRetries: 3,
  backoffMs: 50,
  strategy: 'restart',
};

export class ActorSupervisor {
  /**
   * Executes a command action function inside a fault boundary.
   * Applies configured supervision strategies such as exponential backoff retries.
   *
   * @param operation The operation to execute.
   * @param policy The supervision policy to apply.
   */
  public static async execute<T>(
    operation: () => Promise<T>,
    policy: SupervisionPolicy = DEFAULT_SUPERVISION_POLICY
  ): Promise<T> {
    let attempt = 0;

    while (true) {
      try {
        attempt++;
        return await operation();
      } catch (error: any) {
        // If max retries reached or strategy says stop, propagate error
        if (attempt > policy.maxRetries || policy.strategy === 'stop') {
          throw error;
        }

        // Apply backoff: backoffMs * 2^(attempt-1)
        const delay = policy.backoffMs * Math.pow(2, attempt - 1);
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }
}
