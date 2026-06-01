import {
  SyncJobBase,
  SyncStorageAdapter,
  SyncEngineConfig,
  ConflictContext,
  ConflictResolutionResult,
} from './types';

/**
 * Advanced Sync Engine designed for offline-first applications.
 * Supports batch dispatch, conflict resolution, and complex retry strategies.
 */
export abstract class FrameworkSyncEngine<TJob extends SyncJobBase> {
  private activeEntityIds = new Set<string>();
  private isProcessing = false;
  private needsPush = false;

  protected maxAttempts = 3;
  protected supportedJobTypes?: string[];
  protected config: SyncEngineConfig<TJob>;

  constructor(
    protected storage: SyncStorageAdapter<TJob>,
    config?: SyncEngineConfig<TJob>
  ) {
    this.config = config || {};
    if (this.config.retryStrategy) {
      this.maxAttempts = this.config.retryStrategy.maxAttempts;
    }
  }

  /**
   * Dispatch a single job to the remote server/API.
   * Subclasses must implement this to define the actual sync mutation.
   */
  protected abstract dispatchJob(job: TJob): Promise<void>;

  /**
   * Optional: Dispatch a batch of jobs in a single request.
   * If implemented, the engine will group jobs and call this instead of `dispatchJob` when `batchSize` > 1.
   */
  protected dispatchBatch?(jobs: TJob[]): Promise<void>;

  protected onJobSuccess(job: TJob): Promise<void> | void {}
  protected onJobFailure(job: TJob, error: any): Promise<void> | void {}
  protected onJobQuarantined(job: TJob, error: any): Promise<void> | void {}

  /**
   * Determine delay before next attempt based on retry strategy.
   * @param attempts Current attempt count
   * @returns Delay in milliseconds
   */
  protected calculateRetryDelay(attempts: number): number {
    const strategy = this.config.retryStrategy;
    if (!strategy) return 0;

    let delay = strategy.baseDelayMs;
    if (strategy.backoffType === 'linear') {
      delay = strategy.baseDelayMs * attempts;
    } else if (strategy.backoffType === 'exponential') {
      delay = strategy.baseDelayMs * Math.pow(2, attempts - 1);
    }

    if (strategy.maxDelayMs && delay > strategy.maxDelayMs) {
      return strategy.maxDelayMs;
    }
    return delay;
  }

