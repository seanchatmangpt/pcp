/**
 * Represents a node in the Membrane topology.
 */
export interface MembraneNode {
  id: string;
  type: 'actor' | 'system' | 'gateway';
  label: string;
  tension: number; // 0 to 1
  metadata?: Record<string, any>;
}

/**
 * Represents a connection between Membrane nodes.
 */
export interface MembraneEdge {
  id: string;
  source: string;
  target: string;
  queueDensity: number; // 0 to 1
  latency?: number;
}

/**
 * The full topology state.
 */
export interface MembraneTopology {
  nodes: MembraneNode[];
  edges: MembraneEdge[];
}

/**
 * Renderable 3D properties for a node.
 */
export interface Node3DProps {
  position: [number, number, number];
  color: string;
  scale: number;
  emissiveIntensity: number;
}

/**
 * Renderable 3D properties for an edge.
 */
export interface Edge3DProps {
  start: [number, number, number];
  end: [number, number, number];
  thickness: number;
  opacity: number;
  flowSpeed: number;
}
