export interface SyncJobBase {
  id: string | number;
  jobType: string;
  payload: string;
  status: 'pending' | 'processing' | 'failed' | 'quarantined';
  attempts: number;
  entityId: string | null;
  createdAt: Date;
}

/**
 * Configuration for advanced retry strategies.
 */
export interface RetryStrategy {
  /** Maximum number of retry attempts before quarantining */
  maxAttempts: number;
  /** Type of backoff: linear, exponential, or fixed */
  backoffType: 'fixed' | 'linear' | 'exponential';
  /** Base delay in milliseconds */
  baseDelayMs: number;
  /** Maximum delay limit in milliseconds */
  maxDelayMs?: number;
}

/**
 * Result of a conflict resolution strategy.
 */
export type ConflictResolutionResult<TJob extends SyncJobBase> =
  | {
      action: 'retry';
      modifiedJob?: Partial<Omit<TJob, 'id' | 'status' | 'attempts' | 'createdAt'>>;
    }
  | { action: 'discard' }
  | { action: 'quarantine' };

/**
 * Context provided to a conflict resolution callback.
 */
export interface ConflictContext<TJob extends SyncJobBase> {
  job: TJob;
  serverState?: any;
  error: any;
}

/**
 * Callback for handling synchronization conflicts in an offline-first environment.
 */
export type ConflictResolutionCallback<TJob extends SyncJobBase> = (
  context: ConflictContext<TJob>
) => Promise<ConflictResolutionResult<TJob>> | ConflictResolutionResult<TJob>;

export interface SyncEngineConfig<TJob extends SyncJobBase> {
  /** Strategy for retrying failed jobs */
  retryStrategy?: RetryStrategy;
  /** Callback for offline-first conflict resolution */
  onConflict?: ConflictResolutionCallback<TJob>;
  /** Number of jobs to process together if dispatchBatch is implemented */
  batchSize?: number;
}

export interface SyncStorageAdapter<TJob extends SyncJobBase> {
  insertJob(job: Omit<TJob, 'id' | 'status' | 'attempts' | 'createdAt'>): Promise<TJob>;
  updateJobStatus(id: TJob['id'], status: TJob['status'], attempts?: number): Promise<void>;
  updateJob(
    id: TJob['id'],
    updates: Partial<Omit<TJob, 'id' | 'status' | 'attempts' | 'createdAt'>>
  ): Promise<void>;
  deleteJob(id: TJob['id']): Promise<void>;
  getReadyJobs(supportedJobTypes?: string[]): Promise<TJob[]>;
  getBlockedEntityIds(supportedJobTypes?: string[]): Promise<Set<string>>;
  resetJobsStatus(
    fromStatus: TJob['status'],
    toStatus: TJob['status'],
    supportedJobTypes?: string[],
    resetAttempts?: boolean
  ): Promise<void>;
  getQueueStatus(supportedJobTypes?: string[]): Promise<{
    total: number;
    pending: number;
    processing: number;
    failed: number;
    quarantined: number;
    jobs: TJob[];
  }>;
}

export interface OutboxDelta {
  subject: string;
  predicate: string;
  object: string;
  timestamp: number;
}

export interface OutboxHook {
  receipts?: boolean;
}

export interface OutboxReceipt {
  inputHash: string;
  outputHash: string;
  deltaHash: string;
  previousReceiptHash: string;
  receiptHash: string;
}
