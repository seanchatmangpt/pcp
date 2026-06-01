/**
 * @fileoverview Types for Offline Full-Text Search
 */

export interface SearchResult {
  /**
   * The subject URI (entity identifier)
   */
  subject: string;
  /**
   * The predicate URI that matched
   */
  predicate: string;
  /**
   * The literal value that matched the search query
   */
  objectValue: string;
  /**
   * The search rank (lower is better for BM25)
   */
  rank: number;
  /**
   * Optional snippet of the match (if supported by the engine)
   */
  snippet?: string;
}

export interface SearchOptions {
  /**
   * Maximum number of results to return
   * @default 20
   */
  limit?: number;
  /**
   * Filter by predicate URI
   */
  predicate?: string;
  /**
   * Filter by graph URI
   */
  graph?: string;
}

export interface UseOfflineSearchReturn {
  /**
   * The search results
   */
  results: SearchResult[];
  /**
   * Whether the search is currently executing
   */
  loading: boolean;
  /**
   * Any error that occurred during search
   */
  error: Error | null;
  /**
   * Function to manually trigger a search
   */
  search: (query: string) => Promise<void>;
  /**
   * The current search query
   */
  query: string;
}
