import { drizzle } from 'drizzle-orm/expo-sqlite';
import { openDatabaseSync } from 'expo-sqlite';
import * as schema from './schema';

export const DATABASE_NAME = '@truex/membrane-client.db';

// Open the SQLite database connection
export const expoDb = openDatabaseSync(DATABASE_NAME);

// Apply performance and safety configurations
expoDb.execSync('PRAGMA journal_mode = WAL;');
expoDb.execSync('PRAGMA foreign_keys = ON;');

// Self-healing database initialization: ensure sync_queue exists
expoDb.execSync(`
  CREATE TABLE IF NOT EXISTS "sync_queue" (
    "id" INTEGER PRIMARY KEY AUTOINCREMENT,
    "job_type" TEXT NOT NULL,
    "payload" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "entity_id" TEXT,
    "created_at" INTEGER NOT NULL
  );
`);

// Initialize the drizzle database client
export const db = drizzle(expoDb, { schema });
