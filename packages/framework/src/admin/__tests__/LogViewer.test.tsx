import React from 'react';
import { render } from '@testing-library/react-native';
import { LogViewer, LogEntry } from '../components/LogViewer';

describe('LogViewer', () => {
  const mockLogs: LogEntry[] = [
    { id: '1', level: 'info', message: 'App started', timestamp: 1609459200000 },
    { id: '2', level: 'warn', message: 'High memory usage', timestamp: 1609459201000 },
    { id: '3', level: 'error', message: 'Crash detected', timestamp: 1609459202000 },
    { id: '4', level: 'debug', message: 'Variable X is undefined', timestamp: 1609459203000 },
  ];

  it('renders correctly with no logs', () => {
    const { getByText } = render(<LogViewer logs={[]} />);
    expect(getByText('No logs available.')).toBeTruthy();
    expect(getByText('System Logs')).toBeTruthy();
  });

  it('renders custom title correctly', () => {
    const { getByText } = render(<LogViewer logs={[]} title="Diagnostics" />);
    expect(getByText('Diagnostics')).toBeTruthy();
  });

  it('renders list of logs correctly', () => {
    const { getByText } = render(<LogViewer logs={mockLogs} />);

    // Check if messages are present
    expect(getByText('App started')).toBeTruthy();
    expect(getByText('High memory usage')).toBeTruthy();
    expect(getByText('Crash detected')).toBeTruthy();
    expect(getByText('Variable X is undefined')).toBeTruthy();

    // Check if levels are formatted and present
    expect(getByText('[INFO]')).toBeTruthy();
    expect(getByText('[WARN]')).toBeTruthy();
    expect(getByText('[ERROR]')).toBeTruthy();
    expect(getByText('[DEBUG]')).toBeTruthy();
  });
});
