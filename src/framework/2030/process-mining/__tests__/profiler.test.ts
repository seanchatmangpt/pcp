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

    it('should fail and detect deviations on duplicate execution steps', () => {
      const baseTime = Date.now();
      const successEvents = OcelFuzzer.generateConformingTrace('req-fuzz-dup', 'success', baseTime);

      // Duplicate t_execute
      const dupEvents = successEvents.flatMap((e) => {
        if (e.type === 't_execute') {
          return [
            e,
            {
              ...e,
              id: `${e.id}-dup`,
              time: new Date(new Date(e.time).getTime() + 1).toISOString(),
            },
          ];
        }
        return [e];
      });
      const trace = dupEvents.map((e) => e.type);

      const result = checker.replayTrace(trace, 'p_completed');
      expect(result.isConforming).toBe(false);
      expect(result.fitness).toBeLessThan(1.0);
    });

    it('should fail and detect deviations when invalid step types are injected', () => {
      const baseTime = Date.now();
      const successEvents = OcelFuzzer.generateConformingTrace(
        'req-fuzz-invalid',
        'success',
        baseTime
      );

      const invalidEvents = OcelFuzzer.injectDeviation(successEvents, 'invalid_step');
      const trace = invalidEvents.map((e) => e.type);

      const result = checker.replayTrace(trace, 'p_completed');
      expect(result.isConforming).toBe(false);
      expect(result.fitness).toBeLessThan(1.0);
      expect(result.missingTransitions.length).toBeGreaterThan(0);
    });
  });

  describe('OCEL 2.0 Log Processing & Multi-object Replay', () => {
    it('should correctly parse and analyze an OCEL 2.0 event log', () => {
      const baseTime = Date.now();

      const ocelLog: Ocel2Log = {
        eventTypes: {
          t_receive: { parameters: {} },
          t_verify_pass: { parameters: {} },
          t_verify_fail: { parameters: {} },
          t_skip_zkp: { parameters: {} },
          t_execute: { parameters: {} },
          t_complete: { parameters: {} },
        },
        objectTypes: {
          AgentRequest: { attributes: {} },
        },
        objects: [
          { id: 'req-1', type: 'AgentRequest' },
          { id: 'req-2', type: 'AgentRequest' },
        ],
        events: [
          // req-1 is conforming
          {
            id: 'e1',
            type: 't_receive',
            time: new Date(baseTime).toISOString(),
            objects: ['req-1'],
          },
          {
            id: 'e2',
            type: 't_verify_pass',
            time: new Date(baseTime + 10).toISOString(),
            objects: ['req-1'],
          },
          {
            id: 'e3',
            type: 't_execute',
            time: new Date(baseTime + 20).toISOString(),
            objects: ['req-1'],
          },
          {
            id: 'e4',
            type: 't_complete',
            time: new Date(baseTime + 30).toISOString(),
            objects: ['req-1'],
          },

          // req-2 is deviant (executes before verify)
          {
            id: 'e5',
            type: 't_receive',
            time: new Date(baseTime + 5).toISOString(),
            objects: ['req-2'],
          },
          {
            id: 'e6',
            type: 't_execute',
            time: new Date(baseTime + 15).toISOString(),
            objects: ['req-2'],
          },
          {
            id: 'e7',
            type: 't_verify_pass',
            time: new Date(baseTime + 25).toISOString(),
            objects: ['req-2'],
          },
          {
            id: 'e8',
            type: 't_complete',
            time: new Date(baseTime + 35).toISOString(),
            objects: ['req-2'],
          },
        ],
      };

      const results = checker.checkLogConformance(ocelLog);

      expect(results['req-1'].isConforming).toBe(true);
      expect(results['req-1'].fitness).toBe(1.0);

      expect(results['req-2'].isConforming).toBe(false);
      expect(results['req-2'].fitness).toBeLessThan(1.0);
    });
  });

  describe('Performance Profile Benchmark', () => {
    it('should complete conformance checking of 10,000 events in under 5ms per event', () => {
      const report = runBenchmark(10000);

      expect(report.totalEvents).toBeGreaterThanOrEqual(10000);
      expect(report.latencyPerEventMs).toBeLessThan(5.0);

      console.log(
        `Verified benchmark success: ${report.totalEvents} events checked with average latency of ${report.latencyPerEventMs.toFixed(5)} ms/event.`
      );
      console.log(
        `See benchmark source at [profiler.ts](file:///Users/sac/pcpapp/src/framework/2030/process-mining/profiler.ts)`
      );
    });
  });
});
