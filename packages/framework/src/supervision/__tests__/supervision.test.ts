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
});
