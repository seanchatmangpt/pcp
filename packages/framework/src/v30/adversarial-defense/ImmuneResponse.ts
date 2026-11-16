import { CorruptionTarget } from './ChaosInjector';

export interface HealingAction {
  target: CorruptionTarget;
  timestamp: number;
  corruptedData: any;
  healed: boolean;
}

export class ImmuneResponse {
  private log: HealingAction[] = [];

  public trigger(target: CorruptionTarget, corruptedData: any): void {
    const action: HealingAction = {
      target,
      timestamp: Date.now(),
      corruptedData,
      healed: this.autoFix(target, corruptedData),
    };
    this.log.push(action);
  }

  private autoFix(target: CorruptionTarget, data: any): boolean {
    // Core SelfHealing membrane rules
    switch (target) {
      case 'MMKV_STATE':
        return data !== null && typeof data === 'object' && !data._corrupted;
      case 'SYNC_PACKET':
        return data === null; // Handled by requesting a re-sync
      case 'PROPS':
        return typeof data === 'object' && data !== null && !data.malformed;
      default:
        return false;
    }
  }

  public getLog(): HealingAction[] {
    return [...this.log];
  }

  public clearLog(): void {
    this.log = [];
  }
}
