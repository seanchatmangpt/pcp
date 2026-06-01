import { HookActorRef, HookBehavior, HookSupervisor } from './types';
import { stringifyActorRef } from './actorRef';
import { HookMailbox } from './mailbox';

export interface HookActorInstance {
  ref: HookActorRef;
  state: any;
  mailbox: HookMailbox;
  behavior: HookBehavior;
  supervisor: HookSupervisor;
  quarantined: boolean;
  history: any[]; // List of processed message ids and their outputs
  receiptChainHash: string; // Accumulated hash of all runs
}

export class HookRegistry {
  private instances = new Map<string, HookActorInstance>();

  public register(instance: HookActorInstance): void {
    const key = stringifyActorRef(instance.ref);
    this.instances.set(key, instance);
  }

  public get(ref: HookActorRef): HookActorInstance | undefined {
    const key = stringifyActorRef(ref);
    return this.instances.get(key);
  }

  public has(ref: HookActorRef): boolean {
    const key = stringifyActorRef(ref);
    return this.instances.has(key);
  }

  public remove(ref: HookActorRef): void {
    const key = stringifyActorRef(ref);
    this.instances.delete(key);
  }

  public clear(): void {
    this.instances.clear();
  }

  public getAll(): HookActorInstance[] {
    return Array.from(this.instances.values());
  }
}
