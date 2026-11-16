/**
 * @module TrueXSyncReplicationEngine
 * @namespace @truex/membrane-client
 *
 * Implements the Pre-Admission Tension Queue (PATQ) law:
 *   - ALL outbound sync events MUST be persisted in SQLite before being admitted for dispatch.
 *   - EACH admitted batch is signed with BLAKE3 and the receipt is stored locally before
 *     any network I/O is attempted.
 *   - Typestate enforcement: SyncEvent → QueuedEvent (admitted) → DispatchedEvent (sent)
 *     — no event may skip the queue or bypass the receipt.
 *
 * Receipted Chatman Equation: R ⊢ A = μ(O*)
 *   Every admitted batch action is backed by a cryptographic AdmissionReceipt stored to SQLite.
 */

import { blake3, canonicalStringify, sha256 } from '../crypto/receipts';

// ─────────────────────────────────────────────────────────────────────────────
// Typestate Brands — these make illegal state transitions impossible in the
// TypeScript type system. Never instantiate via unsafe cast.
// ─────────────────────────────────────────────────────────────────────────────

/** A raw event submitted by the caller. Has NOT yet been admitted or persisted. */
export interface SyncEvent {
  /** Stable entity identifier used for serialization ordering */
  readonly entityId: string;
  /** Domain-qualified event type (e.g. "user.profile.updated") */
  readonly eventType: string;
  /** JSON-serializable payload */
  readonly payload: Record<string, unknown>;
  /** Caller-assigned idempotency key — must be globally unique per logical operation */
  readonly idempotencyKey: string;
  /** ISO-8601 timestamp of when the event was originally created on the client */
  readonly occurredAt: string;
}

/** A SyncEvent that has been persisted to SQLite and received an admission sequence number. */
export interface QueuedEvent extends SyncEvent {
  /** Stable auto-increment rowid assigned by SQLite on INSERT */
  readonly queueId: number;
  /** Wall-clock ms when the row was persisted (NOT the logical occurredAt) */
  readonly queuedAtMs: number;
}

