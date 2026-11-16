import { HookMailbox } from '../hook-otp/mailbox';
import { SupervisorAction } from '../hook-otp/types';

export class PressureSupervisor {
  private maxQueueLength: number;

  constructor(maxQueueLength = 10) {
    this.maxQueueLength = maxQueueLength;
  }

  public checkPressure(mailbox: HookMailbox): SupervisorAction | 'allow' {
    if (mailbox.getLength() > this.maxQueueLength) {
      return 'batch';
    }
    return 'allow';
  }
}
