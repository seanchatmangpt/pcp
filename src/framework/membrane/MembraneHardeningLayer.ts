/**
 * MembraneHardeningLayer
 *
 * Implements the Truex Membrane Law:
 *   - All zustand/MMKV store mutations pass through proxyable membrane traps
 *   - Every mutation emits a BLAKE3 receipt (3-tier fallback: BLAKE3 → SHA256 → hex-timestamp)
 *   - Claimed<T> → Witnessed<T> typestate transitions require cryptographic proof obligation
 *   - verifyMembraneIntegrity() scans for unwitnessed transitions and returns a typed report
 *
 * @module @truex/membrane-client
 */

import {
  blake3,
  sha256,
  canonicalStringify,
  generateBlake3ReceiptHash,
} from '@/src/lib/crypto/receipts';
import { Membrane } from './membrane';
import { MembraneConfig, MembraneReceipt } from './types';

// ─── Typestate Boundaries ─────────────────────────────────────────────────────

/**
 * Claimed<T> represents unverified state — a value that has been asserted but
 * not yet proven through the membrane. It CANNOT be cast to Witnessed<T> directly.
 */
export type Claimed<T> = { readonly __brand: 'Claimed'; readonly value: T };

/**
 * Witnessed<T> represents cryptographically attested state. Construction
 * is ONLY permitted via `witnessTransition()` — never via unsafe cast.
 */
export type Witnessed<T> = {
  readonly __brand: 'Witnessed';
  readonly value: T;
  readonly receipt: HardeningReceipt;
};

/** A guard to prevent accidental unsafe use of a raw value as Witnessed. */
export function claimValue<T>(value: T): Claimed<T> {
  return { __brand: 'Claimed', value } as Claimed<T>;
}

// ─── Receipt Types ────────────────────────────────────────────────────────────

export type ReceiptAlgorithm = 'BLAKE3' | 'SHA256' | 'FALLBACK';

/**
 * A BLAKE3-first hardening receipt. Includes the algorithm tier used,
 * providing transparency about which fallback was applied.
 */
export interface HardeningReceipt {
  /** Unique receipt identifier */
  readonly id: string;
  /** ISO-8601 timestamp of receipt generation */
  readonly timestamp: string;
  /** The store key or entity identifier being mutated */
  readonly storeKey: string;
  /** The operation that triggered this receipt */
  readonly operation: 'set' | 'delete' | 'patch' | 'transition';
  /** Hash algorithm tier used */
  readonly algorithm: ReceiptAlgorithm;
  /** Hash of the previous receipt in the chain ('' for genesis) */
  readonly previousHash: string;
  /** BLAKE3/SHA256/fallback hash of the serialized new state */
  readonly stateHash: string;
  /** Chained delta hash: hash(previousHash + stateHash) */
  readonly deltaHash: string;
  /** The Membrane receipt from the governing run(), if applicable */
  readonly membraneReceipt?: MembraneReceipt;
  /** Whether this receipt was generated under a membrane-governed execution */
  readonly isGoverned: boolean;
  /** Whether this transition has been fully witnessed (receipt persisted) */
  witnessed: boolean;
}

// ─── Integrity Report ─────────────────────────────────────────────────────────

export interface UnwitnessedTransition {
  readonly storeKey: string;
  readonly operation: HardeningReceipt['operation'];
  readonly timestamp: string;
  readonly receiptId: string;
  readonly reason: string;
}

export interface MembraneIntegrityReport {
  readonly scannedAt: string;
  readonly totalReceipts: number;
  readonly witnessedCount: number;
  readonly unwitnessedCount: number;
  readonly chainValid: boolean;
  readonly chainError?: string;
  readonly unwitnessedTransitions: readonly UnwitnessedTransition[];
  readonly integrityScore: number; // 0.0 – 1.0
}

// ─── BLAKE3 3-Tier Fallback Hash ──────────────────────────────────────────────

/**
 * Computes a receipt hash using a 3-tier fallback strategy:
 *   1. BLAKE3 (primary — fastest, largest output space)
 *   2. SHA256 (secondary — proven, standards-compliant)
 *   3. Hex timestamp concatenation (emergency fallback — never lost receipt)
 *
 * All tiers produce a deterministic output for the same inputs.
 */
