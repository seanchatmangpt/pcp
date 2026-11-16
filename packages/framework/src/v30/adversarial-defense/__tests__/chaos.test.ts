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
  });
});
