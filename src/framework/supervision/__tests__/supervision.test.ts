import { AutonomicFramework } from '../index';
import { HookMessage, HookActorRef, HookBehavior } from '@/src/lib/truex/hook-otp/types';
import { TensionQueueMapper } from '@/src/lib/truex/packs/packs';

describe('AutonomicFramework', () => {
  let framework: AutonomicFramework;

  beforeEach(() => {
    framework = new AutonomicFramework({
      supervision: {
        maxFloodLimit: 5,
        floodWindowMs: 1000,
        maxQueueLength: 10,
        maxOscillationDepth: 3,
        maxLoadFactor: 0.85,
        anomalyDetection: {
          enableBurstDetection: true,
          maxBurstRate: 10,
          abnormalPayloadSize: 1000,
        },
        retryPolicy: {
          maxRetries: 2,
          baseDelayMs: 10,
          backoffMultiplier: 2,
        },
      },
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('Initialization', () => {
    it('should initialize with default parameters', () => {
      const fw = new AutonomicFramework();
      expect(fw.runtime).toBeDefined();
      expect(fw.conformance).toBeDefined();
      expect(fw.queueMapper).toBeDefined();
    });

    it('should initialize with provided config', () => {
      expect(framework.runtime).toBeDefined();
    });
  });

  describe('Actor Management', () => {
    it('should spawn an actor and allow message sending', async () => {
      const ref: HookActorRef = { tenantId: 't1', packId: 'p1', hookId: 'h1', instanceId: 'i1' };
      const behavior: HookBehavior = {
        init: async () => ({ value: 1 }),
        handleDelta: async () => [],
      };

      const instance = await framework.spawnActor(ref, behavior);
      expect(instance).toBeDefined();
      expect(instance.ref).toEqual(ref);

      const msg: HookMessage = {
        id: 'msg1',
        type: 'graph_delta',
        payload: { delta: 'test' },
      };

      const result = framework.send(ref, msg);
      expect(result.success).toBe(true);
      expect(result.action).toBe('allow');
    });
  });

  describe('Message Supervision Evaluation (Sync)', () => {
    it('should suppress message if flood limit is exceeded', async () => {
      const ref: HookActorRef = { tenantId: 't1', packId: 'p1', hookId: 'h1', instanceId: 'i1' };
      const behavior: HookBehavior = {
        init: async () => ({}),
      };

      await framework.spawnActor(ref, behavior);

      const msg: HookMessage = { id: 'm1', type: 'graph_delta', payload: {} };

      // Send 5 times to hit limit
      for (let i = 0; i < 5; i++) {
        framework.send(ref, { ...msg, id: `m${i}` });
      }

      // 6th message should be suppressed
      const result = framework.send(ref, { id: 'm6', type: 'graph_delta', payload: {} });
      expect(result.success).toBe(false);
      expect(result.action).toBe('suppress');
    });

    it('should quarantine message if oscillation depth is exceeded', async () => {
      const ref: HookActorRef = { tenantId: 't1', packId: 'p1', hookId: 'h1', instanceId: 'i1' };
      const behavior: HookBehavior = { init: async () => ({}) };

      await framework.spawnActor(ref, behavior);

      const msg: HookMessage = {
        id: 'm1',
        type: 'graph_delta',
        actorRef: ref,
        payload: { trace: ['h1', 'h1', 'h1', 'h1'] }, // 4 visits > maxDepth 3
        causationId: 'cause_1',
      };

      const result = framework.send(ref, msg);
      expect(result.success).toBe(false);
      expect(result.action).toBe('quarantine');
    });

    it('should suppress if currentLoadFactor is too high', async () => {
      const ref: HookActorRef = { tenantId: 't1', packId: 'p1', hookId: 'h1', instanceId: 'i1' };
      const behavior: HookBehavior = { init: async () => ({}) };
      await framework.spawnActor(ref, behavior);

      const msg: HookMessage = { id: 'load_m1', type: 'graph_delta', payload: {} };

      const result = framework.send(ref, msg, 0.9); // 0.90 > 0.85 (default maxLoadFactor)
      expect(result.success).toBe(false);
      expect(result.action).toBe('suppress');
    });
  });

  describe('DX Innovations: Anomaly Detection & Async Hooks', () => {
    it('should detect burst anomalies synchronously', async () => {
      const ref: HookActorRef = {
        tenantId: 't1',
        packId: 'p1',
        hookId: 'h_burst',
        instanceId: 'i1',
      };
      await framework.spawnActor(ref, { init: async () => ({}) });

      const msg: HookMessage = { id: 'b1', type: 'graph_delta', payload: {} };
      let finalResult;

      // Send 11 times, limit is 10
      for (let i = 0; i < 11; i++) {
        finalResult = framework.send(ref, msg);
      }

      expect(finalResult?.success).toBe(false);
      expect(finalResult?.action).toBe('quarantine');
      expect(finalResult?.reason).toContain('burst_rate_exceeded');
    });

    it('should detect payload size anomalies synchronously', async () => {
      const ref: HookActorRef = {
        tenantId: 't1',
        packId: 'p1',
        hookId: 'h_payload',
        instanceId: 'i1',
      };
      await framework.spawnActor(ref, { init: async () => ({}) });

      const payloadStr = 'a'.repeat(1500); // Exceeds 1000
      const msg: HookMessage = { id: 'ps1', type: 'graph_delta', payload: { data: payloadStr } };

      const result = framework.send(ref, msg);
      expect(result.success).toBe(false);
      expect(result.action).toBe('quarantine');
      expect(result.reason).toContain('abnormal_payload_size');
    });

    it('should use async hooks to override quarantine', async () => {
      const onQuarantine = jest.fn().mockResolvedValue(true); // Allow override
      const onAnomalyDetected = jest.fn();

      const fwAsync = new AutonomicFramework({
        supervision: {
          anomalyDetection: { abnormalPayloadSize: 100 },
          quarantineHooks: { onQuarantine, onAnomalyDetected },
        },
      });

      const ref: HookActorRef = {
        tenantId: 't1',
        packId: 'p1',
        hookId: 'h_async1',
        instanceId: 'i1',
      };
      await fwAsync.spawnActor(ref, { init: async () => ({}) });

      const msg: HookMessage = {
        id: 'm1',
        type: 'graph_delta',
        payload: { data: 'a'.repeat(200) },
      };

      const result = await fwAsync.sendAsync(ref, msg);

      expect(onQuarantine).toHaveBeenCalled();
      expect(result.success).toBe(true);
      expect(result.action).toBe('allow');
    });

    it('should use async hooks and fail if override is false', async () => {
      const onQuarantine = jest.fn().mockResolvedValue(false); // Reject

      const fwAsync = new AutonomicFramework({
        supervision: {
          anomalyDetection: { abnormalPayloadSize: 100 },
          quarantineHooks: { onQuarantine },
        },
      });

      const ref: HookActorRef = {
        tenantId: 't1',
        packId: 'p1',
        hookId: 'h_async2',
        instanceId: 'i1',
      };
      await fwAsync.spawnActor(ref, { init: async () => ({}) });

      const payloadStr = 'a'.repeat(200); // Exceeds 100
      const msg: HookMessage = { id: 'm1', type: 'graph_delta', payload: { data: payloadStr } };

      const result = await fwAsync.sendAsync(ref, msg);

      expect(onQuarantine).toHaveBeenCalled();
      expect(result.success).toBe(false);
      expect(result.action).toBe('anomaly_detected');
    });

    it('should retry asynchronously on suppression before failing', async () => {
      const fwAsync = new AutonomicFramework({
        supervision: {
          maxLoadFactor: 0.85,
          retryPolicy: {
            maxRetries: 2,
            baseDelayMs: 10,
            backoffMultiplier: 2,
          },
        },
      });

      const ref: HookActorRef = {
        tenantId: 't1',
        packId: 'p1',
        hookId: 'h_retry',
        instanceId: 'i1',
      };
      await fwAsync.spawnActor(ref, { init: async () => ({}) });

      const msg: HookMessage = { id: 'm1', type: 'graph_delta', payload: {} };

      // Force suppression via high load factor
      const start = Date.now();
      const result = await fwAsync.sendAsync(ref, msg, 0.9);
      const elapsed = Date.now() - start;

      expect(result.success).toBe(false);
      expect(result.action).toBe('retry_failed');
      // Should have taken at least 10 + 20 = 30ms due to retries
      expect(elapsed).toBeGreaterThanOrEqual(30);
    });

    it('should retry asynchronously and succeed if condition improves', async () => {
      let currentLoad = 0.9;

      const fwAsync = new AutonomicFramework({
        supervision: {
          maxLoadFactor: 0.85,
          retryPolicy: {
            maxRetries: 3,
            baseDelayMs: 10,
            backoffMultiplier: 1,
          },
        },
      });

      const ref: HookActorRef = {
        tenantId: 't1',
        packId: 'p1',
        hookId: 'h_retry2',
        instanceId: 'i1',
      };
      await fwAsync.spawnActor(ref, { init: async () => ({}) });

      // We override evaluateAndDispatch temporarily to simulate load improving
      const originalEval = fwAsync['evaluateAndDispatch'].bind(fwAsync);
      let callCount = 0;
      fwAsync['evaluateAndDispatch'] = async (r, m, load) => {
        callCount++;
        if (callCount === 2) currentLoad = 0.8; // Improves on 2nd attempt
        return originalEval(r, m, currentLoad);
      };

      const msg: HookMessage = { id: 'm1', type: 'graph_delta', payload: {} };
      const result = await fwAsync.sendAsync(ref, msg, currentLoad);

      expect(result.success).toBe(true);
      expect(result.action).toBe('allow');
      expect(callCount).toBe(2);
    });

    it('should return retry_failed if attempts exceed maxRetries without improving', async () => {
      const fwAsync = new AutonomicFramework({
        supervision: {
          maxLoadFactor: 0.85,
          retryPolicy: {
            maxRetries: 1, // Only 1 retry (2 attempts total)
            baseDelayMs: 1,
          },
        },
      });

      const ref: HookActorRef = {
        tenantId: 't1',
        packId: 'p1',
        hookId: 'h_retry_fail',
        instanceId: 'i1',
      };
      await fwAsync.spawnActor(ref, { init: async () => ({}) });

      const msg: HookMessage = { id: 'm1', type: 'graph_delta', payload: {} };

      // Override to always suppress
      jest
        .spyOn(fwAsync as any, 'evaluateAndDispatch')
        .mockResolvedValue({ success: false, action: 'suppress', reason: 'High load' });

      const result = await fwAsync.sendAsync(ref, msg, 0.9);

      expect(result.success).toBe(false);
      expect(result.action).toBe('retry_failed');
    });

    it('should return null from detectAnomaly if no config', () => {
      const fwNoConfig = new AutonomicFramework();
      const ref: HookActorRef = { tenantId: 't1', packId: 'p1', hookId: 'h1', instanceId: 'i1' };
      const msg: HookMessage = { id: 'm1', type: 'graph_delta', payload: {} };

      const anomaly = fwNoConfig['detectAnomaly'](ref, msg);
      expect(anomaly).toBeNull();
    });

    it('should reset burst tracker window after 1 second', async () => {
      const ref: HookActorRef = {
        tenantId: 't1',
        packId: 'p1',
        hookId: 'h_burst_reset',
        instanceId: 'i1',
      };
      await framework.spawnActor(ref, { init: async () => ({}) });

      const msg: HookMessage = { id: 'b1', type: 'graph_delta', payload: {} };

      // Override Date.now for this test
      const originalDateNow = Date.now;
      let currentTime = 10000;
      Date.now = jest.fn(() => currentTime);

      // Send 1 to start window
      framework.send(ref, msg);

      // Advance time by 1001ms
      currentTime += 1001;

      // Send again, should hit the reset branch
      const result = framework.send(ref, msg);
      expect(result.success).toBe(true);

      Date.now = originalDateNow;
    });

    it('should use async hooks to override standard conformance quarantine', async () => {
      const onQuarantine = jest.fn().mockResolvedValue(true); // Allow override

      const fwAsync = new AutonomicFramework({
        supervision: {
          maxOscillationDepth: 1, // small depth to force quarantine
          quarantineHooks: { onQuarantine },
        },
      });

      const ref: HookActorRef = {
        tenantId: 't1',
        packId: 'p1',
        hookId: 'h_async_conf',
        instanceId: 'i1',
      };
      await fwAsync.spawnActor(ref, { init: async () => ({}) });

      const msg: HookMessage = {
        id: 'm1',
        type: 'graph_delta',
        actorRef: ref,
        payload: { trace: ['h_async_conf', 'h_async_conf'] }, // 2 visits > maxDepth 1
        causationId: 'cause_1',
      };

      const result = await fwAsync.sendAsync(ref, msg);

      expect(onQuarantine).toHaveBeenCalled();
      expect(result.success).toBe(true);
      expect(result.action).toBe('allow');
    });

    it('should fail immediately if maxRetries causes 0 maxAttempts', async () => {
      const fwAsync = new AutonomicFramework({
        supervision: {
          retryPolicy: {
            maxRetries: -1, // causes maxAttempts = 0
            baseDelayMs: 10,
          },
        },
      });

      const ref: HookActorRef = {
        tenantId: 't1',
        packId: 'p1',
        hookId: 'h_zero',
        instanceId: 'i1',
      };
      await fwAsync.spawnActor(ref, { init: async () => ({}) });

      const msg: HookMessage = { id: 'm1', type: 'graph_delta', payload: {} };
      const result = await fwAsync.sendAsync(ref, msg);

      expect(result.success).toBe(false);
      expect(result.action).toBe('retry_failed');
      expect(result.reason).toContain('Max retries exceeded');
    });
  });

  describe('Tension Queue Wrappers', () => {
    it('should proxy auditPackTension to TensionQueueMapper', async () => {
      const mockResult = { packName: 'test_pack', pendingJobsCount: 0, jobs: [] };
      jest.spyOn(TensionQueueMapper.prototype, 'auditTensionQueue').mockResolvedValue(mockResult);

      const result = await framework.auditPackTension('test_pack');
      expect(result).toEqual(mockResult);
      expect(TensionQueueMapper.prototype.auditTensionQueue).toHaveBeenCalledWith('test_pack');
    });

    it('should proxy mapPackTensionQueue to TensionQueueMapper', async () => {
      const mockResult = { success: true, mappedCount: 1, details: [] };
      jest
        .spyOn(TensionQueueMapper.prototype, 'mapTensionQueueState')
        .mockResolvedValue(mockResult);

      const rules = { oldProp: 'newProp' };
      const result = await framework.mapPackTensionQueue('test_pack', rules);
      expect(result).toEqual(mockResult);
      expect(TensionQueueMapper.prototype.mapTensionQueueState).toHaveBeenCalledWith(
        'test_pack',
        rules
      );
    });
  });

  describe('Trace Conformance Evaluation', () => {
    it('should proxy evaluateTrace to SupervisionProcessConformanceEvaluator', () => {
      const declared = ['A', 'B', 'C'];
      const actual = ['A', 'B', 'C'];

      const result = framework.evaluateTrace(declared, actual);
      expect(result.isConforming).toBe(true);
      expect(result.fitness).toBe(1.0);
    });

    it('should identify deviations in trace conformance', () => {
      const declared = ['A', 'B'];
      const actual = ['A', 'C', 'B']; // Undeclared transition A->C and C->B

      const result = framework.evaluateTrace(declared, actual);
      expect(result.isConforming).toBe(false);
      expect(result.deviations.length).toBeGreaterThan(0);
    });
  });
});