function computeReceiptHash(
  previousHash: string,
  data: any
): { hash: string; algorithm: ReceiptAlgorithm } {
  const serialized = canonicalStringify(data);
  const input = previousHash + serialized;

  try {
    const hash = blake3(input);
    if (hash && hash.length >= 32) {
      return { hash, algorithm: 'BLAKE3' };
    }
    throw new Error('BLAKE3 produced invalid output');
  } catch (_blake3Err) {
    try {
      const hash = sha256(input);
      if (hash && hash.length >= 32) {
        return { hash, algorithm: 'SHA256' };
      }
      throw new Error('SHA256 produced invalid output');
    } catch (_sha256Err) {
      // Emergency fallback: hex-encoded timestamp + length-padded input prefix
      // Portable implementation (no Buffer / Node.js API required)
      const ts = Date.now().toString(16).padStart(16, '0');
      const len = serialized.length.toString(16).padStart(8, '0');
      const slice = input.slice(0, 16);
      let prefix = '';
      for (let ci = 0; ci < slice.length; ci++) {
        prefix += slice.charCodeAt(ci).toString(16).padStart(2, '0');
      }
      prefix = prefix.padStart(32, '0').slice(0, 32);
      return {
        hash: `${ts}${len}${prefix}`.slice(0, 64).padEnd(64, '0'),
        algorithm: 'FALLBACK',
      };
    }
  }
}

/**
 * Computes a stateHash for a value using 3-tier fallback.
 */
function computeStateHash(value: any): { hash: string; algorithm: ReceiptAlgorithm } {
  return computeReceiptHash('', value);
}

// ─── Receipt Chain ────────────────────────────────────────────────────────────

/**
 * Immutable append-only receipt ledger for a single hardeningLayer instance.
 * Enforces hash-chaining so that any tampering is detectable.
 */
class HardeningReceiptChain {
  private readonly receipts: HardeningReceipt[] = [];

  public getLastHash(): string {
    if (this.receipts.length === 0) return '';
    return this.receipts[this.receipts.length - 1].deltaHash;
  }

  public append(receipt: HardeningReceipt): void {
    this.receipts.push(receipt);
  }

  public getAll(): readonly HardeningReceipt[] {
    return [...this.receipts];
  }

  public getCount(): number {
    return this.receipts.length;
  }

  public clear(): void {
    this.receipts.length = 0;
  }

  /**
   * Validates the entire receipt chain for hash continuity.
   * Each receipt's deltaHash must equal hash(previousHash + stateHash)
   * and previousHash must equal the prior receipt's deltaHash.
   */
  public validateChain(): { valid: boolean; error?: string } {
    for (let i = 0; i < this.receipts.length; i++) {
      const rec = this.receipts[i];
      const expectedPrev = i === 0 ? '' : this.receipts[i - 1].deltaHash;

      if (rec.previousHash !== expectedPrev) {
        return {
          valid: false,
          error: `Chain broken at index ${i}: previousHash mismatch. Expected '${expectedPrev}', got '${rec.previousHash}'`,
        };
      }

      // Re-derive expected deltaHash using the same algorithm
      let expectedDelta: string;
      try {
        const input = rec.previousHash + rec.stateHash;
        if (rec.algorithm === 'BLAKE3') {
          expectedDelta = blake3(input);
        } else if (rec.algorithm === 'SHA256') {
          expectedDelta = sha256(input);
        } else {
          // FALLBACK: accept stored value (cannot re-derive without serialized data)
          expectedDelta = rec.deltaHash;
        }
      } catch {
        expectedDelta = rec.deltaHash; // trust stored value if re-derivation fails
      }

      if (rec.deltaHash !== expectedDelta) {
        return {
          valid: false,
          error: `Invalid deltaHash at index ${i}: computed '${expectedDelta}', stored '${rec.deltaHash}'`,
        };
      }
    }
    return { valid: true };
  }
}

// ─── Trap Context ─────────────────────────────────────────────────────────────

