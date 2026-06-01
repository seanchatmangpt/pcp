import { HookMessage, SupervisorAction } from '../hook-otp/types';

export class FloodSupervisor {
  private lastTimestamps: number[] = [];
  private limit: number;
  private windowMs: number;

  constructor(limit = 5, windowMs = 1000) {
    this.limit = limit;
    this.windowMs = windowMs;
  }

  public recordAndCheck(msg: HookMessage): SupervisorAction | 'allow' {
    const now = Date.now();
    this.lastTimestamps.push(now);
    this.lastTimestamps = this.lastTimestamps.filter((t) => now - t < this.windowMs);

    if (this.lastTimestamps.length > this.limit) {
      return 'suppress';
    }
    return 'allow';
  }
}
