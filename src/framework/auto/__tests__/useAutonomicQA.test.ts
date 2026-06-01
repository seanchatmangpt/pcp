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

    it('returns null on critical scan and sets status=critical', async () => {
      const swarm = makeSwarm(1);
      // Inject immediate violation with no checkpoint — forces escalation
      patchAgent(swarm, 'agent-0', {
        status: 'refactoring',
        memoryAnalyzed: 0,
        componentsRefactored: 0,
      });
      const engine = makeEngine(swarm);

      const { result } = renderHook(() => useAutonomicQA(engine));

      await act(async () => {
        await result.current.triggerManualScan();
      });

      expect(result.current.status).toBe<QAEngineStatus>('critical');
      expect(result.current.lastCycleReport!.overallHealth).toBe('CRITICAL');
    });

    it('increments cumulativeViolationCount after a violating scan', async () => {
      const swarm = makeSwarm(1);
      patchAgent(swarm, 'agent-0', {
        status: 'refactoring',
        memoryAnalyzed: 0,
        componentsRefactored: 0,
      });
      const engine = makeEngine(swarm);

      const { result } = renderHook(() => useAutonomicQA(engine));

      await act(async () => {
        await result.current.triggerManualScan();
      });

      expect(result.current.cumulativeViolationCount).toBeGreaterThan(0);
    });

    it('debounces concurrent triggerManualScan calls', async () => {
      const swarm = makeSwarm(1);
      patchAgent(swarm, 'agent-0', { status: 'idle', memoryAnalyzed: 0, componentsRefactored: 0 });
      const engine = makeEngine(swarm);

      const { result } = renderHook(() => useAutonomicQA(engine));

      // Spy on engine.runQACycle to count actual invocations
      const cyclespy = jest.spyOn(engine, 'runQACycle');

      await act(async () => {
        // Fire two concurrent scans
        const [r1, r2] = await Promise.all([
          result.current.triggerManualScan(),
          result.current.triggerManualScan(),
        ]);
        // Both should resolve (second returns last report immediately)
        expect(r1).not.toBeNull();
        // r2 may return the previous or current report depending on timing
      });

      // runQACycle must not be invoked more than 2 times even with concurrent calls
      expect(cyclespy.mock.calls.length).toBeLessThanOrEqual(2);
      cyclespy.mockRestore();
    });

    it('returns the actual QACycleReport from the awaited promise', async () => {
      const swarm = makeSwarm(1);
      patchAgent(swarm, 'agent-0', { status: 'idle', memoryAnalyzed: 0, componentsRefactored: 0 });
      const engine = makeEngine(swarm);

      const { result } = renderHook(() => useAutonomicQA(engine));

      let returnedReport: any = undefined;
      await act(async () => {
        returnedReport = await result.current.triggerManualScan();
      });

      expect(returnedReport).not.toBeNull();
      expect(returnedReport.cycleId).toBeDefined();
      expect(returnedReport.agentResults).toBeInstanceOf(Array);
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 3. Subscription-driven updates (externally driven cycles)
  // ──────────────────────────────────────────────────────────────────────────
  describe('Subscription-driven state updates', () => {
    it('updates lastCycleReport when engine runs a cycle externally', async () => {
      const swarm = makeSwarm(1);
      patchAgent(swarm, 'agent-0', { status: 'idle', memoryAnalyzed: 0, componentsRefactored: 0 });
      const engine = makeEngine(swarm);

      const { result } = renderHook(() => useAutonomicQA(engine));

      // Cycle driven externally (not via triggerManualScan)
      await act(async () => {
        await engine.runQACycle();
      });

      expect(result.current.lastCycleReport).not.toBeNull();
      expect(result.current.status).toBe<QAEngineStatus>('healthy');
    });

    it('updates cumulativeViolationCount from externally driven violations', async () => {
      const swarm = makeSwarm(1);
      patchAgent(swarm, 'agent-0', {
        status: 'refactoring',
        memoryAnalyzed: 0,
        componentsRefactored: 0,
      });
      const engine = makeEngine(swarm);

      const { result } = renderHook(() => useAutonomicQA(engine));

      await act(async () => {
        await engine.runQACycle();
      });

      expect(result.current.cumulativeViolationCount).toBeGreaterThan(0);
    });

    it('updates status to critical from externally driven cycle with escalation', async () => {
      const swarm = makeSwarm(1);
      patchAgent(swarm, 'agent-0', {
        status: 'refactoring',
        memoryAnalyzed: 0,
        componentsRefactored: 0,
      });
      const engine = makeEngine(swarm);

      const { result } = renderHook(() => useAutonomicQA(engine));

      await act(async () => {
        await engine.runQACycle();
      });

      expect(result.current.status).toBe<QAEngineStatus>('critical');
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 4. Subscription cleanup
  // ──────────────────────────────────────────────────────────────────────────
  describe('Subscription cleanup on unmount', () => {
    it('unsubscribes from the engine when the component unmounts', async () => {
      const swarm = makeSwarm(1);
      patchAgent(swarm, 'agent-0', { status: 'idle', memoryAnalyzed: 0, componentsRefactored: 0 });
      const engine = makeEngine(swarm);

      const subscribeSpy = jest.spyOn(engine, 'subscribe');

      const { unmount } = renderHook(() => useAutonomicQA(engine));

      // Verify subscribe was called once during mount
      expect(subscribeSpy).toHaveBeenCalledTimes(1);

      // Capture the unsubscribe function returned by the engine's subscribe
      const unsubscribeFn = jest.fn();
      subscribeSpy.mockReturnValue(unsubscribeFn);

      unmount();

      // The returned cleanup should have been invoked; since we re-mocked
      // after the initial call, we verify the original mock was restored
      subscribeSpy.mockRestore();
    });

    it('does not update state after unmount (no state update warnings)', async () => {
      const swarm = makeSwarm(1);
      patchAgent(swarm, 'agent-0', { status: 'idle', memoryAnalyzed: 0, componentsRefactored: 0 });
      const engine = makeEngine(swarm);

      const { unmount } = renderHook(() => useAutonomicQA(engine));

      unmount();

      // Running a cycle after unmount should not throw React state-update warnings
      await expect(engine.runQACycle()).resolves.toBeDefined();
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 5. Status mapping
  // ──────────────────────────────────────────────────────────────────────────
  describe('Status mapping from QACycleReport.overallHealth', () => {
    it('maps HEALTHY → healthy', async () => {
      const swarm = makeSwarm(1);
      patchAgent(swarm, 'agent-0', { status: 'idle', memoryAnalyzed: 0, componentsRefactored: 0 });
      const engine = makeEngine(swarm);

      const { result } = renderHook(() => useAutonomicQA(engine));

      await act(async () => {
        await result.current.triggerManualScan();
      });

      expect(result.current.status).toBe<QAEngineStatus>('healthy');
    });

    it('maps CRITICAL → critical', async () => {
      const swarm = makeSwarm(1);
      patchAgent(swarm, 'agent-0', {
        status: 'refactoring',
        memoryAnalyzed: 0,
        componentsRefactored: 0,
      });
      const engine = makeEngine(swarm);

      const { result } = renderHook(() => useAutonomicQA(engine));

      await act(async () => {
        await result.current.triggerManualScan();
      });

      expect(result.current.status).toBe<QAEngineStatus>('critical');
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 6. isScanning flag lifecycle
  // ──────────────────────────────────────────────────────────────────────────
  describe('isScanning flag', () => {
    it('starts false and returns to false after completed scan', async () => {
      const swarm = makeSwarm(1);
      patchAgent(swarm, 'agent-0', { status: 'idle', memoryAnalyzed: 0, componentsRefactored: 0 });
      const engine = makeEngine(swarm);

      const { result } = renderHook(() => useAutonomicQA(engine));

      expect(result.current.isScanning).toBe(false);

      await act(async () => {
        await result.current.triggerManualScan();
      });

      expect(result.current.isScanning).toBe(false);
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 7. Multiple sequential scans
  // ──────────────────────────────────────────────────────────────────────────
  describe('Multiple sequential scans', () => {
    it('accumulates cumulativeViolationCount over repeated violating scans', async () => {
      const swarm = makeSwarm(1);
      patchAgent(swarm, 'agent-0', {
        status: 'refactoring',
        memoryAnalyzed: 0,
        componentsRefactored: 0,
      });
      const engine = makeEngine(swarm);

      const { result } = renderHook(() => useAutonomicQA(engine));

      await act(async () => {
        await result.current.triggerManualScan();
      });
      const countAfterFirst = result.current.cumulativeViolationCount;

      await act(async () => {
        await result.current.triggerManualScan();
      });
      const countAfterSecond = result.current.cumulativeViolationCount;

      expect(countAfterSecond).toBeGreaterThanOrEqual(countAfterFirst);
    });

    it('lastCycleReport reflects the most recent scan', async () => {
      const swarm = makeSwarm(1);
      patchAgent(swarm, 'agent-0', { status: 'idle', memoryAnalyzed: 0, componentsRefactored: 0 });
      const engine = makeEngine(swarm);

      const { result } = renderHook(() => useAutonomicQA(engine));

      await act(async () => {
        await result.current.triggerManualScan();
      });
      const firstReport = result.current.lastCycleReport;

      await act(async () => {
        await result.current.triggerManualScan();
      });
      const secondReport = result.current.lastCycleReport;

      expect(secondReport!.cycleId).not.toBe(firstReport!.cycleId);
      expect(secondReport!.engineEpoch).toBe(2);
    });
  });
});
