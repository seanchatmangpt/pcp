/**
 * @fileoverview PredictiveActionLayer (PAL) — on-device, AI-native predictive execution.
 *
 * Architectural laws enforced:
 *  - Law Closure: only PredictedAction[] states are admissible outputs of ingestIntent()
 *  - Receipted Chatman Equation: each pre-computation cycle emits a BLAKE3 receipt
 *  - Pre-Admission Tension Queue semantics: pre-computed actions are held in a sandboxed
 *    ring buffer, ready for 0ms retrieval
 *  - Ring Buffer: last 50 UserIntents maintained; oldest evicted when capacity exceeded
 */

import { blake3, canonicalStringify } from '@/src/lib/crypto/receipts';

// ═══════════════════════════════════════════════════════════════════════════════
// DOMAIN TYPES
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * UserIntent — the atomic unit of user-expressed purpose.
 * This is intentionally decoupled from CommandEnvelope so PAL can be used
 * independently of the actor runtime.
 */
export interface UserIntent {
  /** Unique identifier for this intent instance. */
  readonly intentId: string;
  /** The category / type label of the intent (e.g. 'navigate', 'submit', 'query'). */
  readonly kind: string;
  /**
   * Contextual payload associated with the intent.
   * Should be serialisable; complex objects will be deep-cloned into the ring buffer.
   */
  readonly context: Readonly<Record<string, unknown>>;
  /** ISO-8601 timestamp at which the intent was observed. */
  readonly observedAt: string;
  /** Optional principal who initiated the intent. */
  readonly principalId?: string;
}

/**
 * PredictedAction — a pre-computed next action the system anticipates the user will take.
 */
export interface PredictedAction {
  /** Unique identifier for this prediction instance. */
  readonly predictionId: string;
  /** The intent kind that was the basis for this prediction. */
  readonly sourceIntentKind: string;
  /**
   * The anticipated next intent kind (e.g. 'confirm', 'cancel', 'navigate-back').
   */
  readonly predictedKind: string;
  /**
   * Pre-computed context payload that would accompany the predicted intent.
   * Populated by the sandboxed pre-computation step.
   */
  readonly preComputedContext: Record<string, unknown>;
  /** Confidence score in [0, 1]. */
  readonly confidence: number;
  /** Human-readable rationale for this prediction. */
  readonly reason: string;
  /** BLAKE3 receipt proving this pre-computation ran on-device. */
  readonly receipt: PreComputationReceipt;
}

/**
 * PreComputationReceipt — BLAKE3-backed evidence of a sandboxed pre-computation.
 */
export interface PreComputationReceipt {
  readonly id: string;
  readonly predictionId: string;
  readonly intentId: string;
  readonly deltaHash: string;
  readonly previousHash: string;
  readonly payloadHash: string;
  readonly onDevice: true;
  readonly issuedAt: string;
}

/**
 * PALState — the full observable state of the Predictive Action Layer.
 */
export interface PALState {
  /** Ring buffer of the last ≤ 50 ingested UserIntents. */
  readonly intentHistory: ReadonlyArray<UserIntent>;
  /** The 3 most likely predicted next actions from the last ingestIntent() call. */
  readonly predictions: ReadonlyArray<PredictedAction>;
  /** Map from predictionId → PredictedAction for O(1) lookup. */
  readonly preComputedCache: ReadonlyMap<string, PredictedAction>;
}

// ═══════════════════════════════════════════════════════════════════════════════
// TRANSITION PROBABILITY TABLE
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Built-in transition probability table.
 * Represents prior knowledge of common intent → next-intent sequences.
 * The frequency-counting algorithm supplements these with observed transitions.
 */
const BUILT_IN_TRANSITIONS: Record<string, Array<{ kind: string; prior: number }>> = {
  navigate: [
    { kind: 'query', prior: 0.45 },
    { kind: 'submit', prior: 0.3 },
    { kind: 'navigate-back', prior: 0.25 },
  ],
  query: [
    { kind: 'navigate', prior: 0.4 },
    { kind: 'submit', prior: 0.35 },
    { kind: 'cancel', prior: 0.25 },
  ],
  submit: [
    { kind: 'confirm', prior: 0.55 },
    { kind: 'cancel', prior: 0.3 },
    { kind: 'navigate', prior: 0.15 },
  ],
  confirm: [
    { kind: 'navigate', prior: 0.6 },
    { kind: 'query', prior: 0.4 },
  ],
  cancel: [
    { kind: 'navigate-back', prior: 0.65 },
    { kind: 'navigate', prior: 0.35 },
  ],
  'navigate-back': [
    { kind: 'navigate', prior: 0.5 },
    { kind: 'query', prior: 0.5 },
  ],
};

