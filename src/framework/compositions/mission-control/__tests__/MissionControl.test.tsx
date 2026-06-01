import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { MissionControl } from '../MissionControl';
import { MembraneTopology } from '../../../admin/telemetry-3d/types';
import { useAppVitals } from '../../../admin/metrics/useAppVitals';

// Mock dependencies
jest.mock('../../../admin/metrics/useAppVitals');
jest.mock('../../../admin/telemetry-3d/hooks', () => ({
  useTelemetryState: () => ({
    nodeProps: { 'node-1': { position: [0, 0, 0], color: 'blue', scale: 1, emissiveIntensity: 1 } },
    edgeProps: [],
    selectedNodeId: null,
    setSelectedNodeId: jest.fn(),
    setHoveredNodeId: jest.fn(),
  }),
}));

const mockedUseAppVitals = useAppVitals as jest.MockedFunction<typeof useAppVitals>;

const mockTopology: MembraneTopology = {
  nodes: [{ id: 'node-1', type: 'actor', label: 'Actor 1', tension: 0.5 }],
  edges: [],
};

describe('MissionControl', () => {
  beforeEach(() => {
    mockedUseAppVitals.mockReturnValue({
      jsFps: 60,
      uiFps: 60,
      memory: 100,
    });
  });

  it('renders AdminShell with title and components', () => {
    const { getByText, getByTestId } = render(<MissionControl topology={mockTopology} />);

    expect(getByText('Mission Control')).toBeTruthy();
    expect(getByText('Membrane Topology & System Vitals')).toBeTruthy();

    // Check if SystemHealthDashboard is rendered
    expect(getByTestId('mission-control-health')).toBeTruthy();

    // Check if TelemetryGraph3D is rendered
    expect(getByTestId('mission-control-graph')).toBeTruthy();
  });

  it('calls onNodeClick when a node is clicked in TelemetryGraph3D', () => {
    const onNodeClickMock = jest.fn();
    const { getByTestId, getByText } = render(
      <MissionControl topology={mockTopology} onNodeClick={onNodeClickMock} />
    );

    // Find the node and press it.
    // In TelemetryGraph3D, nodes are rendered as TouchableOpacity if we look at the source.
    // Let's check TelemetryGraph3D.tsx again to see how to target a node.

    const node = getByText('Actor 1');
    fireEvent.press(node);

    expect(onNodeClickMock).toHaveBeenCalledWith('node-1');
  });

  it('calls onBack when back button is pressed', () => {
    const onBackMock = jest.fn();
    const { getByLabelText } = render(
      <MissionControl topology={mockTopology} onBack={onBackMock} />
    );

    const backBtn = getByLabelText('Go back');
    fireEvent.press(backBtn);

    expect(onBackMock).toHaveBeenCalledTimes(1);
  });
});