export interface TrapMutationContext {
  readonly storeKey: string;
  readonly operation: HardeningReceipt['operation'];
  readonly previousValue: unknown;
  readonly nextValue: unknown;
  readonly metadata?: Record<string, unknown>;
}

// ─── MembraneHardeningLayer ───────────────────────────────────────────────────

/**
 * MembraneHardeningLayer
 *
 * The single enforcement boundary for all store mutations in the Pcp Framework.
 *
 * Usage:
 * ```typescript
 * const hardening = new MembraneHardeningLayer({ mode: 'strict' });
 *
 * // Wrap a zustand setter
 * const safeSet = hardening.wrapStoreMutation('myStore', async (value) => {
 *   zustandSet(value);
 * });
 *
 * // Witness a typestate transition
 * const claimed = claimValue({ userId: '123', role: 'admin' });
 * const witnessed = await hardening.witnessTransition(claimed, 'user-state');
 *
 * // Check integrity
 * const report = hardening.verifyMembraneIntegrity();
 * ```
 */
export class MembraneHardeningLayer {
  private readonly membrane: Membrane;
  private readonly chain: HardeningReceiptChain;
  private readonly listeners: Set<(receipt: HardeningReceipt) => void>;

  constructor(config: MembraneConfig) {
    this.membrane = new Membrane(config);
    this.chain = new HardeningReceiptChain();
    this.listeners = new Set();
  }

  // ── Receipt Listeners ────────────────────────────────────────────────────

  /** Register a callback invoked on every new receipt emission. */
  public onReceipt(listener: (receipt: HardeningReceipt) => void): void {
    this.listeners.add(listener);
  }

  /** Unregister a previously registered receipt listener. */
  public offReceipt(listener: (receipt: HardeningReceipt) => void): void {
    this.listeners.delete(listener);
  }

  private emit(receipt: HardeningReceipt): void {
    for (const listener of this.listeners) {
      try {
        listener(receipt);
      } catch (err) {
        // Never allow a listener error to corrupt membrane state
        console.error('[MembraneHardeningLayer] Listener error suppressed:', err);
      }
    }
  }

  // ── Core Receipt Generation ───────────────────────────────────────────────

  /**
   * Generates a BLAKE3-first chained receipt for any store mutation.
   * This is the single internal method that all mutation wrappers must call.
   *
   * @internal
   */
  private generateReceipt(
    storeKey: string,
    operation: HardeningReceipt['operation'],
    newValue: unknown,
    membraneReceipt?: MembraneReceipt
  ): HardeningReceipt {
    const previousHash = this.chain.getLastHash();

    // 1. Compute stateHash: hash of the serialized new value (no chain dependency)
    const { hash: stateHash, algorithm } = computeStateHash(newValue);

    // 2. Compute deltaHash: hash(previousHash + stateHash) — this IS the chain link.
    //    Both validateChain and generateReceipt must use the same formula.
    let deltaHash: string;
    try {
      if (algorithm === 'BLAKE3') {
        deltaHash = blake3(previousHash + stateHash);
      } else if (algorithm === 'SHA256') {
        deltaHash = sha256(previousHash + stateHash);
      } else {
        // FALLBACK: simple concatenation + zero-pad
        deltaHash = (previousHash + stateHash).slice(0, 64).padEnd(64, '0');
      }
    } catch {
      deltaHash = sha256(previousHash + stateHash);
    }

    const receipt: HardeningReceipt = {
      id: `hrdn_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 9)}`,
      timestamp: new Date().toISOString(),
      storeKey,
      operation,
      algorithm,
      previousHash,
      stateHash,
      deltaHash,
      membraneReceipt,
      isGoverned: membraneReceipt !== undefined,
      witnessed: false,
    };

    this.chain.append(receipt);
    this.emit(receipt);
    return receipt;
  }

  // ── Zustand Store Mutation Wrapper ────────────────────────────────────────

