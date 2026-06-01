import { HookPackRegistry } from '../registry';
import { HookPackLoader } from '../loader';
import { HookPackUpgrade } from '../upgrade';
import { HookPackRollback } from '../rollback';
import { VolunteerPackManifest } from '../volunteer/manifest';
import { volunteerShortageBehavior } from '../volunteer/hooks';
import { LivestreamPackManifest } from '../livestream/manifest';
import { livestreamIncidentBehavior } from '../livestream/hooks';
import { HookRuntime } from '../../hook-otp/runtime';
import { HookActorRef } from '../../hook-otp/types';
import { TensionQueueMapper } from '../packs';

// Mock the database client structure, exposing the mock hooks directly on db
jest.mock('../../../db/db', () => {
  const mockWhereSelectFn = jest.fn();
  const mockFromFn = jest.fn().mockReturnValue({ where: mockWhereSelectFn });
  const mockSelectFn = jest.fn().mockReturnValue({ from: mockFromFn });

  const mockWhereUpdateFn = jest.fn();
  const mockSetFn = jest.fn().mockReturnValue({ where: mockWhereUpdateFn });
  const mockUpdateFn = jest.fn().mockReturnValue({ set: mockSetFn });

  return {
    db: {
      select: mockSelectFn,
      update: mockUpdateFn,

      // Export mock targets for test assertions
      _mockWhereSelect: mockWhereSelectFn,
      _mockFrom: mockFromFn,
      _mockSelect: mockSelectFn,
      _mockWhereUpdate: mockWhereUpdateFn,
      _mockSet: mockSetFn,
      _mockUpdate: mockUpdateFn,
    },
  };
});

import { db } from '../../../db/db';
const mockedDb = db as any;

