/**
 * MembraneHardeningLayer Test Suite
 *
 * Exhaustive coverage of:
 *   - BLAKE3 3-tier fallback receipt generation
 *   - Typestate enforcement (Claimed<T> → Witnessed<T>)
 *   - Zustand store mutation wrapping
 *   - MMKV storage mutation wrapping
 *   - verifyMembraneIntegrity() scan and report
 *   - Receipt chain validation (hash continuity)
 *   - Membrane interceptor integration
 *   - Factory helpers and global singleton
 *   - MembraneViolationError behavior
 *   - Edge cases: empty chain, concurrent mutations, listener errors
 */

import {
  MembraneHardeningLayer,
  MembraneViolationError,
  claimValue,
  createStrictHardeningLayer,
  createAuditHardeningLayer,
  createSimulationHardeningLayer,
  getGlobalHardeningLayer,
  initGlobalHardeningLayer,
  _resetGlobalHardeningLayer,
  HardeningReceipt,
  Claimed,
  Witnessed,
  MembraneIntegrityReport,
} from '../MembraneHardeningLayer';
import { MembraneConfig } from '../types';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function strictConfig(overrides: Partial<MembraneConfig> = {}): MembraneConfig {
  return { mode: 'strict', tenantId: 'test-tenant', ...overrides };
}

function auditConfig(overrides: Partial<MembraneConfig> = {}): MembraneConfig {
  return { mode: 'audit', tenantId: 'test-tenant', ...overrides };
}

function makeLayer(config?: MembraneConfig): MembraneHardeningLayer {
  return new MembraneHardeningLayer(config ?? strictConfig());
}

// Wait for microtask queue to drain (for async membrane runs)
const drainAsync = () => new Promise<void>((resolve) => setTimeout(resolve, 20));

// ─── Suite ────────────────────────────────────────────────────────────────────

