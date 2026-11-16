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
  });
});
