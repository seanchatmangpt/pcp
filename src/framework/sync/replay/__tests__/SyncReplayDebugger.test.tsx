import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { SyncReplayDebugger } from '../SyncReplayDebugger';
import { SyncReplaySession } from '../types';
import { SyncJobBase } from '../../types';

describe('SyncReplayDebugger', () => {
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
    ],
  };

  it('renders correctly', () => {
    const { getByText } = render(<SyncReplayDebugger session={session} />);
    expect(getByText('Sync Replay Debugger')).toBeTruthy();
    expect(getByText('Step: 0 / 1')).toBeTruthy();
  });

  it('handles playback controls', () => {
    const { getByText } = render(<SyncReplayDebugger session={session} />);

    const playButton = getByText('Play');
    fireEvent.press(playButton);
    expect(getByText('Pause')).toBeTruthy();

    const nextButton = getByText('Next');
    fireEvent.press(nextButton);
    expect(getByText('Step: 1 / 1')).toBeTruthy();
    expect(getByText('Event: job_started')).toBeTruthy();
  });

  it('calls onClose when provided', () => {
    const onClose = jest.fn();
    const { getByText } = render(<SyncReplayDebugger session={session} onClose={onClose} />);

    const closeButton = getByText('Close');
    fireEvent.press(closeButton);
    expect(onClose).toHaveBeenCalled();
  });
});
