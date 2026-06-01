/**
 * @fileoverview Actor Dispatcher orchestrating optimistic local simulation, remote authoritative execution, and rollback compensation.
 */

import { db } from '../db/db';
import { actorCommands, actorEvents, actorReceipts, actorOutbox, actorQuarantine } from '../db/schema';
import { eq, desc } from 'drizzle-orm';
import { generateReceiptHash } from '../crypto/receipts';
import { VirtualKnowledgeGraphClient } from '../vkg/client';
import { ActorRegistry } from './registry';
import { ActorSupervisor } from './supervision';
// mock syncEngine
// mock supabase
const supabase: any = {};
type SyncEngine = any;
import { DataFactory, Quad } from '../vkg/rdf';
import {
  CommandEnvelope,
  Receipt,
  EventEnvelope,
  ActorRef,
  Principal,
  DispatchContext,
  ReceiptStatus
} from './types';

/**
 * Serializes a standard RDF.js Quad object to a JSON-compatible plain object.
 */
function serializeQuad(q: Quad): any {
  return {
    subject: { termType: q.subject.termType, value: q.subject.value },
    predicate: { termType: q.predicate.termType, value: q.predicate.value },
    object: {
      termType: q.object.termType,
      value: q.object.value,
      datatype: q.object.termType === 'Literal' ? (q.object as any).datatype?.value : undefined,
      language: q.object.termType === 'Literal' ? (q.object as any).language : undefined,
    },
    graph: { termType: q.graph.termType, value: q.graph.value },
  };
}

/**
 * Deserializes a plain JSON-compatible object back into a standard RDF.js Quad object.
 */
function deserializeQuad(sq: any): Quad {
  const s = sq.subject.termType === 'NamedNode'
    ? DataFactory.namedNode(sq.subject.value)
    : DataFactory.blankNode(sq.subject.value);

  const p = DataFactory.namedNode(sq.predicate.value);

  let o;
  if (sq.object.termType === 'NamedNode') {
    o = DataFactory.namedNode(sq.object.value);
  } else if (sq.object.termType === 'BlankNode') {
    o = DataFactory.blankNode(sq.object.value);
  } else {
    const datatype = sq.object.datatype ? DataFactory.namedNode(sq.object.datatype) : undefined;
    o = DataFactory.literal(sq.object.value, sq.object.language || datatype);
  }

  const g = sq.graph.termType === 'DefaultGraph'
    ? DataFactory.defaultGraph()
    : sq.graph.termType === 'NamedNode'
    ? DataFactory.namedNode(sq.graph.value)
    : DataFactory.blankNode(sq.graph.value);

  return DataFactory.quad(s, p, o, g);
}

/**
 * Concrete SyncEngine subclass for Actor events, commands, and receipts.
 * Synchronizes actor logs up to Supabase.
 */
export class ActorSyncEngine implements SyncEngine {
  protected supportedJobTypes = ['ACTOR_COMMAND', 'ACTOR_EVENT', 'ACTOR_RECEIPT'];
  public async queueJob(job: any): Promise<void> {}

  protected async dispatchJob(job: { jobType: string; payload: string; entityId: string | null }): Promise<void> {
    const rawData = JSON.parse(job.payload);

    if (job.jobType === 'ACTOR_COMMAND') {
      const { error } = await supabase
        .from('actor_commands')
        .upsert({
          id: rawData.id,
          actor_ref: rawData.actor,
          command: rawData.command,
          principal: rawData.principal,
          payload: rawData.payload,
          idempotency_key: rawData.idempotencyKey,
          causation_id: rawData.causationId ?? null,
          correlation_id: rawData.correlationId ?? null,
          status: rawData.status,
          created_at: rawData.createdAt,
        });

      if (error) {
        throw new Error(`Supabase actor command sync failed: ${error.message}`);
      }
    } else if (job.jobType === 'ACTOR_EVENT') {
      const { error } = await supabase
        .from('actor_events')
        .upsert({
          id: rawData.id,
          command_id: rawData.commandId,
          actor_ref: rawData.actor,
          type: rawData.type,
          payload: rawData.payload,
          created_at: rawData.createdAt,
        });

      if (error) {
        throw new Error(`Supabase actor event sync failed: ${error.message}`);
      }
    } else if (job.jobType === 'ACTOR_RECEIPT') {
      const { error } = await supabase
        .from('actor_receipts')
        .upsert({
          id: rawData.id,
          command_id: rawData.commandId,
          actor_ref: rawData.actor,
          status: rawData.status,
          delta_hash: rawData.deltaHash ?? null,
          event_ids: rawData.eventIds,
          error: rawData.error ?? null,
          created_at: rawData.createdAt,
        });

      if (error) {
        throw new Error(`Supabase actor receipt sync failed: ${error.message}`);
      }
    } else {
      throw new Error(`Unrecognized Actor sync job type: ${job.jobType}`);
    }
  }
}

