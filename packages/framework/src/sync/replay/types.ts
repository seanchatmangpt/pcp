import { SyncJobBase } from '../types';

export interface SyncQueueSnapshot<TJob extends SyncJobBase> {
  pending: TJob[];
  processing: TJob[];
  failed: TJob[];
  quarantined: TJob[];
}

export interface ReplayEvent<TJob extends SyncJobBase> {
  timestamp: number;
  type:
    | 'job_added'
    | 'job_started'
    | 'job_success'
    | 'job_failure'
    | 'job_quarantined'
    | 'job_retry';
  jobId: TJob['id'];
  job?: TJob;
  error?: any;
  snapshot: SyncQueueSnapshot<TJob>;
}

export interface SyncReplaySession<TJob extends SyncJobBase> {
  id: string;
  startTime: number;
  events: ReplayEvent<TJob>[];
  initialJobs: TJob[];
}

export interface SyncReplayDebuggerState<TJob extends SyncJobBase> {
  session: SyncReplaySession<TJob> | null;
  currentIndex: number;
  isPlaying: boolean;
  playbackSpeed: number;
}
