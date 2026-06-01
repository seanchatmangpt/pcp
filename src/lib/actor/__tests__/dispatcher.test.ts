/**
 * @fileoverview Jest tests for ActorDispatcher covering autonomic triggers, optimistic execution, and outbox rollback synchronization.
 */

import { isNetworkOffline, setNetworkOffline, setRemoteRejectionMocked } from '../actorOps';
import { ActorDispatcher, ActorSyncEngine } from '../dispatcher';
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

  function flattenChunks(chunks: any): any[] {
    if (!chunks) return [];
    if (!Array.isArray(chunks)) {
      chunks = [chunks];
    }
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
  
  const mockReturningFn = jest.fn().mockImplementation(() => Promise.resolve([mockStore[mockStore.length - 1]]));
  const mockValuesFn = jest.fn().mockImplementation((val) => {
    try {
      const tableName = getTableName(currentInsertTable);
      if (Array.isArray(val)) {
        for (const item of val) {
          mockStore.push({ ...item, _tableName: tableName });
        }
      } else {
        mockStore.push({ ...val, _tableName: tableName });
      }
      currentInsertTable = null;
      return { returning: mockReturningFn };
    } catch (e: any) {
      console.error('ERROR IN mockValuesFn:', e.stack);
      throw e;
    }
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
    'job_type': 'jobType',
    'status': 'status'
  };

  const mockFromFn = jest.fn().mockImplementation((table) => {
    try {
      const tableName = getTableName(table);
      const tableStore = mockStore.filter(x => x._tableName === tableName).map(x => ({ ...x }));
      
      const prepareChain = (results: any[]): any => {
        const p = Promise.resolve(results);
        (p as any).where = jest.fn().mockImplementation((condition) => {
          try {
            let filtered = results.map(x => ({ ...x }));
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
          } catch (e: any) {
            console.error('ERROR IN where:', e.stack);
            throw e;
          }
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
    } catch (e: any) {
      console.error('ERROR IN mockFromFn:', e.stack);
      throw e;
    }
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
const mockQueueJob = jest.fn().mockImplementation((job) => {
  return Promise.resolve({
    id: Math.floor(Math.random() * 1000),
    jobType: job.jobType,
    payload: job.payload,
    entityId: job.entityId ?? null,
    status: 'pending',
    attempts: 0,
    createdAt: new Date(),
  });
});
jest.mock('../../sync/syncEngine', () => {
  return {
    SyncEngine: class MockSyncEngine {
      public queueJob = mockQueueJob;
      public pushChanges = jest.fn();
    },
  };
});

const mockedDb = db as any;

describe('ActorDispatcher Dynamic Autonomic Triggers', () => {
  let vkgClient: VirtualKnowledgeGraphClient;
  let localDispatcher: ActorDispatcher;
  let remoteDispatcher: ActorDispatcher;
  let registry: ActorRegistry;

  const mockActor: ActorRef = {
    tenantId: 'tenant-abc',
    kind: 'VolunteerShift',
    id: 'shift-999'
  };

  const volunteerBehavior: ActorBehavior = {
    actorKind: 'VolunteerShift',
    commands: {
      CancelShift: {
        roles: ['admin', 'pastor'],
        inputValidator: (payload: any) => {
          if (payload.reason === 'ThrowValidation') throw new Error('Validator failed');
          return typeof payload.reason === 'string' && payload.reason.trim().length > 0;
        },
        construct: (payload: any, actor: ActorRef) => {
          if (payload.reason === 'ThrowConstruct') throw new Error('Construct failed');
          if (payload.reason === 'GenerateAllTermTypes') {
            return {
              add: [
                DataFactory.quad(
                  DataFactory.blankNode('bn1'),
                  DataFactory.namedNode('https://schema.org/status'),
                  DataFactory.literal('lit', 'en'),
                  DataFactory.defaultGraph()
                ),
                DataFactory.quad(
                  DataFactory.namedNode('https://schema.org/subject'),
                  DataFactory.namedNode('https://schema.org/predicate'),
                  DataFactory.blankNode('bn2'),
                  DataFactory.namedNode('https://schema.org/graph')
                ),
                DataFactory.quad(
                  DataFactory.namedNode('https://schema.org/subject'),
                  DataFactory.namedNode('https://schema.org/predicate'),
                  DataFactory.literal('123', DataFactory.namedNode('http://www.w3.org/2001/XMLSchema#integer')),
                  DataFactory.blankNode('bn3')
                )
              ],
              remove: []
            };
          }
          const s = DataFactory.namedNode(`https://schema.org/volunteerShift/${actor.id}`);
          const p = DataFactory.namedNode('https://schema.org/status');
          const oOld = DataFactory.namedNode('https://schema.org/Confirmed');
          const oNew = DataFactory.namedNode('https://schema.org/Cancelled');

          return {
            add: [DataFactory.quad(s, p, oNew, DataFactory.defaultGraph())],
            remove: [DataFactory.quad(s, p, oOld, DataFactory.defaultGraph())]
          };
        },
        emits: ['ShiftCancelled']
      }
    },
    queries: {}
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockedDb._clearStore();
    registry = ActorRegistry.getInstance();
    registry.clear();
    registry.register(volunteerBehavior);

    vkgClient = new VirtualKnowledgeGraphClient();
    localDispatcher = new ActorDispatcher(vkgClient, { mode: 'local', authority: 'optimistic' });
    remoteDispatcher = new ActorDispatcher(vkgClient, { mode: 'remote', authority: 'authoritative' });

    // Ensure remote reject is not active by default
    try {
      setRemoteRejectionMocked(false);
      setNetworkOffline(false);
    } catch (e) {}
  });

  describe('Optimistic Local Simulation & Autonomic Triggers', () => {
    it('successfully processes optimistic dispatch and queues to outbox', async () => {
      const envelope: CommandEnvelope = {
        id: 'cmd-opt-1',
        actor: mockActor,
        command: 'CancelShift',
        principal: { id: 'usr-admin', role: 'admin' },
        payload: { reason: 'Volunteer is ill' },
        idempotencyKey: 'key-opt-1'
      };

      const addQuadsSpy = jest.spyOn(vkgClient, 'addQuads');
      const removeQuadsSpy = jest.spyOn(vkgClient, 'removeQuads');

      const receipt = await localDispatcher.dispatch(envelope);
      if (receipt.status === 'rejected_local') {
        console.log('REJECTION ERROR:', receipt.error);
      }

      expect(receipt.status).toBe('accepted_pending');
      expect(receipt.deltaHash).toBeDefined();
      expect(receipt.eventIds).toHaveLength(1);

      // Verify VKG is updated optimistically
      expect(addQuadsSpy).toHaveBeenCalled();
      expect(removeQuadsSpy).toHaveBeenCalled();

      // Verify db changes recorded
      const commands = mockedDb._mockStore.filter((x: any) => x._tableName === 'actor_commands');
      expect(commands).toHaveLength(1);
      expect(commands[0].id).toBe('cmd-opt-1');
      expect(commands[0].status).toBe('pending');

      const events = mockedDb._mockStore.filter((x: any) => x._tableName === 'actor_events');
      expect(events).toHaveLength(1);
      expect(events[0].commandId).toBe('cmd-opt-1');

      const receipts = mockedDb._mockStore.filter((x: any) => x._tableName === 'actor_receipts');
      expect(receipts).toHaveLength(1);
      expect(receipts[0].status).toBe('accepted_pending');

      const outbox = mockedDb._mockStore.filter((x: any) => x._tableName === 'actor_outbox');
      expect(outbox).toHaveLength(1);
      expect(outbox[0].commandId).toBe('cmd-opt-1');
      expect(outbox[0].status).toBe('pending');
    });

    it('records local rejection on validation error', async () => {
      const envelope: CommandEnvelope = {
        id: 'cmd-opt-2',
        actor: mockActor,
        command: 'CancelShift',
        principal: { id: 'usr-admin', role: 'admin' },
        payload: { reason: '' }, // empty reason is invalid
        idempotencyKey: 'key-opt-2'
      };

      const receipt = await localDispatcher.dispatch(envelope);

      expect(receipt.status).toBe('rejected_local');
      expect(receipt.error).toContain('ValidationError');

      const commands = mockedDb._mockStore.filter((x: any) => x._tableName === 'actor_commands');
      expect(commands[0].status).toBe('rejected');

      const outbox = mockedDb._mockStore.filter((x: any) => x._tableName === 'actor_outbox');
      expect(outbox).toHaveLength(0);
    });

    it('records local rejection on authorization error', async () => {
      const envelope: CommandEnvelope = {
        id: 'cmd-opt-3',
        actor: mockActor,
        command: 'CancelShift',
        principal: { id: 'usr-member', role: 'member' }, // member is not authorized
        payload: { reason: 'No power' },
        idempotencyKey: 'key-opt-3'
      };

      const receipt = await localDispatcher.dispatch(envelope);

      expect(receipt.status).toBe('rejected_local');
      expect(receipt.error).toContain('AuthorizationError');
    });

    it('records local rejection on missing behavior registry', async () => {
      const envelope: CommandEnvelope = {
        id: 'cmd-opt-4',
        actor: { ...mockActor, kind: 'UnknownKind' },
        command: 'CancelShift',
        principal: { id: 'usr-admin', role: 'admin' },
        payload: { reason: 'No power' },
        idempotencyKey: 'key-opt-4'
      };

      const receipt = await localDispatcher.dispatch(envelope);

      expect(receipt.status).toBe('rejected_local');
      expect(receipt.error).toContain('RegistryError');
    });

    it('records local rejection on missing command spec', async () => {
      const envelope: CommandEnvelope = {
        id: 'cmd-opt-5',
        actor: mockActor,
        command: 'UnknownCommand',
        principal: { id: 'usr-admin', role: 'admin' },
        payload: { reason: 'No power' },
        idempotencyKey: 'key-opt-5'
      };

      const receipt = await localDispatcher.dispatch(envelope);

      expect(receipt.status).toBe('rejected_local');
      expect(receipt.error).toContain('not supported by actor kind');
    });

    it('records local rejection on validation exception', async () => {
      const envelope: CommandEnvelope = {
        id: 'cmd-opt-6',
        actor: mockActor,
        command: 'CancelShift',
        principal: { id: 'usr-admin', role: 'admin' },
        payload: { reason: 'ThrowValidation' },
        idempotencyKey: 'key-opt-6'
      };

      const receipt = await localDispatcher.dispatch(envelope);
      expect(receipt.status).toBe('rejected_local');
      expect(receipt.error).toContain('Validator failed');
    });

    it('records local rejection on execution exception', async () => {
      const envelope: CommandEnvelope = {
        id: 'cmd-opt-7',
        actor: mockActor,
        command: 'CancelShift',
        principal: { id: 'usr-admin', role: 'admin' },
        payload: { reason: 'ThrowConstruct' },
        idempotencyKey: 'key-opt-7'
      };

      const receipt = await localDispatcher.dispatch(envelope);
      expect(receipt.status).toBe('rejected_local');
      expect(receipt.error).toContain('Construct failed');
    });

    it('records local rejection on VKG write error', async () => {
      const envelope: CommandEnvelope = {
        id: 'cmd-opt-8',
        actor: mockActor,
        command: 'CancelShift',
        principal: { id: 'usr-admin', role: 'admin' },
        payload: { reason: 'VKG Write Error' },
        idempotencyKey: 'key-opt-8'
      };

      const addQuadsSpy = jest.spyOn(vkgClient, 'addQuads').mockRejectedValueOnce(new Error('DB is locked'));

      const receipt = await localDispatcher.dispatch(envelope);
      expect(receipt.status).toBe('rejected_local');
      expect(receipt.error).toContain('VKGWriteError: DB is locked');
    });
  });

  describe('Idempotency Guards', () => {
    it('returns existing receipt if command was already processed in local mode', async () => {
      const envelope: CommandEnvelope = {
        id: 'cmd-idemp-1',
        actor: mockActor,
        command: 'CancelShift',
        principal: { id: 'usr-admin', role: 'admin' },
        payload: { reason: 'First' },
        idempotencyKey: 'key-idemp-1'
      };

      // Dispatch once
      const receipt1 = await localDispatcher.dispatch(envelope);

      // Dispatch twice
      const receipt2 = await localDispatcher.dispatch(envelope);

      expect(receipt1.id).toBe(receipt2.id);
      expect(receipt2.status).toBe('accepted_pending');

      const commands = mockedDb._mockStore.filter((x: any) => x._tableName === 'actor_commands');
      expect(commands).toHaveLength(1);
    });

    it('ignores local optimistic pending receipts in remote mode to perform authoritative execution', async () => {
      const envelope: CommandEnvelope = {
        id: 'cmd-idemp-2',
        actor: mockActor,
        command: 'CancelShift',
        principal: { id: 'usr-admin', role: 'admin' },
        payload: { reason: 'Remote ignore' },
        idempotencyKey: 'key-idemp-2'
      };

      // Mock local pending receipt in DB first
      mockedDb._mockStore.push({
        id: 'rec-local-pending',
        commandId: envelope.id,
        actorRef: JSON.stringify(envelope.actor),
        status: 'accepted_pending',
        deltaHash: 'hash-local',
        eventIds: JSON.stringify(['evt-1']),
        createdAt: new Date(),
        _tableName: 'actor_receipts'
      });

      // Dispatch to remote dispatcher
      const remoteReceipt = await remoteDispatcher.dispatch(envelope);

      expect(remoteReceipt.status).toBe('applied_remote');
      expect(remoteReceipt.id).not.toBe('rec-local-pending');
    });
  });

  describe('Remote Dispatch & Mock Rejection Membrane', () => {
    it('returns applied_remote receipt on successful remote dispatch', async () => {
      const envelope: CommandEnvelope = {
        id: 'cmd-rem-1',
        actor: mockActor,
        command: 'CancelShift',
        principal: { id: 'usr-admin', role: 'admin' },
        payload: { reason: 'Clean execution' },
        idempotencyKey: 'key-rem-1'
      };

      const receipt = await remoteDispatcher.dispatch(envelope);

      expect(receipt.status).toBe('applied_remote');
      expect(receipt.deltaHash).toBeDefined();
    });

    it('supports mock rejection membrane setting', async () => {
      setRemoteRejectionMocked(true);

      const envelope: CommandEnvelope = {
        id: 'cmd-rem-2',
        actor: mockActor,
        command: 'CancelShift',
        principal: { id: 'usr-admin', role: 'admin' },
        payload: { reason: 'Mocked rejection' },
        idempotencyKey: 'key-rem-2'
      };

      const receipt = await remoteDispatcher.dispatch(envelope);

      expect(receipt.status).toBe('rejected_remote');
      expect(receipt.error).toContain('Mock Rejection Active');
    });

    it('records remote rejection on missing behavior registry', async () => {
      const envelope: CommandEnvelope = {
        id: 'cmd-rem-3',
        actor: { ...mockActor, kind: 'UnknownKind' },
        command: 'CancelShift',
        principal: { id: 'usr-admin', role: 'admin' },
        payload: { reason: 'Missing kind' },
        idempotencyKey: 'key-rem-3'
      };

      const receipt = await remoteDispatcher.dispatch(envelope);
      expect(receipt.status).toBe('rejected_remote');
      expect(receipt.error).toContain('RegistryError');
    });

    it('records remote rejection on missing command spec', async () => {
      const envelope: CommandEnvelope = {
        id: 'cmd-rem-4',
        actor: mockActor,
        command: 'UnknownCommand',
        principal: { id: 'usr-admin', role: 'admin' },
        payload: { reason: 'Unknown' },
        idempotencyKey: 'key-rem-4'
      };

      const receipt = await remoteDispatcher.dispatch(envelope);
      expect(receipt.status).toBe('rejected_remote');
      expect(receipt.error).toContain('not supported by actor kind');
    });

    it('records remote rejection on authorization error', async () => {
      const envelope: CommandEnvelope = {
        id: 'cmd-rem-5',
        actor: mockActor,
        command: 'CancelShift',
        principal: { id: 'usr-member', role: 'member' },
        payload: { reason: 'No auth' },
        idempotencyKey: 'key-rem-5'
      };

      const receipt = await remoteDispatcher.dispatch(envelope);
      expect(receipt.status).toBe('rejected_remote');
      expect(receipt.error).toContain('AuthorizationError');
    });

    it('records remote rejection on validation exception', async () => {
      const envelope: CommandEnvelope = {
        id: 'cmd-rem-6',
        actor: mockActor,
        command: 'CancelShift',
        principal: { id: 'usr-admin', role: 'admin' },
        payload: { reason: 'ThrowValidation' },
        idempotencyKey: 'key-rem-6'
      };

      const receipt = await remoteDispatcher.dispatch(envelope);
      expect(receipt.status).toBe('rejected_remote');
      expect(receipt.error).toContain('ValidationError: Validator failed');
    });

    it('records remote rejection on invalid payload', async () => {
      const envelope: CommandEnvelope = {
        id: 'cmd-rem-7',
        actor: mockActor,
        command: 'CancelShift',
        principal: { id: 'usr-admin', role: 'admin' },
        payload: { reason: '' },
        idempotencyKey: 'key-rem-7'
      };

      const receipt = await remoteDispatcher.dispatch(envelope);
      expect(receipt.status).toBe('rejected_remote');
      expect(receipt.error).toContain('ValidationError: Input payload validation failed');
    });

    it('records remote rejection on execution exception', async () => {
      const envelope: CommandEnvelope = {
        id: 'cmd-rem-8',
        actor: mockActor,
        command: 'CancelShift',
        principal: { id: 'usr-admin', role: 'admin' },
        payload: { reason: 'ThrowConstruct' },
        idempotencyKey: 'key-rem-8'
      };

      const receipt = await remoteDispatcher.dispatch(envelope);
      expect(receipt.status).toBe('rejected_remote');
      expect(receipt.error).toContain('ExecutionError: Construct failed');
    });
  });

  describe('Outbox Synchronization & Rollback Compensations', () => {
    it('processes outbox, completes sync, updates DB to applied_remote and completes outbox job', async () => {
      const envelope: CommandEnvelope = {
        id: 'cmd-sync-1',
        actor: mockActor,
        command: 'CancelShift',
        principal: { id: 'usr-admin', role: 'admin' },
        payload: { reason: 'Sync success' },
        idempotencyKey: 'key-sync-1'
      };

      // 1. Dispatch locally to generate outbox job
      await localDispatcher.dispatch(envelope);

      const outboxBefore = mockedDb._mockStore.find((x: any) => x._tableName === 'actor_outbox' && x.commandId === envelope.id);
      expect(outboxBefore.status).toBe('pending');

      // 2. Run syncOutbox
      await localDispatcher.syncOutbox(remoteDispatcher);

      const outboxAfter = mockedDb._mockStore.find((x: any) => x._tableName === 'actor_outbox' && x.commandId === envelope.id);
      expect(outboxAfter.status).toBe('completed');

      const commandAfter = mockedDb._mockStore.find((x: any) => x._tableName === 'actor_commands' && x.id === envelope.id);
      expect(commandAfter.status).toBe('applied');

      const receiptAfter = mockedDb._mockStore.find((x: any) => x._tableName === 'actor_receipts' && x.commandId === envelope.id);
      expect(receiptAfter.status).toBe('applied_remote');
    });

    it('triggers compensatory rollback when remote authority rejects, removing added quads and re-adding removed quads', async () => {
      const envelope: CommandEnvelope = {
        id: 'cmd-sync-2',
        actor: mockActor,
        command: 'CancelShift',
        principal: { id: 'usr-admin', role: 'admin' },
        payload: { reason: 'Sync fail rollback' },
        idempotencyKey: 'key-sync-2'
      };

      // Spies for rollback calls
      const removeQuadsSpy = jest.spyOn(vkgClient, 'removeQuads');
      const addQuadsSpy = jest.spyOn(vkgClient, 'addQuads');

      // 1. Dispatch locally to register optimistic updates
      await localDispatcher.dispatch(envelope);

      // Clear spy call history before syncOutbox
      removeQuadsSpy.mockClear();
      addQuadsSpy.mockClear();

      // 2. Set remote rejection mock active
      setRemoteRejectionMocked(true);

      // 3. Sync outbox (this will fetch job, send to remote, get rejected_remote, and trigger rollback)
      await localDispatcher.syncOutbox(remoteDispatcher);

      // 4. Verify rollback quads compensation:
      // Our command adds Cancelling and removes Confirmed.
      // Rollback must do the exact opposite: remove Cancelling, and add Confirmed.
      expect(removeQuadsSpy).toHaveBeenCalledTimes(1);
      const removedQuads = removeQuadsSpy.mock.calls[0][0];
      expect(removedQuads[0].object.value).toBe('https://schema.org/Cancelled');

      expect(addQuadsSpy).toHaveBeenCalledTimes(1);
      const addedQuads = addQuadsSpy.mock.calls[0][0];
      expect(addedQuads[0].object.value).toBe('https://schema.org/Confirmed');

      // 5. Verify DB updates to failed/rejected/quarantined
      const outboxAfter = mockedDb._mockStore.find((x: any) => x._tableName === 'actor_outbox' && x.commandId === envelope.id);
      expect(outboxAfter.status).toBe('failed');

      const commandAfter = mockedDb._mockStore.find((x: any) => x._tableName === 'actor_commands' && x.id === envelope.id);
      expect(commandAfter.status).toBe('rejected');

      const receiptAfter = mockedDb._mockStore.find((x: any) => x._tableName === 'actor_receipts' && x.commandId === envelope.id);
      expect(receiptAfter.status).toBe('rejected_remote');

      const quarantine = mockedDb._mockStore.find((x: any) => x._tableName === 'actor_quarantine' && x.commandId === envelope.id);
      expect(quarantine).toBeDefined();
      expect(quarantine.error).toContain('Mock Rejection Active');
    });

    it('aborts outbox sync and throws error if network is offline', async () => {
      setNetworkOffline(true);

      await expect(localDispatcher.syncOutbox(remoteDispatcher)).rejects.toThrow('NetworkError');
    });

    it('performs retry loops up to 3 times before failing the outbox job', async () => {
      // Create a remote dispatcher that always throws a transient error
      const brokenRemoteDispatcher = {
        dispatch: jest.fn().mockRejectedValue(new Error('Transient Db Connection Timeout'))
      } as any;

      const envelope: CommandEnvelope = {
        id: 'cmd-sync-retry',
        actor: mockActor,
        command: 'CancelShift',
        principal: { id: 'usr-admin', role: 'admin' },
        payload: { reason: 'Retry test' },
        idempotencyKey: 'key-retry-1'
      };

      // 1. Local optimistic dispatch
      await localDispatcher.dispatch(envelope);
      const getJob = () => mockedDb._mockStore.find((x: any) => x._tableName === 'actor_outbox' && x.commandId === envelope.id);

      // Attempt 1
      await localDispatcher.syncOutbox(brokenRemoteDispatcher);
      expect(getJob().attempts).toBe(1);
      expect(getJob().status).toBe('pending'); // resets to pending for retry

      // Attempt 2
      await localDispatcher.syncOutbox(brokenRemoteDispatcher);
      expect(getJob().attempts).toBe(2);
      expect(getJob().status).toBe('pending');

      // Attempt 3
      await localDispatcher.syncOutbox(brokenRemoteDispatcher);
      expect(getJob().attempts).toBe(3);
      expect(getJob().status).toBe('failed'); // fails because attempts >= 3
    });

    it('catches and logs ROLLBACK EXCEPTION when vkgClient throws during compensation', async () => {
      const envelope: CommandEnvelope = {
        id: 'cmd-sync-rollback-err',
        actor: mockActor,
        command: 'CancelShift',
        principal: { id: 'usr-admin', role: 'admin' },
        payload: { reason: 'Sync fail rollback err' },
        idempotencyKey: 'key-sync-rollback-err'
      };

      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

      await localDispatcher.dispatch(envelope);
      setRemoteRejectionMocked(true);

      jest.spyOn(vkgClient, 'removeQuads').mockRejectedValueOnce(new Error('Simulated Rollback Error'));

      await localDispatcher.syncOutbox(remoteDispatcher);

      expect(consoleSpy).toHaveBeenCalledWith('ROLLBACK EXCEPTION:', expect.any(Error));
      consoleSpy.mockRestore();
    });

    it('serializes and deserializes all term types during outbox processing and rollback', async () => {
      const envelope: CommandEnvelope = {
        id: 'cmd-sync-terms',
        actor: mockActor,
        command: 'CancelShift',
        principal: { id: 'usr-admin', role: 'admin' },
        payload: { reason: 'GenerateAllTermTypes' },
        idempotencyKey: 'key-sync-terms'
      };

      const addQuadsSpy = jest.spyOn(vkgClient, 'addQuads');
      const removeQuadsSpy = jest.spyOn(vkgClient, 'removeQuads');

      await localDispatcher.dispatch(envelope);
      setRemoteRejectionMocked(true);

      removeQuadsSpy.mockClear();
      addQuadsSpy.mockClear();

      await localDispatcher.syncOutbox(remoteDispatcher);

      // Verify deserialization during rollback.
      // removeQuads should be called on what was added (which has BlankNode, Literal)
      expect(removeQuadsSpy).toHaveBeenCalled();
      const removed = removeQuadsSpy.mock.calls[0][0];
      expect(removed[0].subject.termType).toBe('BlankNode');
      expect(removed[0].object.termType).toBe('Literal');
    });
    });

    describe('ActorSyncEngine & Utilities', () => {
    it('returns the sync engine instance', () => {
      expect(localDispatcher.getSyncEngine()).toBeDefined();
      expect(localDispatcher.getSyncEngine()).toBeInstanceOf(ActorSyncEngine);
    });

    it('dispatches jobs to supabase correctly and handles errors', async () => {
      const engine = new ActorSyncEngine();
      const dispatchJob = (engine as any).dispatchJob.bind(engine);
      const { supabase } = require('@/lib/supabase');

      // ACTOR_COMMAND success
      await dispatchJob({ jobType: 'ACTOR_COMMAND', payload: JSON.stringify({ id: 'cmd1' }) });

      // ACTOR_EVENT success
      await dispatchJob({ jobType: 'ACTOR_EVENT', payload: JSON.stringify({ id: 'evt1' }) });

      // ACTOR_RECEIPT success
      await dispatchJob({ jobType: 'ACTOR_RECEIPT', payload: JSON.stringify({ id: 'rec1' }) });

      // Unknown type error
      await expect(dispatchJob({ jobType: 'UNKNOWN', payload: '{}' })).rejects.toThrow('Unrecognized Actor sync job type');

      // Supabase errors
      supabase._mockUpsert.mockResolvedValueOnce({ error: { message: 'db error' } });
      await expect(dispatchJob({ jobType: 'ACTOR_COMMAND', payload: '{}' })).rejects.toThrow('Supabase actor command sync failed: db error');

      supabase._mockUpsert.mockResolvedValueOnce({ error: { message: 'db error' } });
      await expect(dispatchJob({ jobType: 'ACTOR_EVENT', payload: '{}' })).rejects.toThrow('Supabase actor event sync failed: db error');

      supabase._mockUpsert.mockResolvedValueOnce({ error: { message: 'db error' } });
      await expect(dispatchJob({ jobType: 'ACTOR_RECEIPT', payload: '{}' })).rejects.toThrow('Supabase actor receipt sync failed: db error');
    });
    });
    });
