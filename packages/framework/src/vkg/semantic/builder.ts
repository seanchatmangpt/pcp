import { IVKGClient } from '../client';
import { Term, DataFactory, Quad } from '../rdf';
import { QueryTerm, TriplePattern, QueryResult, Variable, SemanticProperty, NS } from './types';

/**
 * Fluent API for building complex RDF graph queries.
 * Supports triple pattern matching, variables, and joins.
 */
export class SemanticQueryBuilder {
  private patterns: TriplePattern[] = [];
  private selectedVariables: string[] = [];

  constructor(private readonly client: IVKGClient) {}

  /**
   * Adds a triple pattern to the query.
   */
  where(subject: QueryTerm, predicate: QueryTerm, object: QueryTerm): this {
    this.patterns.push({ subject, predicate, object });
    return this;
  }

  /**
   * Alias for where() for more natural-sounding queries.
   */
  match(subject: QueryTerm, predicate: QueryTerm, object: QueryTerm): this {
    return this.where(subject, predicate, object);
  }

  /**
   * Defines the variables to be returned in the result set.
   * If not called, all variables used in patterns will be returned.
   */
  select(...variables: Variable[]): this {
    this.selectedVariables = variables.map((v) => (v.startsWith('?') ? v.substring(1) : v));
    return this;
  }

  /**
   * Resolves a QueryTerm to an RDF Term or identifies it as a variable.
   */
  private resolveTerm(term: QueryTerm): { term?: Term; variable?: string } {
    if (typeof term === 'string') {
      if (term.startsWith('?')) {
        return { variable: term.substring(1) };
      }

      // Handle known namespaces
      for (const [prefix, uri] of Object.entries(NS)) {
        if (term.startsWith(`${prefix}:`)) {
          return { term: DataFactory.namedNode(term.replace(`${prefix}:`, uri)) };
        }
      }

      // Default to named node if it looks like a URI, otherwise literal
      if (term.includes(':') && !term.includes(' ')) {
        return { term: DataFactory.namedNode(term) };
      }
      return { term: DataFactory.literal(term) };
    }
    return { term };
  }

  /**
   * Executes the query by performing nested loop joins over the triple patterns.
   * Note: This is a basic implementation for prototyping.
   */
  async execute(): Promise<QueryResult[]> {
    let results: QueryResult[] = [{}];

    for (const pattern of this.patterns) {
      const nextResults: QueryResult[] = [];

      for (const result of results) {
        // Resolve pattern with current variable bindings
        const s = this.resolveWithBinding(pattern.subject, result);
        const p = this.resolveWithBinding(pattern.predicate, result);
        const o = this.resolveWithBinding(pattern.object, result);

        // Fetch matching quads
        const quads = await this.client.match(s.term, p.term, o.term);

        for (const quad of quads) {
          const newBinding = { ...result };
          let possible = true;

          // Try to bind variables
          if (s.variable) {
            if (newBinding[s.variable] && !newBinding[s.variable].equals(quad.subject)) {
              possible = false;
            } else {
              newBinding[s.variable] = quad.subject;
            }
          }

          if (p.variable && possible) {
            if (newBinding[p.variable] && !newBinding[p.variable].equals(quad.predicate)) {
              possible = false;
            } else {
              newBinding[p.variable] = quad.predicate;
            }
          }

          if (o.variable && possible) {
            if (newBinding[o.variable] && !newBinding[o.variable].equals(quad.object)) {
              possible = false;
            } else {
              newBinding[o.variable] = quad.object;
            }
          }

          if (possible) {
            nextResults.push(newBinding);
          }
        }
      }

      results = nextResults;
      if (results.length === 0) break;
    }

    // Filter by selected variables if any
    if (this.selectedVariables.length > 0) {
      return results.map((res) => {
        const filtered: QueryResult = {};
        for (const v of this.selectedVariables) {
          if (res[v]) filtered[v] = res[v];
        }
        return filtered;
      });
    }

    return results;
  }

  private resolveWithBinding(
    qTerm: QueryTerm,
    binding: QueryResult
  ): { term?: Term; variable?: string } {
    const resolved = this.resolveTerm(qTerm);
    if (resolved.variable && binding[resolved.variable]) {
      return { term: binding[resolved.variable] };
    }
    return resolved;
  }
}

/**
 * Factory function to create a new SemanticQueryBuilder.
 */
export function semanticQuery(client: IVKGClient): SemanticQueryBuilder {
  return new SemanticQueryBuilder(client);
}
