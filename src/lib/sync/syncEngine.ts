/**
 * @module syncEngine
 * @namespace @truex/membrane-client
 *
 * DrizzleSyncStorageAdapter — PATQ-law-compliant SQLite storage adapter.
 *
 * Pre-Admission Tension Queue (PATQ) Law:
 *   1. ALL jobs MUST be evaluated by the AdmissionGate before any SQLite write.
 *   2. A BLAKE3 receipt MUST be generated and persisted BEFORE the event row is inserted.
 *   3. Gate-rejected events are NEVER silently dropped — they are written to
 *      sync_job_quarantine with the full payload and rejection reason.
 *
 * Receipted Chatman Equation: R ⊢ A = μ(O*)
 *   Every insertJob action is backed by a cryptographic BLAKE3 receipt written to
 *   sync_admission_receipts before the sync_queue row is created.
 */

import { db } from '../db/db';
import {
  syncQueue,
  syncAdmissionReceipts,
  syncJobQuarantine,
  type SyncJob,
  type NewSyncJob,
} from '../db/schema';
import { eq, inArray, asc, and } from 'drizzle-orm';
import { FrameworkSyncEngine, SyncStorageAdapter } from '@pcp/sync';
import {
  DefaultAdmissionGate,
  type AdmissionGate,
  type SyncEvent,
} from './TrueXSyncReplicationEngine';
import { blake3, canonicalStringify } from '../crypto/receipts';

// ─────────────────────────────────────────────────────────────────────────────
// BLAKE3 receipt helpers (scoped to the outbox adapter)
// ─────────────────────────────────────────────────────────────────────────────

const GENESIS_PREVIOUS_HASH = blake3('@truex/membrane-client:outbox-admission:genesis');

/**
 * Compute the payload hash for a sync job candidate.
 * Uses canonical JSON so that equivalent payloads always yield identical hashes.
 */
function computePayloadHash(jobType: string, payload: string, entityId?: string | null): string {
  const canonical = canonicalStringify({ entityId: entityId ?? null, jobType, payload });
  return blake3(canonical);
}

/**
 * Compute the chained BLAKE3 receipt hash.
 *
 * receiptHash = BLAKE3(previousReceiptHash + payloadHash + admittedAt + jobType)
 *
 * Including previousReceiptHash forms an unforgeable chain: tampering with any
 * earlier receipt invalidates all subsequent ones.
 */
function computeReceiptHash(
  previousReceiptHash: string,
  payloadHash: string,
  admittedAt: string,
  jobType: string
): string {
  const meta = canonicalStringify({ admittedAt, jobType, payloadHash, previousReceiptHash });
  return blake3(meta);
}

function deriveReceiptId(receiptHash: string): string {
  return `rcpt_${receiptHash.substring(0, 32)}`;
}

/**
 * Retrieve the most recent receipt hash from the admission receipts table.
 * Returns the genesis hash when no prior receipts exist.
 */
async function getLatestReceiptHash(): Promise<string> {
  // SQLite doesn't have a native "ORDER BY created_at DESC LIMIT 1" on text admitted_at,
  // but admitted_at is ISO-8601 so lexicographic ordering is correct.
  // We fetch all and pick the last; in production this is bounded by the compaction cycle.
  const rows = (await db
    .select({
      receiptHash: syncAdmissionReceipts.receiptHash,
      admittedAt: syncAdmissionReceipts.admittedAt,
    })
    .from(syncAdmissionReceipts)) as any[];

  if (rows.length === 0) {
    return GENESIS_PREVIOUS_HASH;
  }

  // Find the receipt with the lexicographically largest admitted_at.
  // In the rare event of a tie we return an arbitrary one (still safe because
  // the chain is ordered by insertion anyway).
  let best = rows[0];
  for (const row of rows) {
    if (row.admittedAt > best.admittedAt) {
      best = row;
    }
  }
  return best.receiptHash;
}

// ─────────────────────────────────────────────────────────────────────────────
// AdmissionGateError — thrown on gate rejection so callers get rich context
// ─────────────────────────────────────────────────────────────────────────────

