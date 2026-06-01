import { useLWWMap } from '../../sync/crdt/hooks';

// --- SYSTEM UNDER TEST DEFINITIONS ---

export enum TaskPriority {
  LOW = 0,
  MEDIUM = 1,
  HIGH = 2,
}

export enum TaskType {
  VITAL_SYNC = 'VITAL_SYNC',
  A11Y_REBUILD = 'A11Y_REBUILD',
  PREDICTIVE_PREFETCH = 'PREDICTIVE_PREFETCH',
}

export interface Task {
  id: string;
  type: TaskType;
  priority: TaskPriority;
  createdAt: number;
  runTimeMs: number;
  deadlineMs: number;
}

export interface SchedulerMetrics {
  processedCount: Record<TaskType, number>;
  starvedCount: Record<TaskType, number>;
  sheddedCount: Record<TaskType, number>;
  avgLatencyMs: Record<TaskType, number>;
}

/**
 * Resilient Task Scheduler with starvation prevention and task shedding.
 */
export class ResilientTaskScheduler {
  private queue: Task[] = [];
  private metrics: SchedulerMetrics = {
    processedCount: {
      [TaskType.VITAL_SYNC]: 0,
      [TaskType.A11Y_REBUILD]: 0,
      [TaskType.PREDICTIVE_PREFETCH]: 0,
    },
    starvedCount: {
      [TaskType.VITAL_SYNC]: 0,
      [TaskType.A11Y_REBUILD]: 0,
      [TaskType.PREDICTIVE_PREFETCH]: 0,
    },
    sheddedCount: {
      [TaskType.VITAL_SYNC]: 0,
      [TaskType.A11Y_REBUILD]: 0,
      [TaskType.PREDICTIVE_PREFETCH]: 0,
    },
    avgLatencyMs: {
      [TaskType.VITAL_SYNC]: 0,
      [TaskType.A11Y_REBUILD]: 0,
      [TaskType.PREDICTIVE_PREFETCH]: 0,
    },
  };

  private maxAgeMs = 150; // Age threshold for promoting low/medium priority tasks
  private vitalProcessingTime = 0;

  constructor(private fpsThreshold: number = 20) {}

  enqueue(task: Task) {
    this.queue.push(task);
  }

  getQueue() {
    return this.queue;
  }

  getMetrics(): SchedulerMetrics {
    return this.metrics;
  }

  /**
   * Processes a single tick of scheduling.
   * @param currentFps Current frames per second of the system.
   * @param currentTimeMs Current simulation timestamp.
   * @param availableTimeMs Maximum CPU execution time allocated for this tick.
   */
  tick(currentFps: number, currentTimeMs: number, availableTimeMs: number) {
    // 1. Task Shedding: If performance is degraded, discard non-vital tasks immediately.
    if (currentFps < this.fpsThreshold) {
      const originalLength = this.queue.length;
      const shedded: Task[] = [];

      this.queue = this.queue.filter((task) => {
        if (task.type === TaskType.PREDICTIVE_PREFETCH) {
          shedded.push(task);
          this.metrics.sheddedCount[task.type]++;
          return false; // Shed predictive tasks
        }
        return true;
      });
    }

    // 2. Starvation Prevention / Dynamic Promotion:
    // Any task waiting longer than maxAgeMs gets its priority elevated to HIGH.
    this.queue = this.queue.map((task) => {
      const age = currentTimeMs - task.createdAt;
      if (age > this.maxAgeMs && task.priority < TaskPriority.HIGH) {
        this.metrics.starvedCount[task.type]++;
        return { ...task, priority: TaskPriority.HIGH };
      }
      return task;
    });

    // 3. Sorting by priority (highest first) and age (oldest first)
    this.queue.sort((a, b) => {
      if (a.priority !== b.priority) {
        return b.priority - a.priority;
      }
      return a.createdAt - b.createdAt;
    });

    // 4. Task Processing loop within tick budget
    let timeSpent = 0;
    const remainingTasks: Task[] = [];

    for (const task of this.queue) {
      if (timeSpent + task.runTimeMs <= availableTimeMs) {
        timeSpent += task.runTimeMs;
        const latency = currentTimeMs - task.createdAt;

        // Update metrics
        const prevCount = this.metrics.processedCount[task.type];
        const prevAvg = this.metrics.avgLatencyMs[task.type];
        this.metrics.avgLatencyMs[task.type] = (prevAvg * prevCount + latency) / (prevCount + 1);
        this.metrics.processedCount[task.type]++;
      } else {
        remainingTasks.push(task);
      }
    }

    this.queue = remainingTasks;
  }
}

