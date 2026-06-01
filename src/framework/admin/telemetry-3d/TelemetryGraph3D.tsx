import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Dimensions } from 'react-native';
import Animated, { useAnimatedStyle, withSpring, withTiming } from 'react-native-reanimated';
import { useTelemetryState } from './hooks';
import { MembraneTopology } from './types';

export interface TelemetryGraph3DProps {
  topology: MembraneTopology;
  onNodeClick?: (nodeId: string) => void;
  testID?: string;
}

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const CANVAS_SIZE = Math.min(SCREEN_WIDTH, SCREEN_HEIGHT) * 0.8;

/**
 * Experimental 3D-like visualization for Membrane topology.
 * Mocks the 3D renderer using Reanimated and React Native primitives.
 */
export const TelemetryGraph3D: React.FC<TelemetryGraph3DProps> = ({
  topology,
  onNodeClick,
  testID = 'telemetry-graph-3d',
}) => {
  const { nodeProps, edgeProps, selectedNodeId, setSelectedNodeId, setHoveredNodeId } =
    useTelemetryState(topology);

  const handleNodeClick = (id: string) => {
    setSelectedNodeId(id);
    onNodeClick?.(id);
  };

  return (
    <View style={styles.container} testID={testID}>
      {/* 3D Scene Mock */}
      <View style={styles.scene}>
        {/* Edges */}
        {edgeProps.map((edge) => {
          const dx = (edge.end[0] - edge.start[0]) * (CANVAS_SIZE / 10);
          const dy = (edge.end[1] - edge.start[1]) * (CANVAS_SIZE / 10);
          const length = Math.sqrt(dx * dx + dy * dy);
          const angle = Math.atan2(dy, dx);

          return (
            <View
              key={edge.id}
              style={[
                styles.edge,
                {
                  width: length,
                  height: edge.thickness * 10,
                  opacity: edge.opacity,
                  left: edge.start[0] * (CANVAS_SIZE / 10) + CANVAS_SIZE / 2,
                  top: edge.start[1] * (CANVAS_SIZE / 10) + CANVAS_SIZE / 2,
                  transform: [{ rotate: `${angle}rad` }],
                },
              ]}
            />
          );
        })}

        {/* Nodes */}
        {topology.nodes.map((node) => {
          const props = nodeProps[node.id];
          if (!props) return null;

          const isSelected = selectedNodeId === node.id;

          return (
            <Node3D
              key={node.id}
              id={node.id}
              label={node.label}
              position={props.position}
              color={props.color}
              scale={props.scale}
              isSelected={isSelected}
              onPress={() => handleNodeClick(node.id)}
              onHoverIn={() => setHoveredNodeId(node.id)}
              onHoverOut={() => setHoveredNodeId(null)}
            />
          );
        })}
      </View>

      {/* Stats Overlay */}
      <View style={styles.overlay}>
        <Text style={styles.overlayTitle}>Membrane Topology DX</Text>
        <View style={styles.statsRow}>
          <Text style={styles.statLabel}>
            Nodes: <Text style={styles.statValue}>{topology.nodes.length}</Text>
          </Text>
        </View>
        <View style={styles.statsRow}>
          <Text style={styles.statLabel}>
            Edges: <Text style={styles.statValue}>{topology.edges.length}</Text>
          </Text>
        </View>
        <View style={styles.statsRow}>
          <Text style={styles.statLabel}>
            Selected:{' '}
            <Text style={styles.statValue} numberOfLines={1}>
              {selectedNodeId || 'None'}
            </Text>
          </Text>
        </View>
      </View>

      <Text style={styles.watermark}>Experimental 3D Visualization Engine</Text>
    </View>
  );
};

interface Node3DComponentProps {
  id: string;
  label: string;
  position: [number, number, number];
  color: string;
  scale: number;
  isSelected: boolean;
  onPress: () => void;
  onHoverIn: () => void;
  onHoverOut: () => void;
}

const Node3D: React.FC<Node3DComponentProps> = ({
  label,
  position,
  color,
  scale,
  isSelected,
  onPress,
}) => {
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: withSpring(position[0] * (CANVAS_SIZE / 10)) },
      { translateY: withSpring(position[1] * (CANVAS_SIZE / 10)) },
      { scale: withSpring(scale) },
    ],
    backgroundColor: color,
    borderColor: isSelected ? '#FFFFFF' : 'transparent',
    borderWidth: isSelected ? 2 : 0,
    shadowOpacity: withTiming(isSelected ? 0.8 : 0.3),
  }));

  return (
    <Animated.View style={[styles.nodeContainer, animatedStyle]}>
      <TouchableOpacity style={styles.nodeTouch} onPress={onPress} activeOpacity={0.7}>
        <Text style={styles.nodeLabel} numberOfLines={1}>
          {label}
        </Text>
      </TouchableOpacity>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
    height: 400,
    backgroundColor: '#0F172A',
    borderRadius: 16,
    overflow: 'hidden',
    position: 'relative',
    justifyContent: 'center',
    alignItems: 'center',
  },
  scene: {
    width: CANVAS_SIZE,
    height: CANVAS_SIZE,
    position: 'relative',
  },
  nodeContainer: {
    position: 'absolute',
    width: 40,
    height: 40,
    borderRadius: 20,
    left: CANVAS_SIZE / 2 - 20,
    top: CANVAS_SIZE / 2 - 20,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#3B82F6',
    shadowOffset: { width: 0, height: 0 },
    shadowRadius: 10,
    elevation: 5,
  },
  nodeTouch: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  nodeLabel: {
    color: '#FFFFFF',
    fontSize: 8,
    fontWeight: 'bold',
    textAlign: 'center',
    position: 'absolute',
    bottom: -15,
    width: 60,
  },
  edge: {
    position: 'absolute',
    backgroundColor: '#22D3EE',
    transformOrigin: 'left center',
  },
  overlay: {
    position: 'absolute',
    top: 16,
    left: 16,
    padding: 12,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(34, 211, 238, 0.3)',
  },
  overlayTitle: {
    color: '#F8FAFC',
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  statsRow: {
    flexDirection: 'row',
    marginBottom: 2,
  },
  statLabel: {
    color: '#94A3B8',
    fontSize: 10,
  },
  statValue: {
    color: '#22D3EE',
    fontSize: 10,
    fontWeight: 'bold',
    flex: 1,
  },
  watermark: {
    position: 'absolute',
    bottom: 12,
    right: 12,
    color: 'rgba(34, 211, 238, 0.3)',
    fontSize: 8,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
});
