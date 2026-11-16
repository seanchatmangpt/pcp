import crypto from 'crypto';
import { LWWRegister } from '../crdt/register';
import { LWWMap } from '../crdt/map';
import { FrameworkSyncEngine } from '../engine';
import { SyncJobBase, SyncStorageAdapter, OutboxDelta, OutboxReceipt } from '../types';

// ============================================================================
// Core Test Types & Mocks
// ============================================================================

interface TestJob extends SyncJobBase {
  payload: string;
}

class TestStorageAdapter implements SyncStorageAdapter<TestJob> {
  public jobs: TestJob[] = [];
  public blockedEntityIds = new Set<string>();

  async insertJob(
    job: Omit<TestJob, 'id' | 'status' | 'attempts' | 'createdAt'>
  ): Promise<TestJob> {
    const newJob: TestJob = {
      ...job,
      id: `job_${Math.random().toString(36).substring(2, 9)}`,
      status: 'pending',
      attempts: 0,
      createdAt: new Date(),
    };
    this.jobs.push(newJob);
    return newJob;
  }

  async updateJobStatus(
    id: string | number,
    status: TestJob['status'],
    attempts?: number
  ): Promise<void> {
    const job = this.jobs.find((j) => j.id === id);
    if (job) {
      job.status = status;
      if (attempts !== undefined) {
        job.attempts = attempts;
      }
    }
  }

  async updateJob(
    id: string | number,
    updates: Partial<Omit<TestJob, 'id' | 'status' | 'attempts' | 'createdAt'>>
  ): Promise<void> {
    const job = this.jobs.find((j) => j.id === id);
    if (job) {
      Object.assign(job, updates);
    }
  }

  async deleteJob(id: string | number): Promise<void> {
    this.jobs = this.jobs.filter((j) => j.id !== id);
  }

  async getReadyJobs(supportedJobTypes?: string[]): Promise<TestJob[]> {
    return this.jobs.filter(
      (j) => j.status === 'pending' && (!supportedJobTypes || supportedJobTypes.includes(j.jobType))
    );
  }

  async getBlockedEntityIds(supportedJobTypes?: string[]): Promise<Set<string>> {
    return this.blockedEntityIds;
  }

  async resetJobsStatus(
    fromStatus: TestJob['status'],
    toStatus: TestJob['status'],
    supportedJobTypes?: string[],
    resetAttempts?: boolean
  ): Promise<void> {
    this.jobs.forEach((job) => {
      if (
        job.status === fromStatus &&
        (!supportedJobTypes || supportedJobTypes.includes(job.jobType))
      ) {
        job.status = toStatus;
        if (resetAttempts) {
          job.attempts = 0;
        }
      }
    });
  }

  async getQueueStatus(supportedJobTypes?: string[]) {
    const filtered = this.jobs.filter(
      (j) => !supportedJobTypes || supportedJobTypes.includes(j.jobType)
    );
    return {
      total: filtered.length,
      pending: filtered.filter((j) => j.status === 'pending').length,
      processing: filtered.filter((j) => j.status === 'processing').length,
      failed: filtered.filter((j) => j.status === 'failed').length,
      quarantined: filtered.filter((j) => j.status === 'quarantined').length,
      jobs: filtered,
    };
  }
}

class TestSyncEngine extends FrameworkSyncEngine<TestJob> {
  public dispatched: TestJob[] = [];
  public successHooks: TestJob[] = [];
  public failureHooks: { job: TestJob; error: any }[] = [];
  public quarantineHooks: { job: TestJob; error: any }[] = [];
  public onDispatchHook: ((job: TestJob) => Promise<void> | void) | null = null;

  protected async dispatchJob(job: TestJob): Promise<void> {
    this.dispatched.push(job);
    if (this.onDispatchHook) {
      await this.onDispatchHook(job);
    }
  }

  protected async onJobSuccess(job: TestJob): Promise<void> {
    this.successHooks.push(job);
  }

