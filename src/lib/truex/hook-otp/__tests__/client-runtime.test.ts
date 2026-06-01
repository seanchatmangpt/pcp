import { HookRuntime } from '../runtime';
import { HookActorRef, HookMessage } from '../types';
import { DefaultHookSupervisor } from '../supervisor';
import { clientCanConfirm } from '../../contracts/authority';
import { projectAll } from '../../avatar/projector';

describe('Truex Client-Side Hook Runtime', () => {
  let runtime: HookRuntime;
  const ref: HookActorRef = {
    tenantId: 'tenant-123',
    packId: 'volunteer',
    hookId: 'volunteer_shortage',
    instanceId: 'inst-1',
  };

  const volunteerShortageBehavior = {
    init: async () => ({ openSlots: 3 }),
    handleDelta: async (msg: HookMessage, ctx: any) => {
      if (msg.payload.action === 'cancel') {
        ctx.state.openSlots += 1;
        return [{ type: 'slot_opened', payload: { openSlots: ctx.state.openSlots } }];
      }
      return [];
    },
  };

  beforeEach(() => {
    runtime = new HookRuntime();
  });

  test('Client can evaluate hook locally (GraphDelta produces advisory result)', async () => {
    const instance = await runtime.spawn(ref, volunteerShortageBehavior);
    expect(instance.state.openSlots).toBe(3);

    const msg: HookMessage = {
      id: 'msg-local-1',
      type: 'graph_delta',
      payload: { action: 'cancel' },
      actorRef: ref,
      timestamp: new Date().toISOString(),
    };

    runtime.send(ref, msg);
    await new Promise((resolve) => setTimeout(resolve, 30));

    expect(instance.state.openSlots).toBe(4);
  });

  test('Client can create pending receipt (status is Pending)', async () => {
    const instance = await runtime.spawn(ref, volunteerShortageBehavior);
    
    const msg: HookMessage = {
      id: 'msg-local-2',
      type: 'graph_delta',
      payload: { action: 'cancel' },
      actorRef: ref,
      timestamp: new Date().toISOString(),
    };

    runtime.send(ref, msg);
    await new Promise((resolve) => setTimeout(resolve, 30));

    const lastRun = instance.history[instance.history.length - 1];
    expect(lastRun.receipt.status).toBe('Pending');
  });

  test('Client cannot create authoritative receipt (invariant check)', async () => {
    const instance = await runtime.spawn(ref, volunteerShortageBehavior);
    
    const msg: HookMessage = {
      id: 'msg-local-3',
      type: 'graph_delta',
      payload: { action: 'cancel' },
      actorRef: ref,
      timestamp: new Date().toISOString(),
    };

    runtime.send(ref, msg);
    await new Promise((resolve) => setTimeout(resolve, 30));

    const lastRun = instance.history[instance.history.length - 1];
    // Invariant: Expo/client can never verify or confirm its own receipt as authoritative
    expect(clientCanConfirm(lastRun.receipt)).toBe(false);
  });

  test('Client projects by avatar roles', () => {
    const dummyState = { openSlots: 2, candidates: ['alice'], shortageRatio: 0.25 };
    const projections = projectAll('volunteer_shortage', dummyState);

    expect(projections.guest.visible).toBe(false);
    expect(projections.member.surface).toBe('help invitation');
    expect(projections.volunteer.surface).toBe('shift prompt');
    expect(projections.pastor.surface).toBe('risk summary');
    expect(projections.admin.surface).toBe('receipt/audit');
    expect(projections.operator.surface).toBe('replay/topology');
  });
});
