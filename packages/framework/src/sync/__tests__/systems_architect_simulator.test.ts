import crypto from 'crypto';
import { LWWRegister } from '../crdt/register';
import { LWWMap } from '../crdt/map';
import { FrameworkSyncEngine } from '../engine';
import { SyncJobBase, SyncStorageAdapter, OutboxDelta, OutboxReceipt } from '../types';

// ============================================================================
// Types & Core Interfaces
// ============================================================================

interface SystemArchitectJob extends SyncJobBase {
  payload: string;
}

// ============================================================================
// Scenario 1: Tombstone-based LWW Map to solve Split-Brain Resurrection
// ============================================================================

export interface TombstoneLWWMapState<V> {
  records: Record<string, { value: V | null; timestamp: number; peerId: string; deleted: boolean }>;
}

export class TombstoneLWWMap<V> {
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

// ============================================================================
// Scenario 2: Outbox FIFO Sequence Interruption & Autonomous Sorting
// ============================================================================

class SimulatorStorageAdapter implements SyncStorageAdapter<SystemArchitectJob> {
  public jobs: SystemArchitectJob[] = [];
  public blockedEntityIds = new Set<string>();

  async insertJob(
    job: Omit<SystemArchitectJob, 'id' | 'status' | 'attempts' | 'createdAt'>
  ): Promise<SystemArchitectJob> {
    const newJob: SystemArchitectJob = {
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
    status: SystemArchitectJob['status'],
    attempts?: number
  ): Promise<void> {
    const job = this.jobs.find((j) => j.id === id);
    if (job) {
      job.status = status;
      if (attempts !== undefined) {
        job.attempts = attempts;
      }
      console.log(`[Storage] updated status of ${id} to ${status}, attempts: ${attempts}`);
    }
  }

  async updateJob(
    id: string | number,
    updates: Partial<Omit<SystemArchitectJob, 'id' | 'status' | 'attempts' | 'createdAt'>>
  ): Promise<void> {
    const job = this.jobs.find((j) => j.id === id);
    if (job) {
      Object.assign(job, updates);
    }
  }

  async deleteJob(id: string | number): Promise<void> {
    console.log(`[Storage] deleted job ${id}`);
    this.jobs = this.jobs.filter((j) => j.id !== id);
  }

  async getReadyJobs(supportedJobTypes?: string[]): Promise<SystemArchitectJob[]> {
    const ready = this.jobs.filter(
      (j) => j.status === 'pending' && (!supportedJobTypes || supportedJobTypes.includes(j.jobType))
    );
    console.log(`[Storage] getReadyJobs returned count: ${ready.length}`);
    return ready;
  }

  async getBlockedEntityIds(supportedJobTypes?: string[]): Promise<Set<string>> {
    console.log(`[Storage] getBlockedEntityIds returned:`, Array.from(this.blockedEntityIds));
    return this.blockedEntityIds;
  }

  async resetJobsStatus(
    fromStatus: SystemArchitectJob['status'],
    toStatus: SystemArchitectJob['status'],
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

class SimulatorSyncEngine extends FrameworkSyncEngine<SystemArchitectJob> {
  public dispatched: SystemArchitectJob[] = [];
  public onDispatchHook: ((job: SystemArchitectJob) => Promise<void> | void) | null = null;
  public storageRef: SimulatorStorageAdapter;

  constructor(storage: SimulatorStorageAdapter, config?: any) {
    super(storage, config);
    this.storageRef = storage;
  }

  protected async dispatchJob(job: SystemArchitectJob): Promise<void> {
    console.log(`[Engine] dispatching job ${job.id}, payload: ${job.payload}`);
    this.dispatched.push(job);
    if (this.onDispatchHook) {
      await this.onDispatchHook(job);
    }
  }

  protected onJobFailure(job: SystemArchitectJob, error: any): void {
    console.log(`[Engine] onJobFailure for ${job.id}:`, error.message);
    if (job.entityId) {
      this.storageRef.blockedEntityIds.add(job.entityId);
    }
  }

  protected onJobQuarantined(job: SystemArchitectJob, error: any): void {
    console.log(`[Engine] onJobQuarantined for ${job.id}:`, error.message);
    if (job.entityId) {
      this.storageRef.blockedEntityIds.add(job.entityId);
    }
  }
}

// Causal Sorter for Job sequence recovery
export function selfHealingQueueSort(jobs: SystemArchitectJob[]): SystemArchitectJob[] {
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
// Scenario 3: P2P Cryptographic Receipt Chain Fork Reconciliation
// ============================================================================

export class CryptographicOutboxManager {
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

describe('Systems Architect Sync & Replication Validation Simulator', () => {
  test('Scenario 1: TombstoneLWWMap prevents deletion resurrection after network partition heals', () => {
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

  test('Scenario 2: Outbox out-of-order queueing causes failures, self-heals via causal sorting', async () => {
    const serverDB = new Set<string>();
    const storage = new SimulatorStorageAdapter();
    const engine = new SimulatorSyncEngine(storage, {
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

    console.log('--- ENQUEUEING JOBS ---');
    const jobUpdate = await storage.insertJob({
      jobType: 'mutate',
      payload: JSON.stringify({ action: 'update', value: 'DataV1' }),
      entityId: 'target_entity',
    });

    const jobCreate = await storage.insertJob({
      jobType: 'mutate',
      payload: JSON.stringify({ action: 'create' }),
      entityId: 'target_entity',
    });

    console.log('--- FIRST PUSH ---');
    await engine.pushChanges();

    // Sleep to allow any background async retries to execute and settle under the quarantine block
    await new Promise((resolve) => setTimeout(resolve, 50));

    console.log('--- SECOND PUSH ---');
    await engine.pushChanges();
    expect(serverDB.has('target_entity')).toBe(false);

    console.log('--- SELF-HEALING RUN ---');
    // 1. Sort the jobs causally
    const rawJobs = storage.jobs;
    const sorted = selfHealingQueueSort(rawJobs);
    storage.jobs = sorted;
    console.log(
      '[Test] Sorted storage jobs:',
      storage.jobs.map((j) => j.id)
    );

    // 2. Clear quarantine block
    storage.blockedEntityIds.delete('target_entity');

    // 3. Reset statuses to pending and attempts to 0
    for (const job of storage.jobs) {
      await storage.updateJobStatus(job.id, 'pending', 0);
    }

    console.log('--- RETRY PUSH ---');
    await engine.pushChanges();

    // Allow the retry push changes to complete
    await new Promise((resolve) => setTimeout(resolve, 50));

    const queueStatus = await storage.getQueueStatus();
    console.log('[Test] final queueStatus:', queueStatus);
    expect(queueStatus.total).toBe(0);
    expect(serverDB.has('target_entity')).toBe(true);
  });

  test('Scenario 3: Multi-peer partitions cause receipt chain forks, reconciled successfully', () => {
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
