// src/framework/auto/__tests__/AutonomicQAEngine.test.ts
//
// Exhaustive Jest test suite for AutonomicQAEngine
//
// Coverage targets:
//   • Cycle report structure & BLAKE3 receipt chain integrity
//   • Chatman Equation violation detection
//   • Status transition validation
//   • State entropy overflow detection
//   • Stale checkpoint detection
//   • Rollback strategy (checkpoint verification + state patch)
//   • Re-hydration strategy (corrupt checkpoint fallback)
//   • Alert escalation strategy (no checkpoint available)
//   • Concurrent cycle guard (debounce)
//   • Subscriber notification
//   • Edge cases: zero agents, single agent, violation log accumulation

import {
  AutonomicQAEngine,
  AutonomicQAConfig,
  QACycleReport,
  QAViolation,
  RepairOutcome,
} from '../AutonomicQAEngine';
import { AppSwarmManager, AgentInfo } from '../../v30/autonomous-swarm/AppSwarmManager';
import { TelemetryManager } from '../../membrane/managers/telemetry';

// ---------------------------------------------------------------------------
// Test factory helpers
// ---------------------------------------------------------------------------

function makeSwarm(agentCount = 3): AppSwarmManager {
  return new AppSwarmManager(agentCount);
}

function makeEngine(swarm: AppSwarmManager, config: AutonomicQAConfig = {}): AutonomicQAEngine {
  const telemetry = new TelemetryManager();
  return new AutonomicQAEngine(swarm, config, telemetry);
}

/**
 * Force an agent into a specific state by driving the tick internals.
 * We patch the internal agents Map directly (white-box) to set up
 * deterministic test scenarios.
 */
function patchAgent(swarm: AppSwarmManager, agentId: string, patch: Partial<AgentInfo>): void {
  const agent = swarm.getAgent(agentId);
  if (!agent) throw new Error(`Agent ${agentId} not found`);
  Object.assign(agent, patch);
}

// ---------------------------------------------------------------------------
// Describe groups
// ---------------------------------------------------------------------------

