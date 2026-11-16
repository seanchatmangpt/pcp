import { FrameworkSyncEngine } from '../engine';
import { SyncJobBase, SyncStorageAdapter, SyncEngineConfig } from '../types';

interface TestJob extends SyncJobBase {
  payload: string;
}

class MockStorageAdapter implements SyncStorageAdapter<TestJob> {
  private jobs: TestJob[] = [];
  private blockedEntityIds = new Set<string>();

  async insertJob(
    job: Omit<TestJob, 'id' | 'status' | 'attempts' | 'createdAt'>
  ): Promise<TestJob> {
    const newJob: TestJob = {
      ...job,
      id: Math.random().toString(),
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

class TestEngine extends FrameworkSyncEngine<TestJob> {
  public dispatched: TestJob[] = [];
  public batched: TestJob[][] = [];
  public successHooks: TestJob[] = [];
  public failureHooks: { job: TestJob; error: any }[] = [];
  public quarantineHooks: { job: TestJob; error: any }[] = [];

  public throwOnDispatch: Error | null = null;
  public throwOnBatch: Error | null = null;
  public throwOnSuccessHook: Error | null = null;

  protected async dispatchJob(job: TestJob): Promise<void> {
    if (this.throwOnDispatch) {
      throw this.throwOnDispatch;
    }
    this.dispatched.push(job);
  }

  protected async dispatchBatch(jobs: TestJob[]): Promise<void> {
    if (this.throwOnBatch) {
      throw this.throwOnBatch;
    }
    this.batched.push(jobs);
  }

  protected async onJobSuccess(job: TestJob): Promise<void> {
    if (this.throwOnSuccessHook) {
      throw this.throwOnSuccessHook;
    }
    this.successHooks.push(job);
  }

  protected async onJobFailure(job: TestJob, error: any): Promise<void> {
    this.failureHooks.push({ job, error });
  }

  protected async onJobQuarantined(job: TestJob, error: any): Promise<void> {
    this.quarantineHooks.push({ job, error });
  }

  // Expose protected methods for testing
  public testCalculateRetryDelay(attempts: number) {
    return this.calculateRetryDelay(attempts);
  }

  public async testDelay(ms: number) {
    return this.delay(ms);
  }
}

describe('FrameworkSyncEngine DX Innovations', () => {
  let storage: MockStorageAdapter;
  let engine: TestEngine;

  beforeEach(() => {
    storage = new MockStorageAdapter();
  });

  describe('Offline-First Conflict Resolution', () => {
    it('should retry job with modified payload when conflict resolver returns retry', async () => {
      engine = new TestEngine(storage, {
        onConflict: async ({ job }) => {
          engine.throwOnDispatch = null; // Let it succeed on retry
          return {
            action: 'retry',
            modifiedJob: { payload: 'resolved_payload' },
          };
        },
      });
      engine.throwOnDispatch = new Error('Conflict');

      const job = await engine.queueJob({
        jobType: 'test',
        payload: 'initial_payload',
        entityId: 'e1',
      });

      // Wait a moment for pushChanges to finish the retry logic
      await new Promise((r) => setTimeout(r, 20));

      const status = await storage.getQueueStatus();
      expect(status.total).toBe(0); // It succeeded and got deleted
      expect(engine.successHooks.length).toBe(1); // Success hook called
      // Check that the modified payload was used in dispatch
      expect(engine.dispatched[0].payload).toBe('resolved_payload');
    });

    it('should discard job when conflict resolver returns discard', async () => {
      engine = new TestEngine(storage, {
        onConflict: async () => ({ action: 'discard' }),
      });
      engine.throwOnDispatch = new Error('Conflict');

      await engine.queueJob({
        jobType: 'test',
        payload: 'test',
        entityId: 'e1',
      });

      await new Promise((r) => setTimeout(r, 10));

      const status = await storage.getQueueStatus();
      expect(status.total).toBe(0); // Job deleted
    });

    it('should quarantine job when conflict resolver returns quarantine', async () => {
      engine = new TestEngine(storage, {
        onConflict: async () => ({ action: 'quarantine' }),
      });
      engine.throwOnDispatch = new Error('Conflict');

      await engine.queueJob({
        jobType: 'test',
        payload: 'test',
        entityId: 'e1',
      });

      await new Promise((r) => setTimeout(r, 10));

      const status = await storage.getQueueStatus();
      expect(status.quarantined).toBe(1);
      expect(engine.quarantineHooks.length).toBe(1);
    });
  });
});
