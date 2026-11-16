import React from 'react';
import { render } from '@testing-library/react-native';
import { AalstDashboard } from '../AalstDashboard';
import { useAalstStream } from '../useAalstStream';

jest.mock('../useAalstStream');

const mockedUseAalstStream = useAalstStream as jest.Mock;

describe('AalstDashboard', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders disconnected state and empty list correctly', () => {
    mockedUseAalstStream.mockReturnValue({
      isConnected: false,
      logs: [],
    });

    const { getByTestId } = render(<AalstDashboard />);

    expect(getByTestId('connection-status').children[0]).toBe('Disconnected');
    expect(getByTestId('empty-text').children[0]).toBe('No logs yet');
  });

  it('renders connected state and log items correctly', () => {
    const mockLogs = [
      {
        id: '1',
        type: 'PETRI_NET',
        payload:
          '{"places": [{"id": "p1", "tokens": 1}], "transitions": [{"id": "t1", "enabled": true}]}',
        timestamp: 1000,
      },
      { id: '2', type: 'ALIGNMENT', payload: 'Log 2', timestamp: 2000 },
      { id: '3', type: 'CONVERSATION_FEED', payload: 'Hello from Swarm', timestamp: 3000 },
    ];

    mockedUseAalstStream.mockReturnValue({
      isConnected: true,
      logs: mockLogs,
    });

    const { getByTestId, getByText } = render(<AalstDashboard />);

    expect(getByTestId('connection-status').children[0]).toBe('Connected');
    expect(getByTestId('broadcast-badge')).toBeTruthy();
    expect(getByText('BROADCAST ACTIVE - VAN DER AALST CERTIFIED')).toBeTruthy();

    expect(getByTestId('log-item-1')).toBeTruthy();
    expect(getByTestId('log-item-2')).toBeTruthy();
    expect(getByTestId('log-item-3')).toBeTruthy();

    // Check for Petri Net visualization (assuming it's rendered for PETRI_NET type)
    expect(getByTestId('petri-net-viz')).toBeTruthy();

    // Check for Conversation Feed item
    expect(getByText('CONVERSATION_FEED')).toBeTruthy();
    expect(getByText('Hello from Swarm')).toBeTruthy();
  });
});
