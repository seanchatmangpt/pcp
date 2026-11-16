import { Membrane } from '../membrane';
import { MembraneReceipt } from '../types';
import { SelfHealingConfig, HealingResult, SelfHealingState } from './types';
import { sha256 } from '@/src/lib/crypto/receipts';

/**
 * SelfHealingManager provides autonomous state recovery for the Pcp Membrane.
 * It monitors the integrity of the cryptographic receipt chain and detects deadlocks
 * in operation execution, automatically rolling back to the last known good state.
 */
export class SelfHealingManager {
  private membrane: Membrane;
  private target: any;
  private config: Required<SelfHealingConfig>;
  private snapshots: Map<string, string> = new Map(); // receiptHash -> serialized state
  private state: SelfHealingState = {
    isHealing: false,
    consecutiveFailures: 0,
  };
  private activeOperations = new Map<string, number>(); // traceId -> startTime
  private deadlockInterval?: ReturnType<typeof setInterval>;

  constructor(membrane: Membrane, target: any, config: SelfHealingConfig = {}) {
    this.membrane = membrane;
    this.target = target;
    this.config = {
      deadlockTimeoutMs: config.deadlockTimeoutMs ?? 5000,
      autoHeal: config.autoHeal ?? true,
      maxSnapshots: config.maxSnapshots ?? 50,
    };

    this.setupListeners();
    this.setupInterceptor();
  }

  /**
   * Initializes telemetry listeners and deadlock monitoring.
   */
  private setupListeners() {
    this.membrane.telemetry.register((event) => {
      if (this.state.isHealing) return;

      if (event.type === 'span_start') {
        if (event.traceId) {
          this.activeOperations.set(event.traceId, Date.now());
        }
      } else if (event.type === 'span_end') {
        if (event.traceId) {
          this.activeOperations.delete(event.traceId);
        }
      }
    });

    // Start deadlock monitor
    this.deadlockInterval = setInterval(() => this.checkDeadlocks(), 1000);
  }

  /**
   * Registers a membrane interceptor to detect corruption before execution.
   */
  private setupInterceptor() {
    this.membrane.interceptors.register(async () => {
      if (this.state.isHealing) return true;

      const validation = this.membrane.receipts.validateChain();
      if (!validation.valid) {
        this.membrane.audit.log('critical', 'State Corruption Detected', {
          error: validation.error,
        });
        if (this.config.autoHeal) {
          const result = await this.heal();
          if (result.recovered) {
            return true; // Proceed after healing
          }
        }
        return false; // Deny if corrupted and cannot heal
      }
      return true;
    });
  }

  /**
   * Checks for operations that have exceeded the deadlock timeout.
   */
  private checkDeadlocks() {
    const now = Date.now();
    for (const [traceId, startTime] of this.activeOperations.entries()) {
      if (now - startTime > this.config.deadlockTimeoutMs) {
        this.membrane.audit.log('critical', 'Deadlock Detected', {
          traceId,
          duration: now - startTime,
          timeout: this.config.deadlockTimeoutMs,
        });

        this.activeOperations.delete(traceId);

        if (this.config.autoHeal) {
          this.heal();
        }
      }
    }
  }

  /**
   * Attempts to autonomously heal the state by rolling back to the last known good receipt.
   */
  public async heal(): Promise<HealingResult> {
    if (this.state.isHealing) return { recovered: false, error: 'Healing already in progress' };

    this.state.isHealing = true;
    this.membrane.audit.log('info', 'Self-Healing Initiated', {});

    try {
      const history = this.membrane.receipts.getHistory();
      let lastGoodReceipt: MembraneReceipt | undefined;
      let lastGoodIndex = -1;

      // Search backwards for the most recent valid receipt that has a snapshot
      for (let i = history.length - 1; i >= 0; i--) {
        const subChain = history.slice(0, i + 1);
        if (this.isChainValid(subChain)) {
          const receipt = history[i];
          if (this.snapshots.has(receipt.deltaHash)) {
            lastGoodReceipt = receipt;
            lastGoodIndex = i;
            break;
          }
        }
      }

      if (lastGoodReceipt) {
        const snapshot = this.snapshots.get(lastGoodReceipt.deltaHash)!;
        this.restoreState(snapshot);

        // Reconstruct receipt chain up to the last good receipt
        this.membrane.receipts.clear();
        for (let i = 0; i <= lastGoodIndex; i++) {
          this.membrane.receipts.append(history[i]);
        }

        this.state.consecutiveFailures = 0;
        this.state.lastHealTimestamp = new Date().toISOString();

        this.membrane.audit.log('info', 'Self-Healing: State Restored', {
          receiptId: lastGoodReceipt.id,
          receiptHash: lastGoodReceipt.deltaHash,
        });

        return { recovered: true, lastGoodReceipt };
      } else {
        // Fallback: If no good receipt with snapshot is found, reset to initial empty state
        this.restoreState('{}');
        this.membrane.receipts.clear();

        this.membrane.audit.log('warn', 'Self-Healing: Hard Reset Performed', {});
        return { recovered: true };
      }
    } catch (err: any) {
      this.state.consecutiveFailures++;
      this.membrane.audit.log('critical', 'Self-Healing Critical Failure', { error: err.message });
      return { recovered: false, error: err.message };
    } finally {
      this.state.isHealing = false;
    }
  }

  /**
   * Validates a segment of the receipt chain.
   */
  private isChainValid(chain: MembraneReceipt[]): boolean {
    for (let i = 0; i < chain.length; i++) {
      const prevHash = i === 0 ? '' : chain[i - 1].deltaHash;
      if (chain[i].previousHash !== prevHash) return false;
      const expectedHash = sha256(prevHash + (chain[i].resultHash || ''));
      if (chain[i].deltaHash !== expectedHash) return false;
    }
    return true;
  }

  /**
   * Restores the target object's state from a serialized snapshot.
   */
  private restoreState(snapshot: string) {
    const data = JSON.parse(snapshot);

    // Clear all existing properties
    const keys = Object.keys(this.target);
    for (const key of keys) {
      delete this.target[key];
    }

    // Assign properties from snapshot
    Object.assign(this.target, data);
  }

  /**
   * Captures a snapshot of the current target state and associates it with a receipt hash.
   */
  public captureSnapshot(receiptHash: string) {
    if (this.state.isHealing) return;

    // Use a clean copy to avoid capturing proxy artifacts if target is already proxied
    // Note: Since we are in the membrane, we assume target is what we want to snapshot.
    const snapshot = JSON.stringify(this.target);
    this.snapshots.set(receiptHash, snapshot);

    // Maintain max snapshots limit (LRU-ish)
    if (this.snapshots.size > this.config.maxSnapshots) {
      const firstKey = this.snapshots.keys().next().value;
      if (firstKey) this.snapshots.delete(firstKey);
    }
  }

  /**
   * Cleans up resources.
   */
  public dispose() {
    if (this.deadlockInterval) {
      clearInterval(this.deadlockInterval);
    }
    this.snapshots.clear();
    this.activeOperations.clear();
  }

  /**
   * Returns current healing state.
   */
  public getState(): Readonly<SelfHealingState> {
    return { ...this.state };
  }
}
