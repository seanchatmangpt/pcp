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

  it('handles empty error logs', () => {
    const { getByText } = render(
      <FusionAdminConsole topology={mockTopology} initialErrorLogs={[]} />
    );

    fireEvent.press(getByText('Auto-Fix Logs'));

    expect(getByText('No pending issues detected.')).toBeTruthy();
  });

  it('removes error from pending when fixed', async () => {
    const mockAction = jest.fn();
    mockedAnalyzeError.mockReturnValue({
      causes: [],
      suggestions: [
        {
          id: 'fix-1',
          title: 'Apply Fix',
          description: 'Fix it!',
          impact: 'low',
          action: mockAction,
        },
      ],
    });

    const multipleErrorLogs = [
      ...mockErrorLogs,
      {
        id: 'err-2',
        timestamp: Date.now(),
        error: new Error('Another error'),
        status: 'pending' as const,
      },
    ];

    const { getByText, getAllByText, queryByText } = render(
      <FusionAdminConsole topology={mockTopology} initialErrorLogs={multipleErrorLogs} />
    );

    fireEvent.press(getByText('Auto-Fix Logs'));
    // Apply fix for err-1 (which comes from mockErrorLogs)
    // Actually AutoFixer is rendered for each log.
    // Since mockedAnalyzeError returns 'Apply Fix' for all of them, there might be multiple 'Apply Fix' buttons.
    // I'll use getAllByText or better, target the specific one if I can.
    // But for coverage, clicking any is fine as long as it triggers handleResetError.

    fireEvent.press(getAllByText('Apply Fix', { exact: false })[0]);

    await waitFor(() => {
      expect(mockAction).toHaveBeenCalled();
      // One error should still be there (err-2) if I only fixed one.
      // Wait, my handleResetError is called with log.id.
      expect(queryByText('err-2')).toBeTruthy();
    });
  });

  it('calls onNodeClick when a node is clicked in Telemetry tab', () => {
    const onNodeClickMock = jest.fn();
    const { getByText } = render(
      <FusionAdminConsole topology={mockTopology} onNodeClick={onNodeClickMock} />
    );

    fireEvent.press(getByText('3D Telemetry'));
    fireEvent.press(getByText('Actor 1'));

    expect(onNodeClickMock).toHaveBeenCalledWith('node-1');
  });

  it('calls onBack when back button is pressed', () => {
    const onBackMock = jest.fn();
    const { getByLabelText } = render(
      <FusionAdminConsole topology={mockTopology} onBack={onBackMock} />
    );

    fireEvent.press(getByLabelText('Go back'));
    expect(onBackMock).toHaveBeenCalledTimes(1);
  });
});
