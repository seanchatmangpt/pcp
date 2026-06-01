import { StateMonitor } from './StateMonitor';
import { TestGenerator } from './TestGenerator';
import { TestRunner } from './TestRunner';
import {
  AutonomousConfig,
  StateGetter,
  StateSetter,
  InvariantChecker,
  StateVariance,
  TestResult,
} from './types';

export class AutonomousRepairAgent {
  private monitor: StateMonitor;
  private generator: TestGenerator;
  private runner: TestRunner;

  constructor(
    private getState: StateGetter,
    private setState: StateSetter,
    private checkInvariants: InvariantChecker,
    private config: AutonomousConfig = { monitorIntervalMs: 5000, autoRepair: true }
  ) {
    this.monitor = new StateMonitor(getState, checkInvariants, config.monitorIntervalMs);
    this.generator = new TestGenerator();
    this.runner = new TestRunner();
  }

  public start() {
    this.monitor.start(async (variances) => {
      for (const variance of variances) {
        if (this.config.onVarianceDetected) {
          this.config.onVarianceDetected(variance);
        }

        if (this.config.autoRepair) {
          await this.repair(variance);
        }
      }
    });
  }

  public stop() {
    this.monitor.stop();
  }

  public async repair(variance: StateVariance): Promise<TestResult> {
    const test = this.generator.generateTest(variance);

    // Attempt repair: simply set the state to expected for now
    // In 2030 innovation, this could be a complex action sequence
    const currentState = this.getState();
    const newState = { ...currentState, [variance.key]: variance.expected };
    this.setState(newState);

    // Verify repair with the generated test
    const result = await this.runner.runTest(test.name, () => {
      const updatedState = this.getState();
      return test.assertion(updatedState[variance.key]);
    });

    if (this.config.onRepairCompleted) {
      this.config.onRepairCompleted(result);
    }

    return result;
  }
}
