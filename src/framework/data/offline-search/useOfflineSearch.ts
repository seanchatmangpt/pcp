/**
 * @fileoverview Hook for performing sub-millisecond offline full-text searches.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { SearchEngine } from './SearchEngine';
import { SearchOptions, SearchResult, UseOfflineSearchReturn } from './types';

/**
 * useOfflineSearch
 *
 * A high-performance hook for local-first fuzzy searching over synced graph data.
 * Wraps SQLite FTS5 to provide sub-millisecond response times.
 *
 * @param initialQuery Initial search term
 * @param options Search configuration options (limit, predicate filter, etc.)
 * @returns {UseOfflineSearchReturn} Search state and control functions
 *
 * @example
 * const { results, loading, search } = useOfflineSearch();
 * ...
 * <TextInput onChangeText={search} placeholder="Search anything..." />
 */
export function useOfflineSearch(
  initialQuery: string = '',
  options: SearchOptions = {}
): UseOfflineSearchReturn {
  const [query, setQuery] = useState(initialQuery);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  // Use a ref for options to avoid unnecessary re-runs if options object is literal
  const optionsRef = useRef(options);
  useEffect(() => {
    optionsRef.current = options;
  }, [options]);

  /**
   * Execute search against the FTS5 engine
   */
  const executeSearch = useCallback(async (searchTerm: string) => {
    const trimmed = searchTerm.trim();
    setQuery(searchTerm);

    if (!trimmed) {
      setResults([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const searchResults = await SearchEngine.search(trimmed, optionsRef.current);
      setResults(searchResults);
    } catch (err: any) {
      setError(err instanceof Error ? err : new Error(String(err)));
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial search if query is provided
  useEffect(() => {
    if (initialQuery) {
      executeSearch(initialQuery);
    }
  }, [initialQuery, executeSearch]);

  return {
    results,
    loading,
    error,
    search: executeSearch,
    query,
  };
}
