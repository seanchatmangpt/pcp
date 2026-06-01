/**
 * Conformance & Concept Drift Verification Suite
 * Verifies token-based replay, OCEL compliance, sliding-window drift detection.
 *
 * For architectural guidelines, see:
 * - Design Plan: [drift_detector_implementation_plan.md](file:///Users/sac/.gemini/antigravity-cli/brain/bc47b56b-8374-43ff-9417-73010490fc44/drift_detector_implementation_plan.md)
 * - Source under test: [drift-detector.ts](file:///Users/sac/pcpapp/src/framework/2030/process-mining/drift-detector.ts)
 * - Test suite: [drift-detector.test.ts](file:///Users/sac/pcpapp/src/framework/2030/process-mining/__tests__/drift-detector.test.ts)
 */

import {
  createAgentNativePetriNet,
  TokenReplayChecker,
  RunningStats,
  ConceptDriftDetector,
  OCEL2Log,
  OCEL2Event,
} from '../drift-detector';

describe('Dr. Wil van der Aalst AGI Doctrine: Conformance and Concept Drift', () => {
  describe('Petri Net & Token Replay Checker', () => {
    it('should compute fitness of 1.0 for a perfect normal trace', () => {
      const net = createAgentNativePetriNet();
      const checker = new TokenReplayChecker(net);
      const trace = [
        'register',
        'authenticate',
        'auth_success',
        'dispatch',
        'execute_success',
        'close',
        'teardown',
      ];
      const result = checker.replayTrace(trace);

      expect(result.fitness).toBe(1.0);
      expect(result.isConforming).toBe(true);
      expect(result.missing).toBe(0);
      expect(result.remaining).toBe(0);
    });

    it('should compute fitness of 1.0 for looping trace', () => {
      const net = createAgentNativePetriNet();
      const checker = new TokenReplayChecker(net);
      const trace = [
        'register',
        'authenticate',
        'auth_success',
        'dispatch',
        'execute_success',
        'close',
        'authenticate',
        'auth_success',
        'dispatch',
        'execute_success',
        'close',
        'teardown',
      ];
      const result = checker.replayTrace(trace);

      expect(result.fitness).toBe(1.0);
      expect(result.isConforming).toBe(true);
    });

    it('should penalize fitness for missing and remaining tokens (non-conforming trace)', () => {
      const net = createAgentNativePetriNet();
      const checker = new TokenReplayChecker(net);
      const trace = ['register', 'dispatch', 'teardown'];
      const result = checker.replayTrace(trace);

      expect(result.fitness).toBeLessThan(1.0);
      expect(result.isConforming).toBe(false);
      expect(result.missing).toBeGreaterThan(0);
      expect(result.remaining).toBeGreaterThan(0);
      expect(result.missingTokensDetail['p_authenticated']).toBe(1);
      expect(result.remainingTokensDetail['p_executing']).toBe(1);
    });
  });

  describe('RunningStats (Welford)', () => {
    it('should correctly track mean and standard deviation of values', () => {
      const stats = new RunningStats();
      const values = [2, 4, 4, 4, 5, 5, 7, 9];
      for (const val of values) {
        stats.update(val);
      }
      expect(stats.getMean()).toBe(5.0);
      expect(stats.getVariance()).toBeCloseTo(4.57);
      expect(stats.getStdDev()).toBeCloseTo(2.14);
      expect(stats.getCount()).toBe(8);
    });
  });

  describe('OCEL 2.0 Log Parsing & Replay Integration', () => {
    it('should extract traces by object and run token replay', () => {
      const ocelLog: OCEL2Log = {
        'ocel:objects': {
          agent_007: { 'ocel:type': 'agent', 'ocel:ovmap': { model: 'pcp-core-v3' } },
          agent_009: { 'ocel:type': 'agent', 'ocel:ovmap': { model: 'pcp-core-v3' } },
        },
        'ocel:events': {
          e1: {
            'ocel:activity': 'register',
            'ocel:timestamp': '2026-05-31T19:00:00Z',
            'ocel:omap': ['agent_007'],
            'ocel:vmap': {},
          },
          e2: {
            'ocel:activity': 'register',
            'ocel:timestamp': '2026-05-31T19:01:00Z',
            'ocel:omap': ['agent_009'],
            'ocel:vmap': {},
          },
          e3: {
            'ocel:activity': 'authenticate',
            'ocel:timestamp': '2026-05-31T19:02:00Z',
            'ocel:omap': ['agent_007'],
            'ocel:vmap': {},
          },
          e4: {
            'ocel:activity': 'auth_success',
            'ocel:timestamp': '2026-05-31T19:03:00Z',
            'ocel:omap': ['agent_007'],
            'ocel:vmap': {},
          },
          e5: {
            'ocel:activity': 'dispatch',
            'ocel:timestamp': '2026-05-31T19:04:00Z',
            'ocel:omap': ['agent_009'],
            'ocel:vmap': {},
          },
          e6: {
            'ocel:activity': 'teardown',
            'ocel:timestamp': '2026-05-31T19:05:00Z',
            'ocel:omap': ['agent_009'],
            'ocel:vmap': {},
          },
        },
      };

      const net = createAgentNativePetriNet();
      const checker = new TokenReplayChecker(net);
      const results = checker.replayOCELTraces(ocelLog, 'agent');

      const replay007 = results.get('agent_007');
      const replay009 = results.get('agent_009');

      expect(replay007).toBeDefined();
      expect(replay009).toBeDefined();
      expect(replay007!.fitness).toBeLessThan(1.0);
      expect(replay009!.isConforming).toBe(false);
    });
  });

  describe('Sliding-Window Concept Drift Detection', () => {
    it('should detect performance degradation using static threshold', () => {
      const detector = new ConceptDriftDetector({
        windowSize: 10,
        minEventsForDetection: 6,
        lambda: 0.5,
        staticPerformanceThreshold: 20,
      });

      const events: OCEL2Event[] = Array.from({ length: 6 }).map((_, i) => ({
        'ocel:activity': 'register',
        'ocel:timestamp': `2026-05-31T19:10:${i.toString().padStart(2, '0')}Z`,
        'ocel:omap': ['agent_1'],
        'ocel:vmap': { duration: 10 },
      }));

      let alerts: any[] = [];
      for (const e of events) {
        alerts.push(...detector.addEvent(e));
      }
      expect(alerts.length).toBe(0);

      const driftEvent: OCEL2Event = {
        'ocel:activity': 'register',
        'ocel:timestamp': '2026-05-31T19:11:00Z',
        'ocel:omap': ['agent_1'],
        'ocel:vmap': { duration: 200 },
      };

      const finalAlerts = detector.addEvent(driftEvent);
      expect(finalAlerts.some((a) => a.driftType === 'performance')).toBe(true);
    });

    it('should detect behavioral profile drift using Jaccard distance on DFRs', () => {
      const detector = new ConceptDriftDetector({
        windowSize: 20,
        minEventsForDetection: 10,
        lambda: 0.5,
        staticBehaviorThreshold: 0.2,
      });

      const baselineActivities = [
        'register',
        'authenticate',
        'auth_success',
        'dispatch',
        'execute_success',
      ];
      let timestampIndex = 0;

      const streamEvents = (activities: string[], repeats = 3, duration = 10) => {
        const list: OCEL2Event[] = [];
        for (let r = 0; r < repeats; r++) {
          const agentId = `agent_b_${r}`;
          for (const act of activities) {
            timestampIndex++;
            list.push({
              'ocel:activity': act,
              'ocel:timestamp': `2026-05-31T19:20:${timestampIndex.toString().padStart(2, '0')}Z`,
              'ocel:omap': [agentId],
              'ocel:vmap': { duration },
            });
          }
        }
        return list;
      };

      const refEvents = streamEvents(baselineActivities, 3);
      let alerts: any[] = [];
      for (const e of refEvents) {
        alerts.push(...detector.addEvent(e));
      }
      expect(alerts.filter((a) => a.driftType === 'behavioral').length).toBe(0);

      const abnormalActivities = ['dispatch', 'register', 'teardown', 'authenticate'];
      const anomalyEvents = streamEvents(abnormalActivities, 3);

      let behavioralDriftAlerted = false;
      for (const e of anomalyEvents) {
        const curAlerts = detector.addEvent(e);
        if (curAlerts.some((a) => a.driftType === 'behavioral')) {
          behavioralDriftAlerted = true;
          break;
        }
      }

      expect(behavioralDriftAlerted).toBe(true);
    });

    it('should detect conformance degradation (fitness drops) in the stream', () => {
      const detector = new ConceptDriftDetector({
        windowSize: 20,
        minEventsForDetection: 10,
        lambda: 0.6,
        staticConformanceThreshold: 0.2,
      });

      const conformingTrace = ['register', 'authenticate', 'auth_success', 'teardown'];
      let timestampIndex = 0;

      const generateEvents = (trace: string[], prefix = 'agent_c', count = 3) => {
        const list: OCEL2Event[] = [];
        for (let i = 0; i < count; i++) {
          const agentId = `${prefix}_${i}`;
          for (const act of trace) {
            timestampIndex++;
            list.push({
              'ocel:activity': act,
              'ocel:timestamp': `2026-05-31T19:30:${timestampIndex.toString().padStart(2, '0')}Z`,
              'ocel:omap': [agentId],
              'ocel:vmap': { duration: 5 },
            });
          }
        }
        return list;
      };

      const refEvents = generateEvents(conformingTrace, 'agent_conforming', 3);
      let alerts: any[] = [];
      for (const e of refEvents) {
        alerts.push(...detector.addEvent(e));
      }
      expect(alerts.filter((a) => a.driftType === 'conformance').length).toBe(0);

      const badTrace = ['dispatch', 'teardown'];
      const badEvents = generateEvents(badTrace, 'agent_bad', 3);

      let conformanceDriftAlerted = false;
      for (const e of badEvents) {
        const curAlerts = detector.addEvent(e);
        if (curAlerts.some((a) => a.driftType === 'conformance')) {
          conformanceDriftAlerted = true;
          break;
        }
      }

      expect(conformanceDriftAlerted).toBe(true);
    });

    it('should dynamically calculate UCL when no static threshold is provided', () => {
      const detector = new ConceptDriftDetector({
        windowSize: 20,
        minEventsForDetection: 10,
        lambda: 0.3,
        k: 1.0,
      });

      const trace = ['register', 'authenticate', 'auth_success', 'teardown'];
      let timestampIndex = 0;
      const list: OCEL2Event[] = [];
      for (let i = 0; i < 6; i++) {
        const agentId = `agent_d_${i}`;
        for (const act of trace) {
          timestampIndex++;
          list.push({
            'ocel:activity': act,
            'ocel:timestamp': `2026-05-31T19:40:${timestampIndex.toString().padStart(2, '0')}Z`,
            'ocel:omap': [agentId],
            'ocel:vmap': { duration: 10 },
          });
        }
      }

      let alerts: any[] = [];
      for (const e of list) {
        alerts.push(...detector.addEvent(e));
      }

      const anomalyTrace = ['dispatch', 'teardown'];
      const badList: OCEL2Event[] = [];
      for (let i = 0; i < 4; i++) {
        const agentId = `agent_bad_${i}`;
        for (const act of anomalyTrace) {
          timestampIndex++;
          badList.push({
            'ocel:activity': act,
            'ocel:timestamp': `2026-05-31T19:50:${timestampIndex.toString().padStart(2, '0')}Z`,
            'ocel:omap': [agentId],
            'ocel:vmap': { duration: 300 },
          });
        }
      }

      let driftAlerted = false;
      for (const e of badList) {
        const curAlerts = detector.addEvent(e);
        if (curAlerts.length > 0) {
          driftAlerted = true;
          break;
        }
      }

      expect(driftAlerted).toBe(true);
    });
  });
});
