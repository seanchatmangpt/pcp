// src/framework/auto/useAutonomicQA.ts
//
// React Native hook that subscribes to an AutonomicQAEngine instance and
// exposes a clean, typed API for components and consequence-supervision screens.
//
// Usage:
//   const { status, lastCycleReport, triggerManualScan } = useAutonomicQA(engine);

import { useState, useEffect, useCallback, useRef } from 'react';
import { AutonomicQAEngine, QACycleReport } from './AutonomicQAEngine';

// ---------------------------------------------------------------------------
// Public type surface
// ---------------------------------------------------------------------------

/** QA engine lifecycle status visible to consuming components. */
export type QAEngineStatus =
  | 'idle' // engine constructed but no cycle run yet
  | 'scanning' // a QA cycle is currently in progress
  | 'healthy' // last completed cycle reported zero violations
  | 'degraded' // violations found but all repairs succeeded
  | 'critical' // violations found with unrepaired failures
  | 'error'; // an unexpected exception occurred during a cycle

export interface UseAutonomicQAResult {
  /** Current lifecycle status of the QA engine. */
  readonly status: QAEngineStatus;

  /**
   * The most-recently completed `QACycleReport`, or `null` before the first
   * scan has been executed.
   */
  readonly lastCycleReport: QACycleReport | null;

  /**
   * Imperatively trigger a manual QA scan.  Safe to call while a scan is
   * already running — the engine debounces concurrent invocations and the
   * hook will reflect the in-progress scan via `status === 'scanning'`.
   *
   * Returns a Promise that resolves with the completed report so callers
   * can `await` the scan result if needed.
   */
  readonly triggerManualScan: () => Promise<QACycleReport | null>;

  /**
   * Total number of violations accumulated across all cycles since mount.
   * Useful for badge indicators / consequence-supervision dashboards.
   */
  readonly cumulativeViolationCount: number;

  /**
   * Whether the hook is currently executing a scan triggered by
   * `triggerManualScan`.
   */
  readonly isScanning: boolean;
}

// ---------------------------------------------------------------------------
// Hook implementation
// ---------------------------------------------------------------------------

/**
 * `useAutonomicQA`
 *
 * Subscribes to the given `AutonomicQAEngine` and re-renders the component
 * whenever a new QA cycle completes.
 *
 * The hook owns no timers or intervals — scan scheduling is the caller's
 * responsibility (e.g. via `useEffect` + `setInterval` in a supervisor
 * component, or via `triggerManualScan`).
 */
export function useAutonomicQA(engine: AutonomicQAEngine): UseAutonomicQAResult {
  const [lastCycleReport, setLastCycleReport] = useState<QACycleReport | null>(() =>
    engine.getLastReport()
  );
  const [status, setStatus] = useState<QAEngineStatus>(() =>
    _reportToStatus(engine.getLastReport())
  );
  const [isScanning, setIsScanning] = useState<boolean>(false);
  const [cumulativeViolationCount, setCumulativeViolationCount] = useState<number>(
    () => engine.getViolationLog().length
  );

  // Keep a stable ref to the engine so the cleanup in useEffect doesn't
  // capture a stale closure.
  const engineRef = useRef<AutonomicQAEngine>(engine);
  engineRef.current = engine;

  // Subscribe to engine cycle completions
  useEffect(() => {
    const unsubscribe = engine.subscribe(() => {
      const report = engineRef.current.getLastReport();
      setLastCycleReport(report);
      setStatus(_reportToStatus(report));
      setCumulativeViolationCount(engineRef.current.getViolationLog().length);

      // If a scan was in progress when the engine notified us, clear the flag.
      // The `triggerManualScan` callback also clears it in its own finally block,
      // but the subscription path ensures consistency if the engine is driven
      // externally (e.g. a background scheduler).
      setIsScanning(false);
    });

    return unsubscribe;
  }, [engine]);

  // Imperative manual scan trigger
  const triggerManualScan = useCallback(async (): Promise<QACycleReport | null> => {
    if (isScanning) {
      // Already scanning — return the last report rather than queuing work
      return engineRef.current.getLastReport();
    }

    setIsScanning(true);
    setStatus('scanning');

    try {
      const report = await engineRef.current.runQACycle();
      // The subscription listener will update state, but we also eagerly
      // update here to ensure synchronous callers see the result immediately.
      setLastCycleReport(report);
      setStatus(_reportToStatus(report));
      setCumulativeViolationCount(engineRef.current.getViolationLog().length);
      return report;
    } catch (err: unknown) {
      setStatus('error');
      return null;
    } finally {
      setIsScanning(false);
    }
  }, [isScanning]);

  return {
    status,
    lastCycleReport,
    triggerManualScan,
    cumulativeViolationCount,
    isScanning,
  };
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function _reportToStatus(report: QACycleReport | null): QAEngineStatus {
  if (report === null) return 'idle';
  switch (report.overallHealth) {
    case 'HEALTHY':
      return 'healthy';
    case 'DEGRADED':
      return 'degraded';
    case 'CRITICAL':
      return 'critical';
    default:
      return 'error';
  }
}