export class AdmissionGateError extends Error {
  constructor(
    public readonly verdict: 'reject' | 'quarantine',
    public readonly reason: string,
    public readonly jobType: string,
    public readonly entityId?: string | null
  ) {
    super(
      `[PATQ] Admission gate ${verdict}ed job (type=${jobType}, entity=${entityId ?? 'none'}): ${reason}`
    );
    this.name = 'AdmissionGateError';
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// DrizzleSyncStorageAdapter — PATQ-compliant SQLite storage adapter
// ─────────────────────────────────────────────────────────────────────────────

class DrizzleSyncStorageAdapter implements SyncStorageAdapter<SyncJob> {
  private readonly gate: AdmissionGate;

  constructor(gate: AdmissionGate = new DefaultAdmissionGate()) {
    this.gate = gate;
  }

  /**
   * PATQ-enforced job insertion.
   *
   * Phase 1 — Gate evaluation (synchronous, no I/O):
   *   The AdmissionGate inspects the candidate event. Rejected or quarantined
   *   events are written to sync_job_quarantine and an AdmissionGateError is thrown.
   *
   * Phase 2 — BLAKE3 receipt generation & persistence (BEFORE event row):
   *   A chained BLAKE3 receipt is written to sync_admission_receipts with
   *   status='pre_insert'. This must succeed before the event row is created.
   *
   * Phase 3 — Event row insertion:
   *   The sync_queue row is created. On success the receipt is updated to
   *   status='committed'. On failure the receipt status is set to 'failed'.
   *
   * Throws AdmissionGateError if the gate rejects or quarantines the job.
   * Throws on SQLite errors (caller may handle or propagate).
   */
  async insertJob(
    job: Omit<SyncJob, 'id' | 'status' | 'attempts' | 'createdAt'>
  ): Promise<SyncJob> {
    // ── Phase 1: Gate evaluation — build a SyncEvent from the job for evaluation
    const candidateEvent: SyncEvent = {
      entityId: job.entityId ?? '',
      eventType: job.jobType,
      payload: (() => {
        try {
          return JSON.parse(job.payload) as Record<string, unknown>;
        } catch {
          return { _raw: job.payload };
        }
      })(),
      // Use a deterministic idempotency key based on content so the gate has a
      // non-empty key to validate. Callers that need true idempotency should
      // embed the key inside the payload itself.
      idempotencyKey: blake3(
        canonicalStringify({
          entityId: job.entityId ?? '',
          jobType: job.jobType,
          payload: job.payload,
        })
      ),
      occurredAt: new Date().toISOString(),
    };

    const decision = this.gate.evaluate(candidateEvent);

    if (decision.verdict !== 'admit') {
      // Quarantine the rejected event — NEVER silently drop it
      try {
        await db.insert(syncJobQuarantine).values({
          jobType: job.jobType,
          payload: job.payload,
          entityId: job.entityId ?? null,
          rejectionReason: decision.reason,
          verdict: decision.verdict,
        });
      } catch (quarantineErr: unknown) {
        const msg = quarantineErr instanceof Error ? quarantineErr.message : String(quarantineErr);
        console.error('[PATQ] CRITICAL: Failed to write rejected job to quarantine table:', {
          jobType: job.jobType,
          entityId: job.entityId,
          verdict: decision.verdict,
          error: msg,
        });
      }

      throw new AdmissionGateError(decision.verdict, decision.reason, job.jobType, job.entityId);
    }

    // ── Phase 2: Generate BLAKE3 receipt and persist BEFORE the event row
    const admittedAt = new Date().toISOString();
    const payloadHash = computePayloadHash(job.jobType, job.payload, job.entityId);
    const previousReceiptHash = await getLatestReceiptHash();
    const receiptHash = computeReceiptHash(
      previousReceiptHash,
      payloadHash,
      admittedAt,
      job.jobType
    );
    const receiptId = deriveReceiptId(receiptHash);

    // Insert receipt with status='pre_insert' — this MUST succeed before the event row
    await db.insert(syncAdmissionReceipts).values({
      id: receiptId,
      jobId: null, // populated after the event row is created
      jobType: job.jobType,
      entityId: job.entityId ?? null,
      payloadHash,
      previousReceiptHash,
      receiptHash,
      admittedAt,
      status: 'pre_insert',
      error: null,
    });

    // ── Phase 3: Insert the event row (sync_queue)
    let inserted: SyncJob;
    try {
      const [row] = await db
        .insert(syncQueue)
        .values({
          jobType: job.jobType,
          payload: job.payload,
          entityId: job.entityId ?? null,
          status: 'pending',
          attempts: 0,
        })
        .returning();

      inserted = row as SyncJob;
    } catch (insertErr: unknown) {
      // Roll receipt back to 'failed' — the event was never created
      const msg = insertErr instanceof Error ? insertErr.message : String(insertErr);
      try {
        await db
          .update(syncAdmissionReceipts)
          .set({ status: 'failed', error: msg })
          .where(eq(syncAdmissionReceipts.id, receiptId));
      } catch {
        // best-effort: log and continue
        console.error('[PATQ] Failed to mark receipt as failed after event insert error:', msg);
      }
      throw insertErr;
    }

    // ── Commit receipt: update jobId and status to 'committed'
    try {
      await db
        .update(syncAdmissionReceipts)
        .set({ jobId: inserted.id, status: 'committed' })
        .where(eq(syncAdmissionReceipts.id, receiptId));
    } catch (commitErr: unknown) {
      // Non-fatal: the event row is in SQLite and will be processed. The receipt
      // just won't have a jobId backlink. Log for auditability.
      const msg = commitErr instanceof Error ? commitErr.message : String(commitErr);
      console.error('[PATQ] Failed to commit admission receipt after event insert:', {
        receiptId,
        jobId: inserted.id,
        error: msg,
      });
    }

    return inserted;
  }

  async updateJobStatus(id: number, status: SyncJob['status'], attempts?: number): Promise<void> {
    const updates: any = { status };
    if (attempts !== undefined) {
      updates.attempts = attempts;
    }
    await db.update(syncQueue).set(updates).where(eq(syncQueue.id, id));
  }

  async updateJob(
    id: number,
    updates: Partial<Omit<SyncJob, 'id' | 'status' | 'attempts' | 'createdAt'>>
  ): Promise<void> {
    await db
      .update(syncQueue)
      .set(updates as any)
      .where(eq(syncQueue.id, id));
  }

  async deleteJob(id: number): Promise<void> {
    await db.delete(syncQueue).where(eq(syncQueue.id, id));
  }

  async getReadyJobs(supportedJobTypes?: string[]): Promise<SyncJob[]> {
    const baseWhere = inArray(syncQueue.status, ['pending', 'failed']);
    const whereClause = supportedJobTypes
      ? and(baseWhere, inArray(syncQueue.jobType, supportedJobTypes))
      : baseWhere;

    return (await db
      .select()
      .from(syncQueue)
      .where(whereClause)
      .orderBy(asc(syncQueue.id))) as SyncJob[];
  }

  async getBlockedEntityIds(supportedJobTypes?: string[]): Promise<Set<string>> {
    const blockedBaseWhere = inArray(syncQueue.status, ['quarantined', 'processing']);
    const blockedWhereClause = supportedJobTypes
      ? and(blockedBaseWhere, inArray(syncQueue.jobType, supportedJobTypes))
      : blockedBaseWhere;

    const blockedJobs = await db
      .select({ entityId: syncQueue.entityId })
      .from(syncQueue)
      .where(blockedWhereClause);

    const blockedEntityIds = new Set<string>();
    for (const bj of blockedJobs) {
      if (bj.entityId) {
        blockedEntityIds.add(bj.entityId);
      }
    }
    return blockedEntityIds;
  }

  async resetJobsStatus(
    fromStatus: SyncJob['status'],
    toStatus: SyncJob['status'],
    supportedJobTypes?: string[],
    resetAttempts?: boolean
  ): Promise<void> {
    const whereClause = supportedJobTypes
      ? and(eq(syncQueue.status, fromStatus), inArray(syncQueue.jobType, supportedJobTypes))
      : eq(syncQueue.status, fromStatus);

    const updates: any = { status: toStatus };
    if (resetAttempts) {
      updates.attempts = 0;
    }

    await db.update(syncQueue).set(updates).where(whereClause);
  }

  async getQueueStatus(supportedJobTypes?: string[]) {
    const whereClause = supportedJobTypes
      ? inArray(syncQueue.jobType, supportedJobTypes)
      : undefined;

    const jobs = (await (whereClause
      ? db.select().from(syncQueue).where(whereClause)
      : db.select().from(syncQueue))) as SyncJob[];

    return {
      total: jobs.length,
      pending: jobs.filter((j) => j.status === 'pending').length,
      processing: jobs.filter((j) => j.status === 'processing').length,
      failed: jobs.filter((j) => j.status === 'failed').length,
      quarantined: jobs.filter((j) => j.status === 'quarantined').length,
      jobs,
    };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Exports
// ─────────────────────────────────────────────────────────────────────────────

export const defaultStorageAdapter = new DrizzleSyncStorageAdapter();

/**
 * Abstract SyncEngine for local-first database operations outbox.
 * Manages FIFO queue processing, concurrent serialization by entity, and poison-pill quarantine.
 *
 * All jobs inserted via queueJob() pass through the DefaultAdmissionGate and receive
 * a BLAKE3 receipt BEFORE any SQLite event row is written (PATQ law compliance).
 */
export abstract class SyncEngine extends FrameworkSyncEngine<SyncJob> {
  constructor(gate?: AdmissionGate) {
    super(new DrizzleSyncStorageAdapter(gate ?? new DefaultAdmissionGate()));
  }

  // queueJob must be compatible with existing calls
  public async queueJob(
    job: Omit<NewSyncJob, 'id' | 'status' | 'attempts' | 'createdAt'>
  ): Promise<SyncJob> {
    return super.queueJob(job as any);
  }
}
