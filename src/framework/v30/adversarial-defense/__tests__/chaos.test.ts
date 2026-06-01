import { ChaosInjector } from '../ChaosInjector';
import { ImmuneResponse } from '../ImmuneResponse';

describe('Chaos Immune System', () => {
  let immuneResponse: ImmuneResponse;
  let injector: ChaosInjector;

  beforeEach(() => {
    immuneResponse = new ImmuneResponse();
    // Set frequency to 1 to guarantee chaos injection unless disabled
    injector = new ChaosInjector({ frequency: 1, enabled: true }, immuneResponse);
    // Clear log before each test
    immuneResponse.clearLog();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('ChaosInjector configurations', () => {
    test('should not inject chaos if disabled', () => {
      injector.setConfig({ enabled: false });
      const data = { valid: true };
      const result = injector.cycle(data, 'MMKV_STATE');
      expect(result).toBe(data);
      expect(immuneResponse.getLog().length).toBe(0);
    });

    test('should not inject chaos if frequency is not met', () => {
      injector.setConfig({ frequency: 0 }); // 0% chance
      const data = { valid: true };
      const result = injector.cycle(data, 'MMKV_STATE');
      expect(result).toBe(data);
      expect(immuneResponse.getLog().length).toBe(0);
    });

    test('should trigger chaos if frequency is exactly met (using mock)', () => {
      injector.setConfig({ frequency: 0.5 });
      jest.spyOn(Math, 'random').mockReturnValue(0.4); // 0.4 <= 0.5
      const data = { valid: true };
      const result = injector.cycle(data, 'MMKV_STATE');
      expect(result).not.toBe(data);
      expect(immuneResponse.getLog().length).toBe(1);
    });

    test('should use default config when none provided', () => {
      const defaultInjector = new ChaosInjector(undefined, immuneResponse);
      // Default frequency is 0.01, enabled is true.
      jest.spyOn(Math, 'random').mockReturnValue(0.5); // > 0.01 so NO chaos
      const data = { valid: true };
      const result = defaultInjector.cycle(data, 'MMKV_STATE');
      expect(result).toBe(data);
    });
  });

  describe('CorruptionTarget: MMKV_STATE', () => {
    test('should corrupt MMKV state by dropping a key', () => {
      const state = { user: 'test', token: '123' };
      const result = injector.cycle(state, 'MMKV_STATE');
      expect(result).not.toEqual(state);
      expect(Object.keys(result).length).toBe(2);
      expect(Object.values(result)).toContain(undefined);

      const log = immuneResponse.getLog();
      expect(log.length).toBe(1);
      expect(log[0].target).toBe('MMKV_STATE');
      // Since data is an object, not null, and not _corrupted, autoFix returns false because one of the values is undefined?
      // Actually, autoFix only checks if data !== null && typeof data === 'object' && !data._corrupted.
      // Result is an object.
      expect(log[0].healed).toBe(true);
    });

    test('should corrupt empty MMKV state to _corrupted flag', () => {
      const state = {};
      const result = injector.cycle(state, 'MMKV_STATE');
      expect(result).toEqual({ _corrupted: true });

      const log = immuneResponse.getLog();
      expect(log[0].healed).toBe(false); // Because data._corrupted is true
    });

    test('should corrupt non-object MMKV state to null', () => {
      const result = injector.cycle('string_state', 'MMKV_STATE');
      expect(result).toBeNull();

      const log = immuneResponse.getLog();
      expect(log[0].healed).toBe(false); // Because data is null
    });

    test('should corrupt null MMKV state to null', () => {
      const result = injector.cycle(null, 'MMKV_STATE');
      expect(result).toBeNull();

      const log = immuneResponse.getLog();
      expect(log[0].healed).toBe(false); // Because data is null
    });
  });

  describe('CorruptionTarget: SYNC_PACKET', () => {
    test('should drop SYNC_PACKET completely (return null)', () => {
      const packet = { id: 1, payload: 'data' };
      const result = injector.cycle(packet, 'SYNC_PACKET');
      expect(result).toBeNull();

      const log = immuneResponse.getLog();
      expect(log.length).toBe(1);
      expect(log[0].target).toBe('SYNC_PACKET');
      expect(log[0].healed).toBe(true); // Since it expects null for autoFix
    });
  });

  describe('CorruptionTarget: PROPS', () => {
    test('should inject malformed PROPS to object', () => {
      const props = { name: 'component', nested: { value: 1 } };
      const result = injector.cycle(props, 'PROPS');
      expect(result).toHaveProperty('injectedProp');
      expect(Number.isNaN(result.injectedProp)).toBe(true);
      expect(result.nested).toEqual({ value: 1, dropped: true });

      const log = immuneResponse.getLog();
      expect(log.length).toBe(1);
      expect(log[0].target).toBe('PROPS');
      expect(log[0].healed).toBe(true); // data !== null and typeof object and !data.malformed
    });

    test('should inject malformed PROPS to empty/null', () => {
      const result = injector.cycle(null, 'PROPS');
      expect(result).toEqual({ malformed: true });

      const log = immuneResponse.getLog();
      expect(log[0].healed).toBe(false); // data.malformed is true
    });

    test('should inject malformed PROPS to non-object (primitive)', () => {
      const result = injector.cycle('string', 'PROPS');
      expect(result).toBeUndefined();

      const log = immuneResponse.getLog();
      expect(log[0].healed).toBe(false); // not object
    });
  });

  describe('Random Target Selection', () => {
    test('should pick random target when none specified (MMKV_STATE)', () => {
      // First random for frequency check (< 1), second random for target (0 * 3 = 0 -> MMKV_STATE)
      jest
        .spyOn(Math, 'random')
        .mockReturnValueOnce(0.5) // Frequency check passes
        .mockReturnValueOnce(0.1); // Floor(0.1 * 3) = 0 -> MMKV_STATE

      const result = injector.cycle({ key: 'value' });
      const log = immuneResponse.getLog();
      expect(log.length).toBe(1);
      expect(log[0].target).toBe('MMKV_STATE');
    });

    test('should pick random target when none specified (SYNC_PACKET)', () => {
      jest
        .spyOn(Math, 'random')
        .mockReturnValueOnce(0.5) // Frequency check passes
        .mockReturnValueOnce(0.5); // Floor(0.5 * 3) = 1 -> SYNC_PACKET

      const result = injector.cycle({ key: 'value' });
      const log = immuneResponse.getLog();
      expect(log.length).toBe(1);
      expect(log[0].target).toBe('SYNC_PACKET');
    });

    test('should pick random target when none specified (PROPS)', () => {
      jest
        .spyOn(Math, 'random')
        .mockReturnValueOnce(0.5) // Frequency check passes
        .mockReturnValueOnce(0.9); // Floor(0.9 * 3) = 2 -> PROPS

      const result = injector.cycle({ key: 'value' });
      const log = immuneResponse.getLog();
      expect(log.length).toBe(1);
      expect(log[0].target).toBe('PROPS');
    });
  });

  describe('ImmuneResponse Log Management', () => {
    test('should retrieve and clear log properly', () => {
      injector.cycle({ key: 'value' }, 'MMKV_STATE');
      expect(immuneResponse.getLog().length).toBe(1);

      // Should be a copy
      const logCopy = immuneResponse.getLog();
      logCopy.push({} as any);
      expect(immuneResponse.getLog().length).toBe(1);

      immuneResponse.clearLog();
      expect(immuneResponse.getLog().length).toBe(0);
    });

    test('immune response fallback for unknown target', () => {
      // Bypass type safety to test default branch in ImmuneResponse
      const immune = new ImmuneResponse();
      immune.trigger('UNKNOWN' as any, {});
      const log = immune.getLog();
      expect(log[0].healed).toBe(false);
    });
  });
});
