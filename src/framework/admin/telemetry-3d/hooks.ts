import { useMemo, useState, useEffect } from 'react';
import { MembraneTopology, Node3DProps, Edge3DProps, MembraneNode, MembraneEdge } from './types';

/**
 * Maps raw membrane topology data to 3D renderable properties.
 */
export function useTelemetryState(topology: MembraneTopology) {
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);

  const nodeProps = useMemo(() => {
    return topology.nodes.reduce(
      (acc, node, index) => {
        // Simple layout logic: circle for now
        const angle = (index / topology.nodes.length) * Math.PI * 2;
        const radius = 5;
        const x = Math.cos(angle) * radius;
        const y = Math.sin(angle) * radius;
        const z = node.tension * 2; // Tension affects height/Z-axis

        const isSelected = selectedNodeId === node.id;
        const isHovered = hoveredNodeId === node.id;

        acc[node.id] = {
          position: [x, y, z],
          color: getNodeColor(node.type, node.tension, isSelected, isHovered),
          scale: 1 + node.tension * 0.5 + (isSelected ? 0.3 : 0),
          emissiveIntensity: isHovered ? 0.8 : node.tension * 0.5,
        };
        return acc;
      },
      {} as Record<string, Node3DProps>
    );
  }, [topology.nodes, selectedNodeId, hoveredNodeId]);

  const edgeProps = useMemo(() => {
    return topology.edges
      .map((edge) => {
        const sourceProps = nodeProps[edge.source];
        const targetProps = nodeProps[edge.target];

        if (!sourceProps || !targetProps) {
          return null;
        }

        return {
          id: edge.id,
          start: sourceProps.position,
          end: targetProps.position,
          thickness: 0.05 + edge.queueDensity * 0.2,
          opacity: 0.3 + edge.queueDensity * 0.7,
          flowSpeed: edge.queueDensity * 2,
        };
      })
      .filter(Boolean) as (Edge3DProps & { id: string })[];
  }, [topology.edges, nodeProps]);

  return {
    nodeProps,
    edgeProps,
    selectedNodeId,
    setSelectedNodeId,
    hoveredNodeId,
    setHoveredNodeId,
  };
}

function getNodeColor(
  type: MembraneNode['type'],
  tension: number,
  isSelected: boolean,
  isHovered: boolean
): string {
  if (isSelected) return '#ffffff';
  if (isHovered) return '#ffff00';

  const baseColors = {
    actor: [0, 150, 255], // Blueish
    system: [150, 0, 255], // Purpleish
    gateway: [0, 255, 150], // Greenish
  };

  const [r, g, b] = baseColors[type];
  // Increase red component with tension
  const finalR = Math.min(255, r + tension * 200);
  return `rgb(${finalR}, ${g}, ${b})`;
}
