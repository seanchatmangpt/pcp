import { HookRuntime } from '../runtime';
import { HookActorRef, HookMessage, HookBehavior, HookEffect } from '../types';
import { DefaultHookSupervisor } from '../supervisor';
import { verifyReceiptChain } from '../receipts';
import { proveReplay } from '../replay';

describe('Truex Hook OTP Behavioral Specification', () => {
  let runtime: HookRuntime;

  const actorA: HookActorRef = { tenantId: 't1', packId: 'p1', hookId: 'hookA', instanceId: 'inst-1' };
  const actorB: HookActorRef = { tenantId: 't1', packId: 'p1', hookId: 'hookB', instanceId: 'inst-1' };
  const actorC: HookActorRef = { tenantId: 't1', packId: 'p1', hookId: 'hookC', instanceId: 'inst-1' };

  beforeEach(() => {
    runtime = new HookRuntime();
  });

  test('Test 1 — Mailbox ordering', async () => {
    const processedOrder: string[] = [];
    const behavior: HookBehavior = {
      init: async () => ({}),
      handleDelta: async (msg, ctx) => {
        processedOrder.push(msg.id);
        return [];
      },
    };

    const instance = await runtime.spawn(actorA, behavior);

    const msgA: HookMessage = { id: 'msgA', type: 'graph_delta', payload: {}, actorRef: actorA, timestamp: new Date().toISOString() };
    const msgB: HookMessage = { id: 'msgB', type: 'graph_delta', payload: {}, actorRef: actorA, timestamp: new Date().toISOString() };
    const msgC: HookMessage = { id: 'msgC', type: 'graph_delta', payload: {}, actorRef: actorA, timestamp: new Date().toISOString() };

    runtime.send(actorA, msgA);
    runtime.send(actorA, msgB);
    runtime.send(actorA, msgC);

    await new Promise((resolve) => setTimeout(resolve, 50));

    // Handler receives A, B, C in order
    expect(processedOrder).toEqual(['msgA', 'msgB', 'msgC']);

    // Receipt chain preserves that order
    const receipts = instance.history.map((h) => h.receipt);
    expect(receipts.length).toBe(3);
    expect(receipts[0].messageId).toBe('msgA');
    expect(receipts[1].messageId).toBe('msgB');
    expect(receipts[2].messageId).toBe('msgC');
    expect(verifyReceiptChain(receipts)).toBe(true);
  });

  test('Test 2 — No direct hook calls', async () => {
    // Hook A sends a HookMessage to Hook B instead of importing or invoking it directly
    const behaviorA: HookBehavior = {
      init: async () => ({}),
      handleDelta: async (msg, ctx) => {
        return [
          {
            type: 'send_message',
            payload: {
              to: actorB,
              message: {
                id: 'msg-triggered-by-a',
                type: 'graph_delta',
                payload: { value: 'from_a' },
                actorRef: actorB,
                timestamp: new Date().toISOString(),
              },
            },
          },
        ];
      },
    };

    let receivedByB: any = null;
    const behaviorB: HookBehavior = {
      init: async () => ({}),
      handleDelta: async (msg, ctx) => {
        receivedByB = msg.payload.value;
        return [];
      },
    };

    await runtime.spawn(actorA, behaviorA);
    await runtime.spawn(actorB, behaviorB);

    runtime.send(actorA, {
      id: 'trigger-msg',
      type: 'graph_delta',
      payload: {},
      actorRef: actorA,
      timestamp: new Date().toISOString(),
    });

    await new Promise((resolve) => setTimeout(resolve, 50));

    // Hook B received the message routed through Hook A's effects and the runtime mailbox
    expect(receivedByB).toBe('from_a');
  });

  test('Test 3 — Supervisor isolates failure', async () => {
    // Hook B throws and gets quarantined, but A and C continue
    const behaviorA: HookBehavior = {
      init: async () => ({ state: 'ok' }),
      handleDelta: async (msg, ctx) => {
        ctx.state.state = 'done_a';
        return [];
      },
    };

    const behaviorB: HookBehavior = {
      init: async () => ({ state: 'ok' }),
      handleDelta: async (msg, ctx) => {
        throw new Error('quarantine: Crash in Hook B');
      },
    };

    const behaviorC: HookBehavior = {
      init: async () => ({ state: 'ok' }),
      handleDelta: async (msg, ctx) => {
        ctx.state.state = 'done_c';
        return [];
      },
    };

    const supervisor = new DefaultHookSupervisor(1, 5, ['quarantine']);

    const instA = await runtime.spawn(actorA, behaviorA, supervisor);
    const instB = await runtime.spawn(actorB, behaviorB, supervisor);
    const instC = await runtime.spawn(actorC, behaviorC, supervisor);

    let quarantineEmitted = false;
    runtime.registerTelemetry((evt) => {
      if (evt.type === 'supervisor_intervention' && evt.action === 'quarantine' && evt.actorRef.hookId === 'hookB') {
        quarantineEmitted = true;
      }
    });

    runtime.send(actorA, { id: 'm-a', type: 'graph_delta', payload: {}, actorRef: actorA, timestamp: new Date().toISOString() });
    runtime.send(actorB, { id: 'm-b', type: 'graph_delta', payload: {}, actorRef: actorB, timestamp: new Date().toISOString() });
    runtime.send(actorC, { id: 'm-c', type: 'graph_delta', payload: {}, actorRef: actorC, timestamp: new Date().toISOString() });

    await new Promise((resolve) => setTimeout(resolve, 60));

    expect(instA.state.state).toBe('done_a');
    expect(instC.state.state).toBe('done_c');

    expect(instB.quarantined).toBe(true);
    expect(quarantineEmitted).toBe(true);
  });

  test('Test 4 — Restart policy', async () => {
    let attempts = 0;
    const behavior: HookBehavior = {
      init: async () => ({}),
      handleDelta: async (msg, ctx) => {
        attempts++;
        if (attempts < 2) {
          throw new Error('transient error: Retry');
        }
        return [];
      },
    };

    // Supervisor has 3 retries, and retries on any transient error
    const supervisor = new DefaultHookSupervisor(3, 5, ['quarantine']);
    const instance = await runtime.spawn(actorA, behavior, supervisor);

    let restartEventsCount = 0;
    runtime.registerTelemetry((evt) => {
      if (evt.type === 'supervisor_intervention' && evt.action === 'restart') {
        restartEventsCount++;
      }
    });

    runtime.send(actorA, {
      id: 'msg-restart-test',
      type: 'graph_delta',
      payload: {},
      actorRef: actorA,
      timestamp: new Date().toISOString(),
    });

    await new Promise((resolve) => setTimeout(resolve, 50));

    expect(attempts).toBe(2);
    expect(instance.quarantined).toBe(false);
    expect(restartEventsCount).toBe(1);
  });

  test('Test 5 — Poison message quarantine', async () => {
    const behavior: HookBehavior = {
      init: async () => ({ value: 100 }),
      handleDelta: async (msg, ctx) => {
        if (msg.payload.poisonous) {
          throw new Error('quarantine: Poison payload');
        }
        ctx.state.value = msg.payload.value;
        return [];
      },
    };

    const supervisor = new DefaultHookSupervisor(1, 5, ['quarantine']);
    const instance = await runtime.spawn(actorA, behavior, supervisor);

    // Send valid message
    runtime.send(actorA, { id: 'msg-valid', type: 'graph_delta', payload: { value: 200 }, actorRef: actorA, timestamp: new Date().toISOString() });
    await new Promise((resolve) => setTimeout(resolve, 30));
    expect(instance.state.value).toBe(200);

    // Send poison message
    const poisonMsg: HookMessage = {
      id: 'msg-poison',
      type: 'graph_delta',
      payload: { poisonous: true, value: 999 },
      actorRef: actorA,
      timestamp: new Date().toISOString(),
    };

    runtime.send(actorA, poisonMsg);
    await new Promise((resolve) => setTimeout(resolve, 30));

    // Message is quarantined, state unchanged, replay proof verified
    expect(instance.quarantined).toBe(true);
    expect(instance.state.value).toBe(200); // Unchanged

    const history = instance.history.map((h) => ({
      messageId: h.messageId,
      outputHash: h.outputHash,
      runId: h.runId,
    }));

    // Verify replay evidence exists for the last valid state
    const proof = await proveReplay(actorA, { value: 100 }, [
      { id: 'msg-valid', type: 'graph_delta', payload: { value: 200 }, actorRef: actorA, timestamp: new Date().toISOString() }
    ], history, behavior);
    expect(proof.verified).toBe(true);
    expect(proof.finalState.value).toBe(200);
  });
});
