import {
  AgentNativePetriNet,
  ConformanceChecker,
  OcelFuzzer,
  runBenchmark,
  Ocel2Log,
} from '../profiler';

describe('[profiler.test.ts](file:///Users/sac/pcpapp/src/framework/2030/process-mining/__tests__/profiler.test.ts)', () => {
  let checker: ConformanceChecker;

  beforeEach(() => {
    checker = new ConformanceChecker(AgentNativePetriNet);
  });

  describe('Petri Net Structure & Conformance Replay', () => {
    it('should pass conforming traces with fitness 1.0', () => {
      const baseTime = Date.now();

      // 1. Success case
      const successEvents = OcelFuzzer.generateConformingTrace('req-success', 'success', baseTime);
      const successTrace = successEvents.map((e) => e.type);
      const resultSuccess = checker.replayTrace(successTrace, 'p_completed');
      expect(resultSuccess.isConforming).toBe(true);
      expect(resultSuccess.fitness).toBe(1.0);
      expect(resultSuccess.missingTokens).toBe(0);
      expect(resultSuccess.remainingTokens).toBe(0);

      // 2. Denied case
      const deniedEvents = OcelFuzzer.generateConformingTrace('req-denied', 'denied', baseTime);
      const deniedTrace = deniedEvents.map((e) => e.type);
      const resultDenied = checker.replayTrace(deniedTrace, 'p_denied');
      expect(resultDenied.isConforming).toBe(true);
      expect(resultDenied.fitness).toBe(1.0);
      expect(resultDenied.missingTokens).toBe(0);
      expect(resultDenied.remainingTokens).toBe(0);

      // 3. Skipped ZKP case
      const skippedEvents = OcelFuzzer.generateConformingTrace(
        'req-skipped',
        'skipped_zkp',
        baseTime
      );
      const skippedTrace = skippedEvents.map((e) => e.type);
      const resultSkipped = checker.replayTrace(skippedTrace, 'p_completed');
      expect(resultSkipped.isConforming).toBe(true);
      expect(resultSkipped.fitness).toBe(1.0);
      expect(resultSkipped.missingTokens).toBe(0);
      expect(resultSkipped.remainingTokens).toBe(0);
    });

    it('should fail and detect deviations when steps are skipped', () => {
      const baseTime = Date.now();
      const successEvents = OcelFuzzer.generateConformingTrace(
        'req-fuzz-skip',
        'success',
        baseTime
      );

      // Manually skip verify_pass -> trace becomes receive -> execute -> complete
      const skippedEvents = successEvents.filter((e) => e.type !== 't_verify_pass');
      const trace = skippedEvents.map((e) => e.type);

      const result = checker.replayTrace(trace, 'p_completed');
      expect(result.isConforming).toBe(false);
      expect(result.fitness).toBeLessThan(1.0);
      expect(result.missingTokens).toBeGreaterThan(0);
    });

    it('should fail and detect deviations when step order is swapped', () => {
      const baseTime = Date.now();
      const successEvents = OcelFuzzer.generateConformingTrace(
        'req-fuzz-swap',
        'success',
        baseTime
      );

      // Swap verify_pass and execute
      const swappedEvents = OcelFuzzer.injectDeviation(successEvents, 'swap_order');
      const trace = swappedEvents.map((e) => e.type);

      const result = checker.replayTrace(trace, 'p_completed');
      expect(result.isConforming).toBe(false);
      expect(result.fitness).toBeLessThan(1.0);
    });
  });
});