  protected async onJobFailure(job: TestJob, error: any): Promise<void> {
    this.failureHooks.push({ job, error });
    if (job.entityId) {
      (this.storage as TestStorageAdapter).blockedEntityIds.add(job.entityId);
    }
  }

  protected async onJobQuarantined(job: TestJob, error: any): Promise<void> {
    this.quarantineHooks.push({ job, error });
    if (job.entityId) {
      (this.storage as TestStorageAdapter).blockedEntityIds.add(job.entityId);
    }
  }
}

// Causal Sorter for Job sequence recovery
function selfHealingQueueSort(jobs: TestJob[]): TestJob[] {
  const getActionPriority = (payloadStr: string): number => {
    try {
      const payload = JSON.parse(payloadStr);
      if (payload.action === 'create') return 1;
      if (payload.action === 'update') return 2;
      if (payload.action === 'delete') return 3;
    } catch {}
    return 4;
  };

  return [...jobs].sort((a, b) => {
    if (a.entityId !== b.entityId) {
      return (a.entityId || '').localeCompare(b.entityId || '');
    }
    const priorityA = getActionPriority(a.payload);
    const priorityB = getActionPriority(b.payload);
    if (priorityA !== priorityB) {
      return priorityA - priorityB;
    }
    return a.createdAt.getTime() - b.createdAt.getTime();
  });
}

// ============================================================================
// Scenario Helpers: Tombstone Map & Cryptographic Outbox
// ============================================================================

interface TombstoneLWWMapState<V> {
  records: Record<string, { value: V | null; timestamp: number; peerId: string; deleted: boolean }>;
}

class TombstoneLWWMap<V> {
  private records: Map<
    string,
    { value: V | null; timestamp: number; peerId: string; deleted: boolean }
  > = new Map();
  private peerId: string;

  constructor(peerId: string, initialState?: TombstoneLWWMapState<V>) {
    this.peerId = peerId;
    if (initialState && initialState.records) {
      for (const [key, record] of Object.entries(initialState.records)) {
        this.records.set(key, { ...record });
      }
    }
  }

  public get(key: string): V | null {
    const record = this.records.get(key);
    if (!record || record.deleted) {
      return null;
    }
    return record.value;
  }

  public set(key: string, value: V, timestamp: number = Date.now()): void {
    const existing = this.records.get(key);
    const finalTimestamp = existing ? Math.max(timestamp, existing.timestamp + 1) : timestamp;
    this.records.set(key, {
      value,
      timestamp: finalTimestamp,
      peerId: this.peerId,
      deleted: false,
    });
  }

  public delete(key: string, timestamp: number = Date.now()): void {
    const existing = this.records.get(key);
    const finalTimestamp = existing ? Math.max(timestamp, existing.timestamp + 1) : timestamp;
    this.records.set(key, {
      value: null,
      timestamp: finalTimestamp,
      peerId: this.peerId,
      deleted: true,
    });
  }

  public merge(otherState: TombstoneLWWMapState<V>): void {
    for (const [key, otherRecord] of Object.entries(otherState.records)) {
      const localRecord = this.records.get(key);
      if (!localRecord) {
        this.records.set(key, { ...otherRecord });
      } else {
        if (otherRecord.timestamp > localRecord.timestamp) {
          this.records.set(key, { ...otherRecord });
        } else if (otherRecord.timestamp === localRecord.timestamp) {
          if (otherRecord.peerId > localRecord.peerId) {
            this.records.set(key, { ...otherRecord });
          }
        }
      }
    }
  }

  public toJSON(): TombstoneLWWMapState<V> {
    const records: Record<
      string,
      { value: V | null; timestamp: number; peerId: string; deleted: boolean }
    > = {};
    for (const [key, val] of this.records.entries()) {
      records[key] = { ...val };
    }
    return { records };
  }
}