/**
 * ActorDispatcher handles message routing and transactional execution of commands.
 * Can run as a local simulator (optimistic) or remote authoritative dispatcher.
 */
export class ActorDispatcher {
  private vkgClient: VirtualKnowledgeGraphClient;
  private syncEngine: ActorSyncEngine;
  private context: DispatchContext;

  constructor(
    vkgClient: VirtualKnowledgeGraphClient,
    context: DispatchContext = { mode: 'local', authority: 'optimistic' },
    syncEngine?: ActorSyncEngine
  ) {
    this.vkgClient = vkgClient;
    this.context = context;
    this.syncEngine = syncEngine ?? new ActorSyncEngine();
  }

  /**
   * Returns the active sync engine instance.
   */
  public getSyncEngine(): ActorSyncEngine {
    return this.syncEngine;
  }

  /**
   * Main dispatch entry point. Matches the conceptual BEAM command loop.
   */
  public async dispatch<TPayload = any>(envelope: CommandEnvelope<TPayload>): Promise<Receipt> {
    // 1. Idempotency Check
    const existingReceipts = await db
      .select()
      .from(actorReceipts)
      .where(eq(actorReceipts.commandId, envelope.id));

    if (existingReceipts.length > 0) {
      const rec = existingReceipts[0];
      // In remote mode, ignore optimistic local pending/rejection receipts
      if (this.context.mode === 'local' || (rec.status !== 'accepted_pending' && rec.status !== 'rejected_local')) {
        return {
          id: rec.id,
          commandId: rec.commandId,
          actor: JSON.parse(rec.actorRef) as ActorRef,
          status: rec.status,
          deltaHash: rec.deltaHash ?? undefined,
          eventIds: JSON.parse(rec.eventIds) as string[],
          createdAt: rec.createdAt.toISOString(),
          error: rec.error ?? undefined,
        };
      }
    }

    if (this.context.mode === 'local') {
      return this.dispatchLocal(envelope);
    } else {
      return this.dispatchRemote(envelope);
    }
  }

