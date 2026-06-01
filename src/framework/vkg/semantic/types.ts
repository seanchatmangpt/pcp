import { Term } from '../rdf';

/**
 * Common Semantic Namespaces
 */
export const NS = {
  rdf: 'http://www.w3.org/1999/02/22-rdf-syntax-ns#',
  rdfs: 'http://www.w3.org/2000/01/rdf-schema#',
  xsd: 'http://www.w3.org/2001/XMLSchema#',
  schema: 'https://schema.org/',
  pcp: 'https://pcp.framework/ontology/',
} as const;

/**
 * A selection of common semantic properties for auto-complete.
 */
export type SemanticProperty =
  | 'rdf:type'
  | 'rdfs:label'
  | 'rdfs:comment'
  | 'schema:name'
  | 'schema:description'
  | 'schema:url'
  | 'schema:image'
  | 'schema:identifier'
  | 'schema:author'
  | 'schema:datePublished'
  | 'schema:Event'
  | 'schema:Person'
  | 'schema:Organization'
  | 'schema:CreativeWork'
  | (string & {});

/**
 * Represents a variable in a SPARQL-like query.
 */
export type Variable = `?${string}`;

/**
 * A term that can be used in a semantic query pattern.
 */
export type QueryTerm = Term | string | Variable | SemanticProperty;

/**
 * A triple pattern in a semantic query.
 */
export interface TriplePattern {
  subject: QueryTerm;
  predicate: QueryTerm;
  object: QueryTerm;
}

/**
 * The result of a SELECT query.
 */
export type QueryResult = Record<string, Term>;
