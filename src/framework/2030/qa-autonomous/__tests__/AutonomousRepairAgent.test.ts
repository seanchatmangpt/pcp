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

  describe('TestGenerator', () => {
    it('should generate a valid test object', () => {
      const variance: StateVariance = {
        key: 'count',
        expected: 0,
        actual: -1,
        timestamp: Date.now(),
        severity: 'high',
      };
      const generator = new TestGenerator();
      const test = generator.generateTest(variance);
      expect(test.name).toContain('count');
      expect(test.assertion(0)).toBe(true);
      expect(test.assertion(-1)).toBe(false);
      expect(test.repro).toContain('Expected 0, but got -1');
    });
  });

  describe('TestRunner', () => {
    it('should run a passing test', async () => {
      const runner = new TestRunner();
      const result = await runner.runTest('Test Pass', () => true);
      expect(result.success).toBe(true);
      expect(result.logs).toContain('Test passed.');
    });

    it('should run a failing test', async () => {
      const runner = new TestRunner();
      const result = await runner.runTest('Test Fail', () => false);
      expect(result.success).toBe(false);
      expect(result.error).toBe('Assertion failed');
    });

    it('should handle test crashes', async () => {
      const runner = new TestRunner();
      const result = await runner.runTest('Test Crash', () => {
        throw new Error('Boom');
      });
      expect(result.success).toBe(false);
      expect(result.error).toBe('Boom');
      expect(result.logs.some((l) => l.includes('Test crashed'))).toBe(true);
    });
  });

  describe('AutonomousRepairAgent', () => {
    it('should coordinate repair', async () => {
      state = { count: -10, status: 'ok' };
      const onVariance = jest.fn();
      const onRepair = jest.fn();

      const agent = new AutonomousRepairAgent(getState, setState, checkInvariants, {
        monitorIntervalMs: 10,
        autoRepair: true,
        onVarianceDetected: onVariance,
        onRepairCompleted: onRepair,
      });

      const variance = checkInvariants(state)[0];
      const result = await agent.repair(variance);

      expect(result.success).toBe(true);
      expect(state.count).toBe(0);
      expect(onRepair).toHaveBeenCalledWith(result);
    });

    it('should handle repair without callbacks', async () => {
      state = { count: -10, status: 'ok' };
      const agent = new AutonomousRepairAgent(getState, setState, checkInvariants);
      const variance = checkInvariants(state)[0];
      const result = await agent.repair(variance);
      expect(result.success).toBe(true);
    });

    it('should run monitor and auto-repair', (done) => {
      state = { count: 0, status: 'ok' };
      const onVarianceDetected = jest.fn();
      const agent = new AutonomousRepairAgent(getState, setState, checkInvariants, {
        monitorIntervalMs: 10,
        autoRepair: true,
        onVarianceDetected,
        onRepairCompleted: (result) => {
          if (result.success) {
            expect(state.count).toBe(0);
            expect(onVarianceDetected).toHaveBeenCalled();
            agent.stop();
            done();
          }
        },
      });

      agent.start();
      state.count = -20; // Trigger auto-repair
    });

    it('should run monitor without auto-repair', (done) => {
      state = { count: 0, status: 'ok' };
      const agent = new AutonomousRepairAgent(getState, setState, checkInvariants, {
        monitorIntervalMs: 10,
        autoRepair: false,
        onVarianceDetected: (variance) => {
          expect(variance.key).toBe('count');
          agent.stop();
          done();
        },
      });

      agent.start();
      state.count = -20;
    });

    it('should cover branch where no variance is detected in monitor', (done) => {
      state = { count: 0, status: 'ok' };
      const agent = new AutonomousRepairAgent(getState, setState, checkInvariants, {
        monitorIntervalMs: 10,
        autoRepair: true,
      });
      agent.start();
      setTimeout(() => {
        agent.stop();
        done();
      }, 25);
    });

    it('should cover branch where onVarianceDetected is missing in start callback', (done) => {
      state = { count: 0, status: 'ok' };
      const agent = new AutonomousRepairAgent(getState, setState, checkInvariants, {
        monitorIntervalMs: 10,
        autoRepair: true,
        onRepairCompleted: () => {
          agent.stop();
          done();
        },
      });
      agent.start();
      state.count = -5;
    });
  });
});
