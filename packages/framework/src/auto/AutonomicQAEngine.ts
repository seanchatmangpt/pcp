// src/framework/auto/AutonomicQAEngine.ts
//
// Autonomous QA & Self-Healing Engine
//
// Implements the Receipted Chatman Equation: R ⊢ A = μ(O*)
// Every state transition observed on AppSwarmManager agents is validated against
// the admissible operational reality.  Violations trigger one of three repair
// strategies in priority order:
//
//   1. Rollback     — restore the most-recent BLAKE3-verified checkpoint
//   2. Re-hydration — reconstruct agent state from the frozen checkpoint store
//   3. Alert Escalation — emit a critical OTel span + structured QA violation log
//
// All significant state transitions are backed by a BLAKE3 receipt chain.

import { AppSwarmManager, AgentInfo, AgentStatus } from '../v30/autonomous-swarm/AppSwarmManager';
import { blake3, canonicalStringify } from '@/src/lib/crypto/receipts';
import { TelemetryManager } from '../membrane/managers/telemetry';

// ---------------------------------------------------------------------------
// Public type surface
// ---------------------------------------------------------------------------

/** Typed classification of a detected invariant violation. */
export type ViolationKind =
  | 'CHATMAN_EQUATION_BREACH' // A ≠ μ(O*) — action not manufactured from admissible state
  | 'AGENT_STATUS_REGRESS' // agent transitioned to a disallowed status sequence
  | 'STATE_ENTROPY_OVERFLOW' // cumulative refactor entropy exceeds threshold
  | 'RECEIPT_CHAIN_BREAK' // BLAKE3 chain integrity compromised
  | 'STALE_CHECKPOINT'; // checkpoint too old relative to current epoch

/** Description of a single invariant violation with full context. */
export interface QAViolation {
  readonly kind: ViolationKind;
  readonly agentId: string;
  readonly detectedAt: string; // ISO-8601 timestamp
  readonly details: Record<string, unknown>;
  readonly blake3Receipt: string; // Receipt hash for this violation record
  readonly repairStrategy: RepairStrategy;
  readonly repairOutcome: RepairOutcome;
}

/** The repair strategy chosen for a given violation. */
export type RepairStrategy = 'ROLLBACK' | 'REHYDRATION' | 'ALERT_ESCALATION';

/** Outcome of the applied repair. */
export interface RepairOutcome {
  readonly success: boolean;
  readonly strategy: RepairStrategy;
  readonly restoredFromHash?: string; // Blake3 hash of the restored checkpoint
  readonly error?: string;
  readonly spanId?: string; // OTel span id of the repair action
}

/** A BLAKE3-signed checkpoint of a single agent's observable state. */
export interface AgentCheckpoint {
  readonly agentId: string;
  readonly capturedAt: string; // ISO-8601
  readonly epoch: number; // monotonic counter from engine start
  readonly snapshot: Readonly<AgentInfo>;
  readonly blake3Hash: string; // BLAKE3(canonicalStringify(snapshot))
}

/** Per-agent QA check result. */
export interface AgentQAResult {
  readonly agentId: string;
  readonly healthy: boolean;
  readonly violations: QAViolation[];
  readonly checkpoint?: AgentCheckpoint;
}

/** Full structured report returned by a single `runQACycle()` call. */
export interface QACycleReport {
  readonly cycleId: string; // unique cycle identifier
  readonly startedAt: string; // ISO-8601
  readonly completedAt: string; // ISO-8601
  readonly durationMs: number;
  readonly engineEpoch: number; // engine's internal tick counter
  readonly agentResults: AgentQAResult[];
  readonly totalViolations: number;
  readonly totalRepairsAttempted: number;
  readonly totalRepairsSucceeded: number;
  readonly overallHealth: 'HEALTHY' | 'DEGRADED' | 'CRITICAL';
  readonly cycleReceiptHash: string; // BLAKE3 of the complete cycle summary
}

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

