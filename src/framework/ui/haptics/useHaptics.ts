import { useCallback, useEffect, useRef } from 'react';
import { IntelligentHaptics, HapticFeedbackPattern } from './IntelligentHaptics';

/**
 * useHaptics Hook
 *
 * The primary DX entry point for Intelligent Haptics.
 * Provides memoized functions to trigger various haptic patterns.
 *
 * @returns An object containing haptic trigger functions.
 */
export const useHaptics = () => {
  /**
   * Generic trigger for any supported pattern.
   */
  const trigger = useCallback((pattern: HapticFeedbackPattern) => {
    IntelligentHaptics.trigger(pattern);
  }, []);

  /**
   * Impact trigger based on tension (0-1).
   */
  const impact = useCallback((tension: number) => {
    IntelligentHaptics.impact(tension);
  }, []);

  // Pre-bound convenience methods for common patterns
  const success = useCallback(() => trigger(HapticFeedbackPattern.SUCCESS), [trigger]);
  const error = useCallback(() => trigger(HapticFeedbackPattern.ERROR), [trigger]);
  const warning = useCallback(() => trigger(HapticFeedbackPattern.WARNING), [trigger]);
  const light = useCallback(() => trigger(HapticFeedbackPattern.LIGHT), [trigger]);
  const medium = useCallback(() => trigger(HapticFeedbackPattern.MEDIUM), [trigger]);
  const heavy = useCallback(() => trigger(HapticFeedbackPattern.HEAVY), [trigger]);
  const selection = useCallback(() => trigger(HapticFeedbackPattern.SELECTION), [trigger]);

  return {
    trigger,
    impact,
    success,
    error,
    warning,
    light,
    medium,
    heavy,
    selection,
  };
};

/**
 * useHapticEffect Hook
 *
 * Triggers a haptic pattern when a specific dependency changes.
 *
 * @param dependency - The value to watch for changes.
 * @param pattern - The haptic pattern to trigger.
 * @param options - Configuration options.
 */
export const useHapticEffect = (
  dependency: any,
  pattern: HapticFeedbackPattern = HapticFeedbackPattern.SELECTION,
  options: { skipFirst?: boolean } = { skipFirst: true }
) => {
  const isFirstRun = useRef(true);

  useEffect(() => {
    if (isFirstRun.current) {
      isFirstRun.current = false;
      if (options.skipFirst) return;
    }

    IntelligentHaptics.trigger(pattern);
  }, [dependency, pattern, options.skipFirst]);
};

/**
 * useTensionHaptics Hook
 *
 * Specialized hook for gesture-based interactions.
 * Triggers haptics as tension increases across thresholds.
 *
 * @returns A function to update current tension.
 */
export const useTensionHaptics = () => {
  const lastThreshold = useRef<number>(0);

  const updateTension = useCallback((tension: number) => {
    const currentThreshold = tension > 0.9 ? 3 : tension > 0.5 ? 2 : tension > 0.1 ? 1 : 0;

    if (currentThreshold !== lastThreshold.current && currentThreshold > lastThreshold.current) {
      IntelligentHaptics.impact(tension);
    }

    lastThreshold.current = currentThreshold;
  }, []);

  return updateTension;
};
