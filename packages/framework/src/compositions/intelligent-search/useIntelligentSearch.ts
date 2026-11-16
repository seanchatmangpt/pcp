import { useState, useEffect, useCallback, useMemo } from 'react';
import { useLocalInference } from '../../ai/on-device/useLocalInference';
import { useNeuroSymbolicQuery } from '../../data/neuro-symbolic/useNeuroSymbolicQuery';
import { IntelligentSearchOptions, IntelligentSearchState } from './types';
import { VKGClientFacade } from '../../vkg/client';

const vkgClient = new VKGClientFacade(); // In a real app, this might come from context

/**
 * useIntelligentSearch
 *
 * Orchestrates AI query expansion and Neuro-Symbolic graph search.
 * 1. Takes user input query.
 * 2. (Optional) Expands query using local on-device inference.
 * 3. Performs neuro-symbolic search using the expanded (or original) query.
 */
export function useIntelligentSearch(
  query: string,
  options: IntelligentSearchOptions = {}
): IntelligentSearchState {
  const { threshold = 0.7, limit = 10, useAiExpansion = true } = options;

  const [activeQuery, setActiveQuery] = useState(query);
  const [isExpanding, setIsExpanding] = useState(false);
  const [aiError, setAiError] = useState<Error | null>(null);

  const { runInference } = useLocalInference({
    modelId: 'phi-2-orange',
    temperature: 0.3,
    maxTokens: 50,
  });

  // Expand query if AI expansion is enabled
  useEffect(() => {
    let isMounted = true;

    async function expand() {
      if (!useAiExpansion || !query.trim()) {
        setActiveQuery(query);
        return;
      }

      setIsExpanding(true);
      setAiError(null);

      try {
        const prompt = `Expand this search query for a semantic knowledge graph: "${query}". 
        Provide only the expanded query terms, no conversation.`;

        const result = await runInference({ prompt });

        if (isMounted && result?.text) {
          // Use expanded text if available, otherwise fallback to original
          setActiveQuery(result.text.trim() || query);
        }
      } catch (err) {
        if (isMounted) {
          setAiError(
            err instanceof Error
              ? err
              : new Error(typeof err === 'string' ? err : 'AI Expansion failed')
          );
          setActiveQuery(query); // Fallback to original query
        }
      } finally {
        if (isMounted) {
          setIsExpanding(false);
        }
      }
    }

    expand();

    return () => {
      isMounted = false;
    };
  }, [query, useAiExpansion, runInference]);

  // Perform Neuro-Symbolic Search
  const nsQuery = useMemo(
    () => ({
      symbolic: {}, // Open match for symbols, refined by neuro
      neuro: {
        prompt: activeQuery,
        threshold,
        limit,
      },
    }),
    [activeQuery, threshold, limit]
  );

  const {
    data: results,
    loading: isSearching,
    error: searchError,
  } = useNeuroSymbolicQuery(vkgClient, nsQuery);

  return {
    results,
    isLoading: isExpanding || isSearching,
    error: aiError || searchError,
    expandedQuery: activeQuery !== query ? activeQuery : undefined,
  };
}
