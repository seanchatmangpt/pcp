import { useState, useEffect, useCallback } from 'react';

/**
 * Interface representing a recorded performance metric.
 */
export interface PerformanceMetric {
  id: string;
  name: string;
  duration: number;
  timestamp: number;
}

/**
 * Options for the performance monitor hook.
 */
export interface UsePerformanceMonitorOptions {
  /** Maximum number of metrics to keep in memory */
  maxMetrics?: number;
  /** Whether monitoring is enabled */
  enabled?: boolean;
}

/**
 * Hook for tracking and monitoring real-time performance metrics in the Admin UI.
 *
 * @param options - Configuration options for the monitor.
 * @returns A tuple containing the list of metrics and a function to record a new metric.
 */
export function usePerformanceMonitor(options: UsePerformanceMonitorOptions = {}) {
  const { maxMetrics = 100, enabled = true } = options;
  const [metrics, setMetrics] = useState<PerformanceMetric[]>([]);

  const recordMetric = useCallback(
    (name: string, duration: number) => {
      if (!enabled) return;

      setMetrics((prev) => {
        const newMetric: PerformanceMetric = {
          id: Math.random().toString(36).substring(2, 9),
          name,
          duration,
          timestamp: Date.now(),
        };

        const updated = [newMetric, ...prev];
        if (updated.length > maxMetrics) {
          return updated.slice(0, maxMetrics);
        }
        return updated;
      });
    },
    [enabled, maxMetrics]
  );

  const clearMetrics = useCallback(() => {
    setMetrics([]);
  }, []);

  return { metrics, recordMetric, clearMetrics };
}