export interface AutonomicQAConfig {
  /**
   * Maximum consecutive refactors an agent may accumulate before being
   * considered entropy-overflowed.  Default: 100.
   */
  maxAgentRefactorEntropy?: number;

  /**
   * Maximum age (in engine epochs) a checkpoint is considered fresh.
   * Default: 10.
   */
  maxCheckpointAgeEpochs?: number;

  /**
   * Allowed agent status transition edges.  Unlisted edges are illegal.
   * Default: a permissive graph that allows all self-loops and realistic
   * operational sequences.
   */
  allowedStatusTransitions?: Record<AgentStatus, AgentStatus[]>;

  /**
   * If true the engine patches the swarm state back to the checkpoint
   * value when rolling back; if false it only emits the repair receipt.
   * Default: true.
   */
  applyStatePatches?: boolean;
}

const DEFAULT_ALLOWED_TRANSITIONS: Record<AgentStatus, AgentStatus[]> = {
  idle: ['idle', 'analyzing', 'refactoring'],
  analyzing: ['idle', 'analyzing', 'refactoring'],
  refactoring: ['idle', 'analyzing', 'refactoring'],
};

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/** Compute a BLAKE3 receipt string for an arbitrary payload. */
function computeBlake3Receipt(previousHash: string, payload: unknown): string {
  const data = canonicalStringify(payload);
  return blake3(previousHash + data);
}