  /**
   * Delay utility.
   */
  protected async delay(ms: number): Promise<void> {
    if (ms <= 0) return;
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Queue a single sync job.
   */
  public async queueJob(
    job: Omit<TJob, 'id' | 'status' | 'attempts' | 'createdAt'>
  ): Promise<TJob> {
    const inserted = await this.storage.insertJob(job);
    this.pushChanges().catch((err) => {
      console.error('[SyncEngine] Error in background pushChanges:', err);
    });
    return inserted;
  }

  /**
   * Queue multiple sync jobs in a batch format.
   */
  public async batchQueueJobs(
    jobs: Omit<TJob, 'id' | 'status' | 'attempts' | 'createdAt'>[]
  ): Promise<TJob[]> {
    const insertedJobs: TJob[] = [];
    for (const job of jobs) {
      const inserted = await this.storage.insertJob(job);
      insertedJobs.push(inserted);
    }
    this.pushChanges().catch((err) => {
      console.error('[SyncEngine] Error in background pushChanges:', err);
    });
    return insertedJobs;
  }

  /**
   * Core loop to push ready jobs to the server.
   */
  public async pushChanges(): Promise<void> {
    if (this.isProcessing) {
      this.needsPush = true;
      return;
    }
    this.isProcessing = true;
    this.needsPush = false;

    try {
      while (true) {
        const jobs = await this.storage.getReadyJobs(this.supportedJobTypes);
        if (jobs.length === 0) break;

        const blockedEntityIds = await this.storage.getBlockedEntityIds(this.supportedJobTypes);

        const availableJobs = jobs.filter((job) => {
          if (!job.entityId) return true;
          return !this.activeEntityIds.has(job.entityId) && !blockedEntityIds.has(job.entityId);
        });

        if (availableJobs.length === 0) break;

        const batchSize = this.config.batchSize || 1;
        if (batchSize > 1 && this.dispatchBatch) {
          const batchJobs = availableJobs.slice(0, batchSize);
          await this.processBatch(batchJobs);
        } else {
          const nextJob = availableJobs[0];
          await this.processSingleJob(nextJob);
        }
      }
    } finally {
      this.isProcessing = false;
      if (this.needsPush) {
        this.pushChanges().catch((err) => {
          console.error('[SyncEngine] Error in re-triggered background pushChanges:', err);
        });
      }
    }
  }

  /**
   * Process a single job, resolving conflicts and applying retries.
   */
  protected async processSingleJob(job: TJob): Promise<void> {
    if (job.entityId) {
      this.activeEntityIds.add(job.entityId);
    }

    try {
      await this.storage.updateJobStatus(job.id, 'processing');
      await this.dispatchJob({ ...job, status: 'processing' } as unknown as TJob);
      await this.storage.deleteJob(job.id);

      try {
        await this.onJobSuccess(job);
      } catch (hookError) {
        console.error('[SyncEngine] Error in onJobSuccess hook:', hookError);
      }
    } catch (error: any) {
      await this.handleJobFailure(job, error);
    } finally {
      if (job.entityId) {
        this.activeEntityIds.delete(job.entityId);
      }
    }
  }

  /**
   * Process a batch of jobs simultaneously.
   */
  protected async processBatch(jobs: TJob[]): Promise<void> {
    for (const job of jobs) {
      if (job.entityId) this.activeEntityIds.add(job.entityId);
      await this.storage.updateJobStatus(job.id, 'processing');
    }

    try {
      if (this.dispatchBatch) {
        await this.dispatchBatch(
          jobs.map((j) => ({ ...j, status: 'processing' }) as unknown as TJob)
        );
      }

      for (const job of jobs) {
        await this.storage.deleteJob(job.id);
        try {
          await this.onJobSuccess(job);
        } catch (hookError) {
          console.error('[SyncEngine] Error in onJobSuccess hook:', hookError);
        }
      }
    } catch (error: any) {
      // If batch fails, we fail all jobs in the batch and handle individually.
      for (const job of jobs) {
        await this.handleJobFailure(job, error);
      }
    } finally {
      for (const job of jobs) {
        if (job.entityId) this.activeEntityIds.delete(job.entityId);
      }
    }
  }

  /**
   * Centralized failure handler with offline-first conflict resolution support.
   */
  protected async handleJobFailure(job: TJob, error: any): Promise<void> {
    let resolvedAction: ConflictResolutionResult<TJob> | null = null;

    if (this.config.onConflict) {
      try {
        resolvedAction = await this.config.onConflict({ job, error });
      } catch (conflictError) {
        console.error('[SyncEngine] Error in onConflict hook:', conflictError);
      }
    }

    if (resolvedAction) {
      if (resolvedAction.action === 'discard') {
        await this.storage.deleteJob(job.id);
        return;
      }
      if (resolvedAction.action === 'retry') {
        if (resolvedAction.modifiedJob && this.storage.updateJob) {
          await this.storage.updateJob(job.id, resolvedAction.modifiedJob);
        }
        await this.storage.updateJobStatus(job.id, 'pending', job.attempts);
        return;
      }
      if (resolvedAction.action === 'quarantine') {
        await this.storage.updateJobStatus(job.id, 'quarantined', job.attempts);
        const updatedJob = { ...job, status: 'quarantined' } as unknown as TJob;
        try {
          await this.onJobQuarantined(updatedJob, error);
        } catch (hookError) {
          console.error('[SyncEngine] Error in onJobQuarantined hook:', hookError);
        }
        return;
      }
    }

    const updatedAttempts = job.attempts + 1;
    const isQuarantined = updatedAttempts >= this.maxAttempts;
    const newStatus = isQuarantined ? 'quarantined' : 'failed';

    await this.storage.updateJobStatus(job.id, newStatus, updatedAttempts);

    const updatedJob = {
      ...job,
      status: newStatus,
      attempts: updatedAttempts,
    } as unknown as TJob;

    if (isQuarantined) {
      try {
        await this.onJobQuarantined(updatedJob, error);
      } catch (hookError) {
        console.error('[SyncEngine] Error in onJobQuarantined hook:', hookError);
      }
    } else {
      try {
        await this.onJobFailure(updatedJob, error);
      } catch (hookError) {
        console.error('[SyncEngine] Error in onJobFailure hook:', hookError);
      }

      const delayMs = this.calculateRetryDelay(updatedAttempts);
      if (delayMs > 0) {
        await this.delay(delayMs);
      }

      // Set back to pending so it can be picked up for the next retry attempt
      await this.storage.updateJobStatus(job.id, 'pending', updatedAttempts);
      // Trigger a push to ensure it gets processed
      this.pushChanges().catch((err) => {
        console.error('[SyncEngine] Error triggering push after delay:', err);
      });
    }
  }

  public async retryQuarantined(): Promise<void> {
    await this.storage.resetJobsStatus('quarantined', 'pending', this.supportedJobTypes, true);
    this.pushChanges().catch((err) => {
      console.error('[SyncEngine] Error triggering push after retryQuarantined:', err);
    });
  }

  public async recoverStuckJobs(): Promise<void> {
    await this.storage.resetJobsStatus('processing', 'failed', this.supportedJobTypes, false);
    this.pushChanges().catch((err) => {
      console.error('[SyncEngine] Error triggering push after recoverStuckJobs:', err);
    });
  }

  public async getQueueStatus() {
    return this.storage.getQueueStatus(this.supportedJobTypes);
  }
}
