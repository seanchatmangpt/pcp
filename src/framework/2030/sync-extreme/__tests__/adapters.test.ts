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

    it('should return connected status', () => {
      expect(adapter.getStatus()).toBe('connected');
    });
  });

  describe('LoRaSyncAdapter', () => {
    let adapter: LoRaSyncAdapter;

    beforeEach(() => {
      adapter = new LoRaSyncAdapter();
    });

    it('should have LORA mode', () => {
      expect(adapter.mode).toBe(SyncExtremeMode.LORA);
    });

    it('should broadcast with simulated low bandwidth', async () => {
      const start = Date.now();
      const payload = 'some-payload';
      await adapter.broadcast('ws-1', payload);
      const duration = Date.now() - start;
      // 2ms per byte, payload.length = 12, so 24ms
      expect(duration).toBeGreaterThanOrEqual(20);
    });

    it('should trigger listeners on incoming update', () => {
      const callback = jest.fn();
      adapter.onUpdate(callback);
      adapter.simulateIncomingUpdate('ws-1', 'payload');
      expect(callback).toHaveBeenCalledWith('ws-1', 'payload');
    });

    it('should return degraded status', () => {
      expect(adapter.getStatus()).toBe('degraded');
    });
  });

  describe('QuantumSyncAdapter', () => {
    let adapter: QuantumSyncAdapter;

    beforeEach(() => {
      adapter = new QuantumSyncAdapter();
    });

    it('should have QUANTUM mode', () => {
      expect(adapter.mode).toBe(SyncExtremeMode.QUANTUM);
    });

    it('should broadcast instantaneously', async () => {
      const start = Date.now();
      await adapter.broadcast('ws-1', 'payload');
      const duration = Date.now() - start;
      expect(duration).toBeLessThan(50);
    });

    it('should trigger listeners on incoming update', () => {
      const callback = jest.fn();
      adapter.onUpdate(callback);
      adapter.simulateIncomingUpdate('ws-1', 'payload');
      expect(callback).toHaveBeenCalledWith('ws-1', 'payload');
    });

    it('should return connected status', () => {
      expect(adapter.getStatus()).toBe('connected');
    });
  });
});