  /**
   * Local Simulation Mode: simulate, apply to local VKG, and queue to outbox.
   */
  private async dispatchLocal<TPayload = any>(envelope: CommandEnvelope<TPayload>): Promise<Receipt> {
    // 1. Log command locally in pending status
    await db.insert(actorCommands).values({
      id: envelope.id,
      actorRef: JSON.stringify(envelope.actor),
      command: envelope.command,
      principal: JSON.stringify(envelope.principal),
      payload: JSON.stringify(envelope.payload),
      idempotencyKey: envelope.idempotencyKey,
      causationId: envelope.causationId ?? null,
      correlationId: envelope.correlationId ?? null,
      status: 'pending',
      createdAt: new Date(),
    });

    // 2. Resolve actor behavior
    let behavior;
    try {
      behavior = ActorRegistry.getInstance().resolve(envelope.actor.kind);
    } catch (error: any) {
      return this.recordRejection(envelope, 'rejected_local', `RegistryError: ${error.message}`);
    }

    // 3. Resolve command spec
    const spec = behavior.commands[envelope.command];
    if (!spec) {
      return this.recordRejection(
        envelope,
        'rejected_local',
        `Command '${envelope.command}' not supported by actor kind '${envelope.actor.kind}'.`
      );
    }

    // 4. Authorization check (local)
    if (!spec.roles.includes(envelope.principal.role)) {
      return this.recordRejection(
        envelope,
        'rejected_local',
        `AuthorizationError: Role '${envelope.principal.role}' is not authorized to execute command '${envelope.command}'.`
      );
    }

    // 5. Input validation check (local)
    let isValidInput = false;
    try {
      isValidInput = await spec.inputValidator(envelope.payload);
    } catch (error: any) {
      return this.recordRejection(envelope, 'rejected_local', `ValidationError: ${error.message}`);
    }

    if (!isValidInput) {
      return this.recordRejection(
        envelope,
        'rejected_local',
        `ValidationError: Input payload validation failed for command '${envelope.command}'.`
      );
    }

    // 6. Optimistic delta calculation under local supervision
    const supervisionPolicy = behavior.supervise ?? {
      maxRetries: 3,
      backoffMs: 50,
      strategy: 'restart',
    };

    let delta;
    try {
      delta = await ActorSupervisor.execute(async () => {
        return await spec.construct(envelope.payload, envelope.actor);
      }, supervisionPolicy);
    } catch (error: any) {
      return this.recordRejection(envelope, 'rejected_local', `ExecutionError: ${error.message}`);
    }

    // 7. Apply Delta optimistically to local VKG
    try {
      if (delta.remove && delta.remove.length > 0) {
        await this.vkgClient.removeQuads(delta.remove);
      }
      if (delta.add && delta.add.length > 0) {
        await this.vkgClient.addQuads(delta.add);
      }
    } catch (error: any) {
      return this.recordRejection(envelope, 'rejected_local', `VKGWriteError: ${error.message}`);
    }

    // 8. Generate local event logs
    const eventIds: string[] = [];
    const eventEnvelopes: EventEnvelope[] = [];

    for (const eventType of spec.emits) {
      const eventId = `evt_${Math.random().toString(36).substr(2, 9)}`;
      eventIds.push(eventId);

      const eventEnv: EventEnvelope = {
        id: eventId,
        commandId: envelope.id,
        actor: envelope.actor,
        type: eventType,
        payload: envelope.payload,
        createdAt: new Date().toISOString(),
      };
      eventEnvelopes.push(eventEnv);

      await db.insert(actorEvents).values({
        id: eventId,
        commandId: envelope.id,
        actorRef: JSON.stringify(envelope.actor),
        type: eventType,
        payload: JSON.stringify(envelope.payload),
        createdAt: new Date(),
      });
    }

    // Retrieve previous receipt's hash from local DB to bind states cryptographically
    const lastReceipts = await db
      .select({ deltaHash: actorReceipts.deltaHash })
      .from(actorReceipts)
      .orderBy(desc(actorReceipts.createdAt))
      .limit(1);
    const prevHash = lastReceipts[0]?.deltaHash || '';
    const hashData = { commandId: envelope.id, status: 'accepted_pending', error: undefined };
    const deltaHash = generateReceiptHash(prevHash, hashData);

    // 9. Save local receipt as accepted_pending
    const receiptId = `rec_${Math.random().toString(36).substr(2, 9)}`;
    const receipt: Receipt = {
      id: receiptId,
      commandId: envelope.id,
      actor: envelope.actor,
      status: 'accepted_pending',
      deltaHash,
      eventIds,
      createdAt: new Date().toISOString(),
    };

    await db.insert(actorReceipts).values({
      id: receiptId,
      commandId: envelope.id,
      actorRef: JSON.stringify(envelope.actor),
      status: 'accepted_pending',
      deltaHash,
      eventIds: JSON.stringify(eventIds),
      error: null,
      createdAt: new Date(),
    });

    try {
      const { useActorOpsStore } = require('./actorOps');
      useActorOpsStore.getState().setLatestReceipt(receipt);
      if (eventIds.length > 0) {
        useActorOpsStore.getState().setLatestEvent(spec.emits[spec.emits.length - 1]);
      }
    } catch (e) {}

    // 10. Queue command + local delta to outbox table explicitly for authoritative execution
    const outboxJobId = `out_${Math.random().toString(36).substr(2, 9)}`;
    await db.insert(actorOutbox).values({
      id: outboxJobId,
      commandId: envelope.id,
      jobType: 'DISPATCH_AUTHORITATIVE',
      payload: JSON.stringify({
        envelope,
        delta: {
          add: delta.add.map(serializeQuad),
          remove: delta.remove.map(serializeQuad),
        },
      }),
      status: 'pending',
      attempts: 0,
      createdAt: new Date(),
    });

    return receipt;
  }