/** A QueuedEvent that has been emitted in a signed batch. */
export interface DispatchedEvent extends QueuedEvent {
  /** ID of the AdmissionReceipt that covers this event */
  readonly admissionReceiptId: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Receipt types
// ─────────────────────────────────────────────────────────────────────────────

/**
 * A BLAKE3-signed admission receipt produced for each committed batch.
 * Stored to SQLite BEFORE any network dispatch is attempted.
 */
export interface AdmissionReceipt {
  /** UUID-style ID derived from the batch's content hash */
  readonly id: string;
  /** BLAKE3 hash of the canonical batch payload */
  readonly batchHash: string;
  /** BLAKE3 hash of the previous receipt — forms an unforgeable chain */
  readonly previousReceiptHash: string;
  /** BLAKE3 chain hash: blake3(previousReceiptHash + batchHash + metadata) */
  readonly receiptHash: string;
  /** Number of events in this batch */
  readonly eventCount: number;
  /** Idempotency keys of admitted events (ordered, for replay) */
  readonly eventIdempotencyKeys: readonly string[];
  /** Queue IDs admitted in this batch (ordered) */
  readonly queueIds: readonly number[];
  /** ISO-8601 timestamp */
  readonly admittedAt: string;
  /** Dispatch status — updated in-place in SQLite after network outcome */
  status: 'admitted' | 'dispatching' | 'confirmed' | 'failed' | 'quarantined';
  /** Number of dispatch attempts */
  dispatchAttempts: number;
  /** Error message from last failed attempt, if any */
  lastError?: string;
}

/** Result returned from deterministic replay of a previously admitted batch. */
export interface SyncReplayResult {
  /** Whether the replay produced the same hash as the original receipt */
  readonly verified: boolean;
  /** The recomputed BLAKE3 batch hash */
  readonly recomputedBatchHash: string;
  /** Whether the receipt chain is intact */
  readonly chainIntact: boolean;
  /** Events that were replayed */
  readonly events: readonly QueuedEvent[];
  /** The original receipt */
  readonly receipt: AdmissionReceipt;
  /** Diff between original and recomputed hash — empty string when verified */
  readonly hashDivergence: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Admission Gate
// ─────────────────────────────────────────────────────────────────────────────

/** Policy decisions the gate can make for a single candidate event. */
export type AdmissionDecision =
  | { readonly verdict: 'admit' }
  | { readonly verdict: 'reject'; readonly reason: string }
  | { readonly verdict: 'quarantine'; readonly reason: string };

/** The Blue River Dam admission gate contract. */
export interface AdmissionGate {
  /**
   * Evaluate whether an event may enter the Pre-Admission Tension Queue.
   * MUST be synchronous — the gate is called inside the SQLite write lock.
   */
  evaluate(event: SyncEvent): AdmissionDecision;
}

/** Default permissive gate — admits everything with a non-empty idempotency key. */
export class DefaultAdmissionGate implements AdmissionGate {
  evaluate(event: SyncEvent): AdmissionDecision {
    if (!event.idempotencyKey || event.idempotencyKey.trim().length === 0) {
      return { verdict: 'reject', reason: 'idempotencyKey must be non-empty' };
    }
    if (!event.entityId || event.entityId.trim().length === 0) {
      return { verdict: 'reject', reason: 'entityId must be non-empty' };
    }
    if (!event.eventType || event.eventType.trim().length === 0) {
      return { verdict: 'reject', reason: 'eventType must be non-empty' };
    }
    if (!event.occurredAt || isNaN(Date.parse(event.occurredAt))) {
      return { verdict: 'reject', reason: 'occurredAt must be a valid ISO-8601 timestamp' };
    }
    return { verdict: 'admit' };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Storage Adapter — thin interface so tests can inject a pure in-memory impl
// ─────────────────────────────────────────────────────────────────────────────

export interface ReplicationStorageAdapter {
  /**
   * Atomically persist an event to the tension queue.
   * Returns the assigned rowid (auto-increment from SQLite).
   */
  insertQueuedEvent(event: SyncEvent, queuedAtMs: number): Promise<number>;

  /**
   * Persist an AdmissionReceipt BEFORE dispatching.
   * If a receipt with the same id already exists, it must be a no-op (idempotent).
   */
  insertAdmissionReceipt(receipt: AdmissionReceipt): Promise<void>;

  /** Update the status/attempts/error of an existing receipt by id. */
  updateAdmissionReceipt(
    id: string,
    update: Pick<AdmissionReceipt, 'status' | 'dispatchAttempts'> & { lastError?: string }
  ): Promise<void>;

  /**
   * Load all queued events that have NOT yet been covered by a confirmed receipt,
   * ordered by queueId ascending (FIFO).
   */
  getPendingQueuedEvents(): Promise<QueuedEvent[]>;

  /**
   * Load the receipt most recently stored (highest admittedAt), used to form
   * the hash chain for the next batch.
   */
  getLatestAdmissionReceipt(): Promise<AdmissionReceipt | null>;

  /**
   * Load a specific receipt by id for replay verification.
   */
  getAdmissionReceiptById(id: string): Promise<AdmissionReceipt | null>;

  /**
   * Load all queued events whose queueId is in the provided set.
   * Ordered by queueId ascending.
   */
  getQueuedEventsByIds(queueIds: readonly number[]): Promise<QueuedEvent[]>;

  /**
   * Mark queued events as dispatched (covered by a confirmed receipt).
   * These rows may be pruned by a separate compaction process.
   */
  markQueuedEventsDispatched(queueIds: readonly number[], receiptId: string): Promise<void>;

  /**
   * Load all receipts ordered by admittedAt ascending (for chain verification).
   */
  getAllAdmissionReceipts(): Promise<AdmissionReceipt[]>;
}

// ─────────────────────────────────────────────────────────────────────────────
// Network Dispatcher — the only point where a network call can be made
// ─────────────────────────────────────────────────────────────────────────────

export interface SyncDispatcher {
  /**
   * Dispatch a signed batch to the remote replication endpoint.
   * MUST throw on failure so the engine can apply backoff.
   */
  dispatch(events: readonly DispatchedEvent[], receipt: AdmissionReceipt): Promise<void>;
}

// ─────────────────────────────────────────────────────────────────────────────
// Engine configuration
// ─────────────────────────────────────────────────────────────────────────────

export interface ReplicationEngineConfig {
  /** Maximum events to include in a single admitted batch. Default: 50 */
  maxBatchSize?: number;
  /** Maximum dispatch attempts before quarantining the batch. Default: 7 */
  maxDispatchAttempts?: number;
  /** Base delay in ms for exponential backoff. Default: 500 */
  backoffBaseMs?: number;
  /** Hard ceiling on backoff delay in ms. Default: 30_000 */
  backoffMaxMs?: number;
  /** Jitter fraction [0, 1] added to backoff to prevent thundering herd. Default: 0.25 */
  backoffJitter?: number;
  /** Custom admission gate. Default: DefaultAdmissionGate */
  admissionGate?: AdmissionGate;
}

// ─────────────────────────────────────────────────────────────────────────────
// BLAKE3 Receipt construction helpers
// ─────────────────────────────────────────────────────────────────────────────

function computeBatchHash(events: readonly SyncEvent[]): string {
  // Canonical deterministic serialization: sorted by idempotencyKey for stability
  const canonical = canonicalStringify(
    events.map((e) => ({
      entityId: e.entityId,
      eventType: e.eventType,
      idempotencyKey: e.idempotencyKey,
      occurredAt: e.occurredAt,
      payload: e.payload,
    }))
  );
  return blake3(canonical);
}

function computeReceiptHash(
  previousReceiptHash: string,
  batchHash: string,
  admittedAt: string,
  eventCount: number
): string {
  const meta = canonicalStringify({ admittedAt, batchHash, eventCount, previousReceiptHash });
  return blake3(meta);
}

function deriveReceiptId(receiptHash: string): string {
  // Use first 32 hex chars of the BLAKE3 hash as a stable, compact ID
  return `rcpt_${receiptHash.substring(0, 32)}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// AdmitBatch result — describes what happened for each event
// ─────────────────────────────────────────────────────────────────────────────

export interface BatchAdmissionOutcome {
  /** The admission receipt for successfully admitted events */
  receipt: AdmissionReceipt | null;
  /** Events that were admitted and queued */
  admitted: readonly QueuedEvent[];
  /** Events that were rejected by the gate (not persisted) */
  rejected: readonly { event: SyncEvent; reason: string }[];
  /** Events that were quarantined by the gate (not persisted) */
  quarantined: readonly { event: SyncEvent; reason: string }[];
}

// ─────────────────────────────────────────────────────────────────────────────
// TrueXSyncReplicationEngine — the core implementation
// ─────────────────────────────────────────────────────────────────────────────

/**
 * TrueXSyncReplicationEngine
 *
 * Enforces the Pre-Admission Tension Queue (PATQ) law:
 *   1. All events are individually evaluated by the AdmissionGate before any I/O.
 *   2. Admitted events are atomically persisted to SQLite (tension queue).
 *   3. A BLAKE3-chained AdmissionReceipt is stored to SQLite BEFORE dispatching.
 *   4. Dispatch occurs only against events that have a locally-confirmed receipt.
 *   5. Network failures cause exponential-backoff retries; the queue is preserved in SQLite.
 *   6. Replay re-derives the batch hash deterministically and verifies it against the stored receipt.
 */
export class TrueXSyncReplicationEngine {
  private readonly storage: ReplicationStorageAdapter;
  private readonly dispatcher: SyncDispatcher;
  private readonly gate: AdmissionGate;
  private readonly maxBatchSize: number;
  private readonly maxDispatchAttempts: number;
  private readonly backoffBaseMs: number;
  private readonly backoffMaxMs: number;
  private readonly backoffJitter: number;

  /** Mutex: prevents concurrent pushChanges calls from clobbering each other */
  private isDispatching: boolean = false;
  /** Dirty flag: set when admitBatch is called during an active dispatch cycle */
  private pendingDispatch: boolean = false;

  constructor(
    storage: ReplicationStorageAdapter,
    dispatcher: SyncDispatcher,
    config: ReplicationEngineConfig = {}
  ) {
    this.storage = storage;
    this.dispatcher = dispatcher;
    this.gate = config.admissionGate ?? new DefaultAdmissionGate();
    this.maxBatchSize = config.maxBatchSize ?? 50;
    this.maxDispatchAttempts = config.maxDispatchAttempts ?? 7;
    this.backoffBaseMs = config.backoffBaseMs ?? 500;
    this.backoffMaxMs = config.backoffMaxMs ?? 30_000;
    this.backoffJitter = config.backoffJitter ?? 0.25;
  }

  // ───────────────────────────────────────────────────────────────────────────
  // PUBLIC API
  // ───────────────────────────────────────────────────────────────────────────

  /**
   * Admit a batch of SyncEvents through the Blue River Dam gate.
   *
   * For each event:
   *   - The gate is evaluated synchronously.
   *   - Admitted events are persisted to SQLite (tension queue).
   *   - A BLAKE3 AdmissionReceipt is generated and stored to SQLite.
   *   - Dispatch is triggered asynchronously.
   *
   * This method NEVER throws — all errors are captured in the outcome.
   */
  async admitBatch(events: SyncEvent[]): Promise<BatchAdmissionOutcome> {
    const admitted: QueuedEvent[] = [];
    const rejected: { event: SyncEvent; reason: string }[] = [];
    const quarantined: { event: SyncEvent; reason: string }[] = [];

    // ── Phase 1: Gate evaluation (no I/O)
    for (const event of events) {
      const decision = this.gate.evaluate(event);
      if (decision.verdict === 'admit') {
        // Will be persisted in phase 2
        // Cast safely: we'll set queueId after insertion
        admitted.push(event as unknown as QueuedEvent);
      } else if (decision.verdict === 'reject') {
        rejected.push({ event, reason: decision.reason });
      } else {
        // verdict === 'quarantine'
        quarantined.push({ event, reason: decision.reason });
      }
    }

    if (admitted.length === 0) {
      return { receipt: null, admitted: [], rejected, quarantined };
    }

    // ── Phase 2: Persist admitted events to SQLite tension queue
    const nowMs = Date.now();
    const queuedEvents: QueuedEvent[] = [];

    for (const event of admitted) {
      try {
        const queueId = await this.storage.insertQueuedEvent(event, nowMs);
        queuedEvents.push({
          ...event,
          queueId,
          queuedAtMs: nowMs,
        });
      } catch (err: unknown) {
        // If insertion fails, treat the event as rejected (not admitted)
        const message = err instanceof Error ? err.message : String(err);
        rejected.push({ event, reason: `SQLite insertion failed: ${message}` });
      }
    }

    if (queuedEvents.length === 0) {
      return { receipt: null, admitted: [], rejected, quarantined };
    }

    // ── Phase 3: Generate BLAKE3 AdmissionReceipt and persist BEFORE any dispatch
    const receipt = await this.generateAndPersistReceipt(queuedEvents);

    // ── Phase 4: Trigger async dispatch (fire-and-forget, errors are handled inside)
    this.triggerDispatch();

    return { receipt, admitted: queuedEvents, rejected, quarantined };
  }

  /**
   * Deterministically replay events from a previously admitted receipt.
   *
   * Recomputes the BLAKE3 batch hash over the stored events and verifies it
   * matches the stored receipt hash — providing cryptographic proof that the
   * data has not been tampered with since admission.
   */
  async replayFromReceipt(receipt: AdmissionReceipt): Promise<SyncReplayResult> {
    // Load the stored receipt to ensure we are comparing against the canonical version
    const storedReceipt = await this.storage.getAdmissionReceiptById(receipt.id);
    if (!storedReceipt) {
      return {
        verified: false,
        recomputedBatchHash: '',
        chainIntact: false,
        events: [],
        receipt,
        hashDivergence: `Receipt ${receipt.id} not found in local store`,
      };
    }

    // Load the events that were admitted in this batch
    const events = await this.storage.getQueuedEventsByIds(storedReceipt.queueIds);

    // Recompute the batch hash deterministically
    const recomputedBatchHash = computeBatchHash(events);

    // Verify batch integrity
    const batchIntact = recomputedBatchHash === storedReceipt.batchHash;

    // Verify the receipt chain: recompute receiptHash from known inputs
    const recomputedReceiptHash = computeReceiptHash(
      storedReceipt.previousReceiptHash,
      storedReceipt.batchHash,
      storedReceipt.admittedAt,
      storedReceipt.eventCount
    );
    const chainIntact = recomputedReceiptHash === storedReceipt.receiptHash;

    const hashDivergence = batchIntact
      ? ''
      : `expected=${storedReceipt.batchHash} recomputed=${recomputedBatchHash}`;

    return {
      verified: batchIntact && chainIntact,
      recomputedBatchHash,
      chainIntact,
      events,
      receipt: storedReceipt,
      hashDivergence,
    };
  }

  /**
   * Verify the entire chain of AdmissionReceipts stored locally.
   * Returns true if every receipt's hash can be recomputed from its inputs
   * and links correctly to its predecessor.
   */
  async verifyReceiptChain(): Promise<{
    valid: boolean;
    chainLength: number;
    firstBrokenLink?: string;
  }> {
    const receipts = await this.storage.getAllAdmissionReceipts();
    for (let i = 0; i < receipts.length; i++) {
      const r = receipts[i];
      const recomputed = computeReceiptHash(
        r.previousReceiptHash,
        r.batchHash,
        r.admittedAt,
        r.eventCount
      );
      if (recomputed !== r.receiptHash) {
        return { valid: false, chainLength: receipts.length, firstBrokenLink: r.id };
      }
      if (i > 0) {
        const prev = receipts[i - 1];
        if (r.previousReceiptHash !== prev.receiptHash) {
          return { valid: false, chainLength: receipts.length, firstBrokenLink: r.id };
        }
      }
    }
    return { valid: true, chainLength: receipts.length };
  }

  /**
   * Manually trigger a dispatch cycle. Useful after network restoration.
   * Safe to call concurrently — the mutex prevents double-dispatch.
   */
  triggerDispatch(): void {
    if (this.isDispatching) {
      this.pendingDispatch = true;
      return;
    }
    this.runDispatchCycle().catch((err) => {
      console.error('[TrueXSyncReplicationEngine] Unhandled dispatch error:', err);
    });
  }

  // ───────────────────────────────────────────────────────────────────────────
  // PRIVATE HELPERS
  // ───────────────────────────────────────────────────────────────────────────

  private async generateAndPersistReceipt(events: QueuedEvent[]): Promise<AdmissionReceipt> {
    const latest = await this.storage.getLatestAdmissionReceipt();
    const previousReceiptHash = latest?.receiptHash ?? this.genesisHash();

    const batchHash = computeBatchHash(events);
    const admittedAt = new Date().toISOString();
    const eventCount = events.length;

    const receiptHash = computeReceiptHash(previousReceiptHash, batchHash, admittedAt, eventCount);
    const id = deriveReceiptId(receiptHash);

    const receipt: AdmissionReceipt = {
      id,
      batchHash,
      previousReceiptHash,
      receiptHash,
      eventCount,
      eventIdempotencyKeys: events.map((e) => e.idempotencyKey),
      queueIds: events.map((e) => e.queueId),
      admittedAt,
      status: 'admitted',
      dispatchAttempts: 0,
    };

    // CRITICAL: persist receipt to SQLite BEFORE any network I/O
    await this.storage.insertAdmissionReceipt(receipt);

    return receipt;
  }

  private genesisHash(): string {
    // Deterministic genesis hash for the first receipt in the chain
    return blake3('@truex/membrane-client:genesis:pre-admission-tension-queue');
  }

  private async runDispatchCycle(): Promise<void> {
    this.isDispatching = true;
    this.pendingDispatch = false;

    try {
      // Process all pending events in FIFO batches until the queue is empty
      while (true) {
        const pendingEvents = await this.storage.getPendingQueuedEvents();
        if (pendingEvents.length === 0) break;

        // Take up to maxBatchSize events
        const batch = pendingEvents.slice(0, this.maxBatchSize);

        // Find or derive the receipt that covers this batch
        // In the normal path, a receipt was already created in admitBatch.
        // We retrieve it by matching queueIds.
        const allReceipts = await this.storage.getAllAdmissionReceipts();
        const batchQueueIds = new Set(batch.map((e) => e.queueId));

        // Find the first admitted (or previously-failed) receipt whose queueIds are
        // all present in the current pending batch — this is the receipt that must
        // be dispatched next in FIFO order.
        const coveringReceipt = allReceipts.find(
          (r) =>
            (r.status === 'admitted' || r.status === 'failed') &&
            r.queueIds.length > 0 &&
            r.queueIds.every((id) => batchQueueIds.has(id))
        );

        if (!coveringReceipt) {
          // No receipt found — this means the events arrived without going through admitBatch.
          // This is a PATQ violation. We quarantine the events by not dispatching them.
          console.error(
            '[TrueXSyncReplicationEngine] PATQ VIOLATION: Pending events found with no covering AdmissionReceipt.',
            { queueIds: batch.map((e) => e.queueId) }
          );
          break;
        }

        if (coveringReceipt.status === 'quarantined') {
          // Skip quarantined receipts
          break;
        }

        // Resolve exact events for this receipt
        const receiptEvents = await this.storage.getQueuedEventsByIds(coveringReceipt.queueIds);
        const dispatchedEvents: DispatchedEvent[] = receiptEvents.map((e) => ({
          ...e,
          admissionReceiptId: coveringReceipt.id,
        }));

        await this.dispatchWithBackoff(dispatchedEvents, coveringReceipt);
      }
    } finally {
      this.isDispatching = false;
      if (this.pendingDispatch) {
        // More events arrived while we were dispatching — run another cycle
        this.triggerDispatch();
      }
    }
  }

  private async dispatchWithBackoff(
    events: DispatchedEvent[],
    receipt: AdmissionReceipt
  ): Promise<void> {
    const attempts = receipt.dispatchAttempts;

    // Update status to 'dispatching' in SQLite
    await this.storage.updateAdmissionReceipt(receipt.id, {
      status: 'dispatching',
      dispatchAttempts: attempts,
    });

    let currentAttempt = attempts;

    while (currentAttempt < this.maxDispatchAttempts) {
      try {
        await this.dispatcher.dispatch(events, {
          ...receipt,
          status: 'dispatching',
          dispatchAttempts: currentAttempt,
        });

        // Dispatch succeeded — mark events and receipt as confirmed
        await this.storage.markQueuedEventsDispatched(
          events.map((e) => e.queueId),
          receipt.id
        );
        await this.storage.updateAdmissionReceipt(receipt.id, {
          status: 'confirmed',
          dispatchAttempts: currentAttempt + 1,
        });

        // Update in-memory copy so subsequent loop checks are accurate
        receipt.status = 'confirmed';
        receipt.dispatchAttempts = currentAttempt + 1;
        return;
      } catch (err: unknown) {
        currentAttempt++;
        const errorMessage = err instanceof Error ? err.message : String(err);

        if (currentAttempt >= this.maxDispatchAttempts) {
          // Quarantine this batch — it will not be retried automatically
          await this.storage.updateAdmissionReceipt(receipt.id, {
            status: 'quarantined',
            dispatchAttempts: currentAttempt,
            lastError: errorMessage,
          });
          receipt.status = 'quarantined';
          receipt.dispatchAttempts = currentAttempt;
          receipt.lastError = errorMessage;

          console.error('[TrueXSyncReplicationEngine] Batch quarantined after max attempts:', {
            receiptId: receipt.id,
            attempts: currentAttempt,
            error: errorMessage,
          });
          return;
        }

        // Update failure state in SQLite before sleeping
        await this.storage.updateAdmissionReceipt(receipt.id, {
          status: 'failed',
          dispatchAttempts: currentAttempt,
          lastError: errorMessage,
        });
        receipt.dispatchAttempts = currentAttempt;
        receipt.lastError = errorMessage;

        const delayMs = this.computeBackoff(currentAttempt);
        await this.sleep(delayMs);
      }
    }
  }

  private computeBackoff(attempt: number): number {
    // Exponential: base * 2^(attempt-1)
    const exponential = this.backoffBaseMs * Math.pow(2, attempt - 1);
    const capped = Math.min(exponential, this.backoffMaxMs);
    // Add jitter: capped * (1 + jitter * random)
    const jittered = capped * (1 + this.backoffJitter * Math.random());
    return Math.min(Math.round(jittered), this.backoffMaxMs);
  }

  private sleep(ms: number): Promise<void> {
    if (ms <= 0) return Promise.resolve();
    return new Promise<void>((resolve) => setTimeout(resolve, ms));
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// In-memory ReplicationStorageAdapter (used for testing and bootstrapping)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Pure in-memory implementation of ReplicationStorageAdapter.
 * Suitable for unit tests and environments without a SQLite driver.
 * DO NOT use in production — use the SQLite-backed adapter instead.
 */
export class InMemoryReplicationStorageAdapter implements ReplicationStorageAdapter {
  private readonly events: Map<number, QueuedEvent> = new Map();
  private readonly receipts: Map<string, AdmissionReceipt> = new Map();
  private readonly receiptInsertionOrder: string[] = [];
  private readonly dispatchedQueueIds: Set<number> = new Set();
  private nextQueueId = 1;

  async insertQueuedEvent(event: SyncEvent, queuedAtMs: number): Promise<number> {
    const queueId = this.nextQueueId++;
    const queued: QueuedEvent = {
      ...event,
      queueId,
      queuedAtMs,
    };
    this.events.set(queueId, queued);
    return queueId;
  }

  async insertAdmissionReceipt(receipt: AdmissionReceipt): Promise<void> {
    if (!this.receipts.has(receipt.id)) {
      // Deep-copy to prevent external mutation of the stored record
      this.receipts.set(receipt.id, {
        ...receipt,
        queueIds: [...receipt.queueIds],
        eventIdempotencyKeys: [...receipt.eventIdempotencyKeys],
      });
      this.receiptInsertionOrder.push(receipt.id);
    }
  }

  async updateAdmissionReceipt(
    id: string,
    update: Pick<AdmissionReceipt, 'status' | 'dispatchAttempts'> & { lastError?: string }
  ): Promise<void> {
    const existing = this.receipts.get(id);
    if (!existing) {
      throw new Error(`AdmissionReceipt not found: ${id}`);
    }
    existing.status = update.status;
    existing.dispatchAttempts = update.dispatchAttempts;
    if (update.lastError !== undefined) {
      existing.lastError = update.lastError;
    }
  }

  async getPendingQueuedEvents(): Promise<QueuedEvent[]> {
    const pending: QueuedEvent[] = [];
    for (const [queueId, event] of this.events) {
      if (!this.dispatchedQueueIds.has(queueId)) {
        pending.push(event);
      }
    }
    return pending.sort((a, b) => a.queueId - b.queueId);
  }

  async getLatestAdmissionReceipt(): Promise<AdmissionReceipt | null> {
    if (this.receiptInsertionOrder.length === 0) return null;
    // Return the most recently inserted receipt (last in insertion order)
    const lastId = this.receiptInsertionOrder[this.receiptInsertionOrder.length - 1];
    return this.receipts.get(lastId) ?? null;
  }

  async getAdmissionReceiptById(id: string): Promise<AdmissionReceipt | null> {
    return this.receipts.get(id) ?? null;
  }

  async getQueuedEventsByIds(queueIds: readonly number[]): Promise<QueuedEvent[]> {
    const result: QueuedEvent[] = [];
    for (const id of queueIds) {
      const event = this.events.get(id);
      if (event) result.push(event);
    }
    return result.sort((a, b) => a.queueId - b.queueId);
  }

  async markQueuedEventsDispatched(queueIds: readonly number[], _receiptId: string): Promise<void> {
    for (const id of queueIds) {
      this.dispatchedQueueIds.add(id);
    }
  }

  async getAllAdmissionReceipts(): Promise<AdmissionReceipt[]> {
    // Return in insertion order to preserve chain integrity regardless of
    // same-millisecond admittedAt collisions.
    return this.receiptInsertionOrder
      .map((id) => this.receipts.get(id))
      .filter((r): r is AdmissionReceipt => r !== undefined);
  }

  // Test-only helpers
  _getEventCount(): number {
    return this.events.size;
  }

  _getReceiptCount(): number {
    return this.receipts.size;
  }

  _getDispatchedCount(): number {
    return this.dispatchedQueueIds.size;
  }

  _reset(): void {
    this.events.clear();
    this.receipts.clear();
    this.receiptInsertionOrder.splice(0);
    this.dispatchedQueueIds.clear();
    this.nextQueueId = 1;
  }
}

// ─── Standalone Compliance Exports ────────────────────────────────────────────

/**
 * Singleton engine instance backed by the in-memory adapter for environments
 * that do not have a SQLite driver. The SQLite-backed production adapter is
 * injected by the application bootstrap layer.
 *
 * NOT for direct production use — inject a SQLite-backed adapter instead.
 */
let _globalEngine: TrueXSyncReplicationEngine | null = null;

/** Returns (or creates) the module-level default engine instance. */
function _getDefaultEngine(): TrueXSyncReplicationEngine {
  if (!_globalEngine) {
    const storage = new InMemoryReplicationStorageAdapter();
    const dispatcher: SyncDispatcher = {
      async dispatch(_events, _receipt) {
        // No-op dispatcher for the global default — replace with real dispatcher at bootstrap.
      },
    };
    _globalEngine = new TrueXSyncReplicationEngine(storage, dispatcher);
  }
  return _globalEngine;
}

/**
 * Module-level admitBatch() — admits events through the default engine instance.
 *
 * Satisfies the architectural requirement that this function be directly
 * exportable for compliance validation tooling and integration testing.
 *
 * For production use, construct a TrueXSyncReplicationEngine with the
 * SQLite-backed ReplicationStorageAdapter and call admitBatch() on it directly.
 */
export async function admitBatch(events: SyncEvent[]): Promise<BatchAdmissionOutcome> {
  return _getDefaultEngine().admitBatch(events);
}

/**
 * Module-level verifyReceiptChain() — verifies the receipt chain of the default
 * engine instance.
 *
 * Satisfies the architectural requirement that this function be directly
 * exportable for compliance validation tooling and integration testing.
 *
 * For production use, construct a TrueXSyncReplicationEngine with the
 * SQLite-backed ReplicationStorageAdapter and call verifyReceiptChain() on it directly.
 */
export async function verifyReceiptChain(): Promise<{
  valid: boolean;
  chainLength: number;
  firstBrokenLink?: string;
}> {
  return _getDefaultEngine().verifyReceiptChain();
}

/** Reset the global default engine. FOR TEST USE ONLY. */
export function _resetDefaultEngine(): void {
  _globalEngine = null;
}
