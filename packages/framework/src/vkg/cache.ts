import { Term, Quad } from './rdf';

/**
 * Semantic Node Caching Utility
 * Provides map-based caching for RDF nodes and their associated quads with TTL.
 */
export class SemanticNodeCache {
  private cache = new Map<string, { quads: Quad[]; timestamp: number }>();
  private readonly ttlMs: number;

  constructor(ttlMs: number = 60000) {
    this.ttlMs = ttlMs;
  }

  /**
   * Generates a cache key for a given semantic node.
   */
  private generateKey(nodeUri: string | Term): string {
    return typeof nodeUri === 'string' ? nodeUri : nodeUri.value;
  }

  /**
   * Stores quads for a specific semantic node.
   */
  set(nodeUri: string | Term, quads: Quad[]): void {
    const key = this.generateKey(nodeUri);
    this.cache.set(key, { quads, timestamp: Date.now() });
  }

  /**
   * Retrieves quads for a specific semantic node if they exist and are not expired.
   */
  get(nodeUri: string | Term): Quad[] | null {
    const key = this.generateKey(nodeUri);
    const entry = this.cache.get(key);

    if (!entry) return null;

    if (Date.now() - entry.timestamp > this.ttlMs) {
      this.cache.delete(key);
      return null;
    }

    return entry.quads;
  }

  /**
   * Clears the entire cache or a specific node.
   */
  invalidate(nodeUri?: string | Term): void {
    if (nodeUri) {
      this.cache.delete(this.generateKey(nodeUri));
    } else {
      this.cache.clear();
    }
  }
}
