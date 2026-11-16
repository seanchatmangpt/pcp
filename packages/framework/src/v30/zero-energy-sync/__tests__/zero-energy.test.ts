import { AmbientBackscatterAdapter } from '../AmbientBackscatterAdapter';
import { ThermalSyncEngine } from '../ThermalSyncEngine';

describe('Zero-Energy Sync Framework', () => {
  describe('AmbientBackscatterAdapter', () => {
    it('initializes with default config', () => {
      const adapter = new AmbientBackscatterAdapter();
      expect(adapter).toBeDefined();
    });

    it('buffers crdt deltas', () => {
      const adapter = new AmbientBackscatterAdapter();
      adapter.bufferDelta('userA_update_1');
      expect(() => adapter.bufferDelta('')).toThrow('Invalid delta');
    });

    it('encodes buffered deltas', () => {
      const adapter = new AmbientBackscatterAdapter({ reflectionCoefficient: 0.5 });
      adapter.bufferDelta('short');
      adapter.bufferDelta('a'.repeat(150));
      const encoded = adapter.encodeBuffer();

      expect(encoded).toHaveLength(2);
      expect(encoded[0].modulation).toBe('OOK');
      expect(encoded[1].modulation).toBe('FSK');
      expect(encoded[0].payload).toBe(Buffer.from('short').toString('base64'));
      expect(encoded[0].energyCostMicroJoules).toBe(5 * 0.05 * 2);
    });
  });
});
