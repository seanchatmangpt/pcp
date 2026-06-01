import { StateGetter, InvariantChecker, StateVariance } from './types';

export class StateMonitor {
  private interval: NodeJS.Timeout | null = null;

  constructor(
    private getState: StateGetter,
    private checkInvariants: InvariantChecker,
    private intervalMs: number = 5000
  ) {}

  public start(onVarianceDetected: (variances: StateVariance[]) => void) {
    if (this.interval) return;

    this.interval = setInterval(() => {
      const state = this.getState();
      const variances = this.checkInvariants(state);
      if (variances.length > 0) {
        onVarianceDetected(variances);
      }
    }, this.intervalMs);
  }

  public stop() {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
  }

  public forceCheck(): StateVariance[] {
    return this.checkInvariants(this.getState());
  }
}
