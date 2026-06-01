import { Term, Quad } from '../../vkg/rdf';

/**
 * Symbolic constraints for exact RDF graph matching.
 */
export interface SymbolicConstraint {
  subject?: Term | string;
  predicate?: Term | string;
  object?: Term | string;
  graph?: Term | string;
}

/**
 * Neuro constraints for fuzzy semantic embedding search.
 */
export interface NeuroConstraint {
  /**
   * Natural language prompt to perform a semantic search against.
   */
  prompt?: string;
  /**
   * Optional pre-computed vector embedding.
   */
  vector?: number[];
  /**
   * Similarity threshold (0.0 to 1.0). Defaults to 0.7.
   */
  threshold?: number;
  /**
   * Maximum number of fuzzy matches to return.
   */
  limit?: number;
}

/**
 * A unified Neuro-Symbolic query structure.
 */
export interface NeuroSymbolicQuery {
  /**
   * Exact graph pattern to match.
   */
  symbolic: SymbolicConstraint;
  /**
   * Optional fuzzy semantic constraints.
   */
  neuro?: NeuroConstraint;
}

/**
 * Result of a Neuro-Symbolic query.
 */
export interface NeuroSymbolicResult {
  /**
   * The matched RDF Quad.
   */
  quad: Quad;
  /**
   * Confidence score (1.0 = exact symbolic match, <1.0 = fuzzy match).
   */
  score: number;
}

/**
 * State of the Neuro-Symbolic query hook.
 */
export interface NeuroSymbolicQueryState {
  data: NeuroSymbolicResult[];
  loading: boolean;
  error: Error | null;
  /**
   * Re-run the query.
   */
  refetch: () => Promise<void>;
}
