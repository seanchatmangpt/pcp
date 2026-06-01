import { Quad, Term, DataFactory } from './rdf';
import { IVKGClient } from './client';

/**
 * Advanced RDF querying utility.
 * Provides a fluent interface for building graph patterns and traversals.
 */
export class RdfQueryBuilder {
  private _subject?: Term;
  private _predicate?: Term;
  private _object?: Term;
  private _graph?: Term;

  constructor(private readonly client: IVKGClient) {}

  /**
   * Sets the subject for the query.
   */
  subject(s: Term | string): this {
    this._subject = typeof s === 'string' ? DataFactory.namedNode(s) : s;
    return this;
  }

  /**
   * Sets the predicate for the query.
   */
  predicate(p: Term | string): this {
    this._predicate = typeof p === 'string' ? DataFactory.namedNode(p) : p;
    return this;
  }

  /**
   * Sets the object for the query.
   */
  object(o: Term | string): this {
    if (typeof o === 'string') {
      this._object =
        o.startsWith('http://') ||
        o.startsWith('https://') ||
        o.startsWith('urn:') ||
        o.startsWith('_:')
          ? o.startsWith('_:')
            ? DataFactory.blankNode(o)
            : DataFactory.namedNode(o)
          : DataFactory.literal(o);
    } else {
      this._object = o;
    }
    return this;
  }

  /**
   * Sets the graph for the query.
   */
  graph(g: Term | string): this {
    this._graph = typeof g === 'string' ? DataFactory.namedNode(g) : g;
    return this;
  }

  /**
   * Executes the query and returns matching quads.
   */
  async execute(): Promise<Quad[]> {
    return this.client.match(this._subject, this._predicate, this._object, this._graph);
  }

  /**
   * Traverse a specific relation from a given subject and return the resulting object terms.
   * Resets the current builder state for subject and predicate.
   */
  async traverse(subject: Term | string, predicate: Term | string): Promise<Term[]> {
    this.subject(subject).predicate(predicate);
    const quads = await this.execute();
    return quads.map((q) => q.object);
  }
}
