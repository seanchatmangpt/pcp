import { DataFactory, Quad } from '../rdf';
import { LocalInferenceEngine } from '../inference/engine';
import { SemanticNodeCache } from '../cache';
import { createTransitivityRule, createSymmetryRule } from '../inference';
import { VKGClientFacade } from '../client';

// Mock client database for testing desynchronization without hitting physical SQLite
class MemoryVKGClient {
  public dbQuads: Quad[] = [];
  public matchCalls = 0;

  async match(subject?: any, predicate?: any, object?: any, graph?: any): Promise<Quad[]> {
    this.matchCalls++;
    return this.dbQuads.filter((q) => {
      if (subject && !q.subject.equals(subject)) return false;
      if (predicate && !q.predicate.equals(predicate)) return false;
      if (object && !q.object.equals(object)) return false;
      if (graph && !q.graph.equals(graph)) return false;
      return true;
    });
  }

  async addQuads(quads: Quad[]): Promise<void> {
    for (const q of quads) {
      if (!this.dbQuads.some((existing) => existing.equals(q))) {
        this.dbQuads.push(q);
      }
    }
  }

  async removeQuads(quads: Quad[]): Promise<void> {
    this.dbQuads = this.dbQuads.filter((existing) => !quads.some((q) => q.equals(existing)));
  }
}

describe('VKG Resiliency & Self-Healing Simulator', () => {
  describe('Failure Mode 1: Rule Recursion & Combinatorial Explosion', () => {
    it('demonstrates recursion termination using maxIterations', () => {
      // Create a cyclic symmetry rule: knows(A, B) <=> knows(B, A)
      const rule = createSymmetryRule('symmetryKnows', 'https://pcp.framework/ontology/knows');
      const engine = new LocalInferenceEngine([rule]);

      // Add base facts
      const initial = [
        DataFactory.quad(
          DataFactory.namedNode('usr:alice'),
          DataFactory.namedNode('https://pcp.framework/ontology/knows'),
          DataFactory.namedNode('usr:bob')
        ),
      ];

      // Run inference with iteration limits
      const resultMax1 = engine.infer(initial, 1);
      const resultMax5 = engine.infer(initial, 5);

      // Verify that even with infinite potential loop, it terminates
      expect(resultMax1.iterations).toBe(1);
      expect(resultMax5.iterations).toBe(2); // Terminated after iteration 2 because no new quads were inferred
      expect(resultMax5.inferredQuads.length).toBe(1);
      expect(resultMax5.inferredQuads[0].subject.value).toBe('usr:bob');
    });

    it('demonstrates combinatorial complexity under transitive reasoning', () => {
      // Transitivity rule: parent(A, B) & parent(B, C) => grandparent(A, C)
      const rule = createTransitivityRule(
        'grandparentTransitivity',
        'https://pcp.framework/ontology/parentOf',
        'https://pcp.framework/ontology/grandparentOf'
      );
      const engine = new LocalInferenceEngine([rule]);

      // Create a deep hierarchy chain of parentOf
      // P1 -> P2 -> P3 -> P4 -> P5 -> P6
      const baseQuads: Quad[] = [];
      for (let i = 1; i < 6; i++) {
        baseQuads.push(
          DataFactory.quad(
            DataFactory.namedNode(`usr:p${i}`),
            DataFactory.namedNode('https://pcp.framework/ontology/parentOf'),
            DataFactory.namedNode(`usr:p${i + 1}`)
          )
        );
      }

      // Run inference. Grandparent relations:
      // p1->p3, p2->p4, p3->p5, p4->p6
      const result = engine.infer(baseQuads, 5);
      expect(result.inferredQuads.length).toBe(4);
      expect(result.iterations).toBe(2); // Iteration 1 infers all grandparents, Iteration 2 realizes no more changes
    });
  });

  describe('Failure Mode 2: Cache Poisoning & TTL Desynchronization', () => {
    it('proves the vulnerability where cache is not invalidated upon write/delete', async () => {
      const client = new MemoryVKGClient();
      const cache = new SemanticNodeCache(60000); // 60s TTL

      const subjectNode = DataFactory.namedNode('usr:alice');
      const predicateNode = DataFactory.namedNode('https://pcp.framework/ontology/role');
      const roleAdmin = DataFactory.literal('Administrator');

      const initialQuad = DataFactory.quad(subjectNode, predicateNode, roleAdmin);
      await client.addQuads([initialQuad]);

      // Fetch and cache
      let fetched = await client.match(subjectNode);
      cache.set(subjectNode, fetched);

      // Verify cache hit
      let cachedVal = cache.get(subjectNode);
      expect(cachedVal).toBeDefined();
      expect(cachedVal![0].object.value).toBe('Administrator');

      // Vulnerability: Mutate db directly (delete the role)
      await client.removeQuads([initialQuad]);

      // Cache is STILL dirty because TTL has not elapsed
      let cachedValAfterMutation = cache.get(subjectNode);
      expect(cachedValAfterMutation).toBeDefined();
      expect(cachedValAfterMutation![0].object.value).toBe('Administrator'); // Split-brain state!

      // Db is empty
      const dbQuads = await client.match(subjectNode);
      expect(dbQuads.length).toBe(0);
    });
  });
});
