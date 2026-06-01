/**
 * @fileoverview Type definitions for the Virtual Knowledge Graph (VKG) abstraction layer.
 * Defines Schema.org JSON-LD nodes, graph edges, and query options.
 */

/**
 * A standardized GraphNode representing a Schema.org or general JSON-LD semantic object.
 */
export interface GraphNode {
  /** The unique IRI/URI identification of the resource (corresponds to Schema.org `@id`) */
  '@id': string;
  /** The ontology class URI (corresponds to Schema.org `@type`, e.g., 'https://schema.org/Person') */
  '@type': string;
  /** Additional Schema.org properties or relationship references */
  [property: string]: any;
}

/**
 * A directed relation between two GraphNodes.
 */
export interface GraphEdge {
  /** The @id of the source node (Subject) */
  sourceId: string;
  /** The relationship predicate URI (Predicate, e.g., 'https://schema.org/sender') */
  predicate: string;
  /** The @id of the target node (Object) */
  targetId: string;
}

/**
 * Options for querying connected nodes in the virtual graph.
 */
export interface TraversalOptions {
  /** Limit the number of traversed results */
  limit?: number;
  /** Offset for pagination of results */
  offset?: number;
  /** Filter target nodes by a specific Schema.org type */
  targetType?: string;
}
