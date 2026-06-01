import { VkgHook, HookMode } from './types.js';
import { SupervisorHook, PropagationMetrics } from '../supervisors/index.js';
import { OutboxManager } from '../sync/outbox.js';

export interface GraphDelta {
  id: string;
  subject: string;
  predicate: string;
  object: string;
  timestamp: number;
}

export class VkgHookEngine {
  private hooks: VkgHook[] = [];
  private supervisors: SupervisorHook[] = [];
  private outbox: OutboxManager;

  // Metrics for supervisor tracking
  private windowStartTime = Date.now();
  private windowActivationCount = 0;
  private currentFanout = 0;
  private currentDepth = 0;

  constructor(outbox: OutboxManager) {
    this.outbox = outbox;
  }

  registerHook(hook: VkgHook) {
    this.hooks.push(hook);
  }

  registerSupervisor(supervisor: SupervisorHook) {
    this.supervisors.push(supervisor);
  }

  /**
   * Evaluates a high-volume stream of GraphDeltas.
   * Optimizes for synchronous conditional matching to prevent Node loop blocking.
   */
  processDelta(delta: GraphDelta) {
    this.trackMetrics();

    const metrics = this.getMetrics();
    let isSuppressed = false;
    let isBatched = false;

    // 1. Evaluate Supervisors first (fast path rejection)
    for (const sup of this.supervisors) {
      const decision = sup.evaluateMetrics(metrics);
      if (decision === 'suppress' || decision === 'quarantine' || decision === 'throttle') {
        isSuppressed = true;
        break; // Stop evaluating further hooks
      }
      if (decision === 'batch') {
        isBatched = true;
      }
    }

    if (isSuppressed) {
      return; // Delta dropped due to supervisor intervention
    }

    // 2. Evaluate Hooks
    for (const hook of this.hooks) {
      // Very naive pattern matcher for speed
      if (hook.condition.kind === 'pattern' && hook.condition.pattern === delta.predicate) {
        
        if (hook.mode === 'block') {
          return; // Block effect overrides
        }

        if (isBatched) {
          // Send to outbox with a delayed flush
          this.outbox.enqueue(delta, hook, true);
        } else {
          // Immediately queue to outbox
          this.outbox.enqueue(delta, hook, false);
        }
        
        // Increase fanout for subsequent hook cycles
        this.currentFanout++;
      }
    }
  }

  private trackMetrics() {
    const now = Date.now();
    this.windowActivationCount++;

    // Reset window every 1000ms
    if (now - this.windowStartTime > 1000) {
      this.windowActivationCount = 1;
      this.currentFanout = 0;
      this.windowStartTime = now;
    }
  }

  getMetrics(): PropagationMetrics {
    // Determine activations per minute based on current 1-second window
    const rate = this.windowActivationCount * 60;
    
    return {
      activationRate: rate,
      fanout: this.currentFanout,
      cascadeDepth: this.currentDepth,
      oscillationScore: 0 // Mocked for now
    };
  }

  reset() {
    this.hooks = [];
    this.supervisors = [];
    this.windowActivationCount = 0;
    this.currentFanout = 0;
  }
}
