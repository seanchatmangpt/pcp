/**
 * @fileoverview Jest tests for the Actor Dispatcher, Actor Registry, and Supervisor, including local optimistic simulation and remote authority rollback.
 */

jest.unmock('../actorOps');
jest.unmock('@/src/lib/actor/actorOps');

import { ActorDispatcher } from '../dispatcher';
import { ActorRegistry } from '../registry';
import { VirtualKnowledgeGraphClient } from '../../vkg/client';
import { DataFactory } from '../../vkg/rdf';
import { ActorRef, CommandEnvelope, Principal, ActorBehavior } from '../types';

import { db } from '../../db/db';

// Mock the database client structure
jest.mock('../../db/db', () => {
  let mockStore: any[] = [];
  let currentInsertTable: any = null;
  let currentUpdateTable: any = null;
  let currentUpdateValues: any = null;

  function flattenChunks(chunks: any[]): any[] {
    const flat: any[] = [];
    for (const chunk of chunks) {
      if (chunk && chunk.queryChunks) {
        flat.push(...flattenChunks(chunk.queryChunks));
      } else {
        flat.push(chunk);
      }
    }
    return flat;
  }

  function getTableName(table: any, condition?: any): string {
    if (table) {
      if (table.config?.name) return table.config.name;
      
      const symbols = Object.getOwnPropertySymbols(table);
      for (const sym of symbols) {
        const str = sym.toString();
        if (str === 'Symbol(drizzle:Name)' || str === 'Symbol(drizzle:BaseName)' || str === 'Symbol(drizzle:OriginalName)') {
          const val = table[sym];
          if (typeof val === 'string') return val;
        }
      }
    }

    if (condition && condition.queryChunks) {
      const flat = flattenChunks(condition.queryChunks);
      for (const chunk of flat) {
        if (chunk && chunk.table) {
          const tableVal = chunk.table;
          if (tableVal.config?.name) return tableVal.config.name;
          const symbols = Object.getOwnPropertySymbols(tableVal);
          for (const sym of symbols) {
            const str = sym.toString();
            if (str === 'Symbol(drizzle:Name)' || str === 'Symbol(drizzle:BaseName)' || str === 'Symbol(drizzle:OriginalName)') {
              const val = tableVal[sym];
              if (typeof val === 'string') return val;
            }
          }
        }
      }
    }

    return 'unknown';
  }
  
  const mockReturningFn = jest.fn().mockImplementation(() => Promise.resolve());
  const mockValuesFn = jest.fn().mockImplementation((val) => {
    const tableName = getTableName(currentInsertTable);
    mockStore.push({ ...val, _tableName: tableName });
    currentInsertTable = null;
    return { returning: mockReturningFn };
  });
  
  const mockInsertFn = jest.fn().mockImplementation((table) => {
    currentInsertTable = table;
    return { values: mockValuesFn };
  });

  const sqlToJsMap: Record<string, string> = {
    'command_id': 'commandId',
    'actor_ref': 'actorRef',
    'idempotency_key': 'idempotencyKey',
    'causation_id': 'causationId',
    'correlation_id': 'correlationId',
    'created_at': 'createdAt',
    'event_ids': 'eventIds',
    'delta_hash': 'deltaHash',
    'job_type': 'jobType'
  };

  const mockWhereSelectFn = jest.fn().mockImplementation((condition) => {
    // Handled in mockFromFn to have correct table filter scope
    return Promise.resolve([]);
  });

  const mockFromFn = jest.fn().mockImplementation((table) => {
    const tableName = getTableName(table);
    const tableStore = mockStore.filter(x => x._tableName === tableName);
    
    const prepareChain = (results: any[]): any => {
      const p = Promise.resolve(results);
      (p as any).where = jest.fn().mockImplementation((condition) => {
        let filtered = [...results];
        if (condition && condition.queryChunks) {
          const flatChunks = flattenChunks(condition.queryChunks);
          const columnChunk = flatChunks.find((c: any) => c && c.name && c.value === undefined);
          const paramChunk = flatChunks.find((c: any) => c && c.value !== undefined && !Array.isArray(c.value));
          if (columnChunk && paramChunk) {
            const columnName = columnChunk.name;
            const jsKey = sqlToJsMap[columnName] || columnName;
            filtered = filtered.filter((x) => x[jsKey] === paramChunk.value);
          }
        }
        return prepareChain(filtered);
      });
      (p as any).orderBy = jest.fn().mockImplementation(() => {
        return prepareChain(results);
      });
      (p as any).limit = jest.fn().mockImplementation((n: number) => {
        return prepareChain(results.slice(0, n));
      });
      return p;
    };

    return prepareChain(tableStore);
  });
  
  const mockSelectFn = jest.fn().mockImplementation(() => ({ from: mockFromFn }));

  const mockWhereDeleteFn = jest.fn().mockImplementation(() => Promise.resolve());
  const mockDeleteFn = jest.fn().mockImplementation(() => {
    const promise = Promise.resolve();
    (promise as any).where = mockWhereDeleteFn;
    return promise;
  });

  const mockWhereUpdateFn = jest.fn().mockImplementation((condition) => {
    const tableName = getTableName(currentUpdateTable, condition);
    if (condition && condition.queryChunks && currentUpdateValues) {
      const flatChunks = flattenChunks(condition.queryChunks);
      const columnChunk = flatChunks.find((c: any) => c && c.name && c.value === undefined);
      const paramChunk = flatChunks.find((c: any) => c && c.value !== undefined && !Array.isArray(c.value));
      if (columnChunk && paramChunk) {
        const jsKey = sqlToJsMap[columnChunk.name] || columnChunk.name;
        mockStore.forEach((record) => {
          if (record._tableName === tableName && record[jsKey] === paramChunk.value) {
            Object.assign(record, currentUpdateValues);
          }
        });
      }
    }
    currentUpdateValues = null;
    currentUpdateTable = null;
    return Promise.resolve();
  });
  
  const mockUpdateSetFn = jest.fn().mockImplementation((val) => {
    currentUpdateValues = val;
    const promise = Promise.resolve();
    (promise as any).where = mockWhereUpdateFn;
    return promise;
  });
  
  const mockUpdateFn = jest.fn().mockImplementation((table) => {
    currentUpdateTable = table;
    return { set: mockUpdateSetFn };
  });

  return {
    db: {
      insert: mockInsertFn,
      select: mockSelectFn,
      delete: mockDeleteFn,
      update: mockUpdateFn,
      _mockStore: mockStore,
      _clearStore: () => { mockStore.length = 0; }
    },
  };
});

