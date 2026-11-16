import { SatelliteSyncAdapter } from '../adapters/SatelliteSyncAdapter';
import { LoRaSyncAdapter } from '../adapters/LoRaSyncAdapter';
import { QuantumSyncAdapter } from '../adapters/QuantumSyncAdapter';
import { SyncExtremeMode } from '../types';

describe('Extreme Sync Adapters', () => {
  describe('SatelliteSyncAdapter', () => {
    let adapter: SatelliteSyncAdapter;

    beforeEach(() => {
      adapter = new SatelliteSyncAdapter();
    });

    it('should have SATELLITE mode', () => {
      expect(adapter.mode).toBe(SyncExtremeMode.SATELLITE);
    });

    it('should broadcast with simulated latency', async () => {
      const start = Date.now();
      await adapter.broadcast('ws-1', 'payload');
      const duration = Date.now() - start;
      // Latency is between 25ms and 500ms
      expect(duration).toBeGreaterThanOrEqual(20);
    });

    it('should trigger listeners on incoming update', () => {
      const callback = jest.fn();
      adapter.onUpdate(callback);
      adapter.simulateIncomingUpdate('ws-1', 'payload');
      expect(callback).toHaveBeenCalledWith('ws-1', 'payload');
    });
  });
});
