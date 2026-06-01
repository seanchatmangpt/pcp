import { renderHook, act } from '@testing-library/react-native';
import { useTelemetryState } from '../hooks';
import { MembraneTopology } from '../types';

const mockTopology: MembraneTopology = {
  nodes: [
    { id: '1', type: 'actor', label: 'Actor 1', tension: 0.5 },
    { id: '2', type: 'system', label: 'System 1', tension: 0.2 },
  ],
  edges: [{ id: 'e1', source: '1', target: '2', queueDensity: 0.8 }],
};

describe('useTelemetryState', () => {
  it('should map topology to 3D props', () => {
    const { result } = renderHook(() => useTelemetryState(mockTopology));

    expect(result.current.nodeProps['1']).toBeDefined();
    expect(result.current.nodeProps['2']).toBeDefined();
    expect(result.current.edgeProps.length).toBe(1);
    expect(result.current.edgeProps[0].id).toBe('e1');
  });

  it('should handle node selection', () => {
    const { result } = renderHook(() => useTelemetryState(mockTopology));

    act(() => {
      result.current.setSelectedNodeId('1');
    });

    expect(result.current.selectedNodeId).toBe('1');
    // Color should change for selected node
    expect(result.current.nodeProps['1'].color).toBe('#ffffff');
  });

  it('should handle node hover', () => {
    const { result } = renderHook(() => useTelemetryState(mockTopology));

    act(() => {
      result.current.setHoveredNodeId('2');
    });

    expect(result.current.hoveredNodeId).toBe('2');
    // Color should change for hovered node
    expect(result.current.nodeProps['2'].color).toBe('#ffff00');
  });

  it('should filter out edges with missing nodes', () => {
    const incompleteTopology: MembraneTopology = {
      nodes: [{ id: '1', type: 'actor', label: 'Actor 1', tension: 0.1 }],
      edges: [{ id: 'e1', source: '1', target: 'non-existent', queueDensity: 0.5 }],
    };

    const { result } = renderHook(() => useTelemetryState(incompleteTopology));
    expect(result.current.edgeProps.length).toBe(0);
  });
});
