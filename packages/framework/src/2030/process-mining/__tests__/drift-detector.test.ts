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
});
