import { drizzle } from 'drizzle-orm/expo-sqlite';
import { openDatabaseSync } from 'expo-sqlite';
import * as schema from '../schema';

jest.unmock('../db');
jest.unmock('@/src/lib/db/db');

// Mock dependencies BEFORE importing db
jest.mock('expo-sqlite', () => {
  const mockExecSync = jest.fn();
  return {
    openDatabaseSync: jest.fn(() => ({
      execSync: mockExecSync,
    })),
  };
});

jest.mock('drizzle-orm/expo-sqlite', () => ({
  drizzle: jest.fn(() => ({
    _isDrizzleMock: true,
  })),
}));

jest.mock('../schema', () => ({
  dummyTable: {},
}));

// Now import db
import * as dbModule from '../db';

describe('db.ts initialization', () => {
  it('should export the correct DATABASE_NAME', () => {
    expect(dbModule.DATABASE_NAME).toBe('@truex/membrane-client.db');
  });

  it('should call openDatabaseSync with the correct database name', () => {
    expect(openDatabaseSync).toHaveBeenCalledWith('@truex/membrane-client.db');
  });

  it('should execute PRAGMA configurations', () => {
    const mockExecSync = (dbModule.expoDb as any).execSync;
    expect(mockExecSync).toHaveBeenCalledWith('PRAGMA journal_mode = WAL;');
    expect(mockExecSync).toHaveBeenCalledWith('PRAGMA foreign_keys = ON;');
  });

  it('should create the sync_queue table if it does not exist', () => {
    const mockExecSync = (dbModule.expoDb as any).execSync;
    const callArgs = mockExecSync.mock.calls.map((call: any[]) => call[0]);
    const createTableCall = callArgs.find((arg: string) => arg.includes('CREATE TABLE IF NOT EXISTS "sync_queue"'));
    
    expect(createTableCall).toBeDefined();
    expect(createTableCall).toContain('"id" INTEGER PRIMARY KEY AUTOINCREMENT');
    expect(createTableCall).toContain('"job_type" TEXT NOT NULL');
    expect(createTableCall).toContain('"payload" TEXT NOT NULL');
    expect(createTableCall).toContain('"status" TEXT NOT NULL DEFAULT \'pending\'');
    expect(createTableCall).toContain('"attempts" INTEGER NOT NULL DEFAULT 0');
    expect(createTableCall).toContain('"entity_id" TEXT');
    expect(createTableCall).toContain('"created_at" INTEGER NOT NULL');
  });

  it('should initialize the drizzle client with expoDb and schema', () => {
    expect(drizzle).toHaveBeenCalledWith(dbModule.expoDb, { schema });
    expect((dbModule.db as any)._isDrizzleMock).toBe(true);
  });
});
