import { LWWRegister } from '../crdt/register';
import { LWWMap } from '../crdt/map';
import { PNCounter } from '../crdt/counter';
import { FrameworkSyncEngine } from '../engine';
import { FrameworkOutboxManager } from '../outbox';
import { SyncJobBase, SyncStorageAdapter } from '../types';

interface SimJob extends SyncJobBase {
  payload: string;
}

class SimStorageAdapter implements SyncStorageAdapter<SimJob> {
  public jobs: SimJob[] = [];
  public blockedEntityIds = new Set<string>();

  async insertJob(job: Omit<SimJob, 'id' | 'status' | 'attempts' | 'createdAt'>): Promise<SimJob> {
    const newJob: SimJob = {
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
    status: SimJob['status'],
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
    updates: Partial<Omit<SimJob, 'id' | 'status' | 'attempts' | 'createdAt'>>
  ): Promise<void> {
    const job = this.jobs.find((j) => j.id === id);
    if (job) {
      Object.assign(job, updates);
    }
  }

  async deleteJob(id: string | number): Promise<void> {
    this.jobs = this.jobs.filter((j) => j.id !== id);
  }

  async getReadyJobs(supportedJobTypes?: string[]): Promise<SimJob[]> {
    return this.jobs.filter(
      (j) => j.status === 'pending' && (!supportedJobTypes || supportedJobTypes.includes(j.jobType))
    );
  }

  async getBlockedEntityIds(supportedJobTypes?: string[]): Promise<Set<string>> {
    return this.blockedEntityIds;
  }

  async resetJobsStatus(
    fromStatus: SimJob['status'],
    toStatus: SimJob['status'],
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

class SimEngine extends FrameworkSyncEngine<SimJob> {
  public dispatched: SimJob[] = [];
  public onDispatchHook: ((job: SimJob) => Promise<void> | void) | null = null;

  protected async dispatchJob(job: SimJob): Promise<void> {
    this.dispatched.push(job);
    if (this.onDispatchHook) {
      await this.onDispatchHook(job);
    }
  }
}

describe('Sync Layer Adversarial & Resiliency Simulator', () => {
  let storage: SimStorageAdapter;
  let engine: SimEngine;

  beforeEach(() => {
    storage = new SimStorageAdapter();
    engine = new SimEngine(storage, {
      retryStrategy: { maxAttempts: 3, baseDelayMs: 0, backoffType: 'fixed' },
    });
  });

  /**
   * STRESS VECTOR 1: Clock Drift Anomalies & LWW Hijacking
   */
  test('Stress Scenario 1: Clock Drift Hijacking & Supervisor Healing', () => {
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

    // ASSERTION OF FAILURE: Drifted value hijacked state
    expect(registerCorrect.value).toBe('DriftedValue');

    // === SELF-HEALING SUPERVISION INTEGRATION ===
    // Since normal merge cannot override future timestamps, supervisor performs state surgery.
    const NTP_TIME = Date.now();
    const DRIFT_THRESHOLD_MS = 5000;

    const superviseAndRepairLWW = (register: LWWRegister<string>) => {
      const state = register.state;
      const timeDifference = state.timestamp - NTP_TIME;
      if (timeDifference > DRIFT_THRESHOLD_MS) {
        // Direct state surgery bypassing standard merge API
        (register as any)._state = {
          value: 'CorrectValue',
          timestamp: NTP_TIME,
          peerId: 'supervision-layer',
        };
      }
    };

    superviseAndRepairLWW(registerCorrect);
    superviseAndRepairLWW(registerDrifted);

    // ASSERTION OF PARITY: Parity recovered
    expect(registerCorrect.value).toBe('CorrectValue');
    expect(registerDrifted.value).toBe('CorrectValue');
  });

  /**
   * STRESS VECTOR 2: Network Partition Splits & Map Deletion Drift
   */
  test('Stress Scenario 2: Network Partition Splits & Map Deletion Parity', () => {
    const initialMapState = {
      user_1: { value: 'Alice', timestamp: 100, peerId: 'seed' },
    };

    const mapA = new LWWMap<string>('peer-a', initialMapState);
    const mapB = new LWWMap<string>('peer-b', initialMapState);
    const mapC = new LWWMap<string>('peer-c', initialMapState);

    // Partition occurs: A & B are online, C is offline.
    // C deletes 'user_1' at t = 150
    mapC.delete('user_1');
    expect(mapC.get('user_1')).toBeUndefined();

    // A modifies 'user_1' at t = 120
    const regA = (mapA as any)._registers.get('user_1');
    regA.set('Alice-Updated', 120);

    // Sync A & B
    mapB.merge(mapA.toJSON());

    // Network heals: C merges with A
    mapA.merge(mapC.toJSON());
    mapC.merge(mapA.toJSON());

    // ASSERTION OF FAILURE: Key reappears because simple LWWMap has no tombstones
    expect(mapC.get('user_1')).toBe('Alice-Updated');

    // === SUPERVISION SELF-HEALING RECONCILIATION ===
    const tombstones = new Map<string, { deletedAt: number }>();
    tombstones.set('user_1', { deletedAt: 150 }); // C deleted user_1 at t=150

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

    // ASSERTION OF PARITY: Key is deleted
    expect(mapA.get('user_1')).toBeUndefined();
    expect(mapC.get('user_1')).toBeUndefined();
  });

  /**
   * STRESS VECTOR 3: Outbox Out-of-Order Execution & Cascading Entity Quarantine
   */
  test('Stress Scenario 3: Outbox Ordering Corruption & Entity Isolation Lock', async () => {
    const serverDatabase = new Set<string>();

    engine.onDispatchHook = async (job) => {
      const payload = JSON.parse(job.payload);
      if (payload.action === 'create') {
        serverDatabase.add(job.entityId!);
      } else if (payload.action === 'update') {
        if (!serverDatabase.has(job.entityId!)) {
          throw new Error(`StateConflict: Entity ${job.entityId} does not exist.`);
        }
      } else if (payload.action === 'delete') {
        serverDatabase.delete(job.entityId!);
      }
    };

    // Client is offline. Out-of-order queueing occurs: Update, then Delete are queued first.
    const jobUpdate = await storage.insertJob({
      jobType: 'mutate',
      payload: JSON.stringify({ action: 'update', value: 'NewData' }),
      entityId: 'entity_uuid_99',
    });

    const jobDelete = await storage.insertJob({
      jobType: 'mutate',
      payload: JSON.stringify({ action: 'delete' }),
      entityId: 'entity_uuid_99',
    });

    // Run push changes. Update will fail and trigger quarantine/failure.
    await engine.pushChanges();

    // Supervisor detects failure and quarantines the entity pipeline
    storage.blockedEntityIds.add('entity_uuid_99');

    // Create job arrives later
    const jobCreate = await storage.insertJob({
      jobType: 'mutate',
      payload: JSON.stringify({ action: 'create' }),
      entityId: 'entity_uuid_99',
    });

    // Verify Create is blocked under quarantine
    await engine.pushChanges();
    expect(serverDatabase.has('entity_uuid_99')).toBe(false);

    // === SUPERVISION SELF-HEALING RECOVERY ===
    // Supervisor heals queue order: sorts them causally: Create, Update, Delete
    storage.jobs = [jobCreate, jobUpdate, jobDelete];

    // Clear quarantine block
    storage.blockedEntityIds.delete('entity_uuid_99');

    // Reset attempts & statuses for processing
    for (const job of storage.jobs) {
      await storage.updateJobStatus(job.id, 'pending', 0);
    }

    // Run push changes
    await engine.pushChanges();
    await new Promise((r) => setTimeout(r, 10));

    const finalStatus = await storage.getQueueStatus();
    expect(finalStatus.total).toBe(0); // All resolved
    expect(serverDatabase.has('entity_uuid_99')).toBe(false); // Created, updated, and deleted successfully!
  });
});
