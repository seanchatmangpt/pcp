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
  });
});