/**
 * Layout Engine simulating UI adaptation and collision detection.
 */
export class AdaptiveLayoutEngine {
  private baseHitSlop = 10;

  // Safe boundaries (Hard invariants)
  public minHitSlop = 6;
  public maxHitSlop = 40;
  public minSpeedScale = 1.0;
  public maxSpeedScale = 3.0;

  /**
   * Computes hitSlop and animation scale with safe clamping and telemetry mapping.
   */
  computeAdaptation(fps: number, trustScore: number, physicalSpacing: number) {
    // 1. Raw computations matching AutoUX equations
    const trustModifier = 0.5 + trustScore * 0.5; // 0.5 to 1.0
    const fpsModifier = fps < 30 ? 2.5 : fps < 45 ? 1.8 : 1.0;
    let calculatedHitSlop = Math.round(this.baseHitSlop * trustModifier * fpsModifier);

    let calculatedAnimationSpeedScale = 1.0;
    if (fps < 30) {
      calculatedAnimationSpeedScale = 1.5;
    } else if (fps < 50 || trustScore < 0.6) {
      calculatedAnimationSpeedScale = 1.2;
    }

    // 2. Safety Membrane clamping (Invariants enforcement)
    const clampedHitSlop = Math.max(this.minHitSlop, Math.min(this.maxHitSlop, calculatedHitSlop));
    const clampedAnimationSpeedScale = Math.max(
      this.minSpeedScale,
      Math.min(this.maxSpeedScale, calculatedAnimationSpeedScale)
    );

    // 3. Collision avoidance constraint:
    // If the hit-slop extends beyond physical spacing, components overlap, risking touch theft.
    // The system automatically quarantines the hitSlop to fit within 50% of the spacing.
    let activeHitSlop = clampedHitSlop;
    let collisionDetected = false;
    if (clampedHitSlop * 2 >= physicalSpacing) {
      collisionDetected = true;
      activeHitSlop = Math.max(this.minHitSlop, Math.floor(physicalSpacing / 2) - 1);
    }

    return {
      hitSlop: activeHitSlop,
      animationSpeedScale: clampedAnimationSpeedScale,
      collisionDetected,
      originalCalculatedHitSlop: calculatedHitSlop,
    };
  }
}

/**
 * CRDT State Manager simulator (simplification of useLWWMap behavior).
 */
export interface CRDTRegister<T> {
  value: T;
  timestamp: number;
  peerId: string;
}

export class CRDTMapSimulator<T> {
  private state = new Map<string, CRDTRegister<T>>();

  set(key: string, value: T, peerId: string, timestamp: number) {
    const current = this.state.get(key);
    if (
      !current ||
      timestamp > current.timestamp ||
      (timestamp === current.timestamp && peerId > current.peerId)
    ) {
      this.state.set(key, { value, timestamp, peerId });
    }
  }

  get(key: string): T | undefined {
    return this.state.get(key)?.value;
  }

  getRegister(key: string): CRDTRegister<T> | undefined {
    return this.state.get(key);
  }

  merge(externalState: Record<string, CRDTRegister<T>>) {
    for (const [key, externalRegister] of Object.entries(externalState)) {
      this.set(key, externalRegister.value, externalRegister.peerId, externalRegister.timestamp);
    }
  }

  getStateObject(): Record<string, CRDTRegister<T>> {
    const obj: Record<string, CRDTRegister<T>> = {};
    for (const [key, reg] of this.state.entries()) {
      obj[key] = reg;
    }
    return obj;
  }
}

// --- JEST UNIT TEST RUNNING THE SIMULATOR ---

