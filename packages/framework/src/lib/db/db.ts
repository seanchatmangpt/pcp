import { drizzle } from 'drizzle-orm/expo-sqlite';
import { openDatabaseSync } from 'expo-sqlite';
import * as schema from './schema';

export const DATABASE_NAME = '@truex/membrane-client.db';

// Open the SQLite database connection
export const expoDb = openDatabaseSync(DATABASE_NAME);

// Apply performance and safety configurations
expoDb.execSync('PRAGMA journal_mode = WAL;');
expoDb.execSync('PRAGMA foreign_keys = ON;');

// Self-healing database initialization: ensure all PATQ-law tables exist
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

// PATQ Law: admission receipts table — receipt must be written BEFORE event row
expoDb.execSync(`
  CREATE TABLE IF NOT EXISTS "sync_admission_receipts" (
    "id" TEXT PRIMARY KEY,
    "job_id" INTEGER,
    "job_type" TEXT NOT NULL,
    "entity_id" TEXT,
    "payload_hash" TEXT NOT NULL,
    "previous_receipt_hash" TEXT NOT NULL,
    "receipt_hash" TEXT NOT NULL,
    "admitted_at" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pre_insert',
    "error" TEXT,
    "created_at" INTEGER NOT NULL
  );
`);

// PATQ Law: gate-rejected events quarantine — never silently drop rejected jobs
expoDb.execSync(`
  CREATE TABLE IF NOT EXISTS "sync_job_quarantine" (
    "id" INTEGER PRIMARY KEY AUTOINCREMENT,
    "job_type" TEXT NOT NULL,
    "payload" TEXT NOT NULL,
    "entity_id" TEXT,
    "rejection_reason" TEXT NOT NULL,
    "verdict" TEXT NOT NULL,
    "created_at" INTEGER NOT NULL
  );
`);

expoDb.execSync(`
  CREATE TABLE IF NOT EXISTS "quads" (
    "id" INTEGER PRIMARY KEY AUTOINCREMENT,
    "subject" TEXT NOT NULL,
    "subject_term_type" TEXT NOT NULL,
    "predicate" TEXT NOT NULL,
    "object_value" TEXT NOT NULL,
    "object_term_type" TEXT NOT NULL,
    "object_datatype" TEXT,
    "object_language" TEXT,
    "graph" TEXT NOT NULL,
    "graph_term_type" TEXT NOT NULL
  );
`);

expoDb.execSync(`
  CREATE TABLE IF NOT EXISTS "actor_commands" (
    "id" TEXT PRIMARY KEY,
    "actor_ref" TEXT NOT NULL,
    "command" TEXT NOT NULL,
    "principal" TEXT NOT NULL,
    "payload" TEXT NOT NULL,
    "idempotency_key" TEXT NOT NULL,
    "causation_id" TEXT,
    "correlation_id" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "created_at" INTEGER NOT NULL
  );
`);

expoDb.execSync(`
  CREATE TABLE IF NOT EXISTS "actor_events" (
    "id" TEXT PRIMARY KEY,
    "command_id" TEXT NOT NULL,
    "actor_ref" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "payload" TEXT NOT NULL,
    "created_at" INTEGER NOT NULL
  );
`);

expoDb.execSync(`
  CREATE TABLE IF NOT EXISTS "actor_receipts" (
    "id" TEXT PRIMARY KEY,
    "command_id" TEXT NOT NULL,
    "actor_ref" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "delta_hash" TEXT,
    "event_ids" TEXT NOT NULL,
    "error" TEXT,
    "created_at" INTEGER NOT NULL
  );
`);

expoDb.execSync(`
  CREATE TABLE IF NOT EXISTS "actor_outbox" (
    "id" TEXT PRIMARY KEY,
    "command_id" TEXT NOT NULL,
    "job_type" TEXT NOT NULL,
    "payload" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "created_at" INTEGER NOT NULL
  );
`);

expoDb.execSync(`
  CREATE TABLE IF NOT EXISTS "actor_quarantine" (
    "id" TEXT PRIMARY KEY,
    "command_id" TEXT NOT NULL,
    "actor_ref" TEXT NOT NULL,
    "payload" TEXT NOT NULL,
    "error" TEXT NOT NULL,
    "created_at" INTEGER NOT NULL
  );
`);

// Initialize the drizzle database client
export const db = drizzle(expoDb, { schema });
