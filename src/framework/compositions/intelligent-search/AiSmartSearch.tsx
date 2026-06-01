import React, { useEffect } from 'react';
import { View, Text } from 'react-native';
import { useIntelligentSearch } from './useIntelligentSearch';
import { AiSmartSearchProps } from './types';

/**
 * AiSmartSearch
 *
 * A high-level composition component that provides "Intelligent Search" capabilities.
 * It uses local AI to expand queries and searches the neuro-symbolic graph.
 *
 * @example
 * ```tsx
 * <AiSmartSearch
 *   query={searchTerm}
 *   onResults={(results) => console.log(results)}
 * />
 * ```
 */
export const AiSmartSearch: React.FC<AiSmartSearchProps> = ({
  query,
  options = {},
  onResults,
  onError,
  children,
}) => {
  const state = useIntelligentSearch(query, options);

  useEffect(() => {
    if (state.results && onResults) {
      onResults(state.results);
    }
  }, [state.results, onResults]);

  useEffect(() => {
    if (state.error && onError) {
      onError(state.error);
    }
  }, [state.error, onError]);

  if (children) {
    return <>{children(state)}</>;
  }

  // Default minimalist UI if no children provided
  return (
    <View>
      {state.isLoading && <Text>Thinking...</Text>}
      {state.error && <Text style={{ color: 'red' }}>{state.error.message}</Text>}
      {state.expandedQuery && (
        <View>
          <Text style={{ fontSize: 12, color: '#666' }}>
            Searching for: <Text style={{ fontStyle: 'italic' }}>{state.expandedQuery}</Text>
          </Text>
        </View>
      )}
      <View>
        {state.results.map((res, index) => (
          <Text key={index}>
            {res.quad.subject.value} - {res.quad.predicate.value} - {res.quad.object.value}
            (Score: {res.score.toFixed(2)})
          </Text>
        ))}
      </View>
    </View>
  );
};