// Mock Supabase client
jest.mock('@/lib/supabase', () => {
  const mockUpsert = jest.fn().mockReturnValue(Promise.resolve({ error: null }));
  const mockDeleteEq = jest.fn().mockReturnValue(Promise.resolve({ error: null }));
  const mockDelete = jest.fn().mockReturnValue({ eq: mockDeleteEq });
  const mockFrom = jest.fn().mockReturnValue({
    upsert: mockUpsert,
    delete: mockDelete,
  });

  return {
    supabase: {
      from: mockFrom,
      _mockUpsert: mockUpsert,
    },
  };
});

// Mock SyncEngine queueJob
const mockQueueJob = jest.fn();
jest.mock('../../sync/syncEngine', () => {
  return {
    SyncEngine: class MockSyncEngine {
      public queueJob = mockQueueJob;
      public pushChanges = jest.fn();
    },
  };
});

const mockedDb = db as any;

describe('Actor Authoritative Runtime', () => {
  let vkgClient: VirtualKnowledgeGraphClient;
  let localDispatcher: ActorDispatcher;
  let remoteDispatcher: ActorDispatcher;
  let registry: ActorRegistry;

  const mockActorRef: ActorRef = {
    tenantId: 'tenant-123',
    kind: 'Sermon',
    id: 'sermon-456'
  };

  const sermonBehavior: ActorBehavior = {
    actorKind: 'Sermon',
    commands: {
      PublishSermon: {
        roles: ['admin', 'pastor'],
        inputValidator: (payload: any) => {
          return typeof payload.title === 'string' && payload.title.trim().length > 0;
        },
        construct: (payload: any, actor: ActorRef) => {
          const s = DataFactory.namedNode(`https://schema.org/sermon/${actor.id}`);
          const p1 = DataFactory.namedNode('http://www.w3.org/1999/02/22-rdf-syntax-ns#type');
          const o1 = DataFactory.namedNode('https://schema.org/Sermon');
          const p2 = DataFactory.namedNode('https://schema.org/name');
          const o2 = DataFactory.literal(payload.title);

          return {
            add: [
              DataFactory.quad(s, p1, o1, DataFactory.defaultGraph()),
              DataFactory.quad(s, p2, o2, DataFactory.defaultGraph())
            ],
            remove: []
          };
        },
        emits: ['SermonPublished']
      }
    },
    queries: {}
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockedDb._clearStore();
    registry = ActorRegistry.getInstance();
    registry.clear();
    registry.register(sermonBehavior);

    vkgClient = new VirtualKnowledgeGraphClient();
    localDispatcher = new ActorDispatcher(vkgClient, { mode: 'local', authority: 'optimistic' });
    remoteDispatcher = new ActorDispatcher(vkgClient, { mode: 'remote', authority: 'authoritative' });
  });

  describe('Local Simulation Mode', () => {
    it('creates accepted_pending receipt, inserts into local outbox table, and applies to local VKG', async () => {
      const envelope: CommandEnvelope = {
        id: 'cmd-local-1',
        actor: mockActorRef,
        command: 'PublishSermon',
        principal: { id: 'usr-admin', role: 'admin' },
        payload: { title: 'The Power of Grace' },
        idempotencyKey: 'idemp-local-1'
      };

      const receipt = await localDispatcher.dispatch(envelope);

      expect(receipt.status).toBe('accepted_pending');
      expect(receipt.error).toBeUndefined();
      expect(receipt.eventIds).toHaveLength(1);
      expect(receipt.deltaHash).toBeDefined();

      // Assert outbox job table insertion occurred
      const outboxEntries = mockedDb._mockStore.filter((x: any) => x.commandId === 'cmd-local-1' && x.jobType === 'DISPATCH_AUTHORITATIVE');
      expect(outboxEntries).toHaveLength(1);
      expect(outboxEntries[0].status).toBe('pending');
    });

    it('creates rejected_local receipt when role authorization fails', async () => {
      const envelope: CommandEnvelope = {
        id: 'cmd-local-2',
        actor: mockActorRef,
        command: 'PublishSermon',
        principal: { id: 'usr-member', role: 'member' },
        payload: { title: 'The Power of Grace' },
        idempotencyKey: 'idemp-local-2'
      };

      const receipt = await localDispatcher.dispatch(envelope);

      expect(receipt.status).toBe('rejected_local');
      expect(receipt.error).toContain('AuthorizationError');
    });

    it('creates rejected_local receipt when validation check fails', async () => {
      const envelope: CommandEnvelope = {
        id: 'cmd-local-3',
        actor: mockActorRef,
        command: 'PublishSermon',
        principal: { id: 'usr-pastor', role: 'pastor' },
        payload: { title: '' }, // Empty title is invalid
        idempotencyKey: 'idemp-local-3'
      };

      const receipt = await localDispatcher.dispatch(envelope);

      expect(receipt.status).toBe('rejected_local');
      expect(receipt.error).toContain('ValidationError');
    });

    it('isolates local state and creates rejected_local receipt if dispatcher construct crashes', async () => {
      const crashingBehavior: ActorBehavior = {
        actorKind: 'Sermon',
        commands: {
          PublishSermon: {
            roles: ['admin', 'pastor'],
            inputValidator: () => true,
            construct: () => {
              throw new Error('SPARQL CONSTRUCT compile stack overflow');
            },
            emits: ['SermonPublished']
          }
        },
        queries: {}
      };

      registry.clear();
      registry.register(crashingBehavior);

      const envelope: CommandEnvelope = {
        id: 'cmd-local-4',
        actor: mockActorRef,
        command: 'PublishSermon',
        principal: { id: 'usr-admin', role: 'admin' },
        payload: { title: 'Crashing Title' },
        idempotencyKey: 'idemp-local-4'
      };

      const receipt = await localDispatcher.dispatch(envelope);

      expect(receipt.status).toBe('rejected_local');
      expect(receipt.error).toContain('ExecutionError');
      
      // Ensure no quads inserted
      const quadsInsertions = mockedDb._mockStore.filter((x: any) => x.subject !== undefined);
      expect(quadsInsertions).toHaveLength(0);
    });
  });

  describe('Remote Rejection Reconciliation (5th Test case)', () => {
    it('applies change locally, gets authoritative remote rejection, compensatively rolls back local VKG quads, and updates local receipt to rejected_remote', async () => {
      const addQuadsSpy = jest.spyOn(vkgClient, 'addQuads');
      const removeQuadsSpy = jest.spyOn(vkgClient, 'removeQuads');

      const envelope: CommandEnvelope = {
        id: 'cmd-reconcile-1',
        actor: mockActorRef,
        command: 'PublishSermon',
        principal: { id: 'usr-pastor', role: 'pastor' },
        payload: { title: 'Sermon to Rollback' },
        idempotencyKey: 'idemp-reconcile-1'
      };

      // 1. Local optimistic dispatch
      const localReceipt = await localDispatcher.dispatch(envelope);
      expect(localReceipt.status).toBe('accepted_pending');
      expect(addQuadsSpy).toHaveBeenCalled(); // verified local quads assertion

      // 2. Mock remote authority changing rules to reject the command
      const remoteRejectionBehavior: ActorBehavior = {
        actorKind: 'Sermon',
        commands: {
          PublishSermon: {
            roles: ['admin', 'pastor'],
            inputValidator: (payload: any) => {
              // Authoritative validator rejects payload due to a server-side banned keyword
              return !payload.title.includes('Rollback');
            },
            construct: () => ({ add: [], remove: [] }),
            emits: []
          }
        },
        queries: {}
      };

      registry.clear();
      registry.register(remoteRejectionBehavior);

      // 3. Trigger outbox synchronizer
      await localDispatcher.syncOutbox(remoteDispatcher);

      // 4. Assert local dispatcher reconciles by rolling back the optimistic quads
      // Since delta adds quads, rollback must trigger removeQuads with matching terms
      expect(removeQuadsSpy).toHaveBeenCalled();

      // 5. Assert local logs updated to match remote state
      const savedReceipts = mockedDb._mockStore.filter((x: any) => x.commandId === 'cmd-reconcile-1' && x._tableName === 'actor_receipts');
      // Should have been updated to rejected_remote
      expect(savedReceipts[0].status).toBe('rejected_remote');
      expect(savedReceipts[0].error).toContain('ValidationError');

      // Assert outbox job table is updated to failed
      const outboxEntries = mockedDb._mockStore.filter((x: any) => x.commandId === 'cmd-reconcile-1' && x.jobType === 'DISPATCH_AUTHORITATIVE');
      expect(outboxEntries[0].status).toBe('failed');

      // Assert quarantine record written
      const quarantineEntries = mockedDb._mockStore.filter((x: any) => x.commandId === 'cmd-reconcile-1' && x._tableName === 'actor_quarantine');
      expect(quarantineEntries).toHaveLength(1);
    });
  });

  describe('Global State Membrane Traps', () => {
    it('forces global state updates to generate MembraneReceipts', async () => {
      const { Receipts } = require('../../membrane/receipts');
      Receipts.clear();
      
      const { setNetworkOffline, isNetworkOffline } = require('../actorOps');
      
      // 1. Initial State
      expect(isNetworkOffline()).toBe(false);
      
      // 2. Perform Mutation under proxy control
      setNetworkOffline(true);
      
      // Since context.run is asynchronous and returns in background, wait slightly
      await new Promise(resolve => setTimeout(resolve, 35));
      
      expect(isNetworkOffline()).toBe(true);
      
      // 3. Confirm that Membrane receipt log has registered the mutation
      const history = Receipts.getHistory();
      expect(history.length).toBeGreaterThan(0);
      
      const lastReceipt = history[history.length - 1];
      expect(lastReceipt.capabilityId).toBe('property-mutator');
      expect(lastReceipt.success).toBe(true);
    });
  });
});
