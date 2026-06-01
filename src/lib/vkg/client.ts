/**
 * @fileoverview Virtual Knowledge Graph (VKG) Client implementation.
 * Provides RDF.js compliant Graph operations (match, addQuads, removeQuads)
 * and JSON-LD serialization/deserialization helpers.
 */

import { db } from '../db/db';
import { quads } from '../db/schema';
import { eq, and, SQL } from 'drizzle-orm';
import { Term, NamedNode, BlankNode, Literal, DefaultGraph, Quad, DataFactory } from './rdf';
// mock supabase
const supabase: any = {};
type SyncEngine = any;
// mock sync

/**
 * Concrete SyncEngine subclass for RDF Quads synchronization.
 * Synchronizes assertions (quad inserts and deletes) to Supabase.
 */
export class VKGRdfSyncEngine implements SyncEngine {
  protected supportedJobTypes = ['RDF_ADD_QUAD', 'RDF_REMOVE_QUAD'];

  protected async dispatchJob(job: { jobType: string; payload: string; entityId: string | null }): Promise<void> {
    const rawQuad = JSON.parse(job.payload);

    if (job.jobType === 'RDF_ADD_QUAD') {
      const { error } = await supabase
        .from('rdf_quads_ld')
        .upsert({
          subject: rawQuad.subject.value,
          subject_term_type: rawQuad.subject.termType,
          predicate: rawQuad.predicate.value,
          object_value: rawQuad.object.value,
          object_term_type: rawQuad.object.termType,
          object_datatype: rawQuad.object.datatype?.value ?? null,
          object_language: rawQuad.object.language ?? null,
          graph: rawQuad.graph.value,
          graph_term_type: rawQuad.graph.termType,
        });

      if (error) {
        throw new Error(`Supabase RDF sync failed for quad: ${error.message}`);
      }
    } else if (job.jobType === 'RDF_REMOVE_QUAD') {
      const { error } = await supabase
        .from('rdf_quads_ld')
        .delete()
        .eq('subject', rawQuad.subject.value)
        .eq('predicate', rawQuad.predicate.value)
        .eq('object_value', rawQuad.object.value)
        .eq('graph', rawQuad.graph.value);

      if (error) {
        throw new Error(`Supabase RDF sync deletion failed: ${error.message}`);
      }
    } else {
      throw new Error(`Unrecognized RDF sync job type: ${job.jobType}`);
    }
  }
}

export class VirtualKnowledgeGraphClient {
  private syncEngine: SyncEngine;

  constructor(syncEngine?: SyncEngine) {
    this.syncEngine = syncEngine ?? new VKGRdfSyncEngine();
  }

  /**
   * Returns the active sync engine instance.
   */
  public getSyncEngine(): SyncEngine {
    return this.syncEngine;
  }

  /**
   * Standard RDF.js Store match implementation.
   * Matches quads in the local SQLite database using optional term filters.
   */
  public async match(
    subject?: Term,
    predicate?: Term,
    object?: Term,
    graph?: Term
  ): Promise<Quad[]> {
    const conditions: SQL[] = [];

    if (subject) {
      conditions.push(eq(quads.subject, subject.value));
      conditions.push(eq(quads.subjectTermType, subject.termType));
    }
    if (predicate) {
      conditions.push(eq(quads.predicate, predicate.value));
    }
    if (object) {
      conditions.push(eq(quads.objectValue, object.value));
      conditions.push(eq(quads.objectTermType, object.termType));
    }
    if (graph) {
      conditions.push(eq(quads.graph, graph.value));
      conditions.push(eq(quads.graphTermType, graph.termType));
    }

    let query = db.select().from(quads);
    if (conditions.length > 0) {
      query = query.where(and(...conditions)) as any;
    }

    const records = await query;
    return records.map((record) => {
      // Reconstruct Terms
      const s = record.subjectTermType === 'NamedNode' 
        ? DataFactory.namedNode(record.subject) 
        : DataFactory.blankNode(record.subject);

      const p = DataFactory.namedNode(record.predicate);

      let o: Term;
      if (record.objectTermType === 'NamedNode') {
        o = DataFactory.namedNode(record.objectValue);
      } else if (record.objectTermType === 'BlankNode') {
        o = DataFactory.blankNode(record.objectValue);
      } else {
        const datatype = record.objectDatatype ? DataFactory.namedNode(record.objectDatatype) : undefined;
        o = DataFactory.literal(record.objectValue, record.objectLanguage || datatype);
      }

      const g = record.graphTermType === 'DefaultGraph'
        ? DataFactory.defaultGraph()
        : record.graphTermType === 'NamedNode'
        ? DataFactory.namedNode(record.graph)
        : DataFactory.blankNode(record.graph);

      return DataFactory.quad(s, p, o, g);
    });
  }

