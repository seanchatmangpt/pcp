import { DataFactory , Quad } from '../rdf';
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

    it('demonstrates self-healing wrapper restoring parity', async () => {
      // Implement a self-healing client proxy that handles write-through cache invalidation
      class SelfHealingVKGClient {
        constructor(
          public baseClient: MemoryVKGClient,
          public cache: SemanticNodeCache
        ) {}

        async match(subject?: any, predicate?: any, object?: any, graph?: any): Promise<Quad[]> {
          if (subject) {
            const cached = this.cache.get(subject);
            if (cached) return cached;
          }
          const fresh = await this.baseClient.match(subject, predicate, object, graph);
          if (subject) {
            this.cache.set(subject, fresh);
          }
          return fresh;
        }

        async addQuads(quads: Quad[]): Promise<void> {
          await this.baseClient.addQuads(quads);
          // Self-healing: Invalidate subjects of mutated quads
          for (const q of quads) {
            this.cache.invalidate(q.subject);
          }
        }

        async removeQuads(quads: Quad[]): Promise<void> {
          await this.baseClient.removeQuads(quads);
          // Self-healing: Invalidate subjects of mutated quads
          for (const q of quads) {
            this.cache.invalidate(q.subject);
          }
        }
      }

      const client = new MemoryVKGClient();
      const cache = new SemanticNodeCache(60000);
      const healingClient = new SelfHealingVKGClient(client, cache);

      const subjectNode = DataFactory.namedNode('usr:alice');
      const predicateNode = DataFactory.namedNode('https://pcp.framework/ontology/role');
      const roleAdmin = DataFactory.literal('Administrator');
      const quad = DataFactory.quad(subjectNode, predicateNode, roleAdmin);

      await healingClient.addQuads([quad]);

      // Warm up cache
      let fetched1 = await healingClient.match(subjectNode);
      expect(fetched1.length).toBe(1);

      // Verify cached read
      let cachedRead = cache.get(subjectNode);
      expect(cachedRead).toBeDefined();

      // Mutate via healing client
      await healingClient.removeQuads([quad]);

      // Cache should be automatically invalidated (cache.get returns null)
      let cachedReadAfterMutation = cache.get(subjectNode);
      expect(cachedReadAfterMutation).toBeNull(); // Parity restored!

      // Fetch matches DB empty state
      let fetched2 = await healingClient.match(subjectNode);
      expect(fetched2.length).toBe(0);
    });
  });

  describe('Failure Mode 3: Outbox Quarantine Deadlocks & Conflict Management', () => {
    it('simulates stuck entity outbox queue blocking subsequent writes and repairs it', () => {
      // We simulate the transaction storage queue
      interface SimulatedSyncJob {
        id: number;
        entityId: string;
        jobType: string;
        payload: string;
        status: 'pending' | 'processing' | 'failed' | 'quarantined';
        attempts: number;
      }

      let queue: SimulatedSyncJob[] = [
        {
          id: 1,
          entityId: 'usr:alice',
          jobType: 'RDF_ADD_QUAD',
          payload: '...',
          status: 'quarantined',
          attempts: 3,
        },
        {
          id: 2,
          entityId: 'usr:alice',
          jobType: 'RDF_REMOVE_QUAD',
          payload: '...',
          status: 'pending',
          attempts: 0,
        },
        {
          id: 3,
          entityId: 'usr:bob',
          jobType: 'RDF_ADD_QUAD',
          payload: '...',
          status: 'pending',
          attempts: 0,
        },
      ];

      // Standard outbox scheduler query logic
      const getBlockedEntityIds = (jobs: SimulatedSyncJob[]): Set<string> => {
        const blocked = new Set<string>();
        for (const j of jobs) {
          if (j.status === 'quarantined' || j.status === 'processing') {
            blocked.add(j.entityId);
          }
        }
        return blocked;
      };

      const getReadyJobs = (jobs: SimulatedSyncJob[], blocked: Set<string>): SimulatedSyncJob[] => {
        return jobs.filter((j) => j.status === 'pending' && !blocked.has(j.entityId));
      };

      // 1. Get blocked entities
      let blocked = getBlockedEntityIds(queue);
      expect(blocked.has('usr:alice')).toBe(true);

      // 2. Fetch jobs ready to dispatch
      let ready = getReadyJobs(queue, blocked);
      expect(ready.length).toBe(1);
      expect(ready[0].entityId).toBe('usr:bob'); // usr:alice's operations are deadlocked!

      // Self-Healing supervisor logic:
      // Scan quarantined jobs. If a quarantined job is overridden by a later pending mutation (e.g., ADD then REMOVE),
      // we can discard the conflict, resolve state manually, or reset/retry.
      // Alternatively, the supervisor can quarantine-evacuate (reset attempts and retry with backoff, or notify user).
      const selfHealOutbox = (jobs: SimulatedSyncJob[]): SimulatedSyncJob[] => {
        // Discard obsolete quarantined jobs if there are newer writes that make them redundant
        // Or simple recovery: move quarantined job to a recovery queue or clear them if followed by removals.
        return jobs.map((j) => {
          if (j.status === 'quarantined') {
            // For safety, let's reset it and force a reconcilation or skip
            return { ...j, status: 'pending', attempts: 0 };
          }
          return j;
        });
      };

      // Apply self-healing
      queue = selfHealOutbox(queue);
      blocked = getBlockedEntityIds(queue);
      expect(blocked.has('usr:alice')).toBe(false); // Deadlock broken!

      ready = getReadyJobs(queue, blocked);
      expect(ready.length).toBe(3); // All jobs ready for sequential execution
    });
  });
});
