import { useState, useEffect, useRef } from 'react';
import { useSharedValue, useFrameCallback } from 'react-native-reanimated';

/**
 * Real-time application performance vitals.
 */
export interface AppVitals {
  /** JavaScript thread frames per second */
  jsFps: number;
  /** UI (Native) thread frames per second */
  uiFps: number;
  /** Approximate memory usage in Megabytes */
  memory: number;
}

/**
 * Options for the useAppVitals hook.
 */
export interface UseAppVitalsOptions {
  /** How often to update the vitals state in milliseconds. Defaults to 1000ms. */
  updateInterval?: number;
  /** Whether the monitor is enabled. Defaults to true. */
  enabled?: boolean;
}

/**
 * useAppVitals hook tracks JS thread FPS, UI thread FPS, and approximate memory usage.
 * Optimized for near-zero overhead by using shared values and throttled state updates.
 *
 * @param options - Configuration options for the vitals monitor.
 * @returns The current application vitals.
 */
export function useAppVitals(options: UseAppVitalsOptions = {}): AppVitals {
  const { updateInterval = 1000, enabled = true } = options;
  const [vitals, setVitals] = useState<AppVitals>({ jsFps: 0, uiFps: 0, memory: 0 });

  // JS Thread Frame Tracking
  const jsFrameCount = useRef(0);

  // UI Thread Frame Tracking (using Reanimated for zero-bridge overhead)
  const uiFrameCount = useSharedValue(0);

  /**
   * UI thread frame callback.
   * Increments the shared value on every native frame.
   */
  useFrameCallback(() => {
    'worklet';
    uiFrameCount.value += 1;
  }, enabled);

  useEffect(() => {
    if (!enabled) {
      setVitals({ jsFps: 0, uiFps: 0, memory: 0 });
      return;
    }

    let jsFrameId: number;
    /**
     * JS thread frame tracker using requestAnimationFrame.
     */
    const tickJs = () => {
      jsFrameCount.current += 1;
      jsFrameId = requestAnimationFrame(tickJs);
    };
    jsFrameId = requestAnimationFrame(tickJs);

    let lastTimestamp = Date.now();

    /**
     * Interval to calculate FPS and memory metrics.
     */
    const intervalId = setInterval(() => {
      const now = Date.now();
      const deltaMs = now - lastTimestamp;

      // Prevent division by zero or negative deltas
      if (deltaMs <= 0) return;

      const currentJsFrames = jsFrameCount.current;
      const currentUiFrames = uiFrameCount.value;

      // Reset counters for next interval
      jsFrameCount.current = 0;
      uiFrameCount.value = 0;
      lastTimestamp = now;

      // Memory estimation logic
      let memoryUsage = 0;
      try {
        // @ts-ignore - Hermes internal stats if available
        if (typeof global.HermesInternal === 'object' && global.HermesInternal !== null) {
          // @ts-ignore
          const stats = global.HermesInternal.getInstrumentedStats();
          memoryUsage = stats.jsHeapTotalMemory / (1024 * 1024);
        }
        // @ts-ignore - Standard performance.memory if available (Web/Some engines)
        else if (typeof performance !== 'undefined' && (performance as any).memory) {
          memoryUsage = (performance as any).memory.usedJSHeapSize / (1024 * 1024);
        }
      } catch (e) {
        // Silently fail to ensure zero-impact on app stability
      }

      setVitals({
        jsFps: Math.round((currentJsFrames * 1000) / deltaMs),
        uiFps: Math.round((currentUiFrames * 1000) / deltaMs),
        memory: Number(memoryUsage.toFixed(2)),
      });
    }, updateInterval);

    return () => {
      cancelAnimationFrame(jsFrameId);
      clearInterval(intervalId);
    };
  }, [enabled, updateInterval, uiFrameCount]);

  return vitals;
}
