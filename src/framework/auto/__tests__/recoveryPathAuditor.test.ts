import { SelfHealingMembrane } from '../../membrane/self-healing';
import { ProxyFactory } from '../../membrane/proxy';
import { useActorOpsStore } from '@/src/lib/actor/actorOps';
import {
  ResilientTaskScheduler,
  AdaptiveLayoutEngine,
  TaskType,
  TaskPriority,
} from './autoResiliencySimulator.test';

describe('Recovery Path Auditor - Continuous Resiliency Verification', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    useActorOpsStore.getState().setNetworkOnline(true);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('1. Task Shedding and Starvation Audit', () => {
    it('should drop low priority predictive tasks under load and promote starved medium/low priority tasks', () => {
      // Initialize Resilient Task Scheduler with a 20 FPS threshold
      const scheduler = new ResilientTaskScheduler(20);
      let currentTime = 1000;

      // Enqueue a mix of vital, layout (a11y), and predictive (prefetch) tasks
      scheduler.enqueue({
        id: 'vital-1',
        type: TaskType.VITAL_SYNC,
        priority: TaskPriority.HIGH,
        createdAt: currentTime,
        runTimeMs: 10,
        deadlineMs: 30,
      });

      scheduler.enqueue({
        id: 'a11y-1',
        type: TaskType.A11Y_REBUILD,
        priority: TaskPriority.MEDIUM,
        createdAt: currentTime,
        runTimeMs: 15,
        deadlineMs: 100,
      });

      scheduler.enqueue({
        id: 'prefetch-1',
        type: TaskType.PREDICTIVE_PREFETCH,
        priority: TaskPriority.LOW,
        createdAt: currentTime,
        runTimeMs: 20,
        deadlineMs: 200,
      });

      // Assert normal processing under good FPS (60 FPS, budget 50ms)
      scheduler.tick(60, currentTime, 50);
      let metrics = scheduler.getMetrics();
      expect(metrics.processedCount[TaskType.VITAL_SYNC]).toBe(1);
      expect(metrics.processedCount[TaskType.A11Y_REBUILD]).toBe(1);
      expect(metrics.processedCount[TaskType.PREDICTIVE_PREFETCH]).toBe(1);
      expect(scheduler.getQueue().length).toBe(0);

      // Now simulate a degraded FPS condition (15 FPS, threshold 20) with heavy incoming load
      currentTime += 50;
      scheduler.enqueue({
        id: 'prefetch-degraded-1',
        type: TaskType.PREDICTIVE_PREFETCH,
        priority: TaskPriority.LOW,
        createdAt: currentTime,
        runTimeMs: 25,
        deadlineMs: 300,
      });
      scheduler.enqueue({
        id: 'vital-degraded-1',
        type: TaskType.VITAL_SYNC,
        priority: TaskPriority.HIGH,
        createdAt: currentTime,
        runTimeMs: 10,
        deadlineMs: 40,
      });

      // Under 15 FPS, scheduler must shed PREDICTIVE_PREFETCH and prioritize VITAL_SYNC
      scheduler.tick(15, currentTime, 15);
      metrics = scheduler.getMetrics();
      expect(metrics.sheddedCount[TaskType.PREDICTIVE_PREFETCH]).toBe(1);
      expect(metrics.processedCount[TaskType.VITAL_SYNC]).toBe(2); // vital-1 and vital-degraded-1
      expect(scheduler.getQueue().length).toBe(0);

      // Verify Starvation Promotion
      // Add a medium-priority task that is repeatedly blocked by high-priority tasks
      currentTime += 50;
      scheduler.enqueue({
        id: 'starved-a11y',
        type: TaskType.A11Y_REBUILD,
        priority: TaskPriority.MEDIUM,
        createdAt: currentTime,
        runTimeMs: 15,
        deadlineMs: 500,
      });

      // Keep enqueueing vital sync tasks that consume the tick budget
      for (let i = 0; i < 3; i++) {
        scheduler.enqueue({
          id: `blocker-vital-${i}`,
          type: TaskType.VITAL_SYNC,
          priority: TaskPriority.HIGH,
          createdAt: currentTime,
          runTimeMs: 10,
          deadlineMs: 100,
        });
      }

      // Tick with limited budget: vital tasks take priority, a11y task waits
      scheduler.tick(60, currentTime, 25);
      const queuedA11y = scheduler.getQueue().find((t) => t.id === 'starved-a11y');
      expect(queuedA11y).toBeDefined();
      expect(queuedA11y?.priority).toBe(TaskPriority.MEDIUM);

      // Advance simulated time past the maxAgeMs threshold (150ms)
      currentTime += 200;

      // Next tick: A11Y task should be promoted to HIGH because it starved
      scheduler.tick(60, currentTime, 40);
      metrics = scheduler.getMetrics();
      expect(metrics.starvedCount[TaskType.A11Y_REBUILD]).toBe(1);
      expect(metrics.processedCount[TaskType.A11Y_REBUILD]).toBe(2); // a11y-1 and starved-a11y
    });
  });

  describe('2. Layout Engine hitSlop and Collision Audit', () => {
    it('should compute, clamp, and resolve collisions for hitSlop dynamically', () => {
      const layout = new AdaptiveLayoutEngine();

      // Test case 1: Nominal performance (60 FPS, High Trust, 100px physical spacing)
      const nomResult = layout.computeAdaptation(60, 1.0, 100);
      expect(nomResult.hitSlop).toBe(10);
      expect(nomResult.animationSpeedScale).toBe(1.0);
      expect(nomResult.collisionDetected).toBe(false);

      // Test case 2: Low Trust (Requires precision -> smaller hitSlop)
      const lowTrustResult = layout.computeAdaptation(60, 0.0, 100);
      // trustModifier = 0.5 + 0 = 0.5. calculatedHitSlop = 10 * 0.5 * 1.0 = 5. Clamps to minHitSlop = 6
      expect(lowTrustResult.hitSlop).toBe(6);
      expect(lowTrustResult.collisionDetected).toBe(false);

      // Test case 3: Extreme performance lag (15 FPS -> larger hitSlop to compensate)
      const lowFpsResult = layout.computeAdaptation(15, 1.0, 100);
      // trustModifier = 1.0. fpsModifier = 2.5. calculatedHitSlop = 25
      expect(lowFpsResult.hitSlop).toBe(25);
      expect(lowFpsResult.collisionDetected).toBe(false);

      // Test case 4: Touch collision/theft prevention under physical constraint
      // Adjacent component spacing is very narrow (20px). calculated hitSlop is 25.
      // 25 * 2 >= 20, so collision is detected. hitSlop is quarantined to: floor(20 / 2) - 1 = 9px.
      const collisionResult = layout.computeAdaptation(15, 1.0, 20);
      expect(collisionResult.collisionDetected).toBe(true);
      expect(collisionResult.hitSlop).toBe(9);
      expect(collisionResult.hitSlop).toBeGreaterThanOrEqual(layout.minHitSlop);
    });
  });

  describe('3. Offline Banners and Network Loss Audit', () => {
    it('should dynamically update offline state store and reflect simulated network status changes', () => {
      // Verify starting state is online
      expect(useActorOpsStore.getState().networkOnline).toBe(true);

      // Simulate network loss
      useActorOpsStore.getState().setNetworkOnline(false);
      expect(useActorOpsStore.getState().networkOnline).toBe(false);

      // Restore simulated network connection
      useActorOpsStore.getState().setNetworkOnline(true);
      expect(useActorOpsStore.getState().networkOnline).toBe(true);
    });
  });
});
