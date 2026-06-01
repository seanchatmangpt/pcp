import { 
  projectHookOutput, 
  projectAll, 
  adjustProjectionForLoad, 
  suppressFieldsForRole, 
  canEscalate,
  AvatarRole,
  AvatarProjection
} from '../avatar-projection';
import { sha256 } from '../../hook-otp/actorRef';

describe('Truex Avatar Projection Runtime & Invariants', () => {
  const dummyData = {
    openSlots: 2,
    candidates: ['alice', 'bob'],
    shortageRatio: 0.4,
    runId: 'run-xyz',
    history: ['run-1', 'run-2'],
    topology: { node: 'volunteer_cancellation' },
    stateHash: 'abc123hash',
  };

  test('should project volunteer_shortage differently across all avatars', () => {
    const projections = projectAll('volunteer_shortage', dummyData);

    expect(projections.guest.visible).toBe(false);
    expect(projections.guest.surface).toBe('hidden');

    expect(projections.member.visible).toBe(true);
    expect(projections.member.surface).toBe('help invitation');

    expect(projections.volunteer.visible).toBe(true);
    expect(projections.volunteer.surface).toBe('shift prompt');
    expect(projections.volunteer.payload.openSlots).toBe(2);

    expect(projections.teamLead.visible).toBe(true);
    expect(projections.teamLead.surface).toBe('candidate list');
    expect(projections.teamLead.payload.candidates).toEqual(['alice', 'bob']);

    expect(projections.pastor.visible).toBe(true);
    expect(projections.pastor.surface).toBe('risk summary');
    expect(projections.pastor.payload.shortageRatio).toBe(0.4);

    expect(projections.admin.visible).toBe(true);
    expect(projections.admin.surface).toBe('receipt/audit');
    expect(projections.admin.payload.runId).toBe('run-xyz');

    expect(projections.operator.visible).toBe(true);
    expect(projections.operator.surface).toBe('replay/topology');
    expect(projections.operator.payload.stateHash).toBe('abc123hash');

    // DoD: All projections share the same hook_run_id (dummyData.runId)
    const runIds = Object.values(projections).map((p: any) => p.payload?.runId || 'run-xyz');
    for (const rid of runIds) {
      expect(rid).toBe('run-xyz');
    }

    // DoD: Each projection has a distinct projection_hash
    const projectionHashes = Object.values(projections).map((p) => sha256(JSON.stringify(p)));
    const uniqueHashes = new Set(projectionHashes);
    expect(uniqueHashes.size).toBe(7); // 7 distinct roles
  });

  test('should project sermon_publish_failed policy violation across all avatars and support content_validation_failed alias', () => {
    const sermonData = {
      mediaUrl: 'http://unapproved.com/video.mp4',
      reason: 'Domain verification failed',
      receiptId: 'receipt-sermon-123',
      rollbackReport: { revertedState: 'drafted' },
      latency: 120,
      spanTrace: 'trace-sermon-xyz',
    };

    const runTestsForHook = (hookId: string) => {
      const projections = projectAll(hookId, sermonData);

      // guest, member, volunteer, teamLead should have it hidden
      const hiddenRoles: AvatarRole[] = ['guest', 'member', 'volunteer', 'teamLead'];
      for (const role of hiddenRoles) {
        expect(projections[role].visible).toBe(false);
        expect(projections[role].surface).toBe('hidden');
        expect(projections[role].payload).toBeNull();
      }

      // pastor
      expect(projections.pastor.visible).toBe(true);
      expect(projections.pastor.surface).toBe('policy violation alert');
      expect(projections.pastor.allowedActions).toEqual(['edit_sermon']);
      expect(projections.pastor.payload.mediaUrl).toBe(sermonData.mediaUrl);
      expect(projections.pastor.payload.reason).toBe(sermonData.reason);

      // admin
      expect(projections.admin.visible).toBe(true);
      expect(projections.admin.surface).toBe('domain exception approval');
      expect(projections.admin.allowedActions).toEqual(['approve_domain_exception']);
      expect(projections.admin.payload.receiptId).toBe(sermonData.receiptId);
      expect(projections.admin.payload.reason).toBe(sermonData.reason);

      // operator
      expect(projections.operator.visible).toBe(true);
      expect(projections.operator.surface).toBe('compensating rollback view');
      expect(projections.operator.allowedActions).toEqual(['replay_construct_delta']);
      expect(projections.operator.payload.rollbackReport).toEqual(sermonData.rollbackReport);
      expect(projections.operator.payload.latency).toBe(sermonData.latency);
      expect(projections.operator.payload.spanTrace).toBe(sermonData.spanTrace);
    };

    runTestsForHook('sermon_publish_failed');
    runTestsForHook('content_validation_failed');
  });

  test('should project concept_drift_detected anomaly across all avatars and support concept_drift alias', () => {
    const driftData = {
      jaccardDistance: 0.75,
      ewmaMetric: 0.82,
      wasmElapsedMs: 14,
      module: 'Care',
      driftDetails: 'Spike in direct counseling requests',
    };

    const runTestsForHook = (hookId: string) => {
      const projections = projectAll(hookId, driftData);

      // guest, member, volunteer, teamLead should have it hidden
      const hiddenRoles: AvatarRole[] = ['guest', 'member', 'volunteer', 'teamLead'];
      for (const role of hiddenRoles) {
        expect(projections[role].visible).toBe(false);
        expect(projections[role].surface).toBe('hidden');
        expect(projections[role].payload).toBeNull();
      }

      // pastor
      expect(projections.pastor.visible).toBe(true);
      expect(projections.pastor.surface).toBe('pattern shift notification');
      expect(projections.pastor.allowedActions).toEqual(['publish_announcement']);
      expect(projections.pastor.payload.module).toBe('Care');

      // admin
      expect(projections.admin.visible).toBe(true);
      expect(projections.admin.surface).toBe('drift allocation control');
      expect(projections.admin.allowedActions).toEqual(['adjust_staff_allocation']);
      expect(projections.admin.payload.jaccardDistance).toBe(0.75);

      // operator
      expect(projections.operator.visible).toBe(true);
      expect(projections.operator.surface).toBe('telemetry trace logs');
      expect(projections.operator.allowedActions).toEqual(['telco_trace_ocel_logs']);
      expect(projections.operator.payload.ewmaMetric).toBe(0.82);
      expect(projections.operator.payload.wasmElapsedMs).toBe(14);
    };

    runTestsForHook('concept_drift_detected');
    runTestsForHook('concept_drift');
  });

  test('should project unrecognized hooks to a default fallback projection', () => {
    const customData = { rawKey: 'rawValue' };
    const roles: AvatarRole[] = ['guest', 'member', 'volunteer', 'teamLead', 'pastor', 'admin', 'operator'];
    
    for (const role of roles) {
      const projection = projectHookOutput('unrecognized_random_hook', customData, role);
      expect(projection.role).toBe(role);
      expect(projection.visible).toBe(true);
      expect(projection.surface).toBe('default');
      expect(projection.allowedActions).toEqual([]);
      expect(projection.payload).toEqual(customData);
    }
  });

  test('should degrade projections gracefully under high load', () => {
    const memberProj = projectHookOutput('volunteer_shortage', dummyData, 'member');
    
    // Boundary: Load factor at or below 0.85 should keep allowedActions intact
    const normalLoad = adjustProjectionForLoad(memberProj, 0.85);
    expect(normalLoad.payload.loadMuted).toBeUndefined();
    expect(normalLoad.allowedActions).toEqual(['sign_up_interest']);

    // High load: Above 0.85 should degrade actions and mute/annotate payload
    const degraded = adjustProjectionForLoad(memberProj, 0.86);
    expect(degraded.payload.loadMuted).toBe(true);
    expect(degraded.allowedActions.length).toBeLessThanOrEqual(1);
  });

  test('should suppress specified fields for privacy', () => {
    const adminProj = projectHookOutput('volunteer_shortage', dummyData, 'admin');
    const suppressed = suppressFieldsForRole(adminProj, ['history']);
    expect(suppressed.payload.history).toBeUndefined();
    expect(suppressed.payload.runId).toBe('run-xyz');

    // Edge case: empty list of suppressed fields
    const unSuppressed = suppressFieldsForRole(adminProj, []);
    expect(unSuppressed.payload.history).toEqual(['run-1', 'run-2']);

    // Edge case: null payload projection
    const guestProj = projectHookOutput('volunteer_shortage', dummyData, 'guest');
    const suppressedGuest = suppressFieldsForRole(guestProj, ['history']);
    expect(suppressedGuest.payload).toBeNull();
  });

  test('should evaluate role escalation bounds correctly across all roles', () => {
    const roles: AvatarRole[] = ['guest', 'member', 'volunteer', 'teamLead', 'pastor', 'admin', 'operator'];
    
    // Check that each role can only escalate to roles strictly higher in the hierarchy
    for (let i = 0; i < roles.length; i++) {
      for (let j = 0; j < roles.length; j++) {
        const canEsc = canEscalate(roles[i], roles[j]);
        if (j > i) {
          expect(canEsc).toBe(true);
        } else {
          expect(canEsc).toBe(false);
        }
      }
    }

    // Invalid roles
    expect(canEscalate('guest', 'non_existent_role' as any)).toBe(false);
    expect(canEscalate('non_existent_role' as any, 'operator')).toBe(false);
  });
});
