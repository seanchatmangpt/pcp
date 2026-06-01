import { HookActorRef, HookMessage, HookBehavior, HookSupervisor, HookEffect, HookState, HookReceipt } from './types';
import { HookRegistry, HookActorInstance } from './registry';
import { HookMailbox } from './mailbox';
import { DefaultHookSupervisor } from './supervisor';
import { runInit, runDelta } from './behavior';
import { stringifyActorRef, sha256 } from './actorRef';
import { generateReceipt } from './receipts';

export class HookRuntime {
  private registry = new HookRegistry();
  private telemetryCallbacks: ((event: any) => void)[] = [];

  public getRegistry(): HookRegistry {
    return this.registry;
  }

  /**
   * Spawns a hook actor with specified behavior, supervisor, and optional initial state.
   */
  public async spawn(
    ref: HookActorRef,
    behavior: HookBehavior,
    supervisor: HookSupervisor = new DefaultHookSupervisor(),
    initialState?: HookState
  ): Promise<HookActorInstance> {
    if (this.registry.has(ref)) {
      return this.registry.get(ref)!;
    }

    const state = initialState !== undefined ? initialState : await runInit(behavior);

    const instance: HookActorInstance = {
      ref,
      state,
      behavior,
      supervisor,
      quarantined: false,
      history: [],
      receiptChainHash: 'init_chain_hash',
      mailbox: new HookMailbox(async (msg) => {
        await this.processMessage(ref, msg);
      }),
    };

    this.registry.register(instance);
    return instance;
  }

  /**
   * Sends a message to a HookActorRef, queuing it in its mailbox.
   */
  public send(ref: HookActorRef, msg: HookMessage): void {
    const instance = this.registry.get(ref);
    if (!instance) {
      throw new Error(`Actor not registered: ${stringifyActorRef(ref)}`);
    }
    if (instance.quarantined) {
      this.emitTelemetry({
        type: 'message_refused_quarantined',
        actorRef: ref,
        messageId: msg.id,
      });
      return;
    }
    instance.mailbox.push(msg);
  }

  /**
   * Internal message evaluation loop with supervisor retry and quarantine recovery capabilities.
   */
  private async processMessage(ref: HookActorRef, msg: HookMessage): Promise<void> {
    const instance = this.registry.get(ref);
    if (!instance) return;

    if (instance.quarantined) {
      this.emitTelemetry({
        type: 'message_refused_quarantined',
        actorRef: ref,
        messageId: msg.id,
      });
      return;
    }

    let attempts = 0;
    let success = false;
    let effects: HookEffect[] = [];
    let error: any = null;

    const previousHash = instance.receiptChainHash;
    const inputHash = sha256(JSON.stringify(msg.payload || {}));

    while (!success && !instance.quarantined) {
      try {
        attempts++;
        const ctx = {
          actorRef: ref,
          state: { ...instance.state },
          timestamp: new Date().toISOString(),
        };

        if (msg.type === 'graph_delta') {
          effects = await runDelta(instance.behavior, msg, ctx);
          // Apply changes to the state if needed (behaviors can mutate state in our framework)
          // To ensure clean state updates, behaviors can mutate state on context or return state mutations as effects.
          // By convention, we let behaviors directly edit state within ctx, and we apply it.
          instance.state = ctx.state;
        } else if (msg.type === 'receipt_event') {
          if (instance.behavior.handleReceipt) {
            await instance.behavior.handleReceipt(msg, ctx);
            instance.state = ctx.state;
          }
        } else if (msg.type === 'supervisor_signal') {
          if (msg.payload?.action === 'repair') {
            instance.quarantined = false;
            if (msg.payload.state) {
              instance.state = msg.payload.state;
            }
            this.emitTelemetry({
              type: 'actor_repaired',
              actorRef: ref,
              messageId: msg.id,
            });
            success = true;
            break;
          }
        }
        success = true;
      } catch (err: any) {
        error = err;
        const action = await instance.supervisor.onFailure(err, msg, attempts);
        
        this.emitTelemetry({
          type: 'supervisor_intervention',
          actorRef: ref,
          messageId: msg.id,
          attempt: attempts,
          action,
          error: err.message || String(err),
        });

        if (action === 'quarantine') {
          instance.quarantined = true;
          break;
        } else if (action === 'restart') {
          // Continue loop
        } else {
          // Default to quarantine for safety
          instance.quarantined = true;
          break;
        }
      }
    }

    if (success && !instance.quarantined) {
      const outputHash = sha256(JSON.stringify(effects) + JSON.stringify(instance.state));
      const deltaHash = sha256(JSON.stringify(effects));

      const runId = 'run_' + sha256(msg.id + attempts + Date.now()).substring(0, 16);
      const receipt = generateReceipt({
        tenantId: ref.tenantId,
        actorRef: ref,
        messageId: msg.id,
        previousReceiptHash: previousHash,
        inputHash,
        outputHash,
        deltaHash,
        status: 'Pending',
        hookRunId: runId,
      });

      instance.receiptChainHash = receipt.receiptHash;
      instance.history.push({
        messageId: msg.id,
        runId,
        outputHash,
        receipt,
      });

      this.emitTelemetry({
        type: 'message_processed',
        actorRef: ref,
        messageId: msg.id,
        receipt,
      });

      // Dispatch effects sequentially (hooks never call each other directly)
      for (const effect of effects) {
        if (effect.type === 'send_message') {
          const { to, message } = effect.payload;
          this.send(to, message);
        }
      }
    }
  }

  public registerTelemetry(cb: (event: any) => void): void {
    this.telemetryCallbacks.push(cb);
  }

  public unregisterTelemetry(cb: (event: any) => void): void {
    this.telemetryCallbacks = this.telemetryCallbacks.filter((c) => c !== cb);
  }

  private emitTelemetry(event: any): void {
    for (const cb of this.telemetryCallbacks) {
      try {
        cb(event);
      } catch (e) {
        console.error('Error executing telemetry callback:', e);
      }
    }
  }
}
