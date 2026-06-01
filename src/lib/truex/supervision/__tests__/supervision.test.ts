import { HookMessage, HookActorRef } from '../../hook-otp/types';
import { FloodSupervisor } from '../floodSupervisor';
import { PressureSupervisor } from '../pressure';
import { OscillationSupervisor } from '../oscillation';
import { AvatarLoadSupervisor } from '../avatarLoad';
import { HookMailbox } from '../../hook-otp/mailbox';
import { HookActorInstance } from '../../hook-otp/registry';
import { quarantineActor } from '../quarantine';
import { repairActor } from '../repair';
import { SupervisionProcessConformanceEvaluator } from '../supervision';

describe('Truex Hook OTP Supervision', () => {
  const actorRef: HookActorRef = {
    tenantId: 'tenant-1',
    packId: 'volunteer-pack',
    hookId: 'volunteer_cancellation',
    instanceId: 'inst-1',
  };

  test('should suppress messages under notification flood', () => {
    const supervisor = new FloodSupervisor(3, 100);
    const msg = (id: string): HookMessage => ({
      id,
      type: 'graph_delta',
      payload: {},
      actorRef,
      timestamp: new Date().toISOString(),
    });

    expect(supervisor.recordAndCheck(msg('m1'))).toBe('allow');
    expect(supervisor.recordAndCheck(msg('m2'))).toBe('allow');
    expect(supervisor.recordAndCheck(msg('m3'))).toBe('allow');
    expect(supervisor.recordAndCheck(msg('m4'))).toBe('suppress');
  });

  test('should trigger batching under high queue pressure', async () => {
    const supervisor = new PressureSupervisor(2);
    let resolveProcessor: any;
    const mailbox = new HookMailbox(async () => {
      await new Promise((resolve) => {
        resolveProcessor = resolve;
      });
    });

    expect(supervisor.checkPressure(mailbox)).toBe('allow');

    const msg = (): HookMessage => ({
      id: 'm',
      type: 'graph_delta',
      payload: {},
      actorRef,
      timestamp: new Date().toISOString(),
    });

    mailbox.push(msg()); // This starts processing and blocks
    mailbox.push(msg()); // Queued
    mailbox.push(msg()); // Queued
    mailbox.push(msg()); // Queued

    expect(supervisor.checkPressure(mailbox)).toBe('batch');
    
    // Cleanup/unblock
    if (resolveProcessor) resolveProcessor();
  });

  test('should quarantine actor under circular message oscillation', () => {
    const supervisor = new OscillationSupervisor(2);

    const msgWithTrace = (trace: string[]): HookMessage => ({
      id: 'm-trace',
      type: 'graph_delta',
      payload: { trace },
      actorRef,
      timestamp: new Date().toISOString(),
    });

    expect(supervisor.detectOscillation(msgWithTrace(['volunteer_cancellation']))).toBe('allow');
    expect(
      supervisor.detectOscillation(
        msgWithTrace(['volunteer_cancellation', 'other_hook', 'volunteer_cancellation'])
      )
    ).toBe('allow');
    expect(
      supervisor.detectOscillation(
        msgWithTrace([
          'volunteer_cancellation',
          'other_hook',
          'volunteer_cancellation',
          'other_hook2',
          'volunteer_cancellation',
          'volunteer_cancellation',
        ])
      )
    ).toBe('quarantine');
  });

  test('should suppress views under high avatar load', () => {
    const supervisor = new AvatarLoadSupervisor(0.9);
    expect(supervisor.checkLoad(0.5)).toBe('allow');
    expect(supervisor.checkLoad(0.95)).toBe('suppress');
  });

  test('should transition actor state through quarantine and repair', () => {
    const mailbox = new HookMailbox(async () => {});
    const mockInstance: HookActorInstance = {
      ref: actorRef,
      state: { data: 'old_data' },
      mailbox,
      behavior: {},
      supervisor: { onFailure: async () => 'restart' },
      quarantined: false,
      history: [],
      receiptChainHash: 'init',
    };

    quarantineActor(mockInstance, 'Replay divergence detected');
    expect(mockInstance.quarantined).toBe(true);
    expect(mockInstance.state.quarantineReason).toBe('Replay divergence detected');
    expect(mockInstance.state.quarantinedAt).toBeDefined();

    repairActor(mockInstance, { data: 'repaired_data' });
    expect(mockInstance.quarantined).toBe(false);
    expect(mockInstance.state).toEqual({ data: 'repaired_data' });
  });

  describe('SupervisionProcessConformanceEvaluator', () => {
    let evaluator: SupervisionProcessConformanceEvaluator;
    let mockInstance: HookActorInstance;
    let mailbox: HookMailbox;

    let resolveMailboxProcessor: any;

    beforeEach(() => {
      resolveMailboxProcessor = undefined;
      evaluator = new SupervisionProcessConformanceEvaluator(3, 100, 2, 2, 0.9);
      mailbox = new HookMailbox(async () => {
        if (resolveMailboxProcessor !== undefined) {
          await new Promise((resolve) => {
            resolveMailboxProcessor = resolve;
          });
        }
      });
      mockInstance = {
        ref: actorRef,
        state: { data: 'test_state' },
        mailbox,
        behavior: {},
        supervisor: { onFailure: async () => 'restart' },
        quarantined: false,
        history: [],
        receiptChainHash: 'init',
      };
    });

    const msgWithPayload = (payload: any): HookMessage => ({
      id: 'm-eval',
      type: 'graph_delta',
      payload,
      actorRef,
      timestamp: new Date().toISOString(),
    });

    test('should allow message processing under normal circumstances', () => {
      const msg = msgWithPayload({});
      const result = evaluator.evaluateMessage(msg, mockInstance, 0.5);
      expect(result.action).toBe('allow');
      expect(result.reason).toBeUndefined();
    });

    test('should recommend quarantine on message oscillation', () => {
      const msg = msgWithPayload({
        trace: ['volunteer_cancellation', 'other_hook', 'volunteer_cancellation', 'other_hook', 'volunteer_cancellation']
      });
      const result = evaluator.evaluateMessage(msg, mockInstance, 0.5);
      expect(result.action).toBe('quarantine');
      expect(result.reason).toContain('oscillation');
    });

    test('should recommend suppression under flood conditions', () => {
      evaluator.evaluateMessage(msgWithPayload({}), mockInstance, 0.5);
      evaluator.evaluateMessage(msgWithPayload({}), mockInstance, 0.5);
      evaluator.evaluateMessage(msgWithPayload({}), mockInstance, 0.5);
      const msg = msgWithPayload({});
      const result = evaluator.evaluateMessage(msg, mockInstance, 0.5);
      expect(result.action).toBe('suppress');
      expect(result.reason).toContain('flood');
    });

    test('should recommend batching under high queue pressure', () => {
      resolveMailboxProcessor = null;

      mailbox.push(msgWithPayload({})); // blocks
      mailbox.push(msgWithPayload({})); // queued
      mailbox.push(msgWithPayload({})); // queued
      mailbox.push(msgWithPayload({})); // queued

      const msg = msgWithPayload({});
      const result = evaluator.evaluateMessage(msg, mockInstance, 0.5);
      expect(result.action).toBe('batch');
      expect(result.reason).toContain('pressure');

      if (resolveMailboxProcessor) {
        resolveMailboxProcessor();
      }
    });

    test('should recommend suppression under high avatar load', () => {
      const msg = msgWithPayload({});
      const result = evaluator.evaluateMessage(msg, mockInstance, 0.95);
      expect(result.action).toBe('suppress');
      expect(result.reason).toContain('load');
    });

    describe('Trace Conformance Evaluation', () => {
      const declaredWorkflow = ['A', 'B', 'C', 'D'];

      test('should yield 1.0 fitness/precision and TRUTHFUL verdict for exact sequence', () => {
        const actualEvents = ['A', 'B', 'C', 'D'];
        const report = evaluator.evaluateTraceConformance(declaredWorkflow, actualEvents);
        expect(report.isConforming).toBe(true);
        expect(report.fitness).toBe(1.0);
        expect(report.precision).toBe(1.0);
        expect(report.verdict).toBe('TRUTHFUL');
        expect(report.deviations).toHaveLength(0);
      });

      test('should yield lower metrics and VARIANCE verdict for slightly deviant sequence', () => {
        const actualEvents = ['A', 'B', 'X', 'C', 'D'];
        const report = evaluator.evaluateTraceConformance(declaredWorkflow, actualEvents);
        expect(report.isConforming).toBe(false);
        expect(report.fitness).toBeLessThan(1.0);
        expect(report.verdict).toBe('VARIANCE');
        expect(report.deviations.length).toBeGreaterThan(0);
      });

      test('should yield DECEPTIVE verdict for highly deviant sequence', () => {
        const actualEvents = ['X', 'Y', 'Z'];
        const report = evaluator.evaluateTraceConformance(declaredWorkflow, actualEvents);
        expect(report.isConforming).toBe(false);
        expect(report.fitness).toBe(0.0);
        expect(report.verdict).toBe('DECEPTIVE');
      });

      test('should handle empty sequence gracefully', () => {
        const report = evaluator.evaluateTraceConformance([], []);
        expect(report.isConforming).toBe(true);
        expect(report.fitness).toBe(1.0);
        expect(report.verdict).toBe('TRUTHFUL');
      });

      test('should throw error for invalid input types', () => {
        expect(() => {
          evaluator.evaluateTraceConformance(null as any, []);
        }).toThrow();
        expect(() => {
          evaluator.evaluateTraceConformance([], {} as any);
        }).toThrow();
      });
    });
  });
});