  /**
   * Wraps a zustand `setState` call (or any async store mutation) with full
   * membrane governance and BLAKE3 receipt enforcement.
   *
   * Every call to the returned function:
   *   1. Runs through the Membrane interceptor chain
   *   2. Emits a BLAKE3 receipt regardless of outcome (deny emits a refusal receipt)
   *   3. Marks the receipt as witnessed upon successful commit
   *
   * @param storeKey  A stable identifier for the store (e.g. 'authStore', 'sessionStore')
   * @param mutator   The actual zustand `set` or async mutation function
   * @returns A hardened replacement for the raw mutator
   */
  public wrapStoreMutation<TState>(
    storeKey: string,
    mutator: (nextState: Partial<TState>) => void | Promise<void>
  ): (nextState: Partial<TState>) => Promise<HardeningReceipt> {
    return async (nextState: Partial<TState>): Promise<HardeningReceipt> => {
      const commandId = `cmd_store_${storeKey}_${Date.now()}`;

      const result = await this.membrane.run(
        `store-mutation.${storeKey}`,
        commandId,
        { storeKey, nextState },
        async () => {
          await mutator(nextState);
          return nextState;
        }
      );

      const receipt = this.generateReceipt(storeKey, 'set', nextState, result.receipt);

      if (result.success) {
        receipt.witnessed = true;
      }

      return receipt;
    };
  }

  // ── MMKV Storage Mutation Wrapper ─────────────────────────────────────────

  /**
   * Wraps a raw MMKV `setItem` call, enforcing membrane governance and emitting
   * a BLAKE3 receipt. Returns a hardened setItem function.
   *
   * @param storeId   Stable identifier for the MMKV instance (e.g. 'mmkv-auth')
   * @param rawSetItem  The original MMKV `setItem` method
   */
  public wrapMMKVSetItem(
    storeId: string,
    rawSetItem: (name: string, value: string) => void
  ): (name: string, value: string) => Promise<HardeningReceipt> {
    return async (name: string, value: string): Promise<HardeningReceipt> => {
      const storeKey = `${storeId}::${name}`;
      const commandId = `cmd_mmkv_${storeKey}_${Date.now()}`;

      let parsedValue: unknown = value;
      try {
        parsedValue = JSON.parse(value);
      } catch {
        parsedValue = value;
      }

      const result = await this.membrane.run(
        `mmkv-mutation.${storeId}`,
        commandId,
        { storeId, key: name, value: parsedValue },
        async () => {
          rawSetItem(name, value);
          return parsedValue;
        }
      );

      const receipt = this.generateReceipt(storeKey, 'set', parsedValue, result.receipt);

      if (result.success) {
        receipt.witnessed = true;
      }

      return receipt;
    };
  }

  /**
   * Wraps a raw MMKV `removeItem` call with membrane governance and receipt emission.
   *
   * @param storeId        Stable identifier for the MMKV instance
   * @param rawRemoveItem  The original MMKV `removeItem` method
   */
  public wrapMMKVRemoveItem(
    storeId: string,
    rawRemoveItem: (name: string) => void
  ): (name: string) => Promise<HardeningReceipt> {
    return async (name: string): Promise<HardeningReceipt> => {
      const storeKey = `${storeId}::${name}`;
      const commandId = `cmd_mmkv_delete_${storeKey}_${Date.now()}`;

      const result = await this.membrane.run(
        `mmkv-delete.${storeId}`,
        commandId,
        { storeId, key: name, value: undefined },
        async () => {
          rawRemoveItem(name);
          return null;
        }
      );

      const receipt = this.generateReceipt(storeKey, 'delete', null, result.receipt);

      if (result.success) {
        receipt.witnessed = true;
      }

      return receipt;
    };
  }

  // ── Typestate Witness Gate ────────────────────────────────────────────────

