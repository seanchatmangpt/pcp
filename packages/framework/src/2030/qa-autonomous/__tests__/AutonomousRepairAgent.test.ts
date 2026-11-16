import { AutonomousRepairAgent } from '../AutonomousRepairAgent';
import { StateMonitor } from '../StateMonitor';
import { TestGenerator } from '../TestGenerator';
import { TestRunner } from '../TestRunner';
import { StateVariance } from '../types';

describe('Autonomous Testing & Repair', () => {
  let state: Record<string, any> = { count: 0, status: 'ok' };
  const getState = () => state;
  const setState = (s: Record<string, any>) => {
    state = s;
  };

  const checkInvariants = (s: Record<string, any>): StateVariance[] => {
    const variances: StateVariance[] = [];
    if (s.count < 0) {
      variances.push({
        key: 'count',
        expected: 0,
        actual: s.count,
        timestamp: Date.now(),
        severity: 'high',
      });
    }
    if (s.status !== 'ok' && s.status !== 'maintenance') {
      variances.push({
        key: 'status',
        expected: 'ok',
        actual: s.status,
        timestamp: Date.now(),
        severity: 'medium',
      });
    }
    return variances;
  };

  describe('StateMonitor', () => {
    it('should detect variances', () => {
      state = { count: -1, status: 'broken' };
      const monitor = new StateMonitor(getState, checkInvariants);
      const variances = monitor.forceCheck();
      expect(variances).toHaveLength(2);
      expect(variances[0].key).toBe('count');
      expect(variances[1].key).toBe('status');
    });

    it('should start and stop interval', (done) => {
      state = { count: 0, status: 'ok' };
      const monitor = new StateMonitor(getState, checkInvariants, 10);
      let detected = false;
      monitor.start((variances) => {
        if (variances.length > 0) {
          detected = true;
          monitor.stop();
          expect(detected).toBe(true);
          done();
        }
      });
      state.count = -5; // Trigger variance
    });

    it('should not start multiple intervals', () => {
      const monitor = new StateMonitor(getState, checkInvariants);
      const setIntervalSpy = jest.spyOn(global, 'setInterval');
      monitor.start(() => {});
      monitor.start(() => {});
      expect(setIntervalSpy).toHaveBeenCalledTimes(1);
      monitor.stop();
      setIntervalSpy.mockRestore();
    });
  });
});