  /**
   * Adds multiple RDF Quads to the local store and queues them for remote synchronization.
   *
   * @param quadsList Array of RDF.js Quads.
   */
  public async addQuads(quadsList: Quad[]): Promise<void> {
    for (const quad of quadsList) {
      // 1. Check duplicate to guarantee idempotency
      const existing = await this.match(quad.subject, quad.predicate, quad.object, quad.graph);
      if (existing.length > 0) {
        continue;
      }

      // 2. Insert locally
      await db.insert(quads).values({
        subject: quad.subject.value,
        subjectTermType: quad.subject.termType,
        predicate: quad.predicate.value,
        objectValue: quad.object.value,
        objectTermType: quad.object.termType,
        objectDatatype: quad.object.termType === 'Literal' ? (quad.object as Literal).datatype.value : null,
        objectLanguage: quad.object.termType === 'Literal' ? (quad.object as Literal).language : null,
        graph: quad.graph.value,
        graphTermType: quad.graph.termType,
      });

      // 3. Queue outbox sync
      await this.syncEngine.queueJob({
        jobType: 'RDF_ADD_QUAD',
        payload: JSON.stringify(quad),
        entityId: quad.subject.value,
      });
    }
  }

  /**
   * Removes matched RDF Quads from the local store and queues deletions for synchronization.
   *
   * @param quadsList Array of RDF.js Quads to remove.
   */
  public async removeQuads(quadsList: Quad[]): Promise<void> {
    for (const quad of quadsList) {
      // Delete locally
      await db.delete(quads).where(
        and(
          eq(quads.subject, quad.subject.value),
          eq(quads.predicate, quad.predicate.value),
          eq(quads.objectValue, quad.object.value),
          eq(quads.graph, quad.graph.value)
        )
      );

      // Queue deletion sync
      await this.syncEngine.queueJob({
        jobType: 'RDF_REMOVE_QUAD',
        payload: JSON.stringify(quad),
        entityId: quad.subject.value,
      });
    }
  }

