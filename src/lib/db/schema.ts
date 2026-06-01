import { sqliteTable, text, integer, primaryKey } from 'drizzle-orm/sqlite-core';

export const syncQueue = sqliteTable('sync_queue', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  jobType: text('job_type').notNull(),
  payload: text('payload').notNull(), // JSON stringified payload
  status: text('status')
    .notNull()
    .$type<'pending' | 'processing' | 'failed' | 'quarantined'>()
    .default('pending'),
  attempts: integer('attempts').notNull().default(0),
  entityId: text('entity_id'), // Serialization key to group/sequence actions on same entity
  createdAt: integer('created_at', { mode: 'timestamp' })
    .notNull()
    .$defaultFn(() => new Date()),
});

export type SyncJob = typeof syncQueue.$inferSelect;
export type NewSyncJob = typeof syncQueue.$inferInsert;

export const quads = sqliteTable('quads', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  subject: text('subject').notNull(),
  subjectTermType: text('subject_term_type').notNull(),
  predicate: text('predicate').notNull(),
  objectValue: text('object_value').notNull(),
  objectTermType: text('object_term_type').notNull(),
  objectDatatype: text('object_datatype'),
  objectLanguage: text('object_language'),
  graph: text('graph').notNull(),
  graphTermType: text('graph_term_type').notNull(),
});

export type QuadRecord = typeof quads.$inferSelect;
export type NewQuadRecord = typeof quads.$inferInsert;

export const actorCommands = sqliteTable('actor_commands', {
  id: text('id').primaryKey(),
  actorRef: text('actor_ref').notNull(), // JSON string representing ActorRef
  command: text('command').notNull(),
  principal: text('principal').notNull(), // JSON string representing Principal
  payload: text('payload').notNull(), // JSON string representing payload
  idempotencyKey: text('idempotency_key').notNull(),
  causationId: text('causation_id'),
  correlationId: text('correlation_id'),
  status: text('status').notNull().$type<'pending' | 'processing' | 'applied' | 'rejected'>().default('pending'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
});

export type ActorCommandRecord = typeof actorCommands.$inferSelect;
export type NewActorCommandRecord = typeof actorCommands.$inferInsert;

export const actorEvents = sqliteTable('actor_events', {
  id: text('id').primaryKey(),
  commandId: text('command_id').notNull(),
  actorRef: text('actor_ref').notNull(), // JSON string representing ActorRef
  type: text('type').notNull(),
  payload: text('payload').notNull(), // JSON string representing payload
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
});

export type ActorEventRecord = typeof actorEvents.$inferSelect;
export type NewActorEventRecord = typeof actorEvents.$inferInsert;

export const actorReceipts = sqliteTable('actor_receipts', {
  id: text('id').primaryKey(),
  commandId: text('command_id').notNull(),
  actorRef: text('actor_ref').notNull(), // JSON string representing ActorRef
  status: text('status')
    .notNull()
    .$type<
      | 'accepted_pending'
      | 'rejected_local'
      | 'applied_local'
      | 'applied_remote'
      | 'rejected_remote'
      | 'quarantined'
    >(),
  deltaHash: text('delta_hash'),
  eventIds: text('event_ids').notNull(), // JSON string representing string[]
  error: text('error'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
});

export type ActorReceiptRecord = typeof actorReceipts.$inferSelect;
export type NewActorReceiptRecord = typeof actorReceipts.$inferInsert;

export const actorOutbox = sqliteTable('actor_outbox', {
  id: text('id').primaryKey(),
  commandId: text('command_id').notNull(),
  jobType: text('job_type').notNull(), // e.g. 'DISPATCH_AUTHORITATIVE'
  payload: text('payload').notNull(), // JSON stringified command envelope
  status: text('status').notNull().$type<'pending' | 'processing' | 'completed' | 'failed'>().default('pending'),
  attempts: integer('attempts').notNull().default(0),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
});

export type ActorOutboxRecord = typeof actorOutbox.$inferSelect;
export type NewActorOutboxRecord = typeof actorOutbox.$inferInsert;

export const actorQuarantine = sqliteTable('actor_quarantine', {
  id: text('id').primaryKey(),
  commandId: text('command_id').notNull(),
  actorRef: text('actor_ref').notNull(), // JSON string representing ActorRef
  payload: text('payload').notNull(), // JSON string representing command payload
  error: text('error').notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
});

export type ActorQuarantineRecord = typeof actorQuarantine.$inferSelect;
export type NewActorQuarantineRecord = typeof actorQuarantine.$inferInsert;




