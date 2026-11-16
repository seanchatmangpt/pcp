// src/framework/auto/__tests__/useAutonomicQA.test.ts
//
// Jest test suite for useAutonomicQA hook
//
// Testing strategy:
//   • Uses @testing-library/react-native `renderHook` to exercise the hook
//     in a full React lifecycle (useEffect, useState, useCallback).
//   • AutonomicQAEngine is NOT mocked — the actual engine is used with a
//     controlled AppSwarmManager so we validate the full integration path.
//   • act() is used around all state-triggering operations to flush updates.

import { renderHook, act } from '@testing-library/react-native';
import { AppSwarmManager, AgentInfo } from '../../v30/autonomous-swarm/AppSwarmManager';
import { AutonomicQAEngine } from '../AutonomicQAEngine';
import { useAutonomicQA, QAEngineStatus } from '../useAutonomicQA';
import { TelemetryManager } from '../../membrane/managers/telemetry';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeSwarm(agentCount = 2): AppSwarmManager {
  return new AppSwarmManager(agentCount);
}

function makeEngine(swarm: AppSwarmManager): AutonomicQAEngine {
  return new AutonomicQAEngine(swarm, {}, new TelemetryManager());
}

function patchAgent(swarm: AppSwarmManager, agentId: string, patch: Partial<AgentInfo>): void {
  const agent = swarm.getAgent(agentId);
  if (!agent) throw new Error(`Agent ${agentId} not found`);
  Object.assign(agent, patch);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('useAutonomicQA', () => {
  // ──────────────────────────────────────────────────────────────────────────
  // 1. Initial state
  // ──────────────────────────────────────────────────────────────────────────
  describe('Initial state', () => {
    it('returns status=idle and null lastCycleReport before any scan', () => {
      const swarm = makeSwarm(1);
      const engine = makeEngine(swarm);

      const { result } = renderHook(() => useAutonomicQA(engine));

      expect(result.current.status).toBe<QAEngineStatus>('idle');
      expect(result.current.lastCycleReport).toBeNull();
      expect(result.current.isScanning).toBe(false);
      expect(result.current.cumulativeViolationCount).toBe(0);
    });

    it('returns status=healthy when engine already has a healthy report', async () => {
      const swarm = makeSwarm(1);
      const engine = makeEngine(swarm);

      // Pre-run a healthy cycle before mounting the hook
      patchAgent(swarm, 'agent-0', { status: 'idle', memoryAnalyzed: 0, componentsRefactored: 0 });
      await engine.runQACycle();

      const { result } = renderHook(() => useAutonomicQA(engine));

      expect(result.current.status).toBe<QAEngineStatus>('healthy');
      expect(result.current.lastCycleReport).not.toBeNull();
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 2. triggerManualScan
  // ──────────────────────────────────────────────────────────────────────────
  describe('triggerManualScan', () => {
    it('transitions to scanning then to healthy on a clean swarm', async () => {
      const swarm = makeSwarm(1);
      patchAgent(swarm, 'agent-0', { status: 'idle', memoryAnalyzed: 0, componentsRefactored: 0 });
      const engine = makeEngine(swarm);

      const { result } = renderHook(() => useAutonomicQA(engine));

      let report = null;
      await act(async () => {
        report = await result.current.triggerManualScan();
      });

      expect(result.current.status).toBe<QAEngineStatus>('healthy');
      expect(result.current.lastCycleReport).not.toBeNull();
      expect(result.current.isScanning).toBe(false);
      expect(report).not.toBeNull();
    });
  });
});
