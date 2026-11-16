import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { FusionAdminConsole } from '../FusionAdminConsole';
import { MembraneTopology } from '../../../admin/telemetry-3d/types';
import { useAppVitals } from '../../../admin/metrics/useAppVitals';
import * as analyzer from '../../../ui/auto-fix/analyzer';

// Mock dependencies
jest.mock('../../../admin/metrics/useAppVitals');
jest.mock('../../../admin/telemetry-3d/hooks', () => ({
  useTelemetryState: (topology: MembraneTopology) => ({
    nodeProps: Object.fromEntries(
      topology.nodes.map((n) => [n.id, { position: [0, 0, 0], color: 'blue', scale: 1 }])
    ),
    edgeProps: [],
    selectedNodeId: null,
    setSelectedNodeId: jest.fn(),
    setHoveredNodeId: jest.fn(),
  }),
}));

jest.mock('../../../ui/auto-fix/analyzer', () => ({
  analyzeError: jest.fn(),
}));

// Mock MMKV
jest.mock('react-native-mmkv', () => {
  return {
    MMKV: jest.fn().mockImplementation(() => ({
      clearAll: jest.fn(),
    })),
  };
});

const mockedUseAppVitals = useAppVitals as jest.MockedFunction<typeof useAppVitals>;
const mockedAnalyzeError = analyzer.analyzeError as jest.Mock;

const mockTopology: MembraneTopology = {
  nodes: [{ id: 'node-1', type: 'actor', label: 'Actor 1', tension: 0.5 }],
  edges: [],
};

const mockErrorLogs = [
  {
    id: 'err-1',
    timestamp: Date.now(),
    error: new Error('Failed to fetch data'),
    status: 'pending' as const,
  },
];

describe('FusionAdminConsole', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedUseAppVitals.mockReturnValue({
      jsFps: 60,
      uiFps: 60,
      memory: 100,
    });
    mockedAnalyzeError.mockReturnValue({
      causes: ['Network timeout'],
      suggestions: [
        {
          id: 'retry',
          title: 'Retry Connection',
          description: 'Try again now.',
          impact: 'low',
          action: jest.fn(),
        },
      ],
    });
  });

  it('renders the Vitals tab by default', () => {
    const { getByText, getByTestId } = render(<FusionAdminConsole topology={mockTopology} />);

    expect(getByText('Fusion Admin')).toBeTruthy();
    expect(getByText('Unified Intelligent Control Plane')).toBeTruthy();
    expect(getByTestId('fusion-admin-console-vitals-tab')).toBeTruthy();
    expect(getByTestId('fusion-admin-console-health')).toBeTruthy();
  });

  it('switches to Telemetry tab', () => {
    const { getByText, getByTestId, queryByTestId } = render(
      <FusionAdminConsole topology={mockTopology} />
    );

    fireEvent.press(getByText('3D Telemetry'));

    expect(getByTestId('fusion-admin-console-telemetry-tab')).toBeTruthy();
    expect(getByTestId('fusion-admin-console-graph')).toBeTruthy();
    expect(queryByTestId('fusion-admin-console-vitals-tab')).toBeNull();
  });

  it('switches to Auto-Fix Logs tab and displays errors', () => {
    const { getByText, getByTestId } = render(
      <FusionAdminConsole topology={mockTopology} initialErrorLogs={mockErrorLogs} />
    );

    fireEvent.press(getByText('Auto-Fix Logs'));

    expect(getByTestId('fusion-admin-console-autofix-tab')).toBeTruthy();
    expect(getByText('Intelligent Repair Queue')).toBeTruthy();
    expect(getByText('err-1')).toBeTruthy();
    expect(getByText('Pcp Intelligent Repair')).toBeTruthy();
  });
});
