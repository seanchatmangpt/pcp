import { Term, Variable, Quad } from '../rdf';

/**
 * A pattern that can match an RDF Quad.
 * Subjects, predicates, and objects can be fixed Terms or Variables.
 */
export interface TriplePattern {
  subject: Term | Variable;
  predicate: Term | Variable;
  object: Term | Variable;
  graph?: Term | Variable;
}

/**
 * A substitution maps variable names to RDF Terms.
 */
export type Substitution = Record<string, Term>;

/**
 * An inference rule consisting of a body (antecedents) and a head (consequent).
 * If the body can be satisfied by a set of quads with a specific substitution,
 * the head is inferred with that same substitution.
 */
export interface InferenceRule {
  name: string;
  body: TriplePattern[];
  head: TriplePattern;
}

/**
 * Result of the inference process.
 */
export interface InferenceResult {
  inferredQuads: Quad[];
  iterations: number;
  ruleStats: Record<string, number>;
}
