import { SyncJobBase } from '../types';
import { SyncQueueSnapshot, ReplayEvent, SyncReplaySession } from './types';

export class SyncReplayManager<TJob extends SyncJobBase> {
  private session: SyncReplaySession<TJob>;

  constructor(session: SyncReplaySession<TJob>) {
    this.session = session;
  }

  public getSession(): SyncReplaySession<TJob> {
    return this.session;
  }

  public getEvent(index: number): ReplayEvent<TJob> | undefined {
    return this.session.events[index];
  }

  public getSnapshotAt(index: number): SyncQueueSnapshot<TJob> {
    if (index < 0) {
      return this.createSnapshot(this.session.initialJobs);
    }
    const event = this.getEvent(index);
    return event ? event.snapshot : this.createSnapshot([]);
  }

  public getEventCount(): number {
    return this.session.events.length;
  }

  /**
   * Derives a snapshot from a list of jobs.
   */
  private createSnapshot(jobs: TJob[]): SyncQueueSnapshot<TJob> {
    return {
      pending: jobs.filter((j) => j.status === 'pending'),
      processing: jobs.filter((j) => j.status === 'processing'),
      failed: jobs.filter((j) => j.status === 'failed'),
      quarantined: jobs.filter((j) => j.status === 'quarantined'),
    };
  }

  /**
   * Static utility to record an event and create a new session if needed.
   * In a real SDK, this might be integrated into the SyncEngine via a middleware or hook.
   */
  public static createEvent(
    type: ReplayEvent<any>['type'],
    job: SyncJobBase,
    allJobs: SyncJobBase[],
    error?: any
  ): ReplayEvent<SyncJobBase> {
    return {
      timestamp: Date.now(),
      type,
      jobId: job.id,
      job: { ...job },
      error,
      snapshot: {
        pending: allJobs.filter((j) => j.status === 'pending'),
        processing: allJobs.filter((j) => j.status === 'processing'),
        failed: allJobs.filter((j) => j.status === 'failed'),
        quarantined: allJobs.filter((j) => j.status === 'quarantined'),
      },
    };
  }
}
