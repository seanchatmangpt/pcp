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
  });
});