  /**
   * Remote Authoritative Mode: validate, compile construct delta, and finalise receipt.
   */
  private async dispatchRemote<TPayload = any>(envelope: CommandEnvelope<TPayload>): Promise<Receipt> {
    try {
      const { isRemoteRejectionMocked } = require('./actorOps');
      if (isRemoteRejectionMocked()) {
        return this.createRemoteRejection(
          envelope,
          `ValidationError: Remote authority validation failed (Mock Rejection Active)`
        );
      }
    } catch (e) {}

    // 1. Resolve actor behavior
    let behavior;
    try {
      behavior = ActorRegistry.getInstance().resolve(envelope.actor.kind);
    } catch (error: any) {
      return this.createRemoteRejection(envelope, `RegistryError: ${error.message}`);
    }

    // 2. Resolve command spec
    const spec = behavior.commands[envelope.command];
    if (!spec) {
      return this.createRemoteRejection(
        envelope,
        `Command '${envelope.command}' not supported by actor kind '${envelope.actor.kind}'.`
      );
    }

    // 3. Authoritative role checks
    if (!spec.roles.includes(envelope.principal.role)) {
      return this.createRemoteRejection(
        envelope,
        `AuthorizationError: Role '${envelope.principal.role}' is not authorized to execute command '${envelope.command}'.`
      );
    }

    // 4. Authoritative input checks
    let isValidInput = false;
    try {
      isValidInput = await spec.inputValidator(envelope.payload);
    } catch (error: any) {
      return this.createRemoteRejection(envelope, `ValidationError: ${error.message}`);
    }

    if (!isValidInput) {
      return this.createRemoteRejection(
        envelope,
        `ValidationError: Input payload validation failed for command '${envelope.command}'.`
      );
    }

    // 5. Authoritative delta compilation
    const supervisionPolicy = behavior.supervise ?? {
      maxRetries: 3,
      backoffMs: 50,
      strategy: 'restart',
    };

    let delta;
    try {
      delta = await ActorSupervisor.execute(async () => {
        return await spec.construct(envelope.payload, envelope.actor);
      }, supervisionPolicy);
    } catch (error: any) {
      return this.createRemoteRejection(envelope, `ExecutionError: ${error.message}`);
    }

    // Generate event IDs for receipt finalisation
    const eventIds = spec.emits.map(() => `evt_remote_${Math.random().toString(36).substr(2, 9)}`);

    // Compute Delta Hash
    const rawDeltaStr = JSON.stringify(
      delta.add.map((q) => [q.subject.value, q.predicate.value, q.object.value, q.graph.value])
        .concat(delta.remove.map((q) => [q.subject.value, q.predicate.value, q.object.value, q.graph.value]))
    );
    let hashVal = 0;
    for (let i = 0; i < rawDeltaStr.length; i++) {
      hashVal = (hashVal << 5) - hashVal + rawDeltaStr.charCodeAt(i);
      hashVal |= 0;
    }
    const deltaHash = `hash_${Math.abs(hashVal).toString(16)}`;

    // Return applied_remote receipt
    return {
      id: `rec_remote_${Math.random().toString(36).substr(2, 9)}`,
      commandId: envelope.id,
      actor: envelope.actor,
      status: 'applied_remote',
      deltaHash,
      eventIds,
      createdAt: new Date().toISOString(),
    };
  }

