import { AutonomicFramework } from '../index';
import { HookMessage, HookActorRef, HookBehavior } from '@/src/lib/truex/hook-otp/types';
import { quarantineActor } from '@/src/lib/truex/supervision/quarantine';
import { repairActor } from '@/src/lib/truex/supervision/repair';

describe('Autonomic Supervision Resiliency Simulator', () => {
  const ref: HookActorRef = {
    tenantId: 'tenant-test',
    packId: 'pack-core',
    hookId: 'hook-bank',
    instanceId: 'instance-001',
  };

  // Helper to wait until mailbox processing is fully idle
  const waitMailboxIdle = async (instance: any): Promise<void> => {
    while (instance.mailbox.getLength() > 0 || instance.mailbox.processing) {
      await new Promise((resolve) => setTimeout(resolve, 2));
    }
  };

  /**
   * Scenario 1 Simulator: Synchronous Quarantine Registry Bypass
   * Demonstrates that the framework's synchronous send() method flags a quarantine action
   * but does not mutate the actor instance's 'quarantined' state in the registry,
   * allowing subsequent messages to be processed by the runtime queue unless hardened.
   */
  it('Scenario 1: Synchronous Quarantine Registry Bypass & Mitigation', async () => {
    const framework = new AutonomicFramework({
      supervision: {
        anomalyDetection: {
          enableBurstDetection: true,
          maxBurstRate: 1,
        },
      },
    });

    const behavior: HookBehavior = {
      init: async () => ({ balance: 1000 }),
      handleDelta: async (msg, ctx) => {
        ctx.state.balance += msg.payload.amount;
        return [{ type: 'balance_changed', payload: ctx.state.balance }];
      },
    };

    const instance = await framework.spawnActor(ref, behavior);

    // Send 1st message (allowed)
    const res1 = framework.send(ref, { id: 'm1', type: 'graph_delta', payload: { amount: 100 } });
    expect(res1.success).toBe(true);
    await waitMailboxIdle(instance);

    // Send 2nd message in same window (triggers burst anomaly -> returns quarantine action)
    const res2 = framework.send(ref, { id: 'm2', type: 'graph_delta', payload: { amount: 200 } });
    expect(res2.success).toBe(false);
    expect(res2.action).toBe('quarantine');

    // VULNERABILITY CONFIRMATION: The registry instance remains NOT quarantined
    expect(instance.quarantined).toBe(false);

    // --- MITIGATION / HARDENING ---
    const hardenedSend = (
      frameworkInstance: AutonomicFramework,
      targetRef: HookActorRef,
      msg: HookMessage
    ): any => {
      const result = frameworkInstance.send(targetRef, msg);
      if (result.action === 'quarantine') {
        const registry = frameworkInstance.runtime.getRegistry();
        const inst = registry.get(targetRef);
        if (inst) {
          quarantineActor(inst, result.reason || 'Synchronous quarantine triggered');
        }
      }
      return result;
    };

    const res3 = hardenedSend(framework, ref, {
      id: 'm3',
      type: 'graph_delta',
      payload: { amount: 300 },
    });
    expect(res3.action).toBe('quarantine');

    expect(instance.quarantined).toBe(true);
    expect(instance.state.quarantineReason).toBe('Anomaly detected: burst_rate_exceeded');
  });

  /**
   * Scenario 2 Simulator: Async Quarantine Hook Race Condition
   * Demonstrates that during the latency window of an asynchronous quarantine hook (e.g. operator intervention),
   * the actor instance is not yet locked, allowing concurrent messages to execute on stale state.
   */
  it('Scenario 2: Async Quarantine Hook Race Condition & Lock Mitigation', async () => {
    let hookResolve: (value: boolean) => void = () => {};
    const hookPromise = new Promise<boolean>((resolve) => {
      hookResolve = resolve;
    });

    const framework = new AutonomicFramework({
      supervision: {
        anomalyDetection: {
          abnormalPayloadSize: 50,
        },
        quarantineHooks: {
          onQuarantine: async () => {
            return await hookPromise;
          },
        },
      },
    });

    const behavior: HookBehavior = {
      init: async () => ({ balance: 500 }),
      handleDelta: async (msg, ctx) => {
        ctx.state.balance += msg.payload.amount;
        return [];
      },
    };

    const instance = await framework.spawnActor(ref, behavior);

    const largeMsg: HookMessage = {
      id: 'msg-large',
      type: 'graph_delta',
      payload: { amount: 1000, padding: 'a'.repeat(60) },
    };

    // Start sending Message 1 asynchronously (suspended waiting for hookResolve)
    const sendPromise = framework.sendAsync(ref, largeMsg);

    // VULNERABILITY CONFIRMATION: The instance is NOT quarantined or locked
    expect(instance.quarantined).toBe(false);

    // Send concurrent message
    const concurrentMsg: HookMessage = {
      id: 'msg-concurrent',
      type: 'graph_delta',
      payload: { amount: 50 },
    };

    const resConcurrent = framework.send(ref, concurrentMsg);
    expect(resConcurrent.success).toBe(true);

    // Await execution of concurrent message in mailbox
    await waitMailboxIdle(instance);
    // State is mutated on top of the soon-to-be-quarantined/rejected path
    expect(instance.state.balance).toBe(550);

    // Resolve hook
    hookResolve(false);
    const sendResult = await sendPromise;
    expect(sendResult.success).toBe(false);

    // --- MITIGATION / HARDENING ---
    const hardenedFramework = new AutonomicFramework({
      supervision: {
        anomalyDetection: { abnormalPayloadSize: 50 },
        quarantineHooks: {
          onQuarantine: async (targetRef, msg, reason) => {
            const inst = hardenedFramework.runtime.getRegistry().get(targetRef);
            if (inst) {
              inst.state.processingQuarantine = true;
            }
            const decision = await hookPromise;
            if (inst) {
              delete inst.state.processingQuarantine;
            }
            return decision;
          },
        },
      },
    });

    const hardenedSendAsync = async (
      fw: AutonomicFramework,
      targetRef: HookActorRef,
      msg: HookMessage
    ): Promise<any> => {
      const inst = fw.runtime.getRegistry().get(targetRef);
      if (inst && inst.state.processingQuarantine) {
        return {
          success: false,
          action: 'suppress',
          reason: 'Actor state is locked resolving a quarantine event',
        };
      }
      return await fw.sendAsync(targetRef, msg);
    };

    const hardenedInstance = await hardenedFramework.spawnActor(
      { ...ref, instanceId: 'instance-002' },
      behavior
    );

    // Start async send for large payload
    const p1 = hardenedFramework.sendAsync(hardenedInstance.ref, largeMsg);

    // Check lock state is active
    expect(hardenedInstance.state.processingQuarantine).toBe(true);

    // Send under lock is rejected
    const p2 = await hardenedSendAsync(hardenedFramework, hardenedInstance.ref, concurrentMsg);
    expect(p2.success).toBe(false);
    expect(p2.reason).toBe('Actor state is locked resolving a quarantine event');
  });

  /**
   * Scenario 3 Simulator: Autonomic Repair Loop Thrashing
   * Demonstrates that if an actor is repaired but the root-cause conditions remain,
   * it enters an infinite quarantine-repair oscillation (thrashing), consuming resources.
   * Enforces a repair threshold counter to break the loop.
   */
  it('Scenario 3: Autonomic Repair Loop Thrashing & Containment Bounds', async () => {
    const framework = new AutonomicFramework({
      supervision: {
        anomalyDetection: {
          enableBurstDetection: false,
        },
      },
    });

    const behavior: HookBehavior = {
      init: async () => ({ value: 0 }),
      handleDelta: async (msg, ctx) => {
        if (msg.payload.value < 0) {
          throw new Error('Negative values not allowed');
        }
        ctx.state.value = msg.payload.value;
        return [];
      },
    };

    const instance = await framework.spawnActor(ref, behavior);

    class AutonomicRepairCoordinator {
      private repairCounters = new Map<string, number>();
      private maxRepairAttempts = 3;

      constructor(private fw: AutonomicFramework) {}

      public handleQuarantine(targetRef: HookActorRef, reason: string): boolean {
        const key = `${targetRef.tenantId}:${targetRef.packId}:${targetRef.hookId}:${targetRef.instanceId}`;
        const count = this.repairCounters.get(key) || 0;

        if (count >= this.maxRepairAttempts) {
          const inst = this.fw.runtime.getRegistry().get(targetRef);
          if (inst) {
            quarantineActor(
              inst,
              `Permanently quarantined: Max repair limit of ${this.maxRepairAttempts} exceeded. Reason: ${reason}`
            );
          }
          return false;
        }

        const inst = this.fw.runtime.getRegistry().get(targetRef);
        if (inst) {
          this.repairCounters.set(key, count + 1);
          repairActor(inst, { value: 0 });
          return true;
        }
        return false;
      }

      public getRepairCount(targetRef: HookActorRef): number {
        const key = `${targetRef.tenantId}:${targetRef.packId}:${targetRef.hookId}:${targetRef.instanceId}`;
        return this.repairCounters.get(key) || 0;
      }
    }

    const coordinator = new AutonomicRepairCoordinator(framework);

    // Cycle 1
    quarantineActor(instance, 'Negative values not allowed');
    expect(instance.quarantined).toBe(true);

    let repaired = coordinator.handleQuarantine(ref, 'Negative value input');
    expect(repaired).toBe(true);
    expect(instance.quarantined).toBe(false);
    expect(coordinator.getRepairCount(ref)).toBe(1);

    // Cycle 2
    quarantineActor(instance, 'Negative values not allowed');
    repaired = coordinator.handleQuarantine(ref, 'Negative value input');
    expect(repaired).toBe(true);
    expect(coordinator.getRepairCount(ref)).toBe(2);

    // Cycle 3
    quarantineActor(instance, 'Negative values not allowed');
    repaired = coordinator.handleQuarantine(ref, 'Negative value input');
    expect(repaired).toBe(true);
    expect(coordinator.getRepairCount(ref)).toBe(3);

    // Cycle 4: Exceeded threshold
    quarantineActor(instance, 'Negative values not allowed');
    repaired = coordinator.handleQuarantine(ref, 'Negative value input');

    expect(repaired).toBe(false);
    expect(instance.quarantined).toBe(true);
    expect(instance.state.quarantineReason).toContain('Permanently quarantined: Max repair limit');
  });
});
