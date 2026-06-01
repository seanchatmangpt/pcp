import { IVKGClient } from '../../vkg/client';
import { Term } from '../../vkg/rdf';
import { NeuroSymbolicQuery, SymbolicConstraint, NeuroConstraint } from './types';

/**
 * Fluent builder for Neuro-Symbolic queries.
 * Provides a clean DX for combining symbolic graph matching and neuro-semantic search.
 */
export class NeuroSymbolicQueryBuilder {
  private _symbolic: SymbolicConstraint = {};
  private _neuro?: NeuroConstraint;

  constructor(private readonly _client: IVKGClient) {}

  /**
   * Sets the symbolic subject for the exact match phase.
   */
  subject(s: Term | string): this {
    this._symbolic.subject = s;
    return this;
  }

  /**
   * Sets the symbolic predicate for the exact match phase.
   */
  predicate(p: Term | string): this {
    this._symbolic.predicate = p;
    return this;
  }

  /**
   * Sets the symbolic object for the exact match phase.
   */
  object(o: Term | string): this {
    this._symbolic.object = o;
    return this;
  }

  /**
   * Sets the symbolic graph for the exact match phase.
   */
  graph(g: Term | string): this {
    this._symbolic.graph = g;
    return this;
  }

  /**
   * Adds neuro-semantic constraints to the query.
   * If a string is provided, it is treated as the semantic search prompt.
   */
  neuro(constraints: NeuroConstraint | string): this {
    if (typeof constraints === 'string') {
      this._neuro = { ...this._neuro, prompt: constraints };
    } else {
      this._neuro = { ...this._neuro, ...constraints };
    }
    return this;
  }

  /**
   * Returns the constructed NeuroSymbolicQuery object.
   */
  build(): NeuroSymbolicQuery {
    return {
      symbolic: { ...this._symbolic },
      neuro: this._neuro ? { ...this._neuro } : undefined,
    };
  }

  /**
   * Getter for the client instance.
   */
  get client(): IVKGClient {
    return this._client;
  }
}

/**
 * DX Factory: Initialize a new Neuro-Symbolic Query Builder.
 *
 * @param client The VKG client instance.
 * @returns A new NeuroSymbolicQueryBuilder instance.
 */
export function neuroSymbolicQuery(client: IVKGClient): NeuroSymbolicQueryBuilder {
  return new NeuroSymbolicQueryBuilder(client);
}
