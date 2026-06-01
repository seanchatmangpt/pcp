import { HookActorInstance } from '../hook-otp/registry';

export function repairActor(instance: HookActorInstance, cleanState: any): void {
  instance.quarantined = false;
  instance.state = { ...cleanState };
  if (instance.state) {
    delete instance.state.quarantineReason;
    delete instance.state.quarantinedAt;
  }
  instance.mailbox.clear();
}
