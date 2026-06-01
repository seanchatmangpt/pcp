import { SyncReplayManager } from '../manager';
import { SyncReplaySession } from '../types';
import { SyncJobBase } from '../../types';

describe('SyncReplayManager', () => {
  const mockJobs: SyncJobBase[] = [
    {
      id: 1,
      jobType: 'test',
      payload: '{}',
      status: 'pending',
      attempts: 0,
      entityId: 'e1',
      createdAt: new Date(),
    },
    {
      id: 2,
      jobType: 'test',
      payload: '{}',
      status: 'processing',
      attempts: 1,
      entityId: 'e2',
      createdAt: new Date(),
    },
  ];

  const session: SyncReplaySession<SyncJobBase> = {
    id: 's1',
    startTime: Date.now(),
    initialJobs: mockJobs,
    events: [
      {
        timestamp: Date.now(),
        type: 'job_success',
        jobId: 1,
        snapshot: {
          pending: [],
          processing: [mockJobs[1]],
          failed: [],
          quarantined: [],
        },
      },
    ],
  };

  it('should initialize with a session', () => {
    const manager = new SyncReplayManager(session);
    expect(manager.getSession()).toBe(session);
  });

  it('should return event count', () => {
    const manager = new SyncReplayManager(session);
    expect(manager.getEventCount()).toBe(1);
  });

  it('should return specific events', () => {
    const manager = new SyncReplayManager(session);
    expect(manager.getEvent(0)).toBe(session.events[0]);
    expect(manager.getEvent(1)).toBeUndefined();
  });

  it('should return snapshot at specific index', () => {
    const manager = new SyncReplayManager(session);
    expect(manager.getSnapshotAt(-1)).toEqual({
      pending: [mockJobs[0]],
      processing: [mockJobs[1]],
      failed: [],
      quarantined: [],
    });
    expect(manager.getSnapshotAt(0)).toBe(session.events[0].snapshot);
  });

  it('should create an event using static utility', () => {
    const event = SyncReplayManager.createEvent('job_started', mockJobs[0], mockJobs);
    expect(event.type).toBe('job_started');
    expect(event.jobId).toBe(mockJobs[0].id);
    expect(event.snapshot.pending).toContainEqual(mockJobs[0]);
  });
});
