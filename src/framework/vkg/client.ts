import { VirtualKnowledgeGraphClient, VKGRdfSyncEngine } from '@/src/lib/vkg/client';
import { Quad, Term } from '@/src/lib/vkg/rdf';

export interface IVKGClient {
  match(subject?: Term, predicate?: Term, object?: Term, graph?: Term): Promise<Quad[]>;
  addQuads(quads: Quad[]): Promise<void>;
  removeQuads(quads: Quad[]): Promise<void>;
  jsonLdToQuads(doc: any, defaultGraph?: Term): Quad[];
  quadsToJsonLd(quadsList: Quad[]): any[];
  getSyncEngine(): any;
  addJsonLd(doc: any): Promise<void>;
}

/**
 * High-level facade for Virtual Knowledge Graph Client.
 * Provides abstract interface and DX enhancements over the base client.
 */
export class VKGClientFacade implements IVKGClient {
  constructor(
    private readonly client: VirtualKnowledgeGraphClient = new VirtualKnowledgeGraphClient()
  ) {}

  async match(subject?: Term, predicate?: Term, object?: Term, graph?: Term): Promise<Quad[]> {
    return this.client.match(subject, predicate, object, graph);
  }

  async addQuads(quads: Quad[]): Promise<void> {
    return this.client.addQuads(quads);
  }

  async removeQuads(quads: Quad[]): Promise<void> {
    return this.client.removeQuads(quads);
  }

  jsonLdToQuads(doc: any, defaultGraph?: Term): Quad[] {
    return this.client.jsonLdToQuads(doc, defaultGraph);
  }

  quadsToJsonLd(quadsList: Quad[]): any[] {
    return this.client.quadsToJsonLd(quadsList);
  }

  getSyncEngine(): any {
    return this.client.getSyncEngine();
  }

  /**
   * DX Utility: Syntactic sugar to instantly parse and add a JSON-LD document.
   */
  async addJsonLd(doc: any): Promise<void> {
    const quads = this.jsonLdToQuads(doc);
    await this.addQuads(quads);
  }
}

export { VirtualKnowledgeGraphClient, VKGRdfSyncEngine };
