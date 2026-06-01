import { HookMessage, SupervisorAction } from '../hook-otp/types';

export class OscillationSupervisor {
  private maxDepth: number;

  constructor(maxDepth = 3) {
    this.maxDepth = maxDepth;
  }

  public detectOscillation(msg: HookMessage): SupervisorAction | 'allow' {
    const trace = msg.payload?.trace || [];
    const visits = trace.filter((t: string) => t === msg.actorRef?.hookId);
    if (visits.length > this.maxDepth) {
      return 'quarantine';
    }
    return 'allow';
  }
}
