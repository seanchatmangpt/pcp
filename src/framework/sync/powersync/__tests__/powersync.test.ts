/**
 * @fileoverview Unit tests for PowerSync schema, connector, and TrueXPowerSyncDB.
 */

import { TrueXPowerSyncDB, AdmissionGate } from '../TrueXPowerSyncDB';
import { SupabaseConnector } from '../SupabaseConnector';
import { powersyncSchema } from '../powersyncSchema';
import { db, expoDb } from '@/src/lib/db/db';
import { supabase } from '@/lib/supabase';
import { blake3, canonicalStringify } from '@/src/lib/crypto/receipts';

// Mock DB module specifically for this test file
jest.mock('@/src/lib/db/db', () => {
  const mockReturning = jest.fn().mockResolvedValue([{ id: 42 }]);
  const mockValues = jest.fn().mockReturnValue({ returning: mockReturning });
  const mockInsert = jest.fn().mockReturnValue({ values: mockValues });

  const mockLimit = jest.fn().mockResolvedValue([]);
  const mockOrderBy = jest.fn().mockReturnValue({ limit: mockLimit });
  const mockWhereSelect = jest.fn().mockReturnValue([]);
  const mockFrom = jest.fn().mockReturnValue({
    orderBy: mockOrderBy,
    where: mockWhereSelect,
  });
  const mockSelect = jest.fn().mockReturnValue({ from: mockFrom });

  const mockWhereUpdate = jest.fn().mockResolvedValue([]);
  const mockSet = jest.fn().mockReturnValue({ where: mockWhereUpdate });
  const mockUpdate = jest.fn().mockReturnValue({ set: mockSet });

  const mockWhereDelete = jest.fn().mockResolvedValue([]);
  const mockDelete = jest.fn().mockReturnValue({ where: mockWhereDelete });

  const mockTx = {
    insert: mockInsert,
    select: mockSelect,
    update: mockUpdate,
    delete: mockDelete,
  };

  return {
    expoDb: {
      execSync: jest.fn(),
      runSync: jest.fn(),
      getAllSync: jest.fn(() => []),
    },
    db: {
      insert: mockInsert,
      select: mockSelect,
      update: mockUpdate,
      delete: mockDelete,
      transaction: jest.fn((callback) => callback(mockTx)),
    },
  };
});

describe('PowerSync Schema & PATQ DB Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('PowerSync Schema Definitions', () => {
    it('defines the correct tables in the schema', () => {
      expect(powersyncSchema.tables).toHaveLength(3);
      
      const tableNames = powersyncSchema.tables.map((t) => t.name);
      expect(tableNames).toContain('profiles');
      expect(tableNames).toContain('sync_admission_receipts');
      expect(tableNames).toContain('sync_job_quarantine');
    });

    it('defines the correct columns on profiles table', () => {
      const profiles = powersyncSchema.tables.find((t) => t.name === 'profiles');
      expect(profiles).toBeDefined();
      
      const cols = profiles!.columns.map((c) => c.name);
      expect(cols).toEqual(['id', 'username', 'full_name', 'website', 'avatar_url', 'updated_at']);
    });
  });

  describe('AdmissionGate Policies', () => {
    const gate = new AdmissionGate();

    it('admits a valid profiles entity', () => {
      const decision = gate.evaluate('profiles', 'user-123', {
        username: 'john_doe',
        full_name: 'John Doe',
      });
      expect(decision.verdict).toBe('admit');
    });

    it('rejects an entity with empty id', () => {
      const decision = gate.evaluate('profiles', '', { username: 'john_doe' });
      expect(decision.verdict).toBe('reject');
      expect(decision.reason).toContain('entityId');
    });

    it('rejects a profiles entity with an empty username', () => {
      const decision = gate.evaluate('profiles', 'user-123', { username: ' ' });
      expect(decision.verdict).toBe('reject');
      expect(decision.reason).toContain('username');
    });
  });

  describe('TrueXPowerSyncDB Transactions', () => {
    const pydb = new TrueXPowerSyncDB();

    it('throws and quarantines on gate rejection', async () => {
      const invalidPayload = { username: '' }; // Invalid
      
      await expect(
        pydb.writeTransaction('profiles', 'user-123', invalidPayload)
      ).rejects.toThrow('PATQ AdmissionGate rejected job');

      expect(db.insert).toHaveBeenCalled();
    });

    it('successfully chains receipt hashes on valid inputs', async () => {
      const validPayload = { username: 'valid_user', full_name: 'Valid User' };
      
      const resultHash = await pydb.writeTransaction('profiles', 'user-123', validPayload);
      expect(resultHash).toBeDefined();
      expect(typeof resultHash).toBe('string');
      expect(resultHash.length).toBe(64); // Blake3 hash length in hex
    });
  });

  describe('SupabaseConnector & Replication Queue', () => {
    const connector = new SupabaseConnector();

    it('fetches credentials from Supabase session client', async () => {
      const mockSession = { access_token: 'mock-jwt-token' };
      (supabase.auth.getSession as jest.Mock).mockResolvedValueOnce({
        data: { session: mockSession },
        error: null,
      });

      const creds = await connector.fetchCredentials();
      expect(creds).toEqual({
        endpoint: 'https://mock.powersync.truex.net',
        token: 'mock-jwt-token',
      });
    });

    it('processes transaction queues and sends PUT, PATCH, DELETE operations', async () => {
      const completeMock = jest.fn();
      const mockTransaction = {
        transactionId: 101,
        crud: [
          { id: 1, op: 'PUT', table: 'profiles', client_row_id: 'user-1', opData: { username: 'put_user' } },
          { id: 2, op: 'PATCH', table: 'profiles', client_row_id: 'user-2', opData: { username: 'patch_user' } },
          { id: 3, op: 'DELETE', table: 'profiles', client_row_id: 'user-3' },
        ],
        complete: completeMock,
      };

      const dbMock = {
        getNextCrudTransaction: jest
          .fn()
          .mockResolvedValueOnce(mockTransaction)
          .mockResolvedValueOnce(null), // Stop loop
      };

      const mockChain = supabase.from('profiles') as any;
      mockChain.upsert = jest.fn().mockResolvedValue({ error: null });
      mockChain.update = jest.fn().mockReturnThis();
      mockChain.delete = jest.fn().mockReturnThis();
      mockChain.eq = jest.fn().mockResolvedValue({ error: null });

      await connector.uploadData(dbMock);

      expect(completeMock).toHaveBeenCalledTimes(1);
    });
  });
});
