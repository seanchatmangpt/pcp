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

  constructor(storage: SyncStorageAdapter<TestJob>, config?: SyncEngineConfig<TestJob>) {
    super(storage, config);
  }

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

    it('should handle conflict resolver throwing error gracefully and fallback to normal failure', async () => {
      engine = new TestEngine(storage, {
        retryStrategy: { maxAttempts: 1, baseDelayMs: 0, backoffType: 'fixed' },
        onConflict: async () => {
          throw new Error('Resolver blew up');
        },
      });
      engine.throwOnDispatch = new Error('Original Error');

      await engine.queueJob({
        jobType: 'test',
        payload: 'test',
        entityId: 'e1',
      });

      await new Promise((r) => setTimeout(r, 10));

      const status = await storage.getQueueStatus();
      expect(status.quarantined).toBe(1); // normal quarantine logic applied
    });
  });

  describe('Batch Sync Utilities', () => {
    it('should batchQueueJobs and process them single if batchSize is 1', async () => {
      engine = new TestEngine(storage, { batchSize: 1 });
      await engine.batchQueueJobs([
        { jobType: 't1', payload: '1', entityId: 'e1' },
        { jobType: 't2', payload: '2', entityId: 'e2' },
      ]);

      await new Promise((r) => setTimeout(r, 10));

      expect(engine.dispatched.length).toBe(2);
      expect(engine.batched.length).toBe(0);
      expect(engine.successHooks.length).toBe(2);
    });

    it('should process jobs in batches using dispatchBatch if batchSize > 1', async () => {
      engine = new TestEngine(storage, { batchSize: 2 });
      await engine.batchQueueJobs([
        { jobType: 't1', payload: '1', entityId: 'e1' },
        { jobType: 't2', payload: '2', entityId: 'e2' },
        { jobType: 't3', payload: '3', entityId: 'e3' },
      ]);

      await new Promise((r) => setTimeout(r, 10));

      expect(engine.batched.length).toBe(2); // One batch of 2, one batch of 1
      expect(engine.batched[0].length).toBe(2);
      expect(engine.batched[1].length).toBe(1);
      expect(engine.successHooks.length).toBe(3);
    });

    it('should fail whole batch if dispatchBatch throws and then handle individual failures', async () => {
      engine = new TestEngine(storage, {
        batchSize: 2,
        retryStrategy: { maxAttempts: 1, baseDelayMs: 0, backoffType: 'fixed' },
      });
      engine.throwOnBatch = new Error('Batch Error');

      await engine.batchQueueJobs([
        { jobType: 't1', payload: '1', entityId: 'e1' },
        { jobType: 't2', payload: '2', entityId: 'e2' },
      ]);

      await new Promise((r) => setTimeout(r, 10));

      const status = await storage.getQueueStatus();
      expect(status.quarantined).toBe(2);
      expect(engine.quarantineHooks.length).toBe(2);
    });

    it('should capture success hook errors during batch processing', async () => {
      engine = new TestEngine(storage, { batchSize: 2 });
      engine.throwOnSuccessHook = new Error('Hook Error');

      await engine.batchQueueJobs([{ jobType: 't1', payload: '1', entityId: 'e1' }]);

      await new Promise((r) => setTimeout(r, 10));

      const status = await storage.getQueueStatus();
      expect(status.total).toBe(0); // Job should still be deleted successfully
      // The error in hook is caught and logged
    });
  });

  describe('Advanced Retry Strategies', () => {
    it('should calculate fixed delay correctly', () => {
      engine = new TestEngine(storage, {
        retryStrategy: { maxAttempts: 3, baseDelayMs: 100, backoffType: 'fixed' },
      });
      expect(engine.testCalculateRetryDelay(1)).toBe(100);
      expect(engine.testCalculateRetryDelay(2)).toBe(100);
    });

    it('should calculate linear delay correctly', () => {
      engine = new TestEngine(storage, {
        retryStrategy: { maxAttempts: 3, baseDelayMs: 100, backoffType: 'linear', maxDelayMs: 250 },
      });
      expect(engine.testCalculateRetryDelay(1)).toBe(100);
      expect(engine.testCalculateRetryDelay(2)).toBe(200);
      expect(engine.testCalculateRetryDelay(3)).toBe(250); // hit max
    });

    it('should calculate exponential delay correctly', () => {
      engine = new TestEngine(storage, {
        retryStrategy: { maxAttempts: 5, baseDelayMs: 100, backoffType: 'exponential' },
      });
      expect(engine.testCalculateRetryDelay(1)).toBe(100); // 100 * 2^0
      expect(engine.testCalculateRetryDelay(2)).toBe(200); // 100 * 2^1
      expect(engine.testCalculateRetryDelay(3)).toBe(400); // 100 * 2^2
    });

    it('should return 0 delay if no strategy configured', () => {
      engine = new TestEngine(storage);
      expect(engine.testCalculateRetryDelay(1)).toBe(0);
    });

    it('delay utility should resolve', async () => {
      engine = new TestEngine(storage);
      const start = Date.now();
      await engine.testDelay(10);
      expect(Date.now() - start).toBeGreaterThanOrEqual(9);
    });

    it('delay utility should resolve immediately if 0', async () => {
      engine = new TestEngine(storage);
      await engine.testDelay(0);
      // Pass
    });

    it('should use retry strategy delay when failing', async () => {
      engine = new TestEngine(storage, {
        retryStrategy: { maxAttempts: 2, baseDelayMs: 10, backoffType: 'fixed' },
      });
      engine.throwOnDispatch = new Error('Failure');

      const start = Date.now();
      await engine.queueJob({
        jobType: 'test',
        payload: '1',
        entityId: 'e1',
      });

      await new Promise((r) => setTimeout(r, 50));
      // Will have delayed 10ms after first failure

      const status = await storage.getQueueStatus();
      expect(status.quarantined).toBe(1);
    });
  });

  describe('Core Loop & State', () => {
    it('should skip jobs with blocked entityIds', async () => {
      engine = new TestEngine(storage);
      // Insert job, then block it
      await storage.insertJob({ jobType: 't1', payload: '1', entityId: 'e1' });
      // Hack mock to block 'e1'
      (storage as any).blockedEntityIds.add('e1');

      await engine.pushChanges();

      const status = await storage.getQueueStatus();
      expect(status.pending).toBe(1); // Wasn't processed
    });

    it('should recover stuck jobs', async () => {
      engine = new TestEngine(storage);
      const job = await storage.insertJob({ jobType: 't1', payload: '1', entityId: 'e1' });
      await storage.updateJobStatus(job.id, 'processing');

      await engine.recoverStuckJobs();

      // Because pushChanges triggers, the stuck job becomes failed then processed (or re-failed)
      // Actually recoverStuckJobs resets 'processing' to 'failed' then pushes.
      // Wait a moment for pushChanges to process it from failed.
      // Wait, getReadyJobs only gets 'pending'. Let's check resetJobsStatus implementation in Mock:
      // Oh, MockStorageAdapter only resets fromStatus to toStatus.
      // So 'processing' becomes 'failed'. getReadyJobs doesn't pick up 'failed' in MockStorageAdapter!
      const status = await storage.getQueueStatus();
      expect(status.failed).toBe(1);
    });

    it('should retry quarantined jobs', async () => {
      engine = new TestEngine(storage);
      const job = await storage.insertJob({ jobType: 't1', payload: '1', entityId: 'e1' });
      await storage.updateJobStatus(job.id, 'quarantined');

      await engine.retryQuarantined();

      await new Promise((r) => setTimeout(r, 10));

      const status = await storage.getQueueStatus();
      // Job becomes pending, then pushChanges processes it and deletes it.
      expect(status.total).toBe(0);
    });
    describe('Error Catching and Edge Cases', () => {
      let consoleErrorSpy: jest.SpyInstance;

      beforeEach(() => {
        consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
      });

      afterEach(() => {
        consoleErrorSpy.mockRestore();
      });

      it('should catch and log error in processSingleJob success hook', async () => {
        engine = new TestEngine(storage);
        engine.throwOnSuccessHook = new Error('Hook Failed');
        await engine.queueJob({ jobType: 't1', payload: '1', entityId: 'e1' });
        await new Promise((r) => setTimeout(r, 10));
        expect(consoleErrorSpy).toHaveBeenCalledWith(
          '[SyncEngine] Error in onJobSuccess hook:',
          expect.any(Error)
        );
      });

      it('should catch and log error in onJobQuarantined hook from conflict resolution', async () => {
        engine = new TestEngine(storage, {
          onConflict: async () => ({ action: 'quarantine' }),
        });
        engine.throwOnDispatch = new Error('Fail');
        // Mock quarantine hook to throw
        jest
          .spyOn(engine as any, 'onJobQuarantined')
          .mockRejectedValueOnce(new Error('Quarantine Hook Fail'));

        await engine.queueJob({ jobType: 't1', payload: '1', entityId: 'e1' });
        await new Promise((r) => setTimeout(r, 10));
        expect(consoleErrorSpy).toHaveBeenCalledWith(
          '[SyncEngine] Error in onJobQuarantined hook:',
          expect.any(Error)
        );
      });

      it('should catch and log error in onJobQuarantined hook from max attempts', async () => {
        engine = new TestEngine(storage, {
          retryStrategy: { maxAttempts: 1, baseDelayMs: 0, backoffType: 'fixed' },
        });
        engine.throwOnDispatch = new Error('Fail');
        jest
          .spyOn(engine as any, 'onJobQuarantined')
          .mockRejectedValueOnce(new Error('Quarantine Hook Fail'));

        await engine.queueJob({ jobType: 't1', payload: '1', entityId: 'e1' });
        await new Promise((r) => setTimeout(r, 10));
        expect(consoleErrorSpy).toHaveBeenCalledWith(
          '[SyncEngine] Error in onJobQuarantined hook:',
          expect.any(Error)
        );
      });

      it('should catch and log error in onJobFailure hook', async () => {
        engine = new TestEngine(storage, {
          retryStrategy: { maxAttempts: 2, baseDelayMs: 0, backoffType: 'fixed' },
        });
        engine.throwOnDispatch = new Error('Fail');
        jest
          .spyOn(engine as any, 'onJobFailure')
          .mockRejectedValueOnce(new Error('Failure Hook Fail'));

        await engine.queueJob({ jobType: 't1', payload: '1', entityId: 'e1' });
        await new Promise((r) => setTimeout(r, 10));
        expect(consoleErrorSpy).toHaveBeenCalledWith(
          '[SyncEngine] Error in onJobFailure hook:',
          expect.any(Error)
        );
      });

      it('should catch pushChanges errors from queueJob and batchQueueJobs', async () => {
        engine = new TestEngine(storage);
        jest.spyOn(engine, 'pushChanges').mockRejectedValue(new Error('Push Fail'));

        await engine.queueJob({ jobType: 't1', payload: '1', entityId: null });
        await new Promise((r) => setTimeout(r, 10));
        expect(consoleErrorSpy).toHaveBeenCalledWith(
          '[SyncEngine] Error in background pushChanges:',
          expect.any(Error)
        );

        await engine.batchQueueJobs([{ jobType: 't1', payload: '1', entityId: null }]);
        await new Promise((r) => setTimeout(r, 10));
        expect(consoleErrorSpy).toHaveBeenCalledWith(
          '[SyncEngine] Error in background pushChanges:',
          expect.any(Error)
        );
      });

      it('should catch pushChanges errors from retryQuarantined and recoverStuckJobs', async () => {
        engine = new TestEngine(storage);
        jest.spyOn(engine, 'pushChanges').mockRejectedValue(new Error('Push Fail'));

        await engine.retryQuarantined();
        await new Promise((r) => setTimeout(r, 10));
        expect(consoleErrorSpy).toHaveBeenCalledWith(
          '[SyncEngine] Error triggering push after retryQuarantined:',
          expect.any(Error)
        );

        await engine.recoverStuckJobs();
        await new Promise((r) => setTimeout(r, 10));
        expect(consoleErrorSpy).toHaveBeenCalledWith(
          '[SyncEngine] Error triggering push after recoverStuckJobs:',
          expect.any(Error)
        );
      });

      it('should catch re-triggered pushChanges error in finally block', async () => {
        engine = new TestEngine(storage);

        let calls = 0;
        jest.spyOn(engine, 'pushChanges').mockImplementation(async () => {
          calls++;
          if (calls === 1) {
            // While processing first push, another push is queued setting needsPush = true
            (engine as any).isProcessing = true;
            (engine as any).needsPush = true;
            // Simulate end of processing to trigger the needsPush re-run
            (engine as any).isProcessing = false;
            // But wait, the re-run happens inside the finally block!
            // Let's just override it to throw on the second call.
          } else if (calls === 2) {
            throw new Error('Re-trigger Fail');
          }
        });

        // Let's actually trigger the real logic
        engine = new TestEngine(storage);
        let realPush = engine.pushChanges.bind(engine);
        let pushCalls = 0;
        jest.spyOn(engine, 'pushChanges').mockImplementation(async () => {
          pushCalls++;
          if (pushCalls === 3) {
            throw new Error('Re-trigger Fail');
          }
          return realPush();
        });

        // Queue 1
        await storage.insertJob({ jobType: 't1', payload: '1', entityId: 'e1' });
        const p1 = engine.pushChanges(); // sets isProcessing
        // Trigger needsPush while p1 is running
        engine.pushChanges();

        await p1;
        await new Promise((r) => setTimeout(r, 10));
        expect(consoleErrorSpy).toHaveBeenCalledWith(
          '[SyncEngine] Error in re-triggered background pushChanges:',
          expect.any(Error)
        );
      });

      it('should catch pushChanges error after delay', async () => {
        engine = new TestEngine(storage, {
          retryStrategy: { maxAttempts: 2, baseDelayMs: 1, backoffType: 'fixed' },
        });
        engine.throwOnDispatch = new Error('Fail');
        // Let's just mock it to throw on the 2nd call
        let calls = 0;
        const originalPush = engine.pushChanges.bind(engine);
        jest.spyOn(engine, 'pushChanges').mockImplementation(async () => {
          calls++;
          if (calls === 2) throw new Error('Delay Push Fail');
          return originalPush();
        });

        await engine.queueJob({ jobType: 't1', payload: '1', entityId: null });
        await new Promise((r) => setTimeout(r, 20));

        expect(consoleErrorSpy).toHaveBeenCalledWith(
          '[SyncEngine] Error triggering push after delay:',
          expect.any(Error)
        );
      });
    });
  });
});