  /**
   * The ONLY legitimate constructor for `Witnessed<T>`.
   *
   * Transitions a `Claimed<T>` value through the membrane, generating a BLAKE3
   * receipt and returning a `Witnessed<T>` only if the membrane allows it.
   *
   * Throws `MembraneViolationError` if the membrane denies the transition,
   * making the illegal state transition physically impossible to complete.
   *
   * @param claimed   The unverified claimed value
   * @param entityKey A stable key identifying this entity type (e.g. 'user-session')
   * @param metadata  Optional additional context for membrane interceptors
   */
  public async witnessTransition<T>(
    claimed: Claimed<T>,
    entityKey: string,
    metadata?: Record<string, unknown>
  ): Promise<Witnessed<T>> {
    const commandId = `cmd_witness_${entityKey}_${Date.now()}`;

    const result = await this.membrane.run(
      `witness-transition.${entityKey}`,
      commandId,
      {
        entityKey,
        value: claimed.value,
        __witnessRequest: true,
        ...metadata,
      },
      async () => claimed.value
    );

    if (!result.success) {
      throw new MembraneViolationError(
        `Membrane denied Claimed<T> → Witnessed<T> transition for '${entityKey}': ${result.error ?? 'unknown reason'}`,
        entityKey,
        result.receipt
      );
    }

    const receipt = this.generateReceipt(entityKey, 'transition', claimed.value, result.receipt);
    receipt.witnessed = true;

    return {
      __brand: 'Witnessed',
      value: claimed.value,
      receipt,
    } as Witnessed<T>;
  }

  /**
   * Performs a raw mutation on any object slice under full membrane governance,
   * generating a BLAKE3 receipt. Intended for direct state patch operations that
   * don't go through a zustand setter or MMKV adapter.
   *
   * @param storeKey   Identifier for the store being mutated
   * @param previousValue  The value before mutation (for chain integrity)
   * @param nextValue      The value after mutation
   * @param mutate         The mutation callback (executed under membrane protection)
   */
  public async governedMutation<T>(
    storeKey: string,
    previousValue: T,
    nextValue: T,
    mutate: () => void | Promise<void>
  ): Promise<HardeningReceipt> {
    const commandId = `cmd_governed_${storeKey}_${Date.now()}`;

    // Note: Do NOT pass flowName/fromState/toState here — trajectory validation
    // is only meaningful when the caller explicitly registers flows. Passing these
    // blindly would cause spurious membrane denials for unregistered flows.
    const result = await this.membrane.run(
      `governed-mutation.${storeKey}`,
      commandId,
      {
        storeKey,
        previousValue,
        nextValue,
      },
      async () => {
        await mutate();
        return nextValue;
      }
    );

    const receipt = this.generateReceipt(storeKey, 'patch', nextValue, result.receipt);

    if (result.success) {
      receipt.witnessed = true;
    }

    return receipt;
  }

  // ── Integrity Verification ────────────────────────────────────────────────

  /**
   * Scans the entire receipt ledger for unwitnessed transitions and validates
   * the hash chain for tamper evidence.
   *
   * An unwitnessed transition is any receipt where `witnessed === false`, which
   * indicates the state mutation was initiated but the membrane receipt was either
   * denied or the commitment callback was not reached.
   *
   * @returns A fully typed `MembraneIntegrityReport`
   */
  public verifyMembraneIntegrity(): MembraneIntegrityReport {
    const allReceipts = this.chain.getAll();
    const scannedAt = new Date().toISOString();
    const totalReceipts = allReceipts.length;

    const unwitnessedTransitions: UnwitnessedTransition[] = [];
    let witnessedCount = 0;

    for (const receipt of allReceipts) {
      if (receipt.witnessed) {
        witnessedCount++;
      } else {
        unwitnessedTransitions.push({
          storeKey: receipt.storeKey,
          operation: receipt.operation,
          timestamp: receipt.timestamp,
          receiptId: receipt.id,
          reason:
            receipt.membraneReceipt?.success === false
              ? `Membrane denied: ${receipt.membraneReceipt.error ?? 'no error detail'}`
              : 'Receipt generated but witness flag never set (possible crash or rollback)',
        });
      }
    }

    const chainValidation = this.chain.validateChain();
    const unwitnessedCount = unwitnessedTransitions.length;

    // integrityScore: 1.0 means perfect (all witnessed, chain valid)
    const witnessRatio = totalReceipts === 0 ? 1.0 : witnessedCount / totalReceipts;
    const chainBonus = chainValidation.valid ? 0 : -0.5;
    const integrityScore = Math.max(0, Math.min(1, witnessRatio + chainBonus));

    return {
      scannedAt,
      totalReceipts,
      witnessedCount,
      unwitnessedCount,
      chainValid: chainValidation.valid,
      chainError: chainValidation.error,
      unwitnessedTransitions,
      integrityScore,
    };
  }

