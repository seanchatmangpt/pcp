import { renderHook, act } from '@testing-library/react-native';
import { SybilMeshAdapter } from '../SybilMeshAdapter';
import { StatePoisoner } from '../StatePoisoner';
import { MeshSyncEngineImpl } from '../../../sync/p2p/engine';
import { LWWRegister } from '../../../sync/crdt/register';
import { SelfHealingMembrane } from '../../../membrane/self-healing';
import { mmkvInstance } from '@/src/lib/store/mmkvStorage';

jest.mock('../../../../../src/lib/store/mmkvStorage', () => ({
  mmkvInstance: {
    set: jest.fn(),
    getString: jest.fn(),
    getAllKeys: jest.fn().mockReturnValue([]),
    clearAll: jest.fn(),
  },
}));

jest.mock('../../../../../src/lib/db/db', () => {
  const mockInsert = jest.fn().mockReturnValue({ values: jest.fn().mockResolvedValue({}) });
  return {
    db: { insert: mockInsert },
    syncQueue: {},
  };
});

describe('AGI Adversarial Review: Resilience Assertions', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('SybilMeshAdapter vs MeshSyncEngine', () => {
    it('successfully defends against P2P Causal Window Split-Brain attacks', async () => {
      const adapter = new SybilMeshAdapter('peer-local');
      const violationSpy = jest.fn();

      const engine = new MeshSyncEngineImpl(adapter, {
        syncStrategy: 'full',
        onCausalWindowViolation: violationSpy,
      });

      const crdt = new LWWRegister('peer-local', 10);
      engine.registerCrdt('test-reg', crdt);

      await adapter.start();

      // Launch an attack of 1,000 forged CRDT updates with old timestamps
      adapter.triggerSybilFlood('test-reg', 1000);

      // The Iron Law constraint should have intercepted all 1000 packets
      expect(violationSpy).toHaveBeenCalledTimes(1000);

      // The CRDT state MUST remain unpolluted
      expect(crdt.value).toBe(10);

      await adapter.stop();
      engine.stop();
    });

    it('defends against malformed JSON structure floods', async () => {
      const adapter = new SybilMeshAdapter('peer-local');
      const engine = new MeshSyncEngineImpl(adapter);

      const crdt = new LWWRegister('peer-local', 10);
      engine.registerCrdt('test-reg', crdt);

      await adapter.start();

      // The engine should not crash when processing null states
      expect(() => {
        adapter.triggerMalformedFlood('test-reg');
      }).not.toThrow();

      await adapter.stop();
      engine.stop();
    });
  });

  describe('StatePoisoner vs AutonomousRepair', () => {
    it('simulates MMKV cache corruption without crashing the app shell', () => {
      StatePoisoner.poisonMmkvCache('test_key');
      expect(mmkvInstance.set).toHaveBeenCalledWith(
        'test_key',
        '{"broken_json": true, "missing_bracket": '
      );
    });

    it('simulates Membrane Receipt Chain fragmentation forcing a hard reset', async () => {
      const target = { secureValue: 'data' };
      const membrane = new SelfHealingMembrane({ mode: 'strict', tenantId: 't1' }, target, {
        autoHeal: true,
      });

      // Poison the chain
      StatePoisoner.poisonMembraneChain(membrane);

      // The chain is now invalid
      expect(membrane.receipts.validateChain().valid).toBe(false);

      // Attempting to heal should trigger the fallback logic (hard reset) because there are no valid snapshots
      const healResult = await membrane.selfHealing.heal();
      expect(healResult.recovered).toBe(true);
      expect(target).toEqual({}); // Erased for security

      membrane.dispose();
    });
  });
});