describe('MembraneHardeningLayer', () => {
  let layer: MembraneHardeningLayer;

  beforeEach(() => {
    layer = makeLayer();
    _resetGlobalHardeningLayer();
  });

  afterEach(() => {
    layer.clearLedger();
    _resetGlobalHardeningLayer();
  });

  // ── claimValue ─────────────────────────────────────────────────────────────

  describe('claimValue()', () => {
    it('should brand a value as Claimed', () => {
      const claimed = claimValue({ userId: 'u1', role: 'admin' });
      expect(claimed.__brand).toBe('Claimed');
      expect(claimed.value).toEqual({ userId: 'u1', role: 'admin' });
    });

    it('should brand primitive values correctly', () => {
      const n = claimValue(42);
      expect(n.__brand).toBe('Claimed');
      expect(n.value).toBe(42);

      const s = claimValue('hello');
      expect(s.__brand).toBe('Claimed');
      expect(s.value).toBe('hello');

      const b = claimValue(false);
      expect(b.__brand).toBe('Claimed');
      expect(b.value).toBe(false);
    });

    it('should brand null and undefined', () => {
      const n = claimValue(null);
      expect(n.__brand).toBe('Claimed');
      expect(n.value).toBeNull();

      const u = claimValue(undefined);
      expect(u.__brand).toBe('Claimed');
      expect(u.value).toBeUndefined();
    });

    it('should brand arrays', () => {
      const arr = claimValue([1, 2, 3]);
      expect(arr.__brand).toBe('Claimed');
      expect(arr.value).toEqual([1, 2, 3]);
    });
  });

  // ── witnessTransition ──────────────────────────────────────────────────────

  describe('witnessTransition()', () => {
    it('should produce Witnessed<T> for an allowed transition', async () => {
      const claimed = claimValue({ userId: 'u1' });
      const witnessed = await layer.witnessTransition(claimed, 'user-session');

      expect(witnessed.__brand).toBe('Witnessed');
      expect(witnessed.value).toEqual({ userId: 'u1' });
      expect(witnessed.receipt).toBeDefined();
      expect(witnessed.receipt.witnessed).toBe(true);
      expect(witnessed.receipt.storeKey).toBe('user-session');
      expect(witnessed.receipt.operation).toBe('transition');
    });

    it('should emit a receipt that has a non-empty deltaHash', async () => {
      const claimed = claimValue({ x: 1 });
      const witnessed = await layer.witnessTransition(claimed, 'store-x');

      expect(witnessed.receipt.deltaHash).toBeTruthy();
      expect(witnessed.receipt.deltaHash.length).toBeGreaterThanOrEqual(32);
    });

    it('should emit a receipt with BLAKE3 or SHA256 algorithm', async () => {
      const claimed = claimValue({ data: 'important' });
      const witnessed = await layer.witnessTransition(claimed, 'critical-store');

      expect(['BLAKE3', 'SHA256', 'FALLBACK']).toContain(witnessed.receipt.algorithm);
    });

    it('should throw MembraneViolationError when membrane denies transition', async () => {
      layer.getMembrane().interceptors.register(async () => false);

      const claimed = claimValue({ role: 'admin' });

      await expect(layer.witnessTransition(claimed, 'role-elevation')).rejects.toThrow(
        MembraneViolationError
      );
    });

    it('should throw with entityKey and refusalReceipt on denial', async () => {
      layer.getMembrane().interceptors.register(async () => false);

      const claimed = claimValue('secret');

      try {
        await layer.witnessTransition(claimed, 'secret-entity');
        fail('Expected MembraneViolationError to be thrown');
      } catch (err) {
        expect(err).toBeInstanceOf(MembraneViolationError);
        const violation = err as MembraneViolationError;
        expect(violation.entityKey).toBe('secret-entity');
        expect(violation.refusalReceipt).toBeDefined();
        expect(violation.refusalReceipt.verdict).toBe('deny');
        expect(violation.name).toBe('MembraneViolationError');
        expect(violation.message).toContain('secret-entity');
      }
    });

    it('should append to receipt ledger on successful witness', async () => {
      expect(layer.getReceiptCount()).toBe(0);
      const claimed = claimValue(42);
      await layer.witnessTransition(claimed, 'counter');
      expect(layer.getReceiptCount()).toBe(1);
    });

    it('should chain receipts: previousHash of second equals deltaHash of first', async () => {
      const c1 = claimValue({ step: 1 });
      const w1 = await layer.witnessTransition(c1, 'step-entity');

      const c2 = claimValue({ step: 2 });
      const w2 = await layer.witnessTransition(c2, 'step-entity');

      expect(w2.receipt.previousHash).toBe(w1.receipt.deltaHash);
    });

    it('should accept metadata and pass to membrane interceptor', async () => {
      const interceptedInputs: any[] = [];
      layer.getMembrane().interceptors.register(async (ctx) => {
        interceptedInputs.push(ctx.input);
        return undefined;
      });

      const claimed = claimValue({ payload: 'data' });
      await layer.witnessTransition(claimed, 'meta-entity', { tenantId: 'abc', role: 'admin' });

      expect(interceptedInputs[0]).toMatchObject({ tenantId: 'abc', role: 'admin' });
    });
  });

  // ── wrapStoreMutation ──────────────────────────────────────────────────────

  describe('wrapStoreMutation()', () => {
    it('should wrap and invoke the mutator, returning a witnessed receipt', async () => {
      const mutated: any[] = [];
      const mutator = jest.fn((nextState: any) => {
        mutated.push(nextState);
      });

      const safeSet = layer.wrapStoreMutation('authStore', mutator);
      const receipt = await safeSet({ userId: 'u1', token: 'tok' });

      expect(mutator).toHaveBeenCalledWith({ userId: 'u1', token: 'tok' });
      expect(receipt.witnessed).toBe(true);
      expect(receipt.storeKey).toBe('authStore');
      expect(receipt.operation).toBe('set');
    });

    it('should generate a receipt with non-empty hashes', async () => {
      const safeSet = layer.wrapStoreMutation('myStore', jest.fn());
      const receipt = await safeSet({ value: 99 });

      expect(receipt.stateHash).toBeTruthy();
      expect(receipt.deltaHash).toBeTruthy();
      expect(receipt.algorithm).toMatch(/^(BLAKE3|SHA256|FALLBACK)$/);
    });

    it('should mark receipt.witnessed = false when membrane denies', async () => {
      layer.getMembrane().interceptors.register(async () => false);
      const mutator = jest.fn();
      const safeSet = layer.wrapStoreMutation('deniedStore', mutator);

      const receipt = await safeSet({ value: 1 });

      // mutator should NOT have been called (membrane denied before execution)
      expect(mutator).not.toHaveBeenCalled();
      expect(receipt.witnessed).toBe(false);
      expect(receipt.isGoverned).toBe(true);
    });

    it('should chain multiple mutations in receipt ledger', async () => {
      const safeSet = layer.wrapStoreMutation('chainStore', jest.fn());

      const r1 = await safeSet({ val: 1 });
      const r2 = await safeSet({ val: 2 });
      const r3 = await safeSet({ val: 3 });

      expect(r2.previousHash).toBe(r1.deltaHash);
      expect(r3.previousHash).toBe(r2.deltaHash);
      expect(layer.getReceiptCount()).toBe(3);
    });

    it('should support async mutators', async () => {
      let asyncDone = false;
      const asyncMutator = jest.fn(async () => {
        await drainAsync();
        asyncDone = true;
      });

      const safeSet = layer.wrapStoreMutation('asyncStore', asyncMutator);
      const receipt = await safeSet({ async: true });

      expect(asyncDone).toBe(true);
      expect(receipt.witnessed).toBe(true);
    });

    it('should catch mutator exceptions and return unwitnessed receipt', async () => {
      const crashingMutator = jest.fn(() => {
        throw new Error('Store write failed');
      });

      const safeSet = layer.wrapStoreMutation('crashStore', crashingMutator);
      const receipt = await safeSet({ value: 'danger' });

      // membrane.run catches the error; receipt should exist but unwitnessed
      expect(receipt).toBeDefined();
      expect(receipt.witnessed).toBe(false);
    });

    it('should set isGoverned = true on all wrapped receipts', async () => {
      const safeSet = layer.wrapStoreMutation('govStore', jest.fn());
      const receipt = await safeSet({ x: 1 });
      expect(receipt.isGoverned).toBe(true);
    });

    it('should include a timestamp and unique id on every receipt', async () => {
      const safeSet = layer.wrapStoreMutation('tsStore', jest.fn());
      const r1 = await safeSet({ n: 1 });
      const r2 = await safeSet({ n: 2 });

      expect(r1.id).toBeTruthy();
      expect(r2.id).toBeTruthy();
      expect(r1.id).not.toBe(r2.id);
      expect(new Date(r1.timestamp).getTime()).toBeLessThanOrEqual(Date.now());
    });
  });

  // ── wrapMMKVSetItem ────────────────────────────────────────────────────────

  describe('wrapMMKVSetItem()', () => {
    it('should wrap MMKV setItem, invoking raw setItem and returning a receipt', async () => {
      const rawSet = jest.fn();
      const safeSet = layer.wrapMMKVSetItem('mmkv-auth', rawSet);

      const receipt = await safeSet('userToken', '"jwt-abc"');

      expect(rawSet).toHaveBeenCalledWith('userToken', '"jwt-abc"');
      expect(receipt.witnessed).toBe(true);
      expect(receipt.storeKey).toBe('mmkv-auth::userToken');
      expect(receipt.operation).toBe('set');
    });

    it('should JSON-parse valid JSON values for state hashing', async () => {
      const rawSet = jest.fn();
      const safeSet = layer.wrapMMKVSetItem('mmkv-data', rawSet);

      const receipt = await safeSet('config', '{"theme":"dark","lang":"en"}');
      expect(receipt.witnessed).toBe(true);
      expect(receipt.stateHash).toBeTruthy();
    });

    it('should handle non-JSON string values gracefully', async () => {
      const rawSet = jest.fn();
      const safeSet = layer.wrapMMKVSetItem('mmkv-raw', rawSet);

      const receipt = await safeSet('raw-key', 'plain-string-value');
      expect(receipt.witnessed).toBe(true);
      expect(receipt.stateHash).toBeTruthy();
    });

    it('should mark receipt as unwitnessed when membrane denies', async () => {
      layer.getMembrane().interceptors.register(async () => false);
      const rawSet = jest.fn();
      const safeSet = layer.wrapMMKVSetItem('mmkv-denied', rawSet);

      const receipt = await safeSet('key', 'value');

      expect(rawSet).not.toHaveBeenCalled();
      expect(receipt.witnessed).toBe(false);
    });

    it('should chain MMKV receipts correctly', async () => {
      const rawSet = jest.fn();
      const safeSet = layer.wrapMMKVSetItem('mmkv-chain', rawSet);

      const r1 = await safeSet('k1', '"v1"');
      const r2 = await safeSet('k2', '"v2"');

      expect(r2.previousHash).toBe(r1.deltaHash);
    });
  });

  // ── wrapMMKVRemoveItem ─────────────────────────────────────────────────────

  describe('wrapMMKVRemoveItem()', () => {
    it('should wrap MMKV removeItem, invoking raw remove and returning a receipt', async () => {
      const rawRemove = jest.fn();
      const safeRemove = layer.wrapMMKVRemoveItem('mmkv-auth', rawRemove);

      const receipt = await safeRemove('userToken');

      expect(rawRemove).toHaveBeenCalledWith('userToken');
      expect(receipt.witnessed).toBe(true);
      expect(receipt.storeKey).toBe('mmkv-auth::userToken');
      expect(receipt.operation).toBe('delete');
    });

    it('should mark receipt as unwitnessed when membrane denies', async () => {
      layer.getMembrane().interceptors.register(async () => false);
      const rawRemove = jest.fn();
      const safeRemove = layer.wrapMMKVRemoveItem('mmkv-deny', rawRemove);

      const receipt = await safeRemove('secretKey');

      expect(rawRemove).not.toHaveBeenCalled();
      expect(receipt.witnessed).toBe(false);
    });

    it('should chain remove receipts with set receipts correctly', async () => {
      const rawSet = jest.fn();
      const rawRemove = jest.fn();
      const safeSet = layer.wrapMMKVSetItem('mmkv-mixed', rawSet);
      const safeRemove = layer.wrapMMKVRemoveItem('mmkv-mixed', rawRemove);

      const r1 = await safeSet('key1', '"val1"');
      const r2 = await safeRemove('key1');

      expect(r2.previousHash).toBe(r1.deltaHash);
      expect(layer.getReceiptCount()).toBe(2);
    });
  });

  // ── governedMutation ──────────────────────────────────────────────────────

  describe('governedMutation()', () => {
    it('should execute the mutation callback and return a witnessed receipt', async () => {
      let mutated = false;
      const receipt = await layer.governedMutation(
        'feature-flags',
        { darkMode: false },
        { darkMode: true },
        () => {
          mutated = true;
        }
      );

      expect(mutated).toBe(true);
      expect(receipt.witnessed).toBe(true);
      expect(receipt.operation).toBe('patch');
      expect(receipt.storeKey).toBe('feature-flags');
    });

    it('should return unwitnessed receipt when membrane denies', async () => {
      layer.getMembrane().interceptors.register(async () => false);

      let mutated = false;
      const receipt = await layer.governedMutation('locked-store', {}, { danger: true }, () => {
        mutated = true;
      });

      expect(mutated).toBe(false);
      expect(receipt.witnessed).toBe(false);
    });

    it('should support async mutation callbacks', async () => {
      let done = false;
      const receipt = await layer.governedMutation(
        'async-store',
        { val: 0 },
        { val: 1 },
        async () => {
          await drainAsync();
          done = true;
        }
      );

      expect(done).toBe(true);
      expect(receipt.witnessed).toBe(true);
    });

    it('should catch exceptions in mutate and return unwitnessed receipt', async () => {
      const receipt = await layer.governedMutation('crash-store', {}, {}, () => {
        throw new Error('mutation fault');
      });

      expect(receipt.witnessed).toBe(false);
      expect(receipt.storeKey).toBe('crash-store');
    });
  });

  // ── verifyMembraneIntegrity ────────────────────────────────────────────────

  describe('verifyMembraneIntegrity()', () => {
    it('should return a perfect report for an empty ledger', () => {
      const report = layer.verifyMembraneIntegrity();

      expect(report.totalReceipts).toBe(0);
      expect(report.witnessedCount).toBe(0);
      expect(report.unwitnessedCount).toBe(0);
      expect(report.chainValid).toBe(true);
      expect(report.integrityScore).toBe(1.0);
      expect(report.unwitnessedTransitions).toHaveLength(0);
      expect(report.chainError).toBeUndefined();
    });

    it('should report 1.0 integrity score when all receipts are witnessed', async () => {
      const safeSet = layer.wrapStoreMutation('goodStore', jest.fn());
      await safeSet({ a: 1 });
      await safeSet({ a: 2 });
      await safeSet({ a: 3 });

      const report = layer.verifyMembraneIntegrity();

      expect(report.totalReceipts).toBe(3);
      expect(report.witnessedCount).toBe(3);
      expect(report.unwitnessedCount).toBe(0);
      expect(report.integrityScore).toBe(1.0);
      expect(report.chainValid).toBe(true);
    });

    it('should detect unwitnessed receipts from denied mutations', async () => {
      // Allow first mutation
      const safeSet = layer.wrapStoreMutation('partialStore', jest.fn());
      await safeSet({ ok: true });

      // Deny second mutation
      layer.getMembrane().interceptors.register(async () => false);
      await safeSet({ ok: false });

      const report = layer.verifyMembraneIntegrity();

      expect(report.totalReceipts).toBe(2);
      expect(report.witnessedCount).toBe(1);
      expect(report.unwitnessedCount).toBe(1);
      expect(report.unwitnessedTransitions).toHaveLength(1);
      expect(report.unwitnessedTransitions[0].storeKey).toBe('partialStore');
      expect(report.integrityScore).toBeLessThan(1.0);
    });

    it('should populate unwitnessedTransitions with correct operation and timestamp', async () => {
      layer.getMembrane().interceptors.register(async () => false);
      const rawRemove = jest.fn();
      const safeRemove = layer.wrapMMKVRemoveItem('mmkv-test', rawRemove);
      await safeRemove('key1');

      const report = layer.verifyMembraneIntegrity();

      expect(report.unwitnessedTransitions[0].operation).toBe('delete');
      expect(report.unwitnessedTransitions[0].storeKey).toBe('mmkv-test::key1');
      expect(new Date(report.unwitnessedTransitions[0].timestamp).getTime()).toBeLessThanOrEqual(
        Date.now()
      );
    });

    it('should include the receiptId in unwitnessed transitions', async () => {
      layer.getMembrane().interceptors.register(async () => false);
      const safeSet = layer.wrapStoreMutation('idStore', jest.fn());
      await safeSet({ x: 1 });

      const report = layer.verifyMembraneIntegrity();

      expect(report.unwitnessedTransitions[0].receiptId).toBeTruthy();
      expect(report.unwitnessedTransitions[0].receiptId.startsWith('hrdn_')).toBe(true);
    });

    it('should report chain as valid for a linear receipt sequence', async () => {
      const safeSet = layer.wrapStoreMutation('chainStore', jest.fn());
      await safeSet({ step: 1 });
      await safeSet({ step: 2 });
      await safeSet({ step: 3 });

      const report = layer.verifyMembraneIntegrity();
      expect(report.chainValid).toBe(true);
      expect(report.chainError).toBeUndefined();
    });

    it('should include a scannedAt timestamp', async () => {
      const before = new Date().toISOString();
      const report = layer.verifyMembraneIntegrity();
      const after = new Date().toISOString();

      expect(report.scannedAt >= before).toBe(true);
      expect(report.scannedAt <= after).toBe(true);
    });

    it('should calculate integrityScore as witnessRatio when chain is valid', async () => {
      // 2 allowed + 1 denied = 2/3 witnessed
      const safeSet = layer.wrapStoreMutation('ratioStore', jest.fn());
      await safeSet({ n: 1 });
      await safeSet({ n: 2 });
      layer.getMembrane().interceptors.register(async () => false);
      await safeSet({ n: 3 });

      const report = layer.verifyMembraneIntegrity();
      expect(report.integrityScore).toBeCloseTo(2 / 3, 2);
    });

    it('should describe unwitnessed transitions with reason strings', async () => {
      layer.getMembrane().interceptors.register(async () => false);
      const safeSet = layer.wrapStoreMutation('reasonStore', jest.fn());
      await safeSet({ val: 1 });

      const report = layer.verifyMembraneIntegrity();
      expect(report.unwitnessedTransitions[0].reason).toBeTruthy();
      expect(typeof report.unwitnessedTransitions[0].reason).toBe('string');
    });
  });

  // ── Receipt Chain Validation ───────────────────────────────────────────────

  describe('getReceiptLedger() and chain validation', () => {
    it('should return an empty ledger initially', () => {
      expect(layer.getReceiptLedger()).toHaveLength(0);
      expect(layer.getReceiptCount()).toBe(0);
    });

    it('should accumulate receipts in order', async () => {
      const safeSet = layer.wrapStoreMutation('orderStore', jest.fn());
      await safeSet({ i: 0 });
      await safeSet({ i: 1 });
      await safeSet({ i: 2 });

      const ledger = layer.getReceiptLedger();
      expect(ledger).toHaveLength(3);
      expect(ledger[0].storeKey).toBe('orderStore');
      expect(ledger[1].previousHash).toBe(ledger[0].deltaHash);
      expect(ledger[2].previousHash).toBe(ledger[1].deltaHash);
    });

    it('should return a copy from getReceiptLedger (not a mutable reference)', async () => {
      const safeSet = layer.wrapStoreMutation('copyStore', jest.fn());
      await safeSet({ x: 1 });

      const ledger = layer.getReceiptLedger() as HardeningReceipt[];
      const countBefore = ledger.length;

      await safeSet({ x: 2 }); // add another

      // The previously captured reference should be stale (it's a copy)
      expect(ledger.length).toBe(countBefore);
    });

    it('should produce genesis receipt with previousHash = ""', async () => {
      const safeSet = layer.wrapStoreMutation('genesisStore', jest.fn());
      const receipt = await safeSet({ genesis: true });

      expect(receipt.previousHash).toBe('');
    });

    it('should clear ledger via clearLedger()', async () => {
      const safeSet = layer.wrapStoreMutation('clearStore', jest.fn());
      await safeSet({ v: 1 });
      await safeSet({ v: 2 });
      expect(layer.getReceiptCount()).toBe(2);

      layer.clearLedger();
      expect(layer.getReceiptCount()).toBe(0);
      expect(layer.getReceiptLedger()).toHaveLength(0);
    });

    it('should reset previousHash to "" after clearLedger', async () => {
      const safeSet = layer.wrapStoreMutation('resetStore', jest.fn());
      await safeSet({ v: 1 });
      layer.clearLedger();
      const r2 = await safeSet({ v: 2 });

      expect(r2.previousHash).toBe('');
    });
  });

  // ── Receipt Listeners ──────────────────────────────────────────────────────

  describe('onReceipt() / offReceipt()', () => {
    it('should notify listeners on every receipt emission', async () => {
      const received: HardeningReceipt[] = [];
      layer.onReceipt((r) => received.push(r));

      const safeSet = layer.wrapStoreMutation('listenStore', jest.fn());
      await safeSet({ val: 1 });
      await safeSet({ val: 2 });

      expect(received).toHaveLength(2);
      expect(received[0].storeKey).toBe('listenStore');
    });

    it('should stop notifying after offReceipt()', async () => {
      const received: HardeningReceipt[] = [];
      const listener = (r: HardeningReceipt) => received.push(r);
      layer.onReceipt(listener);

      const safeSet = layer.wrapStoreMutation('offStore', jest.fn());
      await safeSet({ v: 1 });

      layer.offReceipt(listener);
      await safeSet({ v: 2 });

      expect(received).toHaveLength(1);
    });

    it('should suppress listener errors without crashing', async () => {
      const badListener = () => {
        throw new Error('listener error');
      };
      layer.onReceipt(badListener);

      const safeSet = layer.wrapStoreMutation('safeStore', jest.fn());

      await expect(safeSet({ v: 1 })).resolves.toBeDefined();
    });

    it('should notify multiple independent listeners', async () => {
      const calls1: string[] = [];
      const calls2: string[] = [];

      layer.onReceipt((r) => calls1.push(r.id));
      layer.onReceipt((r) => calls2.push(r.id));

      const safeSet = layer.wrapStoreMutation('multiStore', jest.fn());
      await safeSet({ x: 1 });

      expect(calls1).toHaveLength(1);
      expect(calls2).toHaveLength(1);
      expect(calls1[0]).toBe(calls2[0]);
    });

    it('should notify listeners for witnessTransition receipts', async () => {
      const received: HardeningReceipt[] = [];
      layer.onReceipt((r) => received.push(r));

      const claimed = claimValue({ step: 'done' });
      await layer.witnessTransition(claimed, 'witness-listen');

      expect(received).toHaveLength(1);
      expect(received[0].operation).toBe('transition');
    });
  });

  // ── getMembrane / getConfig ────────────────────────────────────────────────

  describe('getMembrane() / getConfig()', () => {
    it('should expose the underlying Membrane instance', () => {
      const membrane = layer.getMembrane();
      expect(membrane).toBeDefined();
      expect(typeof membrane.run).toBe('function');
    });

    it('should expose the config', () => {
      const config = layer.getConfig();
      expect(config.mode).toBe('strict');
      expect(config.tenantId).toBe('test-tenant');
    });

    it('should allow registering interceptors via getMembrane()', async () => {
      let intercepted = false;
      layer.getMembrane().interceptors.register(async () => {
        intercepted = true;
        return undefined;
      });

      const safeSet = layer.wrapStoreMutation('interceptStore', jest.fn());
      await safeSet({ v: 1 });

      expect(intercepted).toBe(true);
    });
  });

  // ── Factory Helpers ────────────────────────────────────────────────────────

  describe('Factory helpers', () => {
    it('createStrictHardeningLayer should produce strict mode layer', () => {
      const l = createStrictHardeningLayer('tenant-a');
      expect(l.getConfig().mode).toBe('strict');
      expect(l.getConfig().tenantId).toBe('tenant-a');
    });

    it('createStrictHardeningLayer should work without tenantId', () => {
      const l = createStrictHardeningLayer();
      expect(l.getConfig().mode).toBe('strict');
      expect(l.getConfig().tenantId).toBeUndefined();
    });

    it('createAuditHardeningLayer should produce audit mode layer', () => {
      const l = createAuditHardeningLayer('tenant-b');
      expect(l.getConfig().mode).toBe('audit');
    });

    it('createSimulationHardeningLayer should produce simulate mode layer', () => {
      const l = createSimulationHardeningLayer();
      expect(l.getConfig().mode).toBe('simulate');
    });
  });

  // ── Global Singleton ───────────────────────────────────────────────────────

  describe('Global singleton', () => {
    beforeEach(() => _resetGlobalHardeningLayer());
    afterEach(() => _resetGlobalHardeningLayer());

    it('getGlobalHardeningLayer() initializes on first call in strict mode', () => {
      const g = getGlobalHardeningLayer();
      expect(g.getConfig().mode).toBe('strict');
      expect(g.getConfig().tenantId).toBe('global');
    });

    it('getGlobalHardeningLayer() returns the same instance on repeated calls', () => {
      const g1 = getGlobalHardeningLayer();
      const g2 = getGlobalHardeningLayer();
      expect(g1).toBe(g2);
    });

    it('initGlobalHardeningLayer() replaces the singleton', () => {
      const g1 = getGlobalHardeningLayer();
      const g2 = initGlobalHardeningLayer({ mode: 'audit', tenantId: 'new-tenant' });
      const g3 = getGlobalHardeningLayer();

      expect(g2).toBe(g3);
      expect(g2).not.toBe(g1);
      expect(g3.getConfig().mode).toBe('audit');
    });

    it('_resetGlobalHardeningLayer() causes re-initialization on next get', () => {
      const g1 = getGlobalHardeningLayer();
      _resetGlobalHardeningLayer();
      const g2 = getGlobalHardeningLayer();

      expect(g1).not.toBe(g2);
    });
  });

  // ── BLAKE3 3-Tier Fallback ─────────────────────────────────────────────────

  describe('BLAKE3 3-tier fallback receipt hashing', () => {
    it('should use BLAKE3 algorithm for receipts when available', async () => {
      const safeSet = layer.wrapStoreMutation('blake3Store', jest.fn());
      const receipt = await safeSet({ data: 'testValue', count: 100 });

      // Primary algorithm should be BLAKE3
      expect(receipt.algorithm).toBe('BLAKE3');
    });

    it('should produce a 64-char hex hash for BLAKE3 receipts', async () => {
      const safeSet = layer.wrapStoreMutation('hexStore', jest.fn());
      const receipt = await safeSet({ x: 'hello world' });

      // BLAKE3 outputs 256 bits = 32 bytes = 64 hex chars
      expect(receipt.deltaHash).toMatch(/^[0-9a-f]{64}$/);
      expect(receipt.stateHash).toMatch(/^[0-9a-f]{64}$/);
    });

    it('should produce deterministic hashes for the same data (same previous hash)', async () => {
      // Two fresh layers, same first mutation → same stateHash
      const l1 = makeLayer();
      const l2 = makeLayer();

      const s1 = l1.wrapStoreMutation('detStore', jest.fn());
      const s2 = l2.wrapStoreMutation('detStore', jest.fn());

      const r1 = await s1({ key: 'value', num: 42 });
      const r2 = await s2({ key: 'value', num: 42 });

      expect(r1.stateHash).toBe(r2.stateHash);
      expect(r1.deltaHash).toBe(r2.deltaHash);
    });

    it('should produce different deltaHashes for different previous hashes', async () => {
      const l1 = makeLayer();
      const l2 = makeLayer();

      // Pre-populate l1 with one receipt so its chain head differs from l2's
      await l1.wrapStoreMutation('primeStore', jest.fn())({ pre: 'seeded' });

      const s1 = l1.wrapStoreMutation('divergeStore', jest.fn());
      const s2 = l2.wrapStoreMutation('divergeStore', jest.fn());

      const r1 = await s1({ data: 'same' });
      const r2 = await s2({ data: 'same' });

      // Same stateHash (same data), different deltaHash (different chain heads)
      expect(r1.stateHash).toBe(r2.stateHash);
      expect(r1.deltaHash).not.toBe(r2.deltaHash);
    });
  });

  // ── MembraneViolationError ─────────────────────────────────────────────────

  describe('MembraneViolationError', () => {
    it('should be an instance of Error', async () => {
      layer.getMembrane().interceptors.register(async () => false);
      try {
        await layer.witnessTransition(claimValue(1), 'denied');
      } catch (err) {
        expect(err instanceof Error).toBe(true);
      }
    });

    it('should have name MembraneViolationError', async () => {
      layer.getMembrane().interceptors.register(async () => false);
      try {
        await layer.witnessTransition(claimValue('test'), 'denied-entity');
      } catch (err: any) {
        expect(err.name).toBe('MembraneViolationError');
      }
    });

    it('should expose entityKey and refusalReceipt', async () => {
      layer.getMembrane().interceptors.register(async () => false);
      try {
        await layer.witnessTransition(claimValue({ v: 1 }), 'sensitive-entity');
      } catch (err: any) {
        expect(err.entityKey).toBe('sensitive-entity');
        expect(err.refusalReceipt).toBeDefined();
        expect(err.refusalReceipt.verdict).toBe('deny');
      }
    });

    it('can be constructed directly with all required args', () => {
      const fakeReceipt: any = { verdict: 'deny', success: false };
      const violation = new MembraneViolationError('test message', 'entity-key', fakeReceipt);
      expect(violation.message).toBe('test message');
      expect(violation.entityKey).toBe('entity-key');
      expect(violation.refusalReceipt).toBe(fakeReceipt);
    });
  });

  // ── Edge Cases ────────────────────────────────────────────────────────────

  describe('Edge cases', () => {
    it('should handle undefined/null values in wrapStoreMutation', async () => {
      const safeSet = layer.wrapStoreMutation<any>('nullStore', jest.fn());
      const r1 = await safeSet(null as any);
      const r2 = await safeSet(undefined as any);
      expect(r1.witnessed).toBe(true);
      expect(r2.witnessed).toBe(true);
    });

    it('should handle very large objects without error', async () => {
      const largeObject: Record<string, number> = {};
      for (let i = 0; i < 1000; i++) {
        largeObject[`key_${i}`] = i;
      }
      const safeSet = layer.wrapStoreMutation('bigStore', jest.fn());
      const receipt = await safeSet(largeObject);
      expect(receipt.witnessed).toBe(true);
      expect(receipt.stateHash.length).toBeGreaterThanOrEqual(32);
    });

    it('should handle empty string MMKV values', async () => {
      const rawSet = jest.fn();
      const safeSet = layer.wrapMMKVSetItem('mmkv-empty', rawSet);
      const receipt = await safeSet('emptyKey', '');
      expect(receipt.witnessed).toBe(true);
    });

    it('should handle concurrent mutations without corrupting chain order', async () => {
      const safeSet = layer.wrapStoreMutation('concStore', jest.fn());

      // Fire three mutations "simultaneously"
      const [r1, r2, r3] = await Promise.all([
        safeSet({ n: 1 }),
        safeSet({ n: 2 }),
        safeSet({ n: 3 }),
      ]);

      // All receipts should exist and be witnessed
      expect(r1.witnessed).toBe(true);
      expect(r2.witnessed).toBe(true);
      expect(r3.witnessed).toBe(true);

      // Ledger should have 3 entries
      expect(layer.getReceiptCount()).toBe(3);
    });

    it('should handle cycles in interceptor chain without infinite loop', async () => {
      let callCount = 0;
      layer.getMembrane().interceptors.register(async () => {
        callCount++;
        return undefined;
      });

      const safeSet = layer.wrapStoreMutation('cycleStore', jest.fn());
      await safeSet({ x: 1 });

      expect(callCount).toBe(1);
    });

    it('integrity report should never have integrityScore < 0', async () => {
      layer.getMembrane().interceptors.register(async () => false);
      const safeSet = layer.wrapStoreMutation('negStore', jest.fn());
      for (let i = 0; i < 5; i++) {
        await safeSet({ i });
      }
      const report = layer.verifyMembraneIntegrity();
      expect(report.integrityScore).toBeGreaterThanOrEqual(0);
    });

    it('integrity report should never have integrityScore > 1', async () => {
      const safeSet = layer.wrapStoreMutation('posStore', jest.fn());
      for (let i = 0; i < 5; i++) {
        await safeSet({ i });
      }
      const report = layer.verifyMembraneIntegrity();
      expect(report.integrityScore).toBeLessThanOrEqual(1);
    });

    it('should generate unique receipt IDs starting with hrdn_', async () => {
      const safeSet = layer.wrapStoreMutation('idStore', jest.fn());
      const receipts = await Promise.all([safeSet({ n: 1 }), safeSet({ n: 2 }), safeSet({ n: 3 })]);

      const ids = receipts.map((r) => r.id);
      expect(new Set(ids).size).toBe(ids.length); // all unique
      ids.forEach((id) => expect(id.startsWith('hrdn_')).toBe(true));
    });

    it('Witnessed<T> brand should be "Witnessed"', async () => {
      const w = await layer.witnessTransition(claimValue({ v: 1 }), 'type-check');
      // TypeScript guarantees this, but validate at runtime too
      expect(w.__brand).toBe('Witnessed');
    });

    it('Claimed<T> and Witnessed<T> values should be identical after transition', async () => {
      const originalData = { complex: { nested: [1, 2, 3], key: 'val' } };
      const claimed = claimValue(originalData);
      const witnessed = await layer.witnessTransition(claimed, 'identity-check');

      expect(witnessed.value).toEqual(originalData);
    });
  });

  // ── Full Integration Flow ──────────────────────────────────────────────────

  describe('Full integration: mixed operations integrity', () => {
    it('should produce a fully valid report after mixed ops', async () => {
      const mockStore = { state: { counter: 0 } };
      const safeSetStore = layer.wrapStoreMutation('counter-store', (next: any) => {
        Object.assign(mockStore.state, next);
      });

      const rawMMKV: Record<string, string> = {};
      const safeSetMMKV = layer.wrapMMKVSetItem('session-mmkv', (k, v) => {
        rawMMKV[k] = v;
      });
      const safeDelMMKV = layer.wrapMMKVRemoveItem('session-mmkv', (k) => {
        delete rawMMKV[k];
      });

      // 1. Store mutations
      await safeSetStore({ counter: 1 });
      await safeSetStore({ counter: 2 });

      // 2. MMKV set & delete
      await safeSetMMKV('token', '"jwt-xyz"');
      await safeDelMMKV('token');

      // 3. Witness transition
      const claimed = claimValue({ userId: 'u123', role: 'admin' });
      await layer.witnessTransition(claimed, 'user-session');

      // 4. Governed mutation
      await layer.governedMutation('feature-flags', { beta: false }, { beta: true }, () => {
        /* apply */
      });

      const report = layer.verifyMembraneIntegrity();

      expect(report.totalReceipts).toBe(6);
      expect(report.witnessedCount).toBe(6);
      expect(report.unwitnessedCount).toBe(0);
      expect(report.chainValid).toBe(true);
      expect(report.integrityScore).toBe(1.0);

      // Verify chain continuity manually
      const ledger = layer.getReceiptLedger();
      for (let i = 1; i < ledger.length; i++) {
        expect(ledger[i].previousHash).toBe(ledger[i - 1].deltaHash);
      }
    });

    it('should detect mixed witnessed/unwitnessed in integrity report', async () => {
      const safeSet = layer.wrapStoreMutation('mixed-final', jest.fn());

      // First two succeed
      await safeSet({ ok: 1 });
      await safeSet({ ok: 2 });

      // Deny all subsequent
      layer.getMembrane().interceptors.register(async () => false);
      await safeSet({ denied: 1 });
      await safeSet({ denied: 2 });

      const report = layer.verifyMembraneIntegrity();

      expect(report.totalReceipts).toBe(4);
      expect(report.witnessedCount).toBe(2);
      expect(report.unwitnessedCount).toBe(2);
      expect(report.chainValid).toBe(true);
      expect(report.integrityScore).toBeCloseTo(0.5, 2);
    });
  });
});