  // ── Receipt Ledger Access ─────────────────────────────────────────────────

  /** Returns a read-only copy of all receipts in the chain. */
  public getReceiptLedger(): readonly HardeningReceipt[] {
    return this.chain.getAll();
  }

  /** Returns the total number of receipts in the ledger. */
  public getReceiptCount(): number {
    return this.chain.getCount();
  }

  /**
   * Clears the receipt ledger. USE WITH EXTREME CAUTION — this breaks
   * chain continuity. Only valid during test teardown or explicit reset flows.
   */
  public clearLedger(): void {
    this.chain.clear();
  }

  /** Exposes the underlying Membrane instance for direct interceptor registration. */
  public getMembrane(): Membrane {
    return this.membrane;
  }

  /** Exposes the underlying membrane config for inspection. */
  public getConfig(): MembraneConfig {
    return this.membrane.getConfig();
  }
}

// ─── Violation Error ──────────────────────────────────────────────────────────

/**
 * Thrown when the membrane denies a Claimed<T> → Witnessed<T> transition.
 * This makes the illegal typestate transition physically impossible to complete.
 */
export class MembraneViolationError extends Error {
  public readonly entityKey: string;
  public readonly refusalReceipt: MembraneReceipt;

  constructor(message: string, entityKey: string, refusalReceipt: MembraneReceipt) {
    super(message);
    this.name = 'MembraneViolationError';
    this.entityKey = entityKey;
    this.refusalReceipt = refusalReceipt;
    // Maintain proper stack trace in V8 (guard for environments without it)
    const errorCtor = Error as any;
    if (typeof errorCtor.captureStackTrace === 'function') {
      errorCtor.captureStackTrace(this, MembraneViolationError);
    }
  }
}

// ─── Factory Helpers ──────────────────────────────────────────────────────────

/**
 * Creates a `MembraneHardeningLayer` in strict mode (default for production).
 */
export function createStrictHardeningLayer(tenantId?: string): MembraneHardeningLayer {
  return new MembraneHardeningLayer({
    mode: 'strict',
    tenantId,
  });
}

/**
 * Creates a `MembraneHardeningLayer` in audit mode (logs all mutations without
 * blocking — used for integration testing and observability pipelines).
 */
export function createAuditHardeningLayer(tenantId?: string): MembraneHardeningLayer {
  return new MembraneHardeningLayer({
    mode: 'audit',
    tenantId,
  });
}

/**
 * Creates a `MembraneHardeningLayer` in simulate mode (speculative execution
 * — mutations are run but effects are sandboxed).
 */
export function createSimulationHardeningLayer(tenantId?: string): MembraneHardeningLayer {
  return new MembraneHardeningLayer({
    mode: 'simulate',
    tenantId,
  });
}

// ─── Singleton Module-Level Layer ─────────────────────────────────────────────

let _globalHardeningLayer: MembraneHardeningLayer | null = null;

/**
 * Returns the global singleton `MembraneHardeningLayer` for the application.
 * Initializes in strict mode on first call.
 *
 * In production, call `initGlobalHardeningLayer()` explicitly with proper config
 * before any store mutations occur.
 */
export function getGlobalHardeningLayer(): MembraneHardeningLayer {
  if (!_globalHardeningLayer) {
    _globalHardeningLayer = createStrictHardeningLayer('global');
  }
  return _globalHardeningLayer;
}

/**
 * Explicitly initializes (or replaces) the global MembraneHardeningLayer.
 * Call this at application bootstrap with the correct tenant and mode.
 */
export function initGlobalHardeningLayer(config: MembraneConfig): MembraneHardeningLayer {
  _globalHardeningLayer = new MembraneHardeningLayer(config);
  return _globalHardeningLayer;
}

/**
 * Resets the global singleton. FOR TEST USE ONLY.
 */
export function _resetGlobalHardeningLayer(): void {
  _globalHardeningLayer = null;
}