describe('Autonomous Framework Resiliency Simulator', () => {
  describe('Task Scheduler Starvation & Resiliency Tests', () => {
    it('prevents starvation using age-based promotion and protects JS thread via task shedding', () => {
      const scheduler = new ResilientTaskScheduler(20);
      let currentTime = 1000;

      // Enqueue standard load: 1 Vital task, 1 Accessibility layout rebuild, 3 Prefetch tasks
      scheduler.enqueue({
        id: 't-vital-1',
        type: TaskType.VITAL_SYNC,
        priority: TaskPriority.HIGH,
        createdAt: currentTime,
        runTimeMs: 5,
        deadlineMs: 20,
      });
      scheduler.enqueue({
        id: 't-a11y-1',
        type: TaskType.A11Y_REBUILD,
        priority: TaskPriority.MEDIUM,
        createdAt: currentTime,
        runTimeMs: 8,
        deadlineMs: 50,
      });
      scheduler.enqueue({
        id: 't-prefetch-1',
        type: TaskType.PREDICTIVE_PREFETCH,
        priority: TaskPriority.LOW,
        createdAt: currentTime,
        runTimeMs: 12,
        deadlineMs: 200,
      });
      scheduler.enqueue({
        id: 't-prefetch-2',
        type: TaskType.PREDICTIVE_PREFETCH,
        priority: TaskPriority.LOW,
        createdAt: currentTime,
        runTimeMs: 12,
        deadlineMs: 200,
      });

      // Tick 1: Baseline condition (60 FPS, 15ms available budget). All tasks fit within budget.
      scheduler.tick(60, currentTime, 50);
      expect(scheduler.getMetrics().processedCount[TaskType.VITAL_SYNC]).toBe(1);
      expect(scheduler.getMetrics().processedCount[TaskType.A11Y_REBUILD]).toBe(1);
      expect(scheduler.getMetrics().processedCount[TaskType.PREDICTIVE_PREFETCH]).toBe(2);
      expect(scheduler.getQueue().length).toBe(0);

      // Scenario: System under massive congestion. FPS drops to 12.
      // Many new tasks are enqueued.
      currentTime += 50;
      for (let i = 0; i < 5; i++) {
        scheduler.enqueue({
          id: `t-heavy-prefetch-${i}`,
          type: TaskType.PREDICTIVE_PREFETCH,
          priority: TaskPriority.LOW,
          createdAt: currentTime,
          runTimeMs: 10,
          deadlineMs: 500,
        });
      }
      scheduler.enqueue({
        id: 't-vital-degraded',
        type: TaskType.VITAL_SYNC,
        priority: TaskPriority.HIGH,
        createdAt: currentTime,
        runTimeMs: 5,
        deadlineMs: 20,
      });

      // Tick 2: Under 12 FPS. The scheduler must trigger task shedding for PREDICTIVE_PREFETCH tasks.
      // High-priority VITAL_SYNC must be preserved.
      scheduler.tick(12, currentTime, 10); // Limited CPU budget of 10ms

      expect(scheduler.getMetrics().sheddedCount[TaskType.PREDICTIVE_PREFETCH]).toBe(5);
      expect(scheduler.getMetrics().processedCount[TaskType.VITAL_SYNC]).toBe(2); // processed vital-1 and vital-degraded
      expect(scheduler.getQueue().length).toBe(0); // All prefetch tasks shedded, vital task processed

      // Scenario: Starvation Promotion test
      // Add a medium priority Accessibility task. Congest the queue with vital tasks that consume the entire budget.
      currentTime += 50;
      scheduler.enqueue({
        id: 't-starve-a11y',
        type: TaskType.A11Y_REBUILD,
        priority: TaskPriority.MEDIUM,
        createdAt: currentTime,
        runTimeMs: 8,
        deadlineMs: 100,
      });

      // Enqueue vital sync tasks that take 10ms each
      for (let i = 0; i < 3; i++) {
        scheduler.enqueue({
          id: `t-vital-blocker-${i}`,
          type: TaskType.VITAL_SYNC,
          priority: TaskPriority.HIGH,
          createdAt: currentTime,
          runTimeMs: 10,
          deadlineMs: 50,
        });
      }

      // Tick 3: 60 FPS, but budget is only 15ms.
      // The high-priority blockers will run first. The A11Y task stays queued.
      scheduler.tick(60, currentTime, 15);
      expect(scheduler.getQueue().find((t) => t.id === 't-starve-a11y')?.priority).toBe(
        TaskPriority.MEDIUM
      );

      // Advance clock past maxAgeMs (150ms).
      currentTime += 200;
      // Tick 4: A11Y task should be promoted to HIGH because it has been waiting 200ms.
      // Even if more blocker tasks are queued, it will run because it has been elevated.
      scheduler.tick(60, currentTime, 30);

      expect(scheduler.getMetrics().starvedCount[TaskType.A11Y_REBUILD]).toBe(1);
      // Verify t-starve-a11y was processed (processed count increased to 2)
      expect(scheduler.getMetrics().processedCount[TaskType.A11Y_REBUILD]).toBe(2);
    });
  });

  describe('Layout Adaptation Boundaries & Overlap Prevention', () => {
    it('clamps hitSlop and prevents collision/touch-theft with adjacent elements', () => {
      const layout = new AdaptiveLayoutEngine();

      // Case 1: High trust, Optimal performance -> normal hitSlop (10px)
      const r1 = layout.computeAdaptation(60, 1.0, 100);
      expect(r1.hitSlop).toBe(10);
      expect(r1.animationSpeedScale).toBe(1.0);
      expect(r1.collisionDetected).toBe(false);

      // Case 2: Low Trust (Spoofing risk) -> hitSlop shrinks to enforce precision, but bounded by minHitSlop (6px)
      const r2 = layout.computeAdaptation(60, 0.0, 100);
      // trustModifier = 0.5 + 0 = 0.5
      // calculated = 10 * 0.5 * 1.0 = 5. Clamps to minHitSlop (6)
      expect(r2.hitSlop).toBe(6);
      expect(r2.collisionDetected).toBe(false);

      // Case 3: Extreme Performance Lag (FPS = 15) -> hitSlop expands to compensate, but clamped by maxHitSlop
      const r3 = layout.computeAdaptation(15, 1.0, 100);
      // trustModifier = 1.0, fpsModifier = 2.5 -> calculated = 25px
      expect(r3.hitSlop).toBe(25);
      expect(r3.collisionDetected).toBe(false);

      // Case 4: HitSlop Overlap Collision (Adjacent components separated by only 20px)
      // Expanded hitSlop = 25px. If hitSlop * 2 >= 20, collision is detected.
      // HitSlop should be throttled back to a safe value: floor(20 / 2) - 1 = 9px.
      const r4 = layout.computeAdaptation(15, 1.0, 20);
      expect(r4.collisionDetected).toBe(true);
      expect(r4.hitSlop).toBe(9);
      expect(r4.hitSlop).toBeGreaterThanOrEqual(layout.minHitSlop);
    });
  });

  describe('CRDT Convergence & Clock Drift Conflict Storms', () => {
    it('guarantees absolute convergence under clock drift and out-of-order networks', () => {
      const peerA = new CRDTMapSimulator<string>();
      const peerB = new CRDTMapSimulator<string>();

      // Establish base state
      peerA.set('profileName', 'Version A', 'peer-A', 1000);
      peerB.set('profileName', 'Version B', 'peer-B', 990); // Peer B has skewed local clock (older timestamp)

      // Sync base
      peerB.merge(peerA.getStateObject());
      expect(peerB.get('profileName')).toBe('Version A'); // Peer B accepted Version A (newer timestamp)

      // Simulate network partition splits:
      // Peer A edits name to "John" at t=1200
      peerA.set('profileName', 'John', 'peer-A', 1200);

      // Peer B edits name to "Jane" at t=1150 (clock drift causes it to look older, even though it occurred simultaneously)
      peerB.set('profileName', 'Jane', 'peer-B', 1150);

      // Reconnect partition and merge states
      // Peer B receives Peer A's state
      peerB.merge(peerA.getStateObject());
      // Peer A receives Peer B's state
      peerA.merge(peerB.getStateObject());

      // Assert convergence: both peers must resolve to the identical value
      expect(peerA.get('profileName')).toBe('John');
      expect(peerB.get('profileName')).toBe('John');
      expect(peerA.get('profileName')).toEqual(peerB.get('profileName'));

      // Scenario: Conflict storm with 100 updates arriving out-of-order
      const stormData: Record<string, CRDTRegister<string>> = {};

      // Peer C generated 100 rapid state changes with shuffled timestamps
      for (let i = 0; i < 100; i++) {
        const val = `Storm-Val-${i}`;
        // Shuffled timestamp to represent out-of-order delivery
        const timestamp = 2000 + (i % 2 === 0 ? i * 2 : -i * 2);
        stormData[`key-${i % 5}`] = {
          value: val,
          timestamp,
          peerId: 'peer-C',
        };
      }

      // Merge the storm into Peer A and Peer B
      peerA.merge(stormData);
      peerB.merge(stormData);

      // Assert absolute state equality across peers after the storm
      for (let i = 0; i < 5; i++) {
        const key = `key-${i}`;
        expect(peerA.get(key)).toBeDefined();
        expect(peerB.get(key)).toBeDefined();
        expect(peerA.get(key)).toEqual(peerB.get(key));
      }
    });
  });
});