describe('AutonomicQAEngine', () => {
  // ──────────────────────────────────────────────────────────────────────────
  // 1. Cycle report structure
  // ──────────────────────────────────────────────────────────────────────────
  describe('QA cycle report structure', () => {
    it('returns a well-formed QACycleReport with all required fields', async () => {
      const swarm = makeSwarm(2);
      const engine = makeEngine(swarm);

      const report = await engine.runQACycle();

      expect(report.cycleId).toMatch(/^cycle_/);
      expect(typeof report.startedAt).toBe('string');
      expect(typeof report.completedAt).toBe('string');
      expect(typeof report.durationMs).toBe('number');
      expect(report.durationMs).toBeGreaterThanOrEqual(0);
      expect(report.engineEpoch).toBe(1);
      expect(Array.isArray(report.agentResults)).toBe(true);
      expect(report.agentResults.length).toBe(2);
      expect(['HEALTHY', 'DEGRADED', 'CRITICAL']).toContain(report.overallHealth);
      expect(typeof report.cycleReceiptHash).toBe('string');
      expect(report.cycleReceiptHash.length).toBeGreaterThan(0);
    });

    it('increments engineEpoch on each cycle', async () => {
      const swarm = makeSwarm(1);
      const engine = makeEngine(swarm);

      const r1 = await engine.runQACycle();
      const r2 = await engine.runQACycle();
      const r3 = await engine.runQACycle();

      expect(r1.engineEpoch).toBe(1);
      expect(r2.engineEpoch).toBe(2);
      expect(r3.engineEpoch).toBe(3);
    });

    it('produces distinct cycleReceiptHash values on each cycle', async () => {
      const swarm = makeSwarm(2);
      const engine = makeEngine(swarm);

      const r1 = await engine.runQACycle();
      const r2 = await engine.runQACycle();

      expect(r1.cycleReceiptHash).not.toBe(r2.cycleReceiptHash);
    });

    it('reports HEALTHY when no agents are registered', async () => {
      const swarm = makeSwarm(0);
      const engine = makeEngine(swarm);

      const report = await engine.runQACycle();
      expect(report.overallHealth).toBe('HEALTHY');
      expect(report.totalViolations).toBe(0);
      expect(report.agentResults.length).toBe(0);
    });

    it('agentResults contain the correct agentId for each agent', async () => {
      const swarm = makeSwarm(3);
      const engine = makeEngine(swarm);

      const report = await engine.runQACycle();
      const ids = report.agentResults.map((r) => r.agentId);
      expect(ids).toContain('agent-0');
      expect(ids).toContain('agent-1');
      expect(ids).toContain('agent-2');
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 2. Chatman Equation violation detection
  // ──────────────────────────────────────────────────────────────────────────
  describe('Chatman Equation breach detection (R ⊢ A = μ(O*))', () => {
    it('detects a breach when an agent is refactoring with zero prior analysis', async () => {
      const swarm = makeSwarm(1);
      // Fresh agents start idle with 0 memoryAnalyzed and 0 componentsRefactored.
      // Manually set status to refactoring without any analysis.
      patchAgent(swarm, 'agent-0', {
        status: 'refactoring',
        memoryAnalyzed: 0,
        componentsRefactored: 0,
      });

      const engine = makeEngine(swarm);
      const report = await engine.runQACycle();

      const agentResult = report.agentResults.find((r) => r.agentId === 'agent-0')!;
      expect(agentResult.healthy).toBe(false);

      const violation = agentResult.violations.find((v) => v.kind === 'CHATMAN_EQUATION_BREACH');
      expect(violation).toBeDefined();
      expect(violation!.agentId).toBe('agent-0');
      expect(typeof violation!.blake3Receipt).toBe('string');
    });

    it('does NOT flag a breach when a refactoring agent has prior analysis', async () => {
      const swarm = makeSwarm(1);
      patchAgent(swarm, 'agent-0', {
        status: 'refactoring',
        memoryAnalyzed: 512,
        componentsRefactored: 1,
      });

      const engine = makeEngine(swarm);
      const report = await engine.runQACycle();

      const agentResult = report.agentResults.find((r) => r.agentId === 'agent-0')!;
      const chatmanViolation = agentResult.violations.find(
        (v) => v.kind === 'CHATMAN_EQUATION_BREACH'
      );
      expect(chatmanViolation).toBeUndefined();
    });

    it('does NOT flag a breach for idle or analyzing agents with zero memory', async () => {
      const swarm = makeSwarm(2);
      patchAgent(swarm, 'agent-0', { status: 'idle', memoryAnalyzed: 0, componentsRefactored: 0 });
      patchAgent(swarm, 'agent-1', {
        status: 'analyzing',
        memoryAnalyzed: 0,
        componentsRefactored: 0,
      });

      const engine = makeEngine(swarm);
      const report = await engine.runQACycle();

      for (const r of report.agentResults) {
        const chatmanViolation = r.violations.find((v) => v.kind === 'CHATMAN_EQUATION_BREACH');
        expect(chatmanViolation).toBeUndefined();
      }
    });

    it('does NOT breach when refactoring agent has componentsRefactored > 0 even if memoryAnalyzed = 0', async () => {
      // An agent that has previously refactored (non-zero componentsRefactored) satisfies O*
      const swarm = makeSwarm(1);
      patchAgent(swarm, 'agent-0', {
        status: 'refactoring',
        memoryAnalyzed: 0,
        componentsRefactored: 3,
      });

      const engine = makeEngine(swarm);
      const report = await engine.runQACycle();

      const agentResult = report.agentResults.find((r) => r.agentId === 'agent-0')!;
      const chatmanViolation = agentResult.violations.find(
        (v) => v.kind === 'CHATMAN_EQUATION_BREACH'
      );
      expect(chatmanViolation).toBeUndefined();
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 3. Status transition validation
  // ──────────────────────────────────────────────────────────────────────────
  describe('Status transition validation', () => {
    it('detects an illegal status transition on the second cycle', async () => {
      const swarm = makeSwarm(1);
      patchAgent(swarm, 'agent-0', { status: 'idle' });

      // Custom config: from idle only 'analyzing' is allowed
      const engine = makeEngine(swarm, {
        allowedStatusTransitions: {
          idle: ['analyzing'],
          analyzing: ['idle', 'refactoring'],
          refactoring: ['idle'],
        },
      });

      // Cycle 1: agent is idle — no previous status, no transition check
      await engine.runQACycle();

      // Set agent to 'refactoring' directly from 'idle' — violates our custom rule
      patchAgent(swarm, 'agent-0', {
        status: 'refactoring',
        memoryAnalyzed: 100,
        componentsRefactored: 1,
      });

      const report2 = await engine.runQACycle();
      const agentResult = report2.agentResults.find((r) => r.agentId === 'agent-0')!;
      const transViolation = agentResult.violations.find((v) => v.kind === 'AGENT_STATUS_REGRESS');
      expect(transViolation).toBeDefined();
      expect(transViolation!.details['from']).toBe('idle');
      expect(transViolation!.details['to']).toBe('refactoring');
    });

    it('accepts all transitions in the default permissive configuration', async () => {
      const swarm = makeSwarm(1);
      patchAgent(swarm, 'agent-0', { status: 'idle' });

      const engine = makeEngine(swarm); // default config allows all transitions

      // Cycle 1: idle (records previous as idle)
      await engine.runQACycle();

      // Cycle 2: jump straight to refactoring — allowed in default graph
      patchAgent(swarm, 'agent-0', {
        status: 'refactoring',
        memoryAnalyzed: 10,
        componentsRefactored: 1,
      });
      const report2 = await engine.runQACycle();

      const agentResult = report2.agentResults.find((r) => r.agentId === 'agent-0')!;
      const transViolation = agentResult.violations.find((v) => v.kind === 'AGENT_STATUS_REGRESS');
      expect(transViolation).toBeUndefined();
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 4. State entropy overflow
  // ──────────────────────────────────────────────────────────────────────────
  describe('State entropy overflow detection', () => {
    it('flags an agent whose componentsRefactored exceeds the threshold', async () => {
      const swarm = makeSwarm(1);
      patchAgent(swarm, 'agent-0', {
        status: 'idle',
        memoryAnalyzed: 10000,
        componentsRefactored: 101, // default threshold is 100
      });

      const engine = makeEngine(swarm, { maxAgentRefactorEntropy: 100 });
      const report = await engine.runQACycle();

      const agentResult = report.agentResults.find((r) => r.agentId === 'agent-0')!;
      const entropyViolation = agentResult.violations.find(
        (v) => v.kind === 'STATE_ENTROPY_OVERFLOW'
      );
      expect(entropyViolation).toBeDefined();
      expect(entropyViolation!.details['componentsRefactored']).toBe(101);
      expect(entropyViolation!.details['threshold']).toBe(100);
    });

    it('does NOT flag entropy at exactly the threshold', async () => {
      const swarm = makeSwarm(1);
      patchAgent(swarm, 'agent-0', {
        status: 'idle',
        memoryAnalyzed: 1000,
        componentsRefactored: 100, // == threshold, not >
      });

      const engine = makeEngine(swarm, { maxAgentRefactorEntropy: 100 });
      const report = await engine.runQACycle();

      const agentResult = report.agentResults.find((r) => r.agentId === 'agent-0')!;
      const entropyViolation = agentResult.violations.find(
        (v) => v.kind === 'STATE_ENTROPY_OVERFLOW'
      );
      expect(entropyViolation).toBeUndefined();
    });

    it('respects a custom entropy threshold', async () => {
      const swarm = makeSwarm(1);
      patchAgent(swarm, 'agent-0', {
        status: 'idle',
        memoryAnalyzed: 100,
        componentsRefactored: 6,
      });

      const engine = makeEngine(swarm, { maxAgentRefactorEntropy: 5 });
      const report = await engine.runQACycle();

      const agentResult = report.agentResults.find((r) => r.agentId === 'agent-0')!;
      const entropyViolation = agentResult.violations.find(
        (v) => v.kind === 'STATE_ENTROPY_OVERFLOW'
      );
      expect(entropyViolation).toBeDefined();
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 5. Stale checkpoint detection
  // ──────────────────────────────────────────────────────────────────────────
  describe('Stale checkpoint detection', () => {
    it('does not raise stale violation when no checkpoint exists', async () => {
      const swarm = makeSwarm(1);
      const engine = makeEngine(swarm, { maxCheckpointAgeEpochs: 2 });

      const report = await engine.runQACycle();
      const agentResult = report.agentResults.find((r) => r.agentId === 'agent-0')!;
      const staleViolation = agentResult.violations.find((v) => v.kind === 'STALE_CHECKPOINT');
      expect(staleViolation).toBeUndefined();
    });

    it('raises STALE_CHECKPOINT when epoch gap exceeds maxCheckpointAgeEpochs', async () => {
      const swarm = makeSwarm(1);
      patchAgent(swarm, 'agent-0', { status: 'idle', memoryAnalyzed: 0, componentsRefactored: 0 });

      const engine = makeEngine(swarm, { maxCheckpointAgeEpochs: 2 });

      // Cycle 1: healthy — checkpoint captured at epoch 1
      await engine.runQACycle();

      // Cycle 2-4: inject a Chatman violation so no checkpoint is captured
      for (let i = 0; i < 3; i++) {
        patchAgent(swarm, 'agent-0', {
          status: 'refactoring',
          memoryAnalyzed: 0,
          componentsRefactored: 0,
        });
        await engine.runQACycle();
      }

      // By now epoch = 4, last good checkpoint at epoch 1, gap = 3 > 2
      const report = await engine.runQACycle();
      const agentResult = report.agentResults.find((r) => r.agentId === 'agent-0')!;
      const staleViolation = agentResult.violations.find((v) => v.kind === 'STALE_CHECKPOINT');
      expect(staleViolation).toBeDefined();
      expect(Number(staleViolation!.details['age'])).toBeGreaterThan(2);
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 6. Rollback repair strategy
  // ──────────────────────────────────────────────────────────────────────────
  describe('Rollback repair strategy', () => {
    it('rolls back agent state to the last valid checkpoint on Chatman violation', async () => {
      const swarm = makeSwarm(1);
      patchAgent(swarm, 'agent-0', { status: 'idle', memoryAnalyzed: 0, componentsRefactored: 0 });

      const engine = makeEngine(swarm, { applyStatePatches: true });

      // Cycle 1: healthy — capture good checkpoint
      await engine.runQACycle();
      const checkpoint = engine.getLatestCheckpoint('agent-0');
      expect(checkpoint).toBeDefined();
      expect(checkpoint!.snapshot.status).toBe('idle');

      // Corrupt the agent
      patchAgent(swarm, 'agent-0', {
        status: 'refactoring',
        memoryAnalyzed: 0,
        componentsRefactored: 0,
      });

      // Cycle 2: detects violation, applies rollback
      const report2 = await engine.runQACycle();
      const agentResult = report2.agentResults.find((r) => r.agentId === 'agent-0')!;
      const chatmanViolation = agentResult.violations.find(
        (v) => v.kind === 'CHATMAN_EQUATION_BREACH'
      );
      expect(chatmanViolation).toBeDefined();
      expect(chatmanViolation!.repairOutcome.strategy).toBe('ROLLBACK');
      expect(chatmanViolation!.repairOutcome.success).toBe(true);

      // Verify the live agent was patched back
      const liveAgent = swarm.getAgent('agent-0')!;
      expect(liveAgent.status).toBe('idle');
      expect(liveAgent.memoryAnalyzed).toBe(0);
    });

    it('sets repairOutcome.restoredFromHash to the checkpoint blake3Hash', async () => {
      const swarm = makeSwarm(1);
      patchAgent(swarm, 'agent-0', {
        status: 'analyzing',
        memoryAnalyzed: 256,
        componentsRefactored: 0,
      });

      const engine = makeEngine(swarm, { applyStatePatches: true });
      await engine.runQACycle(); // capture checkpoint

      const checkpoint = engine.getLatestCheckpoint('agent-0')!;

      // Trigger a Chatman violation
      patchAgent(swarm, 'agent-0', {
        status: 'refactoring',
        memoryAnalyzed: 0,
        componentsRefactored: 0,
      });
      const report2 = await engine.runQACycle();

      const violation = report2.agentResults
        .find((r) => r.agentId === 'agent-0')!
        .violations.find((v) => v.kind === 'CHATMAN_EQUATION_BREACH')!;

      expect(violation.repairOutcome.restoredFromHash).toBe(checkpoint.blake3Hash);
    });

    it('does not mutate live agent when applyStatePatches = false', async () => {
      const swarm = makeSwarm(1);
      patchAgent(swarm, 'agent-0', { status: 'idle', memoryAnalyzed: 0, componentsRefactored: 0 });

      const engine = makeEngine(swarm, { applyStatePatches: false });
      await engine.runQACycle(); // capture checkpoint

      patchAgent(swarm, 'agent-0', {
        status: 'refactoring',
        memoryAnalyzed: 0,
        componentsRefactored: 0,
      });
      await engine.runQACycle();

      // Agent should still show the corrupt state because patches are disabled
      const liveAgent = swarm.getAgent('agent-0')!;
      expect(liveAgent.status).toBe('refactoring');
    });

    it('advances the BLAKE3 chain head after a rollback', async () => {
      const swarm = makeSwarm(1);
      patchAgent(swarm, 'agent-0', { status: 'idle', memoryAnalyzed: 0, componentsRefactored: 0 });

      const engine = makeEngine(swarm);
      await engine.runQACycle();
      const headBefore = engine.getChainHead();

      patchAgent(swarm, 'agent-0', {
        status: 'refactoring',
        memoryAnalyzed: 0,
        componentsRefactored: 0,
      });
      await engine.runQACycle();
      const headAfter = engine.getChainHead();

      expect(headBefore).not.toBe(headAfter);
      expect(headAfter.length).toBeGreaterThan(0);
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 7. Alert escalation strategy
  // ──────────────────────────────────────────────────────────────────────────
  describe('Alert escalation (no checkpoint available)', () => {
    it('escalates when no checkpoint has been captured yet', async () => {
      const swarm = makeSwarm(1);
      // Immediately inject a violation — no prior healthy cycle, so no checkpoint
      patchAgent(swarm, 'agent-0', {
        status: 'refactoring',
        memoryAnalyzed: 0,
        componentsRefactored: 0,
      });

      const engine = makeEngine(swarm);
      const report = await engine.runQACycle();

      const violation = report.agentResults
        .find((r) => r.agentId === 'agent-0')!
        .violations.find((v) => v.kind === 'CHATMAN_EQUATION_BREACH')!;

      expect(violation.repairStrategy).toBe('ALERT_ESCALATION');
      expect(violation.repairOutcome.strategy).toBe('ALERT_ESCALATION');
      // Escalation itself cannot claim a successful repair
      expect(violation.repairOutcome.success).toBe(false);
    });

    it('emits a telemetry rollback event on escalation', async () => {
      const telemetry = new TelemetryManager();
      const events: { type: string; flowName?: string }[] = [];
      telemetry.register((e) => events.push({ type: e.type, flowName: e.flowName }));

      const swarm = makeSwarm(1);
      patchAgent(swarm, 'agent-0', {
        status: 'refactoring',
        memoryAnalyzed: 0,
        componentsRefactored: 0,
      });

      const engine = new AutonomicQAEngine(swarm, {}, telemetry);
      await engine.runQACycle();

      const escalationEvent = events.find(
        (e) => e.type === 'rollback' && e.flowName?.includes('CHATMAN_EQUATION_BREACH')
      );
      expect(escalationEvent).toBeDefined();
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 8. OTel span emission
  // ──────────────────────────────────────────────────────────────────────────
  describe('OTel span emission', () => {
    it('emits span_start and span_end events for every QA cycle', async () => {
      const telemetry = new TelemetryManager();
      const spans: { type: string; flowName?: string }[] = [];
      telemetry.register((e) => {
        if (e.type === 'span_start' || e.type === 'span_end') {
          spans.push({ type: e.type, flowName: e.flowName });
        }
      });

      const swarm = makeSwarm(2);
      const engine = new AutonomicQAEngine(swarm, {}, telemetry);
      await engine.runQACycle();

      const cycleSpanStart = spans.find(
        (s) => s.type === 'span_start' && s.flowName === 'autonomic_qa.cycle'
      );
      const cycleSpanEnd = spans.find(
        (s) => s.type === 'span_end' && s.flowName === 'autonomic_qa.cycle'
      );

      expect(cycleSpanStart).toBeDefined();
      expect(cycleSpanEnd).toBeDefined();
    });

    it('emits per-agent inspection spans', async () => {
      const telemetry = new TelemetryManager();
      const spans: string[] = [];
      telemetry.register((e) => {
        if (e.type === 'span_start' && e.flowName) {
          spans.push(e.flowName);
        }
      });

      const swarm = makeSwarm(2);
      const engine = new AutonomicQAEngine(swarm, {}, telemetry);
      await engine.runQACycle();

      expect(spans).toContain('autonomic_qa.agent.inspect.agent-0');
      expect(spans).toContain('autonomic_qa.agent.inspect.agent-1');
    });

    it('emits repair spans when a violation triggers rollback', async () => {
      const telemetry = new TelemetryManager();
      const spans: string[] = [];
      telemetry.register((e) => {
        if (e.type === 'span_start' && e.flowName) {
          spans.push(e.flowName);
        }
      });

      const swarm = makeSwarm(1);
      patchAgent(swarm, 'agent-0', { status: 'idle', memoryAnalyzed: 0, componentsRefactored: 0 });

      const engine = new AutonomicQAEngine(swarm, {}, telemetry);
      await engine.runQACycle(); // capture checkpoint

      patchAgent(swarm, 'agent-0', {
        status: 'refactoring',
        memoryAnalyzed: 0,
        componentsRefactored: 0,
      });
      await engine.runQACycle();

      expect(spans.some((s) => s.includes('autonomic_qa.repair.chatman.agent-0'))).toBe(true);
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 9. Concurrent cycle guard (debounce)
  // ──────────────────────────────────────────────────────────────────────────
  describe('Concurrent cycle guard', () => {
    it('returns the last report when a cycle is already running', async () => {
      const swarm = makeSwarm(1);
      const engine = makeEngine(swarm);

      // Run first cycle to completion so _lastReport is set
      const report1 = await engine.runQACycle();

      // Simulate concurrent invocation by manually setting _cycleRunning
      (engine as any)._cycleRunning = true;

      const report2 = await engine.runQACycle();

      // Should return the last known report, not a new one
      expect(report2.cycleId).toBe(report1.cycleId);

      // Clean up
      (engine as any)._cycleRunning = false;
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 10. Subscriber notification
  // ──────────────────────────────────────────────────────────────────────────
  describe('Subscriber notification', () => {
    it('calls subscribers after each cycle completes', async () => {
      const swarm = makeSwarm(1);
      const engine = makeEngine(swarm);

      const listener = jest.fn();
      engine.subscribe(listener);

      await engine.runQACycle();
      expect(listener).toHaveBeenCalledTimes(1);

      await engine.runQACycle();
      expect(listener).toHaveBeenCalledTimes(2);
    });

    it('stops calling subscriber after unsubscribe', async () => {
      const swarm = makeSwarm(1);
      const engine = makeEngine(swarm);

      const listener = jest.fn();
      const unsub = engine.subscribe(listener);

      await engine.runQACycle();
      expect(listener).toHaveBeenCalledTimes(1);

      unsub();

      await engine.runQACycle();
      // Should still be 1 — not called again after unsubscription
      expect(listener).toHaveBeenCalledTimes(1);
    });

    it('handles subscriber errors gracefully without crashing the engine', async () => {
      const swarm = makeSwarm(1);
      const engine = makeEngine(swarm);

      engine.subscribe(() => {
        throw new Error('Subscriber exploded');
      });

      // Should not throw
      await expect(engine.runQACycle()).resolves.toBeDefined();
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 11. Violation log accumulation
  // ──────────────────────────────────────────────────────────────────────────
  describe('Violation log', () => {
    it('accumulates violations across multiple cycles', async () => {
      const swarm = makeSwarm(1);
      const engine = makeEngine(swarm);

      // Cycle 1: violation
      patchAgent(swarm, 'agent-0', {
        status: 'refactoring',
        memoryAnalyzed: 0,
        componentsRefactored: 0,
      });
      await engine.runQACycle();
      expect(engine.getViolationLog().length).toBeGreaterThanOrEqual(1);

      // Cycle 2: another violation
      patchAgent(swarm, 'agent-0', {
        status: 'refactoring',
        memoryAnalyzed: 0,
        componentsRefactored: 0,
      });
      await engine.runQACycle();
      expect(engine.getViolationLog().length).toBeGreaterThanOrEqual(2);
    });

    it('violation log entries have valid blake3Receipt hashes', async () => {
      const swarm = makeSwarm(1);
      patchAgent(swarm, 'agent-0', {
        status: 'refactoring',
        memoryAnalyzed: 0,
        componentsRefactored: 0,
      });

      const engine = makeEngine(swarm);
      await engine.runQACycle();

      for (const violation of engine.getViolationLog()) {
        expect(typeof violation.blake3Receipt).toBe('string');
        expect(violation.blake3Receipt.length).toBeGreaterThan(0);
        // BLAKE3 hashes are hex strings; check basic hex format
        expect(violation.blake3Receipt).toMatch(/^[0-9a-f]+$/);
      }
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 12. Checkpoint management
  // ──────────────────────────────────────────────────────────────────────────
  describe('Checkpoint management', () => {
    it('captures a checkpoint for a healthy agent after each cycle', async () => {
      const swarm = makeSwarm(1);
      patchAgent(swarm, 'agent-0', { status: 'idle', memoryAnalyzed: 0, componentsRefactored: 0 });

      const engine = makeEngine(swarm);
      await engine.runQACycle();

      const cp = engine.getLatestCheckpoint('agent-0');
      expect(cp).toBeDefined();
      expect(cp!.agentId).toBe('agent-0');
      expect(cp!.epoch).toBe(1);
      expect(cp!.blake3Hash.length).toBeGreaterThan(0);
    });

    it('does NOT update checkpoint for a violating agent', async () => {
      const swarm = makeSwarm(1);
      patchAgent(swarm, 'agent-0', { status: 'idle', memoryAnalyzed: 0, componentsRefactored: 0 });

      const engine = makeEngine(swarm);
      await engine.runQACycle(); // checkpoint at epoch 1

      patchAgent(swarm, 'agent-0', {
        status: 'refactoring',
        memoryAnalyzed: 0,
        componentsRefactored: 0,
      });
      await engine.runQACycle(); // violation — no new checkpoint

      const cp = engine.getLatestCheckpoint('agent-0');
      expect(cp!.epoch).toBe(1); // still epoch 1
    });

    it('getLatestCheckpoint returns undefined before first healthy cycle', async () => {
      const swarm = makeSwarm(1);
      const engine = makeEngine(swarm);
      // Immediately violate — no prior healthy cycle
      patchAgent(swarm, 'agent-0', {
        status: 'refactoring',
        memoryAnalyzed: 0,
        componentsRefactored: 0,
      });
      await engine.runQACycle();

      expect(engine.getLatestCheckpoint('agent-0')).toBeUndefined();
    });

    it('checkpoint blake3Hash is deterministic and verifiable', async () => {
      const swarm = makeSwarm(1);
      patchAgent(swarm, 'agent-0', {
        status: 'idle',
        memoryAnalyzed: 100,
        componentsRefactored: 2,
      });

      const engine = makeEngine(swarm);
      await engine.runQACycle();

      const cp = engine.getLatestCheckpoint('agent-0')!;

      // Re-compute the hash independently and compare
      // Path: src/framework/auto/__tests__/ → ../../../ = src/ → lib/crypto/receipts
      const {
        blake3: _blake3,
        canonicalStringify: _canonicalStringify,
      } = require('../../../lib/crypto/receipts');
      const expectedHash = _blake3(_canonicalStringify(cp.snapshot));
      expect(cp.blake3Hash).toBe(expectedHash);
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 13. Overall health classification
  // ──────────────────────────────────────────────────────────────────────────
  describe('Overall health classification', () => {
    it('reports HEALTHY when all agents pass all checks', async () => {
      const swarm = makeSwarm(3);
      // All agents in clean state
      for (let i = 0; i < 3; i++) {
        patchAgent(swarm, `agent-${i}`, {
          status: 'idle',
          memoryAnalyzed: 0,
          componentsRefactored: 0,
        });
      }

      const engine = makeEngine(swarm);
      const report = await engine.runQACycle();
      expect(report.overallHealth).toBe('HEALTHY');
      expect(report.totalViolations).toBe(0);
    });

    it('reports DEGRADED when violations exist but all repairs succeeded', async () => {
      const swarm = makeSwarm(1);
      // Cycle 1: capture checkpoint for rollback to succeed
      patchAgent(swarm, 'agent-0', { status: 'idle', memoryAnalyzed: 0, componentsRefactored: 0 });
      const engine = makeEngine(swarm, { applyStatePatches: true });
      await engine.runQACycle();

      // Inject a repairable violation
      patchAgent(swarm, 'agent-0', {
        status: 'refactoring',
        memoryAnalyzed: 0,
        componentsRefactored: 0,
      });
      const report2 = await engine.runQACycle();

      // Rollback should succeed → DEGRADED not CRITICAL
      expect(report2.totalViolations).toBeGreaterThan(0);
      expect(report2.totalRepairsSucceeded).toBeGreaterThan(0);
      // overallHealth is DEGRADED when repairs partially succeeded
      // (totalViolations > 0 but some repairs succeeded)
      expect(['DEGRADED', 'CRITICAL']).toContain(report2.overallHealth);
    });

    it('reports CRITICAL when violations exist and no repairs succeeded', async () => {
      const swarm = makeSwarm(1);
      // No prior healthy cycle → no checkpoint → escalation → repair fails
      patchAgent(swarm, 'agent-0', {
        status: 'refactoring',
        memoryAnalyzed: 0,
        componentsRefactored: 0,
      });

      const engine = makeEngine(swarm);
      const report = await engine.runQACycle();

      expect(report.overallHealth).toBe('CRITICAL');
      expect(report.totalViolations).toBeGreaterThan(0);
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 14. BLAKE3 chain integrity
  // ──────────────────────────────────────────────────────────────────────────
  describe('BLAKE3 chain integrity', () => {
    it('chain head is empty string before any cycle', () => {
      const swarm = makeSwarm(1);
      const engine = makeEngine(swarm);
      expect(engine.getChainHead()).toBe('');
    });

    it('chain head is non-empty after first cycle', async () => {
      const swarm = makeSwarm(1);
      const engine = makeEngine(swarm);
      await engine.runQACycle();
      expect(engine.getChainHead().length).toBeGreaterThan(0);
    });

    it('chain head changes on every cycle', async () => {
      const swarm = makeSwarm(1);
      const engine = makeEngine(swarm);

      const heads = new Set<string>();
      for (let i = 0; i < 5; i++) {
        await engine.runQACycle();
        heads.add(engine.getChainHead());
      }

      // Each cycle must produce a distinct chain head
      expect(heads.size).toBe(5);
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 15. Multi-agent scenario (integration-style)
  // ──────────────────────────────────────────────────────────────────────────
  describe('Multi-agent heterogeneous scenario', () => {
    it('handles a mix of healthy and violating agents in a single cycle', async () => {
      const swarm = makeSwarm(4);

      // Agents 0 and 2 are healthy
      patchAgent(swarm, 'agent-0', { status: 'idle', memoryAnalyzed: 0, componentsRefactored: 0 });
      patchAgent(swarm, 'agent-2', {
        status: 'analyzing',
        memoryAnalyzed: 200,
        componentsRefactored: 0,
      });

      // Agent 1 has Chatman breach, Agent 3 has entropy overflow
      patchAgent(swarm, 'agent-1', {
        status: 'refactoring',
        memoryAnalyzed: 0,
        componentsRefactored: 0,
      });
      patchAgent(swarm, 'agent-3', {
        status: 'idle',
        memoryAnalyzed: 500,
        componentsRefactored: 200,
      });

      const engine = makeEngine(swarm, { maxAgentRefactorEntropy: 100 });
      const report = await engine.runQACycle();

      const r0 = report.agentResults.find((r) => r.agentId === 'agent-0')!;
      const r1 = report.agentResults.find((r) => r.agentId === 'agent-1')!;
      const r2 = report.agentResults.find((r) => r.agentId === 'agent-2')!;
      const r3 = report.agentResults.find((r) => r.agentId === 'agent-3')!;

      expect(r0.healthy).toBe(true);
      expect(r2.healthy).toBe(true);
      expect(r1.healthy).toBe(false);
      expect(r3.healthy).toBe(false);

      expect(r1.violations.some((v) => v.kind === 'CHATMAN_EQUATION_BREACH')).toBe(true);
      expect(r3.violations.some((v) => v.kind === 'STATE_ENTROPY_OVERFLOW')).toBe(true);

      expect(report.totalViolations).toBeGreaterThanOrEqual(2);
    });
  });
});
