import { renderHook, act } from '@testing-library/react-native';
import { useSyncReplay } from '../useSyncReplay';
import { SyncReplaySession } from '../types';
import { SyncJobBase } from '../../types';

describe('useSyncReplay', () => {
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
  ];

  const session: SyncReplaySession<SyncJobBase> = {
    id: 's1',
    startTime: Date.now(),
    initialJobs: mockJobs,
    events: [
      {
        timestamp: Date.now(),
        type: 'job_started',
        jobId: 1,
        snapshot: { pending: [], processing: [mockJobs[0]], failed: [], quarantined: [] },
      },
      {
        timestamp: Date.now(),
        type: 'job_success',
        jobId: 1,
        snapshot: { pending: [], processing: [], failed: [], quarantined: [] },
      },
    ],
  };

  it('should initialize at index -1', () => {
    const { result } = renderHook(() => useSyncReplay(session));
    expect(result.current.currentIndex).toBe(-1);
    expect(result.current.currentEvent).toBeNull();
    expect(result.current.currentSnapshot.pending).toHaveLength(1);
  });

  it('should go forward and backward', () => {
    const { result } = renderHook(() => useSyncReplay(session));

    act(() => {
      result.current.next();
    });
    expect(result.current.currentIndex).toBe(0);
    expect(result.current.currentEvent?.type).toBe('job_started');

    act(() => {
      result.current.next();
    });
    expect(result.current.currentIndex).toBe(1);
    expect(result.current.currentEvent?.type).toBe('job_success');

    act(() => {
      result.current.prev();
    });
    expect(result.current.currentIndex).toBe(0);
  });

  it('should seek to a specific index', () => {
    const { result } = renderHook(() => useSyncReplay(session));
    act(() => {
      result.current.seek(1);
    });
    expect(result.current.currentIndex).toBe(1);
  });

  it('should handle playback', () => {
    jest.useFakeTimers();
    const { result } = renderHook(() => useSyncReplay(session));

    act(() => {
      result.current.play();
    });
    expect(result.current.isPlaying).toBe(true);

    act(() => {
      jest.advanceTimersByTime(1000);
    });
    expect(result.current.currentIndex).toBe(0);

    act(() => {
      jest.advanceTimersByTime(1000);
    });
    expect(result.current.currentIndex).toBe(1);
    expect(result.current.isPlaying).toBe(false); // Should stop at the end

    jest.useRealTimers();
  });
});
