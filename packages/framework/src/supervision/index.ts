import {
  SupervisionProcessConformanceEvaluator,
  ConformanceReport,
} from '@/src/lib/truex/supervision/supervision';
import { HookRuntime } from '@/src/lib/truex/hook-otp/runtime';
import {
  TensionQueueMapper,
  TensionQueueAuditResult,
  TensionQueueMappingResult,
} from '@/src/lib/truex/packs/packs';
import {
  HookMessage,
  SupervisorAction,
  HookActorRef,
  HookBehavior,
  HookSupervisor,
  HookState,
} from '@/src/lib/truex/hook-otp/types';
import { HookActorInstance } from '@/src/lib/truex/hook-otp/registry';

export { ConformanceReport, TensionQueueAuditResult, TensionQueueMappingResult };

/**
 * Advanced anomaly detection heuristics configuration to identify erratic actor behavior.
 */
export interface AnomalyDetectionHeuristics {
  /** Enables burst detection flag based on message volume over time. */
  enableBurstDetection?: boolean;
  /** Maximum allowed burst rate (messages per window) before being flagged. */
  maxBurstRate?: number;
  /** Heuristic threshold for detecting a message size anomaly (in bytes/chars approximation). */
  abnormalPayloadSize?: number;
}

/**
 * Automated retry policy for messages that encounter transient failures or temporary supervision blocks.
 */
export interface AutomatedRetryPolicy {
  /** Maximum number of retry attempts. */
  maxRetries: number;
  /** Base delay between retries in milliseconds. */
  baseDelayMs: number;
  /** Backoff multiplier for consecutive retries (e.g., 2 for exponential). */
  backoffMultiplier?: number;
}

/**
 * DX Hooks to provide custom resolution strategies or UI prompts for quarantined messages.
 */
export interface QuarantineResolutionHooks {
  /**
   * Invoked when a message is quarantined. Provides a DX hook for custom handling.
   * @param ref The target actor reference.
   * @param message The message that was quarantined.
   * @param reason The reason for quarantine.
   * @returns Resolves to true if the message should be un-quarantined and allowed, false otherwise.
   */
  onQuarantine?: (
    ref: HookActorRef,
    message: HookMessage,
    reason?: string
  ) => Promise<boolean> | boolean;

  /**
   * Invoked when an anomaly is detected based on heuristics.
   * @param ref The target actor reference.
   * @param message The message causing the anomaly.
   * @param heuristic The specific heuristic triggered.
   */
  onAnomalyDetected?: (ref: HookActorRef, message: HookMessage, heuristic: string) => void;
}

/**
 * Extended Autonomic configuration with DX improvements.
 */
export interface AutonomicConfig {
  supervision?: {
    maxFloodLimit?: number;
    floodWindowMs?: number;
    maxQueueLength?: number;
    maxOscillationDepth?: number;
    maxLoadFactor?: number;

    anomalyDetection?: AnomalyDetectionHeuristics;
    retryPolicy?: AutomatedRetryPolicy;
    quarantineHooks?: QuarantineResolutionHooks;
  };
}

export interface SendResult {
  success: boolean;
  action: SupervisorAction | 'allow' | 'anomaly_detected' | 'retry_failed';
  reason?: string;
}

export class AutonomicFramework {
  public readonly runtime: HookRuntime;
  public readonly conformance: SupervisionProcessConformanceEvaluator;
  public readonly queueMapper: TensionQueueMapper;
  private readonly config: AutonomicConfig;
  private burstTracker: Map<string, { count: number; timestamp: number }> = new Map();

  constructor(config: AutonomicConfig = {}) {
    this.config = config;
    this.runtime = new HookRuntime();

    const supConfig = config.supervision || {};
    this.conformance = new SupervisionProcessConformanceEvaluator(
      supConfig.maxFloodLimit,
      supConfig.floodWindowMs,
      supConfig.maxQueueLength,
      supConfig.maxOscillationDepth,
      supConfig.maxLoadFactor
    );

    this.queueMapper = new TensionQueueMapper();
  }

  /**
   * Spawns an actor via the embedded HookRuntime and optionally registers it
   * to ensure it's ready for lifecycle management and conformance checks.
   */
  public async spawnActor(
    ref: HookActorRef,
    behavior: HookBehavior,
    supervisor?: HookSupervisor,
    initialState?: HookState
  ): Promise<HookActorInstance> {
    return this.runtime.spawn(ref, behavior, supervisor, initialState);
  }

  /**
   * Evaluates a message for conformance, applying advanced anomaly detection heuristics,
   * automated retries, and quarantine DX hooks. This replaces the basic synchronous send.
   */
  public async sendAsync(
    ref: HookActorRef,
    msg: HookMessage,
    currentLoadFactor = 0.0
  ): Promise<SendResult> {
    const supConfig = this.config.supervision || {};
    const retryPolicy = supConfig.retryPolicy;

    let attempts = 0;
    const maxAttempts = retryPolicy ? retryPolicy.maxRetries + 1 : 1;
    let baseDelay = retryPolicy?.baseDelayMs || 0;
    const backoff = retryPolicy?.backoffMultiplier || 1;

    while (attempts < maxAttempts) {
      attempts++;
      const result = await this.evaluateAndDispatch(ref, msg, currentLoadFactor);

      if (result.success || result.action === 'anomaly_detected') {
        return result; // Allowed or anomaly handled (we treat anomaly as terminal if it wasn't un-quarantined)
      }

      // If quarantine or suppress, maybe we retry if there are attempts left
      if (
        attempts < maxAttempts &&
        (result.action === 'suppress' || result.action === 'quarantine')
      ) {
        await new Promise((resolve) => setTimeout(resolve, baseDelay));
        baseDelay *= backoff;
        continue;
      }

      if (attempts >= maxAttempts) {
        return {
          success: false,
          action: 'retry_failed',
          reason: `Max retries exceeded. Last reason: ${result.reason}`,
        };
      }

      return result;
    }

    return { success: false, action: 'retry_failed', reason: 'Max retries exceeded' };
  }

