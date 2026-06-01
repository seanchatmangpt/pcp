import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { TelemetryGraph3D } from '../TelemetryGraph3D';
import { MembraneTopology } from '../types';

const mockTopology: MembraneTopology = {
  nodes: [
    { id: '1', type: 'actor', label: 'Actor 1', tension: 0.5 },
    { id: '2', type: 'system', label: 'System 1', tension: 0.2 },
  ],
  edges: [{ id: 'e1', source: '1', target: '2', queueDensity: 0.8 }],
};

describe('TelemetryGraph3D', () => {
  it('renders correctly', () => {
    const { getByText, getByTestId } = render(<TelemetryGraph3D topology={mockTopology} />);

    expect(getByText('Membrane Topology DX')).toBeTruthy();
    expect(getByText('Nodes: 2')).toBeTruthy();
    expect(getByText('Edges: 1')).toBeTruthy();
    expect(getByTestId('telemetry-graph-3d')).toBeTruthy();
  });

  it('handles node clicks', () => {
    const onNodeClick = jest.fn();
    const { getByText } = render(
      <TelemetryGraph3D topology={mockTopology} onNodeClick={onNodeClick} />
    );

    // Click on Actor 1 label (which is part of the TouchableOpacity)
    fireEvent.press(getByText('Actor 1'));

    expect(onNodeClick).toHaveBeenCalledWith('1');
    expect(getByText('Selected: 1')).toBeTruthy();
  });

  it('updates selection when another node is clicked', () => {
    const { getByText } = render(<TelemetryGraph3D topology={mockTopology} />);

    fireEvent.press(getByText('Actor 1'));
    expect(getByText('Selected: 1')).toBeTruthy();

    fireEvent.press(getByText('System 1'));
    expect(getByText('Selected: 2')).toBeTruthy();
  });
});