class CryptographicOutboxManager {
  private lastReceiptHash: string = 'genesis_hash';
  private receipts: OutboxReceipt[] = [];

  constructor(initialReceipts?: OutboxReceipt[], lastReceiptHash?: string) {
    if (initialReceipts) {
      this.receipts = [...initialReceipts];
    }
    if (lastReceiptHash) {
      this.lastReceiptHash = lastReceiptHash;
    }
  }

  public getReceipts(): OutboxReceipt[] {
    return [...this.receipts];
  }

  public getLastReceiptHash(): string {
    return this.lastReceiptHash;
  }

  public enqueueDelta(delta: OutboxDelta): OutboxReceipt {
    const inputHash = crypto.createHash('sha256').update(delta.subject).digest('hex');
    const outputHash = crypto.createHash('sha256').update(delta.object).digest('hex');
    const deltaHash = crypto
      .createHash('sha256')
      .update(delta.predicate + delta.timestamp.toString())
      .digest('hex');

    const receiptHash = crypto
      .createHash('sha256')
      .update(this.lastReceiptHash + inputHash + outputHash + deltaHash)
      .digest('hex');

    const receipt: OutboxReceipt = {
      inputHash,
      outputHash,
      deltaHash,
      previousReceiptHash: this.lastReceiptHash,
      receiptHash,
    };

    this.receipts.push(receipt);
    this.lastReceiptHash = receiptHash;
    return receipt;
  }

  public static reconcileChains(
    chainA: { receipts: OutboxReceipt[]; deltas: OutboxDelta[] },
    chainB: { receipts: OutboxReceipt[]; deltas: OutboxDelta[] }
  ): { reconciledReceipts: OutboxReceipt[]; finalHash: string } {
    const allDeltasMap = new Map<string, OutboxDelta>();
    const getDeltaKey = (d: OutboxDelta) => `${d.subject}:${d.predicate}:${d.timestamp}`;

    for (const d of chainA.deltas) {
      allDeltasMap.set(getDeltaKey(d), d);
    }
    for (const d of chainB.deltas) {
      allDeltasMap.set(getDeltaKey(d), d);
    }

    const sortedDeltas = Array.from(allDeltasMap.values()).sort((a, b) => {
      if (a.timestamp !== b.timestamp) {
        return a.timestamp - b.timestamp;
      }
      return a.subject.localeCompare(b.subject);
    });

    let currentHash = 'genesis_hash';
    const reconciledReceipts: OutboxReceipt[] = [];

    for (const delta of sortedDeltas) {
      const inputHash = crypto.createHash('sha256').update(delta.subject).digest('hex');
      const outputHash = crypto.createHash('sha256').update(delta.object).digest('hex');
      const deltaHash = crypto
        .createHash('sha256')
        .update(delta.predicate + delta.timestamp.toString())
        .digest('hex');

      const receiptHash = crypto
        .createHash('sha256')
        .update(currentHash + inputHash + outputHash + deltaHash)
        .digest('hex');

      reconciledReceipts.push({
        inputHash,
        outputHash,
        deltaHash,
        previousReceiptHash: currentHash,
        receiptHash,
      });

      currentHash = receiptHash;
    }

    return {
      reconciledReceipts,
      finalHash: currentHash,
    };
  }
}

// ============================================================================
// Test Suite Execution
// ============================================================================