describe('Truex Hook Pack Runtime', () => {
  let registry: HookPackRegistry;
  let loader: HookPackLoader;
  let upgrader: HookPackUpgrade;
  let rollback: HookPackRollback;

  beforeEach(() => {
    registry = new HookPackRegistry();
    loader = new HookPackLoader(registry);
    upgrader = new HookPackUpgrade(registry);
    rollback = new HookPackRollback(registry);
  });

  test('should load and register the volunteer pack manifest', async () => {
    await loader.load(VolunteerPackManifest);
    const manifest = registry.get('volunteer');
    expect(manifest).toBeDefined();
    expect(manifest?.version).toBe('1.0.0');
    expect(manifest?.hooks).toContain('volunteer_shortage');
  });

  test('should handle pack upgrade', async () => {
    await loader.load(VolunteerPackManifest);
    const newManifest = {
      ...VolunteerPackManifest,
      version: '1.1.0',
    };
    await upgrader.upgrade(newManifest);
    expect(registry.get('volunteer')?.version).toBe('1.1.0');
  });

  test('should rollback pack to target version', async () => {
    await loader.load(VolunteerPackManifest);
    
    // Simulate upgrade first
    const newManifest = {
      ...VolunteerPackManifest,
      version: '1.1.0',
    };
    await upgrader.upgrade(newManifest);

    // Rollback to v1.0.0
    await rollback.rollback('volunteer', '1.0.0');
    expect(registry.get('volunteer')?.version).toBe('1.0.0');
  });

  test('should spawn and execute volunteer shortage behavior from volunteer pack', async () => {
    const runtime = new HookRuntime();
    const ref: HookActorRef = {
      tenantId: 'tenant-123',
      packId: 'volunteer',
      hookId: 'volunteer_shortage',
      instanceId: 'inst-999',
    };

    const instance = await runtime.spawn(ref, volunteerShortageBehavior);
    expect(instance.state.openSlots).toBe(3);

    runtime.send(ref, {
      id: 'm1',
      type: 'graph_delta',
      payload: { action: 'cancel' },
      actorRef: ref,
      timestamp: new Date().toISOString(),
    });

    await new Promise((resolve) => setTimeout(resolve, 50));

    expect(instance.state.openSlots).toBe(4);
    expect(instance.state.shortageRatio).toBe(4 / 9);
  });

  test('should spawn and execute livestream degradation behavior with proper state transitions and duplicate suppression', async () => {
    const runtime = new HookRuntime();
    const ref: HookActorRef = {
      tenantId: 'tenant-123',
      packId: 'livestream',
      hookId: 'livestream_degradation',
      instanceId: 'inst-livestream-1',
    };

    const instance = await runtime.spawn(ref, livestreamIncidentBehavior);
    expect(instance.state.streamStatus).toBe('healthy');
    expect(instance.state.resolved).toBe(true);

    let telemetryEvents: any[] = [];
    runtime.registerTelemetry((evt) => {
      telemetryEvents.push(evt);
    });

    // 1. Trigger degrade message
    runtime.send(ref, {
      id: 'msg-degrade-1',
      type: 'graph_delta',
      payload: { action: 'degrade', bitrateKbps: 1800, packetLossRatio: 0.06 },
      actorRef: ref,
      timestamp: new Date().toISOString(),
    });

    await new Promise((resolve) => setTimeout(resolve, 50));

    expect(instance.state.streamStatus).toBe('degraded');
    expect(instance.state.resolved).toBe(false);
    expect(instance.state.operatorAlerted).toBe(true);
    expect(instance.state.memberNotified).toBe(true);
    expect(instance.state.incidentCount).toBe(1);

    // Verify effects emitted (operator_alert and member_status_projection)
    const event1 = telemetryEvents.find((e) => e.messageId === 'msg-degrade-1');
    expect(event1).toBeDefined();
    expect(event1.receipt.status).toBe('Pending');

    // 2. Trigger second degrade message (duplicate suppression check)
    telemetryEvents = [];
    runtime.send(ref, {
      id: 'msg-degrade-2',
      type: 'graph_delta',
      payload: { action: 'degrade', bitrateKbps: 1200, packetLossRatio: 0.10 },
      actorRef: ref,
      timestamp: new Date().toISOString(),
    });

    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(instance.state.bitrateKbps).toBe(1200);
    expect(instance.state.packetLossRatio).toBe(0.10);
    expect(instance.state.incidentCount).toBe(1); // should remain 1 as it didn't transition from healthy

    // 3. Trigger escalate message
    runtime.send(ref, {
      id: 'msg-escalate',
      type: 'graph_delta',
      payload: { action: 'escalate' },
      actorRef: ref,
      timestamp: new Date().toISOString(),
    });

    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(instance.state.streamStatus).toBe('escalated');
    expect(instance.state.escalated).toBe(true);

    // 4. Trigger resolve message
    runtime.send(ref, {
      id: 'msg-resolve',
      type: 'graph_delta',
      payload: { action: 'resolve' },
      actorRef: ref,
      timestamp: new Date().toISOString(),
    });

    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(instance.state.streamStatus).toBe('healthy');
    expect(instance.state.resolved).toBe(true);
    expect(instance.state.escalated).toBe(false);
    expect(instance.state.operatorAlerted).toBe(false);
    expect(instance.state.memberNotified).toBe(false);
  });

  describe('TensionQueueMapper', () => {
    let mapper: TensionQueueMapper;

    beforeEach(() => {
      mapper = new TensionQueueMapper();
      jest.clearAllMocks();

      mockedDb._mockSelect.mockReturnValue({
        from: mockedDb._mockFrom.mockReturnValue({
          where: mockedDb._mockWhereSelect,
        }),
      });

      mockedDb._mockUpdate.mockReturnValue({
        set: mockedDb._mockSet.mockReturnValue({
          where: mockedDb._mockWhereUpdate,
        }),
      });
    });

    test('should audit empty queues', async () => {
      mockedDb._mockWhereSelect.mockResolvedValue([]); // Empty for both selects

      const result = await mapper.auditTensionQueue('volunteer');
      expect(result.packName).toBe('volunteer');
      expect(result.pendingJobsCount).toBe(0);
      expect(result.jobs).toHaveLength(0);
    });

    test('should audit and filter actor_outbox and sync_queue jobs by pack name', async () => {
      const actorJobMatch = {
        id: 'job-1',
        commandId: 'cmd-1',
        jobType: 'DISPATCH_AUTHORITATIVE',
        payload: JSON.stringify({
          envelope: {
            actor: {
              packId: 'volunteer',
              hookId: 'volunteer_shortage',
              instanceId: 'inst-1',
            },
          },
        }),
        status: 'pending',
      };

      const actorJobMismatch = {
        id: 'job-2',
        commandId: 'cmd-2',
        jobType: 'DISPATCH_AUTHORITATIVE',
        payload: JSON.stringify({
          envelope: {
            actor: {
              packId: 'other_pack',
              hookId: 'some_hook',
              instanceId: 'inst-2',
            },
          },
        }),
        status: 'pending',
      };

      const syncJobMatch = {
        id: 101,
        jobType: 'ACTOR_RECEIPT',
        payload: JSON.stringify({
          actorRef: {
            packId: 'volunteer',
            hookId: 'volunteer_shortage',
          },
        }),
        entityId: 'volunteer',
        status: 'pending',
      };

      // Mock first select (actorOutbox) returning matched and mismatched
      mockedDb._mockWhereSelect.mockResolvedValueOnce([actorJobMatch, actorJobMismatch]);
      // Mock second select (syncQueue) returning matched
      mockedDb._mockWhereSelect.mockResolvedValueOnce([syncJobMatch]);

      const result = await mapper.auditTensionQueue('volunteer');
      expect(result.pendingJobsCount).toBe(2);
      expect(result.jobs[0].id).toBe('job-1');
      expect(result.jobs[0].source).toBe('actor_outbox');
      expect(result.jobs[1].id).toBe('101');
      expect(result.jobs[1].source).toBe('sync_queue');
    });

    test('should handle json parse errors gracefully during audit', async () => {
      const badActorJob = {
        id: 'job-bad-actor',
        commandId: 'cmd-bad',
        jobType: 'DISPATCH_AUTHORITATIVE',
        payload: '{invalid-json',
        status: 'pending',
      };

      const badSyncJob = {
        id: 102,
        jobType: 'ACTOR_RECEIPT',
        payload: '{invalid-json',
        status: 'pending',
      };

      mockedDb._mockWhereSelect.mockResolvedValueOnce([badActorJob]);
      mockedDb._mockWhereSelect.mockResolvedValueOnce([badSyncJob]);

      const result = await mapper.auditTensionQueue('volunteer');
      expect(result.pendingJobsCount).toBe(0);
    });

    test('should map tension queue state using rules', async () => {
      const actorJob = {
        id: 'job-1',
        commandId: 'cmd-1',
        jobType: 'DISPATCH_AUTHORITATIVE',
        payload: JSON.stringify({
          envelope: {
            actor: {
              packId: 'volunteer',
              hookId: 'volunteer_shortage',
            },
            payload: {
              oldField: 'some-value',
              stableField: 'stable-value',
            },
          },
          delta: {
            add: [
              JSON.stringify({ subject: 's', predicate: 'oldPredicate', objectValue: 'o' }),
            ],
            remove: [],
          },
        }),
        status: 'pending',
      };

      const syncJob = {
        id: 101,
        jobType: 'ACTOR_RECEIPT',
        payload: JSON.stringify({
          oldField: 'sync-value',
          stableField: 'sync-stable',
          packId: 'volunteer',
        }),
        entityId: 'volunteer',
        status: 'pending',
      };

      mockedDb._mockWhereSelect.mockResolvedValueOnce([actorJob]);
      mockedDb._mockWhereSelect.mockResolvedValueOnce([syncJob]);

      mockedDb._mockWhereUpdate.mockResolvedValue({ changes: 1 });

      const mappingRules = {
        oldField: 'newField',
        oldPredicate: 'newPredicate',
      };

      const result = await mapper.mapTensionQueueState('volunteer', mappingRules);
      expect(result.success).toBe(true);
      expect(result.mappedCount).toBe(2);

      // Verify actorOutbox update payload
      const actorUpdateCall = mockedDb._mockSet.mock.calls.find((c: any) => {
        const payloadStr = c[0].payload;
        return payloadStr && payloadStr.includes('newField') && payloadStr.includes('newPredicate');
      });
      expect(actorUpdateCall).toBeDefined();

      // Verify syncQueue update payload
      const syncUpdateCall = mockedDb._mockSet.mock.calls.find((c: any) => {
        const payloadStr = c[0].payload;
        return payloadStr && payloadStr.includes('newField') && !payloadStr.includes('oldField');
      });
      expect(syncUpdateCall).toBeDefined();
    });

    test('should handle json parse errors in delta quads and map remove array', async () => {
      const actorJob = {
        id: 'job-1',
        commandId: 'cmd-1',
        jobType: 'DISPATCH_AUTHORITATIVE',
        payload: JSON.stringify({
          envelope: {
            actor: {
              packId: 'volunteer',
              hookId: 'volunteer_shortage',
            },
          },
          delta: {
            add: [
              'invalid-quad-json',
              JSON.stringify({ subject: 's1', predicate: 'oldPredicate', objectValue: 'o1' })
            ],
            remove: [
              'invalid-remove-quad',
              JSON.stringify({ subject: 's2', predicate: 'oldPredicate', objectValue: 'o2' })
            ],
          },
        }),
        status: 'pending',
      };

      mockedDb._mockWhereSelect.mockResolvedValueOnce([actorJob]);
      mockedDb._mockWhereSelect.mockResolvedValueOnce([]); // no sync jobs

      mockedDb._mockWhereUpdate.mockResolvedValue({ changes: 1 });

      const mappingRules = {
        oldPredicate: 'newPredicate',
      };

      const result = await mapper.mapTensionQueueState('volunteer', mappingRules);
      expect(result.success).toBe(true);
      expect(result.mappedCount).toBe(1);

      const actorUpdateCall = mockedDb._mockSet.mock.calls.find((c: any) => {
        return c[0].payload && c[0].payload.includes('newPredicate');
      });
      expect(actorUpdateCall).toBeDefined();
      
      const updatedPayload = JSON.parse(actorUpdateCall[0].payload);
      expect(updatedPayload.delta.add[0]).toBe('invalid-quad-json');
      expect(updatedPayload.delta.add[1]).toContain('newPredicate');
      expect(updatedPayload.delta.remove[0]).toBe('invalid-remove-quad');
      expect(updatedPayload.delta.remove[1]).toContain('newPredicate');
    });

    test('should handle exhaustive edge cases for branch coverage', async () => {
      const actorJobEdge = {
        id: 'job-edge-actor',
        jobType: 'DISPATCH',
        payload: JSON.stringify({
          envelope: {
            actor: { kind: 'volunteer', hookId: undefined },
            payload: { sameKey: 'val', newKey: 'val' },
          },
          // delta exists but no add/remove arrays
          delta: { },
        }),
        // no status
      };

      const actorJobNoDelta = {
        id: 'job-no-delta-actor',
        jobType: 'DISPATCH',
        payload: JSON.stringify({
          envelope: {
            actor: { packId: 'volunteer' },
          },
        }),
        status: 'pending',
      };

      const actorJobUnmodified = {
        id: 'job-unmodified-actor',
        jobType: 'DISPATCH',
        payload: JSON.stringify({
          envelope: {
            actor: { kind: 'volunteer' },
            payload: { noMatchKey: 'val' },
          },
          delta: {
            add: [JSON.stringify({ subject: 's', predicate: 'noMatchPredicate', objectValue: 'o' })],
            remove: [JSON.stringify({ subject: 's', predicate: 'noMatchPredicate', objectValue: 'o' })],
          },
        }),
        status: 'pending',
      };

      const actorJobRemoveEdge = {
        id: 'job-remove-edge-actor',
        jobType: 'DISPATCH',
        payload: JSON.stringify({
          envelope: {
            actor: { packId: 'volunteer' },
          },
          delta: {
            add: [
              JSON.stringify({ subject: 's', predicate: 'samePredicate', objectValue: 'o' })
            ],
            remove: [
              JSON.stringify({ subject: 's', predicate: 'oldPredicate', objectValue: 'o' }),
              JSON.stringify({ subject: 's', predicate: 'samePredicate', objectValue: 'o' })
            ],
          },
        }),
        status: '', // falsy status
      };

      const actorJobNoEnvelope = {
        id: 'job-no-env',
        jobType: 'DISPATCH',
        payload: JSON.stringify({
          noEnvelope: true,
        }),
        status: 'pending',
      };

      const syncJobEdge = {
        id: 103,
        jobType: 'ACTOR_RECEIPT',
        payload: JSON.stringify({
          actor: { kind: 'volunteer' }, // parsed.actor instead of actorRef
          sameKey: 'val',
          newKey: 'val',
        }),
        entityId: 'other',
        // no status
      };

      const syncJobEntityMatch = {
        id: 104,
        jobType: 'SYNC',
        payload: JSON.stringify({ packId: 'other' }), // parsed.packId !== packName
        entityId: 'volunteer', // job.entityId === packName
        status: 'pending',
      };
      
      const syncJobPackIdMatch = {
        id: 105,
        jobType: 'SYNC',
        payload: JSON.stringify({ packId: 'volunteer' }), // parsed.packId === packName
        entityId: 'other',
        status: 'pending',
      };

      const syncJobFallbackMatch = {
        id: 106,
        jobType: 'SYNC',
        payload: JSON.stringify({ }), // no actorRef, no parsed.packId
        entityId: 'volunteer', // matches to be included
        status: 'pending',
      };

      const syncJobMismatch = {
        id: 107,
        jobType: 'SYNC',
        payload: JSON.stringify({ }),
        entityId: 'other',
        status: 'pending',
      };

      mockedDb._mockWhereSelect.mockResolvedValueOnce([actorJobEdge, actorJobNoDelta, actorJobUnmodified, actorJobRemoveEdge, actorJobNoEnvelope]);
      mockedDb._mockWhereSelect.mockResolvedValueOnce([syncJobEdge, syncJobEntityMatch, syncJobPackIdMatch, syncJobFallbackMatch, syncJobMismatch]);

      mockedDb._mockWhereUpdate.mockResolvedValue({ changes: 1 });

      const mappingRules = {
        sameKey: 'sameKey', // newKey === key
        newKey: 'mappedKey',
        samePredicate: 'samePredicate',
        oldPredicate: 'newPredicate'
      };

      const result = await mapper.mapTensionQueueState('volunteer', mappingRules);
      expect(result.success).toBe(true);

      // Validate queue consistency should pass if job.hookId is undefined
      mockedDb._mockWhereSelect.mockResolvedValueOnce([actorJobEdge]);
      mockedDb._mockWhereSelect.mockResolvedValueOnce([]);
      const consist = await mapper.validateQueueConsistency('volunteer', ['volunteer_shortage']);
      expect(consist.consistent).toBe(true);
    });

    test('should ignore unknown sources', async () => {
      jest.spyOn(mapper, 'auditTensionQueue').mockResolvedValueOnce({
        packName: 'volunteer',
        pendingJobsCount: 1,
        jobs: [
          { id: '1', source: 'invalid' as any, jobType: 'DISPATCH', status: 'pending', payload: {} }
        ]
      });
      const result = await mapper.mapTensionQueueState('volunteer', {});
      expect(result.mappedCount).toBe(0);
    });

    test('should validate queue consistency against allowed hooks', async () => {
      const actorJobConsistent = {
        id: 'job-1',
        payload: JSON.stringify({
          envelope: {
            actor: {
              packId: 'volunteer',
              hookId: 'volunteer_shortage',
            },
          },
        }),
        status: 'pending',
      };

      const actorJobInconsistent = {
        id: 'job-2',
        payload: JSON.stringify({
          envelope: {
            actor: {
              packId: 'volunteer',
              hookId: 'deleted_hook',
            },
          },
        }),
        status: 'pending',
      };

      mockedDb._mockWhereSelect.mockResolvedValueOnce([actorJobConsistent, actorJobInconsistent]);
      mockedDb._mockWhereSelect.mockResolvedValueOnce([]);

      const result = await mapper.validateQueueConsistency('volunteer', ['volunteer_shortage']);
      expect(result.consistent).toBe(false);
      expect(result.issues).toHaveLength(1);
      expect(result.issues[0]).toContain("references hook 'deleted_hook'");
    });
  });
});
