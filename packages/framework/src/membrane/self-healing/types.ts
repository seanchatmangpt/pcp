import { MembraneReceipt } from '../types';

export interface SelfHealingConfig {
  /**
   * Maximum allowed duration for a membrane operation before it's considered a deadlock.
   * Default: 5000ms
   */
  deadlockTimeoutMs?: number;

  /**
   * Whether to automatically heal when corruption is detected.
   * Default: true
   */
  autoHeal?: boolean;

  /**
   * Maximum number of snapshots to keep.
   * Default: 50
   */
  maxSnapshots?: number;
}

export interface HealingResult {
  recovered: boolean;
  lastGoodReceipt?: MembraneReceipt;
  error?: string;
}

export interface SelfHealingState {
  isHealing: boolean;
  consecutiveFailures: number;
  lastHealTimestamp?: string;
}
