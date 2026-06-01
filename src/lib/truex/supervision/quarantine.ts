import { HookActorInstance } from '../hook-otp/registry';

export function quarantineActor(instance: HookActorInstance, reason: string): void {
  instance.quarantined = true;
  if (!instance.state) {
    instance.state = {};
  }
  instance.state.quarantineReason = reason;
  instance.state.quarantinedAt = new Date().toISOString();
}