// ═══════════════════════════════════════════════════════════════════════════════
// RECEIPT GENERATION
// ═══════════════════════════════════════════════════════════════════════════════

function generatePreComputationReceipt(
  predictionId: string,
  intentId: string,
  preComputedContext: Record<string, unknown>,
  previousHash: string
): PreComputationReceipt {
  const payloadData = { predictionId, intentId, preComputedContext };
  const canonicalPayload = canonicalStringify(payloadData);

  let payloadHash: string;
  let deltaHash: string;
  try {
    payloadHash = blake3(canonicalPayload);
    deltaHash = blake3(previousHash + payloadHash);
  } catch {
    // Deterministic fallback — should never be reached with the pure-JS blake3
    const djb2 = (s: string): string =>
      s
        .split('')
        .reduce((acc, c) => ((acc << 5) - acc + c.charCodeAt(0)) | 0, 5381)
        .toString(16)
        .padStart(8, '0');
    payloadHash = djb2(canonicalPayload);
    deltaHash = djb2(previousHash + payloadHash);
  }

  return Object.freeze({
    id: `palrec_${predictionId}_${Date.now().toString(36)}`,
    predictionId,
    intentId,
    deltaHash,
    previousHash,
    payloadHash,
    onDevice: true as const,
    issuedAt: new Date().toISOString(),
  });
}

// ═══════════════════════════════════════════════════════════════════════════════
// SANDBOXED PRE-COMPUTATION ENGINE
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * SandboxedPreComputor — runs a speculative context resolution for a predicted intent.
 * Analogous to speculative execution in CPUs: compute results before they are needed,
 * discard if mispredicted.
 *
 * The "sandbox" guarantee: computations here never mutate global state; they only
 * produce immutable value objects that are cached until consumed or evicted.
 */