  /**
   * Processes all pending actorOutbox jobs by dispatching to the authoritative remote.
   * Performs reconciliation and compensating rollback on rejection.
   */
  public async syncOutbox(remoteDispatcher: ActorDispatcher): Promise<void> {
    let offline = false;
    try {
      const { isNetworkOffline } = require('./actorOps');
      offline = isNetworkOffline();
    } catch (e) {}
    if (offline) {
      throw new Error("NetworkError: Device is offline");
    }

    const jobs = await db
      .select()
      .from(actorOutbox)
      .where(eq(actorOutbox.status, 'pending'));

    for (const job of jobs) {
      // Mark as processing
      await db
        .update(actorOutbox)
        .set({ status: 'processing', attempts: job.attempts + 1 })
        .where(eq(actorOutbox.id, job.id));

      job.attempts++;

      try {
        const jobData = JSON.parse(job.payload);
        const envelope = jobData.envelope as CommandEnvelope;
        const serializedDelta = jobData.delta;

        // Dispatch to authoritative remote dispatcher
        const remoteReceipt = await remoteDispatcher.dispatch(envelope);

        if (remoteReceipt.status === 'applied_remote') {
          // Update local receipt to applied_remote
          await db
            .update(actorReceipts)
            .set({ status: 'applied_remote', deltaHash: remoteReceipt.deltaHash })
            .where(eq(actorReceipts.commandId, envelope.id));

          // Update local command to applied
          await db
            .update(actorCommands)
            .set({ status: 'applied' })
            .where(eq(actorCommands.id, envelope.id));

          // Queue receipt sync to remote Supabase DB
          await this.syncEngine.queueJob({
            jobType: 'ACTOR_RECEIPT',
            payload: JSON.stringify(remoteReceipt),
            entityId: envelope.actor.id,
          });

          try {
            const { useActorOpsStore } = require('./actorOps');
            useActorOpsStore.getState().setLatestReceipt(remoteReceipt);
          } catch (e) {}

          // Mark job as completed
          await db
            .update(actorOutbox)
            .set({ status: 'completed' })
            .where(eq(actorOutbox.id, job.id));
        } else if (remoteReceipt.status === 'rejected_remote') {
          // ROLLBACK & COMPENSATE local optimistic VKG quads changes
          if (serializedDelta) {
            try {
              const addQuads = (serializedDelta.add || []).map(deserializeQuad);
              const removeQuads = (serializedDelta.remove || []).map(deserializeQuad);

              // Revert: remove what was optimistically added, and add back what was optimistically removed
              if (addQuads.length > 0) {
                await this.vkgClient.removeQuads(addQuads);
              }
              if (removeQuads.length > 0) {
                await this.vkgClient.addQuads(removeQuads);
              }
            } catch (e: any) {
              console.error("ROLLBACK EXCEPTION:", e);
            }
          }

          // Update local receipt to rejected_remote
          await db
            .update(actorReceipts)
            .set({ status: 'rejected_remote', error: remoteReceipt.error })
            .where(eq(actorReceipts.commandId, envelope.id));

          // Update local command to rejected
          await db
            .update(actorCommands)
            .set({ status: 'rejected' })
            .where(eq(actorCommands.id, envelope.id));

          // Log to quarantine table explicitly
          await db.insert(actorQuarantine).values({
            id: `quar_${Math.random().toString(36).substr(2, 9)}`,
            commandId: envelope.id,
            actorRef: JSON.stringify(envelope.actor),
            payload: JSON.stringify(envelope.payload),
            error: remoteReceipt.error || 'Authoritative remote rejection',
            createdAt: new Date(),
          });

          // Queue receipt sync to Supabase DB
          await this.syncEngine.queueJob({
            jobType: 'ACTOR_RECEIPT',
            payload: JSON.stringify(remoteReceipt),
            entityId: envelope.actor.id,
          });

          try {
            const { useActorOpsStore } = require('./actorOps');
            useActorOpsStore.getState().setLatestReceipt(remoteReceipt);
          } catch (e) {}

          // Mark job as failed
          await db
            .update(actorOutbox)
            .set({ status: 'failed' })
            .where(eq(actorOutbox.id, job.id));
        }
      } catch (error: any) {
        // Retry logic: mark job back as pending if within retry limit
        const status = job.attempts >= 3 ? 'failed' : 'pending';
        await db
          .update(actorOutbox)
          .set({ status })
          .where(eq(actorOutbox.id, job.id));
      }
    }
  }

  /**
   * Helper to write a rejected receipt to local DB.
   */
  private async recordRejection(
    envelope: CommandEnvelope,
    status: ReceiptStatus,
    reason: string
  ): Promise<Receipt> {
    const receiptId = `rec_${Math.random().toString(36).substr(2, 9)}`;
    const receipt: Receipt = {
      id: receiptId,
      commandId: envelope.id,
      actor: envelope.actor,
      status,
      eventIds: [],
      error: reason,
      createdAt: new Date().toISOString(),
    };

    await db.insert(actorReceipts).values({
      id: receiptId,
      commandId: envelope.id,
      actorRef: JSON.stringify(envelope.actor),
      status,
      deltaHash: null,
      eventIds: JSON.stringify([]),
      error: reason,
      createdAt: new Date(),
    });

    try {
      const { useActorOpsStore } = require('./actorOps');
      useActorOpsStore.getState().setLatestReceipt(receipt);
    } catch (e) {}

    // Update command status locally
    await db.update(actorCommands)
      .set({ status: 'rejected' })
      .where(eq(actorCommands.id, envelope.id));

    return receipt;
  }

  /**
   * Creates a mock authoritative remote rejection receipt envelope.
   */
  private createRemoteRejection(envelope: CommandEnvelope, reason: string): Receipt {
    return {
      id: `rec_remote_${Math.random().toString(36).substr(2, 9)}`,
      commandId: envelope.id,
      actor: envelope.actor,
      status: 'rejected_remote',
      eventIds: [],
      error: reason,
      createdAt: new Date().toISOString(),
    };
  }
}
