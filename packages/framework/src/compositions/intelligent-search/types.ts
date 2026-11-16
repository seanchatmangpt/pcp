import { NeuroSymbolicResult } from '../../data/neuro-symbolic/types';

export interface IntelligentSearchOptions {
  /**
   * Similarity threshold for fuzzy matches (0.0 to 1.0).
   */
  threshold?: number;
  /**
   * Maximum number of results to return.
   */
  limit?: number;
  /**
   * Whether to use AI query expansion. Defaults to true.
   */
  useAiExpansion?: boolean;
}

export interface IntelligentSearchState {
  /**
   * Search results from the neuro-symbolic graph.
   */
  results: NeuroSymbolicResult[];
  /**
   * Whether search or inference is in progress.
   */
  isLoading: boolean;
  /**
   * Error from inference or search.
   */
  error: Error | null;
  /**
   * The expanded query string if AI expansion was used.
   */
  expandedQuery?: string;
}

export interface AiSmartSearchProps {
  /**
   * The search query from the user.
   */
  query: string;
  /**
   * Search configuration.
   */
  options?: IntelligentSearchOptions;
  /**
   * Callback when results are found.
   */
  onResults?: (results: NeuroSymbolicResult[]) => void;
  /**
   * Callback when an error occurs.
   */
  onError?: (error: Error) => void;
  /**
   * Optional custom component to render results.
   */
  children?: (state: IntelligentSearchState) => React.ReactNode;
}