  /**
   * Evaluates a message for conformance, then either forwards it to the runtime
   * or intercepts it if it violates autonomy rules.
   * Backward compatible synchronous send, without async retry/hook benefits.
   */
  public send(ref: HookActorRef, msg: HookMessage, currentLoadFactor = 0.0): SendResult {
    const registry = this.runtime.getRegistry();
    const instance = registry.get(ref);

    if (instance) {
      // 1. Check Anomaly Heuristics
      const anomaly = this.detectAnomaly(ref, msg);
      if (anomaly) {
        this.config.supervision?.quarantineHooks?.onAnomalyDetected?.(ref, msg, anomaly);
        // We quarantine anomalies by default in synchronous mode
        return { success: false, action: 'quarantine', reason: `Anomaly detected: ${anomaly}` };
      }

      // 2. Evaluate standard conformance
      const evaluation = this.conformance.evaluateMessage(msg, instance, currentLoadFactor);

      if (evaluation.action === 'quarantine' || evaluation.action === 'suppress') {
        // No async hooks possible here, just return failure
        return { success: false, action: evaluation.action, reason: evaluation.reason };
      }
    }

    this.runtime.send(ref, msg);
    return { success: true, action: 'allow' };
  }

  /**
   * Internal async evaluation that supports DX hooks.
   */
  private async evaluateAndDispatch(
    ref: HookActorRef,
    msg: HookMessage,
    currentLoadFactor: number
  ): Promise<SendResult> {
    const registry = this.runtime.getRegistry();
    const instance = registry.get(ref);
    const hooks = this.config.supervision?.quarantineHooks;

    if (instance) {
      // 1. Check Anomaly Heuristics
      const anomaly = this.detectAnomaly(ref, msg);
      if (anomaly) {
        hooks?.onAnomalyDetected?.(ref, msg, anomaly);
        const allowOverride = await hooks?.onQuarantine?.(ref, msg, `Anomaly detected: ${anomaly}`);
        if (!allowOverride) {
          return { success: false, action: 'anomaly_detected', reason: anomaly };
        }
      }

      // 2. Standard conformance
      const evaluation = this.conformance.evaluateMessage(msg, instance, currentLoadFactor);

      if (evaluation.action === 'quarantine' || evaluation.action === 'suppress') {
        if (evaluation.action === 'quarantine' && hooks?.onQuarantine) {
          const allowOverride = await hooks.onQuarantine(ref, msg, evaluation.reason);
          if (allowOverride) {
            this.runtime.send(ref, msg);
            return { success: true, action: 'allow' };
          }
        }
        return { success: false, action: evaluation.action, reason: evaluation.reason };
      }
    }

    this.runtime.send(ref, msg);
    return { success: true, action: 'allow' };
  }

  /**
   * Runs advanced heuristics to detect erratic behaviors.
   */
  private detectAnomaly(ref: HookActorRef, msg: HookMessage): string | null {
    const anomalyConfig = this.config.supervision?.anomalyDetection;
    if (!anomalyConfig) return null;

    const key = `${ref.tenantId}:${ref.packId}:${ref.hookId}:${ref.instanceId}`;

    // Burst Detection
    if (anomalyConfig.enableBurstDetection && anomalyConfig.maxBurstRate) {
      const now = Date.now();
      const tracker = this.burstTracker.get(key) || { count: 0, timestamp: now };

      // Reset window every 1 second
      if (now - tracker.timestamp > 1000) {
        tracker.count = 1;
        tracker.timestamp = now;
      } else {
        tracker.count++;
      }
      this.burstTracker.set(key, tracker);

      if (tracker.count > anomalyConfig.maxBurstRate) {
        return 'burst_rate_exceeded';
      }
    }

    // Payload Size Detection
    if (anomalyConfig.abnormalPayloadSize && msg.payload) {
      const sizeEstimate = JSON.stringify(msg.payload).length;
      if (sizeEstimate > anomalyConfig.abnormalPayloadSize) {
        return 'abnormal_payload_size';
      }
    }

    return null;
  }

  /**
   * Audits a pack's tension queue for pending operational jobs.
   */
  public async auditPackTension(packName: string): Promise<TensionQueueAuditResult> {
    return this.queueMapper.auditTensionQueue(packName);
  }

  /**
   * Maps un-admitted tension queue items using provided ontological rules.
   */
  public async mapPackTensionQueue(
    packName: string,
    mappingRules: Record<string, string>
  ): Promise<TensionQueueMappingResult> {
    return this.queueMapper.mapTensionQueueState(packName, mappingRules);
  }

  /**
   * Evaluates offline trace conformance.
   */
  public evaluateTrace(declared: string[], actual: string[]): ConformanceReport {
    return this.conformance.evaluateTraceConformance(declared, actual);
  }
}
