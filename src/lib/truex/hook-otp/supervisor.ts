import { HookMessage, HookSupervisor, SupervisorAction } from './types';

export class DefaultHookSupervisor implements HookSupervisor {
  public maxRetries: number;
  public backoffMs: number;
  public quarantineOnErrorPattern: string[];

  constructor(
    maxRetries = 3,
    backoffMs = 10,
    quarantineOnErrorPattern: string[] = ['quarantine', 'fatal', 'divergence', 'validation']
  ) {
    this.maxRetries = maxRetries;
    this.backoffMs = backoffMs;
    this.quarantineOnErrorPattern = quarantineOnErrorPattern;
  }

  public async onFailure(error: any, msg: HookMessage, attempts: number): Promise<SupervisorAction> {
    const errorStr = (error?.message || String(error)).toLowerCase();

    // Check if error matches quarantine patterns
    for (const pattern of this.quarantineOnErrorPattern) {
      if (errorStr.includes(pattern)) {
        return 'quarantine';
      }
    }

    if (attempts < this.maxRetries) {
      // Apply exponential backoff delay before restarting
      const delay = this.backoffMs * Math.pow(2, attempts);
      await new Promise((resolve) => setTimeout(resolve, delay));
      return 'restart';
    }

    // If we run out of retries, quarantine the actor to isolate failure
    return 'quarantine';
  }
}
