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

    it('transmits encoded deltas successfully if SNR is good', async () => {
      const adapter = new AmbientBackscatterAdapter({ snrThreshold: 10, reflectionCoefficient: 1 });
      adapter.bufferDelta('test_data');
      const result = await adapter.transmit(15);
      expect(result).toBe(true);
    });

    it('returns true immediately if there is nothing to transmit but SNR is ok', async () => {
      const adapter = new AmbientBackscatterAdapter({ snrThreshold: 10, reflectionCoefficient: 1 });
      const result = await adapter.transmit(15);
      expect(result).toBe(true);
    });

    it('fails to transmit if SNR is poor', async () => {
      const adapter = new AmbientBackscatterAdapter({
        snrThreshold: 20,
        reflectionCoefficient: 0.5,
      });
      adapter.bufferDelta('test_data');
      const result = await adapter.transmit(30);
      expect(result).toBe(false);
    });

    it('throws error if already transmitting', async () => {
      const adapter = new AmbientBackscatterAdapter();
      adapter.bufferDelta('test_data');
      const p1 = adapter.transmit(50);
      await expect(adapter.transmit(50)).rejects.toThrow('Already transmitting');
      await p1;
    });

    it('receives and decodes valid payloads', () => {
      const adapter = new AmbientBackscatterAdapter({ snrThreshold: 10, reflectionCoefficient: 1 });
      const encoded = {
        payload: Buffer.from('hello').toString('base64'),
        modulation: 'OOK' as const,
        energyCostMicroJoules: 1,
      };

      const received = adapter.receive(encoded, 50);
      expect(received).toBe('hello');
    });

    it('fails to receive if ambient noise is too high', () => {
      const adapter = new AmbientBackscatterAdapter({ snrThreshold: 60, reflectionCoefficient: 1 });
      const encoded = {
        payload: Buffer.from('hello').toString('base64'),
        modulation: 'OOK' as const,
        energyCostMicroJoules: 1,
      };

      const received = adapter.receive(encoded, 50);
      expect(received).toBeNull();
    });

    it('fails gracefully on invalid payload type', () => {
      const adapter = new AmbientBackscatterAdapter({ snrThreshold: 10, reflectionCoefficient: 1 });
      const encoded = { payload: 123 as any, modulation: 'OOK' as const, energyCostMicroJoules: 1 };
      const received = adapter.receive(encoded, 0);
      expect(received).toBeNull();
    });
  });

  describe('ThermalSyncEngine', () => {
    it('initializes and harvests energy', () => {
      const engine = new ThermalSyncEngine(0.05);
      const harvested = engine.harvestEnergy({ deviceTempCelsius: 40, ambientTempCelsius: 20 }, 10);
      expect(harvested).toBe(200000);
      expect(engine.getEnergyBuffer()).toBe(200000);
    });

    it('checks transmission capability', () => {
      const engine = new ThermalSyncEngine(0.01);
      engine.harvestEnergy({ deviceTempCelsius: 30, ambientTempCelsius: 20 }, 1);
      expect(engine.canTransmit(500)).toBe(true);
      expect(engine.canTransmit(2000)).toBe(false);
    });

    it('consumes energy successfully', () => {
      const engine = new ThermalSyncEngine(0.01);
      engine.harvestEnergy({ deviceTempCelsius: 30, ambientTempCelsius: 20 }, 1);
      engine.consumeEnergy(500);
      expect(engine.getEnergyBuffer()).toBe(500);
    });

    it('throws if consuming more than available', () => {
      const engine = new ThermalSyncEngine(0.01);
      engine.harvestEnergy({ deviceTempCelsius: 25, ambientTempCelsius: 20 }, 1);
      expect(() => engine.consumeEnergy(500)).toThrow('Insufficient thermal energy harvested');
    });

    it('modulates and demodulates heat pulses', () => {
      const engine = new ThermalSyncEngine();
      const message = 'CRDT_SYNC_PACKET';
      const pulses = engine.modulateDeltaWithHeat(message);
      expect(pulses).toHaveLength(message.length);

      const demodulated = engine.demodulateHeatPulses(pulses);
      expect(demodulated).toBe(message);
    });
  });
});