  /**
   * Recursive utility to convert a standard Schema.org JSON-LD object to a list of RDF.js Quads.
   * Handles nested entities and maps strings, booleans, and numbers to standard RDF terms.
   *
   * @param doc The JSON-LD document.
   * @param defaultGraph The graph term.
   */
  public jsonLdToQuads(doc: any, defaultGraph: Term = DataFactory.defaultGraph()): Quad[] {
    if (!doc || typeof doc !== 'object') {
      return [];
    }

    const quadsList: Quad[] = [];

    // 1. Resolve subject identifier
    const subjectId = doc['@id'] || `_:${Math.random().toString(36).substring(2, 11)}`;
    const subject = subjectId.startsWith('_:')
      ? DataFactory.blankNode(subjectId)
      : DataFactory.namedNode(subjectId);

    // 2. Resolve type assertion if specified
    const typeVal = doc['@type'];
    if (typeVal) {
      const typePredicate = DataFactory.namedNode('http://www.w3.org/1999/02/22-rdf-syntax-ns#type');
      const processType = (t: any) => {
        if (typeof t === 'string') {
          const typeUri = t.startsWith('http') ? t : `https://schema.org/${t}`;
          quadsList.push(DataFactory.quad(subject, typePredicate, DataFactory.namedNode(typeUri), defaultGraph));
        }
      };
      if (Array.isArray(typeVal)) {
        typeVal.forEach(processType);
      } else {
        processType(typeVal);
      }
    }

    // 3. Loop through other keys
    for (const key of Object.keys(doc)) {
      if (key === '@id' || key === '@type' || key === '@context') {
        continue;
      }

      const val = doc[key];
      if (val === undefined || val === null) {
        continue;
      }

      const predicate = DataFactory.namedNode(key.startsWith('http') ? key : `https://schema.org/${key}`);

      const parseValue = (item: any) => {
        if (typeof item === 'object') {
          if (item['@id'] || item['@type'] || Object.keys(item).length > 0) {
            // Nested object - recursively convert
            const nestedQuads = this.jsonLdToQuads(item, defaultGraph);
            quadsList.push(...nestedQuads);

            // Connect parent subject to nested subject
            const nestedId = item['@id'] || nestedQuads[0]?.subject.value;
            if (nestedId) {
              const nestedSubject = nestedId.startsWith('_:')
                ? DataFactory.blankNode(nestedId)
                : DataFactory.namedNode(nestedId);
              quadsList.push(DataFactory.quad(subject, predicate, nestedSubject, defaultGraph));
            }
          }
        } else {
          // Primitive values
          let objTerm: Term;
          if (typeof item === 'string') {
            const isRef =
              item.startsWith('http://') ||
              item.startsWith('https://') ||
              /^[a-zA-Z0-9_-]+:[a-zA-Z0-9_./:#-]+$/.test(item);

            objTerm = isRef ? DataFactory.namedNode(item) : DataFactory.literal(item);
          } else if (typeof item === 'boolean') {
            objTerm = DataFactory.literal(
              item.toString(),
              DataFactory.namedNode('http://www.w3.org/2001/XMLSchema#boolean')
            );
          } else if (typeof item === 'number') {
            const isFloat = item % 1 !== 0;
            const typeUri = isFloat
              ? 'http://www.w3.org/2001/XMLSchema#double'
              : 'http://www.w3.org/2001/XMLSchema#integer';
            objTerm = DataFactory.literal(item.toString(), DataFactory.namedNode(typeUri));
          } else {
            objTerm = DataFactory.literal(String(item));
          }

          quadsList.push(DataFactory.quad(subject, predicate, objTerm, defaultGraph));
        }
      };

      if (Array.isArray(val)) {
        val.forEach(parseValue);
      } else {
        parseValue(val);
      }
    }

    return quadsList;
  }

  /**
   * Reconstructs standard JSON-LD objects from a list of RDF.js Quads.
   * Group nodes by subject, and nests child relations appropriately.
   */
  public quadsToJsonLd(quadsList: Quad[]): any[] {
    const subjectsMap = new Map<string, any>();

    // 1. Group assertions by subject
    for (const quad of quadsList) {
      const sId = quad.subject.value;
      if (!subjectsMap.has(sId)) {
        subjectsMap.set(sId, { '@id': sId });
      }

      const nodeObj = subjectsMap.get(sId);
      const pred = quad.predicate.value;
      const typePredicate = 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type';

      // Check if standard type predicate
      if (pred === typePredicate) {
        if (nodeObj['@type']) {
          if (Array.isArray(nodeObj['@type'])) {
            nodeObj['@type'].push(quad.object.value);
          } else {
            nodeObj['@type'] = [nodeObj['@type'], quad.object.value];
          }
        } else {
          nodeObj['@type'] = quad.object.value;
        }
        continue;
      }

      // Map predicate URL back to a standard schema.org name if applicable
      const propKey = pred.startsWith('https://schema.org/')
        ? pred.replace('https://schema.org/', '')
        : pred;

      let value: any;
      if (quad.object.termType === 'Literal') {
        const lit = quad.object as Literal;
        if (lit.datatype.value === 'http://www.w3.org/2001/XMLSchema#boolean') {
          value = lit.value === 'true';
        } else if (
          lit.datatype.value === 'http://www.w3.org/2001/XMLSchema#integer' ||
          lit.datatype.value === 'http://www.w3.org/2001/XMLSchema#double'
        ) {
          value = Number(lit.value);
        } else {
          value = lit.value;
        }
      } else {
        // NamedNode or BlankNode references
        value = { '@id': quad.object.value };
      }

      if (nodeObj[propKey]) {
        if (Array.isArray(nodeObj[propKey])) {
          nodeObj[propKey].push(value);
        } else {
          nodeObj[propKey] = [nodeObj[propKey], value];
        }
      } else {
        nodeObj[propKey] = value;
      }
    }

    // 2. Resolve nested nodes (inline children linked by @id)
    const allNodes = Array.from(subjectsMap.values());
    const rootNodes = allNodes.filter((node) => {
      // A node is root if it's not referenced as an object by any other node
      return !quadsList.some(
        (q) => q.object.termType !== 'Literal' && q.object.value === node['@id']
      );
    });

    const resolveNested = (node: any) => {
      for (const key of Object.keys(node)) {
        if (key === '@id' || key === '@type') continue;

        const val = node[key];
        const resolveItem = (item: any) => {
          if (item && typeof item === 'object' && item['@id']) {
            const childNode = subjectsMap.get(item['@id']);
            if (childNode) {
              const fullyResolvedChild = { ...childNode };
              resolveNested(fullyResolvedChild);
              return fullyResolvedChild;
            }
          }
          return item;
        };

        if (Array.isArray(val)) {
          node[key] = val.map(resolveItem);
        } else {
          node[key] = resolveItem(val);
        }
      }
    };

    // If there are no root nodes because of loops/cycles, return all nodes
    const output = rootNodes.length > 0 ? rootNodes : allNodes;
    output.forEach(resolveNested);

    return output;
  }
}
