// @ts-nocheck
import { TokenReplayEngine, Transition } from '../petri-net';
import { Ocel2Log } from '../ocel';
import { ProcessDriftDetector } from '../drift';

describe('Pcp 2030 Process Mining Framework Tests', () => {
  const engine = new TokenReplayEngine();

  describe('Petri Net Token Replay Conformance Checking', () => {
    it('should pass cleanly for a standard successful command execution trace', () => {
      const trace: Transition[] = ['enqueue', 'verifyZkp', 'signEnclave', 'signPq', 'bindReceipt'];
      const result = engine.replayTrace(trace);
      expect(result.isConforming).toBe(true);
      expect(result.fitness).toBe(1.0);
      expect(result.missing).toBe(0);
      expect(result.remaining).toBe(0);
      expect(result.logs.some((log) => log.includes('Conformance check finished'))).toBe(true);
    });

    it('should pass cleanly for a state inspection bypass trace', () => {
      // In the petri net, we can define a custom final marking to represent early termination/bypass
      const trace: Transition[] = ['enqueue', 'verifyZkp'];
      const result = engine.replayTrace(
        trace,
        { Queue: 0, Verifying: 0, Attesting: 0, Signing: 0, Receipts: 0, Verified: 0 },
        { Queue: 0, Verifying: 1, Attesting: 1, Signing: 0, Receipts: 0, Verified: 0 }
      );
      expect(result.isConforming).toBe(true);
      expect(result.fitness).toBe(1.0);
      expect(result.missing).toBe(0);
      expect(result.remaining).toBe(0);
    });

    it('should detect deviations and calculate low fitness when ZKP check is skipped', () => {
      const trace: Transition[] = [
        'enqueue',
        // 'verifyZkp' is skipped!
        'signEnclave',
        'signPq',
        'bindReceipt',
      ];
      const result = engine.replayTrace(trace);
      expect(result.isConforming).toBe(false);
      expect(result.fitness).toBeLessThan(1.0);
      expect(result.missing).toBeGreaterThan(0);
      expect(
        result.logs.some((log) =>
          log.includes("Place 'Verifying' missing 1 token(s) to fire 'signEnclave'")
        )
      ).toBe(true);
    });

    it('should detect deviations when steps are executed out of order', () => {
      // Execute signEnclave before verifyZkp
      const trace: Transition[] = [
        'enqueue',
        'signEnclave', // Out of order!
        'verifyZkp',
        'signPq',
        'bindReceipt',
      ];
      const result = engine.replayTrace(trace);
      expect(result.isConforming).toBe(false);
      expect(result.fitness).toBeLessThan(1.0);
      expect(result.missing).toBeGreaterThan(0);
    });

    it('should audit partial traces ending in Queue when expecting Queue final marking', () => {
      const trace: Transition[] = ['enqueue'];
      const result = engine.replayTrace(
        trace,
        { Queue: 0, Verifying: 0, Attesting: 0, Signing: 0, Receipts: 0, Verified: 0 },
        { Queue: 1, Verifying: 0, Attesting: 0, Signing: 0, Receipts: 0, Verified: 0 }
      );
      expect(result.isConforming).toBe(true);
      expect(result.fitness).toBe(1.0);
      expect(result.missing).toBe(0);
    });
  });

  describe('OCEL 2.0 Compliance', () => {
    it('should emit and parse OCEL 2.0 compliant event logs', () => {
      const log = new Ocel2Log();

      // Register event types and object types
      log.registerEventType('receive', [
        { name: 'action', type: 'string' },
        { name: 'channel', type: 'string' },
      ]);
      log.registerObjectType('command', [
        { name: 'commandId', type: 'string' },
        { name: 'agentId', type: 'string' },
      ]);

      // Add objects and events
      log.addObject('c_101', 'command', [
        { name: 'commandId', value: 'cmd-999' },
        { name: 'agentId', value: 'agent-alpha' },
      ]);

      log.addEvent(
        'e_201',
        'receive',
        '2026-06-01T02:00:00Z',
        [{ objectId: 'c_101', qualifier: 'command' }],
        [
          { name: 'action', value: 'update_state' },
          { name: 'channel', value: 'secure_membrane' },
        ]
      );

      const jsonStr = log.serialize();
      const parsedLog = Ocel2Log.parse(jsonStr);
      const parsedData = parsedLog.getData();

      // Verify structure is preserved
      expect(parsedData.eventTypes.receive.attributes).toHaveLength(2);
      expect(parsedData.objectTypes.command.attributes).toHaveLength(2);
      expect(parsedData.objects['c_101'].type).toBe('command');
      expect(parsedData.events['e_201'].type).toBe('receive');
      expect(parsedData.events['e_201'].relationships[0].objectId).toBe('c_101');
      expect(parsedData.events['e_201'].relationships[0].qualifier).toBe('command');
    });
  });

  describe('Process Drift Detection', () => {
    const normalTrace = ['enqueue', 'verifyZkp', 'signEnclave', 'signPq', 'bindReceipt'];

    const anomalousTrace = [
      'enqueue',
      'signEnclave', // Skip ZKP!
      'signPq',
      'bindReceipt',
    ];

    it('should detect no drift when comparing stable identical windows', () => {
      const window1 = Array(10).fill(normalTrace);
      const window2 = Array(10).fill(normalTrace);

      const dfrResult = ProcessDriftDetector.detectDfrDrift(window1, window2, 0.2);
      expect(dfrResult.driftDetected).toBe(false);
      expect(dfrResult.distance).toBe(0);

      const fitnessResult = ProcessDriftDetector.detectFitnessDrift(window1, window2, engine, 0.1);
      expect(fitnessResult.driftDetected).toBe(false);
      expect(fitnessResult.fitnessDiff).toBe(0);
    });

    it('should detect DFR and Fitness drift when anomalies are injected', () => {
      const window1 = Array(15).fill(normalTrace);
      // Window 2 has a high proportion of anomalous traces
      const window2 = [...Array(5).fill(normalTrace), ...Array(10).fill(anomalousTrace)];

      const dfrResult = ProcessDriftDetector.detectDfrDrift(window1, window2, 0.15);
      expect(dfrResult.driftDetected).toBe(true);
      expect(dfrResult.distance).toBeGreaterThan(0.15);

      const fitnessResult = ProcessDriftDetector.detectFitnessDrift(window1, window2, engine, 0.05);
      expect(fitnessResult.driftDetected).toBe(true);
      expect(fitnessResult.fitnessDiff).toBeGreaterThan(0.05);
    });
  });

  describe('Fuzz Testing Log Streams', () => {
    /**
     * Helper to generate a fuzzed stream of event traces.
     * @param count Number of traces to generate.
     * @param anomalyRate Probability (0.0 to 1.0) of injecting anomalies into a trace.
     */
    function generateFuzzedTraces(count: number, anomalyRate: number): Transition[][] {
      const traces: Transition[][] = [];
      const normalSteps = ['enqueue', 'verifyZkp', 'signEnclave', 'signPq', 'bindReceipt'];

      for (let i = 0; i < count; i++) {
        if (Math.random() >= anomalyRate) {
          traces.push([...normalSteps]);
        } else {
          // Injected fuzz anomaly
          const trace = [...normalSteps];
          const roll = Math.random();

          if (roll < 0.25) {
            // Skip ZKP check
            trace.splice(1, 1);
          } else if (roll < 0.5) {
            // Out of order: swap verifyZkp and signPq
            const temp = trace[1];
            trace[1] = trace[3];
            trace[3] = temp;
          } else if (roll < 0.75) {
            // Insert foreign transition
            trace.splice(2, 0, 't_unauthorized_bypass');
          } else {
            // Truncated trace
            trace.splice(3);
          }
          traces.push(trace);
        }
      }
      return traces;
    }

    it('should correctly flag conformance for fuzzed traces', () => {
      // Generate 50 clean and 50 anomalous traces
      const cleanTraces = generateFuzzedTraces(50, 0);
      const fuzzedTraces = generateFuzzedTraces(50, 1.0); // 100% anomaly injection

      // Verify that all clean traces conform
      for (const trace of cleanTraces) {
        const result = engine.replayTrace(trace as any);
        expect(result.isConforming).toBe(true);
        expect(result.fitness).toBe(1.0);
      }

      // Verify that anomalous traces have deviations
      for (const trace of fuzzedTraces) {
        const result = engine.replayTrace(trace as any);
        expect(result.isConforming).toBe(false);
        expect(result.fitness).toBeLessThan(1.0);
        expect(result.missing + result.remaining).toBeGreaterThan(0);
      }
    });

    it('should detect drifts when comparing a fuzzed anomalous log stream against a clean stream', () => {
      const cleanStream = generateFuzzedTraces(40, 0.0);
      const highlyFuzzedStream = generateFuzzedTraces(40, 0.8);

      const dfrDrift = ProcessDriftDetector.detectDfrDrift(cleanStream, highlyFuzzedStream, 0.2);
      expect(dfrDrift.driftDetected).toBe(true);
      expect(dfrDrift.distance).toBeGreaterThan(0.2);

      const fitnessDrift = ProcessDriftDetector.detectFitnessDrift(
        cleanStream,
        highlyFuzzedStream,
        engine,
        0.1
      );
      expect(fitnessDrift.driftDetected).toBe(true);
      expect(fitnessDrift.fitnessDiff).toBeGreaterThan(0.1);
    });
  });

  describe('Absolute Markdown Links in System Logs', () => {
    it('should ensure all logs emitted contain absolute markdown links to the documentation', () => {
      const trace: Transition[] = ['enqueue', 'bindReceipt']; // Non-conforming
      const replayResult = engine.replayTrace(trace);

      expect(replayResult.logs.length).toBeGreaterThan(0);
      for (const log of replayResult.logs) {
        expect(log).toContain(
          '[petri-net.ts](file:///Users/sac/pcpapp/src/framework/2030/process-mining/petri-net.ts)'
        );
      }

      const w1 = [['enqueue', 'bindReceipt']];
      const w2 = [['enqueue', 'verifyZkp']];
      const driftResult = ProcessDriftDetector.detectDfrDrift(w1, w2, 0.1);

      expect(driftResult.logs.length).toBeGreaterThan(0);
      for (const log of driftResult.logs) {
        expect(log).toContain(
          '[process-mining.md](file:///Users/sac/pcpapp/docs/vision2030/framework/process-mining.md)'
        );
      }
    });
  });
});