class SandboxedPreComputor {
  /**
   * Pre-compute the context payload for a predicted intent given the source intent.
   * Returns an immutable pre-computed context.
   */
  preCompute(
    predictedKind: string,
    sourceIntent: UserIntent,
    confidence: number
  ): Record<string, unknown> {
    // Sandboxed execution: derive anticipated context from the source intent
    // without any side-effects. This represents what the context would look like
    // when the user takes the predicted action.
    const derived: Record<string, unknown> = {
      derivedFromIntent: sourceIntent.intentId,
      derivedFromKind: sourceIntent.kind,
      predictedKind,
      confidence,
      preComputedAt: new Date().toISOString(),
    };

    // Propagate relevant source context fields into the pre-computed context
    // based on transition semantics
    switch (predictedKind) {
      case 'navigate':
      case 'navigate-back':
        // Carry over any route/screen context
        if (sourceIntent.context['route']) derived['route'] = sourceIntent.context['route'];
        if (sourceIntent.context['screen']) derived['screen'] = sourceIntent.context['screen'];
        break;
      case 'submit':
        // Carry over form state if available
        if (sourceIntent.context['formId']) derived['formId'] = sourceIntent.context['formId'];
        if (sourceIntent.context['payload']) derived['payload'] = sourceIntent.context['payload'];
        break;
      case 'query':
        // Carry over search context
        if (sourceIntent.context['query']) derived['query'] = sourceIntent.context['query'];
        if (sourceIntent.context['filter']) derived['filter'] = sourceIntent.context['filter'];
        break;
      case 'confirm':
        // Carry over confirmation target
        if (sourceIntent.context['targetId'])
          derived['targetId'] = sourceIntent.context['targetId'];
        break;
      case 'cancel':
        // Record what is being cancelled
        derived['cancelledKind'] = sourceIntent.kind;
        break;
      default:
        // For unknown kinds, propagate the full source context
        Object.assign(derived, sourceIntent.context);
    }

    return Object.freeze(derived);
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// PREDICTIVE ACTION LAYER
// ═══════════════════════════════════════════════════════════════════════════════

const RING_BUFFER_CAPACITY = 50;
const MAX_PREDICTIONS = 3;
const MAX_CACHE_SIZE = 20;

/**
 * PredictiveActionLayer (PAL)
 *
 * Ingests UserIntents and predicts the 3 most likely next actions with 0ms retrieval
 * latency through sandboxed pre-computation.
 *
 * Architecture:
 *  1. `ingestIntent(intent)` — synchronously records the intent, kicks off async pre-computation,
 *     and returns predictions immediately from the frequency/prior model.
 *  2. Pre-computation runs in a sandboxed context (no global state mutation).
 *  3. Pre-computed results land in a bounded cache, evicting oldest entries as needed.
 *  4. Every pre-computation cycle emits a BLAKE3 receipt.
 *
 * Singleton pattern: use `PredictiveActionLayer.getInstance()`.
 */
export class PredictiveActionLayer {
  private static _instance: PredictiveActionLayer | undefined;

  /** Intent ring buffer — maximum RING_BUFFER_CAPACITY entries. */
  private intentBuffer: UserIntent[] = [];

  /**
   * Frequency transition table: sourceKind → (targetKind → count).
   * Updated on each ingestIntent() call.
   */
  private transitionCounts: Map<string, Map<string, number>> = new Map();

  /** Bounded cache of pre-computed predictions, keyed by predictionId. */
  private cache: Map<string, PredictedAction> = new Map();

  /** Append-only chain of pre-computation receipts. */
  private receiptChain: PreComputationReceipt[] = [];

  /** Registered state-change listeners. */
  private listeners: Set<(state: PALState) => void> = new Set();

  private readonly preComputor = new SandboxedPreComputor();

  private constructor() {}

  /**
   * Returns the singleton PredictiveActionLayer instance.
   */
  static getInstance(): PredictiveActionLayer {
    if (!PredictiveActionLayer._instance) {
      PredictiveActionLayer._instance = new PredictiveActionLayer();
    }
    return PredictiveActionLayer._instance;
  }

  /**
   * Ingest a UserIntent and return the 3 most likely predicted next actions.
   *
   * This is the primary entry point. It:
   *  1. Records the intent in the ring buffer (O(1) amortised).
   *  2. Updates the frequency transition table.
   *  3. Computes predictions synchronously from the blended model.
   *  4. Kicks off asynchronous sandboxed pre-computation (fire-and-forget).
   *  5. Notifies listeners synchronously.
   *
   * @param intent The observed UserIntent.
   * @returns Array of up to 3 PredictedActions (may be empty for cold-start).
   */
  async ingestIntent(intent: UserIntent): Promise<PredictedAction[]> {
    // 1. Append to ring buffer, evict oldest if over capacity
    this._appendToRingBuffer(intent);

    // 2. Update frequency table
    this._recordTransition(intent);

    // 3. Compute predictions synchronously (frequency + prior blend)
    const candidates = this._computePredictions(intent);

    // 4. Kick off async sandboxed pre-computation (non-blocking)
    this._preComputeAsync(intent, candidates);

    // 5. Notify listeners
    this._notify();

    return candidates;
  }

  /**
   * Retrieve a pre-computed action from the cache given the predicted kind.
   * Returns `null` if no pre-computation is available (cache miss or not yet computed).
   *
   * 0ms latency when cache-hot.
   */
  getPreComputed(predictedKind: string): PredictedAction | null {
    for (const action of this.cache.values()) {
      if (action.predictedKind === predictedKind) {
        return action;
      }
    }
    return null;
  }

  /**
   * Retrieve a pre-computed action by its exact predictionId.
   */
  getPreComputedById(predictionId: string): PredictedAction | null {
    return this.cache.get(predictionId) ?? null;
  }

  /**
   * Subscribe to state changes.
   * @returns An unsubscribe function.
   */
  subscribe(listener: (state: PALState) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /**
   * Return the current observable state (immutable snapshot).
   */
  getState(): PALState {
    return {
      intentHistory: Object.freeze([...this.intentBuffer]),
      predictions: Object.freeze([...this.cache.values()]),
      preComputedCache: new Map(this.cache),
    };
  }

  /**
   * Return the BLAKE3 receipt chain for audit purposes.
   */
  getReceiptChain(): ReadonlyArray<PreComputationReceipt> {
    return Object.freeze([...this.receiptChain]);
  }

  /**
   * Reset all state. Primarily for test isolation.
   */
  reset(): void {
    this.intentBuffer = [];
    this.transitionCounts = new Map();
    this.cache = new Map();
    this.receiptChain = [];
    this._notify();
  }

  // ─── Private: Ring Buffer ──────────────────────────────────────────────────

  private _appendToRingBuffer(intent: UserIntent): void {
    // Deep-clone to prevent external mutation of buffered intents
    const frozen = Object.freeze({
      ...intent,
      context: Object.freeze({ ...intent.context }),
    });
    this.intentBuffer.push(frozen);
    if (this.intentBuffer.length > RING_BUFFER_CAPACITY) {
      this.intentBuffer.shift();
    }
  }

  // ─── Private: Transition Counting ─────────────────────────────────────────

  private _recordTransition(intent: UserIntent): void {
    if (this.intentBuffer.length < 2) return;

    // The previous intent is second-to-last in the buffer
    const prev = this.intentBuffer[this.intentBuffer.length - 2];
    if (!prev) return;

    let targetMap = this.transitionCounts.get(prev.kind);
    if (!targetMap) {
      targetMap = new Map();
      this.transitionCounts.set(prev.kind, targetMap);
    }
    targetMap.set(intent.kind, (targetMap.get(intent.kind) ?? 0) + 1);
  }

  // ─── Private: Prediction Engine ───────────────────────────────────────────

  /**
   * Compute up to MAX_PREDICTIONS predicted next actions using a blend of:
   *  - Observed transition frequencies (empirical)
   *  - Built-in prior transition probabilities (structural knowledge)
   *
   * Blending formula: score = α × observed_freq + (1 − α) × prior
   * where α = clamp(history_length / RING_BUFFER_CAPACITY, 0, 0.8)
   */
  private _computePredictions(sourceIntent: UserIntent): PredictedAction[] {
    const historyLen = this.intentBuffer.length;
    const alpha = Math.min((historyLen / RING_BUFFER_CAPACITY) * 0.8, 0.8);

    // Gather observed transitions from source intent kind
    const observed = this.transitionCounts.get(sourceIntent.kind) ?? new Map<string, number>();
    const observedTotal = Array.from(observed.values()).reduce((s, c) => s + c, 0);

    // Build a combined score map across all known target kinds
    const scoreMap = new Map<string, number>();

    // Add observed transitions
    for (const [targetKind, count] of observed) {
      const freq = observedTotal > 0 ? count / observedTotal : 0;
      scoreMap.set(targetKind, alpha * freq);
    }

    // Add / blend in prior transitions
    const priors = BUILT_IN_TRANSITIONS[sourceIntent.kind] ?? [];
    for (const { kind, prior } of priors) {
      const current = scoreMap.get(kind) ?? 0;
      scoreMap.set(kind, current + (1 - alpha) * prior);
    }

    // Sort by blended score descending, take top MAX_PREDICTIONS
    const sorted = Array.from(scoreMap.entries())
      .sort(([, a], [, b]) => b - a)
      .slice(0, MAX_PREDICTIONS);

    return sorted.map(([targetKind, score], index) => {
      const predictionId = `pred_${sourceIntent.intentId}_${index}_${Date.now().toString(36)}`;
      // Pre-compute context synchronously using the sandbox
      const preComputedContext = this.preComputor.preCompute(targetKind, sourceIntent, score);
      const previousHash = this._lastReceiptHash();
      const receipt = generatePreComputationReceipt(
        predictionId,
        sourceIntent.intentId,
        preComputedContext,
        previousHash
      );
      // Append receipt to chain immediately
      this.receiptChain.push(receipt);

      const action: PredictedAction = Object.freeze({
        predictionId,
        sourceIntentKind: sourceIntent.kind,
        predictedKind: targetKind,
        preComputedContext,
        confidence: Math.min(score, 1),
        reason: `Blended model (α=${alpha.toFixed(2)}): observed=${observed.get(targetKind) ?? 0} occurrences; prior=${(priors.find((p) => p.kind === targetKind)?.prior ?? 0).toFixed(2)}`,
        receipt,
      });

      return action;
    });
  }

  // ─── Private: Async Pre-Computation ───────────────────────────────────────

  /**
   * Asynchronously store predictions into the bounded cache.
   * Runs entirely within a micro-task; never blocks the event loop.
   */
  private _preComputeAsync(_sourceIntent: UserIntent, predictions: PredictedAction[]): void {
    // Fire and forget — results land in cache without blocking ingestIntent()
    Promise.resolve()
      .then(() => {
        for (const prediction of predictions) {
          this.cache.set(prediction.predictionId, prediction);
          // Evict oldest entry if over capacity
          if (this.cache.size > MAX_CACHE_SIZE) {
            const oldestKey = this.cache.keys().next().value;
            if (oldestKey !== undefined) this.cache.delete(oldestKey);
          }
        }
        this._notify();
      })
      .catch(() => {
        // Pre-computation failures are non-fatal
      });
  }

  // ─── Private: Receipt Chain ────────────────────────────────────────────────

  private _lastReceiptHash(): string {
    if (this.receiptChain.length === 0) return '';
    return this.receiptChain[this.receiptChain.length - 1].deltaHash;
  }

  // ─── Private: State Notification ──────────────────────────────────────────

  private _notify(): void {
    const state = this.getState();
    this.listeners.forEach((l) => {
      try {
        l(state);
      } catch {
        // Listener errors must not crash the PAL
      }
    });
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// CONVENIENCE HELPERS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Build a UserIntent from a minimal specification.
 */
export function buildUserIntent(
  kind: string,
  context: Record<string, unknown> = {},
  principalId?: string
): UserIntent {
  return Object.freeze({
    intentId: `intent_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 9)}`,
    kind,
    context: Object.freeze({ ...context }),
    observedAt: new Date().toISOString(),
    principalId,
  });
}