/** Generate a short unique id. */
function uid(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 9)}`;
}

// ---------------------------------------------------------------------------
// AutonomicQAEngine
// ---------------------------------------------------------------------------

/**
 * AutonomicQAEngine
 *
 * Continuously monitors AppSwarmManager agents for invariant violations and
 * autonomously applies repair strategies when violations are detected.
 *
 * Thread-safety note: all methods are synchronous except `runQACycle()` which
 * is async to accommodate async repair hooks.  No concurrent `runQACycle()`
 * invocations are permitted — the engine debounces with `_cycleRunning`.
 */
export class AutonomicQAEngine {
  private readonly swarm: AppSwarmManager;
  private readonly telemetry: TelemetryManager;
  private readonly config: Required<AutonomicQAConfig>;

  // Checkpoint store: agentId → ordered list of checkpoints (oldest first)
  private readonly checkpoints: Map<string, AgentCheckpoint[]> = new Map();

  // Previous status for each agent — used for transition validation
  private readonly previousStatus: Map<string, AgentStatus> = new Map();

  // BLAKE3 receipt chain for the engine itself
  private chainHead: string = '';

  // Monotonic engine epoch counter (incremented each cycle)
  private epoch: number = 0;

  // Guard against concurrent cycles
  private _cycleRunning: boolean = false;

  // Subscribers for state change notifications
  private readonly subscribers: Set<() => void> = new Set();

  // Last cycle report (available for polling / hook consumption)
  private _lastReport: QACycleReport | null = null;

  // Accumulated violation log across all cycles
  private readonly violationLog: QAViolation[] = [];

  constructor(
    swarm: AppSwarmManager,
    config: AutonomicQAConfig = {},
    telemetry?: TelemetryManager
  ) {
    this.swarm = swarm;
    this.telemetry = telemetry ?? new TelemetryManager();
    this.config = {
      maxAgentRefactorEntropy: config.maxAgentRefactorEntropy ?? 100,
      maxCheckpointAgeEpochs: config.maxCheckpointAgeEpochs ?? 10,
      allowedStatusTransitions: config.allowedStatusTransitions ?? DEFAULT_ALLOWED_TRANSITIONS,
      applyStatePatches: config.applyStatePatches ?? true,
    };
  }

  // -------------------------------------------------------------------------
  // Public API
  // -------------------------------------------------------------------------

  /**
   * Execute one full QA cycle over all registered swarm agents.
   *
   * Returns a fully typed `QACycleReport` containing every check performed,
   * all violations detected, and all repair outcomes.  The report itself is
   * hashed into the BLAKE3 receipt chain for auditability.
   */
  public async runQACycle(): Promise<QACycleReport> {
    if (this._cycleRunning) {
      // Return last report rather than queuing concurrent work.  Callers must
      // wait for the in-progress cycle to complete before triggering another.
      return this._lastReport ?? this._emptyReport();
    }

    this._cycleRunning = true;
    const cycleId = uid('cycle');
    const startedAt = new Date().toISOString();
    const startMs = Date.now();

    const traceId = `trace_qa_${cycleId}`;
    const cycleSpanId = this.telemetry.startSpan('autonomic_qa.cycle', traceId);

    try {
      this.epoch++;
      const agents = this.swarm.getAgents();
      const agentResults: AgentQAResult[] = [];

      for (const agent of agents) {
        const result = await this._inspectAgent(agent, traceId);
        agentResults.push(result);

        // Capture a fresh checkpoint for healthy agents
        if (result.healthy) {
          this._captureCheckpoint(agent);
        }

        // Record previous status for next cycle's transition check
        this.previousStatus.set(agent.id, agent.status);
      }

      const totalViolations = agentResults.reduce((s, r) => s + r.violations.length, 0);
      const totalRepairsAttempted = agentResults.reduce(
        (s, r) =>
          s +
          r.violations.filter(
            (v) => v.repairOutcome.strategy !== 'ALERT_ESCALATION' || v.repairOutcome.success
          ).length,
        0
      );
      const totalRepairsSucceeded = agentResults.reduce(
        (s, r) => s + r.violations.filter((v) => v.repairOutcome.success).length,
        0
      );

      const overallHealth: QACycleReport['overallHealth'] =
        totalViolations === 0
          ? 'HEALTHY'
          : totalRepairsSucceeded < totalViolations
            ? 'CRITICAL'
            : 'DEGRADED';

      const completedAt = new Date().toISOString();
      const durationMs = Date.now() - startMs;

      const cycleSummary = {
        cycleId,
        startedAt,
        completedAt,
        durationMs,
        engineEpoch: this.epoch,
        totalViolations,
        totalRepairsAttempted,
        totalRepairsSucceeded,
        overallHealth,
        agentCount: agents.length,
      };

      const cycleReceiptHash = computeBlake3Receipt(this.chainHead, cycleSummary);
      this.chainHead = cycleReceiptHash;

      const report: QACycleReport = {
        ...cycleSummary,
        agentResults,
        cycleReceiptHash,
      };

      this._lastReport = report;
      this._notifySubscribers();

      return report;
    } finally {
      this.telemetry.endSpan(cycleSpanId);
      this._cycleRunning = false;
    }
  }

  /**
   * Subscribe to QA cycle completion events.  Returns an unsubscribe function.
   */
  public subscribe(listener: () => void): () => void {
    this.subscribers.add(listener);
    return () => this.subscribers.delete(listener);
  }

  /**
   * Return the most-recently completed cycle report, or `null` if no cycle
   * has been run yet.
   */
  public getLastReport(): QACycleReport | null {
    return this._lastReport;
  }

  /**
   * Return the entire violation log accumulated across all cycles.
   */
  public getViolationLog(): readonly QAViolation[] {
    return this.violationLog;
  }

  /**
   * Return the most-recent valid checkpoint for a given agent, or `undefined`
   * if no checkpoint has been captured yet.
   */
  public getLatestCheckpoint(agentId: string): AgentCheckpoint | undefined {
    const list = this.checkpoints.get(agentId);
    return list && list.length > 0 ? list[list.length - 1] : undefined;
  }

  /**
   * Return the current BLAKE3 chain head hash.
   */
  public getChainHead(): string {
    return this.chainHead;
  }

  /**
   * Expose the underlying telemetry manager so external code (e.g. hooks)
   * can register listeners.
   */
  public getTelemetry(): TelemetryManager {
    return this.telemetry;
  }

  // -------------------------------------------------------------------------
  // Core inspection logic
  // -------------------------------------------------------------------------

  private async _inspectAgent(agent: AgentInfo, parentTraceId: string): Promise<AgentQAResult> {
    const agentSpanId = this.telemetry.startSpan(
      `autonomic_qa.agent.inspect.${agent.id}`,
      parentTraceId
    );

    const violations: QAViolation[] = [];

    try {
      // ── 1. Chatman Equation Breach Check ──────────────────────────────────
      // R ⊢ A = μ(O*) — the agent's current action (status) must be
      // derivable from its observed memory state (O*).  An agent with zero
      // memoryAnalyzed claiming to be 'refactoring' violates this because
      // a refactor action cannot be manufactured without prior analysis.
      const chatmanViolation = this._checkChatmanEquation(agent);
      if (chatmanViolation) {
        const repairSpanId = this.telemetry.startSpan(
          `autonomic_qa.repair.chatman.${agent.id}`,
          parentTraceId
        );
        const outcome = await this._applyRepair(agent, 'CHATMAN_EQUATION_BREACH', parentTraceId);
        this.telemetry.endSpan(repairSpanId);

        const violation = this._buildViolation(
          'CHATMAN_EQUATION_BREACH',
          agent,
          chatmanViolation,
          outcome
        );
        violations.push(violation);
        this.violationLog.push(violation);
      }

      // ── 2. Status Transition Validation ───────────────────────────────────
      const prevStatus = this.previousStatus.get(agent.id);
      if (prevStatus !== undefined) {
        const transitionViolation = this._checkStatusTransition(agent, prevStatus);
        if (transitionViolation) {
          const repairSpanId = this.telemetry.startSpan(
            `autonomic_qa.repair.transition.${agent.id}`,
            parentTraceId
          );
          const outcome = await this._applyRepair(agent, 'AGENT_STATUS_REGRESS', parentTraceId);
          this.telemetry.endSpan(repairSpanId);

          const violation = this._buildViolation(
            'AGENT_STATUS_REGRESS',
            agent,
            transitionViolation,
            outcome
          );
          violations.push(violation);
          this.violationLog.push(violation);
        }
      }

      // ── 3. State Entropy Overflow ──────────────────────────────────────────
      if (agent.componentsRefactored > this.config.maxAgentRefactorEntropy) {
        const entropySpanId = this.telemetry.startSpan(
          `autonomic_qa.repair.entropy.${agent.id}`,
          parentTraceId
        );
        const outcome = await this._applyRepair(agent, 'STATE_ENTROPY_OVERFLOW', parentTraceId);
        this.telemetry.endSpan(entropySpanId);

        const violation = this._buildViolation(
          'STATE_ENTROPY_OVERFLOW',
          agent,
          {
            componentsRefactored: agent.componentsRefactored,
            threshold: this.config.maxAgentRefactorEntropy,
          },
          outcome
        );
        violations.push(violation);
        this.violationLog.push(violation);
      }

      // ── 4. Stale Checkpoint Check ──────────────────────────────────────────
      const staleViolation = this._checkStaleCheckpoint(agent);
      if (staleViolation) {
        // Stale checkpoints always trigger alert escalation; the agent itself
        // may still be healthy so we don't attempt a rollback.
        const outcome: RepairOutcome = await this._escalate(
          agent,
          'STALE_CHECKPOINT',
          parentTraceId
        );
        const violation = this._buildViolation('STALE_CHECKPOINT', agent, staleViolation, outcome);
        violations.push(violation);
        this.violationLog.push(violation);
      }

      const healthy = violations.length === 0;
      const latestCp = this.getLatestCheckpoint(agent.id);

      return { agentId: agent.id, healthy, violations, checkpoint: latestCp };
    } finally {
      this.telemetry.endSpan(agentSpanId);
    }
  }

  // ── Chatman Equation: R ⊢ A = μ(O*) ──────────────────────────────────────
  // An agent in status='refactoring' must have analysed at least some memory
  // (memoryAnalyzed > 0) because refactoring is a consequential action that
  // must be manufactured from prior observations.  Similarly an agent that has
  // refactored components should show non-trivial memory analysis.
  private _checkChatmanEquation(agent: AgentInfo): Record<string, unknown> | null {
    if (
      agent.status === 'refactoring' &&
      agent.memoryAnalyzed === 0 &&
      agent.componentsRefactored === 0
    ) {
      // Refactoring with no prior analysis — equation violated
      return {
        status: agent.status,
        memoryAnalyzed: agent.memoryAnalyzed,
        componentsRefactored: agent.componentsRefactored,
        invariant: 'refactoring requires memoryAnalyzed > 0 or componentsRefactored > 0',
      };
    }
    return null;
  }

  // ── Status Transition Validation ──────────────────────────────────────────
  private _checkStatusTransition(
    agent: AgentInfo,
    prevStatus: AgentStatus
  ): Record<string, unknown> | null {
    const allowed = this.config.allowedStatusTransitions[prevStatus] ?? [];
    if (!allowed.includes(agent.status)) {
      return {
        from: prevStatus,
        to: agent.status,
        allowedTargets: allowed,
        invariant: `status transition ${prevStatus} → ${agent.status} is not in the allowed transition set`,
      };
    }
    return null;
  }

  // ── Stale Checkpoint ──────────────────────────────────────────────────────
  private _checkStaleCheckpoint(agent: AgentInfo): Record<string, unknown> | null {
    const cps = this.checkpoints.get(agent.id);
    if (!cps || cps.length === 0) return null; // No checkpoint yet — not stale, just absent

    const latest = cps[cps.length - 1];
    const age = this.epoch - latest.epoch;
    if (age > this.config.maxCheckpointAgeEpochs) {
      return {
        latestCheckpointEpoch: latest.epoch,
        currentEpoch: this.epoch,
        age,
        maxAgeEpochs: this.config.maxCheckpointAgeEpochs,
        invariant: 'checkpoint age exceeds maxCheckpointAgeEpochs',
      };
    }
    return null;
  }

  // -------------------------------------------------------------------------
  // Repair strategies
  // -------------------------------------------------------------------------

  /**
   * Choose and apply the highest-priority repair strategy for the given violation.
   *
   * Priority order:
   *   1. ROLLBACK         — if a valid checkpoint exists
   *   2. REHYDRATION      — if checkpoint exists but agent state is unrestorable
   *   3. ALERT_ESCALATION — no checkpoint available
   */
  private async _applyRepair(
    agent: AgentInfo,
    kind: ViolationKind,
    traceId: string
  ): Promise<RepairOutcome> {
    const checkpoint = this.getLatestCheckpoint(agent.id);

    if (checkpoint) {
      // Try Rollback first
      return this._rollback(agent, checkpoint, traceId);
    }

    // No checkpoint — escalate
    return this._escalate(agent, kind, traceId);
  }

  /** Strategy 1: Rollback — restore agent to last BLAKE3-verified checkpoint. */
  private _rollback(agent: AgentInfo, checkpoint: AgentCheckpoint, traceId: string): RepairOutcome {
    const spanId = this.telemetry.startSpan(`autonomic_qa.strategy.rollback.${agent.id}`, traceId);

    try {
      // Verify the checkpoint's BLAKE3 hash before restoring
      const expectedHash = blake3(canonicalStringify(checkpoint.snapshot));
      if (expectedHash !== checkpoint.blake3Hash) {
        // Checkpoint is itself corrupted — escalate to re-hydration
        this.telemetry.endSpan(spanId);
        return this._rehydrate(agent, checkpoint, traceId);
      }

      if (this.config.applyStatePatches) {
        // Patch the live agent object back to checkpoint values.
        // AppSwarmManager stores AgentInfo objects by reference inside a Map.
        // We mutate in-place so the swarm's internal state is corrected.
        const live = this.swarm.getAgent(agent.id);
        if (live) {
          (live as AgentInfo).status = checkpoint.snapshot.status;
          (live as AgentInfo).memoryAnalyzed = checkpoint.snapshot.memoryAnalyzed;
          (live as AgentInfo).componentsRefactored = checkpoint.snapshot.componentsRefactored;
        }
      }

      // Emit receipt for the rollback action
      const rollbackReceipt = computeBlake3Receipt(this.chainHead, {
        action: 'ROLLBACK',
        agentId: agent.id,
        restoredFromHash: checkpoint.blake3Hash,
        at: new Date().toISOString(),
      });
      this.chainHead = rollbackReceipt;

      this.telemetry.endSpan(spanId);

      return {
        success: true,
        strategy: 'ROLLBACK',
        restoredFromHash: checkpoint.blake3Hash,
        spanId,
      };
    } catch (err: unknown) {
      this.telemetry.endSpan(spanId);
      const message = err instanceof Error ? err.message : String(err);
      return {
        success: false,
        strategy: 'ROLLBACK',
        error: `Rollback failed: ${message}`,
        spanId,
      };
    }
  }

  /**
   * Strategy 2: Re-hydration — reconstruct the agent's operational state
   * from the checkpoint store using a verified BLAKE3 snapshot.  Used when
   * the checkpoint hash is intact but direct state patching fails.
   */
  private _rehydrate(
    agent: AgentInfo,
    checkpoint: AgentCheckpoint,
    traceId: string
  ): RepairOutcome {
    const spanId = this.telemetry.startSpan(`autonomic_qa.strategy.rehydrate.${agent.id}`, traceId);

    try {
      // Walk the checkpoint history backwards until we find a verifiable one
      const history = this.checkpoints.get(agent.id) ?? [];
      let rehydrated = false;
      let usedHash: string | undefined;

      for (let i = history.length - 1; i >= 0; i--) {
        const cp = history[i];
        const expectedHash = blake3(canonicalStringify(cp.snapshot));
        if (expectedHash === cp.blake3Hash) {
          if (this.config.applyStatePatches) {
            const live = this.swarm.getAgent(agent.id);
            if (live) {
              (live as AgentInfo).status = cp.snapshot.status;
              (live as AgentInfo).memoryAnalyzed = cp.snapshot.memoryAnalyzed;
              (live as AgentInfo).componentsRefactored = cp.snapshot.componentsRefactored;
            }
          }
          usedHash = cp.blake3Hash;
          rehydrated = true;
          break;
        }
      }

      if (!rehydrated) {
        // Emit receipt for failed re-hydration before escalating
        const failReceipt = computeBlake3Receipt(this.chainHead, {
          action: 'REHYDRATION_FAILED',
          agentId: agent.id,
          at: new Date().toISOString(),
        });
        this.chainHead = failReceipt;
        this.telemetry.endSpan(spanId);
        return {
          success: false,
          strategy: 'REHYDRATION',
          error: 'No verifiable checkpoint found in re-hydration history',
          spanId,
        };
      }

      const rehydrateReceipt = computeBlake3Receipt(this.chainHead, {
        action: 'REHYDRATION',
        agentId: agent.id,
        restoredFromHash: usedHash,
        at: new Date().toISOString(),
      });
      this.chainHead = rehydrateReceipt;

      this.telemetry.endSpan(spanId);
      return {
        success: true,
        strategy: 'REHYDRATION',
        restoredFromHash: usedHash,
        spanId,
      };
    } catch (err: unknown) {
      this.telemetry.endSpan(spanId);
      const message = err instanceof Error ? err.message : String(err);
      return {
        success: false,
        strategy: 'REHYDRATION',
        error: `Re-hydration failed: ${message}`,
        spanId,
      };
    }
  }

  /**
   * Strategy 3: Alert Escalation — no repair is possible; emit a critical
   * OTel span and receipt for upstream observability systems.
   */
  private async _escalate(
    agent: AgentInfo,
    kind: ViolationKind,
    traceId: string
  ): Promise<RepairOutcome> {
    const spanId = this.telemetry.startSpan(`autonomic_qa.strategy.escalate.${agent.id}`, traceId);

    const escalationReceipt = computeBlake3Receipt(this.chainHead, {
      action: 'ALERT_ESCALATION',
      kind,
      agentId: agent.id,
      at: new Date().toISOString(),
    });
    this.chainHead = escalationReceipt;

    this.telemetry.emit({
      timestamp: new Date().toISOString(),
      type: 'rollback', // closest existing telemetry event type for critical events
      flowName: `qa.escalation.${kind}`,
      error: `Critical QA escalation for agent ${agent.id}: ${kind}`,
      traceId,
      spanId,
    });

    this.telemetry.endSpan(spanId);

    return {
      success: false, // escalation alone does not constitute successful repair
      strategy: 'ALERT_ESCALATION',
      spanId,
    };
  }

  // -------------------------------------------------------------------------
  // Checkpoint management
  // -------------------------------------------------------------------------

  private _captureCheckpoint(agent: AgentInfo): AgentCheckpoint {
    const snapshot: Readonly<AgentInfo> = {
      id: agent.id,
      status: agent.status,
      memoryAnalyzed: agent.memoryAnalyzed,
      componentsRefactored: agent.componentsRefactored,
    };

    const blake3Hash = blake3(canonicalStringify(snapshot));

    const checkpoint: AgentCheckpoint = {
      agentId: agent.id,
      capturedAt: new Date().toISOString(),
      epoch: this.epoch,
      snapshot,
      blake3Hash,
    };

    if (!this.checkpoints.has(agent.id)) {
      this.checkpoints.set(agent.id, []);
    }
    const list = this.checkpoints.get(agent.id)!;
    list.push(checkpoint);

    // Keep a bounded history (last 50 checkpoints per agent)
    const MAX_HISTORY = 50;
    if (list.length > MAX_HISTORY) {
      list.splice(0, list.length - MAX_HISTORY);
    }

    return checkpoint;
  }

  // -------------------------------------------------------------------------
  // Internal utilities
  // -------------------------------------------------------------------------

  private _buildViolation(
    kind: ViolationKind,
    agent: AgentInfo,
    details: Record<string, unknown>,
    repairOutcome: RepairOutcome
  ): QAViolation {
    const violationPayload = { kind, agentId: agent.id, details, repairOutcome };
    const blake3Receipt = computeBlake3Receipt(this.chainHead, violationPayload);
    this.chainHead = blake3Receipt;

    return {
      kind,
      agentId: agent.id,
      detectedAt: new Date().toISOString(),
      details,
      blake3Receipt,
      repairStrategy: repairOutcome.strategy,
      repairOutcome,
    };
  }

  private _emptyReport(): QACycleReport {
    const now = new Date().toISOString();
    return {
      cycleId: uid('cycle_empty'),
      startedAt: now,
      completedAt: now,
      durationMs: 0,
      engineEpoch: this.epoch,
      agentResults: [],
      totalViolations: 0,
      totalRepairsAttempted: 0,
      totalRepairsSucceeded: 0,
      overallHealth: 'HEALTHY',
      cycleReceiptHash: this.chainHead,
    };
  }

  private _notifySubscribers(): void {
    for (const sub of this.subscribers) {
      try {
        sub();
      } catch {
        // Individual subscriber errors must not crash the engine
      }
    }
  }
}
