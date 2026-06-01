import React, { useState, useCallback } from 'react';
import { View, Text } from 'react-native';

export type RdfNode = {
  id: string;
  type: string;
  properties: Record<string, any>;
};

export type ParadoxicalState = RdfNode[];

export const generateParadoxicalState = (): ParadoxicalState => {
  const alpha: RdfNode = {
    id: 'node:alpha',
    type: 'schema:Person',
    properties: {
      'schema:spouse': 'node:beta',
    },
  };

  // Create actual circular reference for UI to crash on if naive
  alpha.properties['schema:parent'] = alpha;

  const beta: RdfNode = {
    id: 'node:beta',
    type: 'schema:Event',
    properties: {
      'schema:attendee': null,
      'schema:location': 'node:alpha',
    },
  };
  beta.properties['schema:attendee'] = beta;

  return [alpha, beta];
};

export const useSemanticFuzzer = () => {
  const [fuzzedState, setFuzzedState] = useState<ParadoxicalState | null>(null);
  const [isFuzzing, setIsFuzzing] = useState(false);

  const triggerFuzz = useCallback(() => {
    setIsFuzzing(true);
    try {
      const newState = generateParadoxicalState();
      setFuzzedState(newState);
    } finally {
      setIsFuzzing(false);
    }
  }, []);

  const resolveGracefully = useCallback((nodeId: string) => {
    setFuzzedState((prev) => {
      if (!prev) return prev;
      return prev.map((node) => {
        if (node.id === nodeId) {
          const newProps = { ...node.properties };
          // Remove properties that point to self to resolve circularity paradox
          for (const key in newProps) {
            if (newProps[key] === node) {
              delete newProps[key];
            }
          }
          return { ...node, properties: newProps };
        }
        return node;
      });
    });
  }, []);

  return { fuzzedState, isFuzzing, triggerFuzz, resolveGracefully };
};

// Helper to safely stringify potentially circular structures
export const safeStringify = (obj: any) => {
  const seen = new WeakSet();
  return JSON.stringify(obj, (key, value) => {
    if (typeof value === 'object' && value !== null) {
      if (seen.has(value)) {
        return `[Circular Reference to ${value.id || 'Unknown'}]`;
      }
      seen.add(value);
    }
    return value;
  });
};

export const GenerativeUI: React.FC<{ state: ParadoxicalState | null }> = ({ state }) => {
  if (!state)
    return (
      <View testID="empty-ui">
        <Text>No state</Text>
      </View>
    );

  return (
    <View testID="generative-ui">
      {state.map((node) => {
        let stringifiedProps = '';
        try {
          stringifiedProps = safeStringify(node.properties);
        } catch (e) {
          stringifiedProps = 'CIRCULAR_REFERENCE_ERROR';
        }

        return (
          <View key={node.id} testID={`node-${node.id}`}>
            <Text>{node.type}</Text>
            <Text>{stringifiedProps}</Text>
          </View>
        );
      })}
    </View>
  );
};