describe('Sync & Outbox Integration & Resiliency Suite', () => {
  let storage: TestStorageAdapter;

  beforeEach(() => {
    storage = new TestStorageAdapter();
  });

  describe('Offline-First Conflict Resolution', () => {
    it('should retry job with modified payload when conflict resolver returns retry', async () => {
      let isFirstDispatch = true;
      const engine = new TestSyncEngine(storage, {
        retryStrategy: { maxAttempts: 3, baseDelayMs: 0, backoffType: 'fixed' },
        onConflict: async () => {
          isFirstDispatch = false; // Allow second dispatch to succeed
          return {
            action: 'retry',
            modifiedJob: { payload: 'resolved_payload' },
          };
        },
      });

      engine.onDispatchHook = async () => {
        if (isFirstDispatch) {
          throw new Error('Conflict');
        }
      };

      await engine.queueJob({
        jobType: 'test',
        payload: 'initial_payload',
        entityId: 'e1',
      });

      // Wait for async job execution in engine
      await new Promise((r) => setTimeout(r, 20));

      const status = await storage.getQueueStatus();
      expect(status.total).toBe(0); // Succeeded and deleted
      expect(engine.successHooks.length).toBe(1);
      expect(engine.dispatched[1].payload).toBe('resolved_payload');
    });

    it('should discard job when conflict resolver returns discard', async () => {
      const engine = new TestSyncEngine(storage, {
        retryStrategy: { maxAttempts: 3, baseDelayMs: 0, backoffType: 'fixed' },
        onConflict: async () => ({ action: 'discard' }),
      });

      engine.onDispatchHook = async () => {
        throw new Error('Conflict');
      };

      await engine.queueJob({
        jobType: 'test',
        payload: 'test',
        entityId: 'e1',
      });

      await new Promise((r) => setTimeout(r, 20));

      const status = await storage.getQueueStatus();
      expect(status.total).toBe(0); // Discarded and deleted
    });

    it('should quarantine job when conflict resolver returns quarantine', async () => {
      const engine = new TestSyncEngine(storage, {
        retryStrategy: { maxAttempts: 3, baseDelayMs: 0, backoffType: 'fixed' },
        onConflict: async () => ({ action: 'quarantine' }),
      });

      engine.onDispatchHook = async () => {
        throw new Error('Conflict');
      };

      await engine.queueJob({
        jobType: 'test',
        payload: 'test',
        entityId: 'e1',
      });

      await new Promise((r) => setTimeout(r, 20));

      const status = await storage.getQueueStatus();
      expect(status.quarantined).toBe(1);
      expect(engine.quarantineHooks.length).toBe(1);
    });
  });

  describe('CRDT Clock Drift & Partition Resiliency', () => {
    it('should heal clock drift hijacking via supervisor repair', () => {
      const peerCorrect = 'peer-correct';
      const peerDrifted = 'peer-drifted';

      const registerCorrect = new LWWRegister<string>(peerCorrect, 'InitialState', 1000);
      const registerDrifted = new LWWRegister<string>(peerDrifted, 'InitialState', 1000);

      // peer-drifted has a +10,000ms clock drift (future time)
      const futureTime = Date.now() + 10000;
      registerDrifted.set('DriftedValue', futureTime);

      // peer-correct makes a modification later in actual real time
      const actualCurrentTime = Date.now();
      registerCorrect.set('CorrectValue', actualCurrentTime);

      // Sync
      registerCorrect.merge(registerDrifted.state);
      registerDrifted.merge(registerCorrect.state);

      // Verify that the drifted value hijacked state
      expect(registerCorrect.value).toBe('DriftedValue');

      // Supervisor state surgery to heal clock drift
      const NTP_TIME = Date.now();
      const DRIFT_THRESHOLD_MS = 5000;

      const superviseAndRepairLWW = (register: LWWRegister<string>) => {
        const state = register.state;
        const timeDifference = state.timestamp - NTP_TIME;
        if (timeDifference > DRIFT_THRESHOLD_MS) {
          (register as any)._state = {
            value: 'CorrectValue',
            timestamp: NTP_TIME,
            peerId: 'supervision-layer',
          };
        }
      };

      superviseAndRepairLWW(registerCorrect);
      superviseAndRepairLWW(registerDrifted);

      expect(registerCorrect.value).toBe('CorrectValue');
      expect(registerDrifted.value).toBe('CorrectValue');
    });

    it('should reconcile map deletes during network partitions using tombstones', () => {
      const initialMapState = {
        user_1: { value: 'Alice', timestamp: 100, peerId: 'seed' },
      };

      // Simulating simple map deletion drift where tombstones are cleared
      const mapA = new LWWMap<string>('peer-a', initialMapState);
      const mapB = new LWWMap<string>('peer-b', initialMapState);
      const mapC = new LWWMap<string>('peer-c', initialMapState);

      const disableTombstones = (map: any) => {
        map.delete = function (key: string) {
          this._registers.delete(key);
        };
        const originalToJSON = map.toJSON;
        map.toJSON = function () {
          const state = originalToJSON.call(this);
          for (const [k, v] of Object.entries(state)) {
            if ((v as any).deleted) {
              delete state[k];
            }
          }
          return state;
        };
        map.get = function (key: string) {
          return this._registers.get(key)?.value;
        };
      };

      disableTombstones(mapA);
      disableTombstones(mapB);
      disableTombstones(mapC);

      // C deletes 'user_1' at t = 150 (without tombstones, this deletion is lost on merge)
      mapC.delete('user_1');
      (mapC as any)._tombstones?.clear();

      // A modifies 'user_1' at t = 120
      const regA = (mapA as any)._registers.get('user_1');
      regA.set('Alice-Updated', 120);

      // Sync A & B
      mapB.merge(mapA.toJSON());

      // Network heals: C merges with A
      mapA.merge(mapC.toJSON());
      mapC.merge(mapA.toJSON());

      // Resurrection occurs because tombstones were disabled
      expect(mapC.get('user_1')).toBe('Alice-Updated');

      // Reconcile using a supervisor tombstone log
      const tombstones = new Map<string, { deletedAt: number }>();
      tombstones.set('user_1', { deletedAt: 150 });

      const reconcileMapWithTombstones = <V>(
        map: LWWMap<V>,
        tombstonesLog: Map<string, { deletedAt: number }>
      ) => {
        const currentState = map.toJSON();
        for (const key of Object.keys(currentState)) {
          const tombstone = tombstonesLog.get(key);
          if (tombstone) {
            const entry = currentState[key];
            if (entry && entry.timestamp <= tombstone.deletedAt) {
              map.delete(key);
            }
          }
        }
      };

      reconcileMapWithTombstones(mapA, tombstones);
      reconcileMapWithTombstones(mapC, tombstones);

      expect(mapA.get('user_1')).toBeUndefined();
      expect(mapC.get('user_1')).toBeUndefined();
    });

    it('Scenario 1: TombstoneLWWMap prevents deletion resurrection after network partition heals', () => {
      const initialMapState: TombstoneLWWMapState<string> = {
        records: {
          entity_1: { value: 'GenesisValue', timestamp: 100, peerId: 'seed', deleted: false },
        },
      };

      const mapNodeA = new TombstoneLWWMap<string>('peer-a', initialMapState);
      const mapNodeB = new TombstoneLWWMap<string>('peer-b', initialMapState);

      mapNodeA.set('entity_1', 'UpdatedByNodeA', 150);
      mapNodeB.delete('entity_1', 200);

      expect(mapNodeA.get('entity_1')).toBe('UpdatedByNodeA');
      expect(mapNodeB.get('entity_1')).toBeNull();

      mapNodeA.merge(mapNodeB.toJSON());
      mapNodeB.merge(mapNodeA.toJSON());

      expect(mapNodeA.get('entity_1')).toBeNull();
      expect(mapNodeB.get('entity_1')).toBeNull();

      mapNodeA.set('entity_1', 'NewerUpdate', 250);
      mapNodeB.merge(mapNodeA.toJSON());
      expect(mapNodeB.get('entity_1')).toBe('NewerUpdate');
    });
  });

  describe('Outbox Causality & Ordering Resiliency', () => {
    it('Scenario 2: Outbox out-of-order queueing causes failures, self-heals via causal sorting', async () => {
      const serverDB = new Set<string>();
      const engine = new TestSyncEngine(storage, {
        retryStrategy: { maxAttempts: 3, baseDelayMs: 0, backoffType: 'fixed' },
      });

      engine.onDispatchHook = async (job) => {
        const payload = JSON.parse(job.payload);
        if (payload.action === 'create') {
          serverDB.add(job.entityId!);
        } else if (payload.action === 'update') {
          if (!serverDB.has(job.entityId!)) {
            throw new Error(`CausalConflict: Entity ${job.entityId} does not exist yet.`);
          }
        }
      };

      // 1. Queue Update first (causes conflict since Entity doesn't exist yet)
      const jobUpdate = await storage.insertJob({
        jobType: 'mutate',
        payload: JSON.stringify({ action: 'update', value: 'DataV1' }),
        entityId: 'target_entity',
      });

      // 2. Queue Create second (out of order)
      const jobCreate = await storage.insertJob({
        jobType: 'mutate',
        payload: JSON.stringify({ action: 'create' }),
        entityId: 'target_entity',
      });

      // First run pushes out of order; update fails, blocks entityId in storage/engine
      await engine.pushChanges();
      await new Promise((resolve) => setTimeout(resolve, 15));

      // Create won't run because target_entity is blocked/quarantined
      await engine.pushChanges();
      expect(serverDB.has('target_entity')).toBe(false);

      // Self-Healing Routine:
      // A. Sort the jobs causally
      storage.jobs = selfHealingQueueSort(storage.jobs);

      // B. Clear quarantine block
      storage.blockedEntityIds.delete('target_entity');

      // C. Reset statuses to pending and attempts to 0
      for (const job of storage.jobs) {
        await storage.updateJobStatus(job.id, 'pending', 0);
      }

      // Retry push changes with corrected queue sequence
      await engine.pushChanges();
      await new Promise((resolve) => setTimeout(resolve, 15));

      const queueStatus = await storage.getQueueStatus();
      expect(queueStatus.total).toBe(0);
      expect(serverDB.has('target_entity')).toBe(true);
    });
  });

  describe('Cryptographic Receipt Chain Fork Reconciliation', () => {
    it('Scenario 3: Multi-peer partitions cause receipt chain forks, reconciled successfully', () => {
      const deltaSeed: OutboxDelta = {
        subject: 'item_1',
        predicate: 'init',
        object: 'val_0',
        timestamp: 100,
      };

      const managerA = new CryptographicOutboxManager();
      const rSeed = managerA.enqueueDelta(deltaSeed);

      const managerB = new CryptographicOutboxManager([rSeed], rSeed.receiptHash);

      const deltaA: OutboxDelta = {
        subject: 'item_1',
        predicate: 'update',
        object: 'val_A',
        timestamp: 150,
      };
      const deltaB: OutboxDelta = {
        subject: 'item_1',
        predicate: 'update',
        object: 'val_B',
        timestamp: 160,
      };

      managerA.enqueueDelta(deltaA);
      managerB.enqueueDelta(deltaB);

      expect(managerA.getLastReceiptHash()).not.toBe(managerB.getLastReceiptHash());

      const chainAData = {
        receipts: managerA.getReceipts(),
        deltas: [deltaSeed, deltaA],
      };

      const chainBData = {
        receipts: managerB.getReceipts(),
        deltas: [deltaSeed, deltaB],
      };

      const reconciliation = CryptographicOutboxManager.reconcileChains(chainAData, chainBData);

      expect(reconciliation.reconciledReceipts.length).toBe(3);

      const recReceipts = reconciliation.reconciledReceipts;
      expect(recReceipts[0].previousReceiptHash).toBe('genesis_hash');
      expect(recReceipts[1].previousReceiptHash).toBe(recReceipts[0].receiptHash);
      expect(recReceipts[2].previousReceiptHash).toBe(recReceipts[1].receiptHash);
      expect(reconciliation.finalHash).toBe(recReceipts[2].receiptHash);
    });
  });
});
